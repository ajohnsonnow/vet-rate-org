/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 */

import React from "react";
import AnimatedBug from "./AnimatedBug";
import { useLanguage } from "../contexts/LanguageContext";

/**
 * ReportBugLink - A standardized, small bug report button for module headers
 *
 * This component provides a consistent "Report Bug" link that can be placed
 * in the header of any module/modal for easy access to the Bug Squasher.
 *
 * @param {function} onClick - Handler to open the Bug Squasher modal
 * @param {string} variant - 'light' (for dark headers) or 'dark' (for light headers)
 * @param {string} moduleName - Optional module name to pre-fill in bug report
 */
function ReportBugLink({ onClick, variant = "light", moduleName = "" }) {
  const { t } = useLanguage();
  const handleClick = (e) => {
    e.stopPropagation();
    // Store the module name in sessionStorage for the bug report
    if (moduleName) {
      sessionStorage.setItem("bugReport_currentModule", moduleName);
    }
    // Only call onClick if it's provided
    if (onClick && typeof onClick === "function") {
      onClick();
    }
  };

  const baseStyles =
    "inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition-all opacity-80 hover:opacity-100";

  const variantStyles =
    variant === "light"
      ? "text-white/90 hover:text-white hover:bg-white/10"
      : "text-gray-600 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700";

  return (
    <button
      onClick={handleClick}
      className={`${baseStyles} ${variantStyles}`}
      title="Report a bug in this module"
      aria-label={`Report a bug${moduleName ? ` in ${moduleName}` : ""}`}
    >
      <span>🐛</span>
      <span>Bug?</span>
      <AnimatedBug size="xs" />
    </button>
  );
}

export default ReportBugLink;
