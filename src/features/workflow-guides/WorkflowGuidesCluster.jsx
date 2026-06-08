import { lazy, Suspense, useState, useEffect } from "react";

const MissionProtocol = lazy(() => import("../../components/MissionProtocol"));
const WorkflowGuide = lazy(() => import("../../components/WorkflowGuide"));

/**
 * Workflow-orientation surfaces — MissionProtocol (trust beacon /
 * onboarding overview) + WorkflowGuide (mission briefings menu).
 * Both opened via window events.
 *
 * WorkflowGuide needs App.jsx's legacy tool router (handleToolSelect),
 * which still references several local setShow*() calls — passed in
 * as the onToolSelect prop until that router migrates to events.
 *
 * Extracted from App.jsx (audit #35, B46).
 */
export default function WorkflowGuidesCluster({ onToolSelect }) {
  const [showMission, setShowMission] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const openMission = () => setShowMission(true);
    const openGuide = () => setShowGuide(true);
    window.addEventListener("openMissionProtocol", openMission);
    window.addEventListener("openWorkflowGuide", openGuide);
    return () => {
      window.removeEventListener("openMissionProtocol", openMission);
      window.removeEventListener("openWorkflowGuide", openGuide);
    };
  }, []);

  return (
    <Suspense fallback={null}>
      {showMission && <MissionProtocol onClose={() => setShowMission(false)} />}
      {showGuide && (
        <WorkflowGuide
          onClose={() => setShowGuide(false)}
          onToolSelect={(toolId) => {
            setShowGuide(false);
            onToolSelect?.(toolId);
          }}
        />
      )}
    </Suspense>
  );
}
