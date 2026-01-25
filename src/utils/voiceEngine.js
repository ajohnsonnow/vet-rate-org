/**
 * SupplyLocker.org - Voice Engine
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * 🎙️ Compassionate Voice System - Diamond Standard
 * 
 * This module provides text-to-speech capabilities using the Web Speech API,
 * with a focus on compassionate, veteran-friendly voice interactions.
 * 
 * Features:
 * - Natural voice selection prioritizing human-like voices
 * - Compassionate tone with slower, calmer delivery
 * - Crisis intervention voice override
 * - Multilingual support
 * - Accessibility-first design (TBI/PTSD-friendly cadence)
 */

import { applyCompassionateTone } from './toneMapper';

// Voice engine state
let selectedVoice = null;
let voiceInitialized = false;
let voiceSettings = {
  pitch: 0.95,      // Slightly lower for grounded feel
  rate: 0.88,       // Slower for clarity and empathy (TBI-friendly)
  volume: 1.0
};

// Storage key for voice preferences
const VOICE_PREF_KEY = 'vetrate_voice_preferences';

/**
 * Initialize the voice engine and load user preferences
 */
export const initializeVoiceEngine = () => {
  if (voiceInitialized) return;
  
  // Load saved preferences
  try {
    const saved = localStorage.getItem(VOICE_PREF_KEY);
    if (saved) {
      const prefs = JSON.parse(saved);
      if (prefs.voiceName) {
        // Will be applied when voices load
        window._preferredVoiceName = prefs.voiceName;
      }
      if (prefs.settings) {
        voiceSettings = { ...voiceSettings, ...prefs.settings };
      }
    }
  } catch (e) {
    console.warn('Failed to load voice preferences:', e);
  }
  
  // Handle voices loaded event (some browsers load async)
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => {
      applyPreferredVoice();
    };
    
    // Try to apply immediately if voices already loaded
    applyPreferredVoice();
  }
  
  voiceInitialized = true;
};

/**
 * Apply the preferred voice from saved settings
 */
const applyPreferredVoice = () => {
  if (window._preferredVoiceName) {
    const voices = window.speechSynthesis.getVoices();
    const found = voices.find(v => v.name === window._preferredVoiceName);
    if (found) {
      selectedVoice = found;
    }
  }
};

/**
 * Get all available voices, filtered and categorized for inclusive selection
 * @returns {Object} - Categorized voices by region/culture
 */
export const getAvailableVoices = () => {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return { all: [], categorized: {} };
  }
  
  const voices = window.speechSynthesis.getVoices();
  
  // Categorize voices by cultural context
  const categorized = {
    'North American English': voices.filter(v => 
      v.lang.startsWith('en-US') || v.lang.startsWith('en-CA')
    ),
    'Spanish / Latino': voices.filter(v => 
      v.lang.startsWith('es')
    ),
    'Pacific / Asian': voices.filter(v => 
      v.lang.startsWith('fil') || v.lang.startsWith('tl') ||
      v.lang.startsWith('vi') || v.lang.startsWith('ko') ||
      v.lang.includes('PH') || v.lang.includes('IN')
    ),
    'British / Commonwealth': voices.filter(v => 
      v.lang.includes('GB') || v.lang.includes('AU') || 
      v.lang.includes('ZA') || v.lang.includes('NZ')
    ),
    'Other Languages': voices.filter(v => 
      !v.lang.startsWith('en') && !v.lang.startsWith('es') &&
      !v.lang.startsWith('fil') && !v.lang.startsWith('tl') &&
      !v.lang.startsWith('vi') && !v.lang.startsWith('ko')
    )
  };
  
  return { all: voices, categorized };
};

/**
 * Select the best default voice (prioritizing natural-sounding voices)
 * @returns {SpeechSynthesisVoice|null}
 */
