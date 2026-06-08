import { lazy, Suspense, useState, useEffect } from "react";

const MyPacket = lazy(() => import("../../components/MyPacket"));

/**
 * My Packet — veteran's saved-claims hub. Opened from toolbar, command
 * palette, MobileBottomNav, hub pickers, and from inside SecondaryScout /
 * NexusBuilder (which dispatch `openMyPacket`).
 *
 * Events dispatched (handled by App.jsx bridge listeners until the
 * downstream clusters extract):
 *   - openPathfinder — when user clicks "Analyze My Strategy"
 *   - resumeFromPacket (detail = claim) — when user resumes a saved
 *     statement; App.jsx bridge computes existingStatement and opens
 *     NexusBuilder
 *
 * Existing events forwarded:
 *   - openCloudSyncManager, openAISettings, openDD214Analyzer, openBugSquasher
 *
 * Extracted from App.jsx (audit #35, B55).
 */
export default function MyPacketModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("openMyPacket", handler);
    return () => window.removeEventListener("openMyPacket", handler);
  }, []);

  if (!open) return null;

  return (
    <Suspense fallback={null}>
      <MyPacket
        onResume={(claim) => {
          setOpen(false);
          window.dispatchEvent(
            new CustomEvent("resumeFromPacket", { detail: claim }),
          );
        }}
        onClose={() => setOpen(false)}
        onReportBug={() =>
          window.dispatchEvent(new CustomEvent("openBugSquasher"))
        }
        onAnalyzeStrategy={() => {
          setOpen(false);
          window.dispatchEvent(new CustomEvent("openPathfinder"));
        }}
        onOpenGoogleDriveSync={() => {
          setOpen(false);
          window.dispatchEvent(new CustomEvent("openCloudSyncManager"));
        }}
        onOpenAISettings={() =>
          window.dispatchEvent(new CustomEvent("openAISettings"))
        }
        onOpenDD214Analyzer={() => {
          setOpen(false);
          window.dispatchEvent(new CustomEvent("openDD214Analyzer"));
        }}
      />
    </Suspense>
  );
}
