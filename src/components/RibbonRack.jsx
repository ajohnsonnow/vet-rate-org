/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 *
 * The Ribbon Rack Component
 * 
 * Visualizes a veteran's military service history in an emotionally engaging way.
 * Instead of just listing dates, we show:
 * - Service branch with colors and insignia
 * - Timeline of service periods
 * - Deployments with theater ribbons
 * - Awards and decorations
 * - Total time in service
 * 
 * This tool turns cold data into a visual honor roll.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Shield, 
  Award, 
  Calendar, 
  MapPin, 
  Star, 
  ChevronDown, 
  ChevronUp,
  Clock,
  Flag,
  AlertTriangle,
  Swords,
  Medal,
  FileText,
  Download,
  Loader2,
  User,
  RefreshCw,
  ClipboardPaste,
  Eye,
  Grid,
  Sparkles,
} from 'lucide-react';
import { RibbonRackDisplay } from './VisualRibbon';
import { 
  parseDD214Text, 
  sortRibbonsByPrecedence, 
  calculateRackLayout,
  MASTER_AWARDS,
  DEVICES,
} from '../utils/ribbonRackData';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import { useVaAuthContext } from '../contexts/VaAuthContext';
import { getServiceHistory as getLocalServiceHistory } from '../utils/veteranProfile';
import { getServiceHistory as getVaServiceHistory } from '../api/va';
import { startApiLog, API_CATEGORIES } from '../utils/vaSyncLogger';
import ReportBugLink from './ReportBugLink';
import BuyMeCoffee from './BuyMeCoffee';

// Branch colors and styling
const BRANCH_STYLES = {
  'Army': {
    primary: 'bg-green-700',
    secondary: 'bg-green-600',
    text: 'text-green-700 dark:text-green-400',
    border: 'border-green-600',
    gradient: 'from-green-800 to-green-600',
    icon: '🪖',
    motto: 'This We\'ll Defend',
  },
  'Navy': {
    primary: 'bg-blue-800',
    secondary: 'bg-blue-700',
    text: 'text-blue-800 dark:text-blue-400',
    border: 'border-blue-700',
    gradient: 'from-blue-900 to-blue-700',
    icon: '⚓',
    motto: 'Non Sibi Sed Patriae',
  },
  'Air Force': {
    primary: 'bg-sky-600',
    secondary: 'bg-sky-500',
    text: 'text-sky-600 dark:text-sky-400',
    border: 'border-sky-500',
    gradient: 'from-sky-700 to-sky-500',
    icon: '✈️',
    motto: 'Aim High... Fly-Fight-Win',
  },
  'Marines': {
    primary: 'bg-red-700',
    secondary: 'bg-red-600',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-600',
    gradient: 'from-red-800 to-red-600',
    icon: '🦅',
    motto: 'Semper Fidelis',
  },
  'Marine Corps': {
    primary: 'bg-red-700',
    secondary: 'bg-red-600',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-600',
    gradient: 'from-red-800 to-red-600',
    icon: '🦅',
    motto: 'Semper Fidelis',
  },
  'Coast Guard': {
    primary: 'bg-orange-600',
    secondary: 'bg-orange-500',
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-500',
    gradient: 'from-orange-700 to-orange-500',
    icon: '🚢',
    motto: 'Semper Paratus',
  },
  'Space Force': {
    primary: 'bg-slate-800',
    secondary: 'bg-slate-700',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-600',
    gradient: 'from-slate-900 to-slate-700',
    icon: '🚀',
    motto: 'Semper Supra',
  },
  'default': {
    primary: 'bg-gray-700',
    secondary: 'bg-gray-600',
    text: 'text-gray-700 dark:text-gray-400',
    border: 'border-gray-600',
    gradient: 'from-gray-800 to-gray-600',
    icon: '🎖️',
    motto: 'Thank You For Your Service',
  },
};

