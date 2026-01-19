/**
 * EvidenceTimeline - Visual Continuity Tracker
 * "The Continuity Thread" - Shows the nexus timeline and identifies dangerous evidence gaps
 * 
 * The Problem: Text is bad at showing time. Veterans don't see gaps until it's too late.
 * The Solution: Visual timeline with automatic gap analysis and risk warnings
 */

import React, { useState, useEffect, useRef } from 'react';
import { FocusToggle } from '../contexts/FocusModeContext';

const EvidenceTimeline = ({ events = [], onEventsUpdate, onClose }) => {
  const [timelineEvents, setTimelineEvents] = useState(events);
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({
    type: 'service',
    date: '',
    description: '',
    category: 'Service Event'
  });
  const [gaps, setGaps] = useState([]);
  const canvasRef = useRef(null);

  // Event categories with their visual styles
  const EVENT_TYPES = {
    service: { 
      label: 'Service Event', 
      color: '#22c55e', 
      icon: '⭐',
      description: 'Active duty dates, deployments, injuries in service'
    },
    injury: { 
      label: 'Injury/Incident', 
      color: '#ef4444', 
      icon: '💥',
      description: 'When the injury or condition first occurred'
    },
    diagnosis: { 
      label: 'Diagnosis', 
      color: '#3b82f6', 
      icon: '💊',
      description: 'Official medical diagnosis dates'
    },
    treatment: { 
      label: 'Medical Treatment', 
      color: '#8b5cf6', 
      icon: '🏥',
      description: 'Doctor visits, procedures, prescriptions'
    },
    buddy: { 
      label: 'Buddy Statement', 
      color: '#f59e0b', 
      icon: '👥',
      description: 'Witness statements or lay evidence'
    },
    records: { 
      label: 'Medical Records', 
      color: '#06b6d4', 
      icon: '📋',
      description: 'Existing medical documentation'
    },
  };

  useEffect(() => {
    if (timelineEvents.length > 0) {
      detectGaps();
      drawTimeline();
    }
  }, [timelineEvents]);

  const detectGaps = () => {
    if (timelineEvents.length < 2) {
      setGaps([]);
      return;
    }

    // Sort events by date
    const sorted = [...timelineEvents].sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );

    const detectedGaps = [];
    const GAP_THRESHOLD_YEARS = 5;

    for (let i = 0; i < sorted.length - 1; i++) {
      const currentDate = new Date(sorted[i].date);
      const nextDate = new Date(sorted[i + 1].date);
      
      const yearsDiff = (nextDate - currentDate) / (1000 * 60 * 60 * 24 * 365);

      if (yearsDiff >= GAP_THRESHOLD_YEARS) {
        detectedGaps.push({
          start: sorted[i],
          end: sorted[i + 1],
          years: Math.floor(yearsDiff),
          severity: yearsDiff >= 10 ? 'CRITICAL' : 'WARNING'
        });
      }
    }

    setGaps(detectedGaps);
  };

  const drawTimeline = () => {
    const canvas = canvasRef.current;
    if (!canvas || timelineEvents.length === 0) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Sort events by date
    const sorted = [...timelineEvents].sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );

    const firstDate = new Date(sorted[0].date);
    const lastDate = new Date(sorted[sorted.length - 1].date);
    const totalYears = (lastDate - firstDate) / (1000 * 60 * 60 * 24 * 365);

    // Draw main timeline line
    const lineY = height / 2;
    const padding = 50;
    const lineWidth = width - (padding * 2);

    // Draw base line
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(padding, lineY);
    ctx.lineTo(width - padding, lineY);
    ctx.stroke();

    // Draw gap warnings
    gaps.forEach(gap => {
      const gapStartDate = new Date(gap.start.date);
      const gapEndDate = new Date(gap.end.date);
      
      const startX = padding + ((gapStartDate - firstDate) / (lastDate - firstDate)) * lineWidth;
      const endX = padding + ((gapEndDate - firstDate) / (lastDate - firstDate)) * lineWidth;

      // Draw red warning section
      ctx.strokeStyle = gap.severity === 'CRITICAL' ? '#dc2626' : '#f59e0b';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(startX, lineY);
      ctx.lineTo(endX, lineY);
      ctx.stroke();

      // Draw warning label
      ctx.fillStyle = gap.severity === 'CRITICAL' ? '#dc2626' : '#f59e0b';
      ctx.font = '12px monospace';
      ctx.fillText(`⚠️ ${gap.years} YEAR GAP`, (startX + endX) / 2 - 40, lineY - 20);
    });

    // Draw events
    sorted.forEach((event, index) => {
      const eventDate = new Date(event.date);
      const x = padding + ((eventDate - firstDate) / (lastDate - firstDate)) * lineWidth;
      
      // Draw event marker
      const eventColor = EVENT_TYPES[event.type]?.color || '#6b7280';
      ctx.fillStyle = eventColor;
      ctx.beginPath();
      ctx.arc(x, lineY, 8, 0, Math.PI * 2);
      ctx.fill();

      // Draw event border
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw connecting line to label
      const labelY = index % 2 === 0 ? lineY - 60 : lineY + 60;
      ctx.strokeStyle = eventColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(x, lineY + 8);
      ctx.lineTo(x, labelY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw year label
      ctx.fillStyle = '#e5e7eb';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(eventDate.getFullYear(), x, labelY + (index % 2 === 0 ? -5 : 15));
    });

    // Draw start and end labels
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('START', padding - 40, lineY - 20);

    ctx.fillStyle = '#ef4444';
    ctx.textAlign = 'right';
    ctx.fillText('NOW', width - padding + 35, lineY - 20);
  };

  const addEvent = () => {
    if (!newEvent.date || !newEvent.description) {
      alert('Please fill in date and description');
      return;
    }

    const event = {
      ...newEvent,
      id: Date.now(),
      category: EVENT_TYPES[newEvent.type]?.label || 'Event'
    };

    const updated = [...timelineEvents, event];
    setTimelineEvents(updated);
    
    if (onEventsUpdate) {
      onEventsUpdate(updated);
    }

    // Reset form
    setNewEvent({
      type: 'service',
      date: '',
      description: '',
      category: 'Service Event'
    });
    setIsAddingEvent(false);
  };

  const removeEvent = (id) => {
    const updated = timelineEvents.filter(e => e.id !== id);
    setTimelineEvents(updated);
    
    if (onEventsUpdate) {
      onEventsUpdate(updated);
    }
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-slate-600 to-gray-700 p-4 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🧵</span>
            <div>
              <h2 className="text-xl font-bold text-white">🧵 The Continuity Thread - Evidence Timeline</h2>
              <p className="text-sm text-slate-100">Visual nexus timeline with gap detection</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <FocusToggle variant="light" />
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-gray-900 border border-blue-500/30 rounded-lg p-6">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-blue-400 mb-2">
              🧵 The Continuity Thread - Evidence Timeline
            </h2>
            <p className="text-gray-300 text-sm">
              Visualize your nexus. Spot evidence gaps that could sink your claim.
            </p>
          </div>

      {/* Canvas Timeline */}
      {timelineEvents.length > 0 && (
        <div className="mb-6 bg-gray-800 rounded-lg p-4 border border-gray-700">
          <canvas
            ref={canvasRef}
            width={800}
            height={200}
            className="w-full"
            style={{ maxWidth: '100%' }}
          />
        </div>
      )}

      {/* Gap Warnings */}
      {gaps.length > 0 && (
        <div className="mb-6 space-y-3">
          <h3 className="text-xl font-bold text-red-400 flex items-center gap-2">
            ⚠️ Evidence Gaps Detected: {gaps.length}
          </h3>
          {gaps.map((gap, idx) => (
            <div
              key={idx}
              className={`border-l-4 p-4 rounded ${
                gap.severity === 'CRITICAL'
                  ? 'border-red-500 bg-red-900/20'
                  : 'border-yellow-500 bg-yellow-900/20'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className={`font-bold ${
                  gap.severity === 'CRITICAL' ? 'text-red-400' : 'text-yellow-400'
                }`}>
                  {gap.years}-Year Evidence Gap
                </h4>
                <span className={`px-2 py-1 text-xs font-bold rounded ${
                  gap.severity === 'CRITICAL'
                    ? 'bg-red-500 text-white'
                    : 'bg-yellow-500 text-gray-900'
                }`}>
                  {gap.severity}
                </span>
              </div>
              <p className="text-white text-sm mb-2">
                Gap between <span className="font-semibold">{new Date(gap.start.date).getFullYear()}</span> and <span className="font-semibold">{new Date(gap.end.date).getFullYear()}</span>
              </p>
              <p className="text-gray-300 text-xs mb-2">
                <span className="font-semibold">From:</span> {gap.start.description}
              </p>
              <p className="text-gray-300 text-xs mb-3">
                <span className="font-semibold">To:</span> {gap.end.description}
              </p>
              <div className="bg-gray-800 p-2 rounded text-xs text-gray-300">
                <span className="font-semibold text-yellow-400">Recommendation:</span> Fill this gap with buddy statements, medical records, or lay evidence showing continuity of condition.
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Event List */}
      {timelineEvents.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xl font-bold text-blue-400 mb-3">
            📋 Timeline Events ({timelineEvents.length})
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {[...timelineEvents]
              .sort((a, b) => new Date(a.date) - new Date(b.date))
              .map((event) => (
                <div
                  key={event.id}
                  className="bg-gray-800 p-3 rounded border border-gray-700 flex items-start gap-3"
                >
                  <div
                    className="text-2xl flex-shrink-0"
                    title={EVENT_TYPES[event.type]?.label}
                  >
                    {EVENT_TYPES[event.type]?.icon || '📌'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="px-2 py-0.5 text-xs font-semibold rounded"
                        style={{
                          backgroundColor: EVENT_TYPES[event.type]?.color || '#6b7280',
                          color: '#fff'
                        }}
                      >
                        {event.category}
                      </span>
                      <span className="text-gray-400 text-xs">
                        {new Date(event.date).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-white text-sm">{event.description}</p>
                  </div>
                  <button
                    onClick={() => removeEvent(event.id)}
                    className="text-red-400 hover:text-red-300 text-sm flex-shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Add Event Section */}
      {!isAddingEvent ? (
        <button
          onClick={() => setIsAddingEvent(true)}
          className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded transition"
        >
          ➕ Add Timeline Event
        </button>
      ) : (
        <div className="bg-gray-800 border border-blue-500/50 rounded-lg p-4">
          <h4 className="text-blue-400 font-bold mb-4">Add New Event</h4>
          
          {/* Event Type Selector */}
          <div className="mb-4">
            <label className="block text-gray-300 text-sm font-semibold mb-2">
              Event Type:
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Object.entries(EVENT_TYPES).map(([key, info]) => (
                <button
                  key={key}
                  onClick={() => setNewEvent({ ...newEvent, type: key, category: info.label })}
                  className={`p-2 rounded border-2 transition text-left ${
                    newEvent.type === key
                      ? 'border-blue-500 bg-blue-900/30'
                      : 'border-gray-700 bg-gray-700 hover:border-gray-600'
                  }`}
                  title={info.description}
                >
                  <div className="text-lg mb-1">{info.icon}</div>
                  <div className="text-xs text-white font-semibold">{info.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Date Input */}
          <div className="mb-4">
            <label className="block text-gray-300 text-sm font-semibold mb-2">
              Date:
            </label>
            <input
              type="date"
              value={newEvent.date}
              onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Description Input */}
          <div className="mb-4">
            <label className="block text-gray-300 text-sm font-semibold mb-2">
              Description:
            </label>
            <textarea
              value={newEvent.description}
              onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
              placeholder="e.g., 'Deployed to Iraq - Combat Engineer', 'IED blast - TBI diagnosis', 'Started physical therapy for lower back'"
              className="w-full h-20 bg-gray-700 border border-gray-600 rounded p-2 text-white resize-none focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={addEvent}
              className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded transition"
            >
              Add Event
            </button>
            <button
              onClick={() => setIsAddingEvent(false)}
              className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="mt-6 bg-green-900/20 border border-green-500/30 rounded p-4">
        <h4 className="text-green-400 font-bold mb-2">💡 How to Use:</h4>
        <ul className="text-gray-300 text-sm space-y-1">
          <li>• Add key dates from your service and medical history</li>
          <li>• The timeline will automatically detect gaps longer than 5 years</li>
          <li>• <span className="text-red-400 font-semibold">Red sections</span> = Critical gaps (10+ years) - High denial risk</li>
          <li>• <span className="text-yellow-400 font-semibold">Yellow sections</span> = Moderate gaps (5-10 years) - Needs explanation</li>
          <li>• Fill gaps with buddy statements, medical visits, or lay evidence</li>
        </ul>
      </div>

      {/* Export Timeline */}
      {timelineEvents.length > 0 && (
        <button
          onClick={() => {
            const text = timelineEvents
              .sort((a, b) => new Date(a.date) - new Date(b.date))
              .map(e => `${new Date(e.date).toLocaleDateString()} - ${e.category}: ${e.description}`)
              .join('\n');
            
            navigator.clipboard.writeText(text);
            alert('Timeline copied to clipboard!');
          }}
          className="mt-4 w-full py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded transition"
        >
          📋 Copy Timeline to Clipboard
        </button>
      )}
        </div>
      </div>
    </div>
  );
};

export default EvidenceTimeline;
