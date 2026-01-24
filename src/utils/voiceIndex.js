/**
 * Vet-Rate.org - Compassionate Voice System
 * Diamond Standard Voice Index
 * 
 * Central export point for all voice-related modules.
 * Implements the "Compassionate Peer" experience for veterans.
 */

// Core Voice Engine
export {
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
} from './voiceEngine';

// Tone Mapping (Jargon → Vet-Speak)
export {
  applyCompassionateTone,
  getBranchHonorific,
  getValidationPhrase,
  getCheckInPhrase,
  getClosingPhrase,
  translateTerm,
  getSupportPhrase,
  getBranchGreeting,
  getAuditorExplanation,
  getPrivacyPromise,
  getSpeechRecognitionLang,
  detectMultilingualCrisis,
  formatBilingualText
} from './toneMapper';

// Safety Systems
export {
  triggerPanicRedirect,
  triggerSoftExit,
  initializePanicKey,
  cleanupPanicKey,
  getSafetyUseCount,
  hasUsedPanicFeature,
  initializeShakeToExit,
  createQuickExitButton,
  removeQuickExitButton
} from './safetyRedirect';

// Re-export Voice Orchestrator Service
export { getVoiceOrchestrator, VoiceOrchestrator } from '../services/VoiceOrchestrator';

/**
 * Quick setup function for voice features
 * Call this on app initialization
 */
export const initializeCompassionateVoice = () => {
  const { initializeVoiceEngine } = require('./voiceEngine');
  const { initializePanicKey } = require('./safetyRedirect');
  
  initializeVoiceEngine();
  initializePanicKey();
  
  console.log('💎 Compassionate Voice System initialized');
};

/**
 * Configuration for voice features
 */
export const VOICE_CONFIG = {
  // Default voice settings (TBI-friendly)
  defaultSettings: {
    pitch: 0.95,
    rate: 0.88,
    volume: 1.0
  },
  
  // Supported languages
  supportedLanguages: ['en', 'es', 'tl', 'vi', 'ko'],
  
  // Military branches
  branches: [
    'Army',
    'Marine',
    'Navy', 
    'Air Force',
    'Coast Guard',
    'Space Force'
  ],
  
  // Storage keys
  storageKeys: {
    voicePreferences: 'vetrate_voice_preferences',
    safetyUseCount: 'vetrate_safety_use_count',
    voiceEnabled: 'vetrate_voice_enabled',
    selectedLanguage: 'vetrate_voice_language'
  }
};
