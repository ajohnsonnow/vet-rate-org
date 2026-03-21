/**
 * Easter Eggs - Vet-Rate.org Stress Relief Division
 *
 * "Section 9.4: Behavioral Stress-Testing Hook (Experimental)"
 *
 * Purpose: To validate client-side WebAssembly (WASM) performance and
 * input-latency under high CPU/GPU loads, while providing a therapeutic
 * break for veterans navigating the claims process.
 *
 * Trigger: IDDQD (the classic Doom god-mode cheat)
 *
 * @see https://doomwiki.org/wiki/IDDQD
 */

import { useState, useEffect, useCallback } from "react";

/**
 * Classic cheat codes that trigger easter eggs
 */
export const CHEAT_CODES = {
  IDDQD: "iddqd", // God Mode - Main trigger for Doom
  IDKFA: "idkfa", // All keys & weapons - Could trigger weapon select screen
  KONAMI: [
    "ArrowUp",
    "ArrowUp",
    "ArrowDown",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowLeft",
    "ArrowRight",
    "b",
    "a",
  ],
};

/**
 * Hook to detect IDDQD cheat code input
 *
 * @returns {Object} { isActive, deactivate, activationCount }
 */
export const useIDDQD = () => {
  const [isActive, setIsActive] = useState(false);
  const [activationCount, setActivationCount] = useState(0);
  const [inputBuffer, setInputBuffer] = useState("");

  useEffect(() => {
    const handleKeydown = (e) => {
      // Only process single character keys
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        setInputBuffer((prev) => {
          const newBuffer = (prev + e.key.toLowerCase()).slice(-5);

          if (newBuffer === CHEAT_CODES.IDDQD) {
            console.log("🔫 IDDQD ACTIVATED - Stress Relief Division Online");
            setIsActive(true);
            setActivationCount((c) => c + 1);

            // Play simple activation beep (no external file needed)
            try {
              const audioContext = new (
                window.AudioContext || window.webkitAudioContext
              )();
              const oscillator = audioContext.createOscillator();
              const gainNode = audioContext.createGain();

              oscillator.connect(gainNode);
              gainNode.connect(audioContext.destination);

              oscillator.frequency.value = 800; // 800Hz beep
              gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
              gainNode.gain.exponentialRampToValueAtTime(
                0.01,
                audioContext.currentTime + 0.2,
              );

              oscillator.start(audioContext.currentTime);
              oscillator.stop(audioContext.currentTime + 0.2);
            } catch (e) {
              // No sound, no problem
            }

            return "";
          }

          return newBuffer;
        });
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  const deactivate = useCallback(() => {
    setIsActive(false);
    setInputBuffer("");
  }, []);

  return { isActive, deactivate, activationCount };
};

/**
 * Hook to detect Konami code
 * ↑↑↓↓←→←→BA
 *
 * @returns {Object} { isTriggered, reset }
 */
export const useKonamiCode = () => {
  const [isTriggered, setIsTriggered] = useState(false);
  const [sequence, setSequence] = useState([]);

  useEffect(() => {
    const handleKeydown = (e) => {
      setSequence((prev) => {
        const newSeq = [...prev, e.key].slice(-10);

        if (JSON.stringify(newSeq) === JSON.stringify(CHEAT_CODES.KONAMI)) {
          console.log("🎮 KONAMI CODE ACTIVATED");
          setIsTriggered(true);
          return [];
        }

        return newSeq;
      });
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  const reset = useCallback(() => {
    setIsTriggered(false);
    setSequence([]);
  }, []);

  return { isTriggered, reset };
};

/**
 * Hook for Xbox/PlayStation controller support via Gamepad API
 * Maps controller inputs to keyboard events for WASM compatibility
 *
 * @param {boolean} isActive - Whether to poll the gamepad
 * @returns {Object} { isConnected, controllerName }
 */
export const useGamepadBridge = (isActive) => {
  const [isConnected, setIsConnected] = useState(false);
  const [controllerName, setControllerName] = useState("");

  useEffect(() => {
    if (!isActive) return;

    let animationId;
    let lastButtonState = {};

    const BUTTON_MAP = {
      0: " ", // A/X → Space (Use/Shoot)
      1: "Escape", // B/O → Escape (Menu)
      2: "Tab", // X/□ → Tab (Map)
      3: "Enter", // Y/△ → Enter
      4: "q", // LB → Previous weapon
      5: "e", // RB → Next weapon
      6: "Shift", // LT → Run
      7: "Control", // RT → Fire (alternate)
      12: "ArrowUp", // D-pad Up
      13: "ArrowDown", // D-pad Down
      14: "ArrowLeft", // D-pad Left
      15: "ArrowRight", // D-pad Right
    };

    const dispatchKey = (key, type) => {
      window.dispatchEvent(
        new KeyboardEvent(type, {
          key,
          bubbles: true,
          cancelable: true,
        }),
      );
    };

    const pollGamepad = () => {
      const gamepads = navigator.getGamepads();
      const gp = gamepads[0] || gamepads[1] || gamepads[2] || gamepads[3];

      if (gp) {
        if (!isConnected) {
          setIsConnected(true);
          setControllerName(gp.id);
          console.log("🎮 Controller connected:", gp.id);
        }

        // Handle buttons
        gp.buttons.forEach((button, index) => {
          const key = BUTTON_MAP[index];
          if (!key) return;

          const wasPressed = lastButtonState[index];
          const isPressed = button.pressed;

          if (isPressed && !wasPressed) {
            dispatchKey(key, "keydown");
          } else if (!isPressed && wasPressed) {
            dispatchKey(key, "keyup");
          }

          lastButtonState[index] = isPressed;
        });

        // Handle left stick for movement (with deadzone)
        const DEADZONE = 0.3;
        const leftX = gp.axes[0];
        const leftY = gp.axes[1];

        if (leftY < -DEADZONE) dispatchKey("ArrowUp", "keydown");
        else dispatchKey("ArrowUp", "keyup");

        if (leftY > DEADZONE) dispatchKey("ArrowDown", "keydown");
        else dispatchKey("ArrowDown", "keyup");

        if (leftX < -DEADZONE) dispatchKey("ArrowLeft", "keydown");
        else dispatchKey("ArrowLeft", "keyup");

        if (leftX > DEADZONE) dispatchKey("ArrowRight", "keydown");
        else dispatchKey("ArrowRight", "keyup");
      } else if (isConnected) {
        setIsConnected(false);
        setControllerName("");
      }

      animationId = requestAnimationFrame(pollGamepad);
    };

    animationId = requestAnimationFrame(pollGamepad);

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [isActive, isConnected]);

  return { isConnected, controllerName };
};

/**
 * Performance monitoring for the WASM engine
 */
export const useDoomPerformance = (isActive) => {
  const [fps, setFps] = useState(0);
  const [frameTime, setFrameTime] = useState(0);

  useEffect(() => {
    if (!isActive) return;

    let lastTime = performance.now();
    let frameCount = 0;
    let animationId;

    const measureFps = () => {
      const now = performance.now();
      frameCount++;

      if (now - lastTime >= 1000) {
        setFps(frameCount);
        setFrameTime(Math.round(((now - lastTime) / frameCount) * 100) / 100);
        frameCount = 0;
        lastTime = now;
      }

      animationId = requestAnimationFrame(measureFps);
    };

    animationId = requestAnimationFrame(measureFps);

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [isActive]);

  return { fps, frameTime };
};

export default {
  useIDDQD,
  useKonamiCode,
  useGamepadBridge,
  useDoomPerformance,
  CHEAT_CODES,
};
