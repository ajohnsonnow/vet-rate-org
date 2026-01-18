import React, { useState, useEffect, useMemo } from 'react';
import ReportBugLink from './ReportBugLink';
import BuyMeCoffee from './BuyMeCoffee';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import { jsPDF } from 'jspdf';

/**
 * SymptomLogger Component - "The 50% Maker"
 * 
 * WHY: Migraines and IBS are rated on FREQUENCY. 50% migraines need "prostrating attacks 
 * averaging one per month over the last several months."
 * 
 * PROBLEM: At a C&P exam, veterans are asked "How often do you get migraines?" 
 * and they say "Um... I dunno, a lot?" That's not evidence.
 * 
 * THIS FIX: A simple, LOCAL log that tracks:
 * - Date of attack
 * - Severity (1-10)
 * - Duration
 * - Did you have to stop your activity? (Prostrating = yes)
 * 
 * CLIENT-SIDE ONLY: Uses localStorage. No database needed.
 */

const STORAGE_KEY = 'vetrate_symptom_logs';

// Symptom type configurations
const SYMPTOM_TYPES = {
  migraine: {
    label: 'Migraine',
    emoji: '🤕',
    color: 'purple',
    ratingCriteria: [
      { rating: 50, description: 'Prostrating attacks occurring on average once a month' },
      { rating: 30, description: 'Prostrating attacks averaging once every 2 months' },
      { rating: 10, description: 'Prostrating attacks averaging one in 2 months' },
      { rating: 0, description: 'Less frequent attacks' },
    ],
    durationOptions: [
      '< 1 hour',
      '1-4 hours',
      '4-12 hours',
      '12-24 hours',
      '24-48 hours',
      '48+ hours',
    ],
    questions: {
      prostrating: 'Did you have to stop what you were doing?',
      medication: 'Did you take medication?',
      triggers: 'What triggered it?',
    },
  },
  ibs: {
    label: 'IBS Episode',
    emoji: '🚽',
    color: 'blue',
    ratingCriteria: [
      { rating: 30, description: 'Severe; diarrhea or alternating with constipation, with more or less constant abdominal distress' },
      { rating: 10, description: 'Moderate; frequent episodes of bowel disturbance with abdominal distress' },
      { rating: 0, description: 'Mild; disturbances of bowel function with occasional episodes of abdominal distress' },
    ],
    durationOptions: [
      '< 1 hour',
      '1-4 hours',
      '4-12 hours',
      '12-24 hours',
      'All day',
    ],
    questions: {
      prostrating: 'Did it prevent you from working/activities?',
      medication: 'Did you take medication?',
      triggers: 'What triggered it?',
    },
  },
};

