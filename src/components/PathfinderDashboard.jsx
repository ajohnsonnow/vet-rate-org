import React, { useMemo, useState } from 'react';
import { 
  ShieldCheck, 
  Target, 
  Clock, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp,
  FileText,
  Activity,
  ArrowRight,
  Download
} from 'lucide-react';
import { 
  getStatusARIA, 
  getColorClasses, 
  getExpandableARIA,
  getProgressARIA,
  handleKeyboardClick,
  scoreToTier
} from '../utils/accessibilityHelpers';
import { generateAndDownloadVSOHandoff } from '../utils/providerBriefGenerator';
import { getVeteranProfile } from '../utils/veteranProfile';

/**
 * ClaimCard Component
 * 
 * Individual claim card with expandable details showing:
 * - Win probability meter
 * - Tactical analysis
 * - Evidence requirements checklist
 * - Action buttons
 * 
 * @param {Object} claim - Claim data object
 * @param {string} phaseColor - Color theme (green/blue/amber/red)
 */
const ClaimCard = ({ claim, phaseColor }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const tier = scoreToTier(claim.score);

  // Dynamic color classes based on phase (legacy)
  const colors = {
    green: { border: 'border-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-400', bar: 'bg-emerald-500' },
    blue: { border: 'border-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-400', bar: 'bg-blue-500' },
    amber: { border: 'border-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-400', bar: 'bg-amber-500' },
    red: { border: 'border-red-500', bg: 'bg-red-500/10', text: 'text-red-400', bar: 'bg-red-500' }
  };
  
  const theme = colors[phaseColor] || colors.blue;

  return (
    <div className={`mb-4 rounded-lg border-l-4 ${theme.border} bg-slate-800 shadow-lg overflow-hidden`}>
      {/* Card Header */}
      <button 
        className="w-full p-4 cursor-pointer hover:bg-slate-700/50 transition-colors flex justify-between items-center text-left"
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={handleKeyboardClick(() => setIsExpanded(!isExpanded))}
        {...getExpandableARIA(isExpanded, `claim-details-${claim.id}`, claim.name)}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-bold text-slate-100">{claim.name}</h3>
            {claim.isPresumptive && (
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                PRESUMPTIVE
              </span>
            )}
            {claim.category === 'Mental Health' && claim.tags?.includes('COMBAT') && (
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                COMBAT VERIFIED
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <span>Win Probability:</span>
            <div 
              className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden"
              {...getProgressARIA(claim.score, `${claim.name} viability score`)}
            >
              <div 
                className={`h-full ${theme.bar}`} 
                style={{ width: `${claim.score}%` }}
              ></div>
            </div>
            <span className={`font-mono font-bold ${theme.text}`}>
              {claim.score}%
              <span className="sr-only">. {tier} tier claim.</span>
            </span>
          </div>
        </div>
        
        {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" aria-hidden="true" /> : <ChevronDown className="w-5 h-5 text-slate-400" aria-hidden="true" />}
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div 
          id={`claim-details-${claim.id}`}
          role="region"
          aria-label={`Details for ${claim.name}`}
          className="px-4 pb-4 bg-slate-800/50 border-t border-slate-700"
        >
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Strategy Box */}
            <div className="bg-slate-900/50 p-3 rounded border border-slate-700">
              <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                <Target className="w-3 h-3" /> Tactical Analysis
              </h4>
              <p className="text-sm text-slate-300">{claim.strategyNote}</p>
            </div>

            {/* Evidence Requirements */}
            <div className="bg-slate-900/50 p-3 rounded border border-slate-700">
              <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                <FileText className="w-3 h-3" aria-hidden="true" /> Required Intel
              </h4>
              <ul className="text-sm text-slate-300 space-y-1" role="list">
                {claim.requirements.map((req, i) => (
                  <li key={i} className="flex items-start gap-2" role="listitem">
                    <span className={req.met ? "text-emerald-500" : "text-slate-500"} aria-hidden="true">
                      {req.met ? "✓" : "○"}
                    </span>
                    <span className={req.met ? "line-through opacity-50" : ""}>
                      {req.text}
                      <span className="sr-only">{req.met ? ' (Complete)' : ' (Incomplete)'}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Action Bar */}
          <div className="mt-4 flex justify-end gap-3">
             <button className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors">
                View DBQ
             </button>
             <button className={`px-4 py-2 text-sm font-bold text-slate-900 rounded shadow hover:opacity-90 transition-opacity flex items-center gap-2 ${theme.bar}`}>
                Execute Phase <ArrowRight className="w-4 h-4" />
             </button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * PathfinderDashboard Component
 * 
 * Mission-style claim prioritization dashboard that organizes potential VA claims
 * into tactical phases based on probability of success.
 * 
 * Architecture:
 * - Phase 1 (90%+): Quick wins - presumptive or proven stressors
 * - Phase 2 (70-89%): Strategic assault - solid evidence, needs nexus
 * - Phase 3 (40-69%): Long game - requires development
 * - Phase 4 (<40%): Risk watch - low probability, high risk
 * 
 * Design Philosophy:
 * - OPORD (Operation Order) aesthetic
 * - Visual hierarchy with timeline connector
 * - Probability meters for instant assessment
 * - Action-oriented (Execute Phase buttons)
 * 
 * @param {Array} rankedClaims - Array of claim objects with scores
 */
const PathfinderDashboard = ({ rankedClaims }) => {
  
  // Categorize Claims into Phases
  const phases = useMemo(() => {
    return {
      phase1: rankedClaims.filter(c => c.score >= 90),
      phase2: rankedClaims.filter(c => c.score >= 70 && c.score < 90),
      phase3: rankedClaims.filter(c => c.score >= 40 && c.score < 70),
      phase4: rankedClaims.filter(c => c.score < 40),
    };
  }, [rankedClaims]);

  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-6 bg-slate-900 min-h-screen text-slate-200">
      
      {/* Mission Header */}
      <div className="mb-8 border-b border-slate-700 pb-6">
        <h1 className="text-3xl font-black tracking-tight text-white mb-2 flex items-center gap-3">
          <Target className="w-8 h-8 text-emerald-500" />
          STRATEGIC BATTLE PLAN
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl">
          Based on your <span className="text-emerald-400 font-mono">DD-214</span> and <span className="text-emerald-400 font-mono">Intake Data</span>, 
          we have prioritized your potential claims by probability of success. 
          Execute in phases for maximum rating efficiency.
        </p>
      </div>

      {/* PHASE 1: Quick Wins */}
      {phases.phase1.length > 0 && (
        <section className="mb-10 relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-emerald-500/20 -z-10"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 z-10">
              <ShieldCheck className="w-6 h-6 text-slate-900" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-emerald-400">PHASE 1: QUICK WINS</h2>
              <p className="text-sm text-slate-500">High probability. Presumptive or proven stressors. Execute immediately.</p>
            </div>
          </div>
          <div className="ml-14">
            {phases.phase1.map(claim => (
              <ClaimCard key={claim.id} claim={claim} phaseColor="green" />
            ))}
          </div>
        </section>
      )}

      {/* PHASE 2: Strategic Assault */}
      {phases.phase2.length > 0 && (
        <section className="mb-10 relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-blue-500/20 -z-10"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/20 z-10">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-blue-400">PHASE 2: STRATEGIC ASSAULT</h2>
              <p className="text-sm text-slate-500">Solid evidence found. Requires current diagnosis or nexus statement.</p>
            </div>
          </div>
          <div className="ml-14">
            {phases.phase2.map(claim => (
              <ClaimCard key={claim.id} claim={claim} phaseColor="blue" />
            ))}
          </div>
        </section>
      )}

      {/* PHASE 3: The Long Game */}
      {phases.phase3.length > 0 && (
        <section className="mb-10 relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-amber-500/20 -z-10"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/20 z-10">
              <Clock className="w-6 h-6 text-slate-900" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-amber-400">PHASE 3: THE LONG GAME</h2>
              <p className="text-sm text-slate-500">Requires development. Gather buddy statements and private medical opinions.</p>
            </div>
          </div>
          <div className="ml-14">
            {phases.phase3.map(claim => (
              <ClaimCard key={claim.id} claim={claim} phaseColor="amber" />
            ))}
          </div>
        </section>
      )}

      {/* PHASE 4: Risk Watch */}
      {phases.phase4.length > 0 && (
        <section className="mb-10 relative">
           <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-red-500/20 -z-10"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/20 z-10">
              <AlertTriangle className="w-6 h-6 text-slate-900" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-red-400">PHASE 4: RISK WATCH</h2>
              <p className="text-sm text-slate-500">Low probability or high risk. Do not file without new evidence.</p>
            </div>
          </div>
          <div className="ml-14">
            {phases.phase4.map(claim => (
              <ClaimCard key={claim.id} claim={claim} phaseColor="red" />
            ))}
          </div>
        </section>
      )}

      {/* VSO Handoff Export - "Professional Eject Button" */}
      <div className="mt-8 p-6 bg-blue-900/30 border-2 border-blue-500 rounded-lg">
        <div className="flex items-start gap-4">
          <FileText className="w-8 h-8 text-blue-400 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="text-lg font-bold text-blue-300 mb-2">Need Professional Help?</h3>
            <p className="text-sm text-slate-300 mb-4">
              Export a VSO-ready briefing packet with your claim strategy, evidence checklist, and viability scores. 
              Perfect for handing off to a Veteran Service Officer or attorney.
            </p>
            <button
              onClick={() => {
                try {
                  const profile = getVeteranProfile();
                  generateAndDownloadVSOHandoff(profile, rankedClaims);
                } catch (error) {
                  console.error('VSO export error:', error);
                  alert('Export failed. Please ensure you have claims data to export.');
                }
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold flex items-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export to VSO
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PathfinderDashboard;
