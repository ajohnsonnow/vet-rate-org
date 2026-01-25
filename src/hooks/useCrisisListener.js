/**
 * SupplyLocker.org - Crisis Listener Hook
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * 🆘 Voice-Activated Crisis Detection
 * 
 * Monitors voice-to-text transcripts for crisis language and triggers
 * immediate support intervention. Works with the existing Crisis Interceptor
 * but adds real-time voice monitoring capabilities.
 */

import { useEffect, useRef, useCallback } from 'react';
import { detectCrisisLanguage, CRISIS_RESOURCES } from '../utils/crisisInterceptor';
import { detectMultilingualCrisis } from '../utils/toneMapper';
import { speakCrisisMessage, stopSpeaking } from '../utils/voiceEngine';

/**
 * Hook for monitoring transcripts for crisis language
 * 
 * @param {string} transcript - Current voice-to-text transcript
 * @param {SpeechSynthesisVoice|null} chosenVoice - User's selected peer voice
 * @param {Object} options - Configuration options
 * @param {boolean} options.enabled - Whether crisis detection is active
 * @param {string} options.language - Current language code (en, es, tl, vi, ko)
 * @param {Function} options.onCrisisDetected - Callback when crisis detected
 * @param {Function} options.onOverlayTrigger - Callback to trigger crisis overlay
 * @returns {Object} - { isCrisisActive, resetCrisis }
 */
export const useCrisisListener = (
  transcript,
  chosenVoice,
  options = {}
) => {
  const {
    enabled = true,
    language = 'en',
    onCrisisDetected,
    onOverlayTrigger
  } = options;
  
  // Track crisis state
  const isCrisisActiveRef = useRef(false);
  const lastCheckedTranscriptRef = useRef('');
  const debounceTimerRef = useRef(null);
  
  /**
   * Reset crisis state (after user acknowledges/dismisses)
   */
  const resetCrisis = useCallback(() => {
    isCrisisActiveRef.current = false;
    lastCheckedTranscriptRef.current = '';
  }, []);
  
  /**
   * Handle detected crisis
   */
  const handleCrisisDetected = useCallback((severity, detectedLang) => {
    if (isCrisisActiveRef.current) return; // Already handling
    
    isCrisisActiveRef.current = true;
    
    // 1. Stop any current AI speech
    stopSpeaking();
    
    // 2. Speak crisis message in appropriate language
    speakCrisisMessage(detectedLang || language);
    
    // 3. Trigger visual overlay if callback provided
    if (onOverlayTrigger) {
      onOverlayTrigger();
    }
    
    // 4. Callback for additional handling
    if (onCrisisDetected) {
      onCrisisDetected({
        severity,
        language: detectedLang || language,
        timestamp: new Date().toISOString(),
        resources: CRISIS_RESOURCES
      });
    }
    
    // Log for safety auditing (no PII)
    console.warn('🆘 Crisis intervention triggered:', {
      severity,
      language: detectedLang
    });
    
  }, [language, onCrisisDetected, onOverlayTrigger]);
  
  /**
   * Check transcript for crisis language
   */
  const checkForCrisis = useCallback((text) => {
    if (!text || text.length < 4) return;
    if (text === lastCheckedTranscriptRef.current) return;
    
    lastCheckedTranscriptRef.current = text;
    
    // Check English crisis patterns
    const englishResult = detectCrisisLanguage(text);
    if (englishResult.isCrisis) {
      handleCrisisDetected(englishResult.severity, 'en');
      return;
    }
    
    // Check multilingual crisis keywords
    const multilingualResult = detectMultilingualCrisis(text);
    if (multilingualResult.detected) {
      handleCrisisDetected('critical', multilingualResult.language);
      return;
    }
    
  }, [handleCrisisDetected]);
  
  // Monitor transcript changes
  useEffect(() => {
    if (!enabled || !transcript || isCrisisActiveRef.current) return;
    
    // Debounce to avoid checking every keystroke
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(() => {
      checkForCrisis(transcript);
    }, 300); // 300ms debounce
    
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [transcript, enabled, checkForCrisis]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);
  
  return {
    isCrisisActive: isCrisisActiveRef.current,
    resetCrisis
  };
};

/**
 * Hook for monitoring typed input for crisis language
 * Similar to useCrisisListener but for text input instead of voice
 * 
 * @param {string} inputText - Current text input value
 * @param {Object} options - Configuration options
 * @returns {Object} - { isCrisisActive, resetCrisis }
 */
export const useCrisisInputMonitor = (inputText, options = {}) => {
  return useCrisisListener(inputText, null, {
    ...options,
    // Don't speak for text input, just trigger overlay
    onCrisisDetected: (data) => {
      if (options.onCrisisDetected) {
        options.onCrisisDetected(data);
      }
    }
  });
};

/**
 * Hook to provide crisis resources without active monitoring
 * Useful for components that need to display crisis info
 * 
 * @returns {Object} - Crisis resources and helper functions
 */
export const useCrisisResources = () => {
  const speakResources = useCallback((language = 'en') => {
    speakCrisisMessage(language);
  }, []);
  
  const getPhoneLink = useCallback(() => {
    return CRISIS_RESOURCES.phone.tel;
  }, []);
  
  const getTextNumber = useCallback(() => {
    return CRISIS_RESOURCES.text.number;
  }, []);
  
  const getChatUrl = useCallback(() => {
    return CRISIS_RESOURCES.chat.url;
  }, []);
  
  return {
    resources: CRISIS_RESOURCES,
    speakResources,
    getPhoneLink,
    getTextNumber,
    getChatUrl
  };
};

export default useCrisisListener;
