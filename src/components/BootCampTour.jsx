/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * 
 * BootCampTour Component
 * Interactive onboarding tour using driver.js
 * "The First Five Minutes" - Ensures new users aren't overwhelmed
 */

import { useEffect, useState } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { getTotalToolCount } from '../data/toolkitData';
import { PROJECT_STATS } from '../data/projectStats';

const TOUR_SEEN_KEY = 'vetrate-tour-completed';

/**
 * Custom CSS overrides for driver.js to match Vet-Rate dark theme
 */
const tourStyles = `
  .driver-popover {
    background: linear-gradient(135deg, #1f2937 0%, #111827 100%) !important;
    border: 2px solid #c8a961 !important;
    border-radius: 12px !important;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(200, 169, 97, 0.2) !important;
    max-width: 400px !important;
    z-index: 100001 !important;
    padding: 20px !important;
  }
  
  .driver-popover-title {
    color: #c8a961 !important;
    font-size: 1.25rem !important;
    font-weight: 700 !important;
    padding-bottom: 8px !important;
    padding-right: 30px !important;
    border-bottom: 1px solid #374151 !important;
    margin-bottom: 12px !important;
  }
  
  .driver-popover-description {
    color: #d1d5db !important;
    font-size: 0.95rem !important;
    line-height: 1.6 !important;
  }
  
  .driver-popover-progress-text {
    color: #9ca3af !important;
    font-size: 0.8rem !important;
  }
  
  .driver-popover-navigation-btns {
    gap: 8px !important;
  }
  
  .driver-popover .driver-popover-prev-btn,
  .driver-popover-prev-btn {
    background: #4b5563 !important;
    color: #ffffff !important;
    border: 1px solid #9ca3af !important;
    padding: 10px 18px !important;
    border-radius: 6px !important;
    font-weight: 700 !important;
    font-size: 0.95rem !important;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3) !important;
    transition: all 0.2s !important;
  }
  
  .driver-popover .driver-popover-prev-btn:hover,
  .driver-popover-prev-btn:hover {
    background: #6b7280 !important;
    color: #ffffff !important;
  }
  
  .driver-popover .driver-popover-next-btn,
  .driver-popover-next-btn {
    background: #c8a961 !important;
    color: #1a1a1a !important;
    border: none !important;
    padding: 10px 20px !important;
    border-radius: 6px !important;
    font-weight: 800 !important;
    font-size: 0.95rem !important;
    text-shadow: none !important;
    transition: all 0.2s !important;
  }
  
  .driver-popover .driver-popover-next-btn:hover,
  .driver-popover-next-btn:hover {
    background: #d4b872 !important;
    transform: scale(1.02) !important;
    box-shadow: 0 4px 12px rgba(200, 169, 97, 0.4) !important;
  }
  
  /* X close button - distinct from navigation */
  .driver-popover-close-btn {
    background: transparent !important;
    color: #9ca3af !important;
    border: none !important;
    padding: 4px 8px !important;
    font-size: 1.5rem !important;
    font-weight: 400 !important;
    line-height: 1 !important;
    position: absolute !important;
    top: 12px !important;
    right: 12px !important;
    border-radius: 4px !important;
    transition: all 0.2s !important;
  }
  
  .driver-popover-close-btn:hover {
    background: rgba(239, 68, 68, 0.2) !important;
    color: #ef4444 !important;
    transform: none !important;
    box-shadow: none !important;
  }
  
  /* FIXED: Minimal overlay - almost transparent */
  .driver-overlay {
    background: rgba(0, 0, 0, 0.1) !important;
  }
  
  /* Make highlighted element pop with bright glow */
  .driver-active-element {
    background: inherit !important;
    box-shadow: 0 0 0 4px #c8a961, 0 0 0 8px rgba(200, 169, 97, 0.5), 0 0 50px rgba(200, 169, 97, 0.8) !important;
    border-radius: 8px !important;
    position: relative !important;
    z-index: 100000 !important;
  }
  
  .driver-popover-arrow-side-left,
  .driver-popover-arrow-side-right,
  .driver-popover-arrow-side-top,
  .driver-popover-arrow-side-bottom {
    border-color: #c8a961 !important;
  }
  
  /* Welcome modal style */
  .driver-popover.welcome-step {
    text-align: center !important;
  }
  
  .driver-popover.welcome-step .driver-popover-title {
    font-size: 1.5rem !important;
    border-bottom: none !important;
  }
`;

