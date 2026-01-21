import React, { useState, useEffect } from 'react';
import FundingModal from './FundingModal';
import { getComponentStats } from '../utils/componentStats';
import { getStaticFundingMessage, getFundingMessage } from '../utils/fundingMessageGenerator';

/**
 * BuyMeCoffee - Contextual funding request that appears after valuable actions
 * Now AI-powered! When Local AI or Gemini is available, generates personalized,
 * kind messages based on what the user accomplished.
 * 
 * @param {boolean} show - Whether to show the popup
 * @param {string} trigger - What action triggered this (search, secondary-scout, cap-sim, packet, pdf, save, nexus)
 * @param {object} context - Additional context about the action (e.g., { conditionName, count, action })
 * @param {function} onDismiss - Optional callback when dismissed
 * @param {string} componentKey - Optional component key to show development stats in funding modal
 */
function BuyMeCoffee({ show, trigger = 'search', context = {}, onDismiss, componentKey }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showFundingModal, setShowFundingModal] = useState(false);
  const [sessionDismissCount, setSessionDismissCount] = useState(0);
  const [aiMessage, setAiMessage] = useState(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);

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

  // Try to generate AI message when becoming visible
  useEffect(() => {
    if (isVisible && !aiMessage && !isLoadingAI) {
      setIsLoadingAI(true);
      getFundingMessage(trigger, context)
        .then(msg => {
          if (msg.isAI) {
            setAiMessage(msg);
          }
        })
        .catch(() => {})
        .finally(() => setIsLoadingAI(false));
    }
  }, [isVisible, trigger, context]);

  // Reset dismissed state and AI message when trigger changes (new action)
  useEffect(() => {
    setIsDismissed(false);
    setAiMessage(null);
  }, [trigger]);

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    setSessionDismissCount(prev => prev + 1);
    if (onDismiss) onDismiss();
  };

  if (!isVisible) return null;

  // Contextual, action-linked messages that celebrate what the user accomplished
  // Now with $5-10 mentions and AI enhancement when available
  const messages = {
    'search': {
      headline: "You found it! 🎯",
      body: context.count 
        ? `${context.count} results found${context.query ? ` for "${context.query}"` : ''}. That research would've taken hours. A quick $5 or $10 keeps this free for the next vet.`
        : "That rating info would've taken hours to dig up. A $5 or $10 coffee helps keep this tool free.",
      cta: "Keep It Free",
      icon: "🔍"
    },
    'secondary-scout': {
      headline: "Secondary claims unlocked! 💡",
      body: context.count 
        ? `You discovered ${context.count} potential secondary conditions. A consultant charges $100+ for this - if it helped, $5-10 keeps development going.`
        : "You just uncovered potential secondary claims worth $100+ in consultant fees. A $5-10 coffee makes a difference.",
      cta: "Worth a Coffee?",
      icon: "🎖️"
    },
    'cap-sim': {
      headline: "You're C&P ready! 📋",
      body: context.conditionName
        ? `You're prepped for your ${context.conditionName} exam${context.rating ? ` (potential ${context.rating}%)` : ''}. If this helped, $5 or $10 helps the next veteran.`
        : "Walking in prepared could mean hundreds more per month. A $5-10 contribution keeps this free for fellow vets.",
      cta: "Pay It Forward",
      icon: "✅"
    },
    'cap-sim-complete': {
      headline: "Simulation complete! 🏆",
      body: context.rating 
        ? `You practiced for a potential ${context.rating}% rating${context.conditionName ? ` for ${context.conditionName}` : ''}. $5 or $10 helps build more prep tools.`
        : "That's exam prep most vets never get. A coffee-sized donation ($5-10) helps reach more veterans.",
      cta: "Back a Fellow Vet",
      icon: "🎯"
    },
    'packet': {
      headline: "Your packet is building! 📁",
      body: context.count 
        ? `${context.count} claim${context.count > 1 ? 's' : ''} organized. No VSO fees, no lawyer cuts - just vets helping vets. $5-10 goes a long way.`
        : "No VSO fees. No lawyer cuts. No data sold. A $5 or $10 donation keeps this running.",
      cta: "Support the Mission",
      icon: "📦"
    },
    'pdf': {
      headline: "PDF downloaded! 📄",
      body: context.conditionName 
        ? `Your ${context.conditionName} guide is ready. If it helps, $5-10 keeps Luna happy and Midnight powered for more features.`
        : "Your VA guide is ready. Using it is free - $5 or $10 keeps Luna in treats and Midnight coding.",
      cta: "Help Keep It Free",
      icon: "📥"
    },
    'save': {
      headline: "Saved to your packet! ✅",
      body: "Your claim evidence is organized and ready. No ads, no data sales - just $5-10 donations from grateful vets.",
      cta: "Chip In",
      icon: "💾"
    },
    'nexus': {
      headline: "Nexus letter drafted! 📝",
      body: context.conditionName
        ? `Your ${context.conditionName} statement is ready. That template would cost $50-100 - a $5-10 coffee helps keep it free.`
        : "That template would cost $50-100 from a service. A $5 or $10 donation helps keep this free for every veteran.",
      cta: "Worth It?",
      icon: "✍️"
    },
    'export': {
      headline: "Backup created! 💾",
      body: context.count
        ? `${context.count} claim${context.count > 1 ? 's' : ''} backed up safely. No cloud fees, no subscriptions - $5-10 keeps Luna happy and development going.`
        : "Your claim data is safe and private. A $5 or $10 keeps Luna in toys and Midnight squashing bugs.",
      cta: "Back the Builder",
      icon: "☁️"
    },
    'terminology': {
      headline: "Speaking VA now! 📖",
      body: context.term
        ? `Now you know what "${context.term}" really means. A $5-10 coffee helps maintain this glossary.`
        : "Using the right language helps win your claim. A $5 or $10 donation keeps this resource growing.",
      cta: "Appreciate It?",
      icon: "🗣️"
    },
    // === NEW SHOCK & AWE TOOLS ===
    'million-dollar': {
      headline: "That's YOUR money! 💰",
      body: context.total
        ? `${context.total} lifetime value - that's what you're fighting for. If this helped, $5-10 helps us reach more vets.`
        : "You just saw your rating's true lifetime worth. A $5-10 coffee helps us show more veterans their value.",
      cta: "Share the Wealth",
      icon: "🤑"
    },
    'mos-hazard': {
      headline: "Your job DID this! 🎖️",
      body: context.mos
        ? `${context.mos} injuries mapped and ready. A $5-10 donation helps us add more MOS codes.`
        : "Your military job's hazards are documented. A $5 or $10 contribution helps expand this database.",
      cta: "Back the Research",
      icon: "💪"
    },
    'web-conditions': {
      headline: "Connections revealed! 🕸️",
      body: context.condition
        ? `You discovered how ${context.condition} links to other claims. A $5-10 coffee helps maintain this research.`
        : "You explored secondary connections most vets never see. A $5 or $10 donation keeps this free.",
      cta: "Fund the Mission",
      icon: "🔗"
    },
    // === DBQ LIBRARY ===
    'dbq-library': {
      headline: context.action === 'bulk-download' 
        ? `${context.count || 'All'} DBQs downloaded! 📋`
        : context.action === 'pre-fill'
          ? "DBQ pre-filled! ✏️"
          : "DBQ saved offline! 📥",
      body: context.action === 'bulk-download'
        ? `${context.count || 'All'} official VA forms now available offline. A $5-10 coffee keeps this archive maintained.`
        : context.action === 'pre-fill'
          ? `Your subjective info is ready for ${context.formName || 'your doctor'}. $5-10 helps more vets walk in prepared.`
          : `${context.formName || 'This DBQ'} is now available offline. $5-10 keeps these tools free for everyone.`,
      cta: context.action === 'bulk-download' ? "Back the Archive" : "Buy Me a Coffee",
      icon: context.action === 'bulk-download' ? "📦" : "📋"
    },
    // === SPECIALIZED TOOLS ===
    'tdiu': {
      headline: "TDIU case built! 📋",
      body: context.impact
        ? "Your Individual Unemployability statement is ready. A $5-10 coffee helps keep this free for the next vet."
        : "You just built a professional-grade TDIU impact statement. $5 or $10 helps us maintain these tools.",
      cta: "Worth $5?",
      icon: "🏆"
    },
    'pact-act': {
      headline: "Presumptive found! 🔥",
      body: context.condition
        ? `${context.condition} may be presumptive under PACT Act. No nexus letter needed! $5-10 helps more vets find this.`
        : "You found presumptive conditions that don't need nexus letters. If helpful, $5-10 keeps this running.",
      cta: "Pay It Forward",
      icon: "🗺️"
    },
    'foia': {
      headline: "FOIA request ready! 🔑",
      body: "Your C-File request is generated. Knowing what's in your file is CRITICAL. $5-10 helps us build more transparency tools.",
      cta: "Unlock More Tools",
      icon: "🔓"
    },
    // === DIAMOND TIER TOOLS ===
    'blue-button': {
      headline: "Records analyzed! 🩺",
      body: context.count
        ? `${context.count} medical records scanned. A $5-10 donation keeps Luna happy and this AI analysis free.`
        : "Your medical records are now claim-ready intel. $5-10 keeps Luna in treats and Midnight building features.",
      cta: "Back the Tech",
      icon: "📊"
    },
    'witness-bench': {
      headline: "Buddy letter drafted! ✍️",
      body: context.witness
        ? `${context.witness}'s statement is ready. A quick $5 or $10 helps the next vet do the same.`
        : "Professional-grade witness statement ready. If it helped, $5-10 keeps this tool free.",
      cta: "Worth a Coffee?",
      icon: "👥"
    },
    'risk-assessment': {
      headline: "Claim protected! 🛡️",
      body: context.risks
        ? `${context.risks} risk${context.risks > 1 ? 's' : ''} identified before VA could use them against you. $5-10 protects more vets.`
        : "You found vulnerabilities before the VA did. A $5-10 coffee helps protect more vets.",
      cta: "Protect More Vets",
      icon: "⚠️"
    },
    'decision-decoder': {
      headline: "Decision decoded! 📜",
      body: context.type
        ? `Your ${context.type} decision letter translated. Understanding VA-speak is half the battle. $5-10 funds more clarity.`
        : "You decoded VA's confusing language into plain English. $5-10 helps us decode more decisions.",
      cta: "Fund Clarity",
      icon: "🔍"
    },
    'symptom-logger': {
      headline: "Symptoms documented! 📝",
      body: context.count
        ? `${context.count} symptom${context.count > 1 ? 's' : ''} logged for your records. $5-10 helps us track more vets' journeys.`
        : "Your symptom journal is building. A $5-10 donation helps us help more vets document their evidence.",
      cta: "Track More Vets",
      icon: "📋"
    },
    'state-benefits': {
      headline: "State benefits found! 🏛️",
      body: context.state
        ? `You discovered ${context.state}'s veteran benefits. $5-10 keeps this 50-state database updated.`
        : "You found state benefits most vets miss. A $5-10 coffee keeps this database current.",
      cta: "Keep It Updated",
      icon: "🗺️"
    }
  };

  const msg = messages[trigger] || messages['search'];
  
  // Use AI-generated message if available, otherwise fall back to static
  const displayBody = aiMessage || msg.body;

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
              {isLoadingAI ? (
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed animate-pulse">
                  ✨ {msg.body}
                </p>
              ) : (
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  {displayBody}
                </p>
              )}
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
            $5-10 keeps Luna happy 🐾 & Midnight powered for development 💚
          </p>
        </div>
      </div>
      
      {/* Funding Modal */}
      <FundingModal 
        show={showFundingModal} 
        onClose={() => setShowFundingModal(false)}
        componentStats={componentKey ? getComponentStats(componentKey) : null}
      />
    </>
  );
}

export default BuyMeCoffee;
