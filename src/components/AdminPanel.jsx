/**
 * Vet-Rate.org - Admin Panel Component
 * Unified admin dashboard for managing bug reports and feature requests
 *
 * Security Features:
 * - Only accessible after authentication
 * - Session timeout display
 * - Logout button always visible
 * - Audit log viewer
 *
 * This component is ONLY shown to authenticated admins.
 *
 * Built by a fellow veteran. "Command and control for the mission."
 */

import { useState, useEffect } from "react";
import { useAdminAuth, getAuthAuditLog } from "../contexts/AdminAuthContext";
import { useBodyScrollLock } from "../utils/useBodyScrollLock";
import {
  Shield,
  Bug,
  Lightbulb,
  LogOut,
  Clock,
  User,
  History,
  X,
  ChevronRight,
  Settings,
  RefreshCw,
} from "lucide-react";

// Import lookup components
import BugLookup from "./BugLookup";
import FeatureLookup from "./FeatureLookup";

// Import storage utilities for stats
import { getBugStatistics } from "../utils/bugReportStorage";
import { getFeatureStatistics } from "../utils/featureRequestStorage";

function formatTime(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

async function loadAdminStats(setBugStats, setFeatureStats) {
  try {
    const bugs = await getBugStatistics();
    const features = await getFeatureStatistics();
    setBugStats(bugs);
    setFeatureStats(features);
  } catch (error) {
    console.error("Failed to load stats:", error);
  }
}

function loadAdminAuditLog(setAuditLog) {
  const log = getAuthAuditLog();
  setAuditLog(log);
}

function useLoadDashboardDataOnOpen(
  showAdminPanel,
  isAuthenticated,
  setBugStats,
  setFeatureStats,
  setAuditLog,
) {
  useEffect(() => {
    if (showAdminPanel && isAuthenticated) {
      loadAdminStats(setBugStats, setFeatureStats);
      loadAdminAuditLog(setAuditLog);
    }
  }, [
    showAdminPanel,
    isAuthenticated,
    setBugStats,
    setFeatureStats,
    setAuditLog,
  ]);
}

function useSessionCountdown(
  showAdminPanel,
  sessionExpiry,
  setSessionTimeLeft,
) {
  useEffect(() => {
    if (!showAdminPanel || !sessionExpiry) return;

    const updateTimer = () => {
      const remaining = Math.max(0, sessionExpiry - Date.now());
      setSessionTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [showAdminPanel, sessionExpiry, setSessionTimeLeft]);
}

function getActivityDotColor(event) {
  if (event.includes("SUCCESS")) return "bg-green-500";
  if (event.includes("FAILED") || event.includes("LOCKED")) return "bg-red-500";
  return "bg-blue-500";
}

function getAuditBadgeClass(event) {
  if (event.includes("SUCCESS")) return "bg-green-500/20 text-green-400";
  if (event.includes("FAILED") || event.includes("LOCKED"))
    return "bg-red-500/20 text-red-400";
  if (event.includes("LOGOUT")) return "bg-orange-500/20 text-orange-400";
  return "bg-blue-500/20 text-blue-400";
}

function PanelHeader({ currentAdmin, sessionTimeLeft, onLogout, onClose }) {
  return (
    <header className="bg-slate-900 border-b border-slate-700 px-4 py-3 flex-shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 rounded-lg">
            <Shield className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">
              Admin Control Panel
            </h1>
            <p className="text-xs text-slate-400">
              Logged in as:{" "}
              <span className="text-amber-400">{currentAdmin?.name}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Session Timer */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
              sessionTimeLeft < 300000
                ? "bg-red-500/20 text-red-400"
                : "bg-slate-800 text-slate-300"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span className="font-mono text-sm">
              {formatTime(sessionTimeLeft)}
            </span>
          </div>

          {/* Logout Button */}
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white transition-colors"
            aria-label="Close Panel (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

function BugReportsCard({ bugStats, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-left hover:bg-slate-800 hover:border-slate-600 transition-all group"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 bg-red-500/20 rounded-lg">
          <Bug className="w-6 h-6 text-red-400" />
        </div>
        <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
      </div>
      <h3 className="text-2xl font-bold text-white">{bugStats?.total || 0}</h3>
      <p className="text-slate-400 text-sm">Bug Reports</p>
      <div className="mt-2 flex gap-2">
        <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded">
          {bugStats?.unresolved || 0} unresolved
        </span>
      </div>
    </button>
  );
}

function FeatureRequestsCard({ featureStats, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-left hover:bg-slate-800 hover:border-slate-600 transition-all group"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 bg-purple-500/20 rounded-lg">
          <Lightbulb className="w-6 h-6 text-purple-400" />
        </div>
        <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
      </div>
      <h3 className="text-2xl font-bold text-white">
        {featureStats?.total || 0}
      </h3>
      <p className="text-slate-400 text-sm">Feature Requests</p>
      <div className="mt-2 flex gap-2">
        <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
          {featureStats?.byStatus?.new || 0} new
        </span>
      </div>
    </button>
  );
}

function AuditLogCard({ auditLog, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-left hover:bg-slate-800 hover:border-slate-600 transition-all group"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 bg-amber-500/20 rounded-lg">
          <History className="w-6 h-6 text-amber-400" />
        </div>
        <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
      </div>
      <h3 className="text-2xl font-bold text-white">{auditLog.length}</h3>
      <p className="text-slate-400 text-sm">Audit Events</p>
      <div className="mt-2">
        <span className="text-xs text-slate-500">Session activity log</span>
      </div>
    </button>
  );
}

function AdminInfoCard({ currentAdmin }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 bg-green-500/20 rounded-lg">
          <User className="w-6 h-6 text-green-400" />
        </div>
      </div>
      <h3 className="text-lg font-bold text-white truncate">
        {currentAdmin?.name}
      </h3>
      <p className="text-slate-400 text-sm truncate">{currentAdmin?.email}</p>
      <div className="mt-2">
        <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded capitalize">
          {currentAdmin?.role?.replace("_", " ")}
        </span>
      </div>
    </div>
  );
}

function QuickStatsGrid({
  bugStats,
  featureStats,
  auditLog,
  currentAdmin,
  onNavigate,
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <BugReportsCard bugStats={bugStats} onClick={() => onNavigate("bugs")} />
      <FeatureRequestsCard
        featureStats={featureStats}
        onClick={() => onNavigate("features")}
      />
      <AuditLogCard auditLog={auditLog} onClick={() => onNavigate("audit")} />
      <AdminInfoCard currentAdmin={currentAdmin} />
    </div>
  );
}

function QuickActionsPanel({ onNavigate, onRefreshStats }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
      <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <Settings className="w-5 h-5 text-slate-400" />
        Quick Actions
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={() => onNavigate("bugs")}
          className="flex flex-col items-center gap-2 p-4 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors"
        >
          <Bug className="w-6 h-6 text-red-400" />
          <span className="text-sm text-white">View Bugs</span>
        </button>
        <button
          onClick={() => onNavigate("features")}
          className="flex flex-col items-center gap-2 p-4 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors"
        >
          <Lightbulb className="w-6 h-6 text-purple-400" />
          <span className="text-sm text-white">View Features</span>
        </button>
        <button
          onClick={onRefreshStats}
          className="flex flex-col items-center gap-2 p-4 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors"
        >
          <RefreshCw className="w-6 h-6 text-blue-400" />
          <span className="text-sm text-white">Refresh Stats</span>
        </button>
        <button
          onClick={() => onNavigate("audit")}
          className="flex flex-col items-center gap-2 p-4 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors"
        >
          <History className="w-6 h-6 text-amber-400" />
          <span className="text-sm text-white">View Audit Log</span>
        </button>
      </div>
    </div>
  );
}

function RecentActivityEntry({ entry }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 bg-slate-700/30 rounded-lg">
      <div className="flex items-center gap-3">
        <span
          className={`w-2 h-2 rounded-full ${getActivityDotColor(entry.event)}`}
        />
        <span className="text-white text-sm">{entry.event}</span>
      </div>
      <span className="text-slate-500 text-xs">
        {new Date(entry.timestamp).toLocaleTimeString()}
      </span>
    </div>
  );
}

function RecentActivityPanel({ auditLog }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
      <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <History className="w-5 h-5 text-slate-400" />
        Recent Session Activity
      </h2>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {auditLog.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">
            No activity logged yet
          </p>
        ) : (
          auditLog
            .slice(0, 10)
            .map((entry, idx) => (
              <RecentActivityEntry key={idx} entry={entry} />
            ))
        )}
      </div>
    </div>
  );
}

