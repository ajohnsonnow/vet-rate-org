# ╔═══════════════════════════════════════════════════════════════════════╗
# ║  DIAMOND STANDARD: LoRA Training & Merge Pipeline                    ║
# ║  Hardware: NVIDIA RTX 4080 Super OC (16GB VRAM)                      ║
# ║  Target: Standalone merged models for WebLLM compilation             ║
# ╚═══════════════════════════════════════════════════════════════════════╝

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('auditor', 'writer', 'both')]
    [string]$SwarmMember = 'auditor',
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipValidation,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipMerge,
    
    [Parameter(Mandatory=$false)]
    [switch]$DryRun
)

# ==============================================================================
# CONFIGURATION
# ==============================================================================

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$PROJECT_ROOT = Split-Path -Parent $SCRIPT_DIR
$CONFIG_DIR = Join-Path $SCRIPT_DIR "axolotl-configs"
$OUTPUT_DIR = Join-Path $SCRIPT_DIR "models"
$MERGED_DIR = Join-Path $OUTPUT_DIR "merged-models"
$LOG_DIR = Join-Path $SCRIPT_DIR "logs"

# GPU Configuration
$env:CUDA_VISIBLE_DEVICES = "0"  # Force RTX 4080 Super
$env:PYTORCH_CUDA_ALLOC_CONF = "expandable_segments:True"  # Better VRAM management

# Training configurations
$CONFIGS = @{
    'auditor' = @{
        ConfigFile = 'auditor-3b-qlora.yml'
        AdapterDir = 'lora-adapters/vetrate-auditor-3b'
        MergedName = 'VetRate-Auditor-3B-v1'
        Description = 'VA Regulations Expert (38 CFR/BVA/OGC/FREG)'
        EstimatedTime = '2-4 hours'
    }
    'writer' = @{
        ConfigFile = 'writer-3b-qlora.yml'
        AdapterDir = 'lora-adapters/vetrate-writer-3b'
        MergedName = 'VetRate-Writer-3B-v1'
        Description = 'Veteran Advocacy Specialist'
        EstimatedTime = '1.5-3 hours'
    }
}

# ==============================================================================
# LOGGING & DISPLAY FUNCTIONS
# ==============================================================================

function Write-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host "╔$('═' * 70)╗" -ForegroundColor Cyan
    Write-Host "║ $($Message.PadRight(68)) ║" -ForegroundColor White
    Write-Host "╚$('═' * 70)╝" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Section {
    param([string]$Message)
    Write-Host ""
    Write-Host $Message -ForegroundColor Yellow
    Write-Host $('─' * 70) -ForegroundColor DarkGray
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor Cyan
}

function Write-Step {
    param([string]$Number, [string]$Message)
    Write-Host "[$Number] $Message" -ForegroundColor White
}

# ==============================================================================
# VALIDATION FUNCTIONS
# ==============================================================================

function Test-Prerequisites {
    Write-Section "VALIDATING PREREQUISITES"
    
    $allValid = $true
    
    # Check Python
    try {
        $pythonVersion = python --version 2>&1
        Write-Success "Python: $pythonVersion"
    } catch {
        Write-Error "Python not found in PATH"
        $allValid = $false
    }
    
    # Check CUDA
    try {
        $cudaInfo = nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>&1
        Write-Success "GPU: $cudaInfo"
    } catch {
        Write-Error "NVIDIA drivers not found (nvidia-smi failed)"
        $allValid = $false
    }
    
    # Check Axolotl
    try {
        $axolotlVersion = axolotl version 2>&1
        Write-Success "Axolotl: $axolotlVersion"
    } catch {
        Write-Error "Axolotl not installed or not in PATH"
        Write-Info "Install: pip install git+https://github.com/OpenAccess-AI-Collective/axolotl.git"
        $allValid = $false
    }
    
    # Check PyTorch CUDA
    try {
        $torchCuda = python -c "import torch; print(f'PyTorch {torch.__version__}, CUDA {torch.version.cuda}, Available: {torch.cuda.is_available()}')" 2>&1
        Write-Success "PyTorch: $torchCuda"
    } catch {
        Write-Error "PyTorch not properly configured"
        $allValid = $false
    }
    
    # Check disk space
    $drive = (Get-Item $PROJECT_ROOT).PSDrive.Name
    $freeSpace = (Get-PSDrive $drive).Free / 1GB
    if ($freeSpace -gt 10) {
        Write-Success "Disk Space: $([math]::Round($freeSpace, 1)) GB free"
    } else {
        Write-Warning "Low disk space: $([math]::Round($freeSpace, 1)) GB free (recommend 10+ GB)"
    }
    
    # Check config files
    if (Test-Path $CONFIG_DIR) {
        $configCount = (Get-ChildItem $CONFIG_DIR -Filter "*-qlora.yml").Count
        Write-Success "Config Directory: $configCount YAML files found"
    } else {
        Write-Error "Config directory not found: $CONFIG_DIR"
        $allValid = $false
    }
    
    if (-not $allValid) {
        throw "Prerequisites validation failed"
    }
    
    Write-Host ""
}

