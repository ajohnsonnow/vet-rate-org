import { lazy, Suspense, useState, useEffect } from "react";

const AskTheRegs = lazy(() => import("../../components/AskTheRegs"));

/**
 * Ask the Regs — S23. Opens on `openAskTheRegs` window event, following the
 * same single-modal wrapper pattern as ClaimNavigatorModal/PathfinderModal.
 */
export default function AskTheRegsModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("openAskTheRegs", handler);
    return () => window.removeEventListener("openAskTheRegs", handler);
  }, []);

  if (!open) return null;

  return (
    <Suspense fallback={null}>
      <AskTheRegs onClose={() => setOpen(false)} />
    </Suspense>
  );
}
