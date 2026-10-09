/**
 * ActiveDevBanner - a calm, on-brand strip above the header.
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
    // pt-20 below `sm` reserves the same Quick Exit gutter as
    // ResponsiveModal.jsx: this banner is the first element in the app tree
    // (AppShellTop, above the header), so on phones it renders directly
    // behind the fixed top-left Quick Exit button and its centered text
    // wraps to a second line that sat under it.
    <div className="bg-va-blue text-white pb-1.5 pt-20 px-4 text-center sm:pt-1.5">
      <p className="text-sm">
        Built by a veteran, for veterans - continuously improved.
      </p>
    </div>
  );
}