function Test-ConfigFile {
    param([string]$ConfigPath)
    
    if (-not (Test-Path $ConfigPath)) {
        throw "Config file not found: $ConfigPath"
    }
    
    # Run Python validator
    $validatorPath = Join-Path $SCRIPT_DIR "validate_configs.py"
    if (Test-Path $validatorPath) {
        Write-Info "Running config validator..."
        python $validatorPath
        if ($LASTEXITCODE -ne 0) {
            throw "Config validation failed"
        }
    }
}

# ==============================================================================
# GPU MONITORING
# ==============================================================================

function Start-GPUMonitor {
    Write-Section "STARTING GPU MONITOR"
    
    $monitorScript = {
        $logFile = $args[0]
        
        while ($true) {
            $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            $gpuInfo = nvidia-smi --query-gpu=utilization.gpu,utilization.memory,memory.used,memory.total,temperature.gpu,power.draw --format=csv,noheader,nounits 2>&1
            
            if ($gpuInfo) {
                $line = "$timestamp,$gpuInfo"
                Add-Content -Path $logFile -Value $line
            }
            
            Start-Sleep -Seconds 10
        }
    }
    
    $monitorLog = Join-Path $LOG_DIR "gpu_monitor_$(Get-Date -Format 'yyyyMMdd_HHmmss').csv"
    New-Item -ItemType Directory -Path $LOG_DIR -Force | Out-Null
    
    # Write CSV header
    "Timestamp,GPU_Util_%,Memory_Util_%,Memory_Used_MB,Memory_Total_MB,Temp_C,Power_W" | Out-File $monitorLog
    
    $job = Start-Job -ScriptBlock $monitorScript -ArgumentList $monitorLog
    
    Write-Success "GPU monitoring started (Job ID: $($job.Id))"
    Write-Info "Log: $monitorLog"
    
    return $job
}

function Stop-GPUMonitor {
    param($Job)
    
    if ($Job) {
        Stop-Job -Job $Job -ErrorAction SilentlyContinue
        Remove-Job -Job $Job -Force -ErrorAction SilentlyContinue
        Write-Info "GPU monitor stopped"
    }
}

# ==============================================================================
# TRAINING EXECUTION
# ==============================================================================

