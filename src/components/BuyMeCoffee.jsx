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

  // Contextual, action-linked messages from Luna herself! 🐱
  // Now with $5-10 mentions and AI enhancement when available
  const messages = {
    'search': {
      headline: "Meow! You found it! 🎯",
      body: context.count 
        ? `*purrrr* ${context.count} results found${context.query ? ` for \"${context.query}\"` : ''}! Luna's been supervising this code furr-ever. $5-10 keeps my treat bowl full! 🐾`
        : "*meow meow* That search would've taken you nine lives! A $5-10 donation keeps Luna's keyboard warm and treats coming! 😸",
      cta: "Feed Luna! 🐱",
      icon: "🔍"
    },
    'secondary-scout': {
      headline: "*purr* Secondary claims unlocked! 💡",
      body: context.count 
        ? `Meow meow! You discovered ${context.count} pawsible secondary conditions! Luna worked hard on this feature (between naps). $5-10 = more treats for me! 😻`
        : "*purrrr* You found claims that would cost $100+ from those humans! Luna thinks $5-10 in treats is fair, yes? 🐾",
      cta: "Luna Wants Treats! 😸",
      icon: "🎖️"
    },
    'cap-sim': {
      headline: "*meow* You're C&P ready! 📋",
      body: context.conditionName
        ? `Purrr! You're ready for ${context.conditionName}${context.rating ? ` (${context.rating}% - Luna approves!)` : ''}. Luna supervised every line of code. Treats plz? $5-10 😻`
        : "*purrrr* You're SO prepared! Luna demands payment in... I mean, donations keep me in Fancy Feast! $5-10? 🐾",
      cta: "Luna's Treat Fund! 🐱",
      icon: "✅"
    },
    'cap-sim-complete': {
      headline: "*purr purr* Simulation complete! 🏆",
      body: context.rating 
        ? `Meow! ${context.rating}% rating practice${context.conditionName ? ` for ${context.conditionName}` : ''}! Luna watched EVERY answer. Treats now plz? $5-10 😻`
        : "*purrrr* That prep would cost $$$! Luna thinks $5-10 in treats is a bargain, yes? 🐾",
      cta: "Treat Luna! 🐱",
      icon: "🎯"
    },
    'packet': {
      headline: "*meow* Your packet is building! 📁",
      body: context.count 
        ? `*Purrrr* ${context.count} claim${context.count > 1 ? 's' : ''} organized! Luna's been napping on this code for weeks. $5-10 = treats! 😸`
        : "*meow meow* No fees, no lawyers, just Luna helping vets! $5-10 keeps my treat bowl full! 🐾",
      cta: "Fill Luna's Bowl! 🐱",
      icon: "📦"
    },
    'pdf': {
      headline: "*purr* PDF downloaded! 📄",
      body: context.conditionName 
        ? `*Meow!* Your ${context.conditionName} guide is ready! Luna personally tested the download button. Treats? $5-10? 😻`
        : "*purrrrr* Free guides = hungry Luna! $5-10 keeps me in Fancy Feast while dad codes more features! 🐾",
      cta: "Luna Wants Treats! 🐱",
      icon: "📥"
    },
    'save': {
      headline: "*meow* Saved to your packet! ✅",
      body: "*Purrrr* All organized, just like Luna's toy collection! No ads, just grateful vets sending $5-10 in treats! 😸",
      cta: "Treats for Luna! 🐱",
      icon: "💾"
    },
    'nexus': {
      headline: "*purr* Nexus letter drafted! 📝",
      body: context.conditionName
        ? `*Meow!* Your ${context.conditionName} statement is ready! Luna supervised EVERY word. Worth $50-100 but Luna only wants $5-10 in treats! 😻`
        : "*purrrrr* That template = $$$ elsewhere! Luna thinks $5-10 treats is fair, yes human? 🐾",
      cta: "Fair Trade! 🐱",
      icon: "✍️"
    },
    'export': {
      headline: "*meow* Backup created! 💾",
      body: context.count
        ? `*Purrrr* ${context.count} claim${context.count > 1 ? 's' : ''} backed up! Luna tested this feature by walking across the keyboard. $5-10 = treats! 😸`
        : "*meow meow* Your data is safe (unlike my toy mice that keep disappearing). $5-10 keeps Luna happy! 🐾",
      cta: "Luna's Treat Fund! 🐱",
      icon: "☁️"
    },
    'terminology': {
      headline: "*purr* Speaking VA now! 📖",
      body: context.term
        ? `*Meow!* Now you know \"${context.term}\"! Luna sat on this glossary while dad typed it. Treats? $5-10? 😻`
        : "*purrrrr* Using big words helps win claims! Luna thinks teaching you is worth $5-10 in Fancy Feast! 🐾",
      cta: "Treats Plz! 🐱",
      icon: "🗣️"
    },
    // === SHOCK & AWE TOOLS (Luna Edition) ===
    'million-dollar': {
      headline: "*MEOW!* That's YOUR money! 💰",
      body: context.total
        ? `*Purrrr* ${context.total} lifetime value! That's like... a LOT of treats! Luna thinks you should donate $5-10 now! 😻`
        : "*meow meow* You saw your TRUE worth! Luna calculates $5-10 = happy cat supervisor! 🐾",
      cta: "Share With Luna! 🐱",
      icon: "🤑"
    },
    'mos-hazard': {
      headline: "*purr* Your job DID this! 🎖️",
      body: context.mos
        ? `*Meow!* ${context.mos} injuries mapped! Luna napped on this database for MONTHS. Treats now? $5-10? 😻`
        : "*purrrrr* Military job hazards = documented! Luna wants treats for this service! $5-10! 🐾",
      cta: "Feed Luna! 🐱",
      icon: "💪"
    },
    'web-conditions': {
      headline: "*meow* Connections revealed! 🕸️",
      body: context.condition
        ? `*Purrrr* ${context.condition} links found! Luna tested every connection by pawing at the screen. $5-10 = happy Luna! 😸`
        : "*meow meow* You found secret connections! Luna thinks that's worth $5-10 in Fancy Feast! 🐾",
      cta: "Treats for Luna! 🐱",
      icon: "🔗"
    },
    // === DBQ LIBRARY (Luna Approved) ===
    'dbq-library': {
      headline: context.action === 'bulk-download' 
        ? `*MEOW* ${context.count || 'All'} DBQs downloaded! 📋`
        : context.action === 'pre-fill'
          ? "*purr* DBQ pre-filled! ✏️"
          : "*meow* DBQ saved offline! 📥",
      body: context.action === 'bulk-download'
        ? `*Purrrr* ${context.count || 'ALL'} forms! Luna supervised this download (by sleeping on the keyboard). $5-10 = treats! 😻`
        : context.action === 'pre-fill'
          ? `*Meow!* Ready for ${context.formName || 'your doctor'}! Luna pre-filled this (with paw prints). Treats? $5-10? 🐾`
          : `*purr* ${context.formName || 'This DBQ'} is offline! Luna approves. $5-10 keeps me in Fancy Feast! 😸`,
      cta: context.action === 'bulk-download' ? "Luna's Treat Fund!" : "Feed Luna! 🐱",
      icon: context.action === 'bulk-download' ? "📦" : "📋"
    },
    // === SPECIALIZED TOOLS (Luna's Specialties) ===
    'tdiu': {
      headline: "*purr* TDIU case built! 📋",
      body: context.impact
        ? "*Meow!* Your statement is ready! Luna watched you type EVERY word (while napping). Worth $5-10 in treats? 😻"
        : "*purrrrr* Professional TDIU statement done! Luna thinks that's worth Fancy Feast! $5-10? 🐾",
      cta: "Treats Plz! 🐱",
      icon: "🏆"
    },
    'pact-act': {
      headline: "*MEOW* Presumptive found! 🔥",
      body: context.condition
        ? `*Purrrr* ${context.condition} = presumptive! No nexus needed! Luna researched this (between naps). $5-10 treats? 😸`
        : "*meow meow* Presumptive conditions = easy claims! Luna wants treats for finding this! $5-10! 🐾",
      cta: "Luna Wants Treats! 🐱",
      icon: "🗺️"
    },
    'foia': {
      headline: "*purr* FOIA request ready! 🔑",
      body: "*Meow!* Your C-File request is done! Luna personally approved every line (by sitting on it). Critical tool = treats! $5-10? 😻",
      cta: "Feed Luna! 🐱",
      icon: "🔓"
    },
    // === DIAMOND TIER TOOLS (Luna's Premium Services) ===
    'blue-button': {
      headline: "*purr purr* Records analyzed! 🩺",
      body: context.count
        ? `*MEOW!* ${context.count} medical records scanned! Luna's AI helped (while she napped on the GPU). Treats? $5-10? 😻`
        : "*purrrrr* Medical records = claim intel! Luna wants Fancy Feast for this AI magic! $5-10! 🐾",
      cta: "Luna's AI Fund! 🐱",
      icon: "📊"
    },
    'witness-bench': {
      headline: "*meow* Buddy letter drafted! ✍️",
      body: context.witness
        ? `*Purrrr* ${context.witness}'s statement is ready! Luna proofread it (by walking across the keyboard). $5-10 = treats! 😸`
        : "*meow meow* Professional statement = done! Luna thinks helping your buddy is worth treats! $5-10? 🐾",
      cta: "Treats for Luna! 🐱",
      icon: "👥"
    },
    'risk-assessment': {
      headline: "*purr* Claim protected! 🛡️",
      body: context.risks
        ? `*MEOW!* ${context.risks} risk${context.risks > 1 ? 's' : ''} found before VA saw them! Luna's protection = $5-10 in treats! 😻`
        : "*purrrrr* Vulnerabilities = found! Luna protected you! Worth Fancy Feast? $5-10? 🐾",
      cta: "Feed Luna! 🐱",
      icon: "⚠️"
    },
    'decision-decoder': {
      headline: "*meow* Decision decoded! 📜",
      body: context.type
        ? `*Purrrr* ${context.type} decision translated! Luna decoded VA-speak (it's harder than cat language!). $5-10 treats? 😸`
        : "*meow meow* Confusing VA language = decoded! Luna wants treats for this translation! $5-10! 🐾",
      cta: "Luna Wants Treats! 🐱",
      icon: "🔍"
    },
    'symptom-logger': {
      headline: "*purr* Symptoms documented! 📝",
      body: context.count
        ? `*Meow!* ${context.count} symptom${context.count > 1 ? 's' : ''} logged! Luna tracked every entry (while napping). Treats now? $5-10? 😻`
        : "*purrrrr* Symptom journal = evidence! Luna wants treats for this documentation magic! $5-10! 🐾",
      cta: "Treats Plz! 🐱",
      icon: "📋"
    },
    'state-benefits': {
      headline: "*MEOW* State benefits found! 🏛️",
      body: context.state
        ? `*Purrrr* ${context.state} veteran benefits discovered! Luna researched all 50 states (exhausting!). $5-10 treats? 😸`
        : "*meow meow* Hidden state benefits = found! Luna wants Fancy Feast for this detective work! $5-10! 🐾",
      cta: "Feed Luna! 🐱",
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
            {/* Luna photo - Chief Keyboard Inspector */}
            <img 
              src="/images/NaptimeLuna.jpg" 
              alt="Luna - Chief Keyboard Inspector & Treat Supervisor"
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
          
          {/* Luna's purr-suasion */}
          <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center mt-2">
            *purrrr* Luna promises to supervise more code if you send treats! 🐾😸
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
