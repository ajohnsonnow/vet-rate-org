import { useState } from "react";
import ResponsiveModal from "../../components/common/ResponsiveModal";
import AffiliationPicker from "../../components/AffiliationPicker";

/**
 * AffiliationPickerPrompt — one-time optional onboarding step (Sprint 4).
 *
 * Shown once to first-time visitors after the DisclaimerSplash is acknowledged,
 * before the BootCampTour starts. Fully skippable: "Skip" and "Done" both call
 * onDone(), which marks the prompt seen in localStorage and resumes the flow.
 * No palette choice is required; the default persists if the user skips.
 */
export default function AffiliationPickerPrompt({ onDone }) {
  const [pickerOpen, setPickerOpen] = useState(true);

  const handleClose = () => {
    setPickerOpen(false);
    onDone();
  };

  return (
    <ResponsiveModal
      isOpen={pickerOpen}
      onClose={handleClose}
      zIndex={80}
      size="md"
      labelledBy="affiliation-prompt-title"
      header={
        <div className="bg-gradient-to-r from-va-blue to-green-800 dark:from-gray-700 dark:to-gray-800 px-6 py-5">
          <h2
            id="affiliation-prompt-title"
            className="text-xl font-bold text-white mb-1"
          >
            Make it yours 🎖️
          </h2>
          <p className="text-green-100 dark:text-gray-300 text-sm">
            Choose an affiliation palette — or skip and stick with the default.
          </p>
        </div>
      }
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            data-testid="affiliation-prompt-skip"
            onClick={handleClose}
            className="flex-1 py-3 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-semibold text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-va-blue"
          >
            Skip
          </button>
          <button
            type="button"
            data-testid="affiliation-prompt-done"
            onClick={handleClose}
            className="flex-1 py-3 px-4 bg-va-blue dark:bg-va-gold text-white dark:text-gray-900 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-va-blue"
          >
            Done
          </button>
        </div>
      }
    >
      <div
        data-testid="affiliation-prompt"
        className="space-y-4"
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Personalize your accent colors to reflect your branch or service. This
          only changes accent colors — all accessibility settings still apply on
          top. You can change this anytime in{" "}
          <span className="font-medium text-gray-800 dark:text-gray-200">
            Accessibility → Affiliation
          </span>
          .
        </p>
        <AffiliationPicker />
      </div>
    </ResponsiveModal>
  );
}
