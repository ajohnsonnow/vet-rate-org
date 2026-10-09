import MobileBottomNav, {
  MobileNavSpacer,
} from "../../components/MobileBottomNav";
import { calculateVARating } from "../../utils/vaCalculator";
import { getMyRatings } from "../../utils/veteranProfile";

/**
 * MobileBottomNavWrapper — wires the four bottom-nav buttons to
 * window CustomEvent dispatches and derives the condition count and
 * combined rating badges from the veteran's saved ratings.
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
  // Saved ratings are the veteran's record; userConditions only exists after
  // a Secondary Scout session. The calculator badge shows the combined VA
  // rating (38 CFR 4.25/4.26), not the single highest condition.
  const savedRatings = getMyRatings();
  const ratings = savedRatings.length > 0 ? savedRatings : userConditions;
  const conditionCount = ratings.length;
  const currentRating =
    ratings.length > 0 ? calculateVARating(ratings).combinedRating : null;

  return (
    <>
      <MobileBottomNav
        onSearchClick={dispatch("openGlobalCommandSearch")}
        onCalculatorClick={dispatch("openTacticalCalculator")}
        onPacketClick={dispatch("openMyPacket")}
        onMissionsClick={dispatch("openWorkflowGuide")}
        conditionCount={conditionCount}
        currentRating={currentRating}
      />
      <MobileNavSpacer />
    </>
  );
}
