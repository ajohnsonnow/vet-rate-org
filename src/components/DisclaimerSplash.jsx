import React, { useState, useEffect } from 'react';
import { Shield, Lock, UserCheck, Sparkles, ExternalLink } from 'lucide-react';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';

function DisclaimerSplash({ onAcknowledge }) {
  const [isVisible, setIsVisible] = useState(false);

  // Lock body scroll when modal is visible
  useBodyScrollLock(isVisible);

  useEffect(() => {
    // Check if user has already acknowledged
    const hasAcknowledged = localStorage.getItem('vetrate-disclaimer-acknowledged');
    if (!hasAcknowledged) {
      setIsVisible(true);
    } else {
      onAcknowledge?.();
    }
  }, [onAcknowledge]);

  const handleAcknowledge = () => {
    localStorage.setItem('vetrate-disclaimer-acknowledged', 'true');
    setIsVisible(false);
    onAcknowledge?.();
  };

  if (!isVisible) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gradient-to-br from-va-blue/95 to-green-900/95 backdrop-blur-sm modal-backdrop overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby="splash-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] overflow-y-auto modal-content overscroll-contain">
        {/* Header - Warm Welcome */}
        <div className="bg-gradient-to-r from-va-blue to-green-800 dark:from-gray-700 dark:to-gray-800 p-6 text-center">
          <div className="inline-flex items-center justify-center bg-white rounded-full p-1 mb-4 overflow-hidden">
            <img 
              src="/images/Vet-Rate-org-logo-official.png" 
              alt="Vet-Rate.org Logo" 
              className="h-20 w-20 object-cover rounded-full"
            />
          </div>
          <h1 id="splash-title" className="text-2xl md:text-3xl font-bold text-white mb-2">
            Welcome, Fellow Veteran 🎖️
          </h1>
          <p className="text-green-100 text-lg">
            Your complete VA claims toolkit — built by one of your own
          </p>
        </div>

        {/* Content */}
        <div className="p-6 md:p-8">
          {/* Personal Message */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <p className="text-blue-800 dark:text-blue-200 text-sm leading-relaxed">
              <span className="font-semibold">From one veteran to another:</span> I built this toolkit because 
              navigating the VA disability system shouldn't feel like another deployment. Here you'll find <strong>748 rated conditions</strong> with 
              official criteria, secondary condition discovery, C&P exam prep, and evidence-building tools — all free, no tricks, no sales pitches.
            </p>
            <p className="text-blue-600 dark:text-blue-100 text-xs mt-2 italic">
              - A fellow service-disabled veteran
            </p>
          </div>

          {/* Trust Signals */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div className="flex flex-col items-center text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <Lock className="h-6 w-6 text-green-600 dark:text-green-400 mb-2" />
              <span className="text-xs font-medium text-green-800 dark:text-green-200">No Login Required</span>
              <span className="text-xs text-green-600 dark:text-green-400">Your privacy matters</span>
            </div>
            <div className="flex flex-col items-center text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <Sparkles className="h-6 w-6 text-green-600 dark:text-green-400 mb-2" />
              <span className="text-xs font-medium text-green-800 dark:text-green-200">100% Free</span>
              <span className="text-xs text-green-600 dark:text-green-400">No hidden fees ever</span>
            </div>
            <div className="flex flex-col items-center text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <Shield className="h-6 w-6 text-green-600 dark:text-green-400 mb-2" />
              <span className="text-xs font-medium text-green-800 dark:text-green-200">No Data Sold</span>
              <span className="text-xs text-green-600 dark:text-green-400">You're not tracked</span>
            </div>
          </div>

          {/* What You Can Do Here */}
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
              Your Claims Toolkit Includes
            </h2>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span><strong>748 conditions</strong> with official VA rating criteria from 38 CFR Part 4</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span><strong>Secondary Scout</strong> — discover linked conditions to maximize your rating</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span><strong>C&P Exam Simulator</strong> — practice with DBQ-aligned questions</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span><strong>Forms Helper</strong> — guided buddy statements & VA form assistance</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span><strong>My Packet</strong> — organize your evidence and track your claims</span>
              </li>
            </ul>
          </div>

          {/* Important Note - Softened */}
          <div className="bg-gray-100 dark:bg-gray-700/50 rounded-lg p-4 mb-6 text-sm">
            <p className="text-gray-600 dark:text-gray-300">
              <span className="font-medium">Quick note:</span> This is an educational resource, not a VSO or law firm. 
              For official claims assistance, your local <a href="https://www.va.gov/vso/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline">VSO</a> is 
              a great free resource.
            </p>
          </div>

          {/* Acknowledge Button */}
          <button
            onClick={handleAcknowledge}
            className="w-full bg-gradient-to-r from-va-blue to-green-700 hover:from-green-700 hover:to-va-blue text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg hover:shadow-xl text-lg"
          >
            Enter Vet-Rate.org
          </button>

          <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-4">
            Thank you for your service. Let's get you the information you deserve.
          </p>
        </div>
      </div>
    </div>
  );
}

export default DisclaimerSplash;
