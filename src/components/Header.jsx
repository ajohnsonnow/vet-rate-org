import React, { useState } from 'react';
import AccessibilityMenu from './AccessibilityMenu';
import FundingModal from './FundingModal';
import { useTheme } from '../contexts/ThemeContext';

function Header({ onSecondaryScoutClick, onMyPacketClick, onCAPSimulatorClick, onVAResourcesClick }) {
  const { isDark, toggleTheme } = useTheme();
  const [showResourcesMenu, setShowResourcesMenu] = useState(false);
  const [showFundingModal, setShowFundingModal] = useState(false);

  const veteranResources = [
    {
      name: '🆘 Veterans Crisis Line',
      url: 'https://www.veteranscrisisline.net/',
      description: 'Call 988, Press 1 | Text 838255',
      urgent: true
    },
    {
      name: '⚠️ PACT Act Benefits',
      url: 'https://www.va.gov/resources/the-pact-act-and-your-va-benefits/',
      description: 'New presumptive conditions & eligibility',
      highlight: true
    },
    {
      name: '🧪 Toxic Exposure Assessment',
      url: 'https://www.publichealth.va.gov/MEEA/index.asp',
      description: 'Free MEEA evaluations'
    },
    {
      name: '🏠 Homeless Veterans',
      url: 'https://www.va.gov/homeless/',
      description: 'Call 1-877-4AID-VET (1-877-424-3838)'
    },
    {
      name: '🧠 Mental Health & PTSD',
      url: 'https://www.ptsd.va.gov/',
      description: 'PTSD treatment & resources'
    },
    {
      name: '🏥 VA Health Care',
      url: 'https://www.va.gov/health-care/',
      description: 'Apply for VA health benefits'
    },
    {
      name: '👩 Women Veterans',
      url: 'https://www.va.gov/womenvet/',
      description: 'Resources for women Veterans'
    },
    {
      name: '💼 Veteran Jobs',
      url: 'https://www.va.gov/careers-employment/',
      description: 'Employment resources & training'
    },
    {
      name: '🎓 GI Bill Benefits',
      url: 'https://www.va.gov/education/',
      description: 'Education & training benefits'
    },
    {
      name: '🏡 VA Home Loans',
      url: 'https://www.va.gov/housing-assistance/',
      description: 'Home loan & housing assistance'
    },
    {
      name: '👨‍👩‍👧‍👦 Caregiver Support',
      url: 'https://www.caregiver.va.gov/',
      description: 'Support for veteran caregivers'
    },
    {
      name: '⚖️ Board of Veterans Appeals',
      url: 'https://www.bva.va.gov/',
      description: 'Appeal your VA decision'
    },
    {
      name: '📚 National Resource Directory',
      url: 'https://nrd.gov/',
      description: 'Database of vetted resources & services',
      highlight: true
    }
  ];

  return (
    <header className="bg-gradient-to-r from-va-blue to-green-900 dark:from-gray-800 dark:to-gray-900 text-white shadow-lg" role="banner">
      {/* Skip Link for Screen Readers */}
      <a href="#main-content" className="skip-link sr-only focus:not-sr-only">
        Skip to main content
      </a>
      
      {/* Crisis Line Banner - Always Visible */}
      <div className="bg-red-700 dark:bg-red-900 text-white text-center py-1.5 px-4 text-sm">
        <a 
          href="https://www.veteranscrisisline.net/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="hover:underline font-medium"
        >
          🆘 Veterans Crisis Line: <strong>Call 988, Press 1</strong> | Text 838255 | Chat online 24/7
        </a>
      </div>
      
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-white rounded-full h-16 w-16 md:h-20 md:w-20 flex items-center justify-center overflow-hidden shadow-md">
              <img 
                src="/images/Vet-Rate-org-logo-official.png" 
                alt="Vet-Rate.org Logo" 
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold whitespace-nowrap">Vet-Rate.org</h1>
              <p className="text-green-100 dark:text-gray-300 text-sm md:text-base whitespace-nowrap">
                VA Disability Rating Schedule | 38 CFR Part 4
              </p>
            </div>
          </div>

          <nav className="flex flex-wrap justify-center gap-4 md:gap-6 items-center" role="navigation" aria-label="Main navigation">
            <button
              onClick={onSecondaryScoutClick}
              className="hover:text-va-gold transition duration-200 focus:outline-none focus:ring-2 focus:ring-va-gold focus:ring-offset-2 focus:ring-offset-va-blue rounded px-2 py-1"
              title="Secondary Scout - Find potential secondary claims"
              aria-label="Open Secondary Scout tool to find potential secondary claims"
            >
              🔍 Secondary Scout
            </button>
            <button
              onClick={onCAPSimulatorClick}
              className="hover:text-va-gold transition duration-200 focus:outline-none focus:ring-2 focus:ring-va-gold focus:ring-offset-2 focus:ring-offset-va-blue rounded px-2 py-1"
              title="C&P Exam Simulator - Prepare for your exam"
              aria-label="Open C&P Exam Simulator to prepare for your compensation and pension exam"
            >
              📋 C&P Simulator
            </button>
            <button
              onClick={onMyPacketClick}
              className="hover:text-va-gold transition duration-200 focus:outline-none focus:ring-2 focus:ring-va-gold focus:ring-offset-2 focus:ring-offset-va-blue rounded px-2 py-1"
              title="My Packet - View saved claims"
              aria-label="Open My Packet to view your saved claims"
            >
              📁 My Packet
            </button>
            
            {/* Veteran Resources Dropdown */}
            <div className="relative static sm:relative">
              <button
                onClick={() => setShowResourcesMenu(!showResourcesMenu)}
                onBlur={() => setTimeout(() => setShowResourcesMenu(false), 200)}
                className="hover:text-va-gold transition duration-200 focus:outline-none focus:ring-2 focus:ring-va-gold focus:ring-offset-2 focus:ring-offset-va-blue rounded px-2 py-1 flex items-center gap-1"
                title="Veteran Resources"
                aria-expanded={showResourcesMenu}
                aria-haspopup="true"
              >
                🎖️ <span className="hidden lg:inline">Vet Resources</span><span className="lg:hidden">Help</span>
                <svg className={`w-4 h-4 transition-transform ${showResourcesMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showResourcesMenu && (
                <div className="fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 mt-2 sm:w-72 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden max-h-[70vh] sm:max-h-[80vh] overflow-y-auto">
                  <div className="p-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 px-3 py-1 font-semibold uppercase tracking-wide">
                      Veteran Resources
                    </p>
                    
                    {/* VA Resources Hub Button */}
                    <button
                      onClick={() => {
                        setShowResourcesMenu(false);
                        onVAResourcesClick();
                      }}
                      className="w-full text-left block px-3 py-2 rounded-md transition-colors bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 border-l-4 border-green-600 mb-2"
                    >
                      <span className="font-medium text-green-700 dark:text-green-300">
                        🌐 VA Resources Hub
                      </span>
                      <p className="text-xs mt-0.5 text-green-600 dark:text-green-400">
                        Comprehensive VA benefits & programs guide
                      </p>
                    </button>
                    
                    <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>
                    
                    {veteranResources.map((resource, index) => (
                      <a
                        key={index}
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`block px-3 py-2 rounded-md transition-colors ${
                          resource.urgent 
                            ? 'bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 border-l-4 border-red-500' 
                            : resource.highlight
                            ? 'bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 border-l-4 border-amber-500'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <span className={`font-medium ${
                          resource.urgent 
                            ? 'text-red-700 dark:text-red-300' 
                            : resource.highlight
                            ? 'text-amber-700 dark:text-amber-300'
                            : 'text-gray-800 dark:text-gray-200'
                        }`}>
                          {resource.name}
                        </span>
                        <p className={`text-xs mt-0.5 ${
                          resource.urgent 
                            ? 'text-red-600 dark:text-red-400' 
                            : resource.highlight
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {resource.description}
                        </p>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <a
              href="https://www.va.gov/disability/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-va-gold transition duration-200 focus:outline-none focus:ring-2 focus:ring-va-gold focus:ring-offset-2 focus:ring-offset-va-blue rounded px-2 py-1"
              title="VA Disability Benefits"
              aria-label="Visit VA Disability Benefits page (opens in new tab)"
            >
              🏛️ <span className="hidden lg:inline">Disability Benefits</span><span className="lg:hidden">VA</span>
            </a>
            <a
              href="https://www.ecfr.gov/current/title-38/chapter-I/part-4"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-va-gold transition duration-200 focus:outline-none focus:ring-2 focus:ring-va-gold focus:ring-offset-2 focus:ring-offset-va-blue rounded px-2 py-1"
              title="eCFR 38 Part 4"
              aria-label="Visit official eCFR Rating Schedule (opens in new tab)"
            >
              📖 <span className="hidden lg:inline">Rating Schedule</span><span className="lg:hidden">eCFR</span>
            </a>
            
            {/* Quick Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-va-gold"
              aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            >
              {isDark ? (
                <svg className="w-5 h-5 text-yellow-300" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>

            {/* Accessibility Menu */}
            <AccessibilityMenu />
            
            <button
              onClick={() => setShowFundingModal(true)}
              className="inline-flex items-center gap-1.5 bg-va-gold hover:bg-yellow-400 hover:scale-105 text-va-blue px-4 py-1.5 rounded-lg font-bold shadow-md hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white animate-pulse-subtle"
              title="Support Vet-Rate.org - Help keep this free for veterans"
              aria-label="Back the Mission - Support Vet-Rate.org"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
              </svg>
              <span className="hidden md:inline">Back the Mission</span>
            </button>
          </nav>
        </div>
      </div>
      
      {/* Funding Modal */}
      <FundingModal show={showFundingModal} onClose={() => setShowFundingModal(false)} />
    </header>
  );
}

export default Header;
