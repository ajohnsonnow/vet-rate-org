/**
 * Centralized Branding Configuration
 * ===================================
 *
 * This file controls ALL branding across the application.
 * Change BRAND_MODE to switch between different branded versions.
 *
 * USAGE:
 * - Set VITE_BRAND_MODE environment variable to "vetrate" or "supplylocker"
 * - Or manually change BRAND_MODE constant below
 *
 * Build commands:
 * - VetRate:      VITE_BRAND_MODE=vetrate npm run build
 * - SupplyLocker: VITE_BRAND_MODE=supplylocker npm run build
 */

// Get brand mode from environment or default to "vetrate"
const BRAND_MODE = import.meta.env.VITE_BRAND_MODE || "vetrate";

/**
 * Brand configurations for each version
 */
const BRANDS = {
  vetrate: {
    // Core Identity
    appName: "Vet-Rate.org",
    shortName: "VetRate",
    tagline: "Free VA Disability Claims Assistance",
    description:
      "Helping veterans navigate the VA claims process - 100% free, forever.",

    // URLs
    domain: "vet-rate.org",
    url: "https://vet-rate.org",
    github: "https://github.com/ajohnsonnow/vet-rate-org",

    // Analytics
    goatCounterSite: "vet-rate-org",
    goatCounterUrl: "https://vet-rate-org.goatcounter.com",

    // Visual Identity
    logo: "/images/Vet-Rate-org-logo-official.png",
    favicon: "/images/Vet-Rate-org-logo-official.png",
    primaryColor: "#1e40af", // Blue-800
    secondaryColor: "#7c3aed", // Purple-600
    accentColor: "#059669", // Emerald-600

    // Feature Names
    assistantName: "VetRate Assistant",
    aiSystemPrefix: "VetRate",

    // Legal
    copyright: "© 2024-2026 Anthony Johnson (Vet-Rate.org)",
    copyrightHolder: "Anthony Johnson",
    license: "AGPL-3.0",
    licenseUrl: "https://www.gnu.org/licenses/agpl-3.0.html",

    // Social/Support
    supportEmail: "support@vet-rate.org",
    buyMeCoffee: null, // Free version has no payment

    // Feature Flags
    showSupportBanner: false,
    showDonationPrompt: false,
    premiumFeatures: false,
  },

  supplylocker: {
    // Core Identity
    appName: "Supply Locker",
    shortName: "SupplyLocker",
    tagline: "Premium VA Claims Toolkit",
    description:
      "Your personal supply locker for VA claims - powered by the same tech as VetRate.",

    // URLs
    domain: "supplylocker.vet",
    url: "https://supplylocker.vet",
    github: "https://github.com/ajohnsonnow/supply-locker",

    // Analytics
    goatCounterSite: "supply-locker",
    goatCounterUrl: "https://supply-locker.goatcounter.com",

    // Visual Identity
    logo: "/images/supply-locker-logo.png",
    favicon: "/images/supply-locker-logo.png",
    primaryColor: "#065f46", // Emerald-800
    secondaryColor: "#1e40af", // Blue-800
    accentColor: "#d97706", // Amber-600

    // Feature Names
    assistantName: "Supply Locker Assistant",
    aiSystemPrefix: "SupplyLocker",

    // Legal
    copyright: "© 2024-2026 Anthony Johnson (Supply Locker)",
    copyrightHolder: "Anthony Johnson",
    license: "AGPL-3.0",
    licenseUrl: "https://www.gnu.org/licenses/agpl-3.0.html",

    // Social/Support
    supportEmail: "support@supplylocker.vet",
    buyMeCoffee: "https://buymeacoffee.com/vetrate",

    // Feature Flags
    showSupportBanner: true,
    showDonationPrompt: false, // They already supported
    premiumFeatures: true, // Future premium features
  },
};

/**
 * Active brand configuration
 */
export const BRAND = BRANDS[BRAND_MODE] || BRANDS.vetrate;

/**
 * Get current brand mode
 */
export const getBrandMode = () => BRAND_MODE;

/**
 * Check if running as SupplyLocker
 */
export const isSupplyLocker = () => BRAND_MODE === "supplylocker";

/**
 * Check if running as VetRate
 */
export const isVetRate = () => BRAND_MODE === "vetrate";

/**
 * Format a name with the current brand prefix
 * e.g., formatBrandName('Assistant') => 'VetRate Assistant' or 'SupplyLocker Assistant'
 */
export const formatBrandName = (suffix) => `${BRAND.shortName} ${suffix}`;

/**
 * Get storage key with brand prefix to avoid conflicts
 * e.g., getStorageKey('settings') => 'vetrate_settings' or 'supplylocker_settings'
 */
export const getStorageKey = (key) => `${BRAND_MODE}_${key}`;

/**
 * CSS variables for brand colors (inject into :root)
 */
export const getBrandCSSVars = () => ({
  "--brand-primary": BRAND.primaryColor,
  "--brand-secondary": BRAND.secondaryColor,
  "--brand-accent": BRAND.accentColor,
});

// Log active brand on load (dev only)
if (import.meta.env.DEV) {
  console.log(`🏷️ Running as: ${BRAND.appName} (${BRAND_MODE} mode)`);
}

export default BRAND;