const BootCampTour = ({ forceShow = false, onComplete }) => {
  const [tourDriver, setTourDriver] = useState(null);

  useEffect(() => {
    // Inject custom styles
    const styleSheet = document.createElement('style');
    styleSheet.textContent = tourStyles;
    document.head.appendChild(styleSheet);

    return () => {
      document.head.removeChild(styleSheet);
    };
  }, []);

  useEffect(() => {
    // Check if tour should run
    const hasSeenTour = localStorage.getItem(TOUR_SEEN_KEY);
    const tosAccepted = localStorage.getItem('vet-rate-tos-accepted');
    
    // Don't start tour if already seen, or if TOS hasn't been accepted yet
    if (!forceShow && hasSeenTour) {
      return;
    }
    
    if (!tosAccepted) {
      // TOS modal is still showing, wait and check again
      const checkInterval = setInterval(() => {
        if (localStorage.getItem('vet-rate-tos-accepted')) {
          clearInterval(checkInterval);
          // Start tour after TOS is accepted
          setTimeout(() => startTour(), 1000);
        }
      }, 500);
      
      // Cleanup after 30 seconds max
      const cleanup = setTimeout(() => clearInterval(checkInterval), 30000);
      
      return () => {
        clearInterval(checkInterval);
        clearTimeout(cleanup);
      };
    }

    // TOS already accepted, start tour after a short delay
    const timeout = setTimeout(() => {
      startTour();
    }, 1500);

    return () => clearTimeout(timeout);
  }, [forceShow]);

  const startTour = () => {
    const driverObj = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      overlayClickNext: false,
      stagePadding: 10,
      stageRadius: 8,
      popoverClass: 'vetrate-tour-popover',
      progressText: 'Step {{current}} of {{total}}',
      nextBtnText: 'Next →',
      prevBtnText: '← Back',
      doneBtnText: 'Start My Claim! 🚀',
      smoothScroll: true,
      onDestroyStarted: () => {
        // Mark tour as completed
        localStorage.setItem(TOUR_SEEN_KEY, 'true');
        if (onComplete) onComplete();
        driverObj.destroy();
      },
      steps: [
        // Welcome Intro (no step number)
        {
          popover: {
            title: '🎖️ Welcome to Vet-Rate, Veteran',
            description: `
              <div style="text-align: center; padding: 10px 0;">
                <p style="font-size: 1.1rem; margin-bottom: 15px;">
                  <strong>Let's get you mission-ready.</strong> This quick tour shows you exactly where to start.
                </p>
                <p style="color: #9ca3af; font-size: 0.9rem;">
                  Takes about 60 seconds - then you're in command.
                </p>
                <div style="margin-top: 20px; padding: 15px; background: #1f2937; border-radius: 8px; border: 1px solid #374151;">
                  <p style="color: #fbbf24; font-weight: 600; margin: 0;">
                    💡 Tip: You can restart this tour anytime from the User Manual.
                  </p>
                </div>
              </div>
            `,
            popoverClass: 'welcome-step',
            showButtons: ['next'],
            progressText: ''
          }
        },
        // Step 2: Search Bar
        {
          element: '#tour-search-section',
          popover: {
            title: '🔍 Step 1: Search Your Condition',
            description: `
              <p><strong>This is your starting point.</strong></p>
              <p style="margin-top: 10px;">Search for any VA-rated condition:</p>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>By name: "PTSD", "tinnitus", "knee"</li>
                <li>By diagnostic code: "9411", "6260"</li>
              </ul>{PROJECT_STATS.disabilitiesValidated}
              <p style="color: #9ca3af; font-size: 0.85rem; margin-top: 10px;">
                We cover <strong>all 751 conditions</strong> from 38 CFR Part 4.
              </p>
            `,
            side: 'bottom',
            align: 'center'
          }
        },
        // Step 3: Quick Condition Picker
        {
          element: '#tour-quick-picker',
          popover: {
            title: '⚡ Step 2: Quick Add Conditions',
            description: `
              <p><strong>Know your conditions already?</strong></p>
              <p style="margin-top: 10px;">
                Use the Quick Picker to add conditions directly to your packet without searching.
              </p>
              <p style="color: #c8a961; margin-top: 10px; font-weight: 600;">
                Click "Add Condition" → Select body system → Pick your diagnosis
              </p>
            `,
            side: 'bottom',
            align: 'center'
          },
          onHighlightStarted: () => {
            // Scroll the Quick Condition Picker into view
            const element = document.getElementById('tour-quick-picker');
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
        },
        // Step 4: My Packet Button (in Header)
        {
          element: '#tour-my-packet-btn',
          popover: {
            title: '📦 Step 3: Your Command Center',
            description: `
              <p><strong>This is "My Packet" - your claims dashboard.</strong></p>
              <p style="margin-top: 10px;">Everything you save goes here:</p>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>Your tracked conditions</li>
                <li>Generated personal statements</li>
                <li>Evidence checklist progress</li>
              </ul>
              <p style="color: #c8a961; margin-top: 10px;">
                <strong>Think of it as your claim's mission folder.</strong>
              </p>
            `,
            side: 'bottom',
            align: 'start'
          }
        },
        // Step 5: Tools Menu
        {
          element: '#tour-tools-dropdown',
          popover: {
            title: '🛠️ Step 4: Your Claims Toolkit',
            description: `
              <p><strong>${getTotalToolCount()}+ specialized tools at your command:</strong></p>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>🔍 Secondary Scout - Find linked conditions</li>
                <li>✅ C&P Exam Simulator - Practice for exams</li>
                <li>🧮 Tactical Calculator - VA math made easy</li>
                <li>📝 Nexus Builder - Write strong statements</li>
              </ul>
              <p style="color: #9ca3af; font-size: 0.85rem; margin-top: 10px;">
                Click "Tools" to explore them all!
              </p>
            `,
            side: 'bottom',
            align: 'center'
          }
        },
        // Step 6: Help Button
        {
          element: '#tour-help-btn',
          popover: {
            title: '📖 Step 5: Help & Documentation',
            description: `
              <p><strong>The User Manual has everything:</strong></p>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>Full tool documentation</li>
                <li>Step-by-step tutorials</li>
                <li>FAQ & troubleshooting</li>
                <li>Restart this tour anytime!</li>
              </ul>
              <p style="color: #c8a961; margin-top: 10px;">
                <strong>💾 Remember to backup your data regularly!</strong>
              </p>
            `,
            side: 'bottom',
            align: 'center'
          }
        },
        // Final page (no step number)
        {
          popover: {
            title: '🚀 You\'re Ready to Roll!',
            description: `
              <div style="text-align: center; padding: 10px 0;">
                <p style="font-size: 1.1rem; margin-bottom: 15px;">
                  <strong>That's the essentials.</strong> You're now equipped to build your claim.
                </p>
                
                <div style="margin: 20px 0; padding: 15px; background: #1f2937; border-radius: 8px; border: 1px solid #374151;">
                  <p style="color: #22c55e; font-weight: 600; margin: 0;">
                    ✅ Pro Tip: Click "Load Example Data" on the dashboard to see a perfect claim template.
                  </p>
                </div>
                
                <p style="color: #9ca3af; font-size: 0.9rem;">
                  Need help? The 📖 User Manual has complete documentation for all {getTotalToolCount()}+ tools.
                </p>
                
                <p style="color: #c8a961; font-weight: 700; margin-top: 15px; font-size: 1rem;">
                  "Built by a Veteran, For Veterans."
                </p>
              </div>
            `,
            popoverClass: 'welcome-step',
            progressText: ''
          }
        }
      ]
    });

    setTourDriver(driverObj);
    driverObj.drive();
  };

  // Function to manually start tour (exposed via ref or context if needed)
  const restartTour = () => {
    startTour();
  };

  return null; // This component doesn't render anything visible
};

// Export function to reset tour state (for settings/manual restart)
export const resetTourState = () => {
  localStorage.removeItem(TOUR_SEEN_KEY);
};

// Export function to check if tour has been seen
export const hasTourBeenSeen = () => {
  return localStorage.getItem(TOUR_SEEN_KEY) === 'true';
};

export default BootCampTour;
