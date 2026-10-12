import QuickExitButton from "./QuickExitButton";

/**
 * Shown instead of the app when the browser blocks site storage. It needs no
 * providers (they read storage on their first render, which is what threw), and
 * carries its own Quick Exit button; main.jsx also starts the triple-Escape
 * panic key before rendering it.
 */
const StorageBlockedNotice = () => (
  <main
    id="main-content"
    className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-12 text-gray-900"
  >
    <QuickExitButton position="top-right" variant="subtle" />
    <h1 className="mb-4 text-2xl font-bold">
      This browser is blocking storage
    </h1>
    <p className="mb-3 text-base">
      This app stores your information only on this device, and this browser is
      blocking storage, so it cannot run here. Nothing you do on this page can
      be saved.
    </p>
    <p className="mb-3 text-base">
      To use it, allow this site to save data in your browser&apos;s cookie and
      site-data settings, or open it in a regular (not private) window, then
      reload this page.
    </p>
    <p className="text-sm text-gray-700">
      To leave this page right away, use the exit button at the top of the
      screen or press Escape three times.
    </p>
  </main>
);

export default StorageBlockedNotice;
