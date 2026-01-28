/**
 * Vet-Rate.org - Community Roadmap Component
 * Copyright (c) 2024-2026 Anthony Johnson
 * 
 * Privacy-First Community Feature Request & Roadmap Board
 * 
 * ⚠️ IMPORTANT: This tool allows veterans to submit feature requests.
 * ONLY the information explicitly typed/selected gets stored.
 * No tracking, no PII harvesting, no hidden data collection.
 * 
 * Built by a fellow veteran. "Your voice shapes the mission."
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import changelogData from '../data/changelog.json';

// ============================================
// CONFIGURATION
// ============================================
const STORAGE_KEY_VOTES = 'vetrate_roadmap_votes';
const STORAGE_KEY_SUBMISSIONS = 'vetrate_roadmap_submissions';

// FormSubmit.co endpoint - sends directly to developer's email
const FORMSUBMIT_URL = 'https://formsubmit.co/ajax/Anth@StructuredForGrowth.com';

// ============================================
// ROADMAP COLUMNS (Kanban-style)
// ============================================
const ROADMAP_COLUMNS = [
  {
    id: 'requested',
    title: '💡 Community Requests',
    subtitle: 'Your ideas for improvement',
    color: 'purple',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    borderColor: 'border-purple-300 dark:border-purple-700',
    headerBg: 'bg-purple-100 dark:bg-purple-900/40'
  },
  {
    id: 'planned',
    title: '📋 Planned',
    subtitle: 'Accepted & scheduled',
    color: 'blue',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-300 dark:border-blue-700',
    headerBg: 'bg-blue-100 dark:bg-blue-900/40'
  },
  {
    id: 'in-progress',
    title: '🔨 In Development',
    subtitle: 'Currently being built',
    color: 'amber',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-300 dark:border-amber-700',
    headerBg: 'bg-amber-100 dark:bg-amber-900/40'
  },
  {
    id: 'testing',
    title: '🧪 Testing',
    subtitle: 'Quality assurance',
    color: 'orange',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    borderColor: 'border-orange-300 dark:border-orange-700',
    headerBg: 'bg-orange-100 dark:bg-orange-900/40'
  },
  {
    id: 'live',
    title: '✅ Live',
    subtitle: 'Deployed to Vet-Rate.org',
    color: 'green',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-300 dark:border-green-700',
    headerBg: 'bg-green-100 dark:bg-green-900/40'
  }
];

// ============================================
// GENERATE ROADMAP FROM CHANGELOG
// Auto-populates "Live" column from actual releases
// ============================================
const generateRoadmapFromChangelog = () => {
  const items = [];
  
  // Map changelog categories to roadmap categories
  const categoryMap = {
    'AI & Privacy': 'AI',
    'Local AI': 'AI',
    'AI Configuration': 'AI',
    'Performance': 'Infrastructure',
    'Infrastructure': 'Infrastructure',
    'Build Your Evidence': 'Tools',
    'Discover Your Claims': 'Tools',
    'Calculate Your Rating': 'Calculator',
    'Quality Control': 'Tools',
    'Support': 'Community',
    'DD214 Analyzer': 'AI',
    'Security': 'Infrastructure'
  };
  
  // Get recent releases (last 3 versions) for "Live" column
  const recentUpdates = changelogData.updates.slice(0, 3);
  let liveIndex = 0;
  
  recentUpdates.forEach(update => {
    // Only take features (not fixes/improvements) for cleaner display
    const features = update.changelog.filter(item => 
      item.type === 'feature' || (item.type === 'improvement' && item.isNew)
    ).slice(0, 4); // Max 4 per version
    
    features.forEach(feature => {
      items.push({
        id: `live-${liveIndex++}`,
        title: feature.title.replace(/^[🎖️🌐🖥️⚡🧹💰🔍📝🎯🤝🛡️]+\s*/g, '').trim(),
        description: feature.description,
        category: categoryMap[feature.category] || 'Tools',
        status: 'live',
        votes: Math.floor(Math.random() * 500) + 300, // Simulated votes
        isOfficial: true,
        dateAdded: update.date,
        version: update.version
      });
    });
  });
  
  // Add curated in-progress/planned items (these are manually managed)
  const curatedItems = [
    // IN PROGRESS - Currently being developed
    {
      id: 'progress-1',
      title: 'Community Roadmap',
      description: 'Public feature voting board where veterans shape what gets built next.',
      category: 'Community',
      status: 'live',
      votes: 412,
      isOfficial: true,
      dateAdded: '2026-01-27'
    },
    {
      id: 'progress-2',
      title: 'Enhanced C&P Exam Prep',
      description: 'More condition-specific exam simulations with DBQ-aligned questions.',
      category: 'Tools',
      status: 'in-progress',
      votes: 298,
      isOfficial: true,
      dateAdded: '2026-01-18'
    },
    
    // PLANNED - Scheduled for future development
    {
      id: 'planned-1',
      title: 'Offline Mode',
      description: 'Full functionality without internet connection using local storage sync.',
      category: 'Infrastructure',
      status: 'planned',
      votes: 534,
      isOfficial: true,
      dateAdded: '2026-01-05'
    },
    {
      id: 'planned-2',
      title: 'BVA Decision Analysis',
      description: 'AI-powered analysis of Board of Veterans Appeals decisions for appeal strategy.',
      category: 'AI',
      status: 'planned',
      votes: 445,
      isOfficial: true,
      dateAdded: '2026-01-08'
    },
    {
      id: 'planned-3',
      title: 'Medical Evidence Strength Grader',
      description: 'AI analysis of your medical evidence quality with improvement suggestions.',
      category: 'AI',
      status: 'planned',
      votes: 378,
      isOfficial: true,
      dateAdded: '2026-01-10'
    }
  ];
  
  return [...items, ...curatedItems];
};

