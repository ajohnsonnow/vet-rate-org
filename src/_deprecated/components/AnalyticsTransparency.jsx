/**
 * Analytics Transparency Widget
 * =============================
 * Shows users exactly what data is collected and displays live visitor stats.
 * 
 * GoatCounter is privacy-first analytics:
 * - No cookies
 * - No personal data
 * - GDPR compliant by design
 * - Open source
 */

import React, { useState, useEffect } from 'react';
import { Eye, Shield, Globe, Clock, Monitor, MapPin, ExternalLink, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import BRAND from '../config/branding';

// GoatCounter public stats endpoint (uses brand config)
const STATS_URL = BRAND.goatCounterUrl;

/**
 * What GoatCounter collects (and what it DOESN'T)
 */
const DATA_COLLECTED = [
  { 
    icon: Globe, 
    label: 'Page URL', 
    description: 'Which page you visited',
    example: '/calculator',
    collected: true
  },
  { 
    icon: Monitor, 
    label: 'Screen Size', 
    description: 'General screen dimensions',
    example: '1920×1080',
    collected: true
  },
  { 
    icon: Globe, 
    label: 'Browser Type', 
    description: 'Which browser you use',
    example: 'Chrome, Firefox, Safari',
    collected: true
  },
  { 
    icon: MapPin, 
    label: 'Country (rough)', 
    description: 'Approximate country from IP',
    example: 'United States',
    collected: true
  },
  { 
    icon: Clock, 
    label: 'Referrer', 
    description: 'Where you came from',
    example: 'google.com, reddit.com',
    collected: true
  },
];

const DATA_NOT_COLLECTED = [
  { label: 'Your IP address', reason: 'Never stored or logged' },
  { label: 'Cookies', reason: 'GoatCounter uses no cookies' },
  { label: 'Personal information', reason: 'No names, emails, or identifiers' },
  { label: 'Tracking across sites', reason: 'No cross-site tracking' },
  { label: 'Fingerprinting', reason: 'No browser fingerprinting' },
  { label: 'Location (precise)', reason: 'Only country-level, not city/address' },
];

/**
 * Fetch live stats from GoatCounter's public JSON API
 */
const fetchGoatCounterStats = async () => {
  try {
    // GoatCounter provides a public JSON endpoint for basic stats
    // Format: https://SITE.goatcounter.com/counter/PAGE.json
    // For total stats, we can check the public dashboard
    
    // Note: GoatCounter's API requires authentication for detailed stats
    // But we can show a link to the public dashboard
    return {
      available: true,
      dashboardUrl: STATS_URL,
      message: 'View live stats on our public dashboard'
    };
  } catch (error) {
    console.error('Failed to fetch GoatCounter stats:', error);
    return { available: false, error: error.message };
  }
};

/**
 * Analytics Transparency Component
 */
function AnalyticsTransparency({ compact = false }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const loadStats = async () => {
    setLoading(true);
    const data = await fetchGoatCounterStats();
    setStats(data);
    setLoading(false);
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (compact) {
    // Minimal inline version
    return (
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm">
        <div className="flex items-center gap-2 text-green-800 dark:text-green-300">
          <Shield className="h-4 w-4" />
          <span className="font-medium">Privacy-First Analytics</span>
          <span className="text-green-600 dark:text-green-400">• No cookies • No tracking • No personal data</span>
        </div>
        <a 
          href={STATS_URL} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-xs text-green-600 dark:text-green-400 hover:underline flex items-center gap-1 mt-1"
        >
          View public stats <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-full p-2">
              <Eye className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Analytics Transparency</h3>
              <p className="text-sm text-green-100">See exactly what we collect</p>
            </div>
          </div>
          <a
            href={STATS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <span>View Live Stats</span>
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* What We Collect */}
        <div className="mb-6">
          <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            What We Collect (Anonymous)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {DATA_COLLECTED.map((item, idx) => (
              <div 
                key={idx}
                className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full p-2 flex-shrink-0">
                  <item.icon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="font-medium text-gray-900 dark:text-white text-sm">{item.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{item.description}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    e.g., <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">{item.example}</code>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* What We DON'T Collect */}
        <div className="mb-6">
          <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-500" />
            What We NEVER Collect
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {DATA_NOT_COLLECTED.map((item, idx) => (
              <div 
                key={idx}
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
              >
                <span className="text-red-500">✗</span>
                <span className="font-medium">{item.label}</span>
                <span className="text-xs text-gray-400">- {item.reason}</span>
              </div>
            ))}
          </div>
        </div>

        {/* GoatCounter Info */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl">🐐</div>
            <div>
              <h4 className="font-bold text-blue-900 dark:text-blue-200">Powered by GoatCounter</h4>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                We use <a href="https://www.goatcounter.com" target="_blank" rel="noopener noreferrer" className="underline">GoatCounter</a>, 
                an open-source, privacy-friendly analytics platform. It's GDPR compliant by design - 
                no consent banners needed because we don't track you.
              </p>
              <div className="flex flex-wrap gap-3 mt-3">
                <a
                  href="https://www.goatcounter.com/help/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  GoatCounter Privacy Policy <ExternalLink className="h-3 w-3" />
                </a>
                <a
                  href={STATS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  Our Public Dashboard <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Live Stats Preview */}
        {stats?.available && (
          <div className="mt-6 text-center">
            <a
              href={stats.dashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl"
            >
              <Eye className="h-5 w-5" />
              View Live Visitor Stats
              <ExternalLink className="h-4 w-4" />
            </a>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Our stats are 100% public - see exactly what we see
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          <Shield className="h-3 w-3 inline mr-1" />
          {BRAND.appName} is committed to veteran privacy. Your data stays on YOUR device. 
          Analytics help us improve the site - nothing more.
        </p>
      </div>
    </div>
  );
}

export default AnalyticsTransparency;
