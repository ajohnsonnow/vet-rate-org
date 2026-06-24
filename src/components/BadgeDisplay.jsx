/**
 * BadgeDisplay.jsx - Military Badge, Tab, and Accoutrement Display
 * ================================================================
 *
 * Renders military badges in proper AR 670-1 / service regulation order:
 * - Combat/Special Skill badges ABOVE ribbon rack
 * - Marksmanship badges BELOW ribbon rack
 * - Tabs rendered separately for shoulder display
 * - Service stripes and overseas bars for sleeve display
 *
 * @see src/data/badgeData.js for badge definitions
 */

import React from "react";
import PropTypes from "prop-types";
import { scrubSvg } from "../utils/sanitize";
import {
  BADGE_GROUPS,
  BADGE_PLACEMENT,
  calculateOverseasBars,
  calculateServiceStripes,
} from "../data/badgeData";

// ============================================================================
// BADGE SIZE CONFIGURATIONS
// ============================================================================

const BADGE_SIZES = {
  sm: { width: 60, height: 30, fontSize: 8 },
  md: { width: 80, height: 40, fontSize: 10 },
  lg: { width: 100, height: 50, fontSize: 12 },
};

const TAB_SIZES = {
  sm: { width: 80, height: 20, fontSize: 8 },
  md: { width: 100, height: 25, fontSize: 10 },
  lg: { width: 120, height: 30, fontSize: 12 },
};

// ============================================================================
// BADGE IMAGE UTILITIES
// ============================================================================

// Map badge IDs to image file names (for badges we have images for)
const BADGE_IMAGES = {
  cib: "/images/badges/combat-infantryman-badge.svg",
  cab: "/images/badges/combat-action-badge.svg",
  cmb: "/images/badges/combat-medical-badge.svg",
  eib: "/images/badges/expert-infantryman-badge.svg",
  efmb: "/images/badges/expert-field-medical-badge.svg",
  esb: "/images/badges/expert-soldier-badge.svg",
  "master-parachutist": "/images/badges/master-parachutist-badge.svg",
  "senior-parachutist": "/images/badges/senior-parachutist-badge.svg",
  parachutist: "/images/badges/parachutist-badge.svg",
  "air-assault": "/images/badges/air-assault-badge.svg",
  pathfinder: "/images/badges/pathfinder-badge.svg",
  swo: "/images/badges/surface-warfare-officer.svg",
  fmf: "/images/badges/fleet-marine-force.svg",
  "command-pilot": "/images/badges/command-pilot.svg",
};

const TAB_IMAGES = {
  "ranger-tab": "/images/tabs/ranger-tab.svg",
  "airborne-tab": "/images/tabs/airborne-tab.svg",
};

// Get image path for a badge, returns null if no image available
const getBadgeImagePath = (badgeId) => {
  return BADGE_IMAGES[badgeId] || null;
};

// Get image path for a tab
const getTabImagePath = (tabId) => {
  return TAB_IMAGES[tabId] || null;
};

// ============================================================================
// DEFAULT BADGE SVGs (when no custom SVG or image provided)
// ============================================================================

const getDefaultBadgeSVG = (badge, size) => {
  const { width, height } = BADGE_SIZES[size];
  const isCombat = badge.group === BADGE_GROUPS.COMBAT;
  const fill = isCombat ? "#4169E1" : "silver";
  const textColor = isCombat ? "white" : "#333";

  return (
    <svg viewBox="0 0 100 50" width={width} height={height}>
      {/* Badge background */}
      <ellipse
        cx="50"
        cy="25"
        rx="45"
        ry="20"
        fill={fill}
        stroke="#333"
        strokeWidth="2"
      />
      {/* Badge name (abbreviated) */}
      <text
        x="50"
        y="28"
        fontSize="14"
        textAnchor="middle"
        fill={textColor}
        fontWeight="bold"
      >
        {badge.shortName || badge.name.substring(0, 10)}
      </text>
    </svg>
  );
};

// ============================================================================
// SINGLE BADGE COMPONENT
// ============================================================================

