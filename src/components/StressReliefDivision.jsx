/**
 * 🎮 Stress Relief Division - Doom Easter Egg
 *
 * "Section 9.4: Behavioral Stress-Testing Hook (Experimental)"
 *
 * A WebAssembly-based implementation of the id Tech 1 engine,
 * disguised as a "User Resiliency & High-Load Testing Module"
 * for grant application purposes.
 *
 * Activation: Type "IDDQD" anywhere on the site
 *
 * Legal: Uses shareware DOOM assets which are freely distributable.
 *
 * @author Vet-Rate.org Stress Relief Division
 */

import React, { useState, useEffect, useCallback, Suspense, lazy } from "react";
import {
  useIDDQD,
  useGamepadBridge,
  useDoomPerformance,
} from "../utils/easterEggs";

// Lazy load the heavy iframe only when activated
const DoomFrame = lazy(() =>
  Promise.resolve({
    default: ({ onClose }) => (
      <iframe
        src="https://archive.org/embed/msdos_DOOM_1993"
        title="DOOM - Stress Relief Division"
        className="w-full h-full border-0"
        allow="autoplay; fullscreen; gamepad"
        allowFullScreen
      />
    ),
  }),
);

/**
 * The Retro-Terminal Launcher Component
 * Styled like an old CRT monitor from 1993
 */
const DoomLauncher = ({
  onStart,
  onClose,
  isControllerConnected,
  controllerName,
}) => {
  const [isBooting, setIsBooting] = useState(true);
  const [bootText, setBootText] = useState([]);

  // Simulate boot sequence
  useEffect(() => {
    const bootMessages = [
      "> INITIALIZING VET-RATE DIAGNOSTIC TOOL...",
      "> LOADING WASM BINARY: doom.wasm",
      "> CHECKING SharedArrayBuffer: OK",
      "> DETECTING INPUT DEVICES...",
      isControllerConnected
        ? `> GAMEPAD DETECTED: ${controllerName?.split(" ")[0] || "XBOX"} CONTROLLER`
        : "> NO GAMEPAD DETECTED - KEYBOARD MODE",
      "> LOADING STRESS RELIEF PROTOCOL v1.0",
      "> STATUS: READY",
      "",
      '> TYPE "START" OR PRESS [A] TO BEGIN THERAPY SESSION',
    ];

    let i = 0;
    const interval = setInterval(() => {
      if (i < bootMessages.length) {
        setBootText((prev) => [...prev, bootMessages[i]]);
        i++;
      } else {
        setIsBooting(false);
        clearInterval(interval);
      }
    }, 150);

    return () => clearInterval(interval);
  }, [isControllerConnected, controllerName]);

  return (
    <div className="bg-black p-6 rounded-lg border-4 border-green-800 shadow-[0_0_30px_rgba(0,255,0,0.4),inset_0_0_60px_rgba(0,0,0,0.8)] font-mono max-w-2xl mx-auto">
      {/* CRT Screen Effect */}
      <div className="relative overflow-hidden">
        {/* Scanlines */}
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            background:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)",
          }}
        />

        {/* Content */}
        <div className="relative z-0 p-4 min-h-[300px]">
          {/* Header */}
          <div className="text-green-500 text-xl mb-4 animate-pulse flex items-center gap-2">
            <span className="text-red-500">█</span>
            VET-RATE STRESS RELIEF DIVISION
            <span className="text-red-500">█</span>
          </div>

          {/* Boot sequence */}
          <div className="text-green-400 text-sm space-y-1 mb-6">
            {bootText.map((line, i) => (
              <div
                key={i}
                className={
                  line?.includes?.("READY") ? "text-green-300 font-bold" : ""
                }
              >
                {line || ""}
              </div>
            ))}
            {isBooting && <span className="animate-pulse">▌</span>}
          </div>

          {/* Disclaimer */}
          {!isBooting && (
            <div className="bg-green-950/50 p-4 mb-6 border border-green-600 text-xs text-green-300">
              <p className="font-bold mb-2 text-yellow-400">
                ** LEGAL DISCLAIMER **
              </p>
              <p>
                Pursuant to the Articles of Incorporation for Vet-Rate.org, this
                "Stress Reduction Module" is intended for therapeutic
                demon-slaying only. Vet-Rate.org is not liable for any
                productivity loss, sudden urges to hunt for blue keycards, or
                delayed VA form submissions.
              </p>
              <p className="mt-2 text-green-400">
                By pressing START, you acknowledge that demon-slaying is a
                recognized (though totally unofficial) form of therapeutic
                relief.
              </p>
            </div>
          )}

          {/* Buttons */}
          {!isBooting && (
            <div className="flex gap-4">
              <button
                onClick={onStart}
                className="flex-1 bg-green-600 text-black font-bold py-3 px-6 hover:bg-green-400 transition-all duration-200 border-2 border-green-400 shadow-[0_0_10px_rgba(0,255,0,0.5)] hover:shadow-[0_0_20px_rgba(0,255,0,0.8)]"
              >
                ▶ INITIATE RELIEF PROTOCOL
              </button>
              <button
                onClick={onClose}
                className="bg-red-900 text-red-300 font-bold py-3 px-6 hover:bg-red-700 transition-all duration-200 border-2 border-red-600"
              >
                ✕ ABORT
              </button>
            </div>
          )}

          {/* Controller status */}
          <div className="mt-4 text-xs text-green-600 flex justify-between">
            <span>
              {isControllerConnected
                ? `🎮 ${controllerName?.split(" ")[0] || "CONTROLLER"}: READY`
                : "⌨️ KEYBOARD MODE"}
            </span>
            <span>DOOM v1.9 SHAREWARE</span>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Main Doom Container Component
 * Handles the full lifecycle of the easter egg
 */
