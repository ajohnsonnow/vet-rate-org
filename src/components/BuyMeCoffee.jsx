import { useState, useEffect, useMemo } from "react";
import { useLanguage } from "../contexts/LanguageContext";

/**
 * LunaHelper - A calm, supportive presence celebrating user accomplishments
 * Luna is here to encourage and support veterans on their claims journey.
 * No money, no donations - just warm, supportive encouragement.
 *
 * Luna now pops up randomly around the center of the screen with fun animations! 🐱✨
 *
 * @param {boolean} show - Whether to show the popup
 * @param {string} trigger - What action triggered this (search, secondary-scout, cap-sim, etc.)
 * @param {object} context - Additional context about the action
 * @param {function} onDismiss - Optional callback when dismissed
 */

// Fun entrance animations for Luna
const ENTRANCE_ANIMATIONS = [
  "animate-luna-bounce-in", // Bouncy entrance
  "animate-luna-slide-up", // Slides up
  "animate-luna-pop-in", // Pop/scale effect
  "animate-luna-swing-in", // Swings in like a cat jumping
  "animate-luna-fade-zoom", // Fade + zoom combo
];

// Random position zones (avoiding corners where other UI elements live)
const POSITION_ZONES = [
  { top: "30%", left: "50%", transform: "translate(-50%, -50%)" }, // Center-upper
  { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }, // Dead center
  { top: "40%", left: "30%", transform: "translate(-50%, -50%)" }, // Center-left
  { top: "40%", left: "70%", transform: "translate(-50%, -50%)" }, // Center-right
  { top: "35%", left: "40%", transform: "translate(-50%, -50%)" }, // Upper-left-ish
  { top: "35%", left: "60%", transform: "translate(-50%, -50%)" }, // Upper-right-ish
  { top: "45%", left: "45%", transform: "translate(-50%, -50%)" }, // Slightly off-center
];

// Cat-themed emojis for extra fun
const CAT_EMOJIS = ["😺", "😸", "🐱", "😻", "😽", "🐾", "✨"];

