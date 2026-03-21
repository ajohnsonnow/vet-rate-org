/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * THE SCRIBE - Voice Dictation Component
 * Accessibility feature using Web Speech API for hands-free input
 * Critical for veterans with hand tremors, nerve damage, or mobility issues
 */

import React, { useState, useEffect, useRef } from "react";
import { useLanguage } from "../contexts/LanguageContext";

const DictationButton = ({
  onTranscript,
  targetRef,
  className = "",
  size = "md", // 'sm', 'md', 'lg'
}) => {
  const { t } = useLanguage();
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState("");
  const recognitionRef = useRef(null);
  const interimTranscriptRef = useRef("");

  // Size classes
  const sizeClasses = {
    sm: "w-8 h-8 p-1.5",
    md: "w-10 h-10 p-2",
    lg: "w-12 h-12 p-2.5",
  };

  const iconSizeClasses = {
    sm: "w-5 h-5",
    md: "w-6 h-6",
    lg: "w-7 h-7",
  };

  // Check browser support
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSupported(true);

      // Initialize speech recognition
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      // Handle results
      recognition.onresult = (event) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + " ";
          } else {
            interimTranscript += transcript;
          }
        }

        // Update interim transcript
        interimTranscriptRef.current = interimTranscript;

        // Send final transcript
        if (finalTranscript && onTranscript) {
          onTranscript(finalTranscript.trim());
        }
      };

      // Handle errors
      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);

        let errorMessage = "Microphone error";
        switch (event.error) {
          case "no-speech":
            errorMessage = "No speech detected. Please try again.";
            break;
          case "audio-capture":
            errorMessage = "No microphone found. Please check your device.";
            break;
          case "not-allowed":
            errorMessage =
              "Microphone access denied. Please enable in browser settings.";
            break;
          case "network":
            errorMessage = "Network error. Please check your connection.";
            break;
          default:
            errorMessage = `Error: ${event.error}`;
        }

        setError(errorMessage);
        setIsListening(false);

        // Clear error after 5 seconds
        setTimeout(() => setError(""), 5000);
      };

      // Handle end
      recognition.onend = () => {
        if (isListening) {
          // If we're supposed to be listening, restart
          try {
            recognition.start();
          } catch (e) {
            console.error("Failed to restart recognition:", e);
            setIsListening(false);
          }
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Toggle listening
  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      // Stop listening
      recognitionRef.current.stop();
      setIsListening(false);
      interimTranscriptRef.current = "";
    } else {
      // Start listening
      try {
        recognitionRef.current.start();
        setIsListening(true);
        setError("");
      } catch (e) {
        console.error("Failed to start recognition:", e);
        setError("Failed to start microphone");
        setTimeout(() => setError(""), 5000);
      }
    }
  };

  // Don't render if not supported
  if (!isSupported) {
    return null;
  }

  return (
    <div className="relative inline-block">
      {/* Dictation Button */}
      <button
        type="button"
        onClick={toggleListening}
        className={`
          ${sizeClasses[size]}
          ${className}
          rounded-lg transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-offset-2
          ${
            isListening
              ? "bg-red-500 hover:bg-red-600 text-white animate-pulse shadow-lg shadow-red-500/50 focus:ring-red-500"
              : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 focus:ring-blue-500"
          }
        `}
        title={
          isListening
            ? "Stop Dictation (Click to Stop)"
            : "Start Dictation (Click to Speak)"
        }
        aria-label={isListening ? "Stop dictation" : "Start dictation"}
      >
        {isListening ? (
          // Recording icon
          <svg
            className={`${iconSizeClasses[size]} mx-auto`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          // Microphone icon
          <svg
            className={`${iconSizeClasses[size]} mx-auto`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </button>

      {/* Listening Indicator */}
      {isListening && (
        <div className="absolute -top-1 -right-1">
          <span className="flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
        </div>
      )}

      {/* Error Tooltip */}
      {error && (
        <div
          className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 
                      px-3 py-2 bg-red-500 text-white text-xs rounded-lg shadow-lg 
                      whitespace-nowrap z-50 animate-fade-in"
        >
          {error}
          <div
            className="absolute top-full left-1/2 transform -translate-x-1/2 
                        border-4 border-transparent border-t-red-500"
          ></div>
        </div>
      )}

      {/* Status Tooltip (when listening) */}
      {isListening && !error && (
        <div
          className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 
                      px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg 
                      whitespace-nowrap z-50 animate-fade-in"
        >
          🎤 Listening... (Click to stop)
          <div
            className="absolute top-full left-1/2 transform -translate-x-1/2 
                        border-4 border-transparent border-t-gray-900"
          ></div>
        </div>
      )}
    </div>
  );
};

export default DictationButton;

// Higher-order component to wrap text inputs with dictation
export const withDictation = (TextInputComponent) => {
  return React.forwardRef((props, ref) => {
    const { value, onChange, ...restProps } = props;
    const [localValue, setLocalValue] = useState(value || "");

    useEffect(() => {
      setLocalValue(value || "");
    }, [value]);

    const handleTranscript = (transcript) => {
      const newValue = localValue + " " + transcript;
      setLocalValue(newValue);

      if (onChange) {
        // Create synthetic event
        onChange({ target: { value: newValue } });
      }
    };

    return (
      <div className="relative">
        <TextInputComponent
          ref={ref}
          value={localValue}
          onChange={(e) => {
            setLocalValue(e.target.value);
            if (onChange) onChange(e);
          }}
          {...restProps}
        />
        <div className="absolute right-2 top-2">
          <DictationButton onTranscript={handleTranscript} size="sm" />
        </div>
      </div>
    );
  });
};