const Badge = ({ badge, size = "md", showTooltip = true }) => {
  const dimensions = BADGE_SIZES[size];
  const imagePath = getBadgeImagePath(badge.id);
  const [imageError, setImageError] = React.useState(false);

  // Reset error state if badge changes
  React.useEffect(() => {
    setImageError(false);
  }, [badge.id]);

  const renderBadgeContent = () => {
    // First try: use image file if available and not errored
    if (imagePath && !imageError) {
      return (
        <img
          src={imagePath}
          alt={badge.name}
          className="object-contain"
          style={{ width: dimensions.width, height: dimensions.height }}
          onError={() => setImageError(true)}
        />
      );
    }

    // Second try: use embedded SVG if provided.
    //
    // RT-5: `badge.svg` is developer-curated static SVG from src/data/badgeData.js,
    // but we scrub it (strip <script>/<foreignObject>/on*= handlers/javascript:
    // URLs) before render so a future contributor can't land XSS. The CSP is NOT a
    // backstop here — script-src 'unsafe-inline' is set.
    if (badge.svg) {
      return (
        <div
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
          dangerouslySetInnerHTML={{ __html: scrubSvg(badge.svg) }}
          style={{ width: dimensions.width, height: dimensions.height }}
        />
      );
    }

    // Fallback: render default placeholder SVG
    return getDefaultBadgeSVG(badge, size);
  };

  return (
    <div
      className="relative inline-flex flex-col items-center group"
      style={{ width: dimensions.width }}
    >
      {/* Badge SVG/Image */}
      <div
        className="flex items-center justify-center"
        style={{ width: dimensions.width, height: dimensions.height }}
      >
        {renderBadgeContent()}
      </div>

      {/* Tooltip on hover */}
      {showTooltip && (
        <div
          className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 
                        opacity-0 group-hover:opacity-100 transition-opacity duration-200
                        bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-50
                        pointer-events-none"
        >
          {badge.name}
          {badge.combatIndicator && (
            <span className="ml-1 text-red-400">⚔️ Combat</span>
          )}
        </div>
      )}

      {/* Combat indicator star */}
      {badge.combatIndicator && (
        <div
          className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full 
                        flex items-center justify-center text-white text-xs"
        >
          ★
        </div>
      )}
    </div>
  );
};

Badge.propTypes = {
  badge: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    shortName: PropTypes.string,
    svg: PropTypes.string,
    combatIndicator: PropTypes.bool,
    group: PropTypes.string,
  }).isRequired,
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  showTooltip: PropTypes.bool,
};

// ============================================================================
// TAB COMPONENT (Ranger, SF, Sapper, etc.)
// ============================================================================

const Tab = ({ tab, size = "md" }) => {
  const dimensions = TAB_SIZES[size];
  const imagePath = getTabImagePath(tab.id);
  const [imageError, setImageError] = React.useState(false);

  // Reset error state if tab changes
  React.useEffect(() => {
    setImageError(false);
  }, [tab.id]);

  // If we have an image, render it instead of the styled div
  if (imagePath && !imageError) {
    return (
      <div className="relative inline-flex items-center justify-center group">
        <img
          src={imagePath}
          alt={tab.name}
          className="object-contain"
          style={{ width: dimensions.width, height: dimensions.height }}
          onError={() => setImageError(true)}
        />
        {/* Tooltip */}
        <div
          className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 
                        opacity-0 group-hover:opacity-100 transition-opacity duration-200
                        bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-50"
        >
          {tab.name}
        </div>
      </div>
    );
  }

  // Fallback: render styled div
  return (
    <div
      className="relative inline-flex items-center justify-center group"
      style={{
        width: dimensions.width,
        height: dimensions.height,
        backgroundColor: tab.tabColor || "#000",
        borderRadius: "4px 4px 0 0",
        border: `2px solid ${tab.tabBorder || "#FFD700"}`,
        borderBottom: "none",
      }}
    >
      <span
        style={{
          color: tab.tabBorder || "#FFD700",
          fontSize: dimensions.fontSize,
          fontWeight: "bold",
          letterSpacing: "1px",
        }}
      >
        {tab.tabText || tab.shortName}
      </span>

      {/* Tooltip */}
      <div
        className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 
                      opacity-0 group-hover:opacity-100 transition-opacity duration-200
                      bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-50"
      >
        {tab.name}
      </div>
    </div>
  );
};