function Start-LoRATraining {
    param(
        [string]$ConfigFile,
        [string]$SwarmName
    )
    
    Write-Header "TRAINING: $SwarmName"
    
    $configPath = Join-Path $CONFIG_DIR $ConfigFile
    $config = $CONFIGS[$SwarmName.ToLower()]
    
    Write-Info "Configuration: $ConfigFile"
    Write-Info "Description: $($config.Description)"
    Write-Info "Estimated Time: $($config.EstimatedTime)"
    Write-Info "Output: $($config.AdapterDir)"
    Write-Host ""
    
    # Validate config
    if (-not $SkipValidation) {
        Test-ConfigFile -ConfigPath $configPath
        Write-Success "Configuration validated"
        Write-Host ""
    }
    
    # Display training expectations
    Write-Section "WHAT TO WATCH FOR"
    Write-Host "✅ GPU Utilization:      90-100% (indicates efficient training)" -ForegroundColor Green
    Write-Host "✅ VRAM Usage:           11-12 GB / 16 GB (70-75%)" -ForegroundColor Green
    Write-Host "✅ Temperature:          <85°C (safe operating range)" -ForegroundColor Green
    Write-Host "✅ Loss Decreasing:      Train loss should drop over epochs" -ForegroundColor Green
    Write-Host "✅ Eval Loss:            Should be close to train loss (no overfit)" -ForegroundColor Green
    Write-Host "⚠️  Eval > Train Loss:   OK if difference <0.3 (slight overfit)" -ForegroundColor Yellow
    Write-Host "❌ Eval >> Train Loss:   Bad if difference >0.5 (overfitting)" -ForegroundColor Red
    Write-Host ""
    
    # Confirm start
    if (-not $DryRun) {
        Write-Host "Press Ctrl+C within 5 seconds to cancel..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
    }
    
    # Start training
    Write-Section "EXECUTING TRAINING"
    Write-Info "Starting axolotl train..."
    Write-Host ""
    
    if ($DryRun) {
        Write-Warning "DRY RUN: Would execute: axolotl train $configPath"
        return $true
    }
    
    # Execute training
    Push-Location $CONFIG_DIR
    try {
        axolotl train $ConfigFile
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Success "Training completed successfully"
            return $true
        } else {
            Write-Error "Training failed with exit code $LASTEXITCODE"
            return $false
        }
    } finally {
        Pop-Location
    }
}

# ==============================================================================
# ADAPTER MERGING (CRITICAL FOR WEBLLM)
# ==============================================================================

function Merge-LoRAAdapter {
    param(
        [string]$ConfigFile,
        [string]$SwarmName
    )
    
    Write-Header "MERGING ADAPTER: $SwarmName"
    
    $config = $CONFIGS[$SwarmName.ToLower()]
    $configPath = Join-Path $CONFIG_DIR $ConfigFile
    $adapterPath = Join-Path $OUTPUT_DIR $config.AdapterDir
    $mergedPath = Join-Path $MERGED_DIR $config.MergedName
    
    # Verify adapter exists
    if (-not (Test-Path $adapterPath)) {
        throw "Adapter not found: $adapterPath"
    }
    
    $adapterFiles = Get-ChildItem $adapterPath -File
    Write-Info "Adapter Directory: $adapterPath"
    Write-Info "Adapter Files: $($adapterFiles.Count) files"
    
    # Check for adapter model
    $adapterModel = Get-ChildItem $adapterPath -Filter "adapter_model.*" -File
    if (-not $adapterModel) {
        throw "Adapter model file not found in $adapterPath"
    }
    Write-Success "Found: $($adapterModel.Name) ($([math]::Round($adapterModel.Length/1MB, 2)) MB)"
    
    Write-Host ""
    Write-Section "WHY MERGING IS CRITICAL"
    Write-Host "🎯 WebLLM Requirement:" -ForegroundColor Cyan
    Write-Host "   WebLLM expects a standalone model directory with all weights merged." -ForegroundColor White
    Write-Host "   LoRA adapters (separate files) cannot be easily compiled to WebGPU." -ForegroundColor White
    Write-Host ""
    Write-Host "🔄 Merge Process:" -ForegroundColor Cyan
    Write-Host "   Base Model (3B params) + LoRA Adapter (20M params) → Merged Model (3B params)" -ForegroundColor White
    Write-Host "   Result: Single unified model ready for MLC compilation" -ForegroundColor White
    Write-Host ""
    
    # Create merged directory
    New-Item -ItemType Directory -Path $MERGED_DIR -Force | Out-Null
    
    if ($DryRun) {
        Write-Warning "DRY RUN: Would execute merge to $mergedPath"
        return $true
    }
    
    # Execute merge
    Write-Section "EXECUTING MERGE"
    Write-Info "Merging adapter into base model..."
    Write-Info "Output: $mergedPath"
    Write-Host ""
    
    Push-Location $CONFIG_DIR
    try {
        # Axolotl merge command
        python -m axolotl.cli.merge_lora `
            $ConfigFile `
            --lora_model_dir "../$($config.AdapterDir)" `
            --output_dir "../merged-models/$($config.MergedName)" `
            --verbose
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Success "Merge completed successfully"
            
            # Verify merged model
            if (Test-Path $mergedPath) {
                $mergedSize = (Get-ChildItem $mergedPath -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1GB
                Write-Success "Merged Model Size: $([math]::Round($mergedSize, 2)) GB"
                
                # List key files
                Write-Host ""
                Write-Info "Merged Model Contents:"
                Get-ChildItem $mergedPath -File | ForEach-Object {
                    $sizeMB = [math]::Round($_.Length / 1MB, 2)
                    Write-Host "  • $($_.Name) ($sizeMB MB)" -ForegroundColor White
                }
            }
            
            return $true
        } else {
            Write-Error "Merge failed with exit code $LASTEXITCODE"
            return $false
        }
    } finally {
        Pop-Location
    }
}

