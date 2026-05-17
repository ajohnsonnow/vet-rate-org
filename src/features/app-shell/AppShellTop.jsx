import StressReliefDivision from "../../components/StressReliefDivision";
import ToastContainer, { useToast } from "../../components/Toast";
import OnboardingGate from "../onboarding/OnboardingGate";
import { VaApiStatusBanner } from "../../components/VaApiStatus";
import { isVaApiEnabled } from "../../config/vaAuth";
import MobileNotice from "../../components/MobileNotice";
import ActiveDevBanner from "../active-dev-banner/ActiveDevBanner";
import GlobalCommandSearchWrapper from "../global-command-search/GlobalCommandSearchWrapper";
import AtomicWipe from "../../components/AtomicWipe";

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

  return (
    <>
      <StressReliefDivision />
      <ToastContainer toasts={toasts} onClose={onClose} onAction={onAction} />
      <OnboardingGate whatsNewOpen={whatsNewOpen} />
      {isVaApiEnabled() && <VaApiStatusBanner />}
      <MobileNotice />
      <ActiveDevBanner />
      <GlobalCommandSearchWrapper />
      <AtomicWipe />
    </>
  );
}