const SymptomLogger = ({ onClose, onReportBug }) => {
  useBodyScrollLock(true);
  
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('log'); // 'log', 'history', 'export'
  const [symptomType, setSymptomType] = useState('migraine');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  
  // Form state for new log
  const [newLog, setNewLog] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    severity: 5,
    duration: '',
    prostrating: false,
    medication: false,
    triggers: '',
    notes: '',
  });

  // Load logs from localStorage on mount
  useEffect(() => {
    const savedLogs = localStorage.getItem(STORAGE_KEY);
    if (savedLogs) {
      try {
        setLogs(JSON.parse(savedLogs));
      } catch (e) {
        console.error('Failed to parse symptom logs:', e);
        setLogs([]);
      }
    }
  }, []);

  // Save logs to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  }, [logs]);

  // Calculate statistics
  const stats = useMemo(() => {
    const filteredLogs = logs.filter(log => log.type === symptomType);
    const now = new Date();
    
    // Last 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last30Days = filteredLogs.filter(log => new Date(log.date) >= thirtyDaysAgo);
    
    // Last 90 days
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const last90Days = filteredLogs.filter(log => new Date(log.date) >= ninetyDaysAgo);
    
    // Prostrating attacks
    const prostratingLast30 = last30Days.filter(log => log.prostrating).length;
    const prostratingLast90 = last90Days.filter(log => log.prostrating).length;
    
    // Average severity
    const avgSeverity = last30Days.length > 0
      ? (last30Days.reduce((sum, log) => sum + log.severity, 0) / last30Days.length).toFixed(1)
      : 0;
    
    // Suggested rating based on frequency
    let suggestedRating = 0;
    const avgPerMonth = prostratingLast90 / 3;
    
    if (symptomType === 'migraine') {
      if (avgPerMonth >= 1) suggestedRating = 50;
      else if (avgPerMonth >= 0.5) suggestedRating = 30;
      else if (avgPerMonth > 0) suggestedRating = 10;
    } else if (symptomType === 'ibs') {
      if (prostratingLast30 >= 10) suggestedRating = 30;
      else if (prostratingLast30 >= 4) suggestedRating = 10;
    }
    
    return {
      total: filteredLogs.length,
      last30Days: last30Days.length,
      last90Days: last90Days.length,
      prostratingLast30,
      prostratingLast90,
      avgSeverity,
      avgPerMonth: avgPerMonth.toFixed(1),
      suggestedRating,
    };
  }, [logs, symptomType]);

  const handleAddLog = () => {
    if (!newLog.duration) {
      alert('Please select a duration.');
      return;
    }

    const logEntry = {
      id: Date.now().toString(),
      type: symptomType,
      ...newLog,
      createdAt: new Date().toISOString(),
    };

    setLogs(prev => [logEntry, ...prev]);
    
    // Reset form
    setNewLog({
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5),
      severity: 5,
      duration: '',
      prostrating: false,
      medication: false,
      triggers: '',
      notes: '',
    });
    
    // Switch to history tab to show new entry
    setActiveTab('history');
  };

  const handleDeleteLog = (logId) => {
    setLogs(prev => prev.filter(log => log.id !== logId));
    setShowDeleteConfirm(null);
  };

  const handleExportPDF = () => {
    const config = SYMPTOM_TYPES[symptomType];
    const filteredLogs = logs.filter(log => log.type === symptomType);
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = 20;
    
    // Title
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text(`${config.label} Symptom Log`, margin, y);
    y += 10;
    
    // Subtitle with date range
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleDateString()} | Total Entries: ${filteredLogs.length}`, margin, y);
    y += 15;
    
    // Statistics Box
    doc.setDrawColor(66, 66, 66);
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 45, 3, 3, 'FD');
    y += 8;
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0);
    doc.text('FREQUENCY SUMMARY (VA Rating Evidence)', margin + 5, y);
    y += 8;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`• Prostrating attacks in last 30 days: ${stats.prostratingLast30}`, margin + 5, y);
    y += 6;
    doc.text(`• Prostrating attacks in last 90 days: ${stats.prostratingLast90}`, margin + 5, y);
    y += 6;
    doc.text(`• Average prostrating attacks per month (90-day): ${stats.avgPerMonth}`, margin + 5, y);
    y += 6;
    doc.text(`• Average severity: ${stats.avgSeverity}/10`, margin + 5, y);
    y += 6;
    
    doc.setFont(undefined, 'bold');
    doc.text(`• Suggested VA Rating: ${stats.suggestedRating}%`, margin + 5, y);
    y += 15;
    
    // Rating criteria reference
    doc.setFontSize(9);
    doc.setFont(undefined, 'italic');
    doc.setTextColor(100);
    doc.text(`${config.label} Rating Criteria Reference:`, margin, y);
    y += 5;
    config.ratingCriteria.forEach(criteria => {
      doc.text(`${criteria.rating}%: ${criteria.description}`, margin + 5, y);
      y += 4;
    });
    y += 10;
    
    // Log entries header
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0);
    doc.text('DETAILED LOG ENTRIES', margin, y);
    y += 8;
    
    // Log entries
    doc.setFontSize(9);
    filteredLogs.forEach((log, index) => {
      // Check if we need a new page
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      
      doc.setFont(undefined, 'bold');
      doc.text(`${index + 1}. ${log.date} at ${log.time}`, margin, y);
      y += 5;
      
      doc.setFont(undefined, 'normal');
      doc.text(`   Severity: ${log.severity}/10 | Duration: ${log.duration} | Prostrating: ${log.prostrating ? 'YES' : 'No'}`, margin, y);
      y += 5;
      
      if (log.triggers) {
        doc.text(`   Triggers: ${log.triggers}`, margin, y);
        y += 5;
      }
      
      if (log.notes) {
        const noteLines = doc.splitTextToSize(`   Notes: ${log.notes}`, pageWidth - margin * 2 - 10);
        noteLines.forEach(line => {
          doc.text(line, margin, y);
          y += 4;
        });
      }
      
      y += 5;
    });
    
    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Generated by Vet-Rate.org Symptom Logger', margin, 285);
    doc.text('This log is veteran-generated evidence for VA disability claims.', margin, 289);
    
    // Save PDF
    doc.save(`${symptomType}_log_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const config = SYMPTOM_TYPES[symptomType];
  const colorClasses = {
    purple: {
      bg: 'bg-purple-600',
      bgLight: 'bg-purple-50 dark:bg-purple-900/30',
      border: 'border-purple-200 dark:border-purple-700',
      text: 'text-purple-700 dark:text-purple-300',
    },
    blue: {
      bg: 'bg-blue-600',
      bgLight: 'bg-blue-50 dark:bg-blue-900/30',
      border: 'border-blue-200 dark:border-blue-700',
      text: 'text-blue-700 dark:text-blue-300',
    },
  };
  const colors = colorClasses[config.color];

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="symptom-logger-title"
    >
      <div className="min-h-screen px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl mx-auto">
          {/* Header */}
          <div className={`bg-gradient-to-r ${symptomType === 'migraine' ? 'from-purple-600 via-purple-700 to-indigo-600' : 'from-blue-600 via-blue-700 to-cyan-600'} text-white px-6 py-6 rounded-t-lg relative overflow-hidden`}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            
            <div className="relative flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                  <span className="text-3xl">{config.emoji}</span>
                </div>
                <div>
                  <h2 id="symptom-logger-title" className="text-2xl sm:text-3xl font-bold">
                    Symptom Logger
                  </h2>
                  <p className="text-white/80 text-sm sm:text-base mt-1">
                    The 50% Maker • Track Frequency for VA Ratings
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onReportBug && <ReportBugLink onClick={onReportBug} variant="light" moduleName="Symptom Logger" />}
                <button
                  onClick={onClose}
                  className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Symptom Type Selector */}
          <div className="px-6 py-4 border-b dark:border-gray-700">
            <div className="flex gap-2">
              {Object.entries(SYMPTOM_TYPES).map(([key, typeConfig]) => (
                <button
                  key={key}
                  onClick={() => setSymptomType(key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    symptomType === key
                      ? key === 'migraine'
                        ? 'bg-purple-600 text-white'
                        : 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <span>{typeConfig.emoji}</span>
                  <span>{typeConfig.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="px-6 pt-4 border-b dark:border-gray-700">
            <nav className="flex gap-1">
              {[
                { id: 'log', label: '➕ Log Attack', icon: '📝' },
                { id: 'history', label: `📋 History (${logs.filter(l => l.type === symptomType).length})`, icon: '📋' },
                { id: 'export', label: '📊 Stats & Export', icon: '📊' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-sm font-medium rounded-t-lg transition-colors ${
                    activeTab === tab.id
                      ? `${colors.bg} text-white`
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Log Attack Tab */}
            {activeTab === 'log' && (
              <div className="space-y-6">
                <div className={`p-4 ${colors.bgLight} ${colors.border} border rounded-xl`}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{config.emoji}</span>
                    <div>
                      <h3 className={`font-bold ${colors.text}`}>Why Track Frequency?</h3>
                      <p className={`text-sm ${colors.text} mt-1`}>
                        The VA rates {config.label.toLowerCase()}s on <strong>frequency</strong>, not just severity. 
                        Having a documented log showing "X prostrating attacks per month" is powerful evidence.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Date & Time */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      📅 Date
                    </label>
                    <input
                      type="date"
                      value={newLog.date}
                      onChange={(e) => setNewLog(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      ⏰ Time
                    </label>
                    <input
                      type="time"
                      value={newLog.time}
                      onChange={(e) => setNewLog(prev => ({ ...prev, time: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  {/* Severity */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      💢 Severity: {newLog.severity}/10
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={newLog.severity}
                      onChange={(e) => setNewLog(prev => ({ ...prev, severity: parseInt(e.target.value) }))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>1 - Mild</span>
                      <span>5 - Moderate</span>
                      <span>10 - Severe</span>
                    </div>
                  </div>

                  {/* Duration */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      ⏱️ Duration
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {config.durationOptions.map(option => (
                        <button
                          key={option}
                          onClick={() => setNewLog(prev => ({ ...prev, duration: option }))}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            newLog.duration === option
                              ? `${colors.bg} text-white`
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Prostrating */}
                  <div>
                    <label className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors">
                      <input
                        type="checkbox"
                        checked={newLog.prostrating}
                        onChange={(e) => setNewLog(prev => ({ ...prev, prostrating: e.target.checked }))}
                        className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      <div>
                        <span className="font-medium text-red-800 dark:text-red-200">
                          🛑 {config.questions.prostrating}
                        </span>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                          "Prostrating" = had to stop activities. This is KEY for higher ratings!
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Medication */}
                  <div>
                    <label className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                      <input
                        type="checkbox"
                        checked={newLog.medication}
                        onChange={(e) => setNewLog(prev => ({ ...prev, medication: e.target.checked }))}
                        className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <div>
                        <span className="font-medium text-gray-800 dark:text-gray-200">
                          💊 {config.questions.medication}
                        </span>
                      </div>
                    </label>
                  </div>

                  {/* Triggers */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      ⚡ {config.questions.triggers}
                    </label>
                    <input
                      type="text"
                      value={newLog.triggers}
                      onChange={(e) => setNewLog(prev => ({ ...prev, triggers: e.target.value }))}
                      placeholder="e.g., stress, weather, certain foods, loud noise..."
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  {/* Notes */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      📝 Additional Notes
                    </label>
                    <textarea
                      value={newLog.notes}
                      onChange={(e) => setNewLog(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Describe what happened, impact on your day, etc."
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 resize-none"
                    />
                  </div>
                </div>

                <button
                  onClick={handleAddLog}
                  className={`w-full py-4 ${colors.bg} text-white rounded-lg font-bold text-lg hover:opacity-90 transition-all shadow-lg flex items-center justify-center gap-2`}
                >
                  <span>➕</span>
                  <span>Log This Attack</span>
                </button>
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div className="space-y-4">
                {logs.filter(log => log.type === symptomType).length === 0 ? (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <div className="text-6xl mb-4">{config.emoji}</div>
                    <p className="text-lg font-medium">No entries yet</p>
                    <p className="text-sm mt-2">
                      Start logging your {config.label.toLowerCase()} attacks to build evidence for your claim.
                    </p>
                    <button
                      onClick={() => setActiveTab('log')}
                      className={`mt-4 px-6 py-2 ${colors.bg} text-white rounded-lg font-medium`}
                    >
                      Log Your First Attack
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {logs
                      .filter(log => log.type === symptomType)
                      .map(log => (
                        <div 
                          key={log.id}
                          className={`p-4 ${colors.bgLight} ${colors.border} border rounded-lg`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <span className="text-lg font-bold text-gray-800 dark:text-gray-200">
                                  {new Date(log.date).toLocaleDateString('en-US', { 
                                    weekday: 'short', 
                                    month: 'short', 
                                    day: 'numeric' 
                                  })}
                                </span>
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                  at {log.time}
                                </span>
                                {log.prostrating && (
                                  <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 text-xs font-bold rounded-full">
                                    PROSTRATING
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-4 mt-2 text-sm">
                                <span className={colors.text}>
                                  Severity: <strong>{log.severity}/10</strong>
                                </span>
                                <span className={colors.text}>
                                  Duration: <strong>{log.duration}</strong>
                                </span>
                                {log.medication && (
                                  <span className="text-gray-500 dark:text-gray-400">💊 Medication</span>
                                )}
                              </div>
                              {log.triggers && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                                  <strong>Triggers:</strong> {log.triggers}
                                </p>
                              )}
                              {log.notes && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  <strong>Notes:</strong> {log.notes}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => setShowDeleteConfirm(log.id)}
                              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                              aria-label="Delete entry"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                          
                          {/* Delete Confirmation */}
                          {showDeleteConfirm === log.id && (
                            <div className="mt-3 p-3 bg-red-100 dark:bg-red-900/50 rounded-lg flex items-center justify-between">
                              <span className="text-sm text-red-700 dark:text-red-300">Delete this entry?</span>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleDeleteLog(log.id)}
                                  className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                                >
                                  Delete
                                </button>
                                <button
                                  onClick={() => setShowDeleteConfirm(null)}
                                  className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Stats & Export Tab */}
            {activeTab === 'export' && (
              <div className="space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-gray-800 dark:text-gray-200">
                      {stats.prostratingLast30}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Prostrating<br />Last 30 Days
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-gray-800 dark:text-gray-200">
                      {stats.avgPerMonth}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Avg/Month<br />(90-day)
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-gray-800 dark:text-gray-200">
                      {stats.avgSeverity}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Avg Severity<br />/10
                    </div>
                  </div>
                  <div className={`rounded-xl p-4 text-center ${stats.suggestedRating >= 30 ? 'bg-green-100 dark:bg-green-900/50' : 'bg-gray-50 dark:bg-gray-900'}`}>
                    <div className={`text-3xl font-bold ${stats.suggestedRating >= 30 ? 'text-green-700 dark:text-green-300' : 'text-gray-800 dark:text-gray-200'}`}>
                      {stats.suggestedRating}%
                    </div>
                    <div className={`text-xs mt-1 ${stats.suggestedRating >= 30 ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                      Suggested<br />VA Rating
                    </div>
                  </div>
                </div>

                {/* Rating Criteria Reference */}
                <div className={`p-4 ${colors.bgLight} ${colors.border} border rounded-xl`}>
                  <h4 className={`font-semibold ${colors.text} mb-3`}>
                    📋 VA Rating Criteria for {config.label}
                  </h4>
                  <div className="space-y-2">
                    {config.ratingCriteria.map(criteria => (
                      <div 
                        key={criteria.rating}
                        className={`flex items-center gap-3 p-2 rounded-lg ${
                          stats.suggestedRating === criteria.rating 
                            ? 'bg-white dark:bg-gray-800 border-2 border-green-500'
                            : ''
                        }`}
                      >
                        <span className="w-12 h-12 flex items-center justify-center bg-white dark:bg-gray-800 rounded-lg font-bold text-lg">
                          {criteria.rating}%
                        </span>
                        <span className={`text-sm ${colors.text}`}>{criteria.description}</span>
                        {stats.suggestedRating === criteria.rating && (
                          <span className="ml-auto text-green-600 dark:text-green-400 text-sm font-medium">
                            ← Your Data
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Export Button */}
                <button
                  onClick={handleExportPDF}
                  disabled={logs.filter(l => l.type === symptomType).length === 0}
                  className="w-full py-4 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg font-bold text-lg hover:from-green-700 hover:to-teal-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>📄</span>
                  <span>Export PDF for C&P Exam</span>
                </button>
                <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                  Print this and bring it to your C&P exam as documented frequency evidence
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-b-lg">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <BuyMeCoffee show={logs.length > 0} trigger="symptom-logger" />
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SymptomLogger;
