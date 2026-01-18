import React from 'react';
import ReportBugLink from './ReportBugLink';

const AboutUs = ({ onClose, onReportBug }) => {
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-us-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full my-8">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-6 py-4 flex justify-between items-center rounded-t-lg z-10">
          <h2 id="about-us-title" className="text-2xl font-bold text-gray-900 dark:text-gray-100">ℹ️ About Vet-Rate.org</h2>
          <div className="flex items-center gap-3">
            {onReportBug && <ReportBugLink onClick={onReportBug} variant="dark" moduleName="About Us" />}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-3xl font-bold leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
        
        <div className="px-6 py-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3">🎯 My Mission</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              <strong>Vet-Rate.org</strong> was created to empower veterans with accessible, accurate information 
              about VA disability ratings. Navigating the VA disability system can be overwhelming. My goal is 
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
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3">🛠️ What This Tool Does</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              This free tool allows veterans to:
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 mb-3 ml-4">
              <li>🔍 <strong>Search by Condition:</strong> Find your disability by name (PTSD, arthritis) or diagnostic code (9411, 5002)</li>
              <li>📊 <strong>Understand Rating Criteria:</strong> See exactly what the VA looks for when assigning ratings (0%, 10%, 30%, etc.)</li>
              <li>🎯 <strong>Prepare for C&P Exams:</strong> Learn what symptoms and functional limitations matter for your condition</li>
              <li>🔗 <strong>Discover Secondary Conditions:</strong> Identify related conditions that may qualify for additional benefits</li>
              <li>📄 <strong>Generate PDF Reports:</strong> Download comprehensive guides with VA resources and claim guidance</li>
            </ul>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3">Data Sources</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              All disability information is sourced directly from official U.S. Government regulations:
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 mb-3 ml-4">
              <li>
                <strong>38 CFR Part 4 (eCFR):</strong> The VA Schedule for Rating Disabilities, which defines 
                how conditions are evaluated and rated
              </li>
              <li>
                <strong>748 VA Disabilities:</strong> Comprehensive coverage of all body systems (Musculoskeletal, 
                Mental Disorders, Cardiovascular, Respiratory, Neurological, etc.)
              </li>
              <li>
                <strong>100% Rating Criteria Coverage:</strong> All 748 conditions include detailed percentage 
                breakdowns from official 38 CFR regulations
              </li>
            </ul>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3">Why I Built This</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              Too many veterans struggle to understand VA ratings because official resources are scattered, 
              technical, and hard to navigate. I believe every veteran deserves clear, actionable information 
              about their benefits without hiring expensive consultants or spending hours researching.
            </p>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              <strong>This tool is 100% free</strong> and runs entirely in your browser - no accounts, no data 
              collection, and no PII storage. Your searches and PDF downloads remain private.
            </p>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3">Who I Am</h3>
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="flex-shrink-0">
                <img 
                  src="/images/Anth.jpg" 
                  alt="Veteran in military uniform" 
                  className="w-48 h-auto rounded-lg shadow-lg border-2 border-gray-300 dark:border-gray-600"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2 italic">SGT Johnson, 92Y20</p>
              </div>
              <div className="flex-1">
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  Vet-Rate.org is an independent educational resource created by a fellow service-disabled veteran passionate about helping 
                  other veterans navigate the VA disability system. This is not an official VA website, law firm, or medical 
                  service. I am simply providing a tool that makes publicly available information easier to access 
                  and understand.
                </p>
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  As a veteran who has navigated the VA system myself, I understand the frustration of trying to decode 
                  complex regulations and figure out what benefits you're entitled to. That's why I built this tool - to 
                  make the process clearer for all of us who served.
                </p>
                <p className="text-gray-600 dark:text-gray-400 italic text-left mt-4">~ Anth</p>
              </div>
            </div>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3">🐱 The Development Team</h3>
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Behind every late-night coding session is a dedicated team:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">🐱</span>
                    <h4 className="font-bold text-gray-800 dark:text-gray-200">Luna</h4>
                    <span className="text-xs bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300 px-2 py-0.5 rounded-full">aka Sweet Baby Kitty Cat</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Chief Morale Officer & Keyboard Supervisor. Specializes in walking across the keyboard at 
                    critical moments and demanding attention during important debugging sessions.
                  </p>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-pink-600 hover:text-pink-800 font-medium">
                      📸 View Luna's Gallery
                    </summary>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div>
                        <img 
                          src="/images/ReadyForHerCloseup.jpg" 
                          alt="Luna the calico cat - portrait" 
                          className="w-full h-auto rounded-lg shadow-sm border border-gray-200 dark:border-gray-600"
                        />
                        <p className="text-center text-gray-500 dark:text-gray-400 mt-1 text-xs">Ready for her closeup 📷</p>
                      </div>
                      <div>
                        <img 
                          src="/images/Kitty_Coder.jpg" 
                          alt="Luna supervising coding at the workstation" 
                          className="w-full h-auto rounded-lg shadow-sm border border-gray-200 dark:border-gray-600"
                        />
                        <p className="text-center text-gray-500 dark:text-gray-400 mt-1 text-xs">Supervising the code 💻</p>
                      </div>
                    </div>
                  </details>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">🖥️</span>
                    <h4 className="font-bold text-gray-800 dark:text-gray-200">Midnight</h4>
                    <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full">The Workstation</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    The tireless machine that brought Vet-Rate.org to life. Running countless builds, tests, 
                    and deployments without complaint (mostly).
                  </p>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium">
                      🔧 View Midnight's Specs
                    </summary>
                    <div className="mt-2 bg-gray-50 dark:bg-gray-900/50 rounded p-3 space-y-1 text-gray-600 dark:text-gray-400">
                      <p><strong>CPU:</strong> AMD Ryzen 9 7950X3D 4.2 GHz 16-Core</p>
                      <p><strong>Cooler:</strong> Asus ProArt LC 420 107 CFM Liquid</p>
                      <p><strong>Motherboard:</strong> Asus ProArt X670E-CREATOR WIFI ATX AM5</p>
                      <p><strong>Memory:</strong> Corsair Vengeance 128 GB (4 x 32 GB) DDR5-5600 CL40</p>
                      <p><strong>Primary SSD:</strong> MSI SPATIUM M570 HS 2 TB PCIe 5.0 X4 NVMe</p>
                      <p><strong>Storage:</strong> 2 x Silicon Power UD90 4 TB PCIe 4.0 X4 NVMe</p>
                      <p><strong>GPU:</strong> Asus ProArt OC GeForce RTX 4080 SUPER 16 GB</p>
                      <p><strong>Case:</strong> Asus ProArt PA602 ATX Mid Tower</p>
                      <p><strong>PSU:</strong> be quiet! Dark Power Pro 13 1300W 80+ Titanium</p>
                      <p><strong>Displays:</strong> Asus ProArt PA329CV 32" 4K + PA279CRV 27" 4K</p>
                      <p className="pt-1 border-t border-gray-200 dark:border-gray-700 mt-1"><strong>eGPU:</strong> Asus ProArt OC RTX 4070 Ti SUPER 16 GB in Sonnet Breakaway Box 750ex</p>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3">💻 How This Was Built</h3>
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-gray-700 dark:text-gray-300 mb-3">
                Vet-Rate.org was developed using modern tools and AI-assisted development:
              </p>
              <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-1">📖</span>
                  <span><strong>Data Source:</strong> All disability information was meticulously extracted and structured from the official <a href="https://www.ecfr.gov/current/title-38/chapter-I/part-4" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">eCFR (Electronic Code of Federal Regulations)</a></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-1">🛠️</span>
                  <span><strong>Development Environment:</strong> Visual Studio Code - the go-to editor for modern web development</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-1">✨</span>
                  <span><strong>Prompt Engineering:</strong> Google's Gemini assisted with crafting effective prompts and planning</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600 mt-1">🤖</span>
                  <span><strong>Code Development:</strong> Anthropic's Claude AI models (Claude 4.5 Haiku, Claude 4.5 Sonnet, and Claude 4.5 Opus) powered the code development and implementation</span>
                </li>
              </ul>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 italic">
                AI-assisted development allowed a single veteran to build a comprehensive tool that would have 
                otherwise required a full development team. The future is now! 🚀
              </p>
            </div>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3">Important Disclaimers</h3>
            <div className="bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-500 p-4 mb-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>⚠️ Not Legal or Medical Advice:</strong> This tool provides educational information only. 
                It does not constitute legal or medical advice. Always consult with qualified professionals for 
                guidance specific to your situation.
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 p-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>💼 Not Affiliated with the VA:</strong> Vet-Rate.org is an independent resource and is 
                not endorsed by, affiliated with, or approved by the U.S. Department of Veterans Affairs.
              </p>
            </div>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3">💚 How This Project Is Funded</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              To keep this tool free and maintain hosting costs, this project relies entirely on voluntary support from the veteran community:
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <a
                href="https://buymeacoffee.com/vetrate"
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center p-3 bg-yellow-400 hover:bg-yellow-500 rounded-lg transition-all hover:scale-105 shadow-sm"
              >
                <span className="text-2xl mb-1">☕</span>
                <span className="text-sm font-bold text-gray-900 dark:text-gray-900">Buy Me a Coffee</span>
                <span className="text-xs font-medium text-yellow-900 dark:text-yellow-900">vet-rate.org</span>
              </a>
              <a
                href="https://paypal.me/ajohnsonnow"
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center p-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-all hover:scale-105 shadow-sm"
              >
                <span className="text-2xl mb-1">💳</span>
                <span className="text-sm font-bold text-white dark:text-white">PayPal</span>
                <span className="text-xs font-medium text-blue-100 dark:text-blue-100">ajohnsonnow</span>
              </a>
              <a
                href="https://cash.app/$ajnow"
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center p-3 bg-green-600 hover:bg-green-700 rounded-lg transition-all hover:scale-105 shadow-sm"
              >
                <span className="text-2xl mb-1">💵</span>
                <span className="text-sm font-bold text-white dark:text-white">Cash App</span>
                <span className="text-xs font-medium text-green-100 dark:text-green-100">$ajnow</span>
              </a>
              <a
                href="https://venmo.com/ajnow"
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center p-3 bg-sky-600 hover:bg-sky-700 rounded-lg transition-all hover:scale-105 shadow-sm"
              >
                <span className="text-2xl mb-1">📱</span>
                <span className="text-sm font-bold text-white dark:text-white">Venmo</span>
                <span className="text-xs font-medium text-sky-100 dark:text-sky-100">@ajnow</span>
              </a>
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              Your support helps keep this tool free and accessible for all veterans. We intentionally avoid 
              using advertising networks to protect veteran privacy - no third-party trackers, no data collection.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
              100% of contributions go toward hosting, development, and keeping Vet-Rate.org running for the veteran community.
            </p>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3">My Commitment to Veterans</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              I am committed to:
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 mb-3 ml-4">
              <li>✅ Keeping the tool <strong>100% free</strong> forever</li>
              <li>✅ Protecting your <strong>privacy</strong> - no ads, no tracking, no data collection</li>
              <li>✅ Providing <strong>accurate, up-to-date</strong> information from official sources</li>
              <li>✅ Continuously <strong>improving</strong> the tool based on veteran feedback</li>
            </ul>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3">Contact & Feedback</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              Have suggestions, found an error, or want to say thanks? I'd love to hear from you! Visit the{' '}
              <span className="text-blue-600 font-semibold cursor-pointer hover:underline">Contact</span> page 
              to get in touch.
            </p>
          </section>

          <div className="bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500 p-4 mt-6">
            <p className="text-sm text-green-800 dark:text-green-200">
              <strong>Thank You for Your Service</strong><br />
              Every veteran who finds their information faster because of this tool is a win. I'm honored 
              to support my fellow veterans in understanding your VA benefits.
            </p>
          </div>
        </div>

        <div className="border-t dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-900/50 rounded-b-lg">
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
