import React, { useState, useEffect } from 'react';
import FundingModal from './FundingModal';

/**
 * BuyMeCoffee - Contextual funding request that appears after valuable actions
 * Links donation asks to specific accomplishments to increase relevance
 * @param {boolean} show - Whether to show the popup
 * @param {string} trigger - What action triggered this (search, secondary-scout, cap-sim, packet, pdf, save, nexus)
 * @param {object} context - Additional context about the action (e.g., { conditionName, count, action })
 * @param {function} onDismiss - Optional callback when dismissed
 */
function BuyMeCoffee({ show, trigger = 'search', context = {}, onDismiss }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showFundingModal, setShowFundingModal] = useState(false);
  const [sessionDismissCount, setSessionDismissCount] = useState(0);

  // Show with a slight delay for better UX
  useEffect(() => {
    if (show && !isDismissed) {
      // Longer delay if user has dismissed before this session
      const delay = sessionDismissCount > 0 ? 5000 : 2000;
      const timer = setTimeout(() => setIsVisible(true), delay);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [show, isDismissed, sessionDismissCount]);

  // Reset dismissed state when trigger changes (new action)
  useEffect(() => {
    setIsDismissed(false);
  }, [trigger]);

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    setSessionDismissCount(prev => prev + 1);
    if (onDismiss) onDismiss();
  };

  if (!isVisible) return null;

  // Contextual, action-linked messages that celebrate what the user accomplished
  const messages = {
    'search': {
      headline: "You found it! 🎯",
      body: context.count 
        ? `${context.count} results found${context.query ? ` for "${context.query}"` : ''}. That info would've taken hours to find. This tool stays free because vets pay it forward.`
        : "That rating info would've taken hours to dig up. This tool stays free because vets like you pay it forward.",
      cta: "Keep It Free",
      icon: "🔍"
    },
    'secondary-scout': {
      headline: "Secondary claims unlocked! 💡",
      body: context.count 
        ? `You just discovered ${context.count} potential secondary conditions. A claims consultant charges $100+ for this research.`
        : "You just uncovered potential secondary claims. A consultant charges $100+ for this same research.",
      cta: "Worth a Coffee?",
      icon: "🎖️"
    },
    'cap-sim': {
      headline: "You're C&P ready! 📋",
      body: context.conditionName
        ? `You're prepped for your ${context.conditionName} exam${context.rating ? ` (potential ${context.rating}%)` : ''}. Walking in prepared could mean hundreds more per month.`
        : "Walking into your exam prepared could mean hundreds more per month. Help the next veteran find this tool.",
      cta: "Pay It Forward",
      icon: "✅"
    },
    'cap-sim-complete': {
      headline: "Simulation complete! 🏆",
      body: context.rating 
        ? `You practiced for a potential ${context.rating}% rating${context.conditionName ? ` for ${context.conditionName}` : ''}. Knowledge is power - help another vet get prepared.`
        : "You just completed exam prep that most vets never get. Share the mission.",
      cta: "Back a Fellow Vet",
      icon: "🎯"
    },
    'packet': {
      headline: "Your packet is building! 📁",
      body: context.count 
        ? `${context.count} claim${context.count > 1 ? 's' : ''} organized and ready. No VSO fees, no lawyer cuts, no data sold - just vets helping vets.`
        : "No VSO fees. No lawyer cuts. No data sold. Just one vet helping another organize their claim.",
      cta: "Support the Mission",
      icon: "📦"
    },
    'pdf': {
      headline: "PDF downloaded! 📄",
      body: context.conditionName 
        ? `Your ${context.conditionName} guide is ready. These comprehensive reports take real resources to create and host.`
        : "Your VA guide is ready. Generating and hosting these reports isn't free - but using them is.",
      cta: "Help Keep It Free",
      icon: "📥"
    },
    'save': {
      headline: "Saved to your packet! ✅",
      body: "Your claim evidence is organized and ready. This tool runs on veteran support, not ads or data sales.",
      cta: "Chip In",
      icon: "💾"
    },
    'nexus': {
      headline: "Nexus letter drafted! 📝",
      body: context.conditionName
        ? `Your ${context.conditionName} statement is ready. That template would cost $50-100 from a service.`
        : "That template would cost $50-100 from a service. Your support helps keep this free for every veteran.",
      cta: "Worth It?",
      icon: "✍️"
    },
    'export': {
      headline: "Backup created! 💾",
      body: context.count
        ? `${context.count} claim${context.count > 1 ? 's' : ''} safely backed up. No cloud fees, no subscriptions - just veteran-built privacy.`
        : "Your claim data is safe. No cloud fees, no subscriptions - just a veteran-built tool that respects your privacy.",
      cta: "Back the Builder",
      icon: "☁️"
    },
    'terminology': {
      headline: "Speaking VA now! 📖",
      body: context.term
        ? `Now you know what "${context.term}" really means. This glossary took hundreds of hours to compile.`
        : "Using the right language gets you the rating you earned. This glossary took hundreds of hours to compile.",
      cta: "Appreciate It?",
      icon: "🗣️"
    }
  };

  const msg = messages[trigger] || messages['search'];

  return (
    <>
      <div className="fixed bottom-4 right-4 z-50 animate-fade-in max-w-[calc(100vw-2rem)] sm:max-w-xs">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-4 border border-va-gold/30 dark:border-va-gold/20 relative">
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute -top-2 -right-2 bg-gray-100 dark:bg-gray-700 rounded-full p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition shadow-md"
            aria-label="Dismiss"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>

          {/* Headline with icon */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{msg.icon}</span>
            <span className="font-bold text-gray-900 dark:text-white text-sm">{msg.headline}</span>
          </div>

          <div className="flex items-start gap-3">
            {/* Developer photo */}
            <img 
              src="/images/Anth.jpg" 
              alt="Anthony - Vet-Rate Developer"
              className="w-12 h-12 rounded-full object-cover flex-shrink-0 border-2 border-va-gold shadow-sm"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                {msg.body}
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setShowFundingModal(true)}
            className="mt-3 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-va-gold to-yellow-400 hover:from-yellow-400 hover:to-va-gold text-va-blue text-sm font-bold py-2 px-4 rounded-lg transition-all w-full shadow-md hover:shadow-lg hover:scale-[1.02]"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
            </svg>
            {msg.cta}
          </button>
          
          {/* Subtle reassurance */}
          <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center mt-2">
            100% goes to hosting & development
          </p>
        </div>
      </div>
      
      {/* Funding Modal */}
      <FundingModal show={showFundingModal} onClose={() => setShowFundingModal(false)} />
    </>
  );
}

export default BuyMeCoffee;