export const getBestVoice = () => {
  if (selectedVoice) return selectedVoice;
  
  const voices = window.speechSynthesis?.getVoices() || [];
  
  // Priority order for natural-sounding voices
  const priorityNames = [
    'Google US English',
    'Samantha',
    'Alex',
    'Daniel',
    'Karen',
    'Moira',
    'Microsoft David',
    'Microsoft Zira'
  ];
  
  // Try to find a priority voice
  for (const name of priorityNames) {
    const found = voices.find(v => v.name.includes(name));
    if (found) return found;
  }
  
  // Fall back to first English voice
  const englishVoice = voices.find(v => v.lang.startsWith('en'));
  if (englishVoice) return englishVoice;
  
  // Last resort: first available
  return voices[0] || null;
};

/**
 * Set the active voice for TTS
 * @param {SpeechSynthesisVoice} voice - The voice to use
 */
export const setVoice = (voice) => {
  selectedVoice = voice;
  saveVoicePreferences();
};

/**
 * Get current voice settings
 * @returns {Object} - Current pitch, rate, volume settings
 */
export const getVoiceSettings = () => ({ ...voiceSettings });

/**
 * Update voice settings (pitch, rate, volume)
 * @param {Object} settings - Partial settings to update
 */
export const updateVoiceSettings = (settings) => {
  voiceSettings = { ...voiceSettings, ...settings };
  saveVoicePreferences();
};

/**
 * Save voice preferences to localStorage
 */
const saveVoicePreferences = () => {
  try {
    localStorage.setItem(VOICE_PREF_KEY, JSON.stringify({
      voiceName: selectedVoice?.name || null,
      settings: voiceSettings
    }));
  } catch (e) {
    console.warn('Failed to save voice preferences:', e);
  }
};

/**
 * Main speech function - speaks text with compassionate formatting
 * @param {string} text - Text to speak
 * @param {Object} options - Additional options
 * @param {boolean} options.skipToneMapping - Skip the compassionate tone transformation
 * @param {string} options.sourceModel - Source LLM (AUDITOR, SCRIBE, RATER)
 * @param {Function} options.onStart - Callback when speech starts
 * @param {Function} options.onEnd - Callback when speech ends
 * @param {Function} options.onBoundary - Callback for word boundaries (for highlighting)
 * @returns {Promise<void>}
 */
export const speak = async (text, options = {}) => {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    console.warn('Speech synthesis not available');
    return;
  }
  
  const {
    skipToneMapping = false,
    sourceModel = 'GENERAL',
    onStart,
    onEnd,
    onBoundary
  } = options;
  
  // Apply compassionate tone transformation unless skipped
  let processedText = text;
  if (!skipToneMapping) {
    processedText = applyCompassionateTone(text, sourceModel);
  }
  
  // Create utterance
  const utterance = new SpeechSynthesisUtterance(processedText);
  
  // Apply settings
  utterance.voice = selectedVoice || getBestVoice();
  utterance.pitch = voiceSettings.pitch;
  utterance.rate = voiceSettings.rate;
  utterance.volume = voiceSettings.volume;
  
  // Set up callbacks
  if (onStart) utterance.onstart = onStart;
  if (onEnd) utterance.onend = onEnd;
  if (onBoundary) utterance.onboundary = onBoundary;
  
  // Speak
  return new Promise((resolve, reject) => {
    utterance.onend = () => {
      if (onEnd) onEnd();
      resolve();
    };
    utterance.onerror = (e) => {
      console.error('Speech error:', e);
      reject(e);
    };
    
    window.speechSynthesis.speak(utterance);
  });
};

/**
 * Speak a crisis intervention message - overrides all settings for maximum clarity
 * @param {string} language - Language code (en, es, tl, vi, ko)
 */
