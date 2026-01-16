import React from 'react';

const AboutUs = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center rounded-t-lg z-10">
          <h2 className="text-2xl font-bold text-gray-900">About Vet-Rate.org</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-3xl font-bold leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        
        <div className="px-6 py-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">Our Mission</h3>
            <p className="text-gray-700 mb-3">
              <strong>Vet-Rate.org</strong> was created to empower veterans with accessible, accurate information 
              about VA disability ratings. Navigating the VA disability system can be overwhelming. Our goal is 
              to simplify the process by providing instant access to official rating criteria from{' '}
              <a 
                href="https://www.ecfr.gov/current/title-38/chapter-I/part-4" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                38 CFR Part 4
              </a>, helping veterans understand their benefits and prepare for C&P exams.
            </p>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">What We Do</h3>
            <p className="text-gray-700 mb-3">
              This free tool allows veterans to:
            </p>
            <ul className="list-disc list-inside text-gray-700 mb-3 ml-4">
              <li><strong>Search by Condition:</strong> Find your disability by name (PTSD, arthritis) or diagnostic code (9411, 5002)</li>
              <li><strong>Understand Rating Criteria:</strong> See exactly what the VA looks for when assigning ratings (0%, 10%, 30%, etc.)</li>
              <li><strong>Prepare for C&P Exams:</strong> Learn what symptoms and functional limitations matter for your condition</li>
              <li><strong>Discover Secondary Conditions:</strong> Identify related conditions that may qualify for additional benefits</li>
              <li><strong>Generate PDF Reports:</strong> Download comprehensive guides with VA resources and claim guidance</li>
            </ul>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">Our Data Sources</h3>
            <p className="text-gray-700 mb-3">
              All disability information is sourced directly from official U.S. Government regulations:
            </p>
            <ul className="list-disc list-inside text-gray-700 mb-3 ml-4">
              <li>
                <strong>38 CFR Part 4 (eCFR):</strong> The VA Schedule for Rating Disabilities, which defines 
                how conditions are evaluated and rated
              </li>
              <li>
                <strong>749 VA Disabilities:</strong> Comprehensive coverage of all body systems (Musculoskeletal, 
                Mental Disorders, Cardiovascular, Respiratory, etc.)
              </li>
              <li>
                <strong>569 Conditions with Full Rating Criteria:</strong> Detailed percentage breakdowns for 
                accurate understanding of your potential rating
              </li>
            </ul>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">Why We Built This</h3>
            <p className="text-gray-700 mb-3">
              Too many veterans struggle to understand VA ratings because official resources are scattered, 
              technical, and hard to navigate. We believe every veteran deserves clear, actionable information 
              about their benefits without hiring expensive consultants or spending hours researching.
            </p>
            <p className="text-gray-700 mb-3">
              <strong>This tool is 100% free</strong> and runs entirely in your browser—no accounts, no data 
              collection, and no PII storage. Your searches and PDF downloads remain private.
            </p>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">Who We Are</h3>
            <p className="text-gray-700 mb-3">
              Vet-Rate.org is an independent educational resource created by a developer passionate about helping 
              veterans navigate the VA disability system. This is not an official VA website, law firm, or medical 
              service. We are simply providing a tool that makes publicly available information easier to access 
              and understand.
            </p>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">Important Disclaimers</h3>
            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-4">
              <p className="text-sm text-yellow-800">
                <strong>⚠️ Not Legal or Medical Advice:</strong> This tool provides educational information only. 
                It does not constitute legal or medical advice. Always consult with qualified professionals for 
                guidance specific to your situation.
              </p>
            </div>
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
              <p className="text-sm text-blue-800">
                <strong>💼 Not Affiliated with the VA:</strong> Vet-Rate.org is an independent resource and is 
                not endorsed by, affiliated with, or approved by the U.S. Department of Veterans Affairs.
              </p>
            </div>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">How We're Funded</h3>
            <p className="text-gray-700 mb-3">
              To keep this tool free and maintain hosting costs, we display advertisements (Google AdSense) and 
              include affiliate links to helpful veteran resources (e.g., medical gear, books, services). We may 
              earn a small commission if you purchase through these links, but <strong>it never costs you extra</strong>.
            </p>
            <p className="text-gray-700 mb-3 italic">
              As an Amazon Associate, we earn from qualifying purchases.
            </p>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">Our Commitment to Veterans</h3>
            <p className="text-gray-700 mb-3">
              We are committed to:
            </p>
            <ul className="list-disc list-inside text-gray-700 mb-3 ml-4">
              <li>✅ Keeping the tool <strong>100% free</strong> forever</li>
              <li>✅ Protecting your <strong>privacy</strong>—no data collection or tracking beyond ads</li>
              <li>✅ Providing <strong>accurate, up-to-date</strong> information from official sources</li>
              <li>✅ Continuously <strong>improving</strong> the tool based on veteran feedback</li>
            </ul>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">Contact & Feedback</h3>
            <p className="text-gray-700 mb-3">
              Have suggestions, found an error, or want to say thanks? We'd love to hear from you! Visit our{' '}
              <span className="text-blue-600 font-semibold cursor-pointer hover:underline">Contact</span> page 
              to get in touch.
            </p>
          </section>

          <div className="bg-green-50 border-l-4 border-green-500 p-4 mt-6">
            <p className="text-sm text-green-800">
              <strong>🇺🇸 Thank You for Your Service</strong><br />
              Every veteran who finds their information faster because of this tool is a win. We're honored 
              to support you in understanding your VA benefits.
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

export default AboutUs;
