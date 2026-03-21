/**
 * Crisis Overlay Component
 * Full-screen emergency overlay when crisis language is detected
 * Displays Veterans Crisis Line resources and blocks AI processing
 */

import React from "react";
import { useLanguage } from "../contexts/LanguageContext";

const CrisisOverlay = ({ isOpen, onClose }) => {
  const { t } = useLanguage();

  if (!isOpen) return null;

  const handleCall = () => {
    window.location.href = "tel:988";
  };

  const handleText = () => {
    window.location.href = "sms:838255";
  };

  const handleChat = () => {
    window.open(
      "https://www.veteranscrisisline.net/get-help-now/chat/",
      "_blank",
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-red-600 text-white p-6 rounded-t-lg">
          <div className="flex items-center justify-center mb-2">
            <svg
              className="w-16 h-16"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-center">We're Here For You</h2>
          <p className="text-center text-red-100 mt-2">
            24/7 confidential support for Veterans in crisis
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Veterans Crisis Line */}
          <div className="text-center">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Veterans Crisis Line
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Connect with caring, qualified responders who understand veteran
              experiences.
            </p>
          </div>

          {/* Contact Options */}
          <div className="space-y-3">
            {/* Call */}
            <button
              onClick={handleCall}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-4 px-6 rounded-lg shadow-lg transition-colors flex items-center justify-center space-x-3"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
              <span className="text-xl">Call 988, Press 1</span>
            </button>

            {/* Text */}
            <button
              onClick={handleText}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-lg shadow-lg transition-colors flex items-center justify-center space-x-3"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <span className="text-xl">Text 838255</span>
            </button>

            {/* Chat */}
            <button
              onClick={handleChat}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-6 rounded-lg shadow-lg transition-colors flex items-center justify-center space-x-3"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
              <span className="text-xl">Start Online Chat</span>
            </button>
          </div>

          {/* Additional Resources */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-2">
            <h4 className="font-semibold text-gray-900 dark:text-white">
              More Resources:
            </h4>
            <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
              <li>
                • <strong>Deaf/Hard of Hearing:</strong> TTY 1-800-799-4889
              </li>
              <li>
                • <strong>International:</strong> Call +1-800-273-8255
              </li>
              <li>
                • <strong>Website:</strong> VeteransCrisisLine.net
              </li>
            </ul>
          </div>

          {/* Support Text */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>You are not alone.</strong> The Veterans Crisis Line is
              staffed by caring professionals who understand what you're going
              through. All calls are confidential - crisis or not.
            </p>
          </div>

          {/* Why we're showing this */}
          <div className="text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-4">
            <p>
              <strong>Why am I seeing this?</strong> Vet-Rate.org detected
              language that may indicate distress. We care about your well-being
              and want you to know help is available 24/7.
            </p>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            I'm OK - Close This Screen
          </button>
        </div>
      </div>
    </div>
  );
};

export default CrisisOverlay;
