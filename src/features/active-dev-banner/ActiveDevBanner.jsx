/**
 * ActiveDevBanner — the orange "ACTIVE DEVELOPMENT" strip that sits
 * above the header to remind users to save their work often.
 *
 * Pure presentational, no props. Extracted from App.jsx (audit #35,
 * B71) so the marker can be toggled / re-themed / hidden without
 * touching the root component.
 */
export default function ActiveDevBanner() {
  return (
    <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white py-2 px-4 text-center shadow-md">
      <div className="flex items-center justify-center space-x-2 text-sm">
        <span className="animate-pulse text-lg">🎖️</span>
        <span className="font-semibold">ACTIVE DEVELOPMENT:</span>
        <span>
          We&apos;re on a ruck march bringing code improvements to you! Save
          your work often.
        </span>
        <span className="animate-pulse text-lg">🎖️</span>
      </div>
    </div>
  );
}
