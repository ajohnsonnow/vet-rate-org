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

import { useState, useEffect, useCallback, useRef } from "react";

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
function _playActivationBeep() {
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
    // eslint-disable-next-line sonarjs/no-ignored-exceptions -- decorative beep on an easter egg; WebAudio unsupported/blocked is expected on some browsers and not worth surfacing
  } catch {
    // No sound, no problem
  }
}

function _processIddqdKeydown(prev, key, setIsActive, setActivationCount) {
  const newBuffer = (prev + key.toLowerCase()).slice(-5);

  if (newBuffer === CHEAT_CODES.IDDQD) {
    // eslint-disable-next-line no-console
    console.log("🔫 IDDQD ACTIVATED - Stress Relief Division Online");
    setIsActive(true);
    setActivationCount((c) => c + 1);
    _playActivationBeep();
    return "";
  }

  return newBuffer;
}

export const useIDDQD = () => {
  const [isActive, setIsActive] = useState(false);
  const [activationCount, setActivationCount] = useState(0);
  const inputBufferRef = useRef("");

  useEffect(() => {
    const handleKeydown = (e) => {
      // Only process single character keys
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        inputBufferRef.current = _processIddqdKeydown(
          inputBufferRef.current,
          e.key,
          setIsActive,
          setActivationCount,
        );
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  const deactivate = useCallback(() => {
    setIsActive(false);
    inputBufferRef.current = "";
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
  const sequenceRef = useRef([]);

  useEffect(() => {
    const handleKeydown = (e) => {
      const newSeq = [...sequenceRef.current, e.key].slice(-10);

      if (JSON.stringify(newSeq) === JSON.stringify(CHEAT_CODES.KONAMI)) {
        // eslint-disable-next-line no-console
        console.log("🎮 KONAMI CODE ACTIVATED");
        setIsTriggered(true);
        sequenceRef.current = [];
      } else {
        sequenceRef.current = newSeq;
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  const reset = useCallback(() => {
    setIsTriggered(false);
    sequenceRef.current = [];
  }, []);

  return { isTriggered, reset };
};

const GAMEPAD_BUTTON_MAP = {
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

function _dispatchGamepadKey(key, type) {
  window.dispatchEvent(
    new KeyboardEvent(type, {
      key,
      bubbles: true,
      cancelable: true,
    }),
  );
}

function _handleGamepadButtons(gp, lastButtonState) {
  gp.buttons.forEach((button, index) => {
    const key = GAMEPAD_BUTTON_MAP[index];
    if (!key) return;

    const wasPressed = lastButtonState[index];
    const isPressed = button.pressed;

    if (isPressed && !wasPressed) {
      _dispatchGamepadKey(key, "keydown");
    } else if (!isPressed && wasPressed) {
      _dispatchGamepadKey(key, "keyup");
    }

    lastButtonState[index] = isPressed;
  });
}

function _handleGamepadStick(gp) {
  // Handle left stick for movement (with deadzone)
  const DEADZONE = 0.3;
  const leftX = gp.axes[0];
  const leftY = gp.axes[1];

  if (leftY < -DEADZONE) _dispatchGamepadKey("ArrowUp", "keydown");
  else _dispatchGamepadKey("ArrowUp", "keyup");

  if (leftY > DEADZONE) _dispatchGamepadKey("ArrowDown", "keydown");
  else _dispatchGamepadKey("ArrowDown", "keyup");

  if (leftX < -DEADZONE) _dispatchGamepadKey("ArrowLeft", "keydown");
  else _dispatchGamepadKey("ArrowLeft", "keyup");

  if (leftX > DEADZONE) _dispatchGamepadKey("ArrowRight", "keydown");
  else _dispatchGamepadKey("ArrowRight", "keyup");
}

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
    const lastButtonState = {};

    const pollGamepad = () => {
      const gamepads = navigator.getGamepads();
      const gp = gamepads[0] || gamepads[1] || gamepads[2] || gamepads[3];

      if (gp) {
        if (!isConnected) {
          setIsConnected(true);
          setControllerName(gp.id);
          // eslint-disable-next-line no-console
          console.log("🎮 Controller connected:", gp.id);
        }

        _handleGamepadButtons(gp, lastButtonState);
        _handleGamepadStick(gp);
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
