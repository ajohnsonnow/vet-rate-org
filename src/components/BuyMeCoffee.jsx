import React, { useState, useEffect } from 'react';
import FundingModal from './FundingModal';
import { getComponentStats } from '../utils/componentStats';

/**
 * BuyMeCoffee - Contextual funding request that appears after valuable actions
 * Links donation asks to specific accomplishments to increase relevance
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
    },
    // === NEW SHOCK & AWE TOOLS ===
    'million-dollar': {
      headline: "That's YOUR money! 💰",
      body: context.total
        ? `${context.total} lifetime value - and you almost let the VA lowball you. This calculator took months to build. Help keep it free.`
        : "You just saw your VA rating's true worth. Most vets never realize they're fighting for millions. Spread the word.",
      cta: "Share the Wealth",
      icon: "🤑"
    },
    'mos-hazard': {
      headline: "Your job DID this! 🎖️",
      body: context.mos
        ? `${context.mos} injuries mapped. This database took hundreds of hours researching military occupational hazards.`
        : "You now have proof your military job caused real damage. Help us add more MOS codes for fellow veterans.",
      cta: "Back the Research",
      icon: "💪"
    },
    'web-conditions': {
      headline: "Connections revealed! 🕸️",
      body: context.condition
        ? `You discovered how ${context.condition} links to other claims. This medical research took serious time.`
        : "You just explored secondary connections most veterans never see. Help keep this visualization free for everyone.",
      cta: "Fund the Mission",
      icon: "🔗"
    },
    // === SPECIALIZED TOOLS ===
    'tdiu': {
      headline: "TDIU case built! 📋",
      body: context.impact
        ? "Your Individual Unemployability statement is ready. That vocational assessment would cost $500+ privately."
        : "You just built a professional-grade TDIU impact statement. A vocational expert charges $500+ for this.",
      cta: "Worth $5?",
      icon: "🏆"
    },
    'pact-act': {
      headline: "Presumptive found! 🔥",
      body: context.condition
        ? `${context.condition} may be presumptive under PACT Act. No nexus letter needed - this research just saved you $1,500+.`
        : "You found presumptive conditions that don't need nexus letters. That's $1,500+ saved per condition.",
      cta: "Pay It Forward",
      icon: "🗺️"
    },
    'foia': {
      headline: "FOIA request ready! 🔑",
      body: "Your C-File request is generated. Knowing what's in your file is CRITICAL. Help us keep building transparency tools.",
      cta: "Unlock More Tools",
      icon: "🔓"
    },
    // === DIAMOND TIER TOOLS ===
    'blue-button': {
      headline: "Records analyzed! 🩺",
      body: context.count
        ? `${context.count} medical records scanned. This AI-powered analysis would cost hundreds at a legal firm.`
        : "Your medical records are now claim-ready intel. Help fund the servers that make this possible.",
      cta: "Back the Tech",
      icon: "📊"
    },
    'witness-bench': {
      headline: "Buddy letter drafted! ✍️",
      body: context.witness
        ? `${context.witness}'s statement is ready. A claims attorney charges $150+ for witness prep.`
        : "Professional-grade witness statement ready. Claims attorneys charge $150+ for this service.",
      cta: "Worth a Coffee?",
      icon: "👥"
    },
    'risk-assessment': {
      headline: "Claim protected! 🛡️",
      body: context.risks
        ? `${context.risks} risk${context.risks > 1 ? 's' : ''} identified before VA could use them against you. This protection is priceless.`
        : "You just found vulnerabilities before the VA did. Protection like this is worth every penny.",
      cta: "Protect More Vets",
      icon: "⚠️"
    },
    'decision-decoder': {
      headline: "Decision decoded! 📜",
      body: context.type
        ? `Your ${context.type} decision letter translated. Understanding VA-speak is half the battle.`
        : "You decoded VA's confusing language into plain English. Help us decode more decisions.",
      cta: "Fund Clarity",
      icon: "🔍"
    },
    'symptom-logger': {
      headline: "Symptoms documented! 📝",
      body: context.count
        ? `${context.count} symptom${context.count > 1 ? 's' : ''} logged for your records. This evidence trail could win your claim.`
        : "Your symptom journal is building. This evidence could be the difference between 30% and 70%.",
      cta: "Track More Vets",
      icon: "📋"
    },
    'state-benefits': {
      headline: "State benefits found! 🏛️",
      body: context.state
        ? `You discovered ${context.state}'s veteran benefits. This research covers all 50 states - that's serious work.`
        : "You found state benefits most vets miss. This database took months to compile.",
      cta: "Keep It Updated",
      icon: "🗺️"
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
      <FundingModal 
        show={showFundingModal} 
        onClose={() => setShowFundingModal(false)}
        componentStats={componentKey ? getComponentStats(componentKey) : null}
      />
    </>
  );
}

export default BuyMeCoffee;
