/**
 * Vet-Rate.org - Claim Prep Disclaimer
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Shown wherever a veteran is actively assembling claim evidence or
 * paperwork (My Packet, Forms Helper, evidence uploads). Disclaimer.jsx
 * covers general site-wide trust/privacy messaging on the home page but
 * doesn't reach these tool-specific screens, which is where a veteran is
 * most likely to be relying on the app's output.
 */
const ClaimPrepDisclaimer = ({ className = "" }) => (
  <div
    className={`bg-amber-50 dark:bg-amber-900/30 border-2 border-amber-300 dark:border-amber-700 rounded-lg p-4 ${className}`}
    role="note"
  >
    <div className="flex items-start gap-3">
      <span className="text-xl flex-shrink-0" aria-hidden="true">
        ⚠️
      </span>
      <div className="flex-1">
        <p className="text-sm text-amber-900 dark:text-amber-200 font-bold mb-1">
          No Guarantee of Outcome
        </p>
        <p className="text-xs text-amber-800 dark:text-amber-300">
          This tool helps you organize evidence and paperwork, but{" "}
          <strong>using it does not guarantee any particular outcome</strong>{" "}
          on your VA claim - ratings and decisions are made solely by the VA.
        </p>
        <p className="text-xs text-amber-800 dark:text-amber-300 mt-2">
          For personalized guidance, seek help from an accredited{" "}
          <strong>Veterans Service Officer (VSO)</strong> - free, no fees
          allowed - and/or a VA-accredited attorney or claims agent. Find one
          at{" "}
          <a
            href="https://www.va.gov/ogc/apps/accreditation/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            va.gov/ogc/apps/accreditation
          </a>
          .
        </p>
      </div>
    </div>
  </div>
);

export default ClaimPrepDisclaimer;
