/**
 * SupplyLocker.org - Claim Navigator
 * "Mission Control" - Interactive VA Claims Workflow Navigator
 * 
 * This module provides state-aware guidance through the entire VA claims
 * lifecycle. Handles multiple claims, tracks deadlines, and provides
 * actionable next steps.
 * 
 * Built by a fellow veteran. "Know exactly where you stand."
 * 
 * Features:
 * - Multi-claim dashboard
 * - Decision-tree triage wizard
 * - Evidence checklist tracking
 * - Deadline warnings (critical for 1-year appeal window)
 * - Phase progression visualization
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import {
  Map, Plus, ChevronRight, ChevronDown, AlertTriangle, AlertCircle,
  CheckCircle, Circle, Clock, Calendar, FileText, Scale, TrendingUp,
  GitBranch, RefreshCw, FilePlus, Gavel, X, Edit3, Trash2, Download,
  Upload, HelpCircle, Target, Award, ExternalLink, ChevronLeft,
  Stethoscope, Link as LinkIcon, Users, Shield, Clipboard, Loader,
  BarChart2, Settings, Info, Play, Flag, MessageSquare, Lightbulb,
  RefreshCcw
} from 'lucide-react';

// Schema and engine imports
import {
  CLAIM_TYPES,
  CLAIM_PHASES,
  EVIDENCE_ITEMS,
  DECISION_OUTCOMES,
  DENIAL_REASONS,
  VA_FORMS,
  TRIAGE_QUESTIONS,
  URGENCY_LEVELS,
  createClaimSchema,
  daysUntilDeadline,
  calculateEvidenceCompleteness,
  hasBigThree
} from '../data/claimNavigatorSchema';

import {
  determineNextStep,
  analyzeMultipleClaims,
  ACTION_TYPES
} from '../utils/claimNavigatorEngine';

import {
  getAllClaims,
  getClaimById,
  createClaim,
  updateClaim,
  deleteClaim,
  advanceClaimPhase,
  updateEvidenceItem,
  recordDecision,
  addClaimNote,
  exportClaimsData,
  importClaimsData,
  getClaimStatistics
} from '../utils/claimNavigatorStorage';

// Integration bridge - syncs with ClaimProgress & useClaimProgress
import {
  getBigThreeStatus,
  setBigThreeStatus,
  syncEvidenceToBigThree,
  recordClaimCreated,
  recordPhaseAdvanced,
  markItfFiled,
  getOverallMilestoneProgress,
  getSavedConditions,
  initIntegrationListeners,
  dispatchNavigatorUpdate
} from '../utils/claimIntegration';

import ReportBugLink from './ReportBugLink';

// ============================================
// ICON MAPPING
// ============================================
const ClaimTypeIcons = {
  ORIGINAL: FileText,
  INCREASE: TrendingUp,
  SECONDARY: GitBranch,
  SUPPLEMENTAL: FilePlus,
  HLR: Scale,
  BOARD_APPEAL: Gavel,
  REOPEN: RefreshCw
};

const UrgencyIcons = {
  CRITICAL: AlertTriangle,
  HIGH: AlertCircle,
  MEDIUM: Clock,
  LOW: Info
};

// ============================================
// MAIN COMPONENT
// ============================================
const ClaimNavigator = ({ onClose, onReportBug }) => {
  const { t } = useLanguage();
  
  // Lock background scroll when modal is open
  useBodyScrollLock(true);
  
  // State
  const [claims, setClaims] = useState([]);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [view, setView] = useState('dashboard'); // dashboard, wizard, detail, evidence
  const [triageState, setTriageState] = useState({ step: 0, answers: {} });
  const [isLoading, setIsLoading] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [dashboardAnalysis, setDashboardAnalysis] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [milestoneProgress, setMilestoneProgress] = useState(null);

  // Initialize integration listeners and load claims on mount
  useEffect(() => {
    initIntegrationListeners();
    loadClaims();
    
    // Load overall milestone progress from other tools
    const progress = getOverallMilestoneProgress();
    setMilestoneProgress(progress);
    
    // Listen for updates from other tools
    const handleProgressUpdate = () => {
      const updated = getOverallMilestoneProgress();
      setMilestoneProgress(updated);
    };
    
    window.addEventListener('claimProgressUpdate', handleProgressUpdate);
    window.addEventListener('bigThreeUpdate', handleProgressUpdate);
    
    return () => {
      window.removeEventListener('claimProgressUpdate', handleProgressUpdate);
      window.removeEventListener('bigThreeUpdate', handleProgressUpdate);
    };
  }, []);

  const loadClaims = useCallback(() => {
    setIsLoading(true);
    try {
      const loadedClaims = getAllClaims();
      setClaims(loadedClaims);
      
      // Analyze all claims
      const analysis = analyzeMultipleClaims(loadedClaims);
      setDashboardAnalysis(analysis);
      
      // Get statistics
      const stats = getClaimStatistics();
      setStatistics(stats);
    } catch (error) {
      console.error('Error loading claims:', error);
    }
    setIsLoading(false);
  }, []);

  // Refresh analysis when claims change
  useEffect(() => {
    if (claims.length > 0) {
      const analysis = analyzeMultipleClaims(claims);
      setDashboardAnalysis(analysis);
    }
  }, [claims]);

  // ============================================
  // CLAIM ACTIONS
  // ============================================
  
  const handleCreateClaim = (claimData) => {
    const newClaim = createClaim(claimData);
    setClaims(prev => [...prev, newClaim]);
    setSelectedClaim(newClaim);
    setView('detail');
    setTriageState({ step: 0, answers: {} });
    
    // Sync with integration bridge - marks milestone in useClaimProgress
    recordClaimCreated(newClaim.claimType);
    
    // If ITF date was set, sync that too
    if (newClaim.criticalDates?.itfDate) {
      markItfFiled(newClaim.criticalDates.itfDate);
    }
    
    // Dispatch event for other components to react
    dispatchNavigatorUpdate('claim_created', { claimId: newClaim.id, type: newClaim.claimType });
  };

  const handleUpdateClaim = (claimId, updates) => {
    const updated = updateClaim(claimId, updates);
    if (updated) {
      setClaims(prev => prev.map(c => c.id === claimId ? updated : c));
      if (selectedClaim?.id === claimId) {
        setSelectedClaim(updated);
      }
      
      // Sync evidence checklist with Big 3 (ClaimProgress integration)
      if (updates.evidenceChecklist && updated.conditionName) {
        // Map our evidence keys to Big 3 keys
        const checklist = updates.evidenceChecklist;
        if (checklist.diagnosis !== undefined) {
          setBigThreeStatus(updated.conditionName, 'diagnosis', checklist.diagnosis);
        }
        if (checklist.inServiceEvent !== undefined) {
          setBigThreeStatus(updated.conditionName, 'event', checklist.inServiceEvent);
        }
        if (checklist.nexus !== undefined) {
          setBigThreeStatus(updated.conditionName, 'nexus', checklist.nexus);
        }
      }
      
      // Sync phase changes
      if (updates.currentPhase && updates.currentPhase !== claims.find(c => c.id === claimId)?.currentPhase) {
        recordPhaseAdvanced(claimId, claims.find(c => c.id === claimId)?.currentPhase, updates.currentPhase);
        dispatchNavigatorUpdate('phase_changed', { claimId, phase: updates.currentPhase });
      }
    }
  };

  const handleDeleteClaim = (claimId) => {
    if (window.confirm('Are you sure you want to delete this claim? This cannot be undone.')) {
      deleteClaim(claimId);
      setClaims(prev => prev.filter(c => c.id !== claimId));
      if (selectedClaim?.id === claimId) {
        setSelectedClaim(null);
        setView('dashboard');
      }
    }
  };

  const handleExport = () => {
    try {
      const data = exportClaimsData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vetrate-claims-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  const handleImport = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = importClaimsData(e.target.result, true);
        if (result.success) {
          loadClaims();
          alert(`Imported ${result.imported} claim(s). ${result.skipped} skipped (duplicates).`);
        } else {
          alert('Import failed: ' + result.error);
        }
      } catch (error) {
        alert('Import failed: Invalid file format');
      }
    };
    reader.readAsText(file);
  };

  // ============================================
  // RENDER
  // ============================================

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-slate-900/95 z-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-300">Loading Mission Control...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/95 z-50 overflow-hidden flex flex-col">
      {/* Header */}
      <header className="bg-slate-800/80 border-b border-slate-700 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Map className="w-6 h-6 text-amber-500" />
          <div>
            <h1 className="text-lg font-bold text-white">Claim Navigator</h1>
            <p className="text-xs text-slate-400">Mission Control for Your VA Claims</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="hidden sm:flex bg-slate-700/50 rounded-lg p-1">
            <button
              onClick={() => setView('dashboard')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                view === 'dashboard' ? 'bg-amber-500 text-slate-900' : 'text-slate-300 hover:text-white'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setView('wizard')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                view === 'wizard' ? 'bg-amber-500 text-slate-900' : 'text-slate-300 hover:text-white'
              }`}
            >
              New Claim
            </button>
          </div>

          {/* Actions */}
          {onReportBug && <ReportBugLink onClick={onReportBug} variant="light" moduleName="Claim Navigator" />}
          
          <button
            onClick={() => setShowHelp(true)}
            className="p-2 text-slate-400 hover:text-white transition-colors"
            title="Help"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
          
          <button
            onClick={handleExport}
            className="p-2 text-slate-400 hover:text-white transition-colors"
            title="Export Claims"
          >
            <Download className="w-5 h-5" />
          </button>
          
          <label className="p-2 text-slate-400 hover:text-white transition-colors cursor-pointer" title="Import Claims">
            <Upload className="w-5 h-5" />
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-red-400 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {view === 'dashboard' && (
          <Dashboard
            claims={claims}
            analysis={dashboardAnalysis}
            statistics={statistics}
            milestoneProgress={milestoneProgress}
            onSelectClaim={(claim) => { setSelectedClaim(claim); setView('detail'); }}
            onNewClaim={() => setView('wizard')}
          />
        )}
        
        {view === 'wizard' && (
          <TriageWizard
            triageState={triageState}
            setTriageState={setTriageState}
            onComplete={handleCreateClaim}
            onBack={() => setView('dashboard')}
          />
        )}
        
        {view === 'detail' && selectedClaim && (
          <ClaimDetail
            claim={selectedClaim}
            onUpdate={handleUpdateClaim}
            onDelete={handleDeleteClaim}
            onBack={() => { setSelectedClaim(null); setView('dashboard'); }}
            onViewEvidence={() => setView('evidence')}
          />
        )}
        
        {view === 'evidence' && selectedClaim && (
          <EvidenceTracker
            claim={selectedClaim}
            onUpdate={handleUpdateClaim}
            onBack={() => setView('detail')}
          />
        )}
      </main>

      {/* Help Modal */}
      {showHelp && (
        <HelpModal onClose={() => setShowHelp(false)} />
      )}
    </div>
  );
};

// ============================================
// DASHBOARD COMPONENT
// ============================================
const Dashboard = ({ claims, analysis, statistics, milestoneProgress, onSelectClaim, onNewClaim }) => {
  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Critical Alerts */}
      {analysis?.criticalActions?.length > 0 && (
        <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4">
          <h2 className="flex items-center gap-2 text-red-400 font-bold mb-3">
            <AlertTriangle className="w-5 h-5" />
            URGENT ACTIONS REQUIRED
          </h2>
          <div className="space-y-2">
            {analysis.criticalActions.map((action, idx) => (
              <div key={idx} className="bg-red-900/40 rounded-lg p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white font-semibold">{action.title}</p>
                    <p className="text-red-200 text-sm mt-1">{action.description}</p>
                    {action.conditionName && (
                      <p className="text-red-300 text-xs mt-1">
                        Claim: {action.conditionName}
                      </p>
                    )}
                  </div>
                  {action.deadline && (
                    <span className="bg-red-600 text-white px-2 py-1 rounded text-sm font-bold">
                      {action.deadline} days
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Stats */}
      {statistics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            icon={Clipboard}
            label="Total Claims"
            value={statistics.totalClaims}
            color="blue"
          />
          <StatCard
            icon={Clock}
            label="In Progress"
            value={statistics.byStatus.pending + statistics.byStatus.submitted}
            color="amber"
          />
          <StatCard
            icon={CheckCircle}
            label="Granted"
            value={statistics.byStatus.granted}
            color="green"
          />
          <StatCard
            icon={AlertTriangle}
            label="Deadlines Near"
            value={statistics.deadlinesApproaching}
            color={statistics.deadlinesApproaching > 0 ? 'red' : 'slate'}
          />
        </div>
      )}
      
      {/* Mission Readiness Integration - Shows progress from other tools */}
      {milestoneProgress && (
        <div className="bg-gradient-to-r from-slate-800/50 to-blue-900/30 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-blue-400" />
              <h3 className="text-blue-400 font-semibold">Mission Readiness</h3>
              <span className="text-xs text-slate-400">(synced from other tools)</span>
            </div>
            <span className={`text-lg font-bold ${
              milestoneProgress.percentage >= 80 ? 'text-green-400' :
              milestoneProgress.percentage >= 50 ? 'text-amber-400' :
              'text-slate-400'
            }`}>
              {milestoneProgress.percentage}%
            </span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-2">
            <div 
              className={`h-full rounded-full transition-all ${
                milestoneProgress.percentage >= 80 ? 'bg-green-500' :
                milestoneProgress.percentage >= 50 ? 'bg-amber-500' :
                'bg-blue-500'
              }`}
              style={{ width: `${milestoneProgress.percentage}%` }}
            />
          </div>
          <p className="text-slate-400 text-xs">
            {milestoneProgress.completedCount} of {milestoneProgress.totalCount} key milestones completed across SupplyLocker tools
          </p>
        </div>
      )}

      {/* Overall Recommendation */}
      {analysis?.overallRecommendation && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Target className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-amber-500 font-semibold">Your Focus</h3>
              <p className="text-slate-300 text-sm mt-1">{analysis.overallRecommendation}</p>
            </div>
          </div>
        </div>
      )}

      {/* Claims List */}
      <div className="bg-slate-800/30 rounded-lg border border-slate-700">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-white font-semibold">Your Claims</h2>
          <button
            onClick={onNewClaim}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-900 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Claim
          </button>
        </div>

        {claims.length === 0 ? (
          <div className="p-8 text-center">
            <Map className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 mb-4">No claims tracked yet.</p>
            <button
              onClick={onNewClaim}
              className="bg-amber-500 hover:bg-amber-600 text-slate-900 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Start Your First Claim
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {analysis?.activeClaimsSummary?.map((summary) => {
              const claim = claims.find(c => c.id === summary.id);
              if (!claim) return null;
              
              const TypeIcon = ClaimTypeIcons[claim.claimType] || FileText;
              
              return (
                <button
                  key={claim.id}
                  onClick={() => onSelectClaim(claim)}
                  className="w-full p-4 hover:bg-slate-700/30 transition-colors text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        summary.hasWarnings ? 'bg-red-500/20' : 'bg-slate-700/50'
                      }`}>
                        <TypeIcon className={`w-5 h-5 ${
                          summary.hasWarnings ? 'text-red-400' : 'text-amber-500'
                        }`} />
                      </div>
                      <div>
                        <h3 className="text-white font-medium">{claim.conditionName || 'Unnamed Claim'}</h3>
                        <p className="text-slate-400 text-sm">
                          {CLAIM_TYPES[claim.claimType]?.label || 'Determining type...'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {/* Progress indicator */}
                      <div className="hidden sm:flex items-center gap-2">
                        <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              summary.completeness >= 90 ? 'bg-green-500' :
                              summary.completeness >= 60 ? 'bg-amber-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${summary.completeness}%` }}
                          />
                        </div>
                        <span className="text-slate-400 text-sm w-10">{summary.completeness}%</span>
                      </div>
                      
                      {/* Status badge */}
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        summary.hasWarnings ? 'bg-red-500/20 text-red-400' :
                        summary.completeness >= 90 ? 'bg-green-500/20 text-green-400' :
                        'bg-slate-700 text-slate-300'
                      }`}>
                        {CLAIM_PHASES[claim.currentPhase]?.label || 'Unknown'}
                      </span>
                      
                      <ChevronRight className="w-5 h-5 text-slate-500" />
                    </div>
                  </div>
                  
                  {/* Top action preview */}
                  {summary.topAction && (
                    <div className="mt-2 ml-12 text-sm text-slate-400 flex items-center gap-2">
                      <Flag className="w-3 h-3" />
                      <span className="truncate">{summary.topAction.title}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Community Insights - Reddit-style veteran tips */}
      <CommunityInsightsPanel />
    </div>
  );
};

// ============================================
// COMMUNITY INSIGHTS PANEL (COMING SOON)
// ============================================
const CommunityInsightsPanel = () => {
  return (
    <div className="bg-gradient-to-r from-slate-800/50 to-slate-700/30 border border-slate-600/50 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <MessageSquare className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-white font-semibold">Community Insights</h3>
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-bold rounded-full uppercase">
                Coming Soon
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Reddit-style tips from fellow veterans
            </p>
          </div>
        </div>
      </div>

      {/* Coming Soon Content */}
      <div className="px-4 pb-4">
        <div className="bg-slate-900/50 rounded-lg p-4 text-center">
          <Lightbulb className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">
            We're working on bringing you curated insights from the veteran community.
          </p>
          <p className="text-slate-500 text-xs mt-2">
            Tips, strategies, and real experiences from r/VeteransBenefits and other veteran forums.
          </p>
        </div>
      </div>
    </div>
  );
};

// ============================================
// REDDIT SUMMARY GENERATOR
// ============================================
/**
 * Generates a Reddit-style BLUF summary from Navigator analysis
 * @param {Object} analysis - The claim analysis object
 * @param {Object} claim - The claim object
 * @returns {string} Reddit-formatted summary
 */
const generateRedditSummary = (analysis, claim) => {
  if (!analysis || !claim) return '';
  
  const lines = [];
  
  // BLUF (Bottom Line Up Front)
  lines.push(`**BLUF**: ${claim.conditionName} claim - ${analysis.overallStatus || 'In Progress'} (${analysis.completeness || 0}% ready)`);
  lines.push('');
  
  // Claim Type
  const claimTypeLabels = {
    ORIGINAL: 'Original Claim',
    INCREASE: 'Increase Claim',
    SECONDARY: 'Secondary Claim',
    SUPPLEMENTAL: 'Supplemental Claim',
    HLR: 'Higher-Level Review',
    BOARD_APPEAL: 'Board Appeal'
  };
  lines.push(`**Claim Type**: ${claimTypeLabels[claim.claimType] || claim.claimType}`);
  lines.push('');
  
  // Warnings (if any)
  if (analysis.warnings?.length > 0) {
    lines.push('**⚠️ Warnings**:');
    analysis.warnings.slice(0, 3).forEach(w => {
      lines.push(`* ${w.title}`);
    });
    lines.push('');
  }
  
  // Top Actions
  if (analysis.actions?.length > 0) {
    lines.push('**Next Steps**:');
    analysis.actions.slice(0, 3).forEach((action, idx) => {
      const emoji = action.urgency === 'CRITICAL' ? '🔴' : action.urgency === 'HIGH' ? '🟠' : '🟢';
      lines.push(`${idx + 1}. ${emoji} ${action.title}`);
    });
    lines.push('');
  }
  
  // Evidence Status
  const checklist = claim.evidenceChecklist || {};
  const hasDiagnosis = checklist.diagnosis ? '✅' : '❌';
  const hasNexus = checklist.nexus ? '✅' : '❌';
  const hasEvent = checklist.inServiceEvent ? '✅' : '❌';
  
  lines.push('**Big 3 Evidence**:');
  lines.push(`| Evidence | Status |`);
  lines.push(`|:--|:--:|`);
  lines.push(`| Current Diagnosis | ${hasDiagnosis} |`);
  lines.push(`| Nexus Letter | ${hasNexus} |`);
  lines.push(`| In-Service Event | ${hasEvent} |`);
  lines.push('');
  
  // Footer
  lines.push('---');
  lines.push('*Generated by [SupplyLocker.org](https://SupplyLocker.org) Navigator*');
  
  return lines.join('\n');
};

/**
 * Copy text to clipboard with Reddit formatting
 */
const copyRedditSummary = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
};

// ============================================
// REDDIT COPY BUTTON FOR NAVIGATOR
// ============================================
const RedditSummaryButton = ({ analysis, claim }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    const summary = generateRedditSummary(analysis, claim);
    const success = await copyRedditSummary(summary);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  if (!analysis || !claim) return null;
  
  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
        copied 
          ? 'bg-green-500 text-white' 
          : 'bg-orange-500 hover:bg-orange-600 text-white'
      }`}
      title="Copy Reddit-formatted summary"
    >
      {copied ? (
        <>
          <CheckCircle className="w-3.5 h-3.5" />
          Copied!
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
          </svg>
          Reddit Summary
        </>
      )}
    </button>
  );
};

