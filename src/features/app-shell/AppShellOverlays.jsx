import CrisisListener from "../crisis/CrisisListener";
import QuickExitButton from "../../components/QuickExitButton";
import SecurityBadge from "../../components/SecurityBadge";
import MobileBottomNavWrapper from "../mobile-nav/MobileBottomNavWrapper";

/**
 * AppShellOverlays — the always-mounted overlay layer that sits at
 * the bottom of the App tree: crisis interception, quick-exit,
 * security badge, and the mobile bottom nav.
 *
 * CrisisListener is SAFETY-CRITICAL (highest z-index, blocks all
 * other UI) and must remain mounted whenever the app is rendering
 * the main shell — do not gate this cluster on any feature flag.
 *
 * `userConditions` is forwarded to MobileBottomNavWrapper for its
 * packetCount + currentRating derivations. Extracted from App.jsx
 * (audit #35, B77).
 */
export default function AppShellOverlays({ userConditions }) {
  return (
    <>
      <CrisisListener />
      <QuickExitButton position="bottom-left" variant="subtle" />
      <SecurityBadge />
      <MobileBottomNavWrapper userConditions={userConditions} />
    </>
  );
}
