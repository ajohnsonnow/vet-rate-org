/**
 * Vet-Rate.org - System Capability Check
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 *
 * "The Tech Check" - Browser Compatibility Guard
 * Ensures the user's browser supports all required modern features
 * before loading the main application.
 *
 * Prevents cryptic errors for veterans using older devices or library computers.
 */

/**
 * Required capabilities and their descriptions
 */
const REQUIRED_CAPABILITIES = {
  crypto: {
    name: "Web Cryptography API",
    description: "Required for secure data encryption",
    icon: "🔐",
  },
  indexedDB: {
    name: "IndexedDB Storage",
    description: "Required for offline data storage",
    icon: "💾",
  },
  serviceWorker: {
    name: "Service Workers",
    description: "Required for offline functionality",
    icon: "⚡",
  },
  es6: {
    name: "ES6+ JavaScript",
    description: "Required for modern app features",
    icon: "📜",
  },
};

/**
 * Test if Web Crypto API is available
 * @returns {boolean}
 */
function testCryptoAPI() {
  try {
    return !!(
      window.crypto &&
      window.crypto.subtle &&
      typeof window.crypto.subtle.encrypt === "function"
    );
  } catch {
    return false;
  }
}

/**
 * Test if IndexedDB is available
 * @returns {boolean}
 */
function testIndexedDB() {
  try {
    return !!(window.indexedDB && typeof window.indexedDB.open === "function");
  } catch {
    return false;
  }
}

/**
 * Test if Service Workers are supported
 * @returns {boolean}
 */
function testServiceWorker() {
  try {
    return "serviceWorker" in navigator;
  } catch {
    return false;
  }
}

/**
 * Test for ES6+ support (Promises, async/await, etc.)
 * @returns {boolean}
 */
