import MobileBottomNav, {
  MobileNavSpacer,
} from "../../components/MobileBottomNav";

/**
 * MobileBottomNavWrapper — wires the four bottom-nav buttons to
 * window CustomEvent dispatches and derives `packetCount` /
 * `currentRating` from the caller-supplied `userConditions` array.
 *
 * The spacer ships from the same module and must follow the nav in
 * the DOM, so it's rendered here too — callers get one component for
 * both.
 *
 * Extracted from App.jsx (audit #35, B68). Replaces ~22 LOC of
 * inline prop wiring + derived-value math.
 */
const dispatch = (name) => () => window.dispatchEvent(new CustomEvent(name));

export default function MobileBottomNavWrapper({ userConditions }) {
  const packetCount = userConditions.length;
  const currentRating =
    userConditions.length > 0
      ? userConditions.reduce((acc, c) => Math.max(acc, c.rating || 0), 0)
      : null;

  return (
    <>
      <MobileBottomNav
        onSearchClick={dispatch("openGlobalCommandSearch")}
        onCalculatorClick={dispatch("openTacticalCalculator")}
        onPacketClick={dispatch("openMyPacket")}
        onMissionsClick={dispatch("openWorkflowGuide")}
        packetCount={packetCount}
        currentRating={currentRating}
      />
      <MobileNavSpacer />
    </>
  );
}
