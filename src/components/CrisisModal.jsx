/**
 * Vet-Rate.org - Crisis Resources Modal
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 *
 * SAFETY-CRITICAL COMPONENT: Full-screen emergency modal for crisis intervention
 * Displays when self-harm language is detected, blocking all other application functions
 * until veteran connects with crisis support.
 */

import React, { useRef } from "react";
import { CRISIS_RESOURCES, getCrisisMessage } from "../utils/crisisInterceptor";
import { useBodyScrollLock } from "../utils/useBodyScrollLock";
import useFocusTrap from "../hooks/useFocusTrap";
import { useLanguage } from "../contexts/LanguageContext";

/**
 * CrisisModal Component
 * - Full screen, non-dismissible
 * - Compassionate, veteran-focused messaging
 * - Direct contact options (call, text, chat)
 * - High contrast, accessible design
 */
const CrisisModal = ({ severity = "high", source = "application" }) => {
  const { t } = useLanguage();
  const containerRef = useRef(null);

  // Lock background scroll when modal is open
  useBodyScrollLock(true);

  // Trap keyboard focus inside the crisis resources. onEscape is intentionally
  // omitted: this alertdialog is non-dismissible by design, so ESC must not
  // close it. autoFocus lands the keyboard user on the Call button.
  useFocusTrap(containerRef, { active: true });

  const message = getCrisisMessage(severity);

  const handleCallClick = () => {
    // Direct dial link - mobile devices will open phone app
    window.location.href = CRISIS_RESOURCES.phone.tel;
  };

  const handleChatClick = () => {
    // Open chat in new window
    window.open(CRISIS_RESOURCES.chat.url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] bg-red-900 flex items-center justify-center p-4 overflow-hidden"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="crisis-modal-title"
      aria-describedby="crisis-modal-description"
    >
      {/* Content Container */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full p-8 border-4 border-red-600">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 dark:bg-red-900 rounded-full mb-4">
            <svg
              className="w-12 h-12 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </div>
          <h1
            id="crisis-modal-title"
            className="text-3xl font-bold text-gray-900 dark:text-white mb-2"
          >
            {t("crisisModal", "weCareAboutYou")}
          </h1>
          <p className="text-xl font-semibold text-red-600 dark:text-red-400">
            {t("crisisModal", "youAreNotAlone")}
          </p>
        </div>

        {/* Message */}
        <div id="crisis-modal-description" className="mb-8 text-center">
          <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">
            {message}
          </p>
          <p className="text-base text-gray-600 dark:text-gray-400">
            {t("crisisModal", "applicationPaused")}
          </p>
        </div>

        {/* Primary Action: Call Button */}
        <div className="mb-6">
          <button
            onClick={handleCallClick}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-6 px-8 rounded-lg text-2xl flex items-center justify-center gap-3 transition-all duration-200 transform hover:scale-105 shadow-lg"
            aria-label="Call Veterans Crisis Line"
          >
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
            <div className="text-left">
              <div className="text-xl">
                {t("crisisModal", "veteransCrisisLine")}
              </div>
              <div className="text-3xl font-extrabold tracking-wide">
                {CRISIS_RESOURCES.phone.display}
              </div>
            </div>
          </button>
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">
            {t("crisisModal", "available247")}
          </p>
        </div>

        {/* Alternative Contact Methods */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6 space-y-4">
          <p className="text-center text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">
            {t("crisisModal", "otherWaysToConnect")}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Text Option */}
            <a
              href={`sms:${CRISIS_RESOURCES.text.number}`}
              className="flex items-center justify-center gap-2 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-900 dark:text-blue-100 font-semibold py-4 px-6 rounded-lg transition-colors duration-200"
              aria-label="Text Veterans Crisis Line"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
              <div>
                <div className="text-xs">{t("crisisModal", "textNow")}</div>
                <div className="font-bold">{CRISIS_RESOURCES.text.number}</div>
              </div>
            </a>

            {/* Chat Option */}
            <button
              onClick={handleChatClick}
              className="flex items-center justify-center gap-2 bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800 text-green-900 dark:text-green-100 font-semibold py-4 px-6 rounded-lg transition-colors duration-200"
              aria-label="Start online chat with Veterans Crisis Line"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <div>
                <div className="text-xs">{t("crisisModal", "onlineChat")}</div>
                <div className="font-bold text-sm">
                  {t("crisisModal", "chatWebsite")}
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Footer Message */}
        <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
          <p className="text-sm text-gray-700 dark:text-gray-300 text-center">
            {t("crisisModal", "youMatter")}
          </p>
        </div>

        {/* International Users */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t("crisisModal", "internationalUsers")}{" "}
            <a
              href={`tel:${CRISIS_RESOURCES.international.phone}`}
              className="underline hover:text-red-600 dark:hover:text-red-400"
            >
              {CRISIS_RESOURCES.international.display}
            </a>
          </p>
        </div>
      </div>

      {/* Screen Reader Announcement */}
      <div className="sr-only" role="status" aria-live="assertive">
        {t("crisisModal", "screenReaderAnnouncement")}
      </div>
    </div>
  );
};

export default CrisisModal;
