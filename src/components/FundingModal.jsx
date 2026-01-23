import React, { useState } from 'react';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import { useColorSchemas } from '../hooks/useColorSchemas';

/**
 * FundingModal - Modal with multiple ways to support Vet-Rate.org
 * Shows context-specific development stats when provided
 * Features humorous messaging about Luna (treats) and Midnight (hardware upgrades)
 * @param {boolean} show - Whether to show the modal
 * @param {function} onClose - Callback when modal is closed
 * @param {object} componentStats - Optional stats about the component { name, hours, lines, description }
 */
function FundingModal({ show, onClose, componentStats = null }) {
  // Lock body scroll when modal is open
  useBodyScrollLock(show);
  
  // Get color schemas
  const { getModalClasses, getColorClass, colors } = useColorSchemas();
  const modalClasses = getModalClasses();
  
  // Track which fun message to show
  const [showLunaMessage, setShowLunaMessage] = useState(false);
  const [showMidnightMessage, setShowMidnightMessage] = useState(false);

  if (!show) return null;

  // Luna's purr-sonal treat fund messages (first paw account!)
  const lunaMessages = [
    "*Meow!* I've been testing this code with my paws for MONTHS! Every donation = extra Churu for me! 😻",
    "*purrrr* My wish list: More treats, more catnip, and a comfy spot to supervise dad's coding sessions! 🐾",
    "Listen human, I PERSONALLY inspect every keystroke. $5-10 keeps my quality control standards high! 😸",
    "*meow meow* I promise to walk across the keyboard LESS... if there are treats involved. Maybe. No guarantees. 😹",
    "*purrrr* Fun fact: I've knocked over dad's coffee 47 times while he built this. I deserve treats for that dedication! ☕😼",
  ];
  
  // Midnight's upgrade fund messages  
  const midnightMessages = [
    "Midnight dreams of: AMD Ryzen 9 9950X3D (a new brain!) and RTX 5090 (another heart!) 🖥️",
    "Midnight: 'I've compiled 100K+ lines of code! I deserve a 9950X3D brain transplant!' 💻",
    "Help Midnight grow: 5090 graphics = faster AI, 9950X3D = more veteran tools built! 🚀",
    "Midnight's upgrade fund: Because 128GB RAM is 'just barely enough' for development 😅",
  ];

  const fundingOptions = [
    {
      name: 'Buy Me a Coffee',
      url: 'https://buymeacoffee.com/vetrate',
      icon: '☕',
      color: 'bg-yellow-400 hover:bg-yellow-500',
      textColor: 'text-gray-900 dark:text-gray-900',
      descColor: 'text-yellow-900 dark:text-yellow-900',
      description: 'vet-rate.org'
    },
    {
      name: 'PayPal',
      url: 'https://paypal.me/ajohnsonnow',
      icon: '💳',
      color: 'bg-blue-600 hover:bg-blue-700',
      textColor: 'text-white dark:text-white',
      descColor: 'text-blue-100 dark:text-blue-100',
      description: 'ajohnsonnow'
    },
    {
      name: 'Cash App',
      url: 'https://cash.app/$ajnow',
      icon: '💵',
      color: 'bg-green-600 hover:bg-green-700',
      textColor: 'text-white dark:text-white',
      descColor: 'text-green-100 dark:text-green-100',
      description: '$ajnow'
    },
    {
      name: 'Venmo',
      url: 'https://venmo.com/ajnow',
      icon: '📱',
      color: 'bg-sky-600 hover:bg-sky-700',
      textColor: 'text-white dark:text-white',
      descColor: 'text-sky-100 dark:text-sky-100',
      description: '@ajnow'
    }
  ];

  return (
    <div 
      className={modalClasses.backdrop}
      onClick={onClose}
    >
      <div 
        className={`${modalClasses.content} max-w-md p-6`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className={`absolute top-3 right-3 ${getColorClass(colors.text.tertiary)} hover:${getColorClass(colors.text.secondary)} transition-colors`}
          aria-label="Close"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Header - Luna's Funding Headquarters */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <img 
              src="/images/ReadyForHerCloseup.jpg" 
              alt="Luna - Chief Treat Officer"
              className="w-16 h-16 rounded-full object-cover border-4 border-va-gold shadow-lg"
            />
          </div>
          <h2 className={`text-2xl font-bold mb-2 ${getColorClass(colors.text.primary)}`}>
            😸 Luna's Treat Fund
          </h2>
          
          {/* Component-specific stats */}
          {componentStats && (
            <div className={`rounded-lg p-3 mb-3 border ${getColorClass(colors.status.info.bg)} ${getColorClass(colors.status.info.border)}`}>
              <p className={`text-sm font-bold mb-1 ${getColorClass(colors.text.primary)}`}>
                {componentStats.name}
              </p>
              <div className={`flex justify-center gap-4 text-xs ${getColorClass(colors.text.tertiary)}`}>
                <div>
                  <span className="font-semibold">⏱️ {componentStats.hours} hrs</span> to build
                </div>
                <div>
                  <span className="font-semibold">📝 {componentStats.lines.toLocaleString()} lines</span> of code
                </div>
              </div>
              {componentStats.description && (
                <p className={`text-xs mt-2 italic ${getColorClass(colors.text.secondary)}`}>
                  {componentStats.description}
                </p>
              )}
            </div>
          )}
          
          <p className={`text-sm ${getColorClass(colors.text.secondary)}`}>
            *Meow!* Luna promises: 100% goes to keeping this free for veterans (and treats for me).
            No ads, no tracking, no data selling - just a cat helping vets help vets! *purrrr* 🐾
          </p>
        </div>

        {/* Funding Options */}
        <div className="space-y-3">
          {fundingOptions.map((option) => (
            <a
              key={option.name}
              href={option.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-4 w-full p-3 rounded-lg ${option.color} ${option.textColor} font-semibold transition-all hover:scale-[1.02] hover:shadow-lg`}
            >
              <span className="text-2xl">{option.icon}</span>
              <div className="flex-1 text-left">
                <div className="font-bold">{option.name}</div>
                <div className={`text-xs font-medium ${option.descColor}`}>{option.description}</div>
              </div>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          ))}
        </div>
        
        {/* Fun Dev Team Funding Goals */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className={`text-xs text-center mb-2 ${getColorClass(colors.text.muted)}`}>
            Where does your support go?
          </p>
          <div className="flex justify-center gap-4">
            {/* Luna's Treat Fund */}
            <button
              onClick={() => { setShowLunaMessage(!showLunaMessage); setShowMidnightMessage(false); }}
              className="flex flex-col items-center p-2 rounded-lg hover:bg-pink-50 dark:hover:bg-pink-900/20 transition-colors group"
              title="Luna's Treat Fund"
            >
              <span className="text-2xl group-hover:animate-bounce">🐱</span>
              <span className="text-xs text-pink-600 dark:text-pink-400 font-medium">Luna's Treats</span>
            </button>
            
            {/* Midnight's Upgrade Fund */}
            <button
              onClick={() => { setShowMidnightMessage(!showMidnightMessage); setShowLunaMessage(false); }}
              className="flex flex-col items-center p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group"
              title="Midnight's Upgrade Fund"
            >
              <span className="text-2xl group-hover:animate-pulse">🖥️</span>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Midnight Upgrades</span>
            </button>
          </div>
          
          {/* Luna Message */}
          {showLunaMessage && (
            <div className="mt-3 p-3 bg-pink-50 dark:bg-pink-900/30 rounded-lg border border-pink-200 dark:border-pink-800 animate-fade-in">
              <p className="text-xs text-pink-700 dark:text-pink-300 text-center">
                {lunaMessages[Math.floor(Math.random() * lunaMessages.length)]}
              </p>
            </div>
          )}
          
          {/* Midnight Message */}
          {showMidnightMessage && (
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800 animate-fade-in">
              <p className="text-xs text-blue-700 dark:text-blue-300 text-center">
                {midnightMessages[Math.floor(Math.random() * midnightMessages.length)]}
              </p>
            </div>
          )}
        </div>

        {/* Luna's purr-sonal thank you */}
        <p className={`text-center text-xs mt-4 ${getColorClass(colors.text.muted)}`}>
          *Purrrr* Thank you for supporting veteran-built tools (and Luna's treat fund)! 😸💚
        </p>
      </div>
    </div>
  );
}

export default FundingModal;
