/**
 * Vet-Rate.org - Easter Egg: The "Zonk" Button
 *
 * A little culture for the veterans. Sometimes you just need a smile.
 * Hidden in settings, does nothing except bring a moment of levity.
 *
 * "Zonk" - The best formation in military history.
 * Built by a fellow veteran. Hooah.
 */

import { useState, useRef } from "react";
import { Smile, PartyPopper, Coffee } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import useFocusTrap from "../hooks/useFocusTrap";
import { useBodyScrollLock } from "../utils/useBodyScrollLock";

const ZONK_MESSAGES = [
  {
    title: "ZONK! 🎉",
    message: "No PT today! Return to your barracks and hydrate.",
    icon: PartyPopper,
    color: "green",
  },
  {
    title: "Dismissed! ☕",
    message: "Formation cancelled. Grab some coffee, you earned it.",
    icon: Coffee,
    color: "blue",
  },
  {
    title: "At Ease, Warrior 💪",
    message: "You're crushing this claim. Take 5, then keep pushing.",
    icon: Smile,
    color: "purple",
  },
  {
    title: "Stand Down 🛌",
    message: "Rest is tactical. Come back strong tomorrow.",
    icon: Smile,
    color: "indigo",
  },
  {
    title: "Liberty Call! 🌴",
    message: "Your claim will be here when you get back. Go live a little.",
    icon: PartyPopper,
    color: "teal",
  },
  {
    title: "Secure! 🔒",
    message: "Work's done for now. You're doing great, battle.",
    icon: Smile,
    color: "green",
  },
];

const MEMES = [
  "🏃‍♂️💨 *Everyone running to their cars*",
  "🎺 *Plays Reveille backwards*",
  "☕ First Sergeant: 'Gotcha!'",
  "🚫 No PT? Best day ever.",
  "💪 Pain is temporary. Zonk is forever.",
  "🎖️ The Medal of Honor we all deserve.",
];

const ZonkButton = ({ className = "" }) => {
  const { _t } = useLanguage();
  const [showZonk, setShowZonk] = useState(false);
  const [zonkData, setZonkData] = useState(null);
  const [clickCount, setClickCount] = useState(0);
  const zonkRef = useRef(null);

  useBodyScrollLock(showZonk);
  useFocusTrap(zonkRef, {
    active: showZonk,
    onEscape: () => setShowZonk(false),
  });

  const handleZonkClick = () => {
    // Pick a random zonk message
    const randomZonk =
      ZONK_MESSAGES[Math.floor(Math.random() * ZONK_MESSAGES.length)];
    const randomMeme = MEMES[Math.floor(Math.random() * MEMES.length)];

    setZonkData({ ...randomZonk, meme: randomMeme });
    setShowZonk(true);
    setClickCount((prev) => prev + 1);

    // Play a "success" sound if available
    try {
      const audio = new Audio(
        "data:audio/wav;base64,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",
      );
      audio.volume = 0.2;
      audio.play().catch(() => {
        // Silently fail if audio doesn't play
      });
    } catch (e) {
      // Audio not supported, no problem
    }
  };

  const getColorClasses = (color) => {
    const colors = {
      green: "bg-green-50 border-green-300 text-green-900",
      blue: "bg-blue-50 border-blue-300 text-blue-900",
      purple: "bg-purple-50 border-purple-300 text-purple-900",
      indigo: "bg-indigo-50 border-indigo-300 text-indigo-900",
      teal: "bg-teal-50 border-teal-300 text-teal-900",
    };
    return colors[color] || colors.green;
  };

  return (
    <div className={className}>
      {/* The Button */}
      {!showZonk && (
        <div className="bg-gray-50 border border-gray-300 rounded-lg p-6 text-center">
          <p className="text-sm text-gray-600 mb-4">
            You&apos;ve been working hard. Need a morale boost?
          </p>
          <button
            onClick={handleZonkClick}
            className="bg-gradient-to-r from-purple-600 to-purple-700 text-white font-bold py-3 px-8 rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all shadow-md hover:shadow-lg transform hover:scale-105"
          >
            DISMISSED
          </button>
          {clickCount > 0 && (
            <p className="text-xs text-gray-500 mt-3">Zonks: {clickCount} 🎖️</p>
          )}
        </div>
      )}

      {/* The Zonk Modal */}
      {showZonk && zonkData && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div
            ref={zonkRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="zonk-title"
            className={`max-w-md w-full border-4 rounded-2xl p-8 shadow-2xl transform animate-bounce ${getColorClasses(zonkData.color)}`}
          >
            <div className="text-center">
              {/* Icon */}
              <zonkData.icon className="w-24 h-24 mx-auto mb-4" />

              {/* Title */}
              <h2 id="zonk-title" className="text-4xl font-black mb-4">
                {zonkData.title}
              </h2>

              {/* Message */}
              <p className="text-xl font-semibold mb-6 leading-relaxed">
                {zonkData.message}
              </p>

              {/* Meme */}
              <p className="text-base italic opacity-80 mb-8">
                {zonkData.meme}
              </p>

              {/* Close Button */}
              <button
                onClick={() => setShowZonk(false)}
                className="bg-white text-gray-800 font-bold py-3 px-8 rounded-lg hover:bg-gray-100 transition-all shadow-md hover:shadow-lg"
              >
                Back to Work 💪
              </button>

              {/* Counter */}
              <p className="text-xs opacity-60 mt-6">Zonk #{clickCount}</p>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes bounce {
          0%,
          100% {
            transform: translateY(0) scale(1);
          }
          50% {
            transform: translateY(-20px) scale(1.05);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-in;
        }
        .animate-bounce {
          animation: bounce 0.6s ease-out;
        }
      `}</style>
    </div>
  );
};

export default ZonkButton;
