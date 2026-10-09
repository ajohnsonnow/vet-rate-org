import { lazy, Suspense, useState, useEffect } from "react";

const FeatureRequest = lazy(() => import("../../components/FeatureRequest"));
const CommunityRoadmap = lazy(
  () => import("../../components/CommunityRoadmap"),
);

/**
 * Feedback surfaces — Feature Request form + Community Roadmap viewer.
 *
 * The two are coupled: FeatureRequest's "see what's planned" link chains
 * into CommunityRoadmap. They share no data but live in the same user
 * mental model (give feedback / see feedback).
 *
 * External callers open either modal by dispatching `openFeatureRequest`
 * or `openCommunityRoadmap`. `getAppState` is passed as a prop because
 * the diagnostic snapshot lives in App.jsx — FeatureRequest attaches it
 * to submissions.
 *
 * Extracted from App.jsx (audit #35, B32). BugSquasher stays in App.jsx
 * because 40+ "Report Bug" buttons across the app open it via callback
 * prop; converting all of them to dispatch is a separate change.
 */
export default function FeedbackHub({ getAppState }) {
  const [showRequest, setShowRequest] = useState(false);
  const [showRoadmap, setShowRoadmap] = useState(false);

  useEffect(() => {
    const openRequest = () => setShowRequest(true);
    const openRoadmap = () => setShowRoadmap(true);
    window.addEventListener("openFeatureRequest", openRequest);
    window.addEventListener("openCommunityRoadmap", openRoadmap);
    return () => {
      window.removeEventListener("openFeatureRequest", openRequest);
      window.removeEventListener("openCommunityRoadmap", openRoadmap);
    };
  }, []);

  return (
    <Suspense fallback={null}>
      {showRequest && (
        <FeatureRequest
          onClose={() => setShowRequest(false)}
          appState={getAppState?.()}
          onOpenRoadmap={() => setShowRoadmap(true)}
        />
      )}
      {showRoadmap && (
        <CommunityRoadmap onClose={() => setShowRoadmap(false)} />
      )}
    </Suspense>
  );
}
