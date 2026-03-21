import React, { useState, useEffect, useRef } from "react";
import { useLanguage } from "../contexts/LanguageContext";

/**
 * InclusiveCaptionEngine Component
 *
 * Real-time captioning system for accessibility:
 * - Shows native language text from peer voice
 * - Shows English translation for forms
 * - High-contrast for visual impairment support
 * - Syncs with voice output
 */
const InclusiveCaptionEngine = ({
  nativeText = "",
  englishText = "",
  isActive = false,
  isTranslation = false,
  sourceModel = "GENERAL",
  onApprove,
  className = "",
}) => {
  const { t } = useLanguage();
  const [isMinimized, setIsMinimized] = useState(false);
  const [highlightedWord, setHighlightedWord] = useState("");
  const captionRef = useRef(null);

  // Auto-scroll to keep latest text visible
  useEffect(() => {
    if (captionRef.current) {
      captionRef.current.scrollTop = captionRef.current.scrollHeight;
    }
  }, [nativeText, englishText]);

  if (!isActive || (!nativeText && !englishText)) {
    return null;
  }

  // Model badges
  const modelLabels = {
    AUDITOR: {
      label: "Evidence Auditor",
      color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    },
    SCRIBE: {
      label: "Statement Writer",
      color: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    },
    RATER: {
      label: "Rating Calculator",
      color: "bg-green-500/20 text-green-400 border-green-500/30",
    },
    DKB: {
      label: "Knowledge Base",
      color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    },
    GENERAL: {
      label: "AI Assistant",
      color: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    },
  };

  const modelInfo = modelLabels[sourceModel] || modelLabels.GENERAL;

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 bg-slate-800/90 border border-blue-500/30 rounded-full px-4 py-2 shadow-lg hover:bg-slate-700 transition-colors ${className}`}
      >
        <span className="text-sm text-blue-400">📝 Show Captions</span>
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 w-full max-w-2xl z-50 px-4 ${className}`}
    >
      <div className="bg-slate-900/95 border-2 border-blue-500/50 rounded-xl p-4 shadow-2xl backdrop-blur-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2 py-0.5 rounded-full border ${modelInfo.color}`}
            >
              {modelInfo.label}
            </span>
            {isTranslation && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                🌐 Translated
              </span>
            )}
          </div>
          <button
            onClick={() => setIsMinimized(true)}
            className="text-slate-500 hover:text-white text-sm transition-colors"
          >
            ─ Minimize
          </button>
        </div>

        {/* Caption Content */}
        <div
          ref={captionRef}
          className="max-h-40 overflow-y-auto custom-scrollbar"
        >
          {/* Native Language Text (what peer voice is saying) */}
          {nativeText && (
            <div className="mb-3">
              <p className="text-blue-400 text-xs font-medium mb-1 flex items-center gap-1">
                <span>🗣️</span> Peer Voice Says:
              </p>
              <p className="text-white text-lg font-medium leading-relaxed">
                "{nativeText}"
              </p>
            </div>
          )}

          {/* Divider if both texts present */}
          {nativeText && englishText && isTranslation && (
            <hr className="border-slate-700 my-3" />
          )}

          {/* English Translation (what goes in forms) */}
          {englishText && isTranslation && (
            <div>
              <p className="text-green-400 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                <span>📝</span> Form Output (English):
              </p>
              <p className="text-slate-300 text-md leading-relaxed bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                {englishText}
              </p>
            </div>
          )}
        </div>

        {/* Approve Button (for translations going to forms) */}
        {isTranslation && englishText && onApprove && (
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => onApprove(englishText)}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
            >
              ✓ Approve Translation
            </button>
            <button
              onClick={() => setIsMinimized(true)}
              className="bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 px-4 rounded-lg transition-colors text-sm"
            >
              Edit
            </button>
          </div>
        )}

        {/* Accessibility Settings */}
        <div className="mt-3 flex items-center justify-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-slate-800 rounded text-[10px]">
              Esc×3
            </kbd>
            Quick Exit
          </span>
          <span>|</span>
          <span>100% Private</span>
        </div>
      </div>
    </div>
  );
};

/**
 * Hook to manage caption state
 */
export const useCaptions = () => {
  const [captionState, setCaptionState] = useState({
    isActive: false,
    nativeText: "",
    englishText: "",
    isTranslation: false,
    sourceModel: "GENERAL",
  });

  const showCaption = (options) => {
    setCaptionState({
      isActive: true,
      nativeText: options.nativeText || "",
      englishText: options.englishText || "",
      isTranslation: options.isTranslation || false,
      sourceModel: options.sourceModel || "GENERAL",
    });
  };

  const hideCaption = () => {
    setCaptionState((prev) => ({
      ...prev,
      isActive: false,
    }));
  };

  const updateCaption = (text, isEnglish = false) => {
    setCaptionState((prev) => ({
      ...prev,
      [isEnglish ? "englishText" : "nativeText"]: text,
    }));
  };

  return {
    ...captionState,
    showCaption,
    hideCaption,
    updateCaption,
  };
};

export default InclusiveCaptionEngine;
