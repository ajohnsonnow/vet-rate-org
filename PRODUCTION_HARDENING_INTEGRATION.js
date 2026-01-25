/**
 * PRODUCTION HARDENING - INTEGRATION & TESTING GUIDE
 * Step-by-step instructions for wiring up the three safety features
 */

// ============================================================================
// 1. MANUAL DATA ENTRY - Add to DischargeAnalyzer
// ============================================================================

import ManualDataEntry from './components/ManualDataEntry';

function DischargeAnalyzer() {
  const [mode, setMode] = useState('UPLOAD'); // 'UPLOAD' | 'MANUAL' | 'RESULTS'
  const [analyzedData, setAnalyzedData] = useState(null);

  const handleOCRComplete = (ocrData) => {
    if (ocrData.confidence < 0.5) {
      // OCR quality is poor, offer manual entry
      alert('⚠️ OCR quality is low. Consider manual entry for accuracy.');
    }
    setAnalyzedData(ocrData);
    setMode('RESULTS');
  };

  const handleManualSubmit = (manualData) => {
    // Manual data has same structure as OCR data
    setAnalyzedData(manualData);
    setMode('RESULTS');
  };

  if (mode === 'MANUAL') {
    return (
      <ManualDataEntry
        onSubmit={handleManualSubmit}
        onCancel={() => setMode('UPLOAD')}
      />
    );
  }

  if (mode === 'RESULTS') {
    return (
      <div>
        <h2>DD-214 Analysis Complete</h2>
        {analyzedData.source === 'MANUAL_ENTRY' && (
          <div className="bg-blue-900/30 p-3 rounded mb-4">
            ℹ️ Data entered manually (OCR bypassed)
          </div>
        )}
        {/* Display results */}
      </div>
    );
  }

  // Upload mode
  return (
    <div>
      <DragDropUpload onComplete={handleOCRComplete} />
      
      <div className="mt-4 text-center">
        <button
          onClick={() => setMode('MANUAL')}
          className="text-blue-400 hover:text-blue-300 underline text-sm"
        >
          OCR Failed? Enter Data Manually
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// 2. HARDWARE CHECK - Add to Diamond Swarm Components
// ============================================================================

import { useHardwareCheck, HW_TIERS } from '../hooks/useHardwareCheck';

function WarRoom({ simulationResult }) {
  const { 
    capabilities, 
    isChecking, 
    canRunLocal, 
    tier, 
    message,
    runCheck 
  } = useHardwareCheck(true); // Check on mount

  // Show loading while checking
  if (isChecking) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
        <p className="text-slate-400">Checking device capabilities...</p>
      </div>
    );
  }

  // Show hardware warning if cannot run local AI
  if (!canRunLocal && tier !== HW_TIERS.UNKNOWN) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-amber-900/30 border-2 border-amber-500 rounded-lg p-6">
          <h3 className="text-amber-300 font-bold text-lg mb-2">
            ⚠️ Device Limitation Detected
          </h3>
          <p className="text-amber-200 mb-4">{message}</p>
          
          <div className="space-y-2 text-sm text-amber-200/80">
            <p><strong>Detected:</strong> {tier} tier hardware</p>
            {capabilities?.deviceMemory && (
              <p><strong>RAM:</strong> {capabilities.deviceMemory}GB</p>
            )}
            <p><strong>WebGPU:</strong> {capabilities?.webgpu ? 'Supported' : 'Not Available'}</p>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              onClick={() => window.location.href = '/settings#ai'}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold"
            >
              Use Gemini Cloud AI
            </button>
            <button
              onClick={runCheck}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded"
            >
              Re-check Hardware
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Hardware is sufficient, render War Room normally
  return (
    <div>
      {/* Normal War Room UI */}
      <WarRoomDashboard result={simulationResult} />
    </div>
  );
}

// ============================================================================
// 3. ACCESSIBILITY - Update PathfinderDashboard
// ============================================================================

