import React, { useEffect } from 'react';
import { ShieldAlert, CheckCircle, Crosshair, AlertTriangle, Shield, TrendingUp, Zap, Cpu, HardDrive } from 'lucide-react';
import { useHardwareCheck, HW_TIERS } from '../hooks/useHardwareCheck';

/**
 * WarRoom Component
 * 
 * DEFCON-style adversarial simulation results dashboard.
 * Shows VA rater simulation verdict, weaknesses, and fixes.
 * 
 * Design Philosophy:
 * - Military command center aesthetic
 * - Red = denied/critical issues
 * - Yellow/Amber = development needed
 * - Green = grant likely
 * 
 * @param {Object} simulationResult - Result from useWarGame.runSimulation()
 * @param {Function} onApplyFix - Callback when user clicks "Apply Fix" button
 */
const WarRoom = ({ simulationResult, onApplyFix }) => {
  // Hardware capability check - prevent crashes on low-end devices
  const { 
    capabilities, 
    isChecking, 
    canRunLocal, 
    tier, 
    message,
    runCheck 
  } = useHardwareCheck(true); // Check on mount
  
  // Show hardware warning if it's too weak for War Room AI features
  useEffect(() => {
    if (!canRunLocal && !isChecking && tier !== HW_TIERS.UNKNOWN) {
      console.warn('War Room: Low-end hardware detected, AI features may be limited');
    }
  }, [canRunLocal, isChecking, tier]);
  
  // Show loading while checking hardware
  if (isChecking) {
    return (
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-700 mt-8">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
          <p className="text-slate-400">Checking device capabilities...</p>
        </div>
      </div>
    );
  }
  
  // Show hardware warning if insufficient (but don't block usage)
  const showHardwareWarning = !canRunLocal && tier !== HW_TIERS.UNKNOWN;
  
  if (!simulationResult) {
    return (
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-700 mt-8">
        <p className="text-slate-400 text-center">
          No simulation has been run yet. Upload your claim evidence to begin stress testing.
        </p>
      </div>
    );
  }

  const isHardware Warning Banner (if low-end device) */}
      {showHardwareWarning && (
        <div className="mb-6 bg-amber-900/30 border-2 border-amber-500 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Cpu className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-amber-300 font-bold text-sm mb-1">Device Limitation Detected</h4>
              <p className="text-amber-200 text-sm mb-3">{message}</p>
              <div className="flex items-center gap-2 text-xs text-amber-200/80">
                <HardDrive className="w-4 h-4" />
                <span>Tier: {tier}</span>
                {capabilities?.deviceMemory && <span>• RAM: {capabilities.deviceMemory}GB</span>}
                <span>• WebGPU: {capabilities?.webgpu ? 'Supported' : 'Not Available'}</span>
              </div>
              <button
                onClick={runCheck}
                className="mt-3 px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-medium transition-colors"
              >
                Re-check Hardware
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Denial = simulationResult.verdict === 'DENIED';
  const isHighRisk = simulationResult.verdict === 'HIGH RISK';
  const isDevelopment = simulationResult.verdict === 'DEVELOPMENT NEEDED';
  const isGrant = simulationResult.verdict === 'GRANT';

  // Determine color theme
  let themeColors = {
    border: 'border-emerald-500',
    bg: 'bg-emerald-900/30',
    text: 'text-emerald-500',
    icon: 'text-emerald-400'
  };

  if (isDenial || isHighRisk) {
    themeColors = {
      border: 'border-red-500',
      bg: 'bg-red-900/30',
      text: 'text-red-500',
      icon: 'text-red-400'
    };
  } else if (isDevelopment) {
    themeColors = {
      border: 'border-amber-500',
      bg: 'bg-amber-900/30',
      text: 'text-amber-500',
      icon: 'text-amber-400'
    };
  }

  return (
    <div className="bg-slate-900 p-6 rounded-xl border border-slate-700 mt-8">
      
      {/* DEFCON Header */}
      <div className={`flex items-center gap-4 p-4 rounded-lg mb-6 border ${themeColors.border} ${themeColors.bg}`}>
        {isDenial || isHighRisk ? (
          <ShieldAlert className={`w-10 h-10 ${themeColors.icon}`} />
        ) : (
          <CheckCircle className={`w-10 h-10 ${themeColors.icon}`} />
        )}
        <div className="flex-1">
          <h2 className={`text-2xl font-black tracking-widest ${themeColors.text}`}>
            {simulationResult.verdict}
          </h2>
          <p className="text-slate-400 text-sm">ADVERSARIAL SIMULATION RESULT</p>
        </div>
        <div className="text-right">
          <div className={`text-3xl font-bold font-mono ${themeColors.text}`}>
            {simulationResult.confidence}%
          </div>
          <div className="text-xs text-slate-500 uppercase">Confidence</div>
        </div>
      </div>

      {/* Score Meter */}
      <div className="mb-6 bg-slate-800 p-4 rounded-lg border border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-400 text-sm font-bold">CLAIM STRENGTH SCORE</span>
          <span className={`text-lg font-mono font-bold ${themeColors.text}`}>
            {simulationResult.score}/100
          </span>
        </div>
        <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ${
              simulationResult.score >= 70 ? 'bg-emerald-500' : 
              simulationResult.score >= 40 ? 'bg-amber-500' : 
              'bg-red-500'
            }`}
            style={{ width: `${simulationResult.score}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>0 (High Risk)</span>
          <span>40 (Needs Work)</span>
          <span>70 (Strong)</span>
          <span>100 (Approved)</span>
        </div>
      </div>

      {/* Critical Issues Section */}
      {(isDenial || isHighRisk) && simulationResult.lethalWeakness && (
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          
          {/* Lethal Weakness Panel */}
          <div className="bg-black/30 p-4 rounded-lg border border-red-500/30">
            <h3 className="text-red-400 font-bold flex items-center gap-2 mb-3">
              <Crosshair className="w-4 h-4" /> LETHAL WEAKNESS IDENTIFIED
            </h3>
            <p className="text-white font-mono text-sm mb-4">
              {simulationResult.lethalWeakness}
            </p>
            
            {simulationResult.interrogationQuestions && simulationResult.interrogationQuestions.length > 0 && (
              <>
                <h4 className="text-slate-500 font-bold mt-4 text-xs uppercase mb-2">
                  VA Rater Interrogation Points:
                </h4>
                <ul className="space-y-2">
                  {simulationResult.interrogationQuestions.map((q, i) => (
                    <li key={i} className="text-slate-300 text-xs italic border-l-2 border-red-500/30 pl-3">
                      "{q}"
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* Recovery Plan Panel */}
          <div className="bg-slate-800 p-4 rounded-lg border border-emerald-500/30">
            <h3 className="text-emerald-400 font-bold flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4" /> RECOVERY PLAN
            </h3>
            
            {simulationResult.fixes && simulationResult.fixes.length > 0 ? (
              <div className="space-y-3">
                {simulationResult.fixes.map((fix, i) => (
                  <div key={i} className="bg-slate-900/50 p-3 rounded border border-slate-700">
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-bold text-white text-sm">{fix.title}</p>
                      {fix.priority && (
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          fix.priority === 'Critical' ? 'bg-red-500/20 text-red-400' :
                          fix.priority === 'High' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {fix.priority}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-400 text-xs mb-2">{fix.instruction}</p>
                    {onApplyFix && (
                      <button 
                        onClick={() => onApplyFix(fix)}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded transition-colors"
                      >
                        APPLY FIX
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-sm">No automated fixes available. Manual review required.</p>
            )}
          </div>
        </div>
      )}

      {/* Weaknesses List */}
      {simulationResult.weaknesses && simulationResult.weaknesses.length > 0 && (
        <div className="mb-6">
          <h3 className="text-amber-400 font-bold flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4" /> IDENTIFIED WEAKNESSES
          </h3>
          <div className="space-y-2">
            {simulationResult.weaknesses.map((weakness, i) => (
              <div 
                key={i} 
                className={`p-3 rounded-lg border ${
                  weakness.severity === 'Critical' ? 'bg-red-900/20 border-red-500/30' :
                  weakness.severity === 'High' ? 'bg-amber-900/20 border-amber-500/30' :
                  'bg-blue-900/20 border-blue-500/30'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        weakness.severity === 'Critical' ? 'bg-red-500/20 text-red-400' :
                        weakness.severity === 'High' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {weakness.severity}
                      </span>
                      <span className="text-white font-bold text-sm">{weakness.title}</span>
                    </div>
                    <p className="text-slate-400 text-xs">{weakness.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strengths List (Green Zone) */}
      {simulationResult.strengths && simulationResult.strengths.length > 0 && (
        <div className="mb-6">
          <h3 className="text-emerald-400 font-bold flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4" /> CLAIM STRENGTHS
          </h3>
          <div className="grid md:grid-cols-2 gap-3">
            {simulationResult.strengths.map((strength, i) => (
              <div 
                key={i} 
                className="p-3 rounded-lg bg-emerald-900/20 border border-emerald-500/30"
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="text-emerald-400 font-bold text-sm">{strength.title}</span>
                  {strength.bonus && (
                    <span className="text-emerald-500 font-mono text-xs font-bold">
                      {strength.bonus}
                    </span>
                  )}
                </div>
                <p className="text-slate-400 text-xs">{strength.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scenarios Triggered (Debug Info) */}
      {simulationResult.scenariosTriggered && simulationResult.scenariosTriggered.length > 0 && (
        <div className="mt-6 pt-4 border-t border-slate-700">
          <details className="text-slate-500 text-xs">
            <summary className="cursor-pointer hover:text-slate-400 font-mono">
              Technical Details (Scenarios Triggered: {simulationResult.scenariosTriggered.length})
            </summary>
            <div className="mt-2 space-y-1">
              {simulationResult.scenariosTriggered.map((scenario, i) => (
                <div key={i} className="font-mono text-slate-600">
                  • {scenario}
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {/* Action Footer */}
      {isGrant && (
        <div className="mt-6 p-4 rounded-lg bg-emerald-900/20 border border-emerald-500/30">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-emerald-400" />
            <div className="flex-1">
              <p className="text-emerald-400 font-bold">Claim Ready for Submission</p>
              <p className="text-slate-400 text-sm">
                Your claim package has passed adversarial testing. Review final documents and submit when ready.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WarRoom;
