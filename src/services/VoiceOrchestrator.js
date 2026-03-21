/**
 * Vet-Rate.org - Voice Orchestrator Service
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 *
 * 🎭 Unified Voice Service for Warrant Council
 *
 * Centralized voice management for all three custom LLMs:
 * - VetRate-Auditor: Evidence review and regulatory analysis
 * - VetRate-Scribe: Statement and nexus letter writing
 * - VetRate-Rater: VA math and rating calculations
 *
 * This orchestrator ensures consistent compassionate tone across all models.
 */

import {
  speak,
  stopSpeaking,
  speakCrisisMessage,
  getVoiceSettings,
  setVoice,
  isSpeaking,
} from "../utils/voiceEngine";
import {
  applyCompassionateTone,
  getBranchHonorific,
  getValidationPhrase,
  getCheckInPhrase,
  getClosingPhrase,
  getSupportPhrase,
  detectMultilingualCrisis,
} from "../utils/toneMapper";
import { detectCrisisLanguage } from "../utils/crisisInterceptor";

// Singleton instance
let instance = null;

/**
 * Voice Orchestrator Class
 * Manages voice output for all Vet-Rate LLMs with unified compassionate tone
 */
class VoiceOrchestrator {
  constructor() {
    if (instance) {
      return instance;
    }

    this.isEnabled = false;
    this.currentLanguage = "en";
    this.currentBranch = null;
    this.voiceQueue = [];
    this.isProcessingQueue = false;
    this.onCrisisCallback = null;
    this.onSpeakStartCallback = null;
    this.onSpeakEndCallback = null;

    // Model-specific headers
    this.modelHeaders = {
      AUDITOR: {
        en: "I've checked your evidence, and here's what stands out: ",
        es: "He revisado tu evidencia, y esto es lo que destaca: ",
        tl: "Sinuri ko ang iyong ebidensya, at ito ang nakita ko: ",
        vi: "Tôi đã kiểm tra bằng chứng của bạn, và đây là điều nổi bật: ",
        ko: "귀하의 증거를 확인했으며 눈에 띄는 점은 다음과 같습니다: ",
      },
      SCRIBE: {
        en: "I've drafted your statement for you. Here's how it sounds: ",
        es: "He redactado tu declaración. Así es como suena: ",
        tl: "Isinulat ko ang iyong pahayag. Ganito ang tunog nito: ",
        vi: "Tôi đã soạn thảo tuyên bố của bạn. Đây là cách nó nghe: ",
        ko: "진술서를 작성했습니다. 이렇게 들립니다: ",
      },
      RATER: {
        en: "I've run the numbers using VA math: ",
        es: "He calculado usando las matemáticas del VA: ",
        tl: "Kinalkula ko gamit ang VA math: ",
        vi: "Tôi đã tính toán bằng công thức VA: ",
        ko: "VA 공식으로 계산했습니다: ",
      },
      DKB: {
        en: "I've checked the 2026 regulations. Here's what I found for your claim: ",
        es: "Revisé las regulaciones de 2026. Esto es lo que encontré para tu reclamo: ",
        tl: "Sinuri ko ang mga regulasyon ng 2026. Ito ang nahanap ko para sa iyong claim: ",
        vi: "Tôi đã kiểm tra quy định năm 2026. Đây là những gì tôi tìm thấy cho yêu cầu của bạn: ",
        ko: "2026년 규정을 확인했습니다. 귀하의 청구에 대해 찾은 내용입니다: ",
      },
      GENERAL: {
        en: "Here's what I found: ",
        es: "Esto es lo que encontré: ",
        tl: "Ito ang nahanap ko: ",
        vi: "Đây là những gì tôi tìm thấy: ",
        ko: "다음은 제가 찾은 내용입니다: ",
      },
    };

    instance = this;
  }

  /**
   * Get singleton instance
   * @returns {VoiceOrchestrator}
   */
  static getInstance() {
    if (!instance) {
      instance = new VoiceOrchestrator();
    }
    return instance;
  }

  /**
   * Enable voice output
   */
  enable() {
    this.isEnabled = true;
    console.log("🎙️ Voice Orchestrator enabled");
  }

  /**
   * Disable voice output
   */
  disable() {
    this.isEnabled = false;
    stopSpeaking();
    this.voiceQueue = [];
    console.log("🎙️ Voice Orchestrator disabled");
  }

  /**
   * Set the current language
   * @param {string} langCode - en, es, tl, vi, ko
   */
  setLanguage(langCode) {
    this.currentLanguage = langCode;
  }

  /**
   * Set the veteran's military branch (for honorifics)
   * @param {string} branch - Marine, Army, Navy, Air Force, Coast Guard, Space Force
   */
  setBranch(branch) {
    this.currentBranch = branch;
  }

  /**
   * Set crisis callback
   * @param {Function} callback
   */
  onCrisis(callback) {
    this.onCrisisCallback = callback;
  }

  /**
   * Set speech event callbacks
   * @param {Function} onStart
   * @param {Function} onEnd
   */
  onSpeechEvents(onStart, onEnd) {
    this.onSpeakStartCallback = onStart;
    this.onSpeakEndCallback = onEnd;
  }

  /**
   * Check text for crisis language before speaking
   * @param {string} text
   * @returns {boolean} - true if crisis detected
   */
  checkForCrisis(text) {
    // Check English patterns
    const englishResult = detectCrisisLanguage(text);
    if (englishResult.isCrisis) {
      this.handleCrisis(englishResult.severity, "en");
      return true;
    }

    // Check multilingual
    const multiResult = detectMultilingualCrisis(text);
    if (multiResult.detected) {
      this.handleCrisis("critical", multiResult.language);
      return true;
    }

    return false;
  }