Tab.propTypes = {
  tab: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    shortName: PropTypes.string,
    tabColor: PropTypes.string,
    tabText: PropTypes.string,
    tabBorder: PropTypes.string,
  }).isRequired,
  size: PropTypes.oneOf(["sm", "md", "lg"]),
};

// ============================================================================
// OVERSEAS SERVICE BARS COMPONENT
// ============================================================================

const OverseasBars = ({ count, type = "wartime", size = "md" }) => {
  if (count === 0) return null;

  const barHeight = size === "sm" ? 4 : size === "md" ? 6 : 8;
  const barWidth = size === "sm" ? 30 : size === "md" ? 40 : 50;
  // eslint-disable-next-line no-unused-vars
  const gap = 3;

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-gray-500 dark:text-gray-400">
        Overseas Service ({type})
      </span>
      <div className="flex flex-col gap-1">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            style={{
              width: barWidth,
              height: barHeight,
              backgroundColor: "#FFD700",
              border: "1px solid #8B4513",
            }}
          />
        ))}
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {count * 6} months
      </span>
    </div>
  );
};

OverseasBars.propTypes = {
  count: PropTypes.number.isRequired,
  type: PropTypes.oneOf(["wartime", "peacetime"]),
  size: PropTypes.oneOf(["sm", "md", "lg"]),
};

// ============================================================================
// SERVICE STRIPES COMPONENT
// ============================================================================

const ServiceStripes = ({ count, branch = "Army", size = "md" }) => {
  if (count === 0) return null;

  const stripeHeight = size === "sm" ? 15 : size === "md" ? 20 : 25;
  const stripeWidth = size === "sm" ? 25 : size === "md" ? 35 : 45;

  // Army uses gold, Navy/Marines can vary
  const getStripeColor = () => {
    if (branch === "Navy" || branch === "Marines") {
      // Could be gold (12+ years good conduct) or red
      return "#FFD700"; // Default to gold
    }
    return "#FFD700"; // Army gold
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-gray-500 dark:text-gray-400">
        Service Stripes
      </span>
      <svg
        width={stripeWidth}
        height={stripeHeight * count}
        viewBox={`0 0 35 ${20 * count}`}
      >
        {Array.from({ length: count }).map((_, i) => (
          <g key={i} transform={`translate(0, ${i * 20})`}>
            <path
              d="M0 15 L17.5 5 L35 15"
              fill="none"
              stroke={getStripeColor()}
              strokeWidth="3"
            />
          </g>
        ))}
      </svg>
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {count * (branch === "Army" ? 3 : 4)} years
      </span>
    </div>
  );
};

ServiceStripes.propTypes = {
  count: PropTypes.number.isRequired,
  branch: PropTypes.string,
  size: PropTypes.oneOf(["sm", "md", "lg"]),
};

// ============================================================================
// MAIN BADGE DISPLAY COMPONENT
// ============================================================================

/**
 * BadgeDisplay - Renders all badges in proper regulation order
 *
 * @param {Array} badges - Array of badge objects
 * @param {Array} tabs - Array of tab objects
 * @param {number} overseasMonths - Months of overseas service
 * @param {boolean} isWartime - Whether overseas service was wartime
 * @param {number} yearsService - Total years of service
 * @param {string} branch - Service branch
 * @param {string} size - Display size (sm/md/lg)
 * @param {boolean} showLabels - Show section labels
 */
