import React from "react";
import { useLanguage } from "../contexts/LanguageContext";
import ReportBugLink from "./ReportBugLink";
import ResponsiveModal from "./common/ResponsiveModal";
import { useColorSchemas } from "../hooks/useColorSchemas";

const PrivacyPolicy = ({ onClose, onReportBug }) => {
  const { t } = useLanguage();
  const { getColorClass, colors } = useColorSchemas();

  return (
    <ResponsiveModal
      isOpen
      onClose={onClose}
      title={t("privacyPolicy", "title")}
      size="xl"
      labelledBy="privacy-policy-title"
      footer={
        <div className="flex items-center justify-between gap-3">
          {onReportBug ? (
            <ReportBugLink
              onClick={onReportBug}
              variant="auto"
              moduleName="Privacy Policy"
            />
          ) : (
            <span />
          )}
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t("privacyPolicy", "closeButton")}
          </button>
        </div>
      }
    >
      <div>
        <p className={`text-sm mb-6 ${getColorClass(colors.text.secondary)}`}>
          <strong>{t("privacyPolicy", "lastUpdated")}</strong> January 23, 2026
        </p>

        <section className="mb-6">
          <h3 className="text-xl font-bold text-gray-800 mb-3">
            {t("privacyPolicy", "section1Title")}
          </h3>
          <p className="text-gray-700 mb-3">
            {t("privacyPolicy", "section1Text")}
          </p>
        </section>

        <section className="mb-6">
          <h3 className="text-xl font-bold text-gray-800 mb-3">
            {t("privacyPolicy", "section2Title")}
          </h3>

          <h4 className="text-lg font-semibold text-gray-800 mb-2">
            {t("privacyPolicy", "section2_1Title")}
          </h4>
          <p className="text-gray-700 mb-3">
            <strong>{t("privacyPolicy", "section2_1Text")}</strong>
          </p>
          <ul className="list-disc list-inside text-gray-700 mb-3 ml-4">
            <li>{t("privacyPolicy", "piiItem1")}</li>
            <li>{t("privacyPolicy", "piiItem2")}</li>
            <li>{t("privacyPolicy", "piiItem3")}</li>
            <li>{t("privacyPolicy", "piiItem4")}</li>
          </ul>

          <h4 className="text-lg font-semibold text-gray-800 mb-2">
            {t("privacyPolicy", "section2_2Title")}
          </h4>
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-3">
            <p className="text-gray-700 mb-2">
              <strong>{t("privacyPolicy", "analyticsTransparency")}</strong>{" "}
              {t("privacyPolicy", "analyticsIntro").split("GoatCounter")[0]}
              <a
                href="https://www.goatcounter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                GoatCounter
              </a>
              {t("privacyPolicy", "analyticsIntro").split("GoatCounter")[1]}
            </p>
            <p className="text-gray-700 mb-2">
              <strong>{t("privacyPolicy", "analyticsCollects")}</strong>
            </p>
            <ul className="list-disc list-inside text-gray-700 mb-2 ml-4">
              <li>{t("privacyPolicy", "analyticsItem1")}</li>
              <li>{t("privacyPolicy", "analyticsItem2")}</li>
              <li>{t("privacyPolicy", "analyticsItem3")}</li>
              <li>{t("privacyPolicy", "analyticsItem4")}</li>
            </ul>
            <p className="text-gray-700 mb-2">
              <strong>{t("privacyPolicy", "analyticsNotCollect")}</strong>
            </p>
            <ul className="list-disc list-inside text-gray-700 mb-2 ml-4">
              <li>{t("privacyPolicy", "analyticsNotItem1")}</li>
              <li>{t("privacyPolicy", "analyticsNotItem2")}</li>
              <li>{t("privacyPolicy", "analyticsNotItem3")}</li>
              <li>{t("privacyPolicy", "analyticsNotItem4")}</li>
              <li>{t("privacyPolicy", "analyticsNotItem5")}</li>
            </ul>
            <p className="text-gray-700 text-sm">
              {t("privacyPolicy", "analyticsGDPR").split(".")[0]}.{" "}
              <a
                href="https://www.goatcounter.com/help/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                {t("privacyPolicy", "analyticsGDPR").split(".")[1]?.trim() ||
                  "Read their privacy policy"}
              </a>
              .
            </p>
          </div>

          <h4 className="text-lg font-semibold text-gray-800 mb-2">
            {t("privacyPolicy", "section2_3Title")}
          </h4>
          <p className="text-gray-700 mb-3">
            {t("privacyPolicy", "section2_3Text")}
          </p>

          <h4 className="text-lg font-semibold text-gray-800 mb-2">
            {t("privacyPolicy", "section2_4Title")}
          </h4>
          <p className="text-gray-700 mb-3">
            <strong>{t("privacyPolicy", "section2_4Text")}</strong>
          </p>
        </section>

        <section className="mb-6">
          <h3 className="text-xl font-bold text-gray-800 mb-3">
            {t("privacyPolicy", "section3Title")}
          </h3>
          <p className="text-gray-700 mb-3">
            <strong>{t("privacyPolicy", "section3Text")}</strong>
          </p>
        </section>

        <section className="mb-6">
          <h3 className="text-xl font-bold text-gray-800 mb-3">
            {t("privacyPolicy", "section4Title")}
          </h3>
          <p className="text-gray-700 mb-3">
            {t("privacyPolicy", "section4Intro")}
          </p>
          <ul className="list-disc list-inside text-gray-700 mb-3 ml-4">
            <li>{t("privacyPolicy", "section4Item1")}</li>
            <li>{t("privacyPolicy", "section4Item2")}</li>
            <li>{t("privacyPolicy", "section4Item3")}</li>
            <li>{t("privacyPolicy", "section4Item4")}</li>
          </ul>
        </section>

        <section className="mb-6">
          <h3 className="text-xl font-bold text-gray-800 mb-3">
            {t("privacyPolicy", "section5Title")}
          </h3>
          <p className="text-gray-700 mb-3">
            <strong>{t("privacyPolicy", "section5Text")}</strong>
          </p>
        </section>

        <section className="mb-6">
          <h3 className="text-xl font-bold text-gray-800 mb-3">
            {t("privacyPolicy", "section6Title")}
          </h3>
          <p className="text-gray-700 mb-3">
            {t("privacyPolicy", "section6Intro")}
          </p>
          <ul className="list-disc list-inside text-gray-700 mb-3 ml-4">
            <li>
              <strong>{t("privacyPolicy", "section6Item1Title")}</strong>{" "}
              {t("privacyPolicy", "section6Item1Text")}
            </li>
            <li>
              <strong>{t("privacyPolicy", "section6Item2Title")}</strong>{" "}
              {t("privacyPolicy", "section6Item2Text")}
            </li>
            <li>
              <strong>{t("privacyPolicy", "section6Item3Title")}</strong>{" "}
              {t("privacyPolicy", "section6Item3Text")}
            </li>
          </ul>
        </section>

        {/* Section 7: AI Processing - WITH PROMINENT WARNING */}
        <section className="mb-6 bg-gradient-to-r from-amber-100 to-orange-100 border-4 border-amber-600 rounded-lg p-6 shadow-lg">
          {/* CRITICAL WARNING BOX */}
          <div className="bg-red-600 text-white p-4 rounded-lg mb-4 border-2 border-red-800 shadow-md">
            <div className="flex items-start gap-3">
              <svg
                className="w-8 h-8 flex-shrink-0 mt-1"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <p className="font-bold text-lg mb-2">
                  ⚠️ CRITICAL PRIVACY NOTICE - READ CAREFULLY
                </p>
                <p className="text-sm leading-relaxed">
                  <strong>
                    Using Google Gemini API with your own key (BYOK) sends your
                    data to Google's cloud data centers.
                  </strong>{" "}
                  Your text, documents, and prompts are transmitted over the
                  internet to Google's servers for processing. While this is a
                  direct connection between you and Google (Vet-Rate.org does
                  not see your data), your information leaves your device and
                  enters Google's infrastructure.{" "}
                  <strong className="underline">
                    For maximum privacy, use Local AI models that run entirely
                    on your device.
                  </strong>
                </p>
              </div>
            </div>
          </div>

          <h3 className="text-2xl font-bold text-black mb-4 flex items-center gap-2 drop-shadow-sm">
            <span className="text-3xl">🔐</span>
            {t("privacyPolicy", "section7Title")}
          </h3>

          <div className="bg-amber-50 border-2 border-amber-500 rounded-lg p-5 mb-4 shadow-sm">
            <p className="text-black mb-3 leading-relaxed">
              <strong className="text-lg text-black">
                {t("privacyPolicy", "section7OptionalAI")}
              </strong>
              <br />
              <span className="text-black">
                {t("privacyPolicy", "section7OptionalAIText")}
              </span>
            </p>

            <div className="bg-amber-100 border-l-4 border-amber-600 p-4 mb-3">
              <p className="text-black mb-2 font-semibold text-lg">
                {t("privacyPolicy", "section7WhatThisMeans")}
              </p>
              <ul className="list-disc list-inside text-black space-y-2 ml-4">
                <li className="leading-relaxed">
                  {t("privacyPolicy", "section7AIItem1")}
                </li>
                <li className="leading-relaxed">
                  <strong className="text-black">Cloud AI Warning:</strong>{" "}
                  {t("privacyPolicy", "section7AIItem2")}
                </li>
                <li className="leading-relaxed">
                  {t("privacyPolicy", "section7AIItem3")}
                </li>
                <li className="leading-relaxed">
                  {t("privacyPolicy", "section7AIItem4")}
                </li>
              </ul>
            </div>

            <div className="bg-blue-100 border-2 border-blue-500 rounded p-4">
              <p className="text-black text-sm leading-relaxed">
                <strong className="text-black">Privacy Recommendation:</strong>{" "}
                {t("privacyPolicy", "section7TransparencyNote")}
              </p>
              <div className="mt-3 text-sm">
                <p className="text-black mb-2">
                  <strong>Cloud AI Provider Links:</strong>
                </p>
                <ul className="list-disc list-inside text-black ml-4 space-y-1">
                  <li>
                    <a
                      href="https://ai.google.dev/gemini-api/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-medium"
                    >
                      Google's Gemini API Terms
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://policies.google.com/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-medium"
                    >
                      Google's Privacy Policy
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-6">
          <h3 className="text-xl font-bold text-gray-800 mb-3">
            {t("privacyPolicy", "section8Title")}
          </h3>
          <p className="text-gray-700 mb-3">
            {t("privacyPolicy", "section8Text")}
          </p>
        </section>

        <section className="mb-6">
          <h3 className="text-xl font-bold text-gray-800 mb-3">
            {t("privacyPolicy", "section9Title")}
          </h3>
          <p className="text-gray-700 mb-3">
            {t("privacyPolicy", "section9Text")}
          </p>
        </section>

        <section className="mb-6">
          <h3 className="text-xl font-bold text-gray-800 mb-3">
            {t("privacyPolicy", "section10Title")}
          </h3>
          <p className="text-gray-700 mb-3">
            {t("privacyPolicy", "section10Text")}
          </p>
        </section>

        <section className="mb-6">
          <h3 className="text-xl font-bold text-gray-800 mb-3">
            {t("privacyPolicy", "section11Title")}
          </h3>
          <p className="text-gray-700 mb-3">
            {t("privacyPolicy", "section11Text")}
          </p>
        </section>

        <div className="bg-green-50 border-l-4 border-green-500 p-4 mt-6">
          <p className="text-sm text-green-800">
            <strong>{t("privacyPolicy", "privacyFirstTitle")}</strong>{" "}
            {t("privacyPolicy", "privacyFirstText")}
          </p>
        </div>
      </div>
    </ResponsiveModal>
  );
};

export default PrivacyPolicy;