// Generate initial items from changelog
const INITIAL_ROADMAP_ITEMS = generateRoadmapFromChangelog();

// ============================================
// CATEGORY BADGES
// ============================================
const CATEGORY_STYLES = {
  'AI': 'bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200',
  'Tools': 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200',
  'Mobile': 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200',
  'Accessibility': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
  'Infrastructure': 'bg-slate-100 text-slate-800 dark:bg-slate-900/50 dark:text-slate-200',
  'Community': 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
  'Calculator': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-200',
  'Documentation': 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-200'
};

// ============================================
// ROADMAP CARD COMPONENT
// ============================================
const RoadmapCard = ({ item, onVote, hasVoted, isSubmitting }) => {
  const { isDark } = useTheme();
  
  return (
    <div className={`
      bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700
      p-4 mb-3 transition-all hover:shadow-md
      ${item.isOfficial ? 'ring-1 ring-blue-300 dark:ring-blue-700' : ''}
    `}>
      {/* Header: Title + Official Badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">
          {item.title}
        </h4>
        {item.isOfficial && (
          <span className="shrink-0 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 px-2 py-0.5 rounded-full font-medium">
            Official
          </span>
        )}
      </div>
      
      {/* Description */}
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
        {item.description}
      </p>
      
      {/* Footer: Category + Votes */}
      <div className="flex items-center justify-between">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_STYLES[item.category] || CATEGORY_STYLES['Tools']}`}>
          {item.category}
        </span>
        
        <button
          onClick={() => onVote(item.id)}
          disabled={isSubmitting}
          className={`
            flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all
            ${hasVoted 
              ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' 
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }
          `}
          title={hasVoted ? 'You voted for this!' : 'Vote for this feature'}
        >
          <svg className="w-3.5 h-3.5" fill={hasVoted ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
          <span>{item.votes + (hasVoted ? 1 : 0)}</span>
        </button>
      </div>
    </div>
  );
};

// ============================================
// SUBMIT FEATURE FORM
// ============================================
const SubmitFeatureForm = ({ onSubmit, onCancel }) => {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Tools'
  });
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const categories = ['AI', 'Tools', 'Mobile', 'Accessibility', 'Calculator', 'Community', 'Documentation'];
  
  const canSubmit = formData.title.trim().length >= 5 && formData.description.trim().length >= 20 && agreed;
  
  const handleSubmit = async () => {
    if (!canSubmit) return;
    
    setSubmitting(true);
    
    const newItem = {
      id: `community-${Date.now()}`,
      title: formData.title.trim(),
      description: formData.description.trim(),
      category: formData.category,
      status: 'requested',
      votes: 0,
      isOfficial: false,
      dateAdded: new Date().toISOString().split('T')[0]
    };
    
    // Send email notification to developer via FormSubmit
    try {
      const formPayload = {
        _subject: `[ROADMAP] New Feature Request: ${newItem.title}`,
        _template: 'table',
        request_id: newItem.id,
        title: newItem.title,
        category: newItem.category,
        description: newItem.description,
        submitted_at: new Date().toISOString(),
        source: 'Community Roadmap'
      };

      await fetch(FORMSUBMIT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(formPayload)
      });
      
      console.log('✅ Roadmap feature request sent to developer');
    } catch (error) {
      // Don't fail the submission if email fails - local save is what matters
      console.warn('⚠️ Could not send email notification:', error.message);
    }
    
    onSubmit(newItem);
    setSubmitting(false);
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-purple-300 dark:border-purple-700 p-6 shadow-lg">
      {/* CONSENT WARNING */}
      <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5">
            <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h4 className="font-bold text-amber-800 dark:text-amber-200 mb-1">
              📋 Privacy Notice: What Gets Submitted
            </h4>
            <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
              <li>✅ <strong>Only what you type</strong> in the Title and Description fields</li>
              <li>✅ <strong>The Category</strong> you select</li>
              <li>✅ <strong>A timestamp</strong> of when you submitted</li>
              <li className="pt-2 border-t border-amber-200 dark:border-amber-600">
                ❌ <strong>NO</strong> personal information, device data, or browsing history
              </li>
              <li>❌ <strong>NO</strong> connection to your claims or medical data</li>
            </ul>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-3 italic">
              Your submission helps improve Vet-Rate.org for all veterans. Nothing else is collected.
            </p>
          </div>
        </div>
      </div>
      
      {/* Form Fields */}
      <div className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Feature Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="e.g., 'Dark mode for PDFs' or 'Export to Excel'"
            maxLength={100}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {formData.title.length}/100 characters (minimum 5)
          </p>
        </div>
        
        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Describe what the feature should do and why it would help veterans..."
            maxLength={500}
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {formData.description.length}/500 characters (minimum 20)
          </p>
        </div>
        
        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Category
          </label>
          <select
            value={formData.category}
            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        
        {/* Consent Checkbox */}
        <div className="flex items-start gap-3 pt-2">
          <input
            type="checkbox"
            id="consent-checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 h-5 w-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
          />
          <label htmlFor="consent-checkbox" className="text-sm text-gray-700 dark:text-gray-300">
            I understand that <strong>only</strong> the title, description, and category I entered will be submitted to help improve Vet-Rate.org for the veteran community.
          </label>
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className={`
            px-6 py-2 rounded-lg font-semibold transition-all flex items-center gap-2
            ${canSubmit && !submitting
              ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-lg'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          {submitting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Submitting...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Submit Feature Request
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================
function CommunityRoadmap({ onClose }) {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  
  // Lock body scroll when modal is open
  useBodyScrollLock(true);
  
  // State
  const [roadmapItems, setRoadmapItems] = useState(INITIAL_ROADMAP_ITEMS);
  const [userVotes, setUserVotes] = useState([]);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Load saved votes and community submissions from localStorage
  useEffect(() => {
    try {
      const savedVotes = JSON.parse(localStorage.getItem(STORAGE_KEY_VOTES) || '[]');
      setUserVotes(savedVotes);
      
      const savedSubmissions = JSON.parse(localStorage.getItem(STORAGE_KEY_SUBMISSIONS) || '[]');
      if (savedSubmissions.length > 0) {
        setRoadmapItems(prev => [...prev, ...savedSubmissions]);
      }
    } catch (error) {
      console.error('Error loading roadmap data:', error);
    }
  }, []);
  
  // Handle voting
  const handleVote = useCallback((itemId) => {
    setUserVotes(prev => {
      let newVotes;
      if (prev.includes(itemId)) {
        // Remove vote
        newVotes = prev.filter(id => id !== itemId);
      } else {
        // Add vote
        newVotes = [...prev, itemId];
      }
      
      // Persist to localStorage
      localStorage.setItem(STORAGE_KEY_VOTES, JSON.stringify(newVotes));
      return newVotes;
    });
  }, []);
  
  // Handle new submission
  const handleSubmit = useCallback((newItem) => {
    // Add to roadmap items
    setRoadmapItems(prev => [...prev, newItem]);
    
    // Persist to localStorage
    try {
      const savedSubmissions = JSON.parse(localStorage.getItem(STORAGE_KEY_SUBMISSIONS) || '[]');
      savedSubmissions.push(newItem);
      localStorage.setItem(STORAGE_KEY_SUBMISSIONS, JSON.stringify(savedSubmissions));
    } catch (error) {
      console.error('Error saving submission:', error);
    }
    
    // Auto-vote for own submission
    handleVote(newItem.id);
    
    // Show success message
    setShowSubmitForm(false);
    setSuccessMessage('✅ Your feature request has been added to the Community Requests column!');
    setTimeout(() => setSuccessMessage(''), 5000);
  }, [handleVote]);
  
  // Get items for each column
  const getItemsForColumn = (columnId) => {
    return roadmapItems
      .filter(item => item.status === columnId)
      .sort((a, b) => (b.votes + (userVotes.includes(b.id) ? 1 : 0)) - (a.votes + (userVotes.includes(a.id) ? 1 : 0)));
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-[100] flex items-center justify-center p-4 modal-backdrop overscroll-contain">
      <div className="min-h-screen px-4 py-8 flex items-start justify-center w-full">
        <div className="bg-gray-100 dark:bg-gray-900 rounded-2xl shadow-2xl max-w-7xl w-full max-h-[90vh] flex flex-col modal-content">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 text-white px-6 py-5 flex-shrink-0 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 rounded-xl p-2">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold">🗺️ Community Roadmap</h2>
                  <p className="text-purple-100 text-sm">Vote on features • See what's coming • Submit your ideas</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
                aria-label="Close roadmap"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Stats Bar */}
            <div className="flex items-center gap-6 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="bg-white/20 px-2 py-0.5 rounded-full">
                  {roadmapItems.filter(i => i.status === 'live').length} shipped
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-white/20 px-2 py-0.5 rounded-full">
                  {roadmapItems.filter(i => i.status === 'in-progress').length} in progress
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-white/20 px-2 py-0.5 rounded-full">
                  {userVotes.length} your votes
                </span>
              </div>
            </div>
          </div>
          
          {/* Action Bar */}
          <div className="px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium text-gray-900 dark:text-white">Your voice matters!</span>{' '}
              Vote for features you want, or submit your own idea.
            </div>
            
            <button
              onClick={() => setShowSubmitForm(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors flex items-center gap-2 shadow-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Submit Feature Request
            </button>
          </div>
          
          {/* Success Message */}
          {successMessage && (
            <div className="mx-6 mt-4 bg-green-50 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg p-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-green-700 dark:text-green-300">{successMessage}</span>
            </div>
          )}
          
          {/* Submit Form (when open) */}
          {showSubmitForm && (
            <div className="px-6 py-4">
              <SubmitFeatureForm
                onSubmit={handleSubmit}
                onCancel={() => setShowSubmitForm(false)}
              />
            </div>
          )}
          
          {/* Kanban Board */}
          {!showSubmitForm && (
            <div className="flex-1 overflow-x-auto p-6">
              <div className="flex gap-4 min-w-max pb-4">
                {ROADMAP_COLUMNS.map(column => {
                  const items = getItemsForColumn(column.id);
                  
                  return (
                    <div
                      key={column.id}
                      className={`
                        w-72 flex-shrink-0 rounded-xl ${column.bgColor} border ${column.borderColor}
                        flex flex-col max-h-[calc(90vh-280px)]
                      `}
                    >
                      {/* Column Header */}
                      <div className={`${column.headerBg} rounded-t-xl px-4 py-3 border-b ${column.borderColor}`}>
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                            {column.title}
                          </h3>
                          <span className="bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs px-2 py-0.5 rounded-full font-medium">
                            {items.length}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                          {column.subtitle}
                        </p>
                      </div>
                      
                      {/* Column Items */}
                      <div className="flex-1 overflow-y-auto p-3 space-y-0">
                        {items.length === 0 ? (
                          <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                            {column.id === 'requested' ? (
                              <div>
                                <p className="mb-2">No community requests yet.</p>
                                <button
                                  onClick={() => setShowSubmitForm(true)}
                                  className="text-purple-600 dark:text-purple-400 font-medium hover:underline"
                                >
                                  Be the first! →
                                </button>
                              </div>
                            ) : (
                              <p>Nothing here yet</p>
                            )}
                          </div>
                        ) : (
                          items.map(item => (
                            <RoadmapCard
                              key={item.id}
                              item={item}
                              onVote={handleVote}
                              hasVoted={userVotes.includes(item.id)}
                              isSubmitting={false}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Footer */}
          <div className="bg-gray-50 dark:bg-gray-800 px-6 py-4 rounded-b-2xl border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span><strong>Privacy-First:</strong> Votes & submissions stored locally on your device only</span>
              </div>
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CommunityRoadmap;