function SecurityNoticeBanner() {
  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <Shield className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-amber-400 font-medium text-sm">
            Security Reminder
          </p>
          <p className="text-amber-300/70 text-xs mt-1">
            You are accessing sensitive admin functions. All actions are logged.
            Session will automatically expire after 30 minutes of inactivity.
            Always logout when finished.
          </p>
        </div>
      </div>
    </div>
  );
}

function DashboardView({
  bugStats,
  featureStats,
  auditLog,
  currentAdmin,
  onNavigate,
  onRefreshStats,
}) {
  return (
    <>
      {/* Quick Stats */}
      <QuickStatsGrid
        bugStats={bugStats}
        featureStats={featureStats}
        auditLog={auditLog}
        currentAdmin={currentAdmin}
        onNavigate={onNavigate}
      />

      {/* Quick Actions */}
      <QuickActionsPanel
        onNavigate={onNavigate}
        onRefreshStats={onRefreshStats}
      />

      {/* Recent Activity */}
      <RecentActivityPanel auditLog={auditLog} />

      {/* Security Notice */}
      <SecurityNoticeBanner />
    </>
  );
}

function AuditLogEntryRow({ entry }) {
  return (
    <div className="flex items-start justify-between py-3 px-4 bg-slate-700/30 rounded-lg">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${getAuditBadgeClass(entry.event)}`}
          >
            {entry.event}
          </span>
          {entry.adminId && (
            <span className="text-slate-500 text-xs">{entry.adminId}</span>
          )}
        </div>
        {entry.reason && (
          <p className="text-slate-400 text-xs mt-1">Reason: {entry.reason}</p>
        )}
      </div>
      <span className="text-slate-500 text-xs whitespace-nowrap">
        {new Date(entry.timestamp).toLocaleString()}
      </span>
    </div>
  );
}

function AuditLogView({ auditLog, onBack }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <History className="w-5 h-5 text-amber-400" />
          Session Audit Log
        </h2>
        <button
          onClick={onBack}
          className="text-slate-400 hover:text-white transition-colors"
        >
          ← Back to Dashboard
        </button>
      </div>
      <div className="p-6">
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {auditLog.length === 0 ? (
            <p className="text-slate-500 text-center py-8">
              No audit events recorded
            </p>
          ) : (
            auditLog.map((entry, idx) => (
              <AuditLogEntryRow key={idx} entry={entry} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const {
    showAdminPanel,
    closeAdminPanel,
    logout,
    currentAdmin,
    sessionExpiry,
    isAuthenticated,
  } = useAdminAuth();

  useBodyScrollLock(showAdminPanel);

  const [activeView, setActiveView] = useState("dashboard"); // dashboard, bugs, features, audit, settings
  const [bugStats, setBugStats] = useState(null);
  const [featureStats, setFeatureStats] = useState(null);
  const [sessionTimeLeft, setSessionTimeLeft] = useState(0);
  const [auditLog, setAuditLog] = useState([]);

  useLoadDashboardDataOnOpen(
    showAdminPanel,
    isAuthenticated,
    setBugStats,
    setFeatureStats,
    setAuditLog,
  );
  useSessionCountdown(showAdminPanel, sessionExpiry, setSessionTimeLeft);

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      logout("Manual logout");
    }
  };

  if (!showAdminPanel || !isAuthenticated) return null;

  // Render full-screen bug/feature lookup if selected
  if (activeView === "bugs") {
    return <BugLookup onClose={() => setActiveView("dashboard")} />;
  }

  if (activeView === "features") {
    return <FeatureLookup onClose={() => setActiveView("dashboard")} />;
  }

  return (
    <div className="fixed inset-0 bg-slate-950 z-[150] overflow-hidden flex flex-col">
      {/* Header */}
      <PanelHeader
        currentAdmin={currentAdmin}
        sessionTimeLeft={sessionTimeLeft}
        onLogout={handleLogout}
        onClose={closeAdminPanel}
      />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Dashboard View */}
          {activeView === "dashboard" && (
            <DashboardView
              bugStats={bugStats}
              featureStats={featureStats}
              auditLog={auditLog}
              currentAdmin={currentAdmin}
              onNavigate={setActiveView}
              onRefreshStats={() =>
                loadAdminStats(setBugStats, setFeatureStats)
              }
            />
          )}

          {/* Audit Log View */}
          {activeView === "audit" && (
            <AuditLogView
              auditLog={auditLog}
              onBack={() => setActiveView("dashboard")}
            />
          )}
        </div>
      </main>
    </div>
  );
}
