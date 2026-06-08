/**
 * Maintenance kill-switch page. Rendered by App.jsx when `version.json`
 * reports `maintenance_mode: true` so the app shows an explanation instead
 * of attempting to run during outages or migrations.
 *
 * Pure render; state + fetch stay in App.jsx because the maintenance check
 * gates the IndexedDB migration (must await maintenance before starting any
 * data writes).
 *
 * Extracted from App.jsx (audit #35, B29).
 */
export default function MaintenancePage({ message }) {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-gray-800 border-2 border-yellow-500 rounded-lg p-8 text-center">
        <div className="mb-6">
          <span className="text-6xl">🛠️</span>
        </div>
        <h1 className="text-3xl font-bold text-yellow-400 mb-4">
          Maintenance Mode
        </h1>
        <p className="text-gray-300 text-lg mb-6">{message}</p>
        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded p-4 text-sm text-gray-300">
          <p className="font-semibold text-yellow-400 mb-2">
            What does this mean?
          </p>
          <p>
            Vet-Rate.org has been temporarily taken offline to protect your data
            and ensure system integrity. This is a precautionary measure and
            your saved claims are safe.
          </p>
        </div>
        <div className="mt-6 text-gray-400 text-sm">
          <p>Having an emergency? Contact the Veterans Crisis Line:</p>
          <p className="text-xl font-bold text-red-400 mt-2">988 (Press 1)</p>
        </div>
      </div>
    </div>
  );
}
