/**
 * Vet-Rate.org - Nexus Disclaimer Footer Component
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Medical disclaimer for Nexus Letter generator
 * Makes clear this is NOT medical diagnosis
 */

import { useLanguage } from "../contexts/LanguageContext";

const NexusDisclaimerFooter = ({ className = "" }) => {
  const { _t } = useLanguage();
  return (
    <div
      role="note"
      aria-label="Medical professional review required"
      className={`bg-orange-50 dark:bg-orange-900/30 border-2 border-orange-300 dark:border-orange-700 rounded-lg p-4 mt-4 ${className}`}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-xl flex-shrink-0">
          ⚕️
        </span>
        <div className="flex-1">
          <p className="text-sm text-orange-900 dark:text-orange-200 font-bold mb-1">
            Medical Professional Review Required
          </p>
          <p className="text-xs text-orange-800 dark:text-orange-300">
            This document outlines medical logic based on your inputs.{" "}
            <strong>It is NOT a medical diagnosis.</strong>
            It must be reviewed, modified as appropriate, and signed by a
            qualified medical professional before it can be submitted to the VA.
          </p>
          <p className="text-xs text-orange-800 dark:text-orange-300 mt-2">
            <strong>Citation warning:</strong> AI-generated literature
            references and study types are research starting points only. They
            have not been independently verified and{" "}
            <strong>
              must not be cited to the VA as established medical fact
            </strong>{" "}
            without physician confirmation. Do not present AI output verbatim in
            any VA claim or medical record.
          </p>
        </div>
      </div>
    </div>
  );
};

export default NexusDisclaimerFooter;