export const speakCrisisMessage = (language = 'en') => {
  if (!window.speechSynthesis) return;
  
  // Crisis messages by language
  const crisisMessages = {
    en: "I'm going to pause right there. Your safety is more important than any claim. Please talk to someone now. Call 9-8-8 and press 1. They are there for you 24 hours a day, 7 days a week.",
    es: "Voy a hacer una pausa aquí. Tu seguridad es más importante que cualquier reclamo. Por favor, habla con alguien ahora. Llama al 9-8-8 y presiona 1. Están ahí para ti las 24 horas.",
    tl: "Sandali lang. Mas mahalaga ang iyong kaligtasan kaysa sa anumang claim. Mangyaring makipag-usap sa isang tao ngayon. Tumawag sa 9-8-8 at pindutin ang 1.",
    vi: "Tôi sẽ dừng lại ở đây. Sự an toàn của bạn quan trọng hơn bất kỳ yêu cầu bồi thường nào. Xin hãy nói chuyện với ai đó ngay bây giờ. Gọi 9-8-8 và nhấn 1.",
    ko: "잠시 멈추겠습니다. 당신의 안전이 어떤 청구보다 더 중요합니다. 지금 당장 누군가와 이야기해 주세요. 9-8-8로 전화하고 1을 누르세요."
  };
  
  const message = crisisMessages[language] || crisisMessages.en;
  
  // Cancel any current speech
  window.speechSynthesis.cancel();
  
  // Create crisis utterance with special settings
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.voice = selectedVoice || getBestVoice();
  utterance.pitch = 0.9;    // Lower, calming tone
  utterance.rate = 0.8;     // Slower for crisis clarity
  utterance.volume = 1.0;   // Full volume
  
  window.speechSynthesis.speak(utterance);
};

/**
 * Stop any current speech
 */
export const stopSpeaking = () => {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
};

/**
 * Pause current speech
 */
export const pauseSpeaking = () => {
  if (window.speechSynthesis) {
    window.speechSynthesis.pause();
  }
};

/**
 * Resume paused speech
 */
export const resumeSpeaking = () => {
  if (window.speechSynthesis) {
    window.speechSynthesis.resume();
  }
};

/**
 * Check if currently speaking
 * @returns {boolean}
 */
export const isSpeaking = () => {
  return window.speechSynthesis?.speaking || false;
};

/**
 * Preview a voice with a sample phrase
 * @param {SpeechSynthesisVoice} voice - Voice to preview
 * @param {string} sampleText - Optional custom sample text
 */
export const previewVoice = (voice, sampleText = null) => {
  if (!window.speechSynthesis) return;
  
  // Stop any current preview
  window.speechSynthesis.cancel();
  
  const text = sampleText || "I'm here to support you with your claim. Together, we've got this.";
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.pitch = voiceSettings.pitch;
  utterance.rate = voiceSettings.rate;
  utterance.volume = voiceSettings.volume;
  
  window.speechSynthesis.speak(utterance);
};

/**
 * Speak with model-specific headers
 * @param {string} text - Text to speak
 * @param {string} model - Model type (AUDITOR, SCRIBE, RATER)
 */
export const speakWithModelHeader = async (text, model) => {
  const headers = {
    AUDITOR: "I've checked your evidence, and here's what stands out: ",
    SCRIBE: "I've drafted your statement for you. Here's how it sounds: ",
    RATER: "I've run the numbers using VA math: ",
    DKB: "I've checked the 2026 regulations. Here's what I found for your claim: ",
    GENERAL: "Here's what I found: "
  };
  
  const header = headers[model] || headers.GENERAL;
  return speak(`${header} ${text}`, { sourceModel: model });
};

// Initialize on module load
if (typeof window !== 'undefined') {
  initializeVoiceEngine();
}

export default {
  initializeVoiceEngine,
  getAvailableVoices,
  getBestVoice,
  setVoice,
  getVoiceSettings,
  updateVoiceSettings,
  speak,
  speakCrisisMessage,
  stopSpeaking,
  pauseSpeaking,
  resumeSpeaking,
  isSpeaking,
  previewVoice,
  speakWithModelHeader
};