// Common military awards (for display)
const AWARD_ICONS = {
  'Purple Heart': { emoji: '💜', color: 'bg-purple-600' },
  'Bronze Star': { emoji: '⭐', color: 'bg-amber-600' },
  'Silver Star': { emoji: '⭐', color: 'bg-gray-400' },
  'Medal of Honor': { emoji: '🏅', color: 'bg-blue-500' },
  'Combat Action Ribbon': { emoji: '🎖️', color: 'bg-red-600' },
  'Combat Infantry Badge': { emoji: '🎖️', color: 'bg-blue-700' },
  'Combat Infantryman Badge': { emoji: '🎖️', color: 'bg-blue-700' },
  'Combat Action Badge': { emoji: '🎖️', color: 'bg-blue-700' },
  'Good Conduct Medal': { emoji: '🎖️', color: 'bg-green-600' },
  'National Defense Service Medal': { emoji: '🎖️', color: 'bg-yellow-600' },
  'default': { emoji: '🏅', color: 'bg-gray-500' },
};

// Theater/Campaign ribbons
const THEATER_COLORS = {
  'OEF': { name: 'Operation Enduring Freedom', color: 'bg-gradient-to-r from-green-700 via-yellow-500 to-red-600' },
  'OIF': { name: 'Operation Iraqi Freedom', color: 'bg-gradient-to-r from-red-600 via-white to-blue-600' },
  'OND': { name: 'Operation New Dawn', color: 'bg-gradient-to-r from-blue-600 via-yellow-400 to-green-600' },
  'OIR': { name: 'Operation Inherent Resolve', color: 'bg-gradient-to-r from-green-600 via-white to-red-600' },
  'Desert Storm': { name: 'Operation Desert Storm', color: 'bg-gradient-to-r from-yellow-500 via-red-500 to-green-600' },
  'Desert Shield': { name: 'Operation Desert Shield', color: 'bg-gradient-to-r from-yellow-500 via-red-500 to-green-600' },
  'Vietnam': { name: 'Vietnam Service', color: 'bg-gradient-to-r from-yellow-400 via-green-600 to-red-500' },
  'Korea': { name: 'Korean Service', color: 'bg-gradient-to-r from-blue-500 via-white to-red-500' },
  'Afghanistan': { name: 'Afghanistan Campaign', color: 'bg-gradient-to-r from-green-700 via-yellow-500 to-red-600' },
  'Iraq': { name: 'Iraq Campaign', color: 'bg-gradient-to-r from-red-600 via-white to-blue-600' },
  'default': { name: 'Overseas Service', color: 'bg-gradient-to-r from-blue-500 via-white to-red-500' },
};

/**
 * Calculate years and months between two dates
 */
const calculateServiceTime = (startDate, endDate) => {
  if (!startDate) return null;
  
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  
  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  
  if (months < 0) {
    years--;
    months += 12;
  }
  
  return { years, months, totalMonths: years * 12 + months };
};

/**
 * Format date for display
 */