function testES6Support() {
  try {
    // Test Promise
    if (typeof Promise === "undefined") return false;

    // Test arrow functions and const
    const arrowTest = () => true;
    if (!arrowTest()) return false;

    // Test template literals
    const templateTest = `test`;
    if (templateTest !== "test") return false;

    // Test destructuring
    const { a } = { a: 1 };
    if (a !== 1) return false;

    // Test Array methods
    if (typeof [].includes !== "function") return false;
    if (typeof Object.entries !== "function") return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Run all capability tests
 * @returns {Object} Results of all tests
 */
export function checkSystemCapabilities() {
  const results = {
    passed: true,
    capabilities: {
      crypto: testCryptoAPI(),
      indexedDB: testIndexedDB(),
      serviceWorker: testServiceWorker(),
      es6: testES6Support(),
    },
    failedTests: [],
    browserInfo: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookiesEnabled: navigator.cookieEnabled,
    },
  };

  // Check which tests failed
  Object.entries(results.capabilities).forEach(([key, passed]) => {
    if (!passed) {
      results.passed = false;
      results.failedTests.push({
        key,
        ...REQUIRED_CAPABILITIES[key],
      });
    }
  });

  return results;
}

/**
 * Get a user-friendly browser recommendation based on detected browser
 * @returns {string}
 */
function getBrowserRecommendation() {
  const ua = navigator.userAgent.toLowerCase();

  if (ua.includes("iphone") || ua.includes("ipad")) {
    return "Please update to iOS 15 or newer, or use the latest Safari browser.";
  }
  if (ua.includes("android")) {
    return "Please update to the latest Chrome or Firefox from the Google Play Store.";
  }
  if (ua.includes("msie") || ua.includes("trident")) {
    return "Internet Explorer is not supported. Please switch to Microsoft Edge, Chrome, or Firefox.";
  }

  return "Please update to the latest version of Chrome, Firefox, or Microsoft Edge.";
}

/**
 * Render the browser upgrade warning page
 * This replaces the entire app with a friendly warning
 */
export function renderBrowserWarning(results) {
  const failedList = results.failedTests
    .map(
      (test) => `
      <li class="failed-item">
        <span class="icon">${test.icon}</span>
        <span class="name">${test.name}</span>
        <span class="desc">- ${test.description}</span>
      </li>
    `,
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Browser Update Required - Vet-Rate.org</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a365d 0%, #2d3748 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      color: #f7fafc;
    }
    
    .container {
      max-width: 600px;
      background: #2d3748;
      border-radius: 16px;
      padding: 40px;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      border: 1px solid #4a5568;
    }
    
    .icon-shield {
      font-size: 64px;
      margin-bottom: 20px;
    }
    
    h1 {
      font-size: 28px;
      margin-bottom: 12px;
      color: #f6ad55;
    }
    
    .subtitle {
      font-size: 18px;
      color: #a0aec0;
      margin-bottom: 30px;
    }
    
    .message-box {
      background: #1a365d;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 30px;
      text-align: left;
    }
    
    .message-box p {
      line-height: 1.6;
      margin-bottom: 16px;
    }
    
    .message-box p:last-child {
      margin-bottom: 0;
    }
    
    .failed-list {
      list-style: none;
      text-align: left;
      margin: 20px 0;
    }
    
    .failed-item {
      background: rgba(245, 101, 101, 0.1);
      border: 1px solid rgba(245, 101, 101, 0.3);
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    
    .failed-item .icon {
      font-size: 20px;
    }
    
    .failed-item .name {
      font-weight: 600;
      color: #fc8181;
    }
    
    .failed-item .desc {
      color: #a0aec0;
      font-size: 14px;
    }
    
    .browsers {
      display: flex;
      justify-content: center;
      gap: 20px;
      margin: 30px 0;
      flex-wrap: wrap;
    }
    
    .browser-link {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-decoration: none;
      color: #e2e8f0;
      padding: 16px 24px;
      background: #4a5568;
      border-radius: 12px;
      transition: all 0.2s;
    }
    
    .browser-link:hover {
      background: #718096;
      transform: translateY(-2px);
    }
    
    .browser-link img {
      width: 48px;
      height: 48px;
      margin-bottom: 8px;
    }
    
    .browser-link span {
      font-size: 14px;
      font-weight: 500;
    }
    
    .recommendation {
      background: #2f855a;
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      margin-top: 20px;
    }
    
    .footer {
      margin-top: 30px;
      font-size: 14px;
      color: #718096;
    }
    
    .footer a {
      color: #68d391;
      text-decoration: none;
    }
    
    .footer a:hover {
      text-decoration: underline;
    }
    
    @media (max-width: 480px) {
      .container {
        padding: 24px;
      }
      
      h1 {
        font-size: 22px;
      }
      
      .browsers {
        flex-direction: column;
        align-items: center;
      }
      
      .browser-link {
        width: 100%;
        flex-direction: row;
        gap: 16px;
      }
      
      .browser-link img {
        margin-bottom: 0;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon-shield">🛡️</div>
    <h1>Browser Update Required</h1>
    <p class="subtitle">To protect your data, Vet-Rate.org requires a modern browser</p>
    
    <div class="message-box">
      <p>
        <strong>Your browser is missing these security features:</strong>
      </p>
      <ul class="failed-list">
        ${failedList}
      </ul>
      <p>
        Vet-Rate.org uses cutting-edge security technology to protect your sensitive VA claim information. 
        Older browsers cannot provide the encryption and storage features needed to keep your data safe.
      </p>
    </div>
    
    <p><strong>Download a modern browser:</strong></p>
    
    <div class="browsers">
      <a href="https://www.google.com/chrome/" target="_blank" rel="noopener" class="browser-link">
        <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='46' fill='%23fff'/%3E%3Ccircle cx='50' cy='50' r='20' fill='%234285f4'/%3E%3Cpath fill='%23ea4335' d='M50 4a46 46 0 0 1 39.8 23H50V4Z'/%3E%3Cpath fill='%23fbbc05' d='M10.2 27A46 46 0 0 1 50 4v23H27.8L10.2 27Z' transform='rotate(120 50 50)'/%3E%3Cpath fill='%2334a853' d='M10.2 27A46 46 0 0 1 50 4v23H27.8L10.2 27Z' transform='rotate(240 50 50)'/%3E%3C/svg%3E" alt="Chrome">
        <span>Google Chrome</span>
      </a>
      <a href="https://www.mozilla.org/firefox/" target="_blank" rel="noopener" class="browser-link">
        <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='46' fill='%23ff9500'/%3E%3Ccircle cx='50' cy='50' r='28' fill='%230060df'/%3E%3C/svg%3E" alt="Firefox">
        <span>Mozilla Firefox</span>
      </a>
      <a href="https://www.microsoft.com/edge" target="_blank" rel="noopener" class="browser-link">
        <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='46' fill='%230078d4'/%3E%3Cpath fill='%2350e6ff' d='M30 50a28 28 0 0 1 40 0 20 20 0 1 0-40 0Z'/%3E%3C/svg%3E" alt="Edge">
        <span>Microsoft Edge</span>
      </a>
    </div>
    
    <div class="recommendation">
      💡 ${getBrowserRecommendation()}
    </div>
    
    <div class="footer">
      <p>Questions? Contact us at <a href="mailto:support@vet-rate.org">support@vet-rate.org</a></p>
      <p style="margin-top: 8px;">Vet-Rate.org - Supporting those who served 🇺🇸</p>
    </div>
  </div>
</body>
</html>
  `;

  // Replace the entire document
  document.open();
  document.write(html);
  document.close();
}

/**
 * Initialize the capability check on page load
 * Call this before mounting the React app
 * @returns {boolean} True if browser is compatible, false if warning was shown
 */
export function initCapabilityCheck() {
  const results = checkSystemCapabilities();

  if (!results.passed) {
    // Log for debugging
    console.warn("Browser compatibility check failed:", results);

    // Show the warning page
    renderBrowserWarning(results);
    return false;
  }

  // All checks passed
  // eslint-disable-next-line no-console
  console.log("✅ Browser compatibility check passed");
  return true;
}

export default {
  checkSystemCapabilities,
  renderBrowserWarning,
  initCapabilityCheck,
};