import { 
  getStatusARIA, 
  getStatusSRText, 
  getColorClasses,
  getExpandableARIA,
  getProgressARIA,
  scoreToTier
} from '../utils/accessibilityHelpers';

function PathfinderDashboard({ rankedClaims }) {
  const [expandedClaims, setExpandedClaims] = useState(new Set());

  const toggleExpand = (claimId) => {
    setExpandedClaims(prev => {
      const next = new Set(prev);
      if (next.has(claimId)) {
        next.delete(claimId);
      } else {
        next.add(claimId);
      }
      return next;
    });
  };

  // Group claims by phase
  const phases = {
    phase1: rankedClaims.filter(c => c.score >= 90),
    phase2: rankedClaims.filter(c => c.score >= 70 && c.score < 90),
    phase3: rankedClaims.filter(c => c.score >= 40 && c.score < 70),
    phase4: rankedClaims.filter(c => c.score < 40)
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-white mb-6">Pathfinder: Claim Strategy</h1>

      {/* Phase 1: Quick Wins */}
      <PhaseSection
        title="Phase 1: Quick Wins"
        subtitle="90%+ Success Rate"
        tier="QUICK_WIN"
        claims={phases.phase1}
        expandedClaims={expandedClaims}
        onToggleExpand={toggleExpand}
      />

      {/* Phase 2: Strategic Assault */}
      <PhaseSection
        title="Phase 2: Strategic Assault"
        subtitle="70-89% Success Rate"
        tier="STRATEGIC"
        claims={phases.phase2}
        expandedClaims={expandedClaims}
        onToggleExpand={toggleExpand}
      />

      {/* Phase 3: Long Game */}
      <PhaseSection
        title="Phase 3: Long Game"
        subtitle="40-69% Success Rate"
        tier="LONG_GAME"
        claims={phases.phase3}
        expandedClaims={expandedClaims}
        onToggleExpand={toggleExpand}
      />

      {/* Phase 4: Risk Watch */}
      <PhaseSection
        title="Phase 4: Risk Watch"
        subtitle="<40% Success Rate"
        tier="RISK_WATCH"
        claims={phases.phase4}
        expandedClaims={expandedClaims}
        onToggleExpand={toggleExpand}
      />
    </div>
  );
}

function PhaseSection({ title, subtitle, tier, claims, expandedClaims, onToggleExpand }) {
  if (claims.length === 0) return null;

  return (
    <section className="mb-8">
      <div 
        className={`${getColorClasses(tier, 'full')} rounded-lg p-4 mb-4`}
        {...getStatusARIA(tier)}
      >
        <h2 className="text-xl font-bold flex items-center gap-2">
          <span className="sr-only">{getStatusSRText(tier)}</span>
          {title}
        </h2>
        <p className="text-sm opacity-80">{subtitle}</p>
      </div>

      <div className="space-y-3">
        {claims.map(claim => (
          <ClaimCard
            key={claim.id}
            claim={claim}
            isExpanded={expandedClaims.has(claim.id)}
            onToggleExpand={() => onToggleExpand(claim.id)}
          />
        ))}
      </div>
    </section>
  );
}

