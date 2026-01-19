/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See COPYRIGHT.js for full license terms.
 */

/**
 * WHAT'S NEW MODAL - "The Briefing"
 * 
 * Shows changelog after an update.
 * Only appears once per version.
 */

import React from 'react';
import { X, Sparkles, CheckCircle, Wrench, Shield, Zap } from 'lucide-react';

const WhatsNewModal = ({ changelog, version, onClose }) => {
  // Icon mapping for different update types
  const getIcon = (type) => {
    switch (type) {
      case 'feature':
        return <Sparkles className="w-5 h-5 text-green-600" />;
      case 'fix':
        return <Wrench className="w-5 h-5 text-blue-600" />;
      case 'security':
        return <Shield className="w-5 h-5 text-red-600" />;
      case 'improvement':
        return <Zap className="w-5 h-5 text-yellow-600" />;
      default:
        return <CheckCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  const getTypeLabel = (type) => {
    const labels = {
      feature: 'New Feature',
      fix: 'Bug Fix',
      security: 'Security',
      improvement: 'Improvement',
      change: 'Change'
    };
    return labels[type] || 'Update';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-lg">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-6 h-6" />
                <h2 className="text-2xl font-bold">What's New</h2>
              </div>
              <p className="text-blue-100">Version {version}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Changelog Content */}
        <div className="p-6">
          {changelog && changelog.length > 0 ? (
            <div className="space-y-4">
              {changelog.map((item, index) => (
                <div 
                  key={index}
                  className="flex gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getIcon(item.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        {getTypeLabel(item.type)}
                      </span>
                    </div>
                    <p className="text-gray-900 font-medium mb-1">
                      {item.title}
                    </p>
                    {item.description && (
                      <p className="text-sm text-gray-600">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No changelog available for this version.</p>
            </div>
          )}

          {/* Footer Message */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>💪 Mission Ready:</strong> Your app has been updated and is ready to continue serving you. 
              All your saved data has been preserved.
            </p>
          </div>

          {/* Action Button */}
          <div className="mt-6 text-center">
            <button
              onClick={onClose}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Great, Let's Get to Work! 🎯
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsNewModal;
