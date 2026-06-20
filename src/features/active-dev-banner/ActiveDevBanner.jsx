/**
 * ActiveDevBanner — a calm, on-brand strip above the header.
 *
 * Replaces the former alarming orange/red "ACTIVE DEVELOPMENT… save your work
 * often" marker (red-team D14 / RT15-6): a "this may break, save often" tone
 * undercut trust for a tool handling veterans' most sensitive records. Now a
 * quiet, reassuring brand line with no alarm color, no pulse, no emoji.
 *
 * Pure presentational, no props. Extracted from App.jsx (audit #35, B71).
 */
export default function ActiveDevBanner() {
  return (
    <div className="bg-va-blue text-white py-1.5 px-4 text-center">
      <p className="text-sm">
        Built by a veteran, for veterans — continuously improved.
      </p>
    </div>
  );
}
