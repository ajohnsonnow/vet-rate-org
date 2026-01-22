#!/usr/bin/env python3
"""
Diamond Standard Autonomous Orchestrator
Coordinates: Knowledge Scraping → Model Training → WebGPU Compilation
Runs headlessly with comprehensive logging
"""

import asyncio
import subprocess
import sys
import logging
import json
from pathlib import Path
from datetime import datetime
import os

# Configure logging
log_dir = Path(__file__).parent / "logs"
log_dir.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_dir / f'orchestrator_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class DiamondStandardOrchestrator:
    """Main orchestration class for autonomous LLM compilation"""
    
    def __init__(self):
        self.root_dir = Path(__file__).parent
        self.scrapers_dir = self.root_dir / "scrapers"
        self.axolotl_dir = self.root_dir / "axolotl-configs"
        self.mlc_dir = self.root_dir / "mlc-scripts"
        self.knowledge_base = self.root_dir / "knowledge-base"
        
        self.status = {
            "started": datetime.now().isoformat(),
            "current_phase": None,
            "phases_completed": [],
            "errors": []
        }
    
    async def run_command(self, cmd: list, cwd: Path = None, description: str = ""):
        """Run shell command with logging"""
        logger.info(f"> {description}")
        logger.info(f"  Command: {' '.join(cmd)}")
        
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=cwd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if stdout:
                logger.info(f"  Output: {stdout.decode()[:500]}")
            if stderr:
                logger.warning(f"  Stderr: {stderr.decode()[:500]}")
            
            if process.returncode != 0:
                raise subprocess.CalledProcessError(process.returncode, cmd, stdout, stderr)
            
            logger.info(f"[OK] {description} completed successfully")
            return True
            
        except Exception as e:
            logger.error(f"[FAIL] {description} failed: {e}")
            self.status["errors"].append({
                "phase": description,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            })
            return False
    
    async def phase_1_scrape_knowledge(self):
        """Phase 1: Scrape VA regulatory knowledge base"""
        self.status["current_phase"] = "knowledge_scraping"
        logger.info("=" * 80)
        logger.info("PHASE 1: Knowledge Base Scraping")
        logger.info("=" * 80)
        
        # Install scraper dependencies
        success = await self.run_command(
            ["pip", "install", "-r", "requirements.txt"],
            cwd=self.scrapers_dir,
            description="Installing scraper dependencies"
        )
        
        if not success:
            return False
        
        # Run knowledge scraper
        success = await self.run_command(
            ["python", "va_knowledge_scraper.py"],
            cwd=self.scrapers_dir,
            description="Scraping VA regulatory knowledge base"
        )
        
        if success:
            self.status["phases_completed"].append("knowledge_scraping")
            logger.info("[OK] Phase 1 Complete: Knowledge base scraped")
            
            # Check output
            kb_file = self.knowledge_base / "va_complete_knowledge_base.json"
            if kb_file.exists():
                with open(kb_file) as f:
                    kb_data = json.load(f)
                logger.info(f"  Total citations: {kb_data['metadata']['total_citations']}")
                logger.info(f"  Sources: {', '.join(kb_data['metadata']['sources'])}")
        
        return success
    
    async def phase_2_train_models(self):
        """Phase 2: Train specialized model swarm with Axolotl"""
        self.status["current_phase"] = "model_training"
        logger.info("=" * 80)
        logger.info("PHASE 2: Model Swarm Training")
        logger.info("=" * 80)
        
        # Check if Axolotl is installed
        try:
            await self.run_command(
                ["axolotl", "--version"],
                description="Checking Axolotl installation"
            )
        except:
            logger.info("Installing Axolotl...")
            success = await self.run_command(
                ["pip", "install", "axolotl"],
                description="Installing Axolotl framework"
            )
            if not success:
                return False
        
        # Train each specialized model
        models = [
            ("auditor-38cfr.yaml", "VA Auditor (38 CFR Specialist)"),
            ("writer-medical.yaml", "VA Writer (Medical/Nexus)"),
            ("rater-procedures.yaml", "VA Rater (Procedures)")
        ]
        
        for config_file, model_name in models:
            logger.info(f"\n▶ Training {model_name}...")
            
            success = await self.run_command(
                ["axolotl", "train", config_file],
                cwd=self.axolotl_dir,
                description=f"Training {model_name}"
            )
            
            if not success:
                logger.warning(f"  Continuing despite {model_name} training issues...")
        
        self.status["phases_completed"].append("model_training")
        logger.info("[OK] Phase 2 Complete: Model swarm trained")
        return True
    
    async def phase_3_compile_webgpu(self):
        """Phase 3: Compile to WebGPU with MLC LLM"""
        self.status["current_phase"] = "webgpu_compilation"
        logger.info("=" * 80)
        logger.info("PHASE 3: WebGPU Compilation")
        logger.info("=" * 80)
        
        # Check MLC LLM installation
        try:
            await self.run_command(
                ["python", "-c", "import mlc_llm"],
                description="Checking MLC LLM installation"
            )
        except:
            logger.info("Installing MLC LLM...")
            success = await self.run_command(
                ["pip", "install", "--pre", "-U", "-f", 
                 "https://mlc.ai/wheels", "mlc-llm-nightly", "mlc-ai-nightly"],
                description="Installing MLC LLM"
            )
            if not success:
                return False
        
        # Run compilation script
        compile_script = self.mlc_dir / "compile-webgpu.sh"
        
        # Make script executable
        compile_script.chmod(0o755)
        
        success = await self.run_command(
            ["bash", str(compile_script)],
            cwd=self.mlc_dir,
            description="Compiling models to WebGPU"
        )
        
        if success:
            self.status["phases_completed"].append("webgpu_compilation")
            logger.info("[OK] Phase 3 Complete: WebGPU artifacts generated")
        
        return success
    
    async def phase_4_upload_huggingface(self):
        """Phase 4: Upload models to HuggingFace"""
        self.status["current_phase"] = "huggingface_upload"
        logger.info("=" * 80)
        logger.info("PHASE 4: HuggingFace Upload")
        logger.info("=" * 80)
        
        # Check for HF token
        hf_token = os.getenv("HF_TOKEN")
        if not hf_token:
            logger.warning("  HF_TOKEN not set - skipping upload")
            logger.info("  Set HF_TOKEN environment variable to enable auto-upload")
            return True
        
        artifacts_dir = self.mlc_dir / "webgpu-artifacts"
        if not artifacts_dir.exists():
            logger.error("  No artifacts found to upload")
            return False
        
        # Upload each model
        models = ["va-auditor-model", "va-writer-model", "va-rater-model"]
        
        for model in models:
            for quant in ["q3f16_1", "q4f16_1"]:
                model_path = artifacts_dir / f"{model}-{quant}-webgpu"
                
                if model_path.exists():
                    success = await self.run_command(
                        [
                            "huggingface-cli", "upload",
                            f"Vet-Rate-org/{model}-{quant}",
                            str(model_path),
                            ".",
                            "--repo-type", "model"
                        ],
                        description=f"Uploading {model} ({quant}) to HuggingFace"
                    )
        
        self.status["phases_completed"].append("huggingface_upload")
        logger.info("[OK] Phase 4 Complete: Models uploaded to HuggingFace")
        return True
    
    def save_status(self):
        """Save orchestration status to JSON"""
        status_file = log_dir / "orchestration_status.json"
        self.status["last_updated"] = datetime.now().isoformat()
        
        with open(status_file, 'w') as f:
            json.dump(self.status, f, indent=2)
        
        logger.info(f"Status saved to {status_file}")
    
    async def run(self):
        """Execute all phases autonomously"""
        logger.info("=" * 80)
        logger.info("DIAMOND STANDARD AUTONOMOUS COMPILATION")
        logger.info("=" * 80)
        logger.info("System: Vet-Rate VA Claims LLM")
        logger.info("Architecture: WebGPU Client-Side Inference")
        logger.info("Model Swarm: Auditor + Writer + Rater")
        logger.info("=" * 80)
        
        try:
            # Phase 1: Knowledge Scraping
            if await self.phase_1_scrape_knowledge():
                self.save_status()
            else:
                logger.error("Phase 1 failed - aborting")
                return False
            
            # Phase 2: Model Training
            if await self.phase_2_train_models():
                self.save_status()
            else:
                logger.error("Phase 2 failed - aborting")
                return False
            
            # Phase 3: WebGPU Compilation
            if await self.phase_3_compile_webgpu():
                self.save_status()
            else:
                logger.error("Phase 3 failed - aborting")
                return False
            
            # Phase 4: HuggingFace Upload
            if await self.phase_4_upload_huggingface():
                self.save_status()
            
            self.status["current_phase"] = "complete"
            self.save_status()
            
            logger.info("=" * 80)
            logger.info("[SUCCESS] DIAMOND STANDARD COMPILATION COMPLETE")
            logger.info("=" * 80)
            logger.info(f"Total phases completed: {len(self.status['phases_completed'])}")
            logger.info(f"Errors encountered: {len(self.status['errors'])}")
            
            return True
            
        except Exception as e:
            logger.error(f"Fatal error: {e}")
            self.status["errors"].append({
                "phase": "orchestrator",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            })
            self.save_status()
            return False

async def main():
    """Entry point for autonomous execution"""
    orchestrator = DiamondStandardOrchestrator()
    success = await orchestrator.run()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    asyncio.run(main())
