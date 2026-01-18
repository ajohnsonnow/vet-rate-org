import React from 'react';
import ReportBugLink from './ReportBugLink';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';

const PrivacyPolicy = ({ onClose, onReportBug }) => {
  // Lock body scroll when modal is open
  useBodyScrollLock(true);

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto modal-backdrop overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-policy-title"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8 modal-content">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center rounded-t-lg z-10">
          <h2 id="privacy-policy-title" className="text-2xl font-bold text-gray-900">🔒 Privacy Policy</h2>
          <div className="flex items-center gap-3">
            {onReportBug && <ReportBugLink onClick={onReportBug} variant="dark" moduleName="Privacy Policy" />}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-3xl font-bold leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
        
        <div className="px-6 py-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          <p className="text-sm text-gray-600 mb-6">
            <strong>Last Updated:</strong> January 15, 2026
          </p>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">1. Introduction</h3>
            <p className="text-gray-700 mb-3">
              Welcome to Vet-Rate.org. I'm a service-connected disabled veteran who built this site to help 
              fellow veterans navigate the VA disability rating process. This Privacy Policy explains how 
              information is handled when you visit this website. By using this site, you agree to the 
              practices described in this policy.
            </p>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">2. Information Collection</h3>
            
            <h4 className="text-lg font-semibold text-gray-800 mb-2">2.1 Personal Information</h4>
            <p className="text-gray-700 mb-3">
              <strong>This site does NOT collect Personally Identifiable Information (PII).</strong> The application 
              operates entirely client-side in your browser. No data is stored, transmitted, or processed including:
            </p>
            <ul className="list-disc list-inside text-gray-700 mb-3 ml-4">
              <li>Names, addresses, or contact information</li>
              <li>Social Security Numbers or military service records</li>
              <li>Medical information or disability details</li>
              <li>Search queries or browsing history</li>
            </ul>

            <h4 className="text-lg font-semibold text-gray-800 mb-2">2.2 Automatically Collected Information</h4>
            <p className="text-gray-700 mb-3">
              <strong>This site does not use advertising networks or third-party trackers.</strong> To protect veteran 
              privacy, I have intentionally avoided implementing any tracking technologies that could collect 
              your data. Your searches and browsing activity on this site remain completely private.
            </p>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">3. Cookies and Tracking</h3>
            <p className="text-gray-700 mb-3">
              <strong>This site does not use cookies for tracking or advertising purposes.</strong> Any cookies used 
              are strictly for essential functionality (such as saving your preferences locally 
              in your browser). No information is shared with third-party advertisers.
            </p>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">4. How Information Is Used</h3>
            <p className="text-gray-700 mb-3">
              Since this site does not collect PII or use tracking technologies:
            </p>
            <ul className="list-disc list-inside text-gray-700 mb-3 ml-4">
              <li>Your search queries remain private in your browser</li>
              <li>Your disability research is never transmitted to any server</li>
              <li>Your "My Packet" saved items are stored only in your browser's local storage</li>
              <li>No advertising profiles are created about you</li>
            </ul>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">5. Data Sharing and Disclosure</h3>
            <p className="text-gray-700 mb-3">
              <strong>Your personal information is never sold, traded, rented, or shared with anyone.</strong> 
              Since no data is collected, there is nothing to share. Your privacy is protected by design.
            </p>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">6. Your Privacy Rights</h3>
            <p className="text-gray-700 mb-3">
              Since this site does not collect personal data, your privacy is inherently protected. However, you always have the right to:
            </p>
            <ul className="list-disc list-inside text-gray-700 mb-3 ml-4">
              <li><strong>Clear Local Storage:</strong> Delete any locally saved preferences from your browser</li>
              <li><strong>Browse Privately:</strong> Use your browser's private/incognito mode</li>
              <li><strong>Contact Me:</strong> Ask questions about the privacy practices on this site</li>
            </ul>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">7. Children's Privacy</h3>
            <p className="text-gray-700 mb-3">
              This website is not intended for children under the age of 13. No information is knowingly collected 
              from children under 13. If you believe any such information has been inadvertently collected, 
              please contact me immediately.
            </p>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">8. Security</h3>
            <p className="text-gray-700 mb-3">
              This application operates entirely client-side and does not transmit or store PII. Your 
              searches and interactions remain private on your device. No third-party 
              advertising or tracking services are used that could compromise your privacy.
            </p>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">9. Changes to This Privacy Policy</h3>
            <p className="text-gray-700 mb-3">
              This Privacy Policy may be updated from time to time. Changes will be posted on this page with 
              an updated "Last Updated" date. Your continued use of the website after changes constitutes 
              acceptance of the updated policy.
            </p>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">10. Contact</h3>
            <p className="text-gray-700 mb-3">
              If you have questions about this Privacy Policy, please reach out via the Contact page.
            </p>
          </section>

          <div className="bg-green-50 border-l-4 border-green-500 p-4 mt-6">
            <p className="text-sm text-green-800">
              <strong>🛡️ Privacy-First Design:</strong> Vet-Rate.org is built with veteran privacy as a top priority. 
              This site does not collect, store, or transmit your personal information. No advertising networks 
              or third-party trackers are used. Your searches and disability research remain completely private.
            </p>
          </div>
        </div>

        <div className="border-t px-6 py-4 bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
