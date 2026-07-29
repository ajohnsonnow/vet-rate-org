/**
 * Vet-Rate.org - Language Suggestion Modal
 * Allows users to suggest new languages for inclusion
 * Generates a detailed feature request that can be passed to developers
 */

import { useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import ReportBugLink from "./ReportBugLink";
import ResponsiveModal from "./common/ResponsiveModal";

const regions = [
  { id: "pacific", name: "Pacific Islander", icon: "🌊" },
  { id: "asian", name: "Asian", icon: "🌏" },
  { id: "african", name: "African", icon: "🌍" },
  { id: "middle-eastern", name: "Middle Eastern", icon: "🕌" },
  { id: "native-american", name: "Native American", icon: "🪶" },
  { id: "caribbean", name: "Caribbean", icon: "🏝️" },
  { id: "european", name: "European", icon: "🌐" },
  { id: "south-american", name: "South American", icon: "🌎" },
  { id: "central-american", name: "Central American", icon: "🌎" },
  { id: "other", name: "Other", icon: "🌍" },
];

function buildFeatureRequestText({
  validLanguages,
  regionById,
  contactEmail,
  additionalNotes,
  currentLang,
  language,
}) {
  return `
═══════════════════════════════════════════════════════════════
🌍 LANGUAGE SUPPORT FEATURE REQUEST
═══════════════════════════════════════════════════════════════

📅 Submitted: ${new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}
📧 Contact: ${contactEmail || "Not provided"}
🌐 Submitted from: ${currentLang.nativeName} (${language})

───────────────────────────────────────────────────────────────
📋 REQUESTED LANGUAGES (${validLanguages.length})
───────────────────────────────────────────────────────────────

${validLanguages
  .map(
    (lang, i) => `
${i + 1}. ${lang.name}${lang.nativeName ? ` (${lang.nativeName})` : ""}
   ├─ Region: ${regionById[lang.region] || lang.region || "Not specified"}
   └─ Reason: ${lang.reason || "Community support / veteran population"}
`,
  )
  .join("\n")}

───────────────────────────────────────────────────────────────
📝 ADDITIONAL NOTES
───────────────────────────────────────────────────────────────
${additionalNotes || "None provided"}

───────────────────────────────────────────────────────────────
📊 IMPLEMENTATION CHECKLIST (For Developer)
───────────────────────────────────────────────────────────────
For each language, the following must be added:

1. LanguageContext.jsx - SUPPORTED_LANGUAGES
   □ code (ISO 639-1 or 639-3)
   □ name (English name)
   □ nativeName (Native script)
   □ flag (Unicode emoji)
   □ voiceCode (Web Speech API code)
   □ region (for grouping)
   □ direction ('ltr' or 'rtl')

2. multilingualTone.json - Add full entry:
   □ terms (VA jargon translations)
   □ support_phrases (greeting, working, found, validation, encouragement, closing)
   □ crisis_message (988 Veterans Crisis Line - CRITICAL)
   □ branch_greetings (optional)

3. crisis_keywords - Add crisis detection keywords in native language

4. APP_TRANSLATIONS - Basic UI strings

───────────────────────────────────────────────────────────────
🔗 REFERENCE FILES
───────────────────────────────────────────────────────────────
• src/contexts/LanguageContext.jsx
• src/config/multilingualTone.json
• src/components/LanguageSelector.jsx

───────────────────────────────────────────────────────────────
⚠️ CRISIS MESSAGE PRIORITY
───────────────────────────────────────────────────────────────
All crisis messages MUST direct to:
• Veterans Crisis Line: 988 (Press 1)
• Text: 838255
• Chat: VeteransCrisisLine.net

Verify translations with native speakers for accuracy!

═══════════════════════════════════════════════════════════════
                    END OF FEATURE REQUEST
═══════════════════════════════════════════════════════════════
`.trim();
}

const SuggestionModalHeader = ({ onClose, onReportBug }) => (
  <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-6 py-4 flex items-center justify-between">
    <div className="flex items-center gap-3">
      <span className="text-3xl">🌍</span>
      <div>
        <h2 id="language-suggestion-title" className="text-xl font-bold">
          Suggest a Language
        </h2>
        <p className="text-sm text-cyan-100">Help us be more inclusive!</p>
      </div>
    </div>
    <div className="flex items-center gap-2">
      {onReportBug && (
        <ReportBugLink
          onClick={onReportBug}
          variant="light"
          moduleName="Language Suggestion"
        />
      )}
      <button
        onClick={onClose}
        aria-label="Close"
        className="p-2 hover:bg-white/20 rounded-lg transition-colors"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  </div>
);

const LanguageEntryRow = ({
  lang,
  index,
  updateLanguage,
  removeLanguage,
  canRemove,
}) => (
  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700 space-y-3">
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
        Language #{index + 1}
      </span>
      {canRemove && (
        <button
          type="button"
          onClick={() => removeLanguage(index)}
          className="text-red-500 hover:text-red-700 text-sm"
        >
          Remove
        </button>
      )}
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <input
        type="text"
        placeholder="Language name (e.g., Bengali)"
        value={lang.name}
        onChange={(e) => updateLanguage(index, "name", e.target.value)}
        className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
        required
      />
      <input
        type="text"
        placeholder="Native name (e.g., বাংলা)"
        value={lang.nativeName}
        onChange={(e) => updateLanguage(index, "nativeName", e.target.value)}
        className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
      />
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <select
        value={lang.region}
        onChange={(e) => updateLanguage(index, "region", e.target.value)}
        className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
      >
        <option value="">Select region...</option>
        {regions.map((r) => (
          <option key={r.id} value={r.id}>
            {r.icon} {r.name}
          </option>
        ))}
      </select>
      <input
        type="text"
        placeholder="Why this language? (optional)"
        value={lang.reason}
        onChange={(e) => updateLanguage(index, "reason", e.target.value)}
        className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
      />
    </div>
  </div>
);

const LanguageEntryList = ({
  languages,
  updateLanguage,
  removeLanguage,
  addLanguage,
}) => (
  <div className="space-y-4">
    {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
      Languages to Add
    </label>

    {languages.map((lang, index) => (
      <LanguageEntryRow
        key={index}
        lang={lang}
        index={index}
        updateLanguage={updateLanguage}
        removeLanguage={removeLanguage}
        canRemove={languages.length > 1}
      />
    ))}

    <button
      type="button"
      onClick={addLanguage}
      className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-500 dark:text-gray-400 hover:border-cyan-500 hover:text-cyan-500 transition-colors"
    >
      + Add Another Language
    </button>
  </div>
);

const GeneratedRequestResult = ({
  generatedRequest,
  copyToClipboard,
  downloadRequest,
}) => (
  <div className="space-y-4">
    {/* Success message */}
    <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800 flex items-start gap-3">
      <span className="text-2xl">✅</span>
      <div>
        <p className="font-bold text-green-800 dark:text-green-200">
          Feature Request Generated!
        </p>
        <p className="text-sm text-green-700 dark:text-green-300 mt-1">
          Copy this request and share it with the Vet-Rate development team.
        </p>
      </div>
    </div>

    {/* Generated request */}
    <div className="relative">
      <pre className="bg-gray-900 text-gray-100 p-4 rounded-xl overflow-x-auto text-xs font-mono max-h-[300px] overflow-y-auto">
        {generatedRequest}
      </pre>
      <div className="absolute top-2 right-2 flex gap-2">
        <button
          onClick={copyToClipboard}
          className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 text-white text-xs rounded-lg transition-colors"
        >
          📋 Copy
        </button>
        <button
          onClick={downloadRequest}
          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg transition-colors"
        >
          ⬇️ Download
        </button>
      </div>
    </div>

    {/* Share instructions */}
    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
      <p className="text-sm text-amber-800 dark:text-amber-200">
        <strong>📧 How to submit:</strong> Share this feature request via{" "}
        <a
          href="https://github.com/your-repo/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          GitHub Issues
        </a>{" "}
        or email it to the development team. We review all submissions!
      </p>
    </div>
  </div>
);

const SuggestionModalFooter = ({ isSubmitted, resetForm, onClose }) =>
  !isSubmitted ? (
    <button
      type="submit"
      form="lang-suggestion-form"
      className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-bold text-lg rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
    >
      <span>🚀</span>
      <span>Generate Feature Request</span>
      <span className="text-sm font-normal opacity-80">Bon Voyage!</span>
    </button>
  ) : (
    <div className="flex gap-3">
      <button
        onClick={resetForm}
        className="flex-1 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        Suggest More Languages
      </button>
      <button
        onClick={onClose}
        className="flex-1 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold rounded-xl hover:from-cyan-700 hover:to-blue-700 transition-all"
      >
        Done
      </button>
    </div>
  );

const SuggestionForm = ({
  onSubmit,
  languages,
  updateLanguage,
  removeLanguage,
  addLanguage,
  contactEmail,
  setContactEmail,
  additionalNotes,
  setAdditionalNotes,
}) => (
  <form id="lang-suggestion-form" onSubmit={onSubmit} className="space-y-6">
    {/* Intro */}
    <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-xl p-4 border border-cyan-200 dark:border-cyan-800">
      <p className="text-sm text-cyan-800 dark:text-cyan-200">
        🎖️ <strong>Every veteran deserves support in their language.</strong>{" "}
        Suggest languages for our next update. We especially welcome languages
        from underserved military communities.
      </p>
    </div>

    {/* Languages */}
    <LanguageEntryList
      languages={languages}
      updateLanguage={updateLanguage}
      removeLanguage={removeLanguage}
      addLanguage={addLanguage}
    />

    {/* Contact */}
    <div>
      {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
        Contact Email (optional)
      </label>
      <input
        type="email"
        placeholder="your@email.com"
        value={contactEmail}
        onChange={(e) => setContactEmail(e.target.value)}
        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
      />
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        We may reach out if we need native speaker verification
      </p>
    </div>

    {/* Notes */}
    <div>
      {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
        Additional Notes
      </label>
      <textarea
        placeholder="Any context about the veteran community that speaks this language, common phrases, cultural considerations..."
        value={additionalNotes}
        onChange={(e) => setAdditionalNotes(e.target.value)}
        rows={3}
        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
      />
    </div>
  </form>
);

function downloadFeatureRequestFile(generatedRequest) {
  const blob = new Blob([generatedRequest], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `language-request-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function useLanguageSuggestionForm(currentLang, language) {
  const [languages, setLanguages] = useState([
    { name: "", nativeName: "", region: "", reason: "" },
  ]);
  const [contactEmail, setContactEmail] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [generatedRequest, setGeneratedRequest] = useState("");

  const addLanguage = () => {
    setLanguages([
      ...languages,
      { name: "", nativeName: "", region: "", reason: "" },
    ]);
  };

  const removeLanguage = (index) => {
    if (languages.length > 1) {
      setLanguages(languages.filter((_, i) => i !== index));
    }
  };

  const updateLanguage = (index, field, value) => {
    const updated = [...languages];
    updated[index][field] = value;
    setLanguages(updated);
  };

  const generateFeatureRequest = () => {
    const validLanguages = languages.filter((l) => l.name.trim());

    if (validLanguages.length === 0) {
      return null;
    }

    const _timestamp = new Date().toISOString();
    const regionById = Object.fromEntries(regions.map((r) => [r.id, r.name]));

    return buildFeatureRequestText({
      validLanguages,
      regionById,
      contactEmail,
      additionalNotes,
      currentLang,
      language,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const request = generateFeatureRequest();
    if (request) {
      setGeneratedRequest(request);
      setIsSubmitted(true);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedRequest);
    // Could add a toast notification here
  };

  const downloadRequest = () => downloadFeatureRequestFile(generatedRequest);

  const resetForm = () => {
    setLanguages([{ name: "", nativeName: "", region: "", reason: "" }]);
    setContactEmail("");
    setAdditionalNotes("");
    setIsSubmitted(false);
    setGeneratedRequest("");
  };

  return {
    languages,
    contactEmail,
    setContactEmail,
    additionalNotes,
    setAdditionalNotes,
    isSubmitted,
    generatedRequest,
    addLanguage,
    removeLanguage,
    updateLanguage,
    handleSubmit,
    copyToClipboard,
    downloadRequest,
    resetForm,
  };
}

const LanguageSuggestionModal = ({ isOpen, onClose, onReportBug }) => {
  const { _t, language, getCurrentLanguage } = useLanguage();
  const currentLang = getCurrentLanguage();

  const {
    languages,
    contactEmail,
    setContactEmail,
    additionalNotes,
    setAdditionalNotes,
    isSubmitted,
    generatedRequest,
    addLanguage,
    removeLanguage,
    updateLanguage,
    handleSubmit,
    copyToClipboard,
    downloadRequest,
    resetForm,
  } = useLanguageSuggestionForm(currentLang, language);

  const footer = (
    <SuggestionModalFooter
      isSubmitted={isSubmitted}
      resetForm={resetForm}
      onClose={onClose}
    />
  );

  return (
    <ResponsiveModal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      labelledBy="language-suggestion-title"
      footer={footer}
      header={
        <SuggestionModalHeader onClose={onClose} onReportBug={onReportBug} />
      }
    >
      {!isSubmitted ? (
        <SuggestionForm
          onSubmit={handleSubmit}
          languages={languages}
          updateLanguage={updateLanguage}
          removeLanguage={removeLanguage}
          addLanguage={addLanguage}
          contactEmail={contactEmail}
          setContactEmail={setContactEmail}
          additionalNotes={additionalNotes}
          setAdditionalNotes={setAdditionalNotes}
        />
      ) : (
        <GeneratedRequestResult
          generatedRequest={generatedRequest}
          copyToClipboard={copyToClipboard}
          downloadRequest={downloadRequest}
        />
      )}

      {/* Footer note */}
      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl px-6 py-3">
        <p className="text-xs text-center text-gray-500 dark:text-gray-400">
          🎖️ Currently supporting 40+ languages • Your suggestion helps veterans
          worldwide
        </p>
      </div>
    </ResponsiveModal>
  );
};

export default LanguageSuggestionModal;
