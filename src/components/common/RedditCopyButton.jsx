/**
 * Vet-Rate.org - RedditCopyButton Component
 * "The Squared Away Standard" - One-click Reddit formatting
 * 
 * A reusable button that copies AI responses with:
 * - Auto-linked CFR citations (clickable on Reddit)
 * - PERSEC auto-redaction of dates/PII
 * - Proper Reddit markdown formatting
 * 
 * @author Vet-Rate.org Development Team
 * @version 1.0.0
 */

import React, { useState } from 'react';
import { useRedditClipboard } from '../../hooks/useRedditClipboard';

/**
 * RedditCopyButton - Copy text formatted for Reddit
 * 
 * @param {Object} props
 * @param {string} props.textContent - The text to copy
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.sanitize - Enable PERSEC redaction (default: true)
 * @param {boolean} props.linkCitations - Enable auto-linking CFR (default: true)
 * @param {boolean} props.showOptions - Show toggle options for sanitize/link (default: false)
 * @param {string} props.variant - Button style: 'default' | 'compact' | 'icon-only'
 * @param {boolean} props.glow - Add glow effect (e.g., when summary was explicitly requested)
 */
const RedditCopyButton = ({ 
  textContent, 
  className = "",
  sanitize = true,
  linkCitations = true,
  showOptions = false,
  variant = 'default',
  glow = false
}) => {
  const { isCopied, copyToClipboard } = useRedditClipboard();
  const [localSanitize, setLocalSanitize] = useState(sanitize);
  const [localLinkCitations, setLocalLinkCitations] = useState(linkCitations);

  const handleCopy = () => {
    copyToClipboard(textContent, { 
      sanitize: localSanitize, 
      linkCitations: localLinkCitations 
    });
  };

  // Reddit brand orange
  const redditOrange = '#FF4500';
  const redditOrangeHover = '#FF5714';

  // Base button styles
  const baseStyles = `
    flex items-center gap-2 rounded-md font-bold uppercase tracking-wider transition-all
    ${isCopied 
      ? 'bg-green-600 text-white cursor-default' 
      : `bg-[${redditOrange}] hover:bg-[${redditOrangeHover}] text-white shadow-sm`
    }
    ${glow && !isCopied ? 'ring-2 ring-orange-500 ring-opacity-75 animate-pulse' : ''}
  `;

  // Variant-specific styles
  const variantStyles = {
    default: 'px-4 py-2 text-sm',
    compact: 'px-3 py-1.5 text-xs',
    'icon-only': 'p-2'
  };

  // Reddit Alien SVG Icon
  const RedditIcon = () => (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
    </svg>
  );

  // Checkmark Icon
  const CheckIcon = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );

  return (
    <div className={`inline-flex flex-col gap-2 ${className}`}>
      {/* Options toggles (if enabled) */}
      {showOptions && (
        <div className="flex gap-4 text-xs text-gray-400">
          <label className="flex items-center gap-1 cursor-pointer hover:text-gray-300">
            <input 
              type="checkbox" 
              checked={localSanitize}
              onChange={(e) => setLocalSanitize(e.target.checked)}
              className="w-3 h-3 rounded"
            />
            <span>PERSEC Shield</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer hover:text-gray-300">
            <input 
              type="checkbox" 
              checked={localLinkCitations}
              onChange={(e) => setLocalLinkCitations(e.target.checked)}
              className="w-3 h-3 rounded"
            />
            <span>Auto-Link CFR</span>
          </label>
        </div>
      )}

      {/* The Button */}
      <button
        onClick={handleCopy}
        disabled={!textContent}
        className={`${baseStyles} ${variantStyles[variant]} ${!textContent ? 'opacity-50 cursor-not-allowed' : ''}`}
        style={{ 
          backgroundColor: isCopied ? undefined : redditOrange,
        }}
        title={isCopied ? 'Copied!' : 'Copy formatted for Reddit (with linked citations)'}
      >
        {isCopied ? (
          <>
            <CheckIcon />
            {variant !== 'icon-only' && 'Copied!'}
          </>
        ) : (
          <>
            <RedditIcon />
            {variant !== 'icon-only' && (variant === 'compact' ? 'Reddit' : 'Copy for Reddit')}
          </>
        )}
      </button>
    </div>
  );
};

export default RedditCopyButton;
