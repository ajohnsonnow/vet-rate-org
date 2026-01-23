import React, { useState, useCallback, useMemo } from 'react';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import ReportBugLink from './ReportBugLink';
import BuyMeCoffee from './BuyMeCoffee';

/**
 * EvidenceImporter Component - "The Wearable Data Bridge"
 * 
 * WHY: For claims like Sleep Apnea, Tachycardia, PTSD (anxiety), and Migraines,
 * OBJECTIVE DATA from wearables is irrefutable evidence. 
 * 
 * "My Fitbit shows I averaged 43 minutes of deep sleep for 6 months" 
 * is infinitely more powerful than "I don't sleep well."
 * 
 * SUPPORTED FORMATS:
 * - Apple Health Export (CSV)
 * - Fitbit Export (CSV/JSON)
 * - Garmin Connect Export (CSV)
 * - Samsung Health Export (CSV)
 * - Generic CSV with date/value columns
 * 
 * DATA TYPES RELEVANT TO VA CLAIMS:
 * - Heart Rate / HRV (anxiety, PTSD, cardiac conditions)
 * - Sleep stages (Sleep Apnea, insomnia)
 * - Steps/Activity (mobility issues)
 * - Blood Oxygen (Sleep Apnea, respiratory)
 * 
 * 100% CLIENT-SIDE: All parsing happens in the browser.
 */

// Known data types and their claim relevance
const DATA_TYPES = {
  heartRate: {
    label: 'Heart Rate',
    emoji: '❤️',
    unit: 'bpm',
    claimRelevance: [
      'Tachycardia (7010)',
      'Arrhythmia',
      'PTSD/Anxiety (panic attacks)',
      'Cardiac conditions',
    ],
    ratingTip: 'Sustained elevated resting HR (>100 bpm) or spikes during panic attacks support higher ratings.',
  },
  hrv: {
    label: 'Heart Rate Variability',
    emoji: '📈',
    unit: 'ms',
    claimRelevance: [
      'PTSD/Anxiety',
      'Autonomic dysfunction',
      'Stress-related conditions',
    ],
    ratingTip: 'Low HRV is associated with chronic stress, anxiety, and PTSD. Lower numbers = worse condition.',
  },
  sleepDuration: {
    label: 'Sleep Duration',
    emoji: '😴',
    unit: 'hours',
    claimRelevance: [
      'Sleep Apnea (6847)',
      'Insomnia (9499)',
      'PTSD (9411)',
      'Chronic Fatigue',
    ],
    ratingTip: 'Consistently fragmented or short sleep supports sleep disorder claims.',
  },
  sleepStages: {
    label: 'Sleep Stages (Deep/REM)',
    emoji: '🌙',
    unit: 'minutes',
    claimRelevance: [
      'Sleep Apnea (6847)',
      'Insomnia',
      'PTSD (nightmares)',
    ],
    ratingTip: 'Low deep sleep % is classic for Sleep Apnea. Frequent waking = poor sleep quality.',
  },
  bloodOxygen: {
    label: 'Blood Oxygen (SpO2)',
    emoji: '🫁',
    unit: '%',
    claimRelevance: [
      'Sleep Apnea (6847)',
      'Respiratory conditions',
      'COPD',
    ],
    ratingTip: 'SpO2 drops below 90% during sleep are strong evidence of Sleep Apnea.',
  },
  steps: {
    label: 'Steps / Activity',
    emoji: '🚶',
    unit: 'steps',
    claimRelevance: [
      'Knee/Hip conditions',
      'Back conditions',
      'Fatigue/CFS',
      'TDIU (unable to work)',
    ],
    ratingTip: 'Dramatic decrease in activity over time shows functional decline.',
  },
};