# ==============================================================================
# VALIDATION & TESTING
# ==============================================================================

function Test-MergedModel {
    param([string]$MergedPath)
    
    Write-Section "VALIDATING MERGED MODEL"
    
    if (-not (Test-Path $MergedPath)) {
        Write-Error "Merged model not found: $MergedPath"
        return $false
    }
    
    # Check for required files
    $requiredFiles = @(
        "config.json",
        "tokenizer_config.json",
        "tokenizer.json"
    )
    
    $allFound = $true
    foreach ($file in $requiredFiles) {
        $filePath = Join-Path $MergedPath $file
        if (Test-Path $filePath) {
            Write-Success "Found: $file"
        } else {
            Write-Warning "Missing: $file"
            $allFound = $false
        }
    }
    
    # Check for model weights (safetensors or bin)
    $weightFiles = Get-ChildItem $MergedPath -Filter "*.safetensors" -File
    if (-not $weightFiles) {
        $weightFiles = Get-ChildItem $MergedPath -Filter "*.bin" -File
    }
    
    if ($weightFiles) {
        $totalSize = ($weightFiles | Measure-Object -Property Length -Sum).Sum / 1GB
        Write-Success "Model Weights: $($weightFiles.Count) files ($([math]::Round($totalSize, 2)) GB)"
    } else {
        Write-Error "No model weight files found (.safetensors or .bin)"
        $allFound = $false
    }
    
    Write-Host ""
    return $allFound
}

# ==============================================================================
# MAIN EXECUTION PIPELINE
# ==============================================================================

