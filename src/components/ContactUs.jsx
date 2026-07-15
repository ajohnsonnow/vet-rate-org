import { useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import ReportBugLink from "./ReportBugLink";
import ResponsiveModal from "./common/ResponsiveModal";

const ContactUs = ({ onClose, onReportBug }) => {
  const { t } = useLanguage();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Create mailto link with form data
    const mailtoLink = `mailto:Anth@StructuredForGrowth.com?subject=${encodeURIComponent(formData.subject || "Contact from Vet-Rate.org")}&body=${encodeURIComponent(
      `Name: ${formData.name}\nEmail: ${formData.email}\n\nMessage:\n${formData.message}`,
    )}`;

    window.location.href = mailtoLink;
    setSubmitted(true);

    // Reset form after 2 seconds
    setTimeout(() => {
      setSubmitted(false);
      setFormData({ name: "", email: "", subject: "", message: "" });
    }, 2000);
  };

  return (
    <ResponsiveModal
      isOpen
      onClose={onClose}
      title={`📧 ${t("contactUs", "title")}`}
      size="lg"
      labelledBy="contact-us-title"
      footer={
        <ContactUsFooter onClose={onClose} onReportBug={onReportBug} t={t} />
      }
    >
      <div>
        <section className="mb-6">
          <p className="text-gray-700 mb-4">{t("contactUs", "introText")}</p>
        </section>

        {submitted ? (
          <ContactUsSuccessMessage t={t} />
        ) : (
          <ContactUsForm
            formData={formData}
            handleChange={handleChange}
            handleSubmit={handleSubmit}
            t={t}
          />
        )}

        <ContactUsOtherWays t={t} />
        <ContactUsFaq t={t} />
      </div>
    </ResponsiveModal>
  );
};

const ContactUsFooter = ({ onClose, onReportBug, t }) => (
  <div className="flex items-center justify-between gap-3">
    {onReportBug ? (
      <ReportBugLink
        onClick={onReportBug}
        variant="auto"
        moduleName="Contact Us"
      />
    ) : (
      <span />
    )}
    <button
      onClick={onClose}
      className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
    >
      {t("common", "close")}
    </button>
  </div>
);

const ContactUsSuccessMessage = ({ t }) => (
  <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
    <svg
      className="mx-auto mb-4 w-16 h-16 text-green-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      ></path>
    </svg>
    <h3 className="text-xl font-bold text-green-800 mb-2">
      {t("contactUs", "successTitle")}
    </h3>
    <p className="text-green-700">{t("contactUs", "successMessage")}</p>
  </div>
);

const ContactUsFormFields = ({ formData, handleChange, t }) => (
  <>
    <div>
      <label
        htmlFor="name"
        className="block text-sm font-semibold text-gray-700 mb-2"
      >
        {t("contactUs", "nameLabel")} *
      </label>
      <input
        type="text"
        id="name"
        name="name"
        required
        value={formData.name}
        onChange={handleChange}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        placeholder={t("contactUs", "namePlaceholder")}
      />
    </div>

    <div>
      <label
        htmlFor="email"
        className="block text-sm font-semibold text-gray-700 mb-2"
      >
        {t("contactUs", "emailLabel")} *
      </label>
      <input
        type="email"
        id="email"
        name="email"
        required
        value={formData.email}
        onChange={handleChange}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        placeholder={t("contactUs", "emailPlaceholder")}
      />
    </div>

    <div>
      <label
        htmlFor="subject"
        className="block text-sm font-semibold text-gray-700 mb-2"
      >
        {t("contactUs", "subjectLabel")}
      </label>
      <input
        type="text"
        id="subject"
        name="subject"
        value={formData.subject}
        onChange={handleChange}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        placeholder={t("contactUs", "subjectPlaceholder")}
      />
    </div>

    <div>
      <label
        htmlFor="message"
        className="block text-sm font-semibold text-gray-700 mb-2"
      >
        {t("contactUs", "messageLabel")} *
      </label>
      <textarea
        id="message"
        name="message"
        required
        value={formData.message}
        onChange={handleChange}
        rows="6"
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        placeholder={t("contactUs", "messagePlaceholder")}
      ></textarea>
    </div>
  </>
);

const ContactUsForm = ({ formData, handleChange, handleSubmit, t }) => (
  <form onSubmit={handleSubmit} className="space-y-4">
    <ContactUsFormFields
      formData={formData}
      handleChange={handleChange}
      t={t}
    />

    <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
      <p className="text-sm text-blue-800">
        <strong>{t("contactUs", "noteLabel")}:</strong>{" "}
        {t("contactUs", "noteText")}{" "}
        <a href="mailto:Anth@StructuredForGrowth.com" className="underline">
          Anth@StructuredForGrowth.com
        </a>
      </p>
    </div>

    <button
      type="submit"
      className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
    >
      {t("contactUs", "sendButton")}
    </button>
  </form>
);

const ContactUsOtherWays = ({ t }) => (
  <section className="mt-8 pt-6 border-t border-gray-200">
    <h3 className="text-lg font-bold text-gray-800 mb-3">
      {t("contactUs", "otherWaysTitle")}
    </h3>
    <ul className="space-y-2 text-gray-700">
      <li>
        <strong>{t("contactUs", "githubLabel")}:</strong>{" "}
        <a
          href="https://github.com/ajohnsonnow/vet-rate-org"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          github.com/ajohnsonnow/vet-rate-org
        </a>
      </li>
      <li>
        <strong>{t("contactUs", "reportIssueLabel")}:</strong>{" "}
        {t("contactUs", "reportIssueText")}{" "}
        <a
          href="https://github.com/ajohnsonnow/vet-rate-org/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          {t("contactUs", "githubIssuesPage")}
        </a>
      </li>
    </ul>
  </section>
);

const ContactUsFaq = ({ t }) => (
  <section className="mt-6">
    <h3 className="text-lg font-bold text-gray-800 mb-3">
      {t("contactUs", "faqTitle")}
    </h3>
    <div className="space-y-3">
      <div>
        <p className="font-semibold text-gray-800">
          {t("contactUs", "faq1Question")}
        </p>
        <p className="text-gray-700 text-sm">{t("contactUs", "faq1Answer")}</p>
      </div>
      <div>
        <p className="font-semibold text-gray-800">
          {t("contactUs", "faq2Question")}
        </p>
        <p className="text-gray-700 text-sm">{t("contactUs", "faq2Answer")}</p>
      </div>
      <div>
        <p className="font-semibold text-gray-800">
          {t("contactUs", "faq3Question")}
        </p>
        <p className="text-gray-700 text-sm">{t("contactUs", "faq3Answer")}</p>
      </div>
    </div>
  </section>
);

export default ContactUs;