// CSV parsers for different sources
const PARSERS = {
  appleHealth: {
    name: 'Apple Health',
    logo: '🍎',
    detect: (headers) => headers.includes('sourceName') && headers.includes('type'),
    parse: (data, headers) => {
      const typeIndex = headers.indexOf('type');
      const valueIndex = headers.indexOf('value');
      const startIndex = headers.indexOf('startDate');
      const endIndex = headers.indexOf('endDate');
      
      return data.map(row => ({
        type: mapAppleHealthType(row[typeIndex]),
        value: parseFloat(row[valueIndex]) || 0,
        date: row[startIndex] || row[endIndex],
        source: 'Apple Health',
      })).filter(r => r.type);
    },
  },
  fitbit: {
    name: 'Fitbit',
    logo: '⌚',
    detect: (headers) => headers.some(h => h.toLowerCase().includes('fitbit') || h === 'Activities'),
    parse: (data, headers) => {
      // Fitbit exports vary, handle common formats
      const results = [];
      data.forEach(row => {
        const dateCol = headers.find(h => h.toLowerCase().includes('date'));
        const dateIdx = dateCol ? headers.indexOf(dateCol) : 0;
        
        headers.forEach((header, idx) => {
          const type = mapFitbitType(header);
          if (type && row[idx]) {
            results.push({
              type,
              value: parseFloat(row[idx]) || 0,
              date: row[dateIdx],
              source: 'Fitbit',
            });
          }
        });
      });
      return results;
    },
  },
  garmin: {
    name: 'Garmin',
    logo: '🔺',
    detect: (headers) => headers.some(h => h.toLowerCase().includes('garmin') || h === 'Activity Type'),
    parse: (data, headers) => {
      const results = [];
      data.forEach(row => {
        const dateCol = headers.find(h => h.toLowerCase().includes('date') || h === 'Date');
        const dateIdx = dateCol ? headers.indexOf(dateCol) : 0;
        
        headers.forEach((header, idx) => {
          const type = mapGarminType(header);
          if (type && row[idx]) {
            results.push({
              type,
              value: parseFloat(row[idx]) || 0,
              date: row[dateIdx],
              source: 'Garmin',
            });
          }
        });
      });
      return results;
    },
  },
  generic: {
    name: 'Generic CSV',
    logo: '📄',
    detect: () => true, // Fallback
    parse: (data, headers) => {
      const results = [];
      const dateIdx = headers.findIndex(h => 
        h.toLowerCase().includes('date') || h.toLowerCase().includes('time')
      );
      
      headers.forEach((header, idx) => {
        if (idx === dateIdx) return;
        const type = guessDataType(header);
        if (type) {
          data.forEach(row => {
            if (row[idx] && !isNaN(parseFloat(row[idx]))) {
              results.push({
                type,
                value: parseFloat(row[idx]),
                date: dateIdx >= 0 ? row[dateIdx] : new Date().toISOString(),
                source: 'CSV Import',
              });
            }
          });
        }
      });
      return results;
    },
  },
};

// Type mapping functions
function mapAppleHealthType(appleType) {
  const mappings = {
    'HKQuantityTypeIdentifierHeartRate': 'heartRate',
    'HKQuantityTypeIdentifierHeartRateVariabilitySDNN': 'hrv',
    'HKQuantityTypeIdentifierStepCount': 'steps',
    'HKQuantityTypeIdentifierOxygenSaturation': 'bloodOxygen',
    'HKCategoryTypeIdentifierSleepAnalysis': 'sleepDuration',
  };
  return mappings[appleType] || null;
}

function mapFitbitType(header) {
  const h = header.toLowerCase();
  if (h.includes('heart') && h.includes('rate')) return 'heartRate';
  if (h.includes('steps')) return 'steps';
  if (h.includes('sleep')) return 'sleepDuration';
  if (h.includes('spo2') || h.includes('oxygen')) return 'bloodOxygen';
  return null;
}

function mapGarminType(header) {
  const h = header.toLowerCase();
  if (h.includes('heart') || h.includes('hr')) return 'heartRate';
  if (h.includes('step')) return 'steps';
  if (h.includes('sleep')) return 'sleepDuration';
  if (h.includes('spo2') || h.includes('pulse ox')) return 'bloodOxygen';
  if (h.includes('hrv') || h.includes('variability')) return 'hrv';
  return null;
}

function guessDataType(header) {
  const h = header.toLowerCase();
  if (h.includes('heart') || h.includes('pulse') || h === 'hr' || h === 'bpm') return 'heartRate';
  if (h.includes('step')) return 'steps';
  if (h.includes('sleep')) return 'sleepDuration';
  if (h.includes('oxygen') || h.includes('spo2') || h.includes('o2')) return 'bloodOxygen';
  if (h.includes('hrv') || h.includes('variability')) return 'hrv';
  return null;
}

// Parse CSV text into array of arrays
function parseCSV(text) {
  const lines = text.trim().split('\n');
  return lines.map(line => {
    const result = [];
    let cell = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(cell.trim());
        cell = '';
      } else {
        cell += char;
      }
    }
    result.push(cell.trim());
    return result;
  });
}