function Invoke-TrainingPipeline {
    param([string]$SwarmMember)
    
    $startTime = Get-Date
    
    Write-Header "DIAMOND STANDARD: LORA TRAINING & MERGE PIPELINE"
    Write-Host "Target: $($SwarmMember.ToUpper())" -ForegroundColor Cyan
    Write-Host "Hardware: NVIDIA RTX 4080 Super (16GB VRAM)" -ForegroundColor Cyan
    Write-Host "Started: $($startTime.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor Cyan
    Write-Host ""
    
    # Validate prerequisites
    if (-not $SkipValidation) {
        Test-Prerequisites
    }
    
    # Start GPU monitoring
    $monitorJob = Start-GPUMonitor
    
    try {
        # Determine which swarms to train
        $swarmsToTrain = @()
        if ($SwarmMember -eq 'both') {
            $swarmsToTrain = @('auditor', 'writer')
        } else {
            $swarmsToTrain = @($SwarmMember)
        }
        
        $results = @{}
        
        foreach ($swarm in $swarmsToTrain) {
            $config = $CONFIGS[$swarm]
            
            # Step 1: Train LoRA adapter
            $trainSuccess = Start-LoRATraining -ConfigFile $config.ConfigFile -SwarmName $swarm
            
            if ($trainSuccess) {
                # Step 2: Merge adapter into base model
                if (-not $SkipMerge) {
                    $mergeSuccess = Merge-LoRAAdapter -ConfigFile $config.ConfigFile -SwarmName $swarm
                    
                    if ($mergeSuccess) {
                        # Step 3: Validate merged model
                        $mergedPath = Join-Path $MERGED_DIR $config.MergedName
                        $validateSuccess = Test-MergedModel -MergedPath $mergedPath
                        
                        $results[$swarm] = @{
                            Train = $trainSuccess
                            Merge = $mergeSuccess
                            Validate = $validateSuccess
                            MergedPath = $mergedPath
                        }
                    } else {
                        $results[$swarm] = @{
                            Train = $trainSuccess
                            Merge = $mergeSuccess
                            Validate = $false
                        }
                    }
                } else {
                    $results[$swarm] = @{
                        Train = $trainSuccess
                        Merge = "Skipped"
                        Validate = "Skipped"
                    }
                }
            } else {
                $results[$swarm] = @{
                    Train = $trainSuccess
                    Merge = $false
                    Validate = $false
                }
            }
            
            Write-Host ""
        }
        
        # Final summary
        $endTime = Get-Date
        $duration = $endTime - $startTime
        
        Write-Header "PIPELINE SUMMARY"
        Write-Host "Completed: $($endTime.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor Cyan
        Write-Host "Duration: $($duration.ToString('hh\:mm\:ss'))" -ForegroundColor Cyan
        Write-Host ""
        
        foreach ($swarm in $swarmsToTrain) {
            $result = $results[$swarm]
            
            Write-Host "$($swarm.ToUpper()):" -ForegroundColor Yellow
            Write-Host "  Training:   $(if ($result.Train) { '✅ Success' } else { '❌ Failed' })" -ForegroundColor $(if ($result.Train) { 'Green' } else { 'Red' })
            Write-Host "  Merging:    $(if ($result.Merge -eq $true) { '✅ Success' } elseif ($result.Merge -eq 'Skipped') { '⏭️  Skipped' } else { '❌ Failed' })" -ForegroundColor $(if ($result.Merge -eq $true) { 'Green' } elseif ($result.Merge -eq 'Skipped') { 'Yellow' } else { 'Red' })
            Write-Host "  Validation: $(if ($result.Validate -eq $true) { '✅ Success' } elseif ($result.Validate -eq 'Skipped') { '⏭️  Skipped' } else { '❌ Failed' })" -ForegroundColor $(if ($result.Validate -eq $true) { 'Green' } elseif ($result.Validate -eq 'Skipped') { 'Yellow' } else { 'Red' })
            
            if ($result.MergedPath) {
                Write-Host "  Output:     $($result.MergedPath)" -ForegroundColor White
            }
            Write-Host ""
        }
        
        # Next steps
        $allSuccess = ($results.Values | Where-Object { $_.Train -eq $true -and $_.Merge -eq $true -and $_.Validate -eq $true }).Count -eq $swarmsToTrain.Count
        
        if ($allSuccess) {
            Write-Section "NEXT STEPS (MLC COMPILATION)"
            Write-Host "✅ Merged models ready for WebGPU compilation" -ForegroundColor Green
            Write-Host ""
            Write-Host "Execute:" -ForegroundColor Cyan
            Write-Host "  1. Convert to MLC format: mlc_llm convert_weight" -ForegroundColor White
            Write-Host "  2. Quantize for browser: q4f16 or q4f32" -ForegroundColor White
            Write-Host "  3. Compile to WebGPU: mlc_llm compile" -ForegroundColor White
            Write-Host "  4. Deploy to WebLLM: Package adapters" -ForegroundColor White
            Write-Host ""
            Write-Info "See MLC_COMPILATION_GUIDE.md for detailed instructions"
        } else {
            Write-Warning "Pipeline completed with errors - review logs above"
        }
        
    } finally {
        # Stop GPU monitoring
        Stop-GPUMonitor -Job $monitorJob
    }
}

# ==============================================================================
# SCRIPT ENTRY POINT
# ==============================================================================

try {
    Invoke-TrainingPipeline -SwarmMember $SwarmMember
    
    Write-Host ""
    Write-Success "Pipeline execution complete"
    exit 0
    
} catch {
    Write-Host ""
    Write-Error "Pipeline failed: $_"
    Write-Host $_.ScriptStackTrace -ForegroundColor Red
    exit 1
}
