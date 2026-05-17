import { Suspense } from "react";
import LegalPages from "../legal/LegalPages";
import DiscoverCluster from "../discover/DiscoverCluster";
import MyPacketModal from "../my-packet/MyPacketModal";
import PublicationsLibraryModal from "../publications/PublicationsLibraryModal";
import EvidenceInvestigationCluster from "../evidence-investigation/EvidenceInvestigationCluster";
import MusterCallFlow from "../muster-call/MusterCallFlow";
import KnowledgeCluster from "../knowledge/KnowledgeCluster";
import VKBTimelineModal from "../vkb/VKBTimelineModal";
import QualityControlCluster from "../quality-control/QualityControlCluster";
import PathfinderModal from "../pathfinder/PathfinderModal";
import ClaimNavigatorModal from "../navigator/ClaimNavigatorModal";
import SystemToolsCluster from "../system-tools/SystemToolsCluster";
import FeedbackHub from "../feedback/FeedbackHub";
import ClaimPrepCluster from "../claim-prep/ClaimPrepCluster";
import VaDemoTools from "../va-demo/VaDemoTools";
import AdversarialTestingCluster from "../adversarial-testing/AdversarialTestingCluster";
import CalculateCluster from "../calculate/CalculateCluster";
import BlueButtonXRayModal from "../blue-button/BlueButtonXRayModal";
import SpecializedToolsCluster from "../specialized-tools/SpecializedToolsCluster";
import MaximizeRatingCluster from "../maximize-rating/MaximizeRatingCluster";
import AITransparencyCluster from "../ai-transparency/AITransparencyCluster";
import AppealsToolsCluster from "../appeals-tools/AppealsToolsCluster";
import DecisionToolsCluster from "../decision-tools/DecisionToolsCluster";
import BodyMappingCluster from "../body-mapping/BodyMappingCluster";
import ResourcesCluster from "../resources/ResourcesCluster";
import DataManagementCluster from "../data-management/DataManagementCluster";
import VisionSimulator from "../vision/VisionSimulator";
import WorkflowGuidesCluster from "../workflow-guides/WorkflowGuidesCluster";
import AdminLogin from "../../components/AdminLogin";
import AdminPanel from "../../components/AdminPanel";
import PWAInstallButton from "../../components/PWAInstallButton";
import TermsOfServiceModal from "../../components/TermsOfServiceModal";
import LoadingBunker from "../../components/LoadingBunker";
import { dispatchToolById } from "../../utils/dispatchToolById";

/**
 * AppModals — all lazy modal clusters mounted under a single
 * <Suspense> boundary (audit #28, B21). Each child either has its
 * own `open*` window-event listener or takes a callback prop; first
 * open triggers its chunk fetch with <LoadingBunker /> as fallback.
 *
 * Props:
 *   - userConditions / setUserConditions: passed to DiscoverCluster
 *     for the My Packet ↔ Discover round-trip
 *   - getAppState: passed to SystemToolsCluster (bug reports) and
 *     FeedbackHub (feature requests)
 *   - updateBanner / whatsNewModal: rendered nodes from
 *     useUpdateOrchestrator
 *
 * Extracted from App.jsx (audit #35, B76).
 */
export default function AppModals({
  userConditions,
  setUserConditions,
  getAppState,
  updateBanner,
  whatsNewModal,
}) {
  return (
    <Suspense fallback={<LoadingBunker />}>
      {/* Legal/info modals — Privacy, About, Contact, Terms */}
      <LegalPages />

      <DiscoverCluster
        userConditions={userConditions}
        setUserConditions={setUserConditions}
      />

      <MyPacketModal />

      <PublicationsLibraryModal />

      <EvidenceInvestigationCluster />

      <MusterCallFlow
        onOpenDD214Analyzer={() =>
          window.dispatchEvent(new CustomEvent("openDD214Analyzer"))
        }
      />

      <KnowledgeCluster />

      <VKBTimelineModal />

      <QualityControlCluster />

      <PathfinderModal />

      <ClaimNavigatorModal />

      <SystemToolsCluster getAppState={getAppState} />

      <FeedbackHub getAppState={getAppState} />

      {/* Admin Authentication & Panel - Access via Ctrl+Shift+A */}
      <AdminLogin />
      <AdminPanel />

      <ClaimPrepCluster onToolSelect={dispatchToolById} />

      <VaDemoTools />

      <AdversarialTestingCluster />

      <CalculateCluster />

      <BlueButtonXRayModal />

      <SpecializedToolsCluster />

      <MaximizeRatingCluster />

      <AITransparencyCluster />

      <AppealsToolsCluster />

      <DecisionToolsCluster />

      <BodyMappingCluster />

      <ResourcesCluster />

      <DataManagementCluster />

      <VisionSimulator />

      <PWAInstallButton />

      <TermsOfServiceModal />

      {updateBanner}
      {whatsNewModal}

      <WorkflowGuidesCluster onToolSelect={dispatchToolById} />
    </Suspense>
  );
}