const StressReliefDivision = () => {
  const { isActive, deactivate, activationCount } = useIDDQD();
  const [gameStarted, setGameStarted] = useState(false);
  const [showGlitch, setShowGlitch] = useState(false);
  const { isConnected: isControllerConnected, controllerName } =
    useGamepadBridge(isActive);
  const { fps } = useDoomPerformance(gameStarted);

  // Trigger glitch effect on activation
  useEffect(() => {
    if (isActive && activationCount > 0) {
      setShowGlitch(true);
      setTimeout(() => setShowGlitch(false), 300);
    }
  }, [isActive, activationCount]);

  // Handle escape key to close
  useEffect(() => {
    if (!isActive) return;

    const handleEscape = (e) => {
      if (e.key === "Escape" && !gameStarted) {
        deactivate();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isActive, gameStarted, deactivate]);

  const handleClose = useCallback(() => {
    setGameStarted(false);
    deactivate();
  }, [deactivate]);

  const handleStart = useCallback(() => {
    setGameStarted(true);
  }, []);

  if (!isActive) return null;

  return (
    <>
      {/* CRT Glitch Effect Overlay */}
      {showGlitch && (
        <div
          className="fixed inset-0 z-[9998] pointer-events-none animate-crt-glitch"
          style={{
            background:
              "linear-gradient(rgba(255,0,0,0.1), rgba(0,255,0,0.1), rgba(0,0,255,0.1))",
            mixBlendMode: "overlay",
          }}
        />
      )}

      {/* Main Overlay */}
      <div
        className={`fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center p-4 transition-opacity duration-300 ${showGlitch ? "animate-crt-glitch" : ""}`}
        role="dialog"
        aria-label="Stress Relief Division - Doom Easter Egg"
      >
        {/* Header with close button */}
        <div className="absolute top-4 right-4 flex items-center gap-4">
          {gameStarted && (
            <span className="text-green-500 font-mono text-sm">
              {fps > 0 ? `${fps} FPS` : "LOADING..."}
            </span>
          )}
          <button
            onClick={handleClose}
            className="text-red-500 hover:text-red-300 font-mono text-2xl transition-colors"
            title="Exit Stress Relief (ESC)"
          >
            [X] EXIT
          </button>
        </div>

        {/* Watermark */}
        <div className="absolute bottom-4 left-4 text-green-900/50 font-mono text-xs">
          VET-RATE.ORG • STRESS RELIEF DIVISION • THERAPEUTIC USE ONLY
        </div>

        {/* Content */}
        {!gameStarted ? (
          <DoomLauncher
            onStart={handleStart}
            onClose={handleClose}
            isControllerConnected={isControllerConnected}
            controllerName={controllerName}
          />
        ) : (
          <div className="w-full max-w-4xl aspect-[4/3] bg-black border-4 border-green-800 shadow-[0_0_30px_rgba(0,255,0,0.3)]">
            <Suspense
              fallback={
                <div className="w-full h-full flex items-center justify-center text-green-500 font-mono animate-pulse">
                  LOADING DEMON-SLAYER MODE...
                </div>
              }
            >
              <DoomFrame onClose={handleClose} />
            </Suspense>
          </div>
        )}

        {/* Instructions */}
        {gameStarted && (
          <div className="mt-4 text-green-600 font-mono text-xs text-center max-w-xl">
            <p>
              CONTROLS: Arrow Keys = Move | Ctrl = Fire | Space = Use/Open |
              Shift = Run
            </p>
            <p className="mt-1 text-green-800">
              Press ESC inside game for menu • Click game area to capture input
            </p>
          </div>
        )}
      </div>

      {/* Inject CRT glitch keyframes */}
      <style>{`
        @keyframes crt-glitch {
          0% { transform: translate(0); }
          20% { transform: translate(-5px, 5px); filter: hue-rotate(90deg); }
          40% { transform: translate(-5px, -5px); filter: hue-rotate(180deg); }
          60% { transform: translate(5px, 5px); filter: hue-rotate(270deg); }
          80% { transform: translate(5px, -5px); filter: hue-rotate(360deg); }
          100% { transform: translate(0); filter: hue-rotate(0deg); }
        }
        .animate-crt-glitch {
          animation: crt-glitch 0.3s cubic-bezier(.25, .46, .45, .94) both;
        }
      `}</style>
    </>
  );
};

export default StressReliefDivision;
