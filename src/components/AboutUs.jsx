import React from 'react';
import ReportBugLink from './ReportBugLink';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import { PROJECT_STATS, FORMATTED_STATS, formatNumber } from '../data/projectStats';

const AboutUs = ({ onClose, onReportBug }) => {
  // Lock body scroll when modal is open
  useBodyScrollLock(true);

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto modal-backdrop overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-us-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full my-8 modal-content">
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
              <strong>Vet-Rate.org</strong> is the most comprehensive free VA claims toolkit available—28 professional-grade 
              tools built to empower veterans with everything needed from initial research through appeals. 
              The VA system is complex, but your path through it doesn't have to be. From smart search and rating calculators 
              to C&P exam prep, AI document analysis, and evidence building, this complete arsenal puts you in command of your claim—giving 
              you what predatory "claim sharks" charge thousands for, <strong>absolutely free</strong>.
            </p>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3">🛠️ Complete Claims Arsenal - 25+ Professional Tools</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              This comprehensive toolkit provides everything you need from initial research through appeals:
            </p>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-2">🎖️ Core Intelligence (5 tools)</h4>
                <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 ml-4 space-y-1">
                  <li><strong>Smart Search:</strong> 748 rated conditions with official 38 CFR Part 4 criteria</li>
                  <li><strong>PACT Act Navigator:</strong> Identify toxic exposure presumptive conditions</li>
                  <li><strong>Web of Conditions:</strong> Interactive visualization of connected disabilities</li>
                  <li><strong>VA Resources Hub:</strong> Direct access to official VA programs and support</li>
                  <li><strong>User Manual:</strong> Complete documentation for all features</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-2">💰 Rating & Benefits Calculators (4 tools)</h4>
                <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 ml-4 space-y-1">
                  <li><strong>Tactical Calculator:</strong> Combined ratings with bilateral factors & 2026 pay rates</li>
                  <li><strong>Million Dollar Dashboard:</strong> Lifetime benefit value & retirement projections</li>
                  <li><strong>TDIU Builder:</strong> Total Disability Individual Unemployability evaluation</li>
                  <li><strong>State Benefit Hunter:</strong> Discover state-level veteran benefits</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-2">🔍 Discovery & Research Tools (4 tools)</h4>
                <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 ml-4 space-y-1">
                  <li><strong>Secondary Scout:</strong> 500+ medically-recognized secondary conditions</li>
                  <li><strong>MOS Hazard Matcher:</strong> Link military jobs to exposures and conditions</li>
                  <li><strong>Pathfinder:</strong> Strategic roadmap from claim to appeal</li>
                  <li><strong>Risk Assessment:</strong> Identify claim weaknesses before filing</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-2">📝 Evidence Building Suite (6 tools)</h4>
                <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 ml-4 space-y-1">
                  <li><strong>C&P Exam Simulator:</strong> DBQ-aligned practice with percentage predictions</li>
                  <li><strong>Nexus Builder:</strong> Medical nexus statements with AI enhancement</li>
                  <li><strong>Forms Helper:</strong> 16+ VA forms including buddy & PTSD stressor statements</li>
                  <li><strong>Witness Bench:</strong> Interactive buddy statement builder</li>
                  <li><strong>Symptom Logger:</strong> Track daily symptoms for documentation</li>
                  <li><strong>AI Statement Assistant:</strong> "Three Pillars" approach (optional)</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-2">🔬 Advanced Analysis (What Others Charge $500+) (4 tools)</h4>
                <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 ml-4 space-y-1">
                  <li><strong>C-File AI Analyzer:</strong> Find evidence in thousands of pages (locally processed)</li>
                  <li><strong>Decision Decoder:</strong> AI analysis of VA letters for appeal opportunities</li>
                  <li><strong>Blue Button X-Ray:</strong> Extract claim-relevant evidence from medical records</li>
                  <li><strong>Red Team:</strong> Simulate VA examiner review</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-2">🛡️ Protection & Compliance (3 tools)</h4>
                <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 ml-4 space-y-1">
                  <li><strong>Shark Radar:</strong> Identify predatory claim services</li>
                  <li><strong>VSO Finder:</strong> Locate accredited Veterans Service Officers</li>
                  <li><strong>FOIA Generator:</strong> Request military records</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-2">📁 Organization Tools (2 tools)</h4>
                <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 ml-4 space-y-1">
                  <li><strong>My Packet:</strong> Save and manage all claims evidence</li>
                  <li><strong>PDF Reports:</strong> Download comprehensive condition guides</li>
                </ul>
              </div>
            </div>
            
            <div className="mt-4 bg-gradient-to-r from-va-gold/20 to-green-600/20 border-l-4 border-va-gold rounded p-3">
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                🎖️ That's 28 professional-grade tools—completely free. What claim sharks charge thousands for.
              </p>
            </div>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3">Data Sources</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              Our comprehensive knowledge base has been <strong>fully validated against the official eCFR</strong> (Electronic Code of Federal Regulations):
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 mb-3 ml-4">
              <li>
                <strong>38 CFR Part 3 - Verified:</strong> Adjudication rules, eligibility requirements, and 
                claims procedures cross-referenced with official VA regulations
              </li>
              <li>
                <strong>38 CFR Part 4 - Verified:</strong> Every diagnostic code, rating percentage, and evaluation 
                criteria has been cross-referenced with the official VA Schedule for Rating Disabilities
              </li>
              <li>
                <strong>748 VA Disabilities - Complete Coverage:</strong> All body systems thoroughly documented 
                (Musculoskeletal System, Organs of Special Sense, Systemic Diseases, Respiratory System, Cardiovascular System, Digestive System, Genitourinary System, Gynecological Conditions, Hemic and Lymphatic Systems, Skin, Endocrine System, Neurological Conditions, Mental Disorders, Dental and Oral Conditions, and Infectious Diseases)
              </li>
              <li>
                <strong>100% Rating Criteria Validated:</strong> All 748 conditions include detailed percentage 
                breakdowns verified against current 38 CFR regulations
              </li>
              <li>
                <strong>Secondary Conditions Database:</strong> Medically-recognized secondary conditions linked 
                to primary disabilities with supporting documentation
              </li>
            </ul>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-2 italic">
              Last validated: January 2026 against eCFR Title 38, Parts 3 & 4
            </p>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3">Why I Built This</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              Too many veterans struggle because the VA system is scattered, technical, and predatory services 
              charge thousands for basic help. I've been there myself. That's why I built Vet-Rate.org—28 
              professional-grade tools in one place where you can research your conditions, calculate your ratings, 
              understand what the VA is looking for, practice your C&P exam, analyze documents with AI, find secondary 
              conditions, evaluate strategic options, and build your complete evidence packet. 
            </p>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              No expensive consultants. No endless Google searches. No predatory "claim sharks" taking 30% of your 
              backpay. Just the complete arsenal you need to take charge of your claim—from initial research through 
              appeals—all in one place.
            </p>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              <strong>This comprehensive platform is 100% free</strong> and runs entirely in your browser - no accounts, 
              no data collection, and no PII storage. Your searches, calculations, and documents remain private.
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    <div className="mt-3 grid grid-cols-1 gap-3">
                      <div>
                        <img 
                          src="/images/ReadyForHerCloseup.jpg" 
                          alt="Luna the calico cat - portrait" 
                          className="w-full h-auto rounded-lg shadow-md border-2 border-pink-200 dark:border-pink-700"
                        />
                        <p className="text-center text-gray-500 dark:text-gray-400 mt-2 text-xs">Ready for her closeup 📷</p>
                      </div>
                      <div>
                        <img 
                          src="/images/Kitty_Coder.jpg" 
                          alt="Luna supervising coding at the workstation" 
                          className="w-full h-auto rounded-lg shadow-md border-2 border-pink-200 dark:border-pink-700"
                        />
                        <p className="text-center text-gray-500 dark:text-gray-400 mt-2 text-xs">Supervising the code 💻</p>
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
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">⚡</span>
                    <h4 className="font-bold text-gray-800 dark:text-gray-200">The Codebase</h4>
                    <span className="text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">Built with 💚</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    A labor of love, countless hours, and a whole lot of caffeine. Here's what powers 
                    Vet-Rate.org under the hood.
                  </p>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 font-medium">
                      📊 View Codebase Stats
                    </summary>
                    <div className="mt-2 bg-gray-50 dark:bg-gray-900/50 rounded p-3 space-y-2 text-gray-600 dark:text-gray-400">
                      <div className="border-b border-gray-200 dark:border-gray-700 pb-2">
                        <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">📐 Project Scale</p>
                        <p><strong>Total Files:</strong> {FORMATTED_STATS.totalFiles} project files</p>
                        <p><strong>Lines of Code:</strong> {FORMATTED_STATS.linesOfCode} lines</p>
                        <p><strong>App Size:</strong> {FORMATTED_STATS.appSize}</p>
                      </div>
                      <div className="border-b border-gray-200 dark:border-gray-700 pb-2">
                        <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">⏱️ Development Time</p>
                        <p><strong>Traditional Equivalent:</strong> {FORMATTED_STATS.traditionalHours}</p>
                        <p className="text-xs mt-1 italic">
                          • {formatNumber(PROJECT_STATS.breakdown.coding)} hrs coding ({Math.round(PROJECT_STATS.linesOfCode/1000)}k lines @ 20/hr with AI assist)<br />
                          • {PROJECT_STATS.breakdown.dataEntry} hrs data entry ({PROJECT_STATS.disabilitiesValidated} disabilities validated)<br />
                          • {PROJECT_STATS.breakdown.testing} hrs testing & debugging<br />
                          • {PROJECT_STATS.breakdown.uiux} hrs UI/UX design & iterations<br />
                          • {PROJECT_STATS.breakdown.documentation} hrs documentation & user manual<br />
                          • {PROJECT_STATS.breakdown.research} hrs research (38 CFR regulations)<br />
                          • {PROJECT_STATS.breakdown.deployment} hrs deployment & optimization
                        </p>
                        <p className="text-xs mt-1 font-medium text-amber-600 dark:text-amber-400">
                          {FORMATTED_STATS.traditionalYears} for one developer
                        </p>
                        <hr className="my-2 border-gray-300 dark:border-gray-600" />
                        <p><strong>Actual Time Invested:</strong> {FORMATTED_STATS.actualTime}</p>
                        <p className="text-xs mt-1 italic">
                          • First commit: {PROJECT_STATS.git.firstCommitDate} at {PROJECT_STATS.git.firstCommitTime}<br />
                          • Latest commit: {PROJECT_STATS.git.latestCommitDate} at {PROJECT_STATS.git.latestCommitTime}<br />
                          • {FORMATTED_STATS.commits}<br />
                          • {FORMATTED_STATS.linesChanged}
                        </p>
                        <p className="text-xs mt-1 font-medium text-green-600 dark:text-green-400">
                          🚀 {FORMATTED_STATS.multiplier} productivity multiplier (AI-assisted development)
                        </p>
                        <p className="text-xs mt-2 text-gray-600 dark:text-gray-400">
                          The {formatNumber(PROJECT_STATS.traditionalHours)}-hour estimate represents the <strong>traditional development cost</strong> and the <strong>value veterans receive for free</strong>. The actual {PROJECT_STATS.actualHours} hours shows the power of modern AI tools (GitHub Copilot, Claude, ChatGPT, Gemini) + React/Vite/Tailwind in 2026.
                        </p>
                      </div>
                      <div className="border-b border-gray-200 dark:border-gray-700 pb-2">
                        <details className="cursor-pointer">
                          <summary className="font-semibold text-gray-700 dark:text-gray-300 mb-1 hover:text-va-gold">
                            🛠️ Component Development Breakdown (Click to expand)
                          </summary>
                          <div className="mt-2 ml-2 text-xs space-y-1">
                            <p className="font-medium text-gray-600 dark:text-gray-400 mb-2">Major Tool Development Hours & Lines:</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-gray-700 dark:text-gray-300">
                              <p>• <strong>C-File AI Analyzer:</strong> 680 hrs / 9,200 lines</p>
                              <p>• <strong>C&P Exam Simulator:</strong> 520 hrs / 7,800 lines</p>
                              <p>• <strong>Tactical Calculator:</strong> 450 hrs / 8,500 lines</p>
                              <p>• <strong>Forms Helper:</strong> 410 hrs / 6,800 lines</p>
                              <p>• <strong>Blue Button X-Ray:</strong> 380 hrs / 5,100 lines</p>
                              <p>• <strong>Secondary Scout:</strong> 380 hrs / 6,200 lines</p>
                              <p>• <strong>Decision Decoder:</strong> 350 hrs / 4,900 lines</p>
                              <p>• <strong>Smart Search:</strong> 340 hrs / 5,200 lines</p>
                              <p>• <strong>Nexus Builder:</strong> 320 hrs / 5,400 lines</p>
                              <p>• <strong>Million Dollar Dashboard:</strong> 310 hrs / 4,500 lines</p>
                              <p>• <strong>My Packet:</strong> 290 hrs / 4,200 lines</p>
                              <p>• <strong>Web of Conditions:</strong> 290 hrs / 4,100 lines</p>
                              <p>• <strong>Red Team Simulator:</strong> 280 hrs / 3,800 lines</p>
                              <p>• <strong>State Benefit Hunter:</strong> 270 hrs / 3,900 lines</p>
                              <p>• <strong>PACT Act Navigator:</strong> 260 hrs / 3,700 lines</p>
                              <p>• <strong>Witness Bench:</strong> 240 hrs / 3,600 lines</p>
                              <p>• <strong>MOS Hazard Matcher:</strong> 230 hrs / 3,300 lines</p>
                              <p>• <strong>TDIU Builder:</strong> 220 hrs / 3,100 lines</p>
                              <p>• <strong>Pathfinder:</strong> 210 hrs / 3,200 lines</p>
                              <p>• <strong>Risk Assessment:</strong> 190 hrs / 2,800 lines</p>
                              <p>• <strong>Symptom Logger:</strong> 180 hrs / 2,400 lines</p>
                              <p>• <strong>FOIA Generator:</strong> 170 hrs / 2,500 lines</p>
                              <p>• <strong>Shark Radar:</strong> 160 hrs / 2,200 lines</p>
                              <p>• <strong>VA Resources Hub:</strong> 150 hrs / 2,100 lines</p>
                              <p>• <strong>VSO Finder:</strong> 140 hrs / 1,900 lines</p>
                              <p>• <strong>Accessibility Features:</strong> 120 hrs / 1,600 lines</p>
                              <p>• <strong>User Manual:</strong> 100 hrs / 1,800 lines</p>
                            </div>
                            <p className="mt-2 text-amber-600 dark:text-amber-400 font-medium">
                              Plus 200 hours validating 15,000 lines of disability data against 38 CFR
                            </p>
                          </div>
                        </details>
                      </div>
                      <div className="border-b border-gray-200 dark:border-gray-700 pb-2">
                        <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">📦 Core Components</p>
                        <p><strong>React Components:</strong> {FORMATTED_STATS.components}</p>
                        <p><strong>Utility Modules:</strong> {FORMATTED_STATS.utilities}</p>
                        <p><strong>VA Forms:</strong> 16 PDF forms ready to download</p>
                      </div>
                      <div className="border-b border-gray-200 dark:border-gray-700 pb-2">
                        <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">🗂️ Data Files</p>
                        <p><strong>Disabilities Database:</strong> {PROJECT_STATS.disabilitiesValidated} rated conditions</p>
                        <p><strong>Secondary Conditions:</strong> Medically-linked relationships</p>
                        <p><strong>Regulations:</strong> 38 CFR Parts 3 & 4</p>
                        <p><strong>PACT Act Data:</strong> Toxic exposure coverage</p>
                        <p><strong>DBQ Logic Map:</strong> C&P exam question bank</p>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">⚙️ Tech Stack</p>
                        <p><strong>Framework:</strong> React 18 + Vite</p>
                        <p><strong>Styling:</strong> Tailwind CSS</p>
                        <p><strong>PDF Generation:</strong> jsPDF + html2canvas</p>
                        <p><strong>AI (Optional):</strong> Google Gemini API</p>
                      </div>
                      <p className="pt-2 border-t border-gray-200 dark:border-gray-700 mt-2 text-center italic text-green-600 dark:text-green-400">
                        Built with determination and fueled by veteran spirit 🎖️
                      </p>
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
              Building and maintaining 28 professional-grade tools with hosting costs, AI capabilities, and continuous development 
              requires resources. To keep this comprehensive platform free for all veterans, this project relies entirely on voluntary 
              support from the veteran community:
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
              <li>✅ Keeping all <strong>28 professional tools 100% free</strong> forever—no paywalls, ever</li>
              <li>✅ Protecting your <strong>privacy</strong> - no ads, no tracking, no data collection, no claim sharks</li>
              <li>✅ Providing <strong>accurate, up-to-date</strong> information from official 38 CFR sources</li>
              <li>✅ Continuously <strong>adding new tools</strong> and improving features based on veteran feedback</li>
              <li>✅ Maintaining <strong>transparency</strong> - open about AI use, data handling, and limitations</li>
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
              Every veteran who navigates their claim successfully with these 28 tools—instead of paying thousands 
              to predatory services—is a victory. I'm honored to serve my fellow veterans by making this comprehensive 
              professional arsenal freely available to all who served.
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
