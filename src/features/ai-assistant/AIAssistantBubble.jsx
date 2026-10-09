import { lazy, Suspense } from "react";
import { useAIAssistant } from "../../hooks/useAIAssistant";

// B-H09: AIAssistant (and its ~127 KB AI orchestration chunk) is only needed once
// the veteran opens the Navigator. Lazy-load it so a search-only visit doesn't pay
// for it in the entry bundle.
const AIAssistant = lazy(() => import("../../components/AIAssistant"));

/**
 * AI Assistant (The Navigator) — floating bottom-left bubble + slide-out
 * modal. Always rendered alongside the main UI.
 *
 * Owns the open/close state via the useAIAssistant hook. `currentTool`
 * is the context label passed in by App.jsx so the assistant knows what
 * surface the user is currently on.
 *
 * Extracted from App.jsx (audit #35, B61).
 */
export default function AIAssistantBubble({ currentTool }) {
  const aiAssistant = useAIAssistant();

  if (aiAssistant.isOpen) {
    return (
      <Suspense fallback={null}>
        <AIAssistant
          currentTool={currentTool}
          onClose={aiAssistant.close}
          onOpenAISettings={() =>
            window.dispatchEvent(new CustomEvent("openAISettings"))
          }
        />
      </Suspense>
    );
  }

  return (
    <button
      id="tour-ai-navigator-btn"
      onClick={() => aiAssistant.open(currentTool)}
      className="above-mobile-nav fixed bottom-4 left-4 z-50 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-full p-4 shadow-2xl transition-all hover:scale-110 group"
      aria-label="Open AI Navigator - Your personal claims guide"
    >
      <div className="relative">
        <span className="text-2xl">🧭</span>
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></span>
      </div>
      <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        Ask me anything about VA claims! 💬
      </div>
    </button>
  );
}
