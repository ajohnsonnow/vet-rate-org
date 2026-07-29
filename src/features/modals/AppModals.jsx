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
import AskTheRegsModal from "../legal-answers/AskTheRegsModal";
import AdminLogin from "../../components/AdminLogin";
import AdminPanel from "../../components/AdminPanel";
import PWAInstallButton from "../../components/PWAInstallButton";
import TermsOfServiceModal from "../../components/TermsOfServiceModal";
import LoadingBunker from "../../components/LoadingBunker";
import ErrorBoundary from "../../components/common/ErrorBoundary";
import { dispatchToolById } from "../../utils/dispatchToolById";

/**
 * Cluster — wraps a single modal cluster in its own ErrorBoundary so a crash
 * in one tool shows an inline fallback instead of taking down its siblings or
 * the main app shell (docs/SPRINT_PLAN_S9-S17.md, S11). Module-scoped so it is
 * a stable component type across renders.
 */
function Cluster({ name, children }) {
  return <ErrorBoundary name={name}>{children}</ErrorBoundary>;
}

/**
 * First third of the modal cluster list — split out of AppModals to keep
 * that component under the max-lines-per-function budget (audit, wave 4).
 */
function PrimaryModalClusters({ userConditions, setUserConditions }) {
  return (
    <>
      {/* Legal/info modals — Privacy, About, Contact, Terms */}
      <Cluster name="Legal & Info">
        <LegalPages />
      </Cluster>

      <Cluster name="Discover Tools">
        <DiscoverCluster
          userConditions={userConditions}
          setUserConditions={setUserConditions}
        />
      </Cluster>

      <Cluster name="My Packet">
        <MyPacketModal />
      </Cluster>

      <Cluster name="Publications Library">
        <PublicationsLibraryModal />
      </Cluster>

      <Cluster name="Evidence Investigation">
        <EvidenceInvestigationCluster />
      </Cluster>

      <Cluster name="Muster Call">
        <MusterCallFlow
          onOpenDD214Analyzer={() =>
            window.dispatchEvent(new CustomEvent("openDD214Analyzer"))
          }
        />
      </Cluster>

      <Cluster name="Knowledge Base">
        <KnowledgeCluster />
      </Cluster>

      <Cluster name="VKB Timeline">
        <VKBTimelineModal />
      </Cluster>

      <Cluster name="Quality Control">
        <QualityControlCluster />
      </Cluster>

      <Cluster name="Pathfinder">
        <PathfinderModal />
      </Cluster>

      <Cluster name="Claim Navigator">
        <ClaimNavigatorModal />
      </Cluster>
    </>
  );
}

/**
 * Second third of the modal cluster list — split out of AppModals to keep
 * that component under the max-lines-per-function budget (audit, wave 4).
 */
function SecondaryModalClusters({ getAppState }) {
  return (
    <>
      <Cluster name="Ask the Regs">
        <AskTheRegsModal />
      </Cluster>

      <Cluster name="System Tools">
        <SystemToolsCluster getAppState={getAppState} />
      </Cluster>

      <Cluster name="Feedback">
        <FeedbackHub getAppState={getAppState} />
      </Cluster>

      {/* Admin Authentication & Panel - Access via Ctrl+Shift+A */}
      <Cluster name="Admin Login">
        <AdminLogin />
      </Cluster>
      <Cluster name="Admin Panel">
        <AdminPanel />
      </Cluster>

      <Cluster name="Claim Prep">
        <ClaimPrepCluster onToolSelect={dispatchToolById} />
      </Cluster>

      <Cluster name="VA Demo Tools">
        <VaDemoTools />
      </Cluster>

      <Cluster name="Adversarial Testing">
        <AdversarialTestingCluster />
      </Cluster>

      <Cluster name="Calculate Tools">
        <CalculateCluster />
      </Cluster>

      <Cluster name="Blue Button X-Ray">
        <BlueButtonXRayModal />
      </Cluster>

      <Cluster name="Specialized Tools">
        <SpecializedToolsCluster />
      </Cluster>
    </>
  );
}

/**
 * Final third of the modal cluster list — split out of AppModals to keep
 * that component under the max-lines-per-function budget (audit, wave 4).
 */
function TertiaryModalClusters({ updateBanner, whatsNewModal }) {
  return (
    <>
      <Cluster name="Maximize Rating">
        <MaximizeRatingCluster />
      </Cluster>

      <Cluster name="AI Transparency">
        <AITransparencyCluster />
      </Cluster>

      <Cluster name="Appeals Tools">
        <AppealsToolsCluster />
      </Cluster>

      <Cluster name="Decision Tools">
        <DecisionToolsCluster />
      </Cluster>

      <Cluster name="Body Mapping">
        <BodyMappingCluster />
      </Cluster>

      <Cluster name="Resources">
        <ResourcesCluster />
      </Cluster>

      <Cluster name="Data Management">
        <DataManagementCluster />
      </Cluster>

      <Cluster name="Vision Simulator">
        <VisionSimulator />
      </Cluster>

      <Cluster name="Install">
        <PWAInstallButton />
      </Cluster>

      <Cluster name="Terms of Service">
        <TermsOfServiceModal />
      </Cluster>

      {updateBanner}
      {whatsNewModal}

      <Cluster name="Workflow Guides">
        <WorkflowGuidesCluster onToolSelect={dispatchToolById} />
      </Cluster>
    </>
  );
}

/**
 * AppModals — all lazy modal clusters mounted under a single
 * <Suspense> boundary (audit #28, B21). Each child either has its
 * own `open*` window-event listener or takes a callback prop; first
 * open triggers its chunk fetch with <LoadingBunker /> as fallback.
 * Each cluster is additionally isolated behind its own ErrorBoundary
 * (audit S11) so a single tool's crash can't blank the rest.
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
      <PrimaryModalClusters
        userConditions={userConditions}
        setUserConditions={setUserConditions}
      />
      <SecondaryModalClusters getAppState={getAppState} />
      <TertiaryModalClusters
        updateBanner={updateBanner}
        whatsNewModal={whatsNewModal}
      />
    </Suspense>
  );
}
