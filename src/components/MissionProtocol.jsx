/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 *
 * MissionProtocol Component
 * "The Human Seal" - Trust beacon establishing credibility
 * Kills skepticism by showing the human behind the tool
 */

import React from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { useBodyScrollLock } from "../utils/useBodyScrollLock";

const MissionProtocol = ({ onClose }) => {
  const { t } = useLanguage();
  // Lock body scroll when modal is open
  useBodyScrollLock(true);

  return (
    <div
      className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mission-protocol-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-gray-900 border-2 border-va-gold rounded-lg max-w-2xl w-full my-8 shadow-2xl">
        {/* Header with flag banner effect */}
        <div className="bg-gradient-to-r from-gray-800 via-gray-900 to-gray-800 border-b-2 border-va-gold px-8 py-6">
          <div className="text-center">
            <div className="text-4xl mb-3">🎖️</div>
            <h2
              id="mission-protocol-title"
              className="text-2xl md:text-3xl font-bold text-va-gold tracking-wide"
              style={{ fontFamily: "Georgia, serif" }}
            >
              THE VET-RATE PROMISE
            </h2>
            <div className="w-24 h-1 bg-va-gold mx-auto mt-3 rounded"></div>
          </div>
        </div>

        {/* Content with military document styling */}
        <div className="px-8 py-8">
          {/* Mission Statement */}
          <div className="mb-8">
            <div
              className="text-gray-200 leading-relaxed space-y-4"
              style={{ fontFamily: "Courier New, monospace" }}
            >
              <p className="text-lg">
                To the Veterans who served and sacrificed:
              </p>

              <p>
                You earned your benefits through blood, sweat, and years of
                service. You should not need a law degree or thousands of
                dollars to claim what is rightfully yours.
              </p>

              <p>
                This tool exists because the VA claims process is unnecessarily
                complex, and too many veterans are either denied their rightful
                benefits or preyed upon by companies charging $5,000+ to fill
                out paperwork.
              </p>

              <p className="text-va-gold font-bold">That ends here.</p>
            </div>
          </div>

          {/* The Promises */}
          <div className="space-y-4 mb-8">
            <h3
              className="text-lg font-bold text-white border-b border-gray-700 pb-2"
              style={{ fontFamily: "Courier New, monospace" }}
            >
              STANDING ORDERS:
            </h3>

            <div className="grid gap-4">
              <div className="flex items-start gap-4 bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <span className="text-2xl flex-shrink-0">💵</span>
                <div>
                  <h4 className="font-bold text-green-400 mb-1">ZERO COST</h4>
                  <p
                    className="text-gray-300 text-sm"
                    style={{ fontFamily: "Courier New, monospace" }}
                  >
                    This tool is free. No hidden fees. No premium tiers. No "pay
                    to unlock" features. Everything is available to everyone.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <span className="text-2xl flex-shrink-0">🔒</span>
                <div>
                  <h4 className="font-bold text-blue-400 mb-1">
                    ZERO TRACKING
                  </h4>
                  <p
                    className="text-gray-300 text-sm"
                    style={{ fontFamily: "Courier New, monospace" }}
                  >
                    Your data never leaves your browser. No accounts. No cloud
                    storage. No analytics tracking your medical information.
                    Your claim is YOUR business.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <span className="text-2xl flex-shrink-0">🛡️</span>
                <div>
                  <h4 className="font-bold text-purple-400 mb-1">
                    100% PRIVACY
                  </h4>
                  <p
                    className="text-gray-300 text-sm"
                    style={{ fontFamily: "Courier New, monospace" }}
                  >
                    All AI processing happens locally on your device. Your
                    medical records, your statements, your service history-none
                    of it ever touches our servers.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Personal Statement */}
          <div className="bg-gray-800 border-l-4 border-va-gold rounded-r-lg p-6 mb-8">
            <p
              className="text-gray-300 italic leading-relaxed mb-4"
              style={{ fontFamily: "Georgia, serif" }}
            >
              "I built this because I watched too many fellow veterans struggle
              with the same system I navigated. Some gave up. Some paid
              predatory companies. Some got denied for claims that should have
              been approved.
              <br />
              <br />
              You deserve better tools than a stack of confusing forms and a
              1-800 number. You deserve to understand your own claim, build your
              own evidence, and advocate for yourself with confidence.
              <br />
              <br />
              This is my way of continuing to serve."
            </p>
          </div>

          {/* Signature Block - Military Style */}
          <div className="border-t border-gray-700 pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p
                  className="text-va-gold font-bold text-lg"
                  style={{
                    fontFamily: "Brush Script MT, cursive",
                    fontSize: "1.75rem",
                  }}
                >
                  Anthony Johnson
                </p>
                <p
                  className="text-gray-400 text-sm mt-1"
                  style={{ fontFamily: "Courier New, monospace" }}
                >
                  Developer & Instructor
                </p>
                <p
                  className="text-gray-500 text-xs mt-1"
                  style={{ fontFamily: "Courier New, monospace" }}
                >
                  Portland, Oregon
                </p>
              </div>
              <div className="text-right">
                <p
                  className="text-gray-500 text-xs"
                  style={{ fontFamily: "Courier New, monospace" }}
                >
                  BUILT BY A VETERAN
                </p>
                <p
                  className="text-gray-500 text-xs"
                  style={{ fontFamily: "Courier New, monospace" }}
                >
                  FOR VETERANS
                </p>
                <div className="mt-2 text-3xl">🇺🇸</div>
              </div>
            </div>
          </div>

          {/* Support Note */}
          <div className="mt-6 text-center">
            <p
              className="text-gray-500 text-xs"
              style={{ fontFamily: "Courier New, monospace" }}
            >
              Want to support this mission? Share Vet-Rate.org with a fellow
              veteran.
            </p>
          </div>
        </div>

        {/* Close Button */}
        <div className="border-t border-gray-700 px-8 py-4 bg-gray-800/50 rounded-b-lg">
          <button
            onClick={onClose}
            className="w-full bg-va-gold hover:bg-yellow-400 text-gray-900 font-bold py-3 rounded-lg transition-all hover:scale-[1.02] shadow-lg"
          >
            Roger That - Continue to App
          </button>
        </div>
      </div>
    </div>
  );
};

export default MissionProtocol;