function BuyMeCoffee({ show, trigger = "search", context = {}, onDismiss }) {
  const { _t } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [sessionDismissCount, setSessionDismissCount] = useState(0);

  // Randomize position and animation when Luna appears
  const { position, animation, extraEmoji } = useMemo(
    () => ({
      position:
        POSITION_ZONES[Math.floor(Math.random() * POSITION_ZONES.length)],
      animation:
        ENTRANCE_ANIMATIONS[
          Math.floor(Math.random() * ENTRANCE_ANIMATIONS.length)
        ],
      extraEmoji: CAT_EMOJIS[Math.floor(Math.random() * CAT_EMOJIS.length)],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trigger],
  ); // Re-randomize when trigger changes

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
    setSessionDismissCount((prev) => prev + 1);
    if (onDismiss) onDismiss();
  };

  if (!isVisible) return null;

  // Calm, supportive messages from Luna 🐱
  // Focus on encouragement and celebrating progress
  const messages = {
    search: {
      headline: "Great find! 🎯",
      body: context.count
        ? `You found ${context.count} results${context.query ? ` for "${context.query}"` : ""}. You're building a strong foundation for your claim. Luna's here if you need more help.`
        : "Knowledge is power. Every search brings you closer to understanding your benefits. Keep going - you've got this.",
      icon: "🔍",
    },
    "secondary-scout": {
      headline: "Connections discovered! 💡",
      body: context.count
        ? `You uncovered ${context.count} potential secondary conditions. These connections could strengthen your claim significantly. Nice work!`
        : "Finding secondary conditions is smart strategy. You're thinking like a pro. Luna believes in you.",
      icon: "🎖️",
    },
    "cap-sim": {
      headline: "You're preparing well! 📋",
      body: context.conditionName
        ? `Your ${context.conditionName} preparation is coming along${context.rating ? ` - targeting ${context.rating}%` : ""}. Practice makes confidence. You're doing great.`
        : "Preparation is the key to success. The more you practice, the more confident you'll feel. Luna's proud of your effort.",
      icon: "✅",
    },
    "cap-sim-complete": {
      headline: "Practice complete! 🏆",
      body: context.rating
        ? `You practiced for a ${context.rating}% rating${context.conditionName ? ` on ${context.conditionName}` : ""}. That preparation will serve you well. Deep breath - you're ready.`
        : "Every practice session builds your confidence. You're investing in yourself. That's admirable.",
      icon: "🎯",
    },
    packet: {
      headline: "Your packet is growing! 📁",
      body: context.count
        ? `${context.count} claim${context.count > 1 ? "s" : ""} organized and ready. You're building something solid. One step at a time.`
        : "Organization is key to a strong claim. You're doing the work that matters. Luna sees your dedication.",
      icon: "📦",
    },
    pdf: {
      headline: "Guide saved! 📄",
      body: context.conditionName
        ? `Your ${context.conditionName} guide is ready to reference anytime. Having resources at hand helps reduce stress.`
        : "Having information ready when you need it - that's smart preparation. You're taking control of your journey.",
      icon: "📥",
    },
    save: {
      headline: "Progress saved! ✅",
      body: "Your work is safe. Every save is a step forward. Take your time - this journey is yours to navigate at your pace.",
      icon: "💾",
    },
    nexus: {
      headline: "Statement drafted! 📝",
      body: context.conditionName
        ? `Your ${context.conditionName} nexus statement is taking shape. Clear documentation is powerful evidence. Well done.`
        : "A well-crafted nexus statement can make all the difference. You're advocating for yourself. That takes courage.",
      icon: "✍️",
    },
    export: {
      headline: "Backup complete! 💾",
      body: context.count
        ? `${context.count} claim${context.count > 1 ? "s" : ""} safely backed up. Your hard work is protected. Peace of mind matters.`
        : "Your data is secure. One less thing to worry about. Luna approves of your organization.",
      icon: "☁️",
    },
    terminology: {
      headline: "Learning the language! 📖",
      body: context.term
        ? `Now you know "${context.term}". Understanding VA terminology helps you communicate effectively. Knowledge is confidence.`
        : "Every term you learn is a tool in your toolkit. You're becoming fluent in claim-speak. That's empowering.",
      icon: "🗣️",
    },
    "million-dollar": {
      headline: "Your benefits matter! 💙",
      body: context.total
        ? `${context.total} in potential lifetime value. These aren't just numbers - they're resources for you and your family. You've earned them.`
        : "Understanding your true benefits helps you plan for the future. You deserve every bit of what you've earned.",
      icon: "📊",
    },
    "mos-hazard": {
      headline: "Service documented! 🎖️",
      body: context.mos
        ? `${context.mos} occupational hazards identified. Your service had real impacts. Documenting them matters.`
        : "Your military job had consequences. Recognizing those connections is important for your claim. You're doing right by yourself.",
      icon: "💪",
    },
    "web-conditions": {
      headline: "Connections mapped! 🕸️",
      body: context.condition
        ? `${context.condition} connections revealed. Understanding how conditions relate helps build a complete picture.`
        : "Every connection you discover strengthens your understanding. You're seeing the bigger picture.",
      icon: "🔗",
    },
    "dbq-library": {
      headline:
        context.action === "bulk-download"
          ? `${context.count || "Forms"} ready! 📋`
          : context.action === "pre-fill"
            ? "Form prepared! ✏️"
            : "Form saved! 📥",
      body:
        context.action === "bulk-download"
          ? `${context.count || "All requested"} forms downloaded. Having the right paperwork ready reduces stress.`
          : context.action === "pre-fill"
            ? `${context.formName || "Your DBQ"} is pre-filled and ready for your doctor. You're making their job easier.`
            : `${context.formName || "This form"} is saved for offline access. Prepared for anything.`,
      icon: context.action === "bulk-download" ? "📦" : "📋",
    },
    tdiu: {
      headline: "TDIU statement ready! 📋",
      body: context.impact
        ? "Your impact statement captures how your conditions affect daily life. Personal stories are powerful evidence."
        : "A strong TDIU statement speaks to your reality. You're advocating for yourself with clarity.",
      icon: "🏆",
    },
    "pact-act": {
      headline: "Presumptive match! 🔥",
      body: context.condition
        ? `${context.condition} qualifies as presumptive. That means an easier path forward. The PACT Act has your back.`
        : "Presumptive conditions mean the VA already recognizes the connection. One less battle to fight.",
      icon: "🗺️",
    },
    foia: {
      headline: "Records request ready! 🔑",
      body: "Your C-File request is prepared. Getting your full records is an important step. Knowledge about your own case is power.",
      icon: "🔓",
    },
    "blue-button": {
      headline: "Records analyzed! 🩺",
      body: context.count
        ? `${context.count} conditions identified in your records. Understanding your medical history helps you claim what's yours.`
        : "Your medical records contain valuable evidence. Now you know what you're working with.",
      icon: "📊",
    },
    "witness-bench": {
      headline: "Buddy statement drafted! ✍️",
      body: context.witness
        ? `${context.witness}'s statement is ready. Having people vouch for you matters. Support makes a difference.`
        : "A good buddy statement adds a human voice to your claim. You're not alone in this.",
      icon: "👥",
    },
    "risk-assessment": {
      headline: "Claim reviewed! 🛡️",
      body: context.risks
        ? `${context.risks} area${context.risks > 1 ? "s" : ""} identified for strengthening. Better to know now than be surprised later.`
        : "Reviewing your claim for weaknesses is smart strategy. You're thinking ahead.",
      icon: "⚠️",
    },
    "decision-decoder": {
      headline: "Decision understood! 📜",
      body: context.type
        ? `${context.type} decision translated into plain English. Now you know exactly what you're dealing with.`
        : "VA letters can be confusing. Now you have clarity. Understanding is the first step to responding.",
      icon: "🔍",
    },
    "symptom-logger": {
      headline: "Symptoms recorded! 📝",
      body: context.count
        ? `${context.count} symptom${context.count > 1 ? "s" : ""} documented. Consistent logging builds strong evidence over time.`
        : "Every entry is evidence. Your dedication to documenting will pay off. Keep it up.",
      icon: "📋",
    },
    "state-benefits": {
      headline: "State benefits found! 🏛️",
      body: context.state
        ? `${context.state} offers benefits you may not have known about. Every bit helps.`
        : "States have their own veteran programs. You might be leaving benefits on the table. Now you know.",
      icon: "🗺️",
    },
    "red-team": {
      headline: "Claim tested! 🔴",
      body: "Your claim has been reviewed from the VA's perspective. Now you know what they might question.",
      icon: "🛡️",
    },
    "vso-finder": {
      headline: "Support options found! 🤝",
      body: context.state
        ? `VSOs in ${context.state} are ready to help. You don't have to do this alone.`
        : "VSOs are free advocates who want to help. Reaching out takes courage. Luna supports you.",
      icon: "🏢",
    },
    "evidence-importer": {
      headline: "Evidence organized! 📂",
      body: "Your supporting documents are in order. A well-organized claim is easier to process.",
      icon: "📎",
    },
    "forms-helper": {
      headline: "Form assistance complete! 📋",
      body: "VA forms can be overwhelming. You're handling them with care. Every field filled correctly matters.",
      icon: "✏️",
    },
    "legislative-watchdog": {
      headline: "Policy tracked! 📰",
      body: "Staying informed about veteran legislation helps you know your rights. Knowledge evolves - so should your awareness.",
      icon: "⚖️",
    },
  };

  const msg = messages[trigger] || messages["search"];

  return (
    <div
      className={`fixed z-50 ${animation} max-w-[calc(100vw-2rem)] sm:max-w-sm`}
      style={{
        top: position.top,
        left: position.left,
        transform: position.transform,
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-5 border-2 border-purple-300 dark:border-purple-600 relative backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95">
        {/* Decorative cat ears on top */}
        <div className="absolute -top-3 left-6 w-0 h-0 border-l-[12px] border-r-[12px] border-b-[16px] border-l-transparent border-r-transparent border-b-purple-300 dark:border-b-purple-600" />
        <div className="absolute -top-3 right-6 w-0 h-0 border-l-[12px] border-r-[12px] border-b-[16px] border-l-transparent border-r-transparent border-b-purple-300 dark:border-b-purple-600" />

        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute -top-2 -right-2 bg-purple-100 dark:bg-purple-700 rounded-full p-1.5 text-purple-400 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-600 transition shadow-md hover:scale-110"
          aria-label="Dismiss Luna"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {/* Headline with icon and extra cat emoji */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">{msg.icon}</span>
          <span className="font-bold text-gray-900 dark:text-white text-base">
            {msg.headline}
          </span>
          <span className="text-lg animate-bounce">{extraEmoji}</span>
        </div>

        <div className="flex items-start gap-4">
          {/* Luna photo - now larger and with fun border */}
          <div className="relative flex-shrink-0">
            <img
              src="/images/NaptimeLuna.jpg"
              alt="Luna - Your calm companion"
              className="w-16 h-16 rounded-full object-cover border-3 border-purple-400 dark:border-purple-500 shadow-lg animate-pulse-subtle"
            />
            {/* Floating paw print */}
            <span className="absolute -bottom-1 -right-1 text-lg animate-wiggle">
              🐾
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              {msg.body}
            </p>
          </div>
        </div>

        {/* Encouraging footer with sparkles */}
        <p className="text-xs text-purple-500 dark:text-purple-400 text-center mt-4 italic">
          ✨ Luna&apos;s here whenever you need a moment of calm ✨ 🐱💜
        </p>
      </div>
    </div>
  );
}

export default BuyMeCoffee;
