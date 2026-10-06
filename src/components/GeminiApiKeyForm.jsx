export default function GeminiApiKeyForm({
  apiKey,
  setApiKey,
  showApiKey,
  setShowApiKey,
  apiKeySaved,
  onSave,
  onClear,
}) {
  return (
    <div className="mt-3 space-y-2">
      <div className="relative">
        <input
          type={showApiKey ? "text" : "password"}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter Gemini API key..."
          aria-label="Gemini API key"
          className="min-h-[44px] w-full rounded-lg border-2 border-gray-300 bg-white px-4 py-2 pr-12 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
        <button
          type="button"
          onClick={() => setShowApiKey(!showApiKey)}
          aria-label={showApiKey ? "Hide API key" : "Show API key"}
          className="absolute right-0 top-1/2 min-h-[44px] min-w-[44px] -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white"
        >
          {showApiKey ? "👁️" : "👁️‍🗨️"}
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={!apiKey.trim()}
          className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {apiKeySaved ? "✓ Saved!" : "💾 Save Key"}
        </button>
        {apiKey && (
          <button
            onClick={onClear}
            className="rounded-lg bg-red-100 px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-200 dark:bg-red-500/20 dark:text-red-400 dark:hover:bg-red-500/30"
          >
            Clear
          </button>
        )}
      </div>

      <a
        href="https://aistudio.google.com/app/apikey"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
      >
        🔗 Get free API key from Google AI Studio →
      </a>
    </div>
  );
}
