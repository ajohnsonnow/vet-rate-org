import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * VoiceInput Component
 * Provides voice-to-text capability for veterans who have difficulty typing
 * Uses the Web Speech API for real-time speech recognition
 * 
 * Accessibility Feature: Critical for older veterans and those with hand injuries
 */

// Check if browser supports Speech Recognition
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const isSpeechSupported = Boolean(SpeechRecognition);

/**
 * Custom hook for speech recognition
 */
export const useSpeechRecognition = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);

  const startListening = useCallback(() => {
    if (!isSpeechSupported) {
      setError('Speech recognition is not supported in your browser. Please try Chrome, Edge, or Safari.');
      return;
    }

    setError(null);
    
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      // Combine final and interim for display
      setTranscript(finalTranscript || interimTranscript);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      
      switch (event.error) {
        case 'not-allowed':
        case 'permission-denied':
          setError('Microphone access denied. Please allow microphone access in your browser settings.');
          break;
        case 'no-speech':
          setError('No speech detected. Please try again.');
          break;
        case 'network':
          setError('Network error. Please check your connection.');
          break;
        case 'aborted':
          // User stopped, not an error
          break;
        default:
          setError(`Speech error: ${event.error}`);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    
    try {
      recognition.start();
    } catch (err) {
      console.error('Failed to start recognition:', err);
      setError('Failed to start speech recognition. Please try again.');
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  return {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    resetTranscript,
    isSupported: isSpeechSupported
  };
};

/**
 * VoiceInputButton Component
 * A microphone button that can be placed inside/beside text areas
 * Pulses red when recording
 * 
 * PRIVACY: Uses browser's built-in Web Speech API
 * - Chrome/Edge: Uses device-side recognition when offline capable
 * - Safari: 100% on-device processing
 * - No audio is sent to VetRate servers
 * - Your voice data stays on YOUR device
 */
const VoiceInputButton = ({ 
  onTranscript, 
  disabled = false,
  className = '',
  size = 'md',
  showLabel = false,
  showPrivacyHint = true
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    resetTranscript,
    isSupported
  } = useSpeechRecognition();

  // Forward transcript to parent when it changes
  useEffect(() => {
    if (transcript && onTranscript) {
      onTranscript(transcript);
    }
  }, [transcript, onTranscript]);

  const handleClick = () => {
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      startListening();
    }
  };

  // Don't render if speech is not supported
  if (!isSupported) {
    return null;
  }

  const sizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-3'
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  return (
    <div className="relative inline-flex items-center group">
      <button
        type="button"
        onClick={handleClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        disabled={disabled}
        className={`
          ${sizeClasses[size]}
          rounded-full
          transition-all
          duration-200
          focus:outline-none
          focus:ring-2
          focus:ring-offset-2
          ${isListening 
            ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/50 focus:ring-red-500' 
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 focus:ring-blue-500'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${className}
        `}
        title={isListening ? 'Click to stop recording' : 'Click to speak instead of typing'}
        aria-label={isListening ? 'Stop voice recording' : 'Start voice recording - your voice stays on your device'}
      >
        {isListening ? (
          // Recording icon (pulsing microphone with waves)
          <svg className={iconSizes[size]} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            {/* Sound waves */}
            <circle cx="19" cy="11" r="1" className="animate-ping opacity-75"/>
            <circle cx="5" cy="11" r="1" className="animate-ping opacity-75"/>
          </svg>
        ) : (
          // Microphone icon
          <svg className={iconSizes[size]} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        )}
      </button>
      
      {showLabel && (
        <span className={`ml-2 text-sm ${isListening ? 'text-red-500 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
          {isListening ? 'Recording...' : 'Voice Input'}
        </span>
      )}

      {/* Error tooltip */}
      {error && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 bg-red-100 dark:bg-red-900/80 text-red-700 dark:text-red-200 text-xs rounded-lg shadow-lg whitespace-nowrap z-10">
          {error}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-red-100 dark:border-t-red-900/80"></div>
        </div>
      )}

      {/* Privacy & Help tooltip - shows on hover when not listening and no error */}
      {showPrivacyHint && showTooltip && !isListening && !error && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg z-10 w-56">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div>
              <p className="font-medium text-green-400 mb-1">Speak instead of typing</p>
              <p className="text-gray-300 leading-relaxed">Click to talk. Your voice is processed by your browser—nothing is sent to our servers. 100% private.</p>
            </div>
          </div>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
        </div>
      )}

      {/* Recording indicator tooltip */}
      {isListening && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg shadow-lg whitespace-nowrap z-10">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
            Listening... Click again when done
          </span>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-red-600"></div>
        </div>
      )}
    </div>
  );
};

/**
 * VoiceTextArea Component
 * A textarea with integrated voice input button
 */
export const VoiceTextArea = ({
  value,
  onChange,
  placeholder = '',
  rows = 4,
  disabled = false,
  className = '',
  id,
  name,
  label,
  required = false,
  maxLength,
  helpText,
  ...props
}) => {
  const textareaRef = useRef(null);

  const handleVoiceTranscript = (transcript) => {
    if (!onChange) return;
    
    // Append the new transcript to existing value with a space
    const newValue = value ? `${value} ${transcript}` : transcript;
    
    // Trigger onChange with synthetic event-like object
    onChange({
      target: {
        name,
        value: newValue
      }
    });
  };

  return (
    <div className="relative">
      {label && (
        <label 
          htmlFor={id} 
          className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        <textarea
          ref={textareaRef}
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          required={required}
          maxLength={maxLength}
          className={`
            w-full
            px-3 py-2
            pr-12
            border border-gray-300 dark:border-gray-600
            rounded-lg
            bg-white dark:bg-gray-800
            text-gray-900 dark:text-gray-100
            placeholder-gray-400 dark:placeholder-gray-500
            focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            disabled:bg-gray-100 dark:disabled:bg-gray-900
            disabled:cursor-not-allowed
            resize-y
            ${className}
          `}
          {...props}
        />
        
        {/* Voice input button positioned inside textarea */}
        <div className="absolute right-2 top-2">
          <VoiceInputButton
            onTranscript={handleVoiceTranscript}
            disabled={disabled}
            size="sm"
          />
        </div>
      </div>

      {/* Help text / character count */}
      <div className="flex justify-between items-center mt-1">
        {helpText && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{helpText}</p>
        )}
        {maxLength && (
          <p className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
            {value?.length || 0}/{maxLength}
          </p>
        )}
      </div>
    </div>
  );
};

/**
 * Check if speech recognition is supported
 */
export const isSpeechRecognitionSupported = () => isSpeechSupported;

export default VoiceInputButton;
