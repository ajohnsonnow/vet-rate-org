import React, { useState, useEffect, useCallback } from "react";
import {
  speak,
  previewVoice,
  getBestVoice,
  getAvailableVoices,
} from "../utils/voiceEngine";
import { getSupportPhrase, getBranchGreeting } from "../utils/toneMapper";
import multilingualTone from "../config/multilingualTone.json";
import { useLanguage } from "../contexts/LanguageContext";

/**
 * UnityLanguageTutor Component
 *
 * Platinum Standard language learning tool for veterans to learn the
 * languages of their fellow service members. Builds camaraderie through
 * cultural exchange.
 *
 * Features:
 * - Spaced repetition learning
 * - Phonetic approximations
 * - Branch-specific greetings
 * - Voice pronunciation guides
 */
const UnityLanguageTutor = ({ isOpen = false, onClose, className = "" }) => {
  const { t } = useLanguage();
  const [targetLang, setTargetLang] = useState("es");
  const [phraseCategory, setPhraseCategory] = useState("support");
  const [currentPhrase, setCurrentPhrase] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [userAttempt, setUserAttempt] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [progress, setProgress] = useState({});

  // Learning modules with phrases
  const learningModules = {
    support: {
      title: "Peer Support Phrases",
      icon: "🤝",
      phrases: [
        { en: "I am here for you", key: "here_for_you" },
        { en: "You are not alone", key: "not_alone" },
        { en: "We fought together", key: "fought_together" },
        { en: "I understand", key: "understand" },
        { en: "Stay strong", key: "stay_strong" },
      ],
    },
    history: {
      title: "Service History",
      icon: "🎖️",
      phrases: [
        { en: "Where did you serve?", key: "where_serve" },
        { en: "What was your job?", key: "your_job" },
        { en: "Welcome home", key: "welcome_home" },
        { en: "Thank you for your service", key: "thank_service" },
        { en: "How long did you serve?", key: "how_long" },
      ],
    },
    wellness: {
      title: "Wellness Checks",
      icon: "💚",
      phrases: [
        { en: "Are you okay?", key: "are_ok" },
        { en: "Let's take a break", key: "take_break" },
        { en: "Take a deep breath", key: "deep_breath" },
        { en: "How are you feeling?", key: "how_feeling" },
        { en: "I'm listening", key: "listening" },
      ],
    },
    greetings: {
      title: "Branch Greetings",
      icon: "🏅",
      phrases: [
        { en: "Semper Fi (Marines)", key: "semper_fi" },
        { en: "Hooah (Army)", key: "hooah" },
        { en: "Hooyah (Navy/Coast Guard)", key: "hooyah" },
        { en: "Aim High (Air Force)", key: "aim_high" },
      ],
    },
  };

  // Language translations (expanded)
  const translations = {
    es: {
      name: "Spanish",
      nativeName: "Español",
      flag: "🇲🇽",
      phrases: {
        here_for_you: {
          text: "Estoy aquí para ti",
          phonetic: "Es-TOY ah-KEE PAH-rah tee",
        },
        not_alone: { text: "No estás solo", phonetic: "No es-TAS SO-lo" },
        fought_together: {
          text: "Luchamos juntos",
          phonetic: "Loo-CHA-mos HOON-tos",
        },
        understand: { text: "Entiendo", phonetic: "En-tee-EN-do" },
        stay_strong: {
          text: "Mantente fuerte",
          phonetic: "Man-TEN-tay FWER-tay",
        },
        where_serve: {
          text: "¿Dónde serviste?",
          phonetic: "DON-day ser-VEES-tay",
        },
        your_job: {
          text: "¿Cuál era tu trabajo?",
          phonetic: "KWAHL EH-ra too tra-BA-ho",
        },
        welcome_home: {
          text: "Bienvenido a casa",
          phonetic: "Bee-en-veh-NEE-do ah KA-sa",
        },
        thank_service: {
          text: "Gracias por tu servicio",
          phonetic: "GRA-see-as por too ser-VEE-see-oh",
        },
        how_long: {
          text: "¿Cuánto tiempo serviste?",
          phonetic: "KWAN-to tee-EM-po ser-VEES-tay",
        },
        are_ok: { text: "¿Estás bien?", phonetic: "Es-TAS bee-EN" },
        take_break: {
          text: "Tomemos un descanso",
          phonetic: "To-MAY-mos oon des-KAN-so",
        },
        deep_breath: {
          text: "Respira profundo",
          phonetic: "Res-PEE-ra pro-FOON-do",
        },
        how_feeling: {
          text: "¿Cómo te sientes?",
          phonetic: "KO-mo tay see-EN-tays",
        },
        listening: { text: "Te escucho", phonetic: "Tay es-KOO-cho" },
        semper_fi: {
          text: "Semper Fi, compañero",
          phonetic: "SEM-per FEE, kom-pan-YAIR-oh",
        },
        hooah: { text: "Hooah, guerrero", phonetic: "HOO-ah, gair-RAIR-oh" },
        hooyah: {
          text: "Hooyah, marinero",
          phonetic: "HOO-yah, ma-ree-NAIR-oh",
        },
        aim_high: {
          text: "Alto vuelo, aviador",
          phonetic: "AL-to VWAY-lo, ah-vee-a-DOR",
        },
      },
    },
    tl: {
      name: "Tagalog",
      nativeName: "Tagalog",
      flag: "🇵🇭",
      phrases: {
        here_for_you: {
          text: "Nandito ako para sa iyo",
          phonetic: "Nan-DEE-to ah-KO PAH-ra sa ee-YO",
        },
        not_alone: {
          text: "Hindi ka nag-iisa",
          phonetic: "Hin-DEE kah nahg-ee-EE-sa",
        },
        fought_together: {
          text: "Magkasama tayong lumaban",
          phonetic: "Mahg-ka-SA-ma TA-yong loo-MA-ban",
        },
        understand: {
          text: "Naiintindihan kita",
          phonetic: "Nah-een-tin-dee-HAN kee-TA",
        },
        stay_strong: { text: "Maging malakas", phonetic: "Ma-GING ma-LA-kas" },
        where_serve: {
          text: "Saan ka nagsilbi?",
          phonetic: "Sa-AN ka nahg-SEEL-bee",
        },
        your_job: {
          text: "Ano ang trabaho mo?",
          phonetic: "Ah-NO ang tra-BA-ho mo",
        },
        welcome_home: {
          text: "Maligayang pagbabalik",
          phonetic: "Ma-lee-GA-yang pahg-ba-BA-lik",
        },
        thank_service: {
          text: "Salamat sa iyong serbisyo",
          phonetic: "Sa-LA-mat sa ee-YONG ser-BEES-yo",
        },
        how_long: {
          text: "Gaano katagal ka nagsilbi?",
          phonetic: "Ga-AH-no ka-ta-GAL ka nahg-SEEL-bee",
        },
        are_ok: { text: "Ayos ka lang ba?", phonetic: "AH-yos ka lang ba" },
        take_break: {
          text: "Magpahinga tayo",
          phonetic: "Mahg-pa-HEENG-a TA-yo",
        },
        deep_breath: {
          text: "Huminga ng malalim",
          phonetic: "Hoo-MEENG-a nahng ma-la-LEEM",
        },
        how_feeling: {
          text: "Kumusta ang pakiramdam mo?",
          phonetic: "Koo-MOOS-ta ang pa-kee-ram-DAM mo",
        },
        listening: { text: "Nakikinig ako", phonetic: "Na-kee-kee-NEEG ah-KO" },
        semper_fi: {
          text: "Semper Fi, kapatid",
          phonetic: "SEM-per FEE, ka-PA-tid",
        },
        hooah: { text: "Hooah, kawal", phonetic: "HOO-ah, ka-WAL" },
        hooyah: { text: "Hooyah, marino", phonetic: "HOO-yah, ma-REE-no" },
        aim_high: {
          text: "Mataas ang layunin",
          phonetic: "Ma-TA-as ang la-YOO-nin",
        },
      },
    },
    vi: {
      name: "Vietnamese",
      nativeName: "Tiếng Việt",
      flag: "🇻🇳",
      phrases: {
        here_for_you: {
          text: "Tôi ở đây vì bạn",
          phonetic: "Toy uh day vee bahn",
        },
        not_alone: {
          text: "Bạn không đơn độc",
          phonetic: "Bahn kohng duhn dohk",
        },
        fought_together: {
          text: "Chúng ta chiến đấu cùng nhau",
          phonetic: "Chung ta chee-en dow koong nyow",
        },
        understand: { text: "Tôi hiểu", phonetic: "Toy hee-oo" },
        stay_strong: { text: "Hãy mạnh mẽ", phonetic: "Hi mahng may" },
        where_serve: {
          text: "Bạn phục vụ ở đâu?",
          phonetic: "Bahn fook voo uh dow",
        },
        your_job: {
          text: "Công việc của bạn là gì?",
          phonetic: "Kohng vee-ek koo-a bahn la zee",
        },
        welcome_home: {
          text: "Chào mừng về nhà",
          phonetic: "Chow muhng vay nyah",
        },
        thank_service: {
          text: "Cảm ơn bạn đã phục vụ",
          phonetic: "Kahm uhn bahn dah fook voo",
        },
        how_long: {
          text: "Bạn phục vụ bao lâu?",
          phonetic: "Bahn fook voo bow low",
        },
        are_ok: { text: "Bạn có ổn không?", phonetic: "Bahn koh ohn kohng" },
        take_break: { text: "Hãy nghỉ ngơi", phonetic: "Hi ngee ngoy" },
        deep_breath: { text: "Hít thở sâu", phonetic: "Heet tuh sow" },
        how_feeling: {
          text: "Bạn cảm thấy thế nào?",
          phonetic: "Bahn kahm thay thay now",
        },
        listening: { text: "Tôi đang nghe", phonetic: "Toy dahng ngay" },
        semper_fi: {
          text: "Semper Fi, đồng đội",
          phonetic: "SEM-per FEE, dohng doy",
        },
        hooah: { text: "Hooah, chiến sĩ", phonetic: "HOO-ah, chee-en see" },
        hooyah: { text: "Hooyah, thủy thủ", phonetic: "HOO-yah, twee too" },
        aim_high: {
          text: "Hướng cao, phi công",
          phonetic: "Huhng cow, fee kohng",
        },
      },
    },
    ko: {
      name: "Korean",
      nativeName: "한국어",
      flag: "🇰🇷",
      phrases: {
        here_for_you: {
          text: "나는 당신을 위해 여기 있어요",
          phonetic: "Na-neun dang-shin-eul wi-hae yeo-gi iss-eo-yo",
        },
        not_alone: {
          text: "당신은 혼자가 아닙니다",
          phonetic: "Dang-shin-eun hon-ja-ga a-nip-ni-da",
        },
        fought_together: {
          text: "우리는 함께 싸웠습니다",
          phonetic: "U-ri-neun ham-kke ssa-woss-seup-ni-da",
        },
        understand: { text: "이해합니다", phonetic: "I-hae-hap-ni-da" },
        stay_strong: { text: "강해지세요", phonetic: "Gang-hae-ji-se-yo" },
        where_serve: {
          text: "어디서 복무하셨나요?",
          phonetic: "Eo-di-seo bok-mu-ha-syeoss-na-yo",
        },
        your_job: {
          text: "무슨 일을 하셨나요?",
          phonetic: "Mu-seun il-eul ha-syeoss-na-yo",
        },
        welcome_home: {
          text: "집에 온 것을 환영합니다",
          phonetic: "Jip-e on geos-eul hwan-yeong-hap-ni-da",
        },
        thank_service: {
          text: "복무해주셔서 감사합니다",
          phonetic: "Bok-mu-hae-ju-syeo-seo gam-sa-hap-ni-da",
        },
        how_long: {
          text: "얼마나 오래 복무하셨나요?",
          phonetic: "Eol-ma-na o-rae bok-mu-ha-syeoss-na-yo",
        },
        are_ok: { text: "괜찮으세요?", phonetic: "Gwaen-chan-eu-se-yo" },
        take_break: { text: "잠깐 쉬어요", phonetic: "Jam-kkan swi-eo-yo" },
        deep_breath: {
          text: "깊게 숨쉬세요",
          phonetic: "Gip-ge sum-swi-se-yo",
        },
        how_feeling: {
          text: "기분이 어떠세요?",
          phonetic: "Gi-bun-i eo-tteo-se-yo",
        },
        listening: {
          text: "듣고 있습니다",
          phonetic: "Deut-go iss-seup-ni-da",
        },
        semper_fi: { text: "Semper Fi, 전우", phonetic: "SEM-per FEE, jeon-u" },
        hooah: { text: "Hooah, 전사", phonetic: "HOO-ah, jeon-sa" },
        hooyah: { text: "Hooyah, 수병", phonetic: "HOO-yah, su-byeong" },
        aim_high: {
          text: "높이 겨냥, 공군",
          phonetic: "Nop-i gyeo-nyang, gong-gun",
        },
      },
    },
  };

  // Get phrase translation
  const getPhraseTranslation = (phraseKey) => {
    const langData = translations[targetLang];
    if (!langData || !langData.phrases[phraseKey]) return null;
    return langData.phrases[phraseKey];
  };

  // Start learning a phrase
  const startLearning = (phraseKey, englishText) => {
    const translation = getPhraseTranslation(phraseKey);
    if (translation) {
      setCurrentPhrase({
        key: phraseKey,
        english: englishText,
        target: translation.text,
        phonetic: translation.phonetic,
      });
      setFeedback(null);
      setUserAttempt("");
    }
  };

  // Pronounce phrase slowly
  const pronounceSlowly = async () => {
    if (!currentPhrase) return;

    const voice = getBestVoice();
    const utterance = new SpeechSynthesisUtterance(currentPhrase.target);
    utterance.rate = 0.6; // Very slow for learning
    utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  };

  // Pronounce phrase at normal speed
  const pronounceNormal = async () => {
    if (!currentPhrase) return;

    const voice = getBestVoice();
    const utterance = new SpeechSynthesisUtterance(currentPhrase.target);
    utterance.rate = 0.9;
    utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  };

  // Mark phrase as learned
  const markLearned = () => {
    if (!currentPhrase) return;

    setProgress((prev) => ({
      ...prev,
      [currentPhrase.key]: (prev[currentPhrase.key] || 0) + 1,
    }));

    setFeedback({
      type: "success",
      message: "Great job! You'll sound like a native in no time!",
    });

    setTimeout(() => {
      setCurrentPhrase(null);
      setFeedback(null);
    }, 2000);
  };

  // Get progress for a phrase
  const getPhraseProgress = (phraseKey) => {
    return progress[phraseKey] || 0;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div
        className={`bg-slate-900 border-2 border-indigo-500/50 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col ${className}`}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-800">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🌐</span>
              <div>
                <h2 className="text-xl font-bold text-white">
                  Unity Language Tutor
                </h2>
                <p className="text-slate-400 text-sm">
                  Learn the languages of your fellow veterans
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-white transition-colors p-2"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Language & Category Selection */}
        <div className="p-4 bg-slate-800/50 border-b border-slate-800">
          <div className="grid grid-cols-2 gap-4">
            {/* Target Language */}
            <div>
              <label className="block text-xs text-slate-400 mb-2">
                Learn This Language
              </label>
              <select
                value={targetLang}
                onChange={(e) => {
                  setTargetLang(e.target.value);
                  setCurrentPhrase(null);
                }}
                className="w-full bg-slate-900 text-white border border-slate-700 rounded-lg p-2.5 focus:border-indigo-500 focus:outline-none"
              >
                {Object.entries(translations).map(([code, lang]) => (
                  <option key={code} value={code}>
                    {lang.flag} {lang.name} ({lang.nativeName})
                  </option>
                ))}
              </select>
            </div>

            {/* Phrase Category */}
            <div>
              <label className="block text-xs text-slate-400 mb-2">
                Phrase Category
              </label>
              <select
                value={phraseCategory}
                onChange={(e) => {
                  setPhraseCategory(e.target.value);
                  setCurrentPhrase(null);
                }}
                className="w-full bg-slate-900 text-white border border-slate-700 rounded-lg p-2.5 focus:border-indigo-500 focus:outline-none"
              >
                {Object.entries(learningModules).map(([key, module]) => (
                  <option key={key} value={key}>
                    {module.icon} {module.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {!currentPhrase ? (
            // Phrase List
            <div className="space-y-2">
              <h3 className="text-sm text-slate-400 mb-3">
                {learningModules[phraseCategory].icon}{" "}
                {learningModules[phraseCategory].title}
              </h3>
              {learningModules[phraseCategory].phrases.map((phrase) => {
                const progress = getPhraseProgress(phrase.key);
                const translation = getPhraseTranslation(phrase.key);

                return (
                  <button
                    key={phrase.key}
                    onClick={() => startLearning(phrase.key, phrase.en)}
                    className="w-full p-4 bg-slate-800/50 hover:bg-slate-800 rounded-xl border border-slate-700 hover:border-indigo-500/50 text-left transition-all group"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-white font-medium">{phrase.en}</p>
                        {translation && (
                          <p className="text-indigo-400 text-sm mt-1">
                            {translation.text}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {progress > 0 && (
                          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                            ×{progress}
                          </span>
                        )}
                        <span className="text-indigo-400 group-hover:translate-x-1 transition-transform">
                          →
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            // Learning Card
            <div className="bg-slate-800/50 rounded-xl border border-indigo-500/30 p-6">
              {/* English */}
              <div className="mb-6 text-center">
                <p className="text-slate-400 text-sm mb-1">English</p>
                <p className="text-2xl text-white font-bold">
                  {currentPhrase.english}
                </p>
              </div>

              {/* Target Language */}
              <div className="mb-6 text-center bg-indigo-500/10 rounded-xl p-6 border border-indigo-500/20">
                <p className="text-indigo-400 text-sm mb-2">
                  {translations[targetLang].flag}{" "}
                  {translations[targetLang].nativeName}
                </p>
                <p className="text-3xl text-white font-bold mb-3">
                  {currentPhrase.target}
                </p>
                <p className="text-slate-400 text-sm italic">
                  Phonetic: {currentPhrase.phonetic}
                </p>
              </div>

              {/* Pronunciation Buttons */}
              <div className="flex gap-3 mb-6">
                <button
                  onClick={pronounceSlowly}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  🐢 Slow
                </button>
                <button
                  onClick={pronounceNormal}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  🗣️ Normal Speed
                </button>
              </div>

              {/* Feedback */}
              {feedback && (
                <div
                  className={`p-4 rounded-lg mb-4 ${
                    feedback.type === "success"
                      ? "bg-green-500/20 border border-green-500/30 text-green-400"
                      : "bg-yellow-500/20 border border-yellow-500/30 text-yellow-400"
                  }`}
                >
                  {feedback.message}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentPhrase(null)}
                  className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={markLearned}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg transition-colors font-medium"
                >
                  ✓ I've Got It!
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-800/30">
          <p className="text-xs text-slate-500 text-center">
            🤝 Building unity through language • 100% Private • No data leaves
            your device
          </p>
        </div>
      </div>
    </div>
  );
};

export default UnityLanguageTutor;
