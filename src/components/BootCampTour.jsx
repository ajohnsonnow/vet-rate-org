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
  
  /* Ensure Navigator button is visible during tour */
  #tour-ai-navigator-btn {
    z-index: 100001 !important;
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
  
  /* Navigator step - position on right side so Navigator is visible */
  .driver-popover.navigator-step {
    position: fixed !important;
    right: 50px !important;
    left: auto !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
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

  // Listen for manual tour restart event
  useEffect(() => {
    const handleRestartTour = () => {
      // Small delay to allow any modals to close
      setTimeout(() => startTour(), 500);
    };
    
    window.addEventListener('restartTour', handleRestartTour);
    return () => window.removeEventListener('restartTour', handleRestartTour);
  }, []);

  useEffect(() => {
    // Check if tour should run
    const hasSeenTour = localStorage.getItem(TOUR_SEEN_KEY);
    const tosAccepted = localStorage.getItem('vet-rate-tos-accepted');
    
    // Don't start tour if already seen, or if TOS hasn't been accepted yet
    if (!forceShow && hasSeenTour) {
      return;
    }
    
    // Helper function to start tour when ready
    const waitForWhatsNewAndStart = () => {
      // Check if What's New modal is showing (check for the element)
      const whatsNewModal = document.querySelector('[data-whats-new-modal]');
      if (whatsNewModal) {
        // What's New is showing, wait for it to close
        console.log('🎯 Tour: Waiting for What\'s New to close...');
        const handleWhatsNewClosed = () => {
          window.removeEventListener('whatsNewClosed', handleWhatsNewClosed);
          setTimeout(() => startTour(), 300);
        };
        window.addEventListener('whatsNewClosed', handleWhatsNewClosed);
      } else {
        // No What's New showing, start tour
        setTimeout(() => startTour(), 300);
      }
    };
    
    if (!tosAccepted) {
      // TOS modal is still showing, wait and check again
      const checkInterval = setInterval(() => {
        if (localStorage.getItem('vet-rate-tos-accepted')) {
          clearInterval(checkInterval);
          // TOS accepted, now wait for What's New
          setTimeout(() => waitForWhatsNewAndStart(), 500);
        }
      }, 500);
      
      // Cleanup after 30 seconds max
      const cleanup = setTimeout(() => clearInterval(checkInterval), 30000);
      
      return () => {
        clearInterval(checkInterval);
        clearTimeout(cleanup);
      };
    }

    // TOS already accepted, check for What's New and start tour
    const timeout = setTimeout(() => {
      startTour();
    }, 500);

    return () => clearTimeout(timeout);
  }, [forceShow]);

  const startTour = () => {
    // Prevent Navigator from auto-opening during tour
    localStorage.setItem('vet_rate_ai_assistant_used', 'true');
    
    // Close AI Assistant if it's open (prevents it from blocking tour elements)
    const navigatorCloseEvent = new CustomEvent('closeNavigator');
    window.dispatchEvent(navigatorCloseEvent);
    
    // Hide footer during tour to prevent interference
    const footer = document.querySelector('footer');
    if (footer) {
      footer.style.display = 'none';
    }
    
    // Small delay to ensure Navigator is closed before tour starts
    setTimeout(() => {
      const driverObj = driver({
        showProgress: true,
        animate: true,
      allowClose: true,
      overlayClickNext: false,
      stagePadding: 10,
      stageRadius: 8,
      popoverClass: 'vetrate-tour-popover',
      progressText: '',
      nextBtnText: 'Next →',
      prevBtnText: '← Back',
      doneBtnText: 'Start My Claim! 🚀',
      smoothScroll: true,
      onDestroyStarted: () => {
        // Show footer again when tour ends
        const footer = document.querySelector('footer');
        if (footer) {
          footer.style.display = '';
        }
        // Mark tour as completed
        localStorage.setItem(TOUR_SEEN_KEY, 'true');
        if (onComplete) onComplete();
        driverObj.destroy();
      },
      steps: [
        // Welcome Intro
        {
          popover: {
            title: '🎖️ Welcome to Vet-Rate.org',
            description: `
              <div style="text-align: center; padding: 10px 0;">
                <p style="font-size: 1.1rem; margin-bottom: 15px;">
                  <strong>Let's show you around!</strong> This quick tour covers the essentials so you know exactly where to start.
                </p>
                <p style="color: #9ca3af; font-size: 0.9rem; margin-bottom: 15px;">
                  Takes about 60 seconds. You can skip or exit anytime.
                </p>
                <div style="margin-top: 20px; padding: 15px; background: #1f2937; border-radius: 8px; border: 1px solid #374151;">
                  <p style="color: #fbbf24; font-weight: 600; margin: 0;">
                    💡 You can restart this tour anytime from the Help menu.
                  </p>
                </div>
              </div>
            `,
            popoverClass: 'welcome-step',
            showButtons: ['close', 'next']
          }
        },
        // Search Bar
        {
          element: '#tour-search-section',
          popover: {
            title: '🔍 Start With Search',
            description: `
              <p><strong>This search bar is where most people begin.</strong></p>
              <p style="margin-top: 10px;">Look up any VA disability condition by:</p>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>Name: Try "PTSD" or "tinnitus"</li>
                <li>Body part: "knee" or "shoulder"</li>
                <li>Diagnostic code: "9411" or "6260"</li>
              </ul>
              <p style="color: #9ca3af; font-size: 0.85rem; margin-top: 10px;">
                We cover <strong>all ${PROJECT_STATS.disabilitiesValidated} conditions</strong> from the official VA rating schedule.
              </p>
            `,
            side: 'bottom',
            align: 'center'
          },
          onHighlightStarted: () => {
            // Scroll to top to ensure search section is visible
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        },
        // Quick Condition Picker
        {
          element: '#tour-quick-picker',
          popover: {
            title: '⚡ Quick Add (Skip the Search)',
            description: `
              <p><strong>Already know what you're claiming?</strong> Use this shortcut!</p>
              <p style="margin-top: 10px;">
                The Quick Picker lets you add conditions directly to your packet without searching.
              </p>
              <p style="color: #c8a961; margin-top: 10px; font-weight: 600;">
                Just click → Pick a body system → Select your condition → Done!
              </p>
            `,
            side: 'right',
            align: 'start'
          },
          onHighlightStarted: () => {
            // Ensure Quick Picker is at the top of viewport
            const element = document.getElementById('tour-quick-picker');
            if (element) {
              const rect = element.getBoundingClientRect();
              const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
              // Position element near top with some padding
              const targetScroll = scrollTop + rect.top - 100;
              window.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
            }
          }
        },
        // My Packet Button
        {
          element: '#tour-my-packet-btn',
          popover: {
            title: '📦 Your Personal Workspace',
            description: `
              <p><strong>This is "My Packet" - your claims command center.</strong></p>
              <p style="margin-top: 10px;">Everything you save appears here:</p>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>All your tracked conditions</li>
                <li>Personal statements you've written</li>
                <li>Evidence checklist and progress</li>
                <li>Documents and notes</li>
              </ul>
              <p style="color: #c8a961; margin-top: 10px;">
                <strong>Think of it as your claim's home base.</strong>
              </p>
            `,
            side: 'bottom',
            align: 'start'
          },
          onHighlightStarted: () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        },
        // Workflow Guide
        {
          element: '#tour-workflow-guide-btn',
          popover: {
            title: '🗺️ Step-by-Step Guides',
            description: `
              <p><strong>Not sure what to do first?</strong> This button has you covered.</p>
              <p style="margin-top: 10px;">The Workflow Guide walks you through:</p>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>📝 Filing your first claim</li>
                <li>🔄 Appealing a denial</li>
                <li>⬆️ Increasing an existing rating</li>
                <li>🎖️ Applying for special benefits (TDIU/SMC)</li>
              </ul>
              <p style="color: #c8a961; font-weight: 600; margin-top: 10px;">
                Completely lost? <strong>Start here!</strong>
              </p>
            `,
            side: 'bottom',
            align: 'center'
          },
          onHighlightStarted: () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        },
        // Tools Menu
        {
          element: '#tour-tools-dropdown',
          popover: {
            title: '🛠️ Your Claims Toolkit',
            description: `
              <p><strong>Ready for the advanced features?</strong> We've got ${getTotalToolCount()}+ specialized tools:</p>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>🔍 <strong>Secondary Scout</strong> - Discover related conditions</li>
                <li>✅ <strong>C&P Simulator</strong> - Practice for your exam</li>
                <li>🧮 <strong>Rating Calculator</strong> - Calculate your total %</li>
                <li>📝 <strong>Nexus Builder</strong> - Generate medical statements</li>
                <li>...and 35+ more!</li>
              </ul>
              <p style="color: #9ca3af; font-size: 0.85rem; margin-top: 10px;">
                Click "Tools" whenever you need something specific.
              </p>
            `,
            side: 'bottom',
            align: 'center'
          },
          onHighlightStarted: () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        },
        // AI Navigator - Show as centered popover with arrow pointing to bottom-left
        {
          popover: {
            title: '🧭 Your AI Assistant',
            description: `
              <div style="text-align: center;">
                <p style="font-size: 2.5rem; margin-bottom: 10px;">↙️</p>
                <p><strong>Look in the bottom-left corner!</strong></p>
                <p style="margin-top: 10px;">The 🧭 button opens <strong>The Navigator</strong> - your personal claims guide!</p>
                <p style="margin-top: 10px;">The Navigator can:</p>
                <ul style="margin: 10px 0; padding-left: 20px; text-align: left;">
                  <li>💬 Answer questions about the VA process</li>
                  <li>📚 Explain confusing regulations in plain English</li>
                  <li>🤝 Walk you through any tool</li>
                  <li>🎯 Suggest what to do next</li>
                </ul>
                <p style="color: #c8a961; font-weight: 600; margin-top: 10px;">
                  💡 Pro tip: You can drag it anywhere on your screen!
                </p>
                <p style="color: #9ca3af; font-size: 0.85rem; margin-top: 10px;">
                  We'll open it for you at the end of this tour!
                </p>
              </div>
            `,
            popoverClass: 'welcome-step'
          }
        },
        // Help Button
        {
          element: '#tour-help-btn',
          popover: {
            title: '📖 When You Need Help',
            description: `
              <p><strong>Stuck? Confused?</strong> The User Manual is your friend.</p>
              <p style="margin-top: 10px;">Inside you'll find:</p>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>Complete documentation for every tool</li>
                <li>Step-by-step how-to guides</li>
                <li>Answers to common questions</li>
                <li>A way to restart this tour</li>
              </ul>
              <p style="color: #c8a961; margin-top: 10px;">
                <strong>💾 Don't forget to backup your data regularly!</strong>
              </p>
            `,
            side: 'bottom',
            align: 'center'
          },
          onHighlightStarted: () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        },
        // Final screen
        {
          popover: {
            title: '🚀 You\'re All Set!',
            description: `
              <div style="text-align: center; padding: 10px 0;">
                <p style="font-size: 1.1rem; margin-bottom: 15px;">
                  <strong>That's the tour!</strong> You now know the essentials.
                </p>
                
                <div style="margin: 20px 0; padding: 15px; background: #1f2937; border-radius: 8px; border: 1px solid #374151;">
                  <p style="color: #22c55e; font-weight: 600; margin: 0;">
                    ✅ Want to see an example? Click "Load Demo Data" to explore a sample claim with all the features filled out.
                  </p>
                </div>
                
                <p style="color: #9ca3af; font-size: 0.9rem; margin-top: 15px;">
                  Remember: The 📖 Help menu and 🧭 Navigator are always here if you need guidance.
                </p>
                
                <p style="color: #c8a961; font-weight: 700; margin-top: 20px; font-size: 1rem;">
                  "Built by a Veteran, For Veterans."
                </p>
              </div>
            `,
            popoverClass: 'welcome-step'
          },
          onHighlightStarted: () => {
            // Open the Navigator on the final step so it's ready when tour ends
            const navigatorButton = document.getElementById('tour-ai-navigator-btn');
            if (navigatorButton) {
              navigatorButton.click();
            }
          }
        }
      ]
    });

    setTourDriver(driverObj);
    driverObj.drive();
    }, 100); // End of setTimeout delay
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

// Export function to trigger tour restart (dispatches event that BootCampTour listens for)
export const triggerTourRestart = () => {
  localStorage.removeItem(TOUR_SEEN_KEY);
  const event = new CustomEvent('restartTour');
  window.dispatchEvent(event);
};

// Export function to check if tour has been seen
export const hasTourBeenSeen = () => {
  return localStorage.getItem(TOUR_SEEN_KEY) === 'true';
};

export default BootCampTour;