  /**
   * Handle crisis detection
   * @param {string} severity
   * @param {string} language
   */
  handleCrisis(severity, language) {
    // Stop current speech
    stopSpeaking();
    this.voiceQueue = [];

    // Speak crisis message
    speakCrisisMessage(language);

    // Trigger callback
    if (this.onCrisisCallback) {
      this.onCrisisCallback({ severity, language });
    }

    console.warn("🆘 Crisis detected in voice output");
  }

  /**
   * Main method to announce LLM output with compassionate tone
   * @param {Object} payload - { text, sourceModel, isSensitive }
   * @returns {Promise<void>}
   */
  async announce(payload) {
    if (!this.isEnabled) return;

    const { text, sourceModel = "GENERAL", isSensitive = false } = payload;

    // 1. Check for crisis language
    if (this.checkForCrisis(text)) {
      return;
    }

    // 2. Get model-specific header
    const header = this.getHeader(sourceModel);

    // 3. Apply compassionate tone transformation
    const transformedText = applyCompassionateTone(
      text,
      sourceModel,
      this.currentLanguage,
      this.currentBranch,
    );

    // 4. Combine header and transformed text
    const fullText = `${header} ${transformedText}`;

    // 5. Add to queue and process
    this.voiceQueue.push({
      text: fullText,
      model: sourceModel,
      sensitive: isSensitive,
    });

    await this.processQueue();
  }

  /**
   * Get localized header for model
   * @param {string} model
   * @returns {string}
   */
  getHeader(model) {
    const headers = this.modelHeaders[model] || this.modelHeaders.GENERAL;
    return headers[this.currentLanguage] || headers.en;
  }

  /**
   * Process the voice queue
   */
  async processQueue() {
    if (this.isProcessingQueue || this.voiceQueue.length === 0) return;

    this.isProcessingQueue = true;

    while (this.voiceQueue.length > 0) {
      const item = this.voiceQueue.shift();

      if (this.onSpeakStartCallback) {
        this.onSpeakStartCallback(item);
      }

      await speak(item.text, {
        skipToneMapping: true, // Already transformed
        sourceModel: item.model,
        onStart: () => {},
        onEnd: () => {
          if (this.onSpeakEndCallback) {
            this.onSpeakEndCallback(item);
          }
        },
      });
    }

    this.isProcessingQueue = false;
  }

  /**
   * Speak a validation phrase (empathy moment)
   */
  async speakValidation() {
    if (!this.isEnabled) return;

    const phrase = getValidationPhrase();
    await speak(phrase, { skipToneMapping: true });
  }

  /**
   * Speak a check-in phrase
   * @param {string} context - heavy_topic, after_denial, idle, long_session
   */
  async speakCheckIn(context) {
    if (!this.isEnabled) return;

    const phrase = getCheckInPhrase(context);
    await speak(phrase, { skipToneMapping: true });
  }

  /**
   * Speak closing phrase for model
   * @param {string} model
   */
  async speakClosing(model) {
    if (!this.isEnabled) return;

    const phrase = getClosingPhrase(model);
    await speak(phrase, { skipToneMapping: true });
  }

  /**
   * Speak support phrase in current language
   * @param {string} phraseKey - greeting, working, found, validation, etc.
   */
  async speakSupport(phraseKey) {
    if (!this.isEnabled) return;

    const phrase = getSupportPhrase(phraseKey, this.currentLanguage);
    if (phrase) {
      await speak(phrase, { skipToneMapping: true });
    }
  }

  /**
   * Speak branch-specific greeting
   */
  async speakBranchGreeting() {
    if (!this.isEnabled || !this.currentBranch) return;

    const honorific = getBranchHonorific(
      this.currentBranch,
      this.currentLanguage,
    );
    if (honorific) {
      await speak(honorific, { skipToneMapping: true });
    }
  }

  /**
   * Speak privacy promise
   */
  async speakPrivacyPromise() {
    if (!this.isEnabled) return;

    const messages = {
      en: "Just so you know, I'm talking to you directly from your device. Your voice and your data never leave this screen.",
      es: "Para que lo sepas, te estoy hablando directamente desde tu dispositivo. Tu voz y tus datos nunca salen de esta pantalla.",
      tl: "Para malaman mo, direkta akong nakikipag-usap sa iyo mula sa iyong device. Ang iyong boses at data ay hindi kailanman aalis sa screen na ito.",
      vi: "Để bạn biết, tôi đang nói chuyện trực tiếp với bạn từ thiết bị của bạn. Giọng nói và dữ liệu của bạn không bao giờ rời khỏi màn hình này.",
      ko: "알려드리자면, 저는 귀하의 기기에서 직접 대화하고 있습니다. 귀하의 음성과 데이터는 이 화면을 떠나지 않습니다.",
    };

    const message = messages[this.currentLanguage] || messages.en;
    await speak(message, { skipToneMapping: true });
  }

  /**
   * Stop all speech and clear queue
   */
  stop() {
    stopSpeaking();
    this.voiceQueue = [];
    this.isProcessingQueue = false;
  }

  /**
   * Check if currently speaking
   * @returns {boolean}
   */
  get speaking() {
    return isSpeaking();
  }

  /**
   * Get current queue length
   * @returns {number}
   */
  get queueLength() {
    return this.voiceQueue.length;
  }
}

// Export singleton getter
export const getVoiceOrchestrator = () => VoiceOrchestrator.getInstance();

// Export class for testing
export { VoiceOrchestrator };

// Default export
export default VoiceOrchestrator;