export const BadgeDisplay = ({
  badges = [],
  tabs = [],
  overseasMonths = 0,
  isWartime = false,
  yearsService = 0,
  branch = "Army",
  size = "md",
  showLabels = true,
}) => {
  // Separate badges by placement
  const aboveBadges = badges.filter(
    (b) =>
      b.placement === BADGE_PLACEMENT.ABOVE_RIBBONS_1 ||
      b.placement === BADGE_PLACEMENT.ABOVE_RIBBONS_2 ||
      b.group === BADGE_GROUPS.COMBAT ||
      b.group === BADGE_GROUPS.SPECIAL_SKILL,
  );

  const belowBadges = badges.filter(
    (b) =>
      b.placement === BADGE_PLACEMENT.BELOW_RIBBONS ||
      b.group === BADGE_GROUPS.MARKSMANSHIP,
  );

  // Calculate bars and stripes
  const overseasBars = calculateOverseasBars(overseasMonths, isWartime);
  const serviceStripes = calculateServiceStripes(yearsService, branch);

  return (
    <div className="badge-display flex flex-col gap-4">
      {/* TABS (Shoulder display) */}
      {tabs.length > 0 && (
        <div className="tabs-section">
          {showLabels && (
            <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">
              Tabs
            </h4>
          )}
          <div className="flex flex-wrap gap-2 justify-center">
            {tabs.map((tab) => (
              <Tab key={tab.id} tab={tab} size={size} />
            ))}
          </div>
        </div>
      )}

      {/* BADGES ABOVE RIBBONS */}
      {aboveBadges.length > 0 && (
        <div className="badges-above-section">
          {showLabels && (
            <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">
              Combat & Skill Badges
            </h4>
          )}
          <div className="flex flex-wrap gap-3 justify-center">
            {aboveBadges.map((badge) => (
              <Badge key={badge.id} badge={badge} size={size} />
            ))}
          </div>
        </div>
      )}

      {/* [RIBBON RACK GOES HERE - from VisualRibbon component] */}

      {/* BADGES BELOW RIBBONS (Marksmanship) */}
      {belowBadges.length > 0 && (
        <div className="badges-below-section">
          {showLabels && (
            <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">
              Marksmanship
            </h4>
          )}
          <div className="flex flex-wrap gap-3 justify-center">
            {belowBadges.map((badge) => (
              <Badge key={badge.id} badge={badge} size={size} />
            ))}
          </div>
        </div>
      )}

      {/* SLEEVE ELEMENTS (Overseas Bars & Service Stripes) */}
      {(overseasBars.count > 0 || serviceStripes.count > 0) && (
        <div className="sleeve-elements flex gap-8 justify-center mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          {overseasBars.count > 0 && (
            <OverseasBars
              count={overseasBars.count}
              type={overseasBars.type}
              size={size}
            />
          )}
          {serviceStripes.count > 0 && (
            <ServiceStripes
              count={serviceStripes.count}
              branch={branch}
              size={size}
            />
          )}
        </div>
      )}
    </div>
  );
};

BadgeDisplay.propTypes = {
  badges: PropTypes.array,
  tabs: PropTypes.array,
  overseasMonths: PropTypes.number,
  isWartime: PropTypes.bool,
  yearsService: PropTypes.number,
  branch: PropTypes.string,
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  showLabels: PropTypes.bool,
};

// ============================================================================
// FULL UNIFORM DISPLAY (Combines Badges + Ribbons)
// ============================================================================

