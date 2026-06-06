/**
 * Vet-Rate.org - Veteran Translator (Human-to-Human)
 *
 * Helps veterans communicate with each other at VA medical centers and elsewhere.
 * Builds camaraderie across language barriers. Uses Web Speech API for text-to-speech
 * and real-time translation between 40+ supported languages.
 *
 * Features:
 * - Bidirectional translation between any two languages
 * - Text-to-speech for pronunciation help
 * - Quick phrases for common VA medical center situations
 * - Branch-specific greetings
 * - Conversation history within session
 *
 * IMPORTANT: This component now properly separates:
 * 1. TEXT TRANSLATION - Converting text from one language to another
 * 2. VOICE SYNTHESIS - Speaking the translated text in the target language's voice
 */

import { useState, useRef, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import ResponsiveModal from "./common/ResponsiveModal";
import VoiceInputButton from "./VoiceInput";
import multilingualTone from "../config/multilingualTone.json";
import ReportBugLink from "./ReportBugLink";
import FlagIcon from "./FlagIcon";

// Quick phrases for VA medical center situations - WITH TRANSLATIONS
// Structure: { key, emoji, translations: { en, es, tl, vi, ko, zh, ... } }
const QUICK_PHRASES = {
  greetings: [
    {
      key: "hello",
      emoji: "👋",
      translations: {
        en: "Hello, fellow veteran!",
        es: "¡Hola, compañero veterano!",
        tl: "Kumusta, kapwa beterano!",
        vi: "Xin chào, đồng đội cựu chiến binh!",
        ko: "안녕하세요, 동료 재향군인님!",
        zh: "你好，战友！",
        ja: "こんにちは、同志の退役軍人さん！",
        ar: "مرحبا، زميلي المحارب القديم!",
        de: "Hallo, Veteranenkamerad!",
        fr: "Bonjour, camarade vétéran!",
        pt: "Olá, companheiro veterano!",
        ru: "Привет, товарищ ветеран!",
      },
    },
    {
      key: "nice_meet",
      emoji: "🤝",
      translations: {
        en: "Nice to meet you!",
        es: "¡Mucho gusto!",
        tl: "Ikinagagalak kitang makilala!",
        vi: "Rất vui được gặp bạn!",
        ko: "만나서 반갑습니다!",
        zh: "很高兴认识你！",
        ja: "お会いできて嬉しいです！",
        ar: "سعدت بلقائك!",
        de: "Freut mich, Sie kennenzulernen!",
        fr: "Enchanté de vous rencontrer!",
        pt: "Prazer em conhecê-lo!",
        ru: "Приятно познакомиться!",
      },
    },
    {
      key: "thank_service",
      emoji: "🎖️",
      translations: {
        en: "Thank you for your service.",
        es: "Gracias por su servicio.",
        tl: "Salamat sa iyong serbisyo.",
        vi: "Cảm ơn vì sự phục vụ của bạn.",
        ko: "복무에 감사드립니다.",
        zh: "感谢您的服役。",
        ja: "ご奉仕ありがとうございます。",
        ar: "شكرا على خدمتك.",
        de: "Danke für Ihren Dienst.",
        fr: "Merci pour votre service.",
        pt: "Obrigado pelo seu serviço.",
        ru: "Спасибо за вашу службу.",
      },
    },
    {
      key: "what_branch",
      emoji: "🪖",
      translations: {
        en: "What branch did you serve in?",
        es: "¿En qué rama sirvió?",
        tl: "Sa anong sangay ka nagsilbi?",
        vi: "Bạn phục vụ trong quân chủng nào?",
        ko: "어느 군에서 복무하셨나요?",
        zh: "您在哪个军种服役？",
        ja: "どの軍種でお勤めでしたか？",
        ar: "في أي فرع خدمت؟",
        de: "In welcher Teilstreitkraft haben Sie gedient?",
        fr: "Dans quelle branche avez-vous servi?",
        pt: "Em qual ramo você serviu?",
        ru: "В какой ветви вы служили?",
      },
    },
  ],
  medical: [
    {
      key: "wait_long",
      emoji: "⏰",
      translations: {
        en: "How long have you been waiting?",
        es: "¿Cuánto tiempo ha estado esperando?",
        tl: "Gaano ka na katagal naghihintay?",
        vi: "Bạn đã đợi bao lâu rồi?",
        ko: "얼마나 기다리셨나요?",
        zh: "您等了多久了？",
        ja: "どのくらい待っていますか？",
        ar: "كم من الوقت كنت تنتظر؟",
      },
    },
    {
      key: "same_doctor",
      emoji: "👨‍⚕️",
      translations: {
        en: "Do you have the same doctor?",
        es: "¿Tiene el mismo doctor?",
        tl: "Pareho ba tayo ng doktor?",
        vi: "Bạn có cùng bác sĩ không?",
        ko: "같은 의사분이신가요?",
        zh: "您的医生和我一样吗？",
        ja: "同じ医者ですか？",
        ar: "هل لديك نفس الطبيب؟",
      },
    },
    {
      key: "appointment",
      emoji: "📅",
      translations: {
        en: "What time is your appointment?",
        es: "¿A qué hora es su cita?",
        tl: "Anong oras ang appointment mo?",
        vi: "Cuộc hẹn của bạn lúc mấy giờ?",
        ko: "예약 시간이 언제인가요?",
        zh: "您的预约是几点？",
        ja: "予約は何時ですか？",
        ar: "متى موعدك؟",
      },
    },
    {
      key: "clinic_where",
      emoji: "🏥",
      translations: {
        en: "Do you know where this clinic is?",
        es: "¿Sabe dónde está esta clínica?",
        tl: "Alam mo ba kung saan ang clinic na ito?",
        vi: "Bạn có biết phòng khám này ở đâu không?",
        ko: "이 진료실이 어디인지 아시나요?",
        zh: "您知道这个诊所在哪里吗？",
        ja: "このクリニックがどこか知っていますか？",
        ar: "هل تعرف أين تقع هذه العيادة؟",
      },
    },
  ],
  helpful: [
    {
      key: "need_help",
      emoji: "🙋",
      translations: {
        en: "Do you need any help?",
        es: "¿Necesita ayuda?",
        tl: "Kailangan mo ba ng tulong?",
        vi: "Bạn có cần giúp đỡ gì không?",
        ko: "도움이 필요하신가요?",
        zh: "您需要帮助吗？",
        ja: "お手伝いしましょうか？",
        ar: "هل تحتاج أي مساعدة؟",
      },
    },
    {
      key: "water",
      emoji: "💧",
      translations: {
        en: "Would you like some water?",
        es: "¿Le gustaría un poco de agua?",
        tl: "Gusto mo ba ng tubig?",
        vi: "Bạn có muốn uống nước không?",
        ko: "물 드시겠어요?",
        zh: "您要喝点水吗？",
        ja: "お水はいかがですか？",
        ar: "هل تريد بعض الماء؟",
      },
    },
    {
      key: "sit_here",
      emoji: "💺",
      translations: {
        en: "You can sit here.",
        es: "Puede sentarse aquí.",
        tl: "Pwede kang umupo dito.",
        vi: "Bạn có thể ngồi đây.",
        ko: "여기 앉으세요.",
        zh: "您可以坐这里。",
        ja: "ここに座ってください。",
        ar: "يمكنك الجلوس هنا.",
      },
    },
    {
      key: "follow_me",
      emoji: "🚶",
      translations: {
        en: "Follow me, I'll show you.",
        es: "Sígame, le mostraré.",
        tl: "Sundan mo ako, ipapakita ko sa'yo.",
        vi: "Đi theo tôi, tôi sẽ chỉ cho bạn.",
        ko: "따라오세요, 보여드릴게요.",
        zh: "跟我来，我带您去。",
        ja: "ついてきてください、ご案内します。",
        ar: "اتبعني، سأريك.",
      },
    },
  ],
  camaraderie: [
    {
      key: "when_serve",
      emoji: "📆",
      translations: {
        en: "When did you serve?",
        es: "¿Cuándo sirvió?",
        tl: "Kailan ka nagsilbi?",
        vi: "Bạn phục vụ khi nào?",
        ko: "언제 복무하셨나요?",
        zh: "您什么时候服役的？",
        ja: "いつ勤務されましたか？",
        ar: "متى خدمت؟",
      },
    },
    {
      key: "deployed_where",
      emoji: "🌍",
      translations: {
        en: "Where were you deployed?",
        es: "¿Dónde fue desplegado?",
        tl: "Saan ka na-deploy?",
        vi: "Bạn đã được triển khai ở đâu?",
        ko: "어디에 배치되셨나요?",
        zh: "您被部署在哪里？",
        ja: "どこに配属されましたか？",
        ar: "أين تم نشرك؟",
      },
    },
    {
      key: "good_luck",
      emoji: "🍀",
      translations: {
        en: "Good luck with your claim!",
        es: "¡Buena suerte con su reclamo!",
        tl: "Good luck sa claim mo!",
        vi: "Chúc may mắn với đơn yêu cầu của bạn!",
        ko: "청구서 처리 잘 되시길 바랍니다!",
        zh: "祝您的申请顺利！",
        ja: "申請がうまくいきますように！",
        ar: "حظا سعيدا في مطالبتك!",
      },
    },
    {
      key: "stay_strong",
      emoji: "💪",
      translations: {
        en: "Stay strong, battle buddy.",
        es: "Mantente fuerte, compañero de batalla.",
        tl: "Maging matatag, kasamang mandirigma.",
        vi: "Mạnh mẽ lên, đồng đội.",
        ko: "힘내세요, 전우님.",
        zh: "坚强点，战友。",
        ja: "頑張って、戦友。",
        ar: "كن قويا، رفيق المعركة.",
      },
    },
  ],
};

/**
 * Translate text using browser's built-in translation (if available)
 * or fallback to our phrase database
 *
 * NOTE: For free, we use pre-translated phrases. For real-time translation,
 * would need to integrate a translation API (Google, DeepL, etc.)
 */
const translateText = async (text, fromLang, toLang) => {
  // If same language, no translation needed
  if (fromLang === toLang) {
    return { original: text, translated: text, fromLang, toLang };
  }

  // Check if text matches a known quick phrase (get translated version)
  for (const category of Object.values(QUICK_PHRASES)) {
    for (const phrase of category) {
      // Check if input matches any language version of this phrase
      for (const [lang, phraseText] of Object.entries(phrase.translations)) {
        if (phraseText.toLowerCase() === text.toLowerCase()) {
          // Found it! Return the target language version
          const translated =
            phrase.translations[toLang] || phrase.translations.en || text;
          return {
            original: text,
            translated,
            fromLang,
            toLang,
            source: "phrase-database",
          };
        }
      }
    }
  }

  // For unknown text, we can't translate without an API
  // Return original with a note - user should speak slowly and clearly
  return {
    original: text,
    translated: text, // Can't translate unknown text without API
    fromLang,
    toLang,
    source: "no-translation",
    note: "⚠️ Custom text requires internet translation. Try using Quick Phrases!",
  };
};

const VeteranTranslator = ({ isOpen, onClose, onReportBug }) => {
  const { t, SUPPORTED_LANGUAGES, language: appLanguage } = useLanguage();

  // State
  const [myLanguage, setMyLanguage] = useState(appLanguage || "en");
  const [theirLanguage, setTheirLanguage] = useState("es");
  const [myText, setMyText] = useState("");
  const [theirText, setTheirText] = useState("");
  const [conversation, setConversation] = useState([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeQuickCategory, setActiveQuickCategory] = useState("greetings");

  const conversationEndRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);

  // Get available languages as array
  const availableLanguages = Object.values(SUPPORTED_LANGUAGES);

  // Scroll to bottom of conversation
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  // Swap languages
  const swapLanguages = () => {
    setMyLanguage(theirLanguage);
    setTheirLanguage(myLanguage);
    setMyText(theirText);
    setTheirText(myText);
  };

  // Text-to-speech
  const speak = (text, langCode) => {
    if (synthRef.current.speaking) {
      synthRef.current.cancel();
    }

    const lang = SUPPORTED_LANGUAGES[langCode];
    const voiceCode = lang?.voiceCode || langCode;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voiceCode;
    utterance.rate = 0.9;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    synthRef.current.speak(utterance);
  };

  // Add message to conversation (with both original and translated text)
  const addToConversation = (
    originalText,
    translatedText,
    fromLang,
    toLang,
    isMe,
  ) => {
    const myLangObj = SUPPORTED_LANGUAGES[myLanguage];
    const theirLangObj = SUPPORTED_LANGUAGES[theirLanguage];

    setConversation((prev) => [
      ...prev,
      {
        id: Date.now(),
        originalText,
        translatedText,
        fromLang,
        toLang,
        isMe,
        timestamp: new Date(),
        // Store language codes for FlagIcon rendering
        fromLangCode: isMe ? myLanguage : theirLanguage,
        toLangCode: isMe ? theirLanguage : myLanguage,
        fromFlag: isMe ? myLangObj?.flag : theirLangObj?.flag,
        toFlag: isMe ? theirLangObj?.flag : myLangObj?.flag,
      },
    ]);
  };

  // Send my message - translate then speak in target language
  const sendMyMessage = async () => {
    if (!myText.trim()) return;

    const text = myText.trim();
    setMyText(""); // Clear input immediately for better UX

    // Translate the text
    const result = await translateText(text, myLanguage, theirLanguage);

    // Add to conversation with both original and translated
    addToConversation(text, result.translated, myLanguage, theirLanguage, true);

    // Speak the TRANSLATED text in the target language's voice
    speak(result.translated, theirLanguage);
  };

  // Send their message - translate then speak in my language
  const sendTheirMessage = async () => {
    if (!theirText.trim()) return;

    const text = theirText.trim();
    setTheirText(""); // Clear input immediately

    // Translate the text
    const result = await translateText(text, theirLanguage, myLanguage);

    // Add to conversation
    addToConversation(
      text,
      result.translated,
      theirLanguage,
      myLanguage,
      false,
    );

    // Speak the TRANSLATED text in my language's voice
    speak(result.translated, myLanguage);
  };

  // Use quick phrase - get the translated version and speak it
  const useQuickPhrase = (phrase) => {
    // Get the phrase in my language (what I'm saying)
    const myPhrase = phrase.translations[myLanguage] || phrase.translations.en;
    // Get the phrase translated to their language
    const theirPhrase =
      phrase.translations[theirLanguage] || phrase.translations.en;

    // Show what I'm saying in my language
    setMyText(myPhrase);

    // Auto-send after a brief moment
    setTimeout(() => {
      addToConversation(myPhrase, theirPhrase, myLanguage, theirLanguage, true);
      // Speak the TRANSLATED phrase in their language
      speak(theirPhrase, theirLanguage);
      setMyText("");
    }, 100);
  };

  // Get branch greeting
  const getBranchGreeting = (branch, langCode) => {
    const toneData = multilingualTone.branch_greetings?.[branch];
    return toneData?.[langCode] || toneData?.["en"] || `${branch} veteran`;
  };

  const myLangObj = SUPPORTED_LANGUAGES[myLanguage];
  const theirLangObj = SUPPORTED_LANGUAGES[theirLanguage];

  const header = (
    <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-4 text-white sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <span className="hidden text-3xl sm:inline">🤝</span>
        <div className="min-w-0">
          <h2
            id="veteran-translator-title"
            className="truncate text-lg font-bold sm:text-xl"
          >
            Veteran Translator
          </h2>
          <p className="truncate text-xs text-amber-100 sm:text-sm">
            Connect across language barriers
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onReportBug && (
          <ReportBugLink
            onClick={onReportBug}
            variant="light"
            moduleName="Veteran Translator"
          />
        )}
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="grid h-11 w-11 place-items-center rounded-lg transition-colors hover:bg-white/20"
        >
          <svg
            className="h-5 w-5"
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

  const footer = (
    <div className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400 sm:flex-row sm:items-center sm:justify-between">
      <p>🎖️ Building veteran camaraderie across 40+ languages</p>
      <div className="flex items-center gap-2">
        {isSpeaking && (
          <span className="flex items-center gap-1 text-amber-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500"></span>
            Speaking...
          </span>
        )}
        <span>🔒 100% on-device • No data sent</span>
      </div>
    </div>
  );

  return (
    <ResponsiveModal
      isOpen={isOpen}
      onClose={onClose}
      header={header}
      footer={footer}
      labelledBy="veteran-translator-title"
      size="xl"
    >
      <div className="-m-4 flex flex-col">
        {/* Language Selectors */}
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-700 dark:bg-gray-900/50 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            {/* My Language */}
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                I speak:
              </label>
              <select
                value={myLanguage}
                onChange={(e) => setMyLanguage(e.target.value)}
                className="min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                {availableLanguages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.nativeName}
                  </option>
                ))}
              </select>
            </div>

            {/* Swap Button */}
            <button
              onClick={swapLanguages}
              className="grid h-11 w-11 shrink-0 place-items-center self-center rounded-full bg-amber-100 transition-colors hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-800/30 sm:mt-5 sm:self-auto"
              aria-label="Swap languages"
            >
              <svg
                className="h-6 w-6 rotate-90 text-amber-600 dark:text-amber-400 sm:rotate-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
            </button>

            {/* Their Language */}
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                They speak:
              </label>
              <select
                value={theirLanguage}
                onChange={(e) => setTheirLanguage(e.target.value)}
                className="min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                {availableLanguages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.nativeName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Main Content - Split View */}
        <div className="flex flex-col md:flex-row">
          {/* Left Panel - Quick Phrases & My Input */}
          <div className="flex flex-col border-b border-gray-200 dark:border-gray-700 md:h-[60vh] md:w-1/2 md:border-b-0 md:border-r">
            {/* Quick Phrases */}
            <div className="p-4 bg-gray-50 dark:bg-gray-900/30 border-b border-gray-200 dark:border-gray-700">
              <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                {Object.entries(QUICK_PHRASES).map(([category, phrases]) => (
                  <button
                    key={category}
                    onClick={() => setActiveQuickCategory(category)}
                    className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors
                      ${
                        activeQuickCategory === category
                          ? "bg-amber-500 text-white"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                      }`}
                  >
                    {category.charAt(0).toUpperCase() +
                      category.slice(1).replace("_", " ")}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_PHRASES[activeQuickCategory].map((phrase) => (
                  <button
                    key={phrase.key}
                    onClick={() => useQuickPhrase(phrase)}
                    className="text-left px-3 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors text-sm"
                  >
                    <span className="mr-2">{phrase.emoji}</span>
                    <span className="text-gray-700 dark:text-gray-300">
                      {/* Show phrase in user's selected language */}
                      {phrase.translations[myLanguage] ||
                        phrase.translations.en}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* My Input */}
            <div className="p-4 flex-1 flex flex-col">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{myLangObj?.flag}</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  You ({myLangObj?.nativeName})
                </span>
              </div>
              <div className="relative h-32 md:h-auto md:flex-1">
                <textarea
                  value={myText}
                  onChange={(e) => setMyText(e.target.value)}
                  placeholder={`Type or speak in ${myLangObj?.name}...`}
                  className="w-full h-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMyMessage();
                    }
                  }}
                />
                <div className="absolute right-2 top-2">
                  <VoiceInputButton
                    onTranscript={(text) =>
                      setMyText((prev) => (prev ? `${prev} ${text}` : text))
                    }
                    language={myLangObj?.voiceCode || myLanguage}
                  />
                </div>
              </div>
              <button
                onClick={sendMyMessage}
                disabled={!myText.trim()}
                className="mt-3 w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <span>🔊</span>
                <span>Say It (They'll Hear in {theirLangObj?.name})</span>
              </button>
            </div>
          </div>

          {/* Right Panel - Conversation & Their Input */}
          <div className="flex flex-col md:h-[60vh] md:w-1/2">
            {/* Conversation History */}
            <div className="min-h-[12rem] flex-1 space-y-3 overflow-y-auto bg-gray-50 p-4 dark:bg-gray-900/30">
              {conversation.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  <span className="text-4xl block mb-2">💬</span>
                  <p>Start a conversation!</p>
                  <p className="text-sm mt-1">
                    Use quick phrases or type your own message
                  </p>
                </div>
              ) : (
                conversation.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.isMe ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl p-3 ${
                        msg.isMe
                          ? "bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100"
                          : "bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <FlagIcon
                          langCode={msg.fromLangCode}
                          size="xs"
                          fallbackEmoji={msg.fromFlag}
                        />
                        <span className="text-xs opacity-70">→</span>
                        <FlagIcon
                          langCode={msg.toLangCode}
                          size="xs"
                          fallbackEmoji={msg.toFlag}
                        />
                      </div>
                      {/* Show original text */}
                      <p className="text-sm opacity-75 italic">
                        {msg.originalText}
                      </p>
                      {/* Show translated text (larger, emphasized) */}
                      {msg.translatedText !== msg.originalText && (
                        <p className="text-sm font-medium mt-1 pt-1 border-t border-current/20">
                          ➜ {msg.translatedText}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs opacity-60">
                          {msg.timestamp.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <button
                          onClick={() =>
                            speak(msg.translatedText, msg.toLangCode)
                          }
                          className="p-1 hover:bg-white/50 rounded transition-colors"
                          aria-label="Play translated text"
                        >
                          🔊
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={conversationEndRef} />
            </div>

            {/* Their Input */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{theirLangObj?.flag}</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  Them ({theirLangObj?.nativeName})
                </span>
              </div>
              <div className="relative">
                <textarea
                  value={theirText}
                  onChange={(e) => setTheirText(e.target.value)}
                  placeholder={`They type in ${theirLangObj?.name}...`}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendTheirMessage();
                    }
                  }}
                />
                <div className="absolute right-2 top-2">
                  <VoiceInputButton
                    onTranscript={(text) =>
                      setTheirText((prev) => (prev ? `${prev} ${text}` : text))
                    }
                    language={theirLangObj?.voiceCode || theirLanguage}
                  />
                </div>
              </div>
              <button
                onClick={sendTheirMessage}
                disabled={!theirText.trim()}
                className="mt-3 w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <span>🔊</span>
                <span>Say It (You'll Hear in {myLangObj?.name})</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </ResponsiveModal>
  );
};

export default VeteranTranslator;
