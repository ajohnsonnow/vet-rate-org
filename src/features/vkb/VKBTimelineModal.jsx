import { lazy, Suspense, useState, useEffect } from "react";

const VKBTimeline = lazy(() => import("../../components/VKBTimeline"));

/**
 * VKB document version-history timeline modal. Opens on `openVKBTimeline`
 * window event.
 *
 * Extracted from App.jsx (audit #35, B37). The original `onDocumentClick`
 * was already a console.log stub — preserved here so the visible behavior
 * is identical.
 */
export default function VKBTimelineModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("openVKBTimeline", handler);
    return () => window.removeEventListener("openVKBTimeline", handler);
  }, []);

  if (!open) return null;

  return (
    <Suspense fallback={null}>
      <VKBTimeline
        onDocumentClick={(doc) => {
          console.log("Document clicked:", doc);
        }}
        onClose={() => setOpen(false)}
      />
    </Suspense>
  );
}
