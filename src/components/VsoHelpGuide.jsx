import { useLanguage } from "../contexts/LanguageContext";
import ResponsiveModal from "./common/ResponsiveModal";

const SECTIONS = [
  ["profileTitle", "profileBody"],
  ["extensionsTitle", "extensionsBody"],
  ["deviceTitle", "deviceBody"],
  ["deleteTitle", "deleteBody"],
  ["authTitle", "authBody"],
  ["namingTitle", "namingBody"],
];

export default function VsoHelpGuide({ onClose }) {
  const { t } = useLanguage();

  return (
    <ResponsiveModal
      isOpen
      onClose={onClose}
      title={t("vsoHelp", "title")}
      size="lg"
      zIndex={70}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-lg bg-gray-200 px-6 py-2 text-gray-900 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
        >
          {t("vsoHelp", "close")}
        </button>
      }
    >
      <div className="min-w-0 max-w-prose px-4 py-4 text-gray-900 dark:text-gray-100">
        <p className="mb-6">{t("vsoHelp", "intro")}</p>
        <h3 className="mb-3 text-lg font-semibold">
          {t("vsoHelp", "stepsHeading")}
        </h3>
        <ol className="list-decimal space-y-4 pl-6">
          {SECTIONS.map(([titleKey, bodyKey]) => (
            <li key={titleKey}>
              <p className="font-semibold">{t("vsoHelp", titleKey)}</p>
              <p>{t("vsoHelp", bodyKey)}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm text-gray-700 dark:text-gray-300">
          {t("vsoHelp", "footnote")}
        </p>
      </div>
    </ResponsiveModal>
  );
}