const EvidenceImporter = ({ onClose, onImport, symptomType, onReportBug }) => {
  useBodyScrollLock(true);
  
  const [dragActive, setDragActive] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [detectedSource, setDetectedSource] = useState(null);
  const [showHelp, setShowHelp] = useState(false);

  // Handle file drop
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const processFile = useCallback((file) => {
    setParseError(null);
    setParsedData(null);

    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      setParseError('Please drop in a CSV file. JSON support coming soon!');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const rows = parseCSV(text);
        
        if (rows.length < 2) {
          setParseError('File appears to be empty or has no data rows.');
          return;
        }

        const headers = rows[0];
        const data = rows.slice(1);

        // Detect source
        let parser = null;
        for (const [key, p] of Object.entries(PARSERS)) {
          if (p.detect(headers)) {
            parser = p;
            setDetectedSource(key);
            break;
          }
        }

        if (!parser) {
          parser = PARSERS.generic;
          setDetectedSource('generic');
        }

        // Parse data
        const parsed = parser.parse(data, headers);
        
        if (parsed.length === 0) {
          setParseError('Could not find any health data in this file. Make sure it contains columns for date and measurements like heart rate, steps, or sleep.');
          return;
        }

        // Group by type and calculate stats
        const grouped = {};
        parsed.forEach(item => {
          if (!grouped[item.type]) {
            grouped[item.type] = [];
          }
          grouped[item.type].push(item);
        });

        const stats = Object.entries(grouped).map(([type, items]) => {
          const values = items.map(i => i.value).filter(v => !isNaN(v));
          const dates = items.map(i => new Date(i.date)).filter(d => !isNaN(d));
          
          return {
            type,
            count: items.length,
            min: Math.min(...values),
            max: Math.max(...values),
            avg: values.reduce((a, b) => a + b, 0) / values.length,
            startDate: dates.length > 0 ? new Date(Math.min(...dates)) : null,
            endDate: dates.length > 0 ? new Date(Math.max(...dates)) : null,
            items,
          };
        });

        setParsedData({
          source: parser.name,
          totalRecords: parsed.length,
          stats,
          raw: parsed,
        });

        // Auto-select relevant types
        setSelectedTypes(stats.map(s => s.type));

      } catch (err) {
        console.error('Parse error:', err);
        setParseError(`Failed to parse file: ${err.message}`);
      }
    };

    reader.onerror = () => {
      setParseError('Failed to read file. Please try again.');
    };

    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, [processFile]);

  const handleFileInput = useCallback((e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  }, [processFile]);

  const handleImport = () => {
    if (!parsedData || selectedTypes.length === 0) return;

    // Filter data to selected types
    const filteredStats = parsedData.stats.filter(s => selectedTypes.includes(s.type));
    
    onImport({
      source: parsedData.source,
      importedAt: new Date().toISOString(),
      stats: filteredStats,
      totalRecords: filteredStats.reduce((sum, s) => sum + s.count, 0),
    });
    
    onClose();
  };

  const toggleType = (type) => {
    setSelectedTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 modal-backdrop overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby="evidence-importer-title"
    >
      <div className="min-h-screen px-4 py-8 flex items-start justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
          {/* Header - Sticky */}
          <div className="bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 text-white px-6 py-6 rounded-t-lg relative overflow-hidden flex-shrink-0">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            
            <div className="relative flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                  <span className="text-3xl">⌚</span>
                </div>
                <div>
                  <h2 id="evidence-importer-title" className="text-2xl sm:text-3xl font-bold">
                    Evidence Importer <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded align-middle">BETA</span>
                  </h2>
                  <p className="text-cyan-100 text-sm sm:text-base mt-1">
                    Import Wearable Health Data • Turn Data into Evidence
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onReportBug && <ReportBugLink onClick={onReportBug} variant="light" moduleName="Evidence Importer" />}
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

          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            {/* Why This Matters */}
            <div className="bg-gradient-to-r from-cyan-50 to-teal-50 dark:from-cyan-900/30 dark:to-teal-900/30 border border-cyan-200 dark:border-cyan-700 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">💡</span>
                <div>
                  <h3 className="font-bold text-cyan-800 dark:text-cyan-200">Why Import Wearable Data?</h3>
                  <p className="text-sm text-cyan-700 dark:text-cyan-300 mt-1">
                    <strong>"My Fitbit shows I averaged 43 minutes of deep sleep"</strong> is irrefutable evidence. 
                    Wearable data provides <strong>objective, timestamped proof</strong> of your symptoms-something 
                    the VA cannot dismiss as "subjective complaints."
                  </p>
                </div>
              </div>
            </div>

            {/* Help Toggle */}
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <span>{showHelp ? '▼' : '▶'}</span>
              <span>How do I export my health data?</span>
            </button>

            {showHelp && (
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-4 text-sm">
                <div>
                  <h4 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    🍎 Apple Health
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Health App → Your Profile (top right) → Export All Health Data → Unzip and find the .csv files
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    ⌚ Fitbit
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    <a href="https://www.fitbit.com/settings/data/export" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                      fitbit.com/settings/data/export
                    </a> → Request your data → Download and unzip
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    🔺 Garmin
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Garmin Connect → Settings → Account Information → Export Your Data
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    📱 Samsung Health
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Samsung Health App → Settings → Download personal data
                  </p>
                </div>
              </div>
            )}

            {/* Drop Zone */}
            {!parsedData && (
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                  dragActive 
                    ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/30' 
                    : 'border-gray-300 dark:border-gray-600 hover:border-cyan-400'
                }`}
              >
                <div className="text-5xl mb-4">📂</div>
                <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                  Drag & drop your health data CSV here
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  Supports Apple Health, Fitbit, Garmin, Samsung Health exports
                </p>
                <div className="mt-4">
                  <label className="inline-block">
                    <span className="px-6 py-3 bg-cyan-600 text-white rounded-lg font-semibold cursor-pointer hover:bg-cyan-700 transition-colors">
                      Or Browse Files
                    </span>
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleFileInput}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Parse Error */}
            {parseError && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl">❌</span>
                  <div>
                    <h4 className="font-bold text-red-800 dark:text-red-200">Import Error</h4>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">{parseError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Parsed Data Preview */}
            {parsedData && (
              <div className="space-y-4">
                {/* Source Badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{PARSERS[detectedSource]?.logo || '📄'}</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      Detected: {parsedData.source}
                    </span>
                    <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs font-bold rounded-full">
                      {parsedData.totalRecords.toLocaleString()} records
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setParsedData(null);
                      setParseError(null);
                    }}
                    className="text-sm text-gray-500 hover:text-red-500"
                  >
                    Clear & Try Again
                  </button>
                </div>

                {/* Data Type Cards */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Select data types to import:
                  </p>
                  
                  {parsedData.stats.map(stat => {
                    const typeInfo = DATA_TYPES[stat.type];
                    if (!typeInfo) return null;
                    
                    const isSelected = selectedTypes.includes(stat.type);
                    
                    return (
                      <div
                        key={stat.type}
                        onClick={() => toggleType(stat.type)}
                        className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                          isSelected
                            ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/30'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-5 h-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                            />
                            <span className="text-2xl">{typeInfo.emoji}</span>
                            <div>
                              <h4 className="font-bold text-gray-800 dark:text-gray-200">
                                {typeInfo.label}
                              </h4>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {stat.count.toLocaleString()} data points
                              </p>
                            </div>
                          </div>
                          
                          <div className="text-right text-sm">
                            <div className="text-gray-600 dark:text-gray-400">
                              Range: <strong>{stat.min.toFixed(1)} - {stat.max.toFixed(1)}</strong> {typeInfo.unit}
                            </div>
                            <div className="text-gray-500 dark:text-gray-500">
                              Avg: <strong>{stat.avg.toFixed(1)}</strong> {typeInfo.unit}
                            </div>
                          </div>
                        </div>
                        
                        {/* Date Range */}
                        {stat.startDate && stat.endDate && (
                          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            📅 {stat.startDate.toLocaleDateString()} - {stat.endDate.toLocaleDateString()}
                          </div>
                        )}
                        
                        {/* Claim Relevance */}
                        {isSelected && (
                          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                              🎯 Relevant to these claims:
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {typeInfo.claimRelevance.map((claim, idx) => (
                                <span 
                                  key={idx}
                                  className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs rounded-full"
                                >
                                  {claim}
                                </span>
                              ))}
                            </div>
                            <p className="mt-2 text-xs text-green-700 dark:text-green-400 italic">
                              💡 {typeInfo.ratingTip}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Import Button */}
                <button
                  onClick={handleImport}
                  disabled={selectedTypes.length === 0}
                  className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <span>📊</span>
                  <span>Import {selectedTypes.length} Data Type{selectedTypes.length !== 1 ? 's' : ''}</span>
                </button>
              </div>
            )}

            {/* Privacy Note */}
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <span>🔒</span>
                <p className="text-xs text-green-700 dark:text-green-300">
                  <strong>100% Private:</strong> Your health data is processed entirely in your browser. 
                  Nothing is uploaded to any server. This data never leaves your device.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-b-lg">
            <div className="flex items-center justify-between">
              <BuyMeCoffee show={true} trigger="evidence-importer" />
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EvidenceImporter;
