/**
 * Vet-Rate.org - PWA Install Button
 *
 * Allows users to install Vet-Rate as a native-feeling app on their device.
 * Shows up only when the browser supports installation.
 *
 * Built by a fellow veteran. "Your field manual, always accessible."
 */

import { useState, useEffect } from "react";
import { Download, X, Smartphone } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import ResponsiveModal from "./common/ResponsiveModal";

const IOSInstallInstructions = ({ onClose }) => (
  <ResponsiveModal isOpen onClose={onClose} title="Install on iOS" size="sm">
    <div className="space-y-4">
      <p className="text-sm text-gray-700 dark:text-gray-300">
        To install Vet-Rate.org on your iPhone or iPad:
      </p>

      <ol className="space-y-3 text-sm text-gray-800 dark:text-gray-200">
        <li className="flex gap-3">
          <span className="font-bold text-blue-600 dark:text-blue-400 flex-shrink-0">
            1.
          </span>
          <span>
            Tap the <strong>Share</strong> button{" "}
            <span className="text-2xl">⎋</span> at the bottom of Safari
          </span>
        </li>
        <li className="flex gap-3">
          <span className="font-bold text-blue-600 dark:text-blue-400 flex-shrink-0">
            2.
          </span>
          <span>
            Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong>{" "}
            <span className="text-xl">➕</span>
          </span>
        </li>
        <li className="flex gap-3">
          <span className="font-bold text-blue-600 dark:text-blue-400 flex-shrink-0">
            3.
          </span>
          <span>
            Tap <strong>&quot;Add&quot;</strong> in the top right corner
          </span>
        </li>
      </ol>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4 dark:border-blue-800 dark:bg-blue-950/40">
        <p className="text-xs text-blue-900 dark:text-blue-200">
          <strong>Note:</strong> This only works in Safari browser, not Chrome
          or other browsers on iOS.
        </p>
      </div>
    </div>
  </ResponsiveModal>
);

const InstallPromptBanner = ({ className, isIOS, onDismiss, onInstall }) => (
  <div className={`pwa-install-prompt ${className}`}>
    {/* Desktop/Floating button */}
    <div
      className="fixed bottom-4 right-4 z-40 max-w-sm hidden md:block"
      role="region"
      aria-label="Install Vet-Rate"
    >
      <div className="relative bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg shadow-2xl p-4">
        <button
          onClick={onDismiss}
          aria-label="Dismiss install prompt"
          className="absolute top-2 right-2 text-white hover:text-gray-200"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-3 pr-6">
          <Smartphone className="w-8 h-8 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h4 className="font-bold text-lg mb-1">Install Vet-Rate</h4>
            <p className="text-sm text-blue-100 mb-3">
              Access your field manual offline. Works without internet.
            </p>
            <button
              onClick={onInstall}
              className="w-full bg-white text-blue-700 font-bold py-2 px-4 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Install to Home Screen
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* Mobile banner */}
    <div
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
      role="status"
      aria-live="polite"
    >
      <div className="relative bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 shadow-2xl">
        <button
          onClick={onDismiss}
          aria-label="Dismiss install prompt"
          className="absolute top-2 right-2 text-white hover:text-gray-200"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="pr-8">
          <div className="flex items-center gap-2 mb-2">
            <Smartphone className="w-6 h-6" />
            <h4 className="font-bold">Install Vet-Rate</h4>
          </div>
          <p className="text-sm text-blue-100 mb-3">
            Add to your home screen for offline access
          </p>
          <button
            onClick={onInstall}
            className="w-full bg-white text-blue-700 font-bold py-2 px-4 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            {isIOS ? "See Instructions" : "Install App"}
          </button>
        </div>
      </div>
    </div>
  </div>
);

const usePWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // Check if iOS
    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(ios);

    // Listen for the beforeinstallprompt event (Android/Chrome)
    const handleBeforeInstallPrompt = (e) => {
      // Prevent the default browser install prompt
      e.preventDefault();
      // Save the event for later use
      setDeferredPrompt(e);
      // Show our custom install button
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Listen for successful installation
    const handleAppInstalled = () => {
      // eslint-disable-next-line no-console
      console.log("PWA was installed");
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  return {
    deferredPrompt,
    setDeferredPrompt,
    showPrompt,
    setShowPrompt,
    isInstalled,
    isIOS,
  };
};

const PWAInstallButton = ({ className = "" }) => {
  const { _t } = useLanguage();
  const {
    deferredPrompt,
    setDeferredPrompt,
    showPrompt,
    setShowPrompt,
    isInstalled,
    isIOS,
  } = usePWAInstallPrompt();
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // If no prompt available but on iOS, show instructions
      if (isIOS) {
        setShowIOSInstructions(true);
      }
      return;
    }

    // Show the browser's install prompt
    deferredPrompt.prompt();

    // Wait for the user's response
    const { outcome } = await deferredPrompt.userChoice;
    // eslint-disable-next-line no-console
    console.log(`User response to install prompt: ${outcome}`);

    // Clear the saved prompt
    setDeferredPrompt(null);

    if (outcome === "accepted") {
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Remember dismissal for 7 days
    localStorage.setItem("pwa_install_dismissed", Date.now().toString());
  };

  // Don't show if already installed
  if (isInstalled) {
    return null;
  }

  // Check if dismissed recently
  const dismissedTime = localStorage.getItem("pwa_install_dismissed");
  if (dismissedTime) {
    const daysSinceDismissed =
      (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60 * 24);
    if (daysSinceDismissed < 7) {
      return null;
    }
  }

  // iOS Instructions Modal
  if (showIOSInstructions) {
    return (
      <IOSInstallInstructions onClose={() => setShowIOSInstructions(false)} />
    );
  }

  // Show install button/banner
  if (showPrompt || isIOS) {
    return (
      <InstallPromptBanner
        className={className}
        isIOS={isIOS}
        onDismiss={handleDismiss}
        onInstall={handleInstallClick}
      />
    );
  }

  return null;
};

export default PWAInstallButton;
