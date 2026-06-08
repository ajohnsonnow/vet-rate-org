import { useState, useEffect } from "react";
import UpdateBanner from "../../components/UpdateBanner";
import WhatsNewModal from "../../components/WhatsNewModal";
import { APP_VERSION, LAST_SEEN_VERSION_KEY } from "../../utils/version";
import {
  startUpdateChecker,
  stopUpdateChecker,
  applyUpdate,
} from "../../utils/updateChecker";
import { generateWhatsNewChangelog } from "../../utils/changelogGenerator";
import changelogData from "../../data/changelog.json";

/**
 * Live-ops update + What's-New orchestrator.
 *
 * Owns all state, lifecycle, and JSX for the update banner and the "What's New"
 * changelog modal so App.jsx no longer has to. Returns the two pieces of JSX
 * plus a `whatsNewOpen` flag the caller can read to gate other UI (e.g. the
 * onboarding BootCampTour, which suppresses itself while the modal is visible).
 *
 * Extracted from App.jsx (audit #35, B25). Behavior preserved verbatim:
 *   1. On mount, if TOS already accepted and current version unseen, open modal.
 *   2. Subscribe to `tosAccepted` event for first-time acceptance.
 *   3. Run the SW update checker; surface a dismissible banner when an update
 *      is available; "Apply" forces a hard reload.
 */
function pickChangelog() {
  const dynamic = generateWhatsNewChangelog();
  if (dynamic && dynamic.changelog.length > 0) {
    return dynamic.changelog;
  }
  const versionUpdate = changelogData.updates.find(
    (u) => u.version === APP_VERSION,
  );
  return versionUpdate?.changelog?.length ? versionUpdate.changelog : null;
}

export function useUpdateOrchestrator() {
  const [updateAvailable, setUpdateAvailable] = useState(null);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [currentChangelog, setCurrentChangelog] = useState([]);

  // On mount: if TOS was previously accepted and the current version hasn't
  // been seen yet, surface the What's New modal immediately. Also start the
  // service-worker update checker.
  useEffect(() => {
    const tosAccepted = localStorage.getItem("vet-rate-tos-accepted");
    const lastSeenVersion = localStorage.getItem(LAST_SEEN_VERSION_KEY);

    if (tosAccepted && lastSeenVersion !== APP_VERSION) {
      // eslint-disable-next-line no-console
      console.log(
        `📰 New version detected: ${APP_VERSION} (last seen: ${lastSeenVersion || "none"})`,
      );
      const changelog = pickChangelog();
      if (changelog) {
        setCurrentChangelog(changelog);
        setShowWhatsNew(true);
      }
      localStorage.setItem(LAST_SEEN_VERSION_KEY, APP_VERSION);
    }

    startUpdateChecker((updateInfo) => {
      // eslint-disable-next-line no-console
      console.log("🆕 Update available:", updateInfo);
      setUpdateAvailable(updateInfo);
      setShowUpdateBanner(true);
    });

    return () => stopUpdateChecker();
  }, []);

  // Listen for first-time TOS acceptance — show What's New for new users too.
  useEffect(() => {
    const handleTosAccepted = () => {
      const lastSeenVersion = localStorage.getItem(LAST_SEEN_VERSION_KEY);
      if (lastSeenVersion === APP_VERSION) return;

      // eslint-disable-next-line no-console
      console.log(
        `📰 TOS accepted - showing What's New for version ${APP_VERSION}`,
      );
      const changelog = pickChangelog();
      if (changelog) {
        setCurrentChangelog(changelog);
        setShowWhatsNew(true);
      }
      localStorage.setItem(LAST_SEEN_VERSION_KEY, APP_VERSION);
    };

    window.addEventListener("tosAccepted", handleTosAccepted);
    return () => window.removeEventListener("tosAccepted", handleTosAccepted);
  }, []);

  const updateBanner =
    showUpdateBanner && updateAvailable ? (
      <UpdateBanner
        onApplyUpdate={() => applyUpdate()}
        onDismiss={() => setShowUpdateBanner(false)}
        updateInfo={updateAvailable}
      />
    ) : null;

  const whatsNewModal =
    showWhatsNew && currentChangelog.length > 0 ? (
      <WhatsNewModal
        changelog={currentChangelog}
        version={APP_VERSION}
        onClose={() => setShowWhatsNew(false)}
      />
    ) : null;

  return { whatsNewOpen: showWhatsNew, updateBanner, whatsNewModal };
}
