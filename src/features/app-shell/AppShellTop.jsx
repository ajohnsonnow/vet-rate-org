import { useEffect } from "react";
import StressReliefDivision from "../../components/StressReliefDivision";
import ToastContainer, { useToast, toastManager } from "../../components/Toast";
import OnboardingGate from "../onboarding/OnboardingGate";
import { VaApiStatusBanner } from "../../components/VaApiStatus";
import { isVaApiEnabled } from "../../config/vaAuth";
import MobileNotice from "../../components/MobileNotice";
import ActiveDevBanner from "../active-dev-banner/ActiveDevBanner";
import GlobalCommandSearchWrapper from "../global-command-search/GlobalCommandSearchWrapper";
/**
 * AppShellTop — everything that renders above AppHeader: the IDDQD
 * easter-egg listener, the toast container, the onboarding gate, the
 * VA API status banner (when the surface is enabled), the mobile
 * notice + active-dev banner, the global command-search modal, and
 * the atomic-wipe panic-key listener.
 *
 * `useToast()` is called here rather than in App.jsx — the hook is a
 * singleton subscriber so the location does not matter, and no
 * sibling outside this cluster reads toast state. Keeping it here
 * eliminates three props from App.jsx.
 *
 * `whatsNewOpen` still has to flow in: it comes from
 * useUpdateOrchestrator (App-level) and gates the DisclaimerSplash
 * inside OnboardingGate so the splash does not collide with the
 * What's New modal on first paint after a service-worker update.
 *
 * Extracted from App.jsx (audit #35, B78).
 */
export default function AppShellTop({ whatsNewOpen }) {
  const { toasts, onClose, onAction } = useToast();

  useEffect(() => {
    const handler = (e) => {
      const { estimatedTokens, limit } = e.detail ?? {};
      toastManager.warning(
        "AI Prompt Too Long",
        `Input was trimmed to fit the model's context window (${estimatedTokens?.toLocaleString() ?? "?"} tokens, limit ${limit?.toLocaleString() ?? "?"}).`,
      );
    };
    window.addEventListener("diamondSwarm:tokenWarning", handler);
    return () =>
      window.removeEventListener("diamondSwarm:tokenWarning", handler);
  }, []);

  return (
    <>
      <StressReliefDivision />
      <ToastContainer toasts={toasts} onClose={onClose} onAction={onAction} />
      <OnboardingGate whatsNewOpen={whatsNewOpen} />
      {isVaApiEnabled() && <VaApiStatusBanner />}
      <MobileNotice />
      <ActiveDevBanner />
      <GlobalCommandSearchWrapper />
    </>
  );
}
