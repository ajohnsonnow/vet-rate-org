/**
 * Vet-Rate.org - Muster Call AI Loader Hook
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Manual (non-auto-init) loading of the Warrant Council AI swarm used by
 * Muster Call. Extracted from MusterCall.jsx to keep the component under
 * the max-lines-per-function / complexity budget.
 */

import { useState, useCallback, useEffect } from "react";
import { isSwarmReady, initializeSwarm } from "../utils/unifiedAIService";

export const useMusterCallAILoader = (toast) => {
  const [aiReady, setAiReady] = useState(false);
  const [aiInitializing, setAiInitializing] = useState(false);
  const [initProgress, setInitProgress] = useState(0);
  const [initMessage, setInitMessage] = useState("");

  // Check if AI is already ready on mount
  useEffect(() => {
    if (isSwarmReady()) {
      setAiReady(true);
    }
  }, []);

  const handleLoadAI = useCallback(async () => {
    if (aiInitializing || aiReady) return;

    setAiInitializing(true);
    setInitMessage("Initializing CW5 Auditor...");

    try {
      await initializeSwarm("auditor", {
        onProgress: (progress) => {
          setInitProgress(progress.progress || 0);
          setInitMessage(progress.message || "Loading...");
        },
        onComplete: () => {
          setAiReady(true);
          setAiInitializing(false);
          setInitProgress(100);
          setInitMessage("CW5 Auditor ready!");
          toast.success("🎖️ Warrant Council AI loaded and ready!");
        },
        onError: (error) => {
          setAiInitializing(false);
          setInitMessage("Failed to load AI");
          toast.error("Failed to load AI: " + error.message);
        },
      });
    } catch (err) {
      setAiInitializing(false);
      toast.error(
        "Failed to initialize AI: " + (err?.message || "Unknown error"),
      );
    }
  }, [aiInitializing, aiReady, toast]);

  return { aiReady, aiInitializing, initProgress, initMessage, handleLoadAI };
};

export default useMusterCallAILoader;