const formatDate = (dateStr) => {
  if (!dateStr) return 'Unknown';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

const RibbonRack = ({ onClose, onReportBug }) => {
  useBodyScrollLock(true);
  
  const { isAuthenticated, accessToken } = useVaAuthContext();
  const [localHistory, setLocalHistory] = useState(null);
  const [vaHistory, setVaHistory] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedSection, setExpandedSection] = useState('service');
  const [showRawData, setShowRawData] = useState(false);
  
  // DD214 Parser State
  const [dd214Text, setDd214Text] = useState('');
  const [parsedRibbons, setParsedRibbons] = useState([]);
  const [showVisualRack, setShowVisualRack] = useState(false);
  const [ribbonsPerRow, setRibbonsPerRow] = useState(3);
  const [showRibbonBuilder, setShowRibbonBuilder] = useState(false);
  
  // Load local service history on mount
  useEffect(() => {
    const history = getLocalServiceHistory();
    setLocalHistory(history);
  }, []);
  
  // Parse DD214 text when it changes
  const handleParseDd214 = () => {
    if (!dd214Text.trim()) return;
    
    const branch = displayData?.episodes?.[0]?.branch || 'Army';
    const parsed = parseDD214Text(dd214Text, branch);
    
    if (parsed.length > 0) {
      // Sort by precedence
      const sorted = sortRibbonsByPrecedence(parsed, branch);
      setParsedRibbons(sorted);
      setShowVisualRack(true);
    } else {
      setError('Could not parse any awards from the text. Make sure you paste Block 13 or Block 18 from your DD214.');
    }
  };
  
  // Build visual rack data
  const rackLayout = useMemo(() => {
    if (parsedRibbons.length === 0) return null;
    return calculateRackLayout(parsedRibbons, ribbonsPerRow);
  }, [parsedRibbons, ribbonsPerRow]);
  
  // Format awards for visual display
  const visualAwards = useMemo(() => {
    return parsedRibbons.map(ribbon => ({
      awardId: ribbon.awardId,
      award: {
        id: ribbon.awardId,
        name: ribbon.name,
        ribbonColor: ribbon.ribbonColor || 'bg-gray-400',
        assetFilename: ribbon.assetFilename,
      },
      devices: ribbon.devices || [],
    }));
  }, [parsedRibbons]);
  
  // Fetch VA service history if authenticated
  const fetchVaHistory = async () => {
    if (!isAuthenticated || !accessToken) {
      setError('Please connect your VA.gov account to fetch official service history.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    const { complete, fail } = startApiLog(
      API_CATEGORIES.SERVICE_HISTORY,
      '/services/veteran_verification/v2/service_history',
      'OAuth'
    );
    
    try {
      const data = await getVaServiceHistory(accessToken);
      setVaHistory(data);
      complete(data, data?.data?.length || 0);
    } catch (err) {
      console.error('[Ribbon Rack] Error fetching VA history:', err);
      setError(err.message || 'Failed to fetch service history from VA.gov');
      fail(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Determine which data to display (prefer VA data if available)
  const getDisplayData = () => {
    // If we have VA data, transform it
    if (vaHistory?.data?.length > 0) {
      const episodes = vaHistory.data.map(ep => ({
        branch: ep.attributes?.branch_of_service || 'Unknown',
        startDate: ep.attributes?.start_date,
        endDate: ep.attributes?.end_date,
        dischargeStatus: ep.attributes?.discharge_status,
        rank: ep.attributes?.pay_grade,
        deployments: ep.attributes?.deployments || [],
        source: 'VA.gov',
      }));
      return { episodes, source: 'VA.gov (Official)' };
    }
    
    // Fall back to local data
    if (localHistory?.dd214Data) {
      return {
        episodes: [{
          branch: localHistory.dd214Data.branch || 'Unknown',
          startDate: localHistory.dd214Data.entryDate,
          endDate: localHistory.dd214Data.separationDate,
          dischargeStatus: localHistory.dd214Data.characterOfService,
          rank: null,
          mos: localHistory.dd214Data.mos,
          mosTitle: localHistory.dd214Data.mosTitle,
          source: 'DD214 (Self-Reported)',
        }],
        deployments: localHistory.deployments || [],
        awards: localHistory.awards || [],
        source: 'Local (Self-Reported)',
      };
    }
    
    // Return local deployments/awards even without DD214
    if (localHistory?.deployments?.length > 0 || localHistory?.awards?.length > 0) {
      return {
        episodes: [],
        deployments: localHistory.deployments || [],
        awards: localHistory.awards || [],
        source: 'Local (Self-Reported)',
      };
    }
    
    return null;
  };
  
  const displayData = getDisplayData();
  const primaryBranch = displayData?.episodes?.[0]?.branch || 'default';
  const branchStyle = BRANCH_STYLES[primaryBranch] || BRANCH_STYLES.default;
  
  // Calculate total service time
  const totalServiceTime = displayData?.episodes?.reduce((total, ep) => {
    const time = calculateServiceTime(ep.startDate, ep.endDate);
    return total + (time?.totalMonths || 0);
  }, 0) || 0;
  
  const serviceYears = Math.floor(totalServiceTime / 12);
  const serviceMonths = totalServiceTime % 12;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 modal-backdrop overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ribbon-rack-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header with branch colors */}
        <div className={`bg-gradient-to-r ${branchStyle.gradient} p-6 text-white relative overflow-hidden`}>
          {/* Decorative stars */}
          <div className="absolute top-2 right-2 opacity-20 text-4xl">★ ★ ★</div>
          
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-4">
              <span className="text-5xl">{branchStyle.icon}</span>
              <div>
                <h2 id="ribbon-rack-title" className="text-2xl font-bold flex items-center gap-2">
                  <Medal className="w-7 h-7" />
                  The Ribbon Rack
                </h2>
                <p className="text-white/80 text-sm italic">"{branchStyle.motto}"</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white text-3xl font-light transition-colors"
              aria-label="Close modal"
            >
              ×
            </button>
          </div>
          
          {/* Service summary bar */}
          {totalServiceTime > 0 && (
            <div className="mt-4 flex items-center gap-6 text-white/90">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                <span className="font-semibold">
                  {serviceYears > 0 && `${serviceYears} year${serviceYears !== 1 ? 's' : ''}`}
                  {serviceYears > 0 && serviceMonths > 0 && ', '}
                  {serviceMonths > 0 && `${serviceMonths} month${serviceMonths !== 1 ? 's' : ''}`}
                </span>
                <span className="text-white/60">of service</span>
              </div>
              {displayData?.source && (
                <div className="flex items-center gap-1 text-sm bg-white/20 px-2 py-1 rounded">
                  <FileText className="w-4 h-4" />
                  {displayData.source}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* VA Connection prompt */}
          {!displayData && (
            <div className="text-center py-12">
              <Shield className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                No Service History Found
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                Connect your VA.gov account to automatically load your official service history,
                or add your information manually in My Packet.
              </p>
              {isAuthenticated ? (
                <button
                  onClick={fetchVaHistory}
                  disabled={isLoading}
                  className={`px-6 py-3 ${branchStyle.primary} text-white rounded-lg font-semibold 
                    hover:opacity-90 transition-all flex items-center gap-2 mx-auto`}
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-5 h-5" />
                  )}
                  {isLoading ? 'Fetching...' : 'Fetch from VA.gov'}
                </button>
              ) : (
                <p className="text-amber-600 dark:text-amber-400 flex items-center justify-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Connect VA.gov in Settings to fetch official records
                </p>
              )}
            </div>
          )}
          
          {/* Error display */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                <AlertTriangle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            </div>
          )}
          
          {/* DD214 Ribbon Builder Section */}
          <section className="border border-amber-300 dark:border-amber-600 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowRibbonBuilder(!showRibbonBuilder)}
              className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-900/30 hover:from-amber-100 hover:to-yellow-100 dark:hover:from-amber-900/50 dark:hover:to-yellow-900/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                <div className="text-left">
                  <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-300">
                    Visual Ribbon Rack Builder
                  </h3>
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Paste your DD214 Block 13 or 18 to build your ribbon rack
                  </p>
                </div>
              </div>
              {showRibbonBuilder ? (
                <ChevronUp className="w-5 h-5 text-amber-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-amber-500" />
              )}
            </button>
            
            {showRibbonBuilder && (
              <div className="p-4 bg-white dark:bg-gray-800 space-y-4">
                {/* DD214 Text Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <ClipboardPaste className="w-4 h-4 inline mr-1" />
                    Paste DD214 Awards Text (Block 13 or 18)
                  </label>
                  <textarea
                    value={dd214Text}
                    onChange={(e) => setDd214Text(e.target.value)}
                    placeholder="Example: National Defense Service Medal, Afghanistan Campaign Medal w/2 Bronze Service Stars, Army Commendation Medal w/V Device, Good Conduct Medal (3rd Award)..."
                    className="w-full h-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-y"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Supports common abbreviations: NDSM, ARCOM, BSM, GCM, AFSM, etc.
                  </p>
                </div>
                
                {/* Branch selection for precedence */}
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Ribbons per row
                    </label>
                    <select
                      value={ribbonsPerRow}
                      onChange={(e) => setRibbonsPerRow(Number(e.target.value))}
                      className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
                    >
                      <option value={3}>3 ribbons</option>
                      <option value={4}>4 ribbons</option>
                    </select>
                  </div>
                  
                  <button
                    onClick={handleParseDd214}
                    disabled={!dd214Text.trim()}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    <Grid className="w-4 h-4" />
                    Build Ribbon Rack
                  </button>
                </div>
                
                {/* Parsed Ribbons List */}
                {parsedRibbons.length > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-700 dark:text-gray-300">
                        Parsed Awards ({parsedRibbons.length})
                      </h4>
                      <button
                        onClick={() => setShowVisualRack(!showVisualRack)}
                        className="text-sm text-amber-600 hover:text-amber-700 dark:text-amber-400 flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        {showVisualRack ? 'Hide' : 'Show'} Visual Rack
                      </button>
                    </div>
                    
                    {/* Visual Ribbon Rack Display */}
                    {showVisualRack && (
                      <div className="mb-4 flex justify-center">
                        <RibbonRackDisplay
                          awards={visualAwards}
                          ribbonsPerRow={ribbonsPerRow}
                          size="md"
                        />
                      </div>
                    )}
                    
                    {/* Awards List */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                      {parsedRibbons.map((ribbon, idx) => (
                        <div 
                          key={ribbon.awardId || idx}
                          className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 rounded px-3 py-2 text-sm"
                        >
                          <span className="w-5 h-5 flex items-center justify-center text-amber-500 font-bold text-xs">
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-800 dark:text-gray-200 truncate">
                              {ribbon.name}
                            </p>
                            {ribbon.devices?.length > 0 && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {ribbon.devices.map(d => 
                                  DEVICES[d.type]?.name || d.type.replace(/_/g, ' ')
                                ).join(', ')}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
          
          {/* Service Episodes */}
          {displayData?.episodes?.length > 0 && (
            <section>
              <button
                onClick={() => setExpandedSection(expandedSection === 'service' ? null : 'service')}
                className="w-full flex items-center justify-between p-4 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Flag className={`w-6 h-6 ${branchStyle.text}`} />
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    Service Periods ({displayData.episodes.length})
                  </h3>
                </div>
                {expandedSection === 'service' ? (
                  <ChevronUp className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                )}
              </button>
              
              {expandedSection === 'service' && (
                <div className="mt-4 space-y-4">
                  {displayData.episodes.map((episode, idx) => {
                    const style = BRANCH_STYLES[episode.branch] || BRANCH_STYLES.default;
                    const time = calculateServiceTime(episode.startDate, episode.endDate);
                    
                    return (
                      <div 
                        key={idx}
                        className={`border-l-4 ${style.border} bg-gray-50 dark:bg-gray-700/50 rounded-r-lg p-4`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">{style.icon}</span>
                              <h4 className={`text-xl font-bold ${style.text}`}>
                                {episode.branch}
                              </h4>
                            </div>
                            {episode.mos && (
                              <p className="text-gray-600 dark:text-gray-400 mt-1">
                                MOS: {episode.mos} {episode.mosTitle && `- ${episode.mosTitle}`}
                              </p>
                            )}
                            {episode.rank && (
                              <p className="text-gray-600 dark:text-gray-400">
                                Pay Grade: {episode.rank}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                              <Calendar className="w-4 h-4" />
                              <span>{formatDate(episode.startDate)} - {formatDate(episode.endDate)}</span>
                            </div>
                            {time && (
                              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                                {time.years > 0 && `${time.years}y `}{time.months}m
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {/* Discharge Status */}
                        {episode.dischargeStatus && (
                          <div className="mt-3">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
                              ${episode.dischargeStatus.toLowerCase().includes('honorable') 
                                ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' 
                                : 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300'}`}
                            >
                              <Star className="w-4 h-4 mr-1" />
                              {episode.dischargeStatus}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
          
          {/* Deployments Section */}
          {(displayData?.deployments?.length > 0 || localHistory?.deployments?.length > 0) && (
            <section>
              <button
                onClick={() => setExpandedSection(expandedSection === 'deployments' ? null : 'deployments')}
                className="w-full flex items-center justify-between p-4 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Swords className="w-6 h-6 text-red-600 dark:text-red-400" />
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    Deployments ({(displayData?.deployments || localHistory?.deployments || []).length})
                  </h3>
                </div>
                {expandedSection === 'deployments' ? (
                  <ChevronUp className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                )}
              </button>
              
              {expandedSection === 'deployments' && (
                <div className="mt-4 grid gap-3">
                  {(displayData?.deployments || localHistory?.deployments || []).map((dep, idx) => {
                    const theater = THEATER_COLORS[dep.theater] || THEATER_COLORS.default;
                    return (
                      <div 
                        key={dep.id || idx}
                        className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          {/* Campaign Ribbon */}
                          <div className={`w-12 h-4 rounded ${theater.color}`} title={theater.name}></div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-800 dark:text-gray-200">
                              {dep.theater || dep.location}
                            </h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {dep.location} {dep.unit && `• ${dep.unit}`}
                            </p>
                          </div>
                          <div className="text-right text-sm text-gray-600 dark:text-gray-400">
                            {formatDate(dep.startDate)} - {formatDate(dep.endDate)}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 mt-2">
                          {dep.combat && (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300">
                              <Swords className="w-3 h-3 mr-1" />
                              Combat
                            </span>
                          )}
                          {dep.hazardous && (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Hazardous
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
          
          {/* Awards Section */}
          {(displayData?.awards?.length > 0 || localHistory?.awards?.length > 0) && (
            <section>
              <button
                onClick={() => setExpandedSection(expandedSection === 'awards' ? null : 'awards')}
                className="w-full flex items-center justify-between p-4 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Award className="w-6 h-6 text-amber-500" />
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    Awards & Decorations ({(displayData?.awards || localHistory?.awards || []).length})
                  </h3>
                </div>
                {expandedSection === 'awards' ? (
                  <ChevronUp className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                )}
              </button>
              
              {expandedSection === 'awards' && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(displayData?.awards || localHistory?.awards || []).map((award, idx) => {
                    const awardStyle = AWARD_ICONS[award.name] || AWARD_ICONS.default;
                    return (
                      <div 
                        key={award.id || idx}
                        className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600"
                      >
                        <div className={`w-10 h-10 ${awardStyle.color} rounded-full flex items-center justify-center text-xl`}>
                          {awardStyle.emoji}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                            {award.name}
                          </h4>
                          {award.abbreviation && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {award.abbreviation}
                            </p>
                          )}
                          {award.dateReceived && (
                            <p className="text-xs text-gray-400">
                              {formatDate(award.dateReceived)}
                            </p>
                          )}
                        </div>
                        {award.isCombat && (
                          <Swords className="w-4 h-4 text-red-500" title="Combat Award" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
          
          {/* Fetch from VA button if authenticated but no VA data yet */}
          {isAuthenticated && !vaHistory && displayData && (
            <div className="text-center pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={fetchVaHistory}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Sync Official VA Records
              </button>
              <p className="text-xs text-gray-500 mt-2">
                Replace self-reported data with official VA.gov records
              </p>
            </div>
          )}
          
          {/* Raw Data Toggle */}
          {vaHistory && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowRawData(!showRawData)}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <FileText className="w-4 h-4" />
                {showRawData ? 'Hide' : 'Show'} Raw VA Data
              </button>
              {showRawData && (
                <pre className="mt-2 p-4 bg-gray-100 dark:bg-gray-900 rounded-lg text-xs overflow-x-auto max-h-60">
                  {JSON.stringify(vaHistory, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ReportBugLink onReportBug={onReportBug} toolName="Ribbon Rack" />
              <BuyMeCoffee />
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RibbonRack;
