import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * LunaHelper - A calm, supportive presence celebrating user accomplishments
 * Luna is here to encourage and support veterans on their claims journey.
 * No money, no donations - just warm, supportive encouragement.
 * 
 * @param {boolean} show - Whether to show the popup
 * @param {string} trigger - What action triggered this (search, secondary-scout, cap-sim, etc.)
 * @param {object} context - Additional context about the action
 * @param {function} onDismiss - Optional callback when dismissed
 */
function BuyMeCoffee({ show, trigger = 'search', context = {}, onDismiss }) {
  const { t } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [sessionDismissCount, setSessionDismissCount] = useState(0);

  // Show with a slight delay for better UX
  useEffect(() => {
    if (show && !isDismissed) {
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

  // Calm, supportive messages from Luna 🐱
  // Focus on encouragement and celebrating progress
  const messages = {
    'search': {
      headline: "Great find! 🎯",
      body: context.count 
        ? `You found ${context.count} results${context.query ? ` for "${context.query}"` : ''}. You're building a strong foundation for your claim. Luna's here if you need more help.`
        : "Knowledge is power. Every search brings you closer to understanding your benefits. Keep going - you've got this.",
      icon: "🔍"
    },
    'secondary-scout': {
      headline: "Connections discovered! 💡",
      body: context.count 
        ? `You uncovered ${context.count} potential secondary conditions. These connections could strengthen your claim significantly. Nice work!`
        : "Finding secondary conditions is smart strategy. You're thinking like a pro. Luna believes in you.",
      icon: "🎖️"
    },
    'cap-sim': {
      headline: "You're preparing well! 📋",
      body: context.conditionName
        ? `Your ${context.conditionName} preparation is coming along${context.rating ? ` - targeting ${context.rating}%` : ''}. Practice makes confidence. You're doing great.`
        : "Preparation is the key to success. The more you practice, the more confident you'll feel. Luna's proud of your effort.",
      icon: "✅"
    },
    'cap-sim-complete': {
      headline: "Practice complete! 🏆",
      body: context.rating 
        ? `You practiced for a ${context.rating}% rating${context.conditionName ? ` on ${context.conditionName}` : ''}. That preparation will serve you well. Deep breath - you're ready.`
        : "Every practice session builds your confidence. You're investing in yourself. That's admirable.",
      icon: "🎯"
    },
    'packet': {
      headline: "Your packet is growing! 📁",
      body: context.count 
        ? `${context.count} claim${context.count > 1 ? 's' : ''} organized and ready. You're building something solid. One step at a time.`
        : "Organization is key to a strong claim. You're doing the work that matters. Luna sees your dedication.",
      icon: "📦"
    },
    'pdf': {
      headline: "Guide saved! 📄",
      body: context.conditionName 
        ? `Your ${context.conditionName} guide is ready to reference anytime. Having resources at hand helps reduce stress.`
        : "Having information ready when you need it - that's smart preparation. You're taking control of your journey.",
      icon: "📥"
    },
    'save': {
      headline: "Progress saved! ✅",
      body: "Your work is safe. Every save is a step forward. Take your time - this journey is yours to navigate at your pace.",
      icon: "💾"
    },
    'nexus': {
      headline: "Statement drafted! 📝",
      body: context.conditionName
        ? `Your ${context.conditionName} nexus statement is taking shape. Clear documentation is powerful evidence. Well done.`
        : "A well-crafted nexus statement can make all the difference. You're advocating for yourself. That takes courage.",
      icon: "✍️"
    },
    'export': {
      headline: "Backup complete! 💾",
      body: context.count
        ? `${context.count} claim${context.count > 1 ? 's' : ''} safely backed up. Your hard work is protected. Peace of mind matters.`
        : "Your data is secure. One less thing to worry about. Luna approves of your organization.",
      icon: "☁️"
    },
    'terminology': {
      headline: "Learning the language! 📖",
      body: context.term
        ? `Now you know "${context.term}". Understanding VA terminology helps you communicate effectively. Knowledge is confidence.`
        : "Every term you learn is a tool in your toolkit. You're becoming fluent in claim-speak. That's empowering.",
      icon: "🗣️"
    },
    'million-dollar': {
      headline: "Your benefits matter! 💙",
      body: context.total
        ? `${context.total} in potential lifetime value. These aren't just numbers - they're resources for you and your family. You've earned them.`
        : "Understanding your true benefits helps you plan for the future. You deserve every bit of what you've earned.",
      icon: "📊"
    },
    'mos-hazard': {
      headline: "Service documented! 🎖️",
      body: context.mos
        ? `${context.mos} occupational hazards identified. Your service had real impacts. Documenting them matters.`
        : "Your military job had consequences. Recognizing those connections is important for your claim. You're doing right by yourself.",
      icon: "💪"
    },
    'web-conditions': {
      headline: "Connections mapped! 🕸️",
      body: context.condition
        ? `${context.condition} connections revealed. Understanding how conditions relate helps build a complete picture.`
        : "Every connection you discover strengthens your understanding. You're seeing the bigger picture.",
      icon: "🔗"
    },
    'dbq-library': {
      headline: context.action === 'bulk-download' 
        ? `${context.count || 'Forms'} ready! 📋`
        : context.action === 'pre-fill'
          ? "Form prepared! ✏️"
          : "Form saved! 📥",
      body: context.action === 'bulk-download'
        ? `${context.count || 'All requested'} forms downloaded. Having the right paperwork ready reduces stress.`
        : context.action === 'pre-fill'
          ? `${context.formName || 'Your DBQ'} is pre-filled and ready for your doctor. You're making their job easier.`
          : `${context.formName || 'This form'} is saved for offline access. Prepared for anything.`,
      icon: context.action === 'bulk-download' ? "📦" : "📋"
    },
    'tdiu': {
      headline: "TDIU statement ready! 📋",
      body: context.impact
        ? "Your impact statement captures how your conditions affect daily life. Personal stories are powerful evidence."
        : "A strong TDIU statement speaks to your reality. You're advocating for yourself with clarity.",
      icon: "🏆"
    },
    'pact-act': {
      headline: "Presumptive match! 🔥",
      body: context.condition
        ? `${context.condition} qualifies as presumptive. That means an easier path forward. The PACT Act has your back.`
        : "Presumptive conditions mean the VA already recognizes the connection. One less battle to fight.",
      icon: "🗺️"
    },
    'foia': {
      headline: "Records request ready! 🔑",
      body: "Your C-File request is prepared. Getting your full records is an important step. Knowledge about your own case is power.",
      icon: "🔓"
    },
    'blue-button': {
      headline: "Records analyzed! 🩺",
      body: context.count
        ? `${context.count} conditions identified in your records. Understanding your medical history helps you claim what's yours.`
        : "Your medical records contain valuable evidence. Now you know what you're working with.",
      icon: "📊"
    },
    'witness-bench': {
      headline: "Buddy statement drafted! ✍️",
      body: context.witness
        ? `${context.witness}'s statement is ready. Having people vouch for you matters. Support makes a difference.`
        : "A good buddy statement adds a human voice to your claim. You're not alone in this.",
      icon: "👥"
    },
    'risk-assessment': {
      headline: "Claim reviewed! 🛡️",
      body: context.risks
        ? `${context.risks} area${context.risks > 1 ? 's' : ''} identified for strengthening. Better to know now than be surprised later.`
        : "Reviewing your claim for weaknesses is smart strategy. You're thinking ahead.",
      icon: "⚠️"
    },
    'decision-decoder': {
      headline: "Decision understood! 📜",
      body: context.type
        ? `${context.type} decision translated into plain English. Now you know exactly what you're dealing with.`
        : "VA letters can be confusing. Now you have clarity. Understanding is the first step to responding.",
      icon: "🔍"
    },
    'symptom-logger': {
      headline: "Symptoms recorded! 📝",
      body: context.count
        ? `${context.count} symptom${context.count > 1 ? 's' : ''} documented. Consistent logging builds strong evidence over time.`
        : "Every entry is evidence. Your dedication to documenting will pay off. Keep it up.",
      icon: "📋"
    },
    'state-benefits': {
      headline: "State benefits found! 🏛️",
      body: context.state
        ? `${context.state} offers benefits you may not have known about. Every bit helps.`
        : "States have their own veteran programs. You might be leaving benefits on the table. Now you know.",
      icon: "🗺️"
    },
    'red-team': {
      headline: "Claim tested! 🔴",
      body: "Your claim has been reviewed from the VA's perspective. Now you know what they might question.",
      icon: "🛡️"
    },
    'vso-finder': {
      headline: "Support options found! 🤝",
      body: context.state
        ? `VSOs in ${context.state} are ready to help. You don't have to do this alone.`
        : "VSOs are free advocates who want to help. Reaching out takes courage. Luna supports you.",
      icon: "🏢"
    },
    'evidence-importer': {
      headline: "Evidence organized! 📂",
      body: "Your supporting documents are in order. A well-organized claim is easier to process.",
      icon: "📎"
    },
    'forms-helper': {
      headline: "Form assistance complete! 📋",
      body: "VA forms can be overwhelming. You're handling them with care. Every field filled correctly matters.",
      icon: "✏️"
    },
    'legislative-watchdog': {
      headline: "Policy tracked! 📰",
      body: "Staying informed about veteran legislation helps you know your rights. Knowledge evolves - so should your awareness.",
      icon: "⚖️"
    }
  };

  const msg = messages[trigger] || messages['search'];

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-fade-in max-w-[calc(100vw-2rem)] sm:max-w-xs">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-4 border border-blue-200 dark:border-blue-700 relative">
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
          {/* Luna photo - calm, supportive presence */}
          <img 
            src="/images/NaptimeLuna.jpg" 
            alt="Luna - Your calm companion"
            className="w-12 h-12 rounded-full object-cover flex-shrink-0 border-2 border-blue-300 dark:border-blue-600 shadow-sm"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              {msg.body}
            </p>
          </div>
        </div>
        
        {/* Encouraging footer */}
        <p className="text-[10px] text-blue-500 dark:text-blue-400 text-center mt-3 italic">
          Luna's here whenever you need a moment of calm. 🐱💙
        </p>
      </div>
    </div>
  );
}

export default BuyMeCoffee;