export const FullUniformDisplay = ({
  ribbonRack,
  badges = [],
  tabs = [],
  overseasMonths = 0,
  isWartime = false,
  yearsService = 0,
  branch = "Army",
  size = "md",
}) => {
  // Separate badges by placement
  const aboveBadges = badges.filter(
    (b) =>
      b.placement === BADGE_PLACEMENT.ABOVE_RIBBONS_1 ||
      b.placement === BADGE_PLACEMENT.ABOVE_RIBBONS_2 ||
      b.group === BADGE_GROUPS.COMBAT ||
      b.group === BADGE_GROUPS.SPECIAL_SKILL,
  );

  const belowBadges = badges.filter(
    (b) =>
      b.placement === BADGE_PLACEMENT.BELOW_RIBBONS ||
      b.group === BADGE_GROUPS.MARKSMANSHIP,
  );

  const overseasBars = calculateOverseasBars(overseasMonths, isWartime);
  const serviceStripes = calculateServiceStripes(yearsService, branch);

  return (
    <div className="full-uniform-display bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
      {/* Tabs (top) */}
      {tabs.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center mb-4">
          {tabs.map((tab) => (
            <Tab key={tab.id} tab={tab} size={size} />
          ))}
        </div>
      )}

      {/* Badges above ribbons */}
      {aboveBadges.length > 0 && (
        <div className="flex flex-wrap gap-3 justify-center mb-3">
          {aboveBadges.map((badge) => (
            <Badge key={badge.id} badge={badge} size={size} />
          ))}
        </div>
      )}

      {/* Ribbon rack (passed in as children or prop) */}
      {ribbonRack && (
        <div className="ribbon-rack-container my-4">{ribbonRack}</div>
      )}

      {/* Marksmanship badges below */}
      {belowBadges.length > 0 && (
        <div className="flex flex-wrap gap-3 justify-center mt-3">
          {belowBadges.map((badge) => (
            <Badge key={badge.id} badge={badge} size={size} />
          ))}
        </div>
      )}

      {/* Sleeve display */}
      {(overseasBars.count > 0 || serviceStripes.count > 0) && (
        <div className="sleeve-display flex gap-8 justify-center mt-6 pt-4 border-t border-gray-300 dark:border-gray-600">
          {overseasBars.count > 0 && (
            <OverseasBars
              count={overseasBars.count}
              type={overseasBars.type}
              size={size}
            />
          )}
          {serviceStripes.count > 0 && (
            <ServiceStripes
              count={serviceStripes.count}
              branch={branch}
              size={size}
            />
          )}
        </div>
      )}
    </div>
  );
};

FullUniformDisplay.propTypes = {
  ribbonRack: PropTypes.node,
  badges: PropTypes.array,
  tabs: PropTypes.array,
  overseasMonths: PropTypes.number,
  isWartime: PropTypes.bool,
  yearsService: PropTypes.number,
  branch: PropTypes.string,
  size: PropTypes.oneOf(["sm", "md", "lg"]),
};

// ============================================================================
// COMBAT INDICATOR SUMMARY
// ============================================================================

export const CombatIndicatorSummary = ({ badges = [], ribbonAwards = [] }) => {
  // Extract combat indicators from badges
  const combatBadges = badges.filter((b) => b.combatIndicator);

  // Check for combat-related ribbon awards
  const combatRibbonKeywords = [
    "COMBAT",
    "CAMPAIGN",
    "EXPEDITIONARY",
    "WAR",
    "OCCUPATION",
    "BRONZE STAR",
    "PURPLE HEART",
    "VALOR",
  ];

  const combatRibbons = ribbonAwards.filter((award) => {
    const name = (award.name || award).toUpperCase();
    return combatRibbonKeywords.some((kw) => name.includes(kw));
  });

  const hasCombatIndicators =
    combatBadges.length > 0 || combatRibbons.length > 0;

  if (!hasCombatIndicators) return null;

  return (
    <div
      className="combat-indicator-summary bg-red-50 dark:bg-red-900/20 border border-red-200 
                    dark:border-red-800 rounded-lg p-4 mt-4"
    >
      <h4 className="text-red-700 dark:text-red-400 font-semibold flex items-center gap-2">
        <span>⚔️</span> Combat Service Indicators
      </h4>
      <p className="text-sm text-red-600 dark:text-red-300 mt-2">
        This veteran has verified combat service based on:
      </p>
      <ul className="list-disc list-inside text-sm text-red-600 dark:text-red-300 mt-1">
        {combatBadges.map((badge) => (
          <li key={badge.id}>{badge.name}</li>
        ))}
        {combatRibbons.slice(0, 5).map((ribbon, i) => (
          <li key={i}>{ribbon.name || ribbon}</li>
        ))}
      </ul>
      <p className="text-xs text-red-500 dark:text-red-400 mt-3">
        💡 Combat service may qualify for presumptive conditions for VA claims.
      </p>
    </div>
  );
};

CombatIndicatorSummary.propTypes = {
  badges: PropTypes.array,
  ribbonAwards: PropTypes.array,
};

export default BadgeDisplay;