// ============================================
// STAT CARD COMPONENT
// ============================================
const StatCard = ({ icon: Icon, label, value, color }) => {
  const colors = {
    blue: 'bg-blue-500/20 text-blue-400',
    amber: 'bg-amber-500/20 text-amber-400',
    green: 'bg-green-500/20 text-green-400',
    red: 'bg-red-500/20 text-red-400',
    slate: 'bg-slate-700/50 text-slate-400'
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
      <div className="flex items-center gap-2">
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-xs text-slate-400">{label}</p>
        </div>
      </div>
    </div>
  );
};

// ============================================
// TRIAGE WIZARD COMPONENT
// ============================================
const TriageWizard = ({ triageState, setTriageState, onComplete, onBack }) => {
  const [conditionName, setConditionName] = useState('');
  const [currentQuestionId, setCurrentQuestionId] = useState('filed_before');
  const [determinedType, setDeterminedType] = useState(null);

  const currentQuestion = TRIAGE_QUESTIONS.find(q => q.id === currentQuestionId);

  const handleAnswer = (option) => {
    const newAnswers = { ...triageState.answers, [currentQuestionId]: option.value };
    setTriageState({ ...triageState, answers: newAnswers });

    // Check if this leads to a claim type determination
    if (CLAIM_TYPES[option.next]) {
      setDeterminedType(option.next);
    } else {
      // Move to next question
      setCurrentQuestionId(option.next);
    }
  };

  const handleStartClaim = () => {
    if (!conditionName.trim()) {
      alert('Please enter a condition name');
      return;
    }

    const claimData = {
      conditionName: conditionName.trim(),
      claimType: determinedType,
      currentPhase: CLAIM_PHASES.INTENT_TO_FILE.code,
      triageAnswers: triageState.answers
    };

    onComplete(claimData);
  };

  const resetWizard = () => {
    setTriageState({ step: 0, answers: {} });
    setCurrentQuestionId('filed_before');
    setDeterminedType(null);
    setConditionName('');
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="max-w-2xl mx-auto">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        {/* Wizard Card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 p-6 border-b border-slate-700">
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <Target className="w-6 h-6 text-amber-500" />
              Claim Triage Wizard <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded align-middle">BETA</span>
            </h2>
            <p className="text-slate-300 mt-2">
              Let's determine the best path for your claim. Answer a few questions.
            </p>
          </div>

          <div className="p-6">
            {/* Condition Name Input (always shown first) */}
            {!conditionName && !determinedType && (
              <div className="space-y-4">
                <label className="block">
                  <span className="text-white font-medium">What condition are you claiming?</span>
                  <input
                    type="text"
                    value={conditionName}
                    onChange={(e) => setConditionName(e.target.value)}
                    placeholder="e.g., Sleep Apnea, Tinnitus, PTSD..."
                    className="mt-2 w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                    autoFocus
                  />
                </label>
                <button
                  onClick={() => conditionName.trim() && setTriageState({ ...triageState, step: 1 })}
                  disabled={!conditionName.trim()}
                  className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-slate-900 font-medium py-3 rounded-lg transition-colors"
                >
                  Continue
                </button>
              </div>
            )}

            {/* Questions */}
            {conditionName && !determinedType && currentQuestion && (
              <div className="space-y-4">
                <div className="text-center mb-6">
                  <span className="text-amber-500 font-medium">Claiming: {conditionName}</span>
                </div>

                <h3 className="text-lg text-white font-medium">
                  {currentQuestion.question}
                </h3>

                <div className="space-y-3 mt-4">
                  {currentQuestion.options.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleAnswer(option)}
                      className="w-full text-left bg-slate-700/50 hover:bg-slate-700 border border-slate-600 hover:border-amber-500/50 rounded-lg p-4 transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-white group-hover:text-amber-400 transition-colors">
                          {option.label}
                        </span>
                        <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-amber-500 transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Result */}
            {determinedType && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    {React.createElement(ClaimTypeIcons[determinedType] || FileText, {
                      className: 'w-8 h-8 text-amber-500'
                    })}
                  </div>
                  <h3 className="text-xl font-bold text-white">
                    {CLAIM_TYPES[determinedType]?.label}
                  </h3>
                  <p className="text-slate-300 mt-2">
                    {CLAIM_TYPES[determinedType]?.info}
                  </p>
                </div>

                <div className="bg-slate-900/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-amber-400 mb-2">
                    <FileText className="w-4 h-4" />
                    <span className="font-medium">Required Form</span>
                  </div>
                  <p className="text-white">{CLAIM_TYPES[determinedType]?.form}</p>
                </div>

                <div className="bg-green-900/30 border border-green-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-green-400 font-medium">Claiming: {conditionName}</p>
                      <p className="text-green-200 text-sm mt-1">
                        Ready to create your claim and start tracking
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={resetWizard}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-medium transition-colors"
                  >
                    Start Over
                  </button>
                  <button
                    onClick={handleStartClaim}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-900 py-3 rounded-lg font-medium transition-colors"
                  >
                    Create Claim
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// CLAIM DETAIL COMPONENT
// ============================================
const ClaimDetail = ({ claim, onUpdate, onDelete, onBack, onViewEvidence }) => {
  const [analysis, setAnalysis] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(claim.conditionName);
  const [showDateEditor, setShowDateEditor] = useState(false);

  useEffect(() => {
    const result = determineNextStep(claim);
    setAnalysis(result);
  }, [claim]);

  const handleSaveName = () => {
    if (editName.trim()) {
      onUpdate(claim.id, { conditionName: editName.trim() });
      setIsEditing(false);
    }
  };

  const handlePhaseChange = (newPhase) => {
    onUpdate(claim.id, { currentPhase: newPhase });
  };

  const TypeIcon = ClaimTypeIcons[claim.claimType] || FileText;

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDateEditor(true)}
              className="p-2 text-slate-400 hover:text-white transition-colors"
              title="Edit Dates"
            >
              <Calendar className="w-5 h-5" />
            </button>
            <button
              onClick={() => onDelete(claim.id)}
              className="p-2 text-slate-400 hover:text-red-400 transition-colors"
              title="Delete Claim"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Claim Header Card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-4 border-b border-slate-600">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-500/20 rounded-xl">
                <TypeIcon className="w-8 h-8 text-amber-500" />
              </div>
              <div className="flex-1">
                {isEditing ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1 text-white"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveName}
                      className="px-3 py-1 bg-amber-500 text-slate-900 rounded"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-white">
                      {claim.conditionName || 'Unnamed Claim'}
                    </h1>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="p-1 text-slate-400 hover:text-white"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <p className="text-slate-400 mt-1">
                  {CLAIM_TYPES[claim.claimType]?.label || 'Type not determined'}
                </p>
              </div>
            </div>
          </div>

          {/* Status & Progress */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 text-sm">Overall Status</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                analysis?.warnings?.length > 0 ? 'bg-red-500/20 text-red-400' :
                analysis?.completeness >= 90 ? 'bg-green-500/20 text-green-400' :
                'bg-amber-500/20 text-amber-400'
              }`}>
                {analysis?.overallStatus || 'Loading...'}
              </span>
            </div>
            
            {/* Evidence Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Evidence Completeness</span>
                <span className="text-white font-medium">{analysis?.completeness || 0}%</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    (analysis?.completeness || 0) >= 90 ? 'bg-green-500' :
                    (analysis?.completeness || 0) >= 60 ? 'bg-amber-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${analysis?.completeness || 0}%` }}
                />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-4 flex gap-2">
              <button
                onClick={onViewEvidence}
                className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-sm transition-colors"
              >
                <Clipboard className="w-4 h-4" />
                Evidence Checklist
              </button>
              <RedditSummaryButton analysis={analysis} claim={claim} />
            </div>
          </div>
        </div>

        {/* Warnings */}
        {analysis?.warnings?.length > 0 && (
          <div className="space-y-2">
            {analysis.warnings.map((warning, idx) => {
              const UrgencyIcon = UrgencyIcons[warning.urgency] || AlertCircle;
              return (
                <div
                  key={idx}
                  className={`rounded-lg p-4 ${URGENCY_LEVELS[warning.urgency]?.bgColor || 'bg-slate-800'} border ${URGENCY_LEVELS[warning.urgency]?.borderColor || 'border-slate-700'}`}
                >
                  <div className="flex items-start gap-3">
                    <UrgencyIcon className={`w-5 h-5 flex-shrink-0 ${URGENCY_LEVELS[warning.urgency]?.textColor || 'text-slate-400'}`} />
                    <div>
                      <p className={`font-semibold ${URGENCY_LEVELS[warning.urgency]?.textColor || 'text-white'}`}>
                        {warning.title}
                      </p>
                      <p className={`text-sm mt-1 ${URGENCY_LEVELS[warning.urgency]?.textColor || 'text-slate-300'}`}>
                        {warning.message}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Next Actions */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Target className="w-5 h-5 text-amber-500" />
              Your Next Steps
            </h2>
          </div>
          <div className="divide-y divide-slate-700">
            {analysis?.actions?.map((action, idx) => {
              const UrgencyIcon = UrgencyIcons[action.urgency] || Circle;
              return (
                <div key={idx} className="p-4 hover:bg-slate-700/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <UrgencyIcon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${URGENCY_LEVELS[action.urgency]?.textColor || 'text-slate-400'}`} />
                    <div className="flex-1">
                      <h3 className="text-white font-medium">{action.title}</h3>
                      <p className="text-slate-400 text-sm mt-1">{action.description}</p>
                      
                      {action.form && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-slate-500">Form:</span>
                          <a
                            href={VA_FORMS[action.form]?.url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-amber-400 hover:text-amber-300 text-sm flex items-center gap-1"
                          >
                            VA Form {action.form}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                      
                      {action.tip && (
                        <p className="text-amber-400/80 text-xs mt-2 flex items-start gap-1">
                          <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          {action.tip}
                        </p>
                      )}
                    </div>
                    
                    {action.deadline && (
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        action.deadline <= 30 ? 'bg-red-500 text-white' : 'bg-slate-700 text-slate-300'
                      }`}>
                        {action.deadline}d
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Phase Timeline */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-amber-500" />
              Claim Phase
            </h2>
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-2">
              {Object.values(CLAIM_PHASES)
                .filter(phase => phase.step >= 0)
                .sort((a, b) => a.step - b.step)
                .map((phase) => {
                  const isCurrentPhase = claim.currentPhase === phase.code;
                  const isPastPhase = CLAIM_PHASES[claim.currentPhase]?.step > phase.step;
                  
                  return (
                    <button
                      key={phase.code}
                      onClick={() => handlePhaseChange(phase.code)}
                      className={`px-3 py-2 rounded-lg text-sm transition-all ${
                        isCurrentPhase
                          ? 'bg-amber-500 text-slate-900 font-medium'
                          : isPastPhase
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {isPastPhase && <CheckCircle className="w-3 h-3 inline mr-1" />}
                      {phase.label}
                    </button>
                  );
                })}
            </div>
            
            {CLAIM_PHASES[claim.currentPhase] && (
              <div className="mt-4 p-3 bg-slate-900/50 rounded-lg">
                <p className="text-slate-300 text-sm">
                  {CLAIM_PHASES[claim.currentPhase].description}
                </p>
                {CLAIM_PHASES[claim.currentPhase].userAction && (
                  <p className="text-amber-400 text-sm mt-2 flex items-start gap-2">
                    <Play className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    {CLAIM_PHASES[claim.currentPhase].userAction}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Critical Dates */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-500" />
              Critical Dates
            </h2>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DateCard
              label="Intent to File"
              date={claim.criticalDates?.itfDate}
              isDeadline={false}
              onUpdate={(date) => onUpdate(claim.id, {
                criticalDates: { ...claim.criticalDates, itfDate: date }
              })}
            />
            <DateCard
              label="ITF Expiration"
              date={claim.criticalDates?.itfExpirationDate}
              isDeadline={true}
              onUpdate={(date) => onUpdate(claim.id, {
                criticalDates: { ...claim.criticalDates, itfExpirationDate: date }
              })}
            />
            <DateCard
              label="Claim Submitted"
              date={claim.criticalDates?.submissionDate}
              isDeadline={false}
              onUpdate={(date) => onUpdate(claim.id, {
                criticalDates: { ...claim.criticalDates, submissionDate: date }
              })}
            />
            <DateCard
              label="Appeal Deadline"
              date={claim.criticalDates?.appealDeadline}
              isDeadline={true}
              onUpdate={(date) => onUpdate(claim.id, {
                criticalDates: { ...claim.criticalDates, appealDeadline: date }
              })}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// DATE CARD COMPONENT
// ============================================
const DateCard = ({ label, date, isDeadline, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const daysLeft = date ? daysUntilDeadline(date) : null;
  const isUrgent = isDeadline && daysLeft !== null && daysLeft <= 30 && daysLeft > 0;
  const isPassed = isDeadline && daysLeft !== null && daysLeft < 0;

  const handleSave = () => {
    if (inputValue) {
      onUpdate(new Date(inputValue).toISOString());
    }
    setIsEditing(false);
  };

  return (
    <div className={`p-3 rounded-lg ${
      isPassed ? 'bg-red-900/30 border border-red-500/50' :
      isUrgent ? 'bg-orange-900/30 border border-orange-500/50' :
      'bg-slate-700/30 border border-slate-600'
    }`}>
      <div className="flex items-center justify-between">
        <span className="text-slate-400 text-sm">{label}</span>
        <button
          onClick={() => {
            setInputValue(date ? date.split('T')[0] : '');
            setIsEditing(true);
          }}
          className="text-slate-500 hover:text-white"
        >
          <Edit3 className="w-3 h-3" />
        </button>
      </div>
      
      {isEditing ? (
        <div className="mt-2 flex gap-2">
          <input
            type="date"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-sm"
          />
          <button onClick={handleSave} className="text-green-400 text-sm">Save</button>
          <button onClick={() => setIsEditing(false)} className="text-slate-400 text-sm">Cancel</button>
        </div>
      ) : (
        <div className="mt-1">
          {date ? (
            <>
              <p className={`font-medium ${isPassed ? 'text-red-400' : isUrgent ? 'text-orange-400' : 'text-white'}`}>
                {new Date(date).toLocaleDateString()}
              </p>
              {isDeadline && daysLeft !== null && (
                <p className={`text-xs ${
                  isPassed ? 'text-red-400' : isUrgent ? 'text-orange-400' : 'text-slate-400'
                }`}>
                  {isPassed ? `${Math.abs(daysLeft)} days ago` : `${daysLeft} days left`}
                </p>
              )}
            </>
          ) : (
            <p className="text-slate-500 text-sm">Not set</p>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================
// EVIDENCE TRACKER COMPONENT
// ============================================
const EvidenceTracker = ({ claim, onUpdate, onBack }) => {
  const bigThree = ['diagnosis', 'nexus', 'inServiceEvent'];
  const supporting = ['dbq', 'personalStatement', 'buddyLetters'];
  const records = ['strs', 'dd214', 'privateMedical', 'vaRecords'];

  const handleToggle = (itemId) => {
    const currentValue = claim.evidenceChecklist?.[itemId] || false;
    const newChecklist = {
      ...claim.evidenceChecklist,
      [itemId]: !currentValue
    };
    onUpdate(claim.id, { evidenceChecklist: newChecklist });
  };

  const completeness = calculateEvidenceCompleteness(claim.evidenceChecklist || {});
  const hasBig3 = hasBigThree(claim.evidenceChecklist || {});

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Claim
        </button>

        {/* Progress */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h1 className="text-xl font-bold text-white mb-4">Evidence Checklist</h1>
          <p className="text-slate-400 text-sm mb-4">
            Track your evidence for: <span className="text-amber-400">{claim.conditionName}</span>
          </p>

          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Overall Progress</span>
              <span className={`font-medium ${
                completeness >= 90 ? 'text-green-400' :
                completeness >= 60 ? 'text-amber-400' :
                'text-red-400'
              }`}>{completeness}%</span>
            </div>
            <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  completeness >= 90 ? 'bg-green-500' :
                  completeness >= 60 ? 'bg-amber-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${completeness}%` }}
              />
            </div>
          </div>

          {hasBig3 ? (
            <div className="bg-green-900/30 border border-green-500/30 rounded-lg p-3 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-green-400 font-medium">Big 3 Complete! Ready to submit.</span>
            </div>
          ) : (
            <div className="bg-amber-900/30 border border-amber-500/30 rounded-lg p-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              <span className="text-amber-400 font-medium">Complete the "Big 3" before submitting.</span>
            </div>
          )}
        </div>

        {/* Big 3 */}
        <EvidenceSection
          title='The "Big 3" (Required)'
          subtitle="You MUST have these to win your claim"
          items={bigThree}
          evidenceChecklist={claim.evidenceChecklist || {}}
          onToggle={handleToggle}
          critical
        />

        {/* Supporting */}
        <EvidenceSection
          title="Supporting Evidence (Recommended)"
          subtitle="Strengthens your claim significantly"
          items={supporting}
          evidenceChecklist={claim.evidenceChecklist || {}}
          onToggle={handleToggle}
        />

        {/* Records */}
        <EvidenceSection
          title="Service & Medical Records"
          subtitle="Documentation from your service and treatment"
          items={records}
          evidenceChecklist={claim.evidenceChecklist || {}}
          onToggle={handleToggle}
        />
      </div>
    </div>
  );
};

// ============================================
// EVIDENCE SECTION COMPONENT
// ============================================
const EvidenceSection = ({ title, subtitle, items, evidenceChecklist, onToggle, critical }) => {
  return (
    <div className={`bg-slate-800/50 border rounded-xl overflow-hidden ${
      critical ? 'border-amber-500/50' : 'border-slate-700'
    }`}>
      <div className={`p-4 border-b ${critical ? 'border-amber-500/30 bg-amber-500/10' : 'border-slate-700'}`}>
        <h2 className={`font-semibold ${critical ? 'text-amber-400' : 'text-white'}`}>{title}</h2>
        <p className="text-slate-400 text-sm">{subtitle}</p>
      </div>
      <div className="divide-y divide-slate-700">
        {items.map(itemId => {
          const item = EVIDENCE_ITEMS[itemId];
          if (!item) return null;
          
          const isChecked = evidenceChecklist[itemId] || false;
          
          return (
            <button
              key={itemId}
              onClick={() => onToggle(itemId)}
              className="w-full p-4 flex items-start gap-3 hover:bg-slate-700/30 transition-colors text-left"
            >
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                isChecked 
                  ? 'bg-green-500 border-green-500' 
                  : item.required 
                  ? 'border-red-500' 
                  : 'border-slate-500'
              }`}>
                {isChecked && <CheckCircle className="w-4 h-4 text-white" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${isChecked ? 'text-green-400' : 'text-white'}`}>
                    {item.label}
                  </span>
                  {item.required && !isChecked && (
                    <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">Required</span>
                  )}
                  {item.recommended && !isChecked && (
                    <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">Recommended</span>
                  )}
                </div>
                <p className="text-slate-400 text-sm mt-1">{item.description}</p>
                {item.tip && (
                  <p className="text-amber-400/70 text-xs mt-2 flex items-start gap-1">
                    <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    {item.tip}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ============================================
// HELP MODAL COMPONENT
// ============================================
const HelpModal = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/70 z-60 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">How to Use Claim Navigator</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
          <section>
            <h3 className="text-amber-400 font-semibold mb-2">🎯 The "Big 3" Evidence</h3>
            <p className="text-slate-300 text-sm">
              Every successful VA claim needs three things:
            </p>
            <ul className="mt-2 space-y-1 text-slate-400 text-sm list-disc list-inside">
              <li><strong className="text-white">Current Diagnosis</strong> - A doctor says you have this condition</li>
              <li><strong className="text-white">In-Service Event</strong> - Something happened during service</li>
              <li><strong className="text-white">Nexus Letter</strong> - A doctor links your condition to service</li>
            </ul>
          </section>

          <section>
            <h3 className="text-amber-400 font-semibold mb-2">⚠️ Critical Deadlines</h3>
            <p className="text-slate-300 text-sm">
              The Claim Navigator tracks two critical 1-year deadlines:
            </p>
            <ul className="mt-2 space-y-1 text-slate-400 text-sm list-disc list-inside">
              <li><strong className="text-white">Intent to File (ITF)</strong> - You have 1 year to submit your full claim after filing an ITF</li>
              <li><strong className="text-white">Appeal Deadline</strong> - You have 1 year from a decision to appeal</li>
            </ul>
            <p className="text-red-400 text-sm mt-2">
              Missing these deadlines can cost you years of backpay!
            </p>
          </section>

          <section>
            <h3 className="text-amber-400 font-semibold mb-2">🛤️ Claim Types</h3>
            <ul className="space-y-2 text-slate-400 text-sm">
              <li><strong className="text-white">Original</strong> - First time filing for this condition</li>
              <li><strong className="text-white">Increase</strong> - Your rated condition got worse</li>
              <li><strong className="text-white">Secondary</strong> - New condition caused by a rated condition</li>
              <li><strong className="text-white">Supplemental</strong> - Denied but have new evidence</li>
              <li><strong className="text-white">HLR</strong> - VA made an error (no new evidence)</li>
            </ul>
          </section>

          <section>
            <h3 className="text-amber-400 font-semibold mb-2">💾 Your Data</h3>
            <p className="text-slate-300 text-sm">
              All your claim data is stored locally on your device. Nothing is sent to any server.
              Use the Export/Import buttons to back up your data.
            </p>
          </section>
        </div>
        <div className="p-4 border-t border-slate-700">
          <button
            onClick={onClose}
            className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium py-2 rounded-lg transition-colors"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClaimNavigator;
