/**
 * VA Data Consent Prompt
 * Appears after successful OAuth login
 * Asks veteran for permission to save VA data locally
 */

import { useState } from "react";
import { Shield, Save, Lock, Database, FileText } from "lucide-react";
import ResponsiveModal from "./common/ResponsiveModal";

const ConsentHeader = () => (
  <div className="border-b border-gray-200 bg-white px-6 py-5 dark:border-gray-700 dark:bg-gray-900">
    <div className="flex items-center gap-3 mb-2">
      <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
        <Shield className="text-blue-600 dark:text-blue-400" size={24} />
      </div>
      <h2
        id="va-consent-title"
        className="text-2xl font-bold text-gray-900 dark:text-white"
      >
        Save Your VA Data?
      </h2>
    </div>
    <p className="text-gray-600 dark:text-gray-300">
      We successfully fetched your data from VA.gov. Would you like to save
      it locally?
    </p>
  </div>
);

const ConsentFooter = ({ onConsent, onSkip, saveToPacket, saveToVKB }) => (
  <div className="flex gap-3">
    <button
      onClick={() => onConsent({ saveToPacket, saveToVKB })}
      disabled={!saveToPacket && !saveToVKB}
      className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
    >
      <Save size={20} />
      {saveToPacket || saveToVKB
        ? "Save & Continue"
        : "Select at least one option"}
    </button>
    <button
      onClick={onSkip}
      className="px-6 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 font-semibold text-gray-700 dark:text-gray-300 transition-colors"
    >
      Skip
    </button>
  </div>
);

const ConsentDataSummary = ({
  claimsCount,
  appealsCount,
  hasServiceHistory,
  appealableIssuesCount,
}) => (
  <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 p-4">
    <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
      Available Data:
    </h3>
    <div className="space-y-2 text-sm">
      {claimsCount > 0 && (
        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
          <FileText size={16} className="text-blue-500" />
          <span>
            {claimsCount} active claim{claimsCount !== 1 ? "s" : ""}
          </span>
        </div>
      )}
      {appealsCount > 0 && (
        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
          <FileText size={16} className="text-purple-500" />
          <span>
            {appealsCount} appeal{appealsCount !== 1 ? "s" : ""}
          </span>
        </div>
      )}
      {hasServiceHistory && (
        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
          <Database size={16} className="text-green-500" />
          <span>Military service history</span>
        </div>
      )}
      {appealableIssuesCount > 0 && (
        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
          <FileText size={16} className="text-orange-500" />
          <span>
            {appealableIssuesCount} appealable issue
            {appealableIssuesCount !== 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  </div>
);

const ConsentStorageOptions = ({
  saveToPacket,
  setSaveToPacket,
  saveToVKB,
  setSaveToVKB,
}) => (
  <div className="space-y-4">
    {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
    <label className="flex items-start gap-3 cursor-pointer p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors">
      <input
        type="checkbox"
        checked={saveToPacket}
        onChange={(e) => setSaveToPacket(e.target.checked)}
        className="w-5 h-5 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <div className="flex-1">
        <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <FileText size={18} className="text-blue-500" />
          Save to My Packet
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Store claims and appeals in your personal packet for tracking and
          management
        </div>
      </div>
    </label>

    {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
    <label className="flex items-start gap-3 cursor-pointer p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors">
      <input
        type="checkbox"
        checked={saveToVKB}
        onChange={(e) => setSaveToVKB(e.target.checked)}
        className="w-5 h-5 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <div className="flex-1">
        <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Database size={18} className="text-green-500" />
          Save to Knowledge Base
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Enable AI assistance with your claim data and service history
        </div>
      </div>
    </label>
  </div>
);

const ConsentPrivacyNotice = () => (
  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
    <div className="flex items-start gap-3">
      <Lock
        className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0"
        size={20}
      />
      <div className="text-sm text-gray-700 dark:text-gray-300">
        <div className="font-semibold text-gray-900 dark:text-white mb-1">
          Your Privacy Guaranteed:
        </div>
        <ul className="space-y-1 list-disc list-inside">
          <li>All data stays on YOUR device (no server uploads)</li>
          <li>Stored in browser localStorage/IndexedDB</li>
          <li>You can delete it anytime from My Packet</li>
          <li>Full control over your data</li>
        </ul>
      </div>
    </div>
  </div>
);

const VaDataConsentPrompt = ({ onConsent, onSkip, vaData }) => {
  const [saveToPacket, setSaveToPacket] = useState(true);
  const [saveToVKB, setSaveToVKB] = useState(true);

  // Count what data is available
  const claimsCount = vaData?.claims?.length || 0;
  const appealsCount = vaData?.appeals?.length || 0;
  const hasServiceHistory = !!vaData?.serviceHistory;
  const appealableIssuesCount = vaData?.appealableIssues?.length || 0;

  return (
    <ResponsiveModal
      isOpen
      onClose={onSkip}
      dismissable={false}
      size="md"
      zIndex={9999}
      labelledBy="va-consent-title"
      header={<ConsentHeader />}
      footer={
        <ConsentFooter
          onConsent={onConsent}
          onSkip={onSkip}
          saveToPacket={saveToPacket}
          saveToVKB={saveToVKB}
        />
      }
    >
      <div className="space-y-5">
        {/* Data Summary */}
        <ConsentDataSummary
          claimsCount={claimsCount}
          appealsCount={appealsCount}
          hasServiceHistory={hasServiceHistory}
          appealableIssuesCount={appealableIssuesCount}
        />

        {/* Storage Options */}
        <ConsentStorageOptions
          saveToPacket={saveToPacket}
          setSaveToPacket={setSaveToPacket}
          saveToVKB={saveToVKB}
          setSaveToVKB={setSaveToVKB}
        />

        {/* Privacy Notice */}
        <ConsentPrivacyNotice />
      </div>
    </ResponsiveModal>
  );
};

export default VaDataConsentPrompt;