function ClaimCard({ claim, isExpanded, onToggleExpand }) {
  const tier = scoreToTier(claim.score);

  return (
    <div 
      className={`${getColorClasses(tier, 'border')} bg-slate-800 rounded-lg p-4`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white">{claim.name}</h3>
          
          {/* Progress bar with ARIA */}
          <div 
            className="mt-2"
            {...getProgressARIA(claim.score, `${claim.name} viability score`)}
          >
            <div className="bg-slate-700 rounded-full h-2 overflow-hidden">
              <div 
                className={`h-full ${getColorClasses(tier, 'bg')}`}
                style={{ width: `${claim.score}%` }}
              />
            </div>
            <p className="text-sm text-slate-400 mt-1">
              {claim.score}% Viability Score
              <span className="sr-only">
                . {getStatusSRText(tier)}.
              </span>
            </p>
          </div>
        </div>

        {/* Expand/Collapse Button */}
        <button
          {...getExpandableARIA(isExpanded, `claim-details-${claim.id}`, claim.name)}
          onClick={onToggleExpand}
          className="ml-4 p-2 hover:bg-slate-700 rounded transition-colors"
        >
          <span className="sr-only">
            {isExpanded ? 'Collapse' : 'Expand'} details for {claim.name}
          </span>
          <ChevronDown 
            className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div 
          id={`claim-details-${claim.id}`}
          className="mt-4 pt-4 border-t border-slate-700"
          role="region"
          aria-label={`Details for ${claim.name}`}
        >
          <p className="text-sm text-slate-300 mb-3">{claim.strategyNote}</p>
          
          {claim.requirements && (
            <div>
              <h4 className="text-sm font-bold text-slate-400 mb-2">Evidence Checklist:</h4>
              <ul className="space-y-1" role="list">
                {claim.requirements.map((req, idx) => (
                  <li 
                    key={idx}
                    className="flex items-center gap-2 text-sm"
                    role="listitem"
                  >
                    <span 
                      className={req.met ? 'text-green-400' : 'text-slate-500'}
                      aria-hidden="true"
                    >
                      {req.met ? '✓' : '○'}
                    </span>
                    <span className={req.met ? 'text-green-300' : 'text-slate-400'}>
                      {req.name}
                      <span className="sr-only">
                        {req.met ? ' (Complete)' : ' (Incomplete)'}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TESTING SNIPPETS
// ============================================================================

// Test 1: Manual Entry
function testManualEntry() {
  // Go to DischargeAnalyzer
  // Click "Enter Manually"
  // Input SPN code: "JFX"
  // Expected: Should show "Personality Disorder" description
  // Input medal: "Afghanistan Campaign Medal"
  // Expected: Should show "PACT Act Eligible" badge
  // Submit
  // Expected: Should generate tags: ['PACT_POST_911']
}

// Test 2: Hardware Check
async function testHardwareCheck() {
  const { checkHardwareCapabilities } = await import('./hooks/useHardwareCheck');
  const report = await checkHardwareCapabilities();
  
  console.log('=== Hardware Report ===');
  console.log('Tier:', report.tier);
  console.log('Can Run Local:', report.recommendation.canRunLocal);
  console.log('Message:', report.recommendation.message);
  console.log('WebGPU:', report.webgpu);
  console.log('Device Memory:', report.deviceMemory, 'GB');
  console.log('Is Mobile:', report.isMobile);
  
  // Test on different devices:
  // Desktop with GPU: Expect HIGH, canRunLocal=true
  // Chromebook: Expect LOW, canRunLocal=false
  // Old iPad: Expect UNKNOWN, canRunLocal=false
}

// Test 3: Accessibility Audit
function testAccessibility() {
  const { auditComponent } = await import('./utils/accessibilityHelpers');
  
  // After rendering PathfinderDashboard:
  const dashboard = document.querySelector('[data-testid="pathfinder-dashboard"]');
  auditComponent('PathfinderDashboard', dashboard);
  
  // Check console for warnings
  // Then run Lighthouse accessibility audit
}

// Test 4: Screen Reader Test (Manual)
// 1. Enable VoiceOver (Mac: Cmd+F5) or NVDA (Windows)
// 2. Navigate through Pathfinder Dashboard with arrow keys
// 3. Verify:
//    - "Phase 1: Quick Wins. 90% or higher probability of approval"
//    - "PTSD. 85% viability score. Strategic claim."
//    - "Expand details for PTSD" (on collapse button)
//    - "Collapse details for PTSD" (after expanding)

// Test 5: Colorblind Test (Manual)
// 1. Open Chrome DevTools → Rendering → Emulate vision deficiencies
// 2. Select "Protanopia" (red-blind)
// 3. Verify phases are distinguishable by:
//    - Border patterns (solid vs dashed vs dotted)
//    - Icons (🎯 vs ⚔️ vs ♟️ vs 👁️)
//    - Text labels
