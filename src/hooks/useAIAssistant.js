/**
 * useAIAssistant Hook
 * Manages the AI Assistant (Navigator) state and provides easy access
 */

import { useState, useCallback, useEffect } from "react";

export const useAIAssistant = () => {
  const [isOpen, setIsOpen] = useState(() => {
    // Check if user has interacted with assistant before
    const hasUsed = localStorage.getItem("vet_rate_ai_assistant_used");
    // Check if tour has been completed - don't auto-open if tour hasn't been seen
    const tourSeen = localStorage.getItem("vetrate-tour-completed");
    // Auto-open on first visit ONLY if used before AND tour has been seen
    // (prevents Navigator from opening during the tour)
    if (hasUsed && tourSeen) return false;
    return Boolean(hasUsed);
  });

  // Listen for closeNavigator events (from tour)
  useEffect(() => {
    const handleClose = () => setIsOpen(false);
    window.addEventListener("closeNavigator", handleClose);
    return () => window.removeEventListener("closeNavigator", handleClose);
  }, []);

  const [currentTool, setCurrentTool] = useState("Home");

  const open = useCallback((tool = "Home") => {
    setIsOpen(true);
    setCurrentTool(tool);
    localStorage.setItem("vet_rate_ai_assistant_used", "true");
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(
    (tool = "Home") => {
      if (isOpen) {
        close();
      } else {
        open(tool);
      }
    },
    [isOpen, open, close],
  );

  return {
    isOpen,
    currentTool,
    setCurrentTool,
    open,
    close,
    toggle,
  };
};

export default useAIAssistant;
