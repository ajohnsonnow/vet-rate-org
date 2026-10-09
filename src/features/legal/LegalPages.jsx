import { lazy, Suspense, useState, useEffect } from "react";

const PrivacyPolicy = lazy(() => import("../../components/PrivacyPolicyPage"));
const AboutUs = lazy(() => import("../../components/AboutUs"));
const ContactUs = lazy(() => import("../../components/ContactUs"));
const TermsOfServicePage = lazy(
  () => import("../../components/TermsOfServicePage"),
);

/**
 * Footer legal/info modals — Privacy Policy, About Us, Contact Us, and
 * Terms of Service. Opened by `openPrivacyPolicy`, `openAboutUs`,
 * `openContactUs`, `openTermsOfService` window events; closed internally.
 *
 * Extracted from App.jsx (audit #35, B33). The "Report Bug" callbacks on
 * three of the four pages dispatch `openBugSquasher` instead of holding a
 * setter reference; App.jsx wires that event to setShowBugSquasher.
 */
export default function LegalPages() {
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  useEffect(() => {
    const openPrivacy = () => setShowPrivacy(true);
    const openAbout = () => setShowAbout(true);
    const openContact = () => setShowContact(true);
    const openTerms = () => setShowTerms(true);
    window.addEventListener("openPrivacyPolicy", openPrivacy);
    window.addEventListener("openAboutUs", openAbout);
    window.addEventListener("openContactUs", openContact);
    window.addEventListener("openTermsOfService", openTerms);
    return () => {
      window.removeEventListener("openPrivacyPolicy", openPrivacy);
      window.removeEventListener("openAboutUs", openAbout);
      window.removeEventListener("openContactUs", openContact);
      window.removeEventListener("openTermsOfService", openTerms);
    };
  }, []);

  const reportBug = () =>
    window.dispatchEvent(new CustomEvent("openBugSquasher"));

  return (
    <Suspense fallback={null}>
      {showPrivacy && (
        <PrivacyPolicy
          onClose={() => setShowPrivacy(false)}
          onReportBug={reportBug}
        />
      )}
      {showAbout && (
        <AboutUs onClose={() => setShowAbout(false)} onReportBug={reportBug} />
      )}
      {showContact && (
        <ContactUs
          onClose={() => setShowContact(false)}
          onReportBug={reportBug}
        />
      )}
      {showTerms && <TermsOfServicePage onClose={() => setShowTerms(false)} />}
    </Suspense>
  );
}
