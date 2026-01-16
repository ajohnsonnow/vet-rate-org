import React from 'react';

const PrivacyPolicy = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center rounded-t-lg z-10">
          <h2 className="text-2xl font-bold text-gray-900">Privacy Policy</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-3xl font-bold leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        
        <div className="px-6 py-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          <p className="text-sm text-gray-600 mb-6">
            <strong>Last Updated:</strong> January 15, 2026
          </p>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">1. Introduction</h3>
            <p className="text-gray-700 mb-3">
              Welcome to Vet-Rate.org ("we," "our," or "us"). This Privacy Policy explains how we collect, 
              use, disclose, and safeguard your information when you visit our website. By using our site, 
              you agree to the collection and use of information in accordance with this policy.
            </p>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">2. Information We Collect</h3>
            
            <h4 className="text-lg font-semibold text-gray-800 mb-2">2.1 Personal Information</h4>
            <p className="text-gray-700 mb-3">
              <strong>We do NOT collect Personally Identifiable Information (PII).</strong> Our application 
              operates entirely client-side in your browser. We do not store, transmit, or process any:
            </p>
            <ul className="list-disc list-inside text-gray-700 mb-3 ml-4">
              <li>Names, addresses, or contact information</li>
              <li>Social Security Numbers or military service records</li>
              <li>Medical information or disability details</li>
              <li>Search queries or browsing history</li>
            </ul>

            <h4 className="text-lg font-semibold text-gray-800 mb-2">2.2 Automatically Collected Information</h4>
            <p className="text-gray-700 mb-3">
              When you visit our website, certain information about your device and browsing activity may 
              be automatically collected by third-party services:
            </p>
            <ul className="list-disc list-inside text-gray-700 mb-3 ml-4">
              <li><strong>Cookies:</strong> We use cookies for advertising purposes (Google AdSense)</li>
              <li><strong>Analytics Data:</strong> IP address, browser type, device information, pages visited</li>
              <li><strong>Advertising Data:</strong> Ad interactions and preferences collected by Google AdSense</li>
            </ul>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">3. Use of Cookies and Advertising</h3>
            
            <h4 className="text-lg font-semibold text-gray-800 mb-2">3.1 Google AdSense</h4>
            <p className="text-gray-700 mb-3">
              We use <strong>Google AdSense</strong> to display advertisements on our website. Google AdSense 
              uses cookies and other tracking technologies to:
            </p>
            <ul className="list-disc list-inside text-gray-700 mb-3 ml-4">
              <li>Display personalized ads based on your interests and browsing history</li>
              <li>Measure ad performance and engagement</li>
              <li>Prevent fraudulent ad clicks</li>
            </ul>
            <p className="text-gray-700 mb-3">
              Google may use cookies to serve ads based on your prior visits to our website or other websites. 
              You can opt out of personalized advertising by visiting{' '}
              <a 
                href="https://www.google.com/settings/ads" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Google Ads Settings
              </a> or{' '}
              <a 
                href="http://www.aboutads.info/choices/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                www.aboutads.info
              </a>.
            </p>

            <h4 className="text-lg font-semibold text-gray-800 mb-2">3.2 Third-Party Cookies</h4>
            <p className="text-gray-700 mb-3">
              Third-party vendors, including Google, use cookies to serve ads based on your past visits to 
              our website. These cookies enable Google and its partners to serve ads to you based on your 
              visit to this site and/or other sites on the Internet.
            </p>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">4. How We Use Your Information</h3>
            <p className="text-gray-700 mb-3">
              Since we do not collect PII, your information is only used by third-party services for:
            </p>
            <ul className="list-disc list-inside text-gray-700 mb-3 ml-4">
              <li>Displaying relevant advertisements (Google AdSense)</li>
              <li>Analyzing website traffic and usage patterns (if analytics are implemented)</li>
              <li>Improving website performance and user experience</li>
            </ul>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">5. Data Sharing and Disclosure</h3>
            <p className="text-gray-700 mb-3">
              We do not sell, trade, or rent your personal information. However, third-party advertising 
              partners (Google AdSense) may collect and process data as described in their privacy policies:
            </p>
            <ul className="list-disc list-inside text-gray-700 mb-3 ml-4">
              <li>
                <a 
                  href="https://policies.google.com/privacy" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Google Privacy Policy
                </a>
              </li>
              <li>
                <a 
                  href="https://policies.google.com/technologies/partner-sites" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  How Google Uses Information from Sites or Apps That Use Our Services
                </a>
              </li>
            </ul>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">6. Your Privacy Rights</h3>
            <p className="text-gray-700 mb-3">
              Depending on your location, you may have the following rights:
            </p>
            <ul className="list-disc list-inside text-gray-700 mb-3 ml-4">
              <li><strong>Access:</strong> Request a copy of data collected about you</li>
              <li><strong>Opt-Out:</strong> Disable personalized ads via Google Ads Settings</li>
              <li><strong>Cookie Control:</strong> Manage cookies through your browser settings</li>
              <li><strong>Do Not Track:</strong> Enable Do Not Track (DNT) signals in your browser</li>
            </ul>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">7. Children's Privacy</h3>
            <p className="text-gray-700 mb-3">
              Our website is not intended for children under the age of 13. We do not knowingly collect 
              information from children under 13. If you believe we have inadvertently collected such 
              information, please contact us immediately.
            </p>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">8. Security</h3>
            <p className="text-gray-700 mb-3">
              Since our application operates entirely client-side and does not transmit or store PII, your 
              searches and interactions remain private on your device. However, we cannot guarantee the 
              security of information collected by third-party services like Google AdSense.
            </p>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">9. Changes to This Privacy Policy</h3>
            <p className="text-gray-700 mb-3">
              We may update this Privacy Policy from time to time. Changes will be posted on this page with 
              an updated "Last Updated" date. Your continued use of the website after changes constitutes 
              acceptance of the updated policy.
            </p>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">10. Contact Us</h3>
            <p className="text-gray-700 mb-3">
              If you have questions about this Privacy Policy, please contact us via the Contact page.
            </p>
          </section>

          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mt-6">
            <p className="text-sm text-blue-800">
              <strong>Summary:</strong> We respect your privacy. This site does not collect, store, or 
              transmit your personal information. Third-party advertising services (Google AdSense) use 
              cookies to display relevant ads. You can opt out of personalized advertising at any time.
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
