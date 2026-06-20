/**
 * Vet-Rate.org - The Readiness Gauge (Claim Completeness Tracker)
 *
 * Visual indicator showing how "complete" a veteran's claim packet is.
 * Checks for the "Holy Trinity" of a strong claim:
 * 1. Current Diagnosis (medical evidence)
 * 2. In-Service Event/Stressor (what happened)
 * 3. Nexus Letter (the link between 1 and 2)
 *
 * INTEGRATED with ClaimNavigator - syncs evidence state bidirectionally
 *
 * Built by a fellow veteran. "Know when you're ready to file."
 */

import { useState, useEffect } from "react";
import {
  CheckCircle,
  AlertCircle,
  Circle,
  FileText,
  Stethoscope,
  Link as LinkIcon,
} from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";

// Integration bridge for ClaimNavigator sync
import { getBigThreeStatus } from "../utils/claimIntegration";

const ClaimProgress = ({ conditionCode, conditionName, className = "" }) => {
  // eslint-disable-next-line no-unused-vars
  const { t } = useLanguage();
  const [completeness, setCompleteness] = useState(0);
  const [missingItems, setMissingItems] = useState([]);
  const [checklist, setChecklist] = useState({
    hasDiagnosis: false,
    hasInServiceEvent: false,
    hasNexus: false,
  });

  useEffect(() => {
    calculateCompleteness();

    // Listen for updates from ClaimNavigator
    const handleNavigatorUpdate = (e) => {
      if (e.detail?.type === "evidence_sync") {
        calculateCompleteness();
      }
    };

    // Listen for Big 3 updates from any source
    const handleBigThreeUpdate = () => {
      calculateCompleteness();
    };

    window.addEventListener("claimNavigatorUpdate", handleNavigatorUpdate);
    window.addEventListener("bigThreeUpdate", handleBigThreeUpdate);

    return () => {
      window.removeEventListener("claimNavigatorUpdate", handleNavigatorUpdate);
      window.removeEventListener("bigThreeUpdate", handleBigThreeUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conditionCode, conditionName]);

  const calculateCompleteness = () => {
    if (!conditionCode && !conditionName) {
      setCompleteness(0);
      setMissingItems(["Select a condition to begin"]);
      return;
    }

    // Check localStorage for saved claim data
    const storageKey =
      conditionCode || conditionName?.toLowerCase().replace(/\s+/g, "-");

    // First check if ClaimNavigator has Big 3 data via integration bridge
    const navigatorBig3 = getBigThreeStatus(conditionName || conditionCode);

    // 1. Check for Diagnosis/Medical Description
    const diagnosisKey = `${storageKey}_diagnosis`;
    const medicalDescription = localStorage.getItem(diagnosisKey) || "";

    // A condition saved to My Packet implies a confirmed diagnosis
    let hasSavedClaim = false;
    try {
      const savedClaims = JSON.parse(
        localStorage.getItem("vet_rate_saved_claims") || "[]",
      );
      if (conditionName) {
        hasSavedClaim = savedClaims.some(
          (c) => c.conditionName?.toLowerCase() === conditionName.toLowerCase(),
        );
      }
    } catch (_) { /* navigator lookup may fail in restricted contexts */ }

    const hasDiagnosis =
      navigatorBig3.diagnosis ||
      hasSavedClaim ||
      (medicalDescription && medicalDescription.trim().length > 50);

    // 2. Check for In-Service Event/Stressor
    const eventKey = `${storageKey}_event`;
    const inServiceEvent = localStorage.getItem(eventKey) || "";
    const hasInServiceEvent =
      navigatorBig3.event ||
      (inServiceEvent && inServiceEvent.trim().length > 50);

    // 3. Check for Nexus Letter
    const nexusKey = `${storageKey}_nexus`;
    const nexusLetter = localStorage.getItem(nexusKey) || "";
    const hasNexus =
      navigatorBig3.nexus || (nexusLetter && nexusLetter.trim().length > 100);

    // Update checklist
    setChecklist({
      hasDiagnosis,
      hasInServiceEvent,
      hasNexus,
    });

    // Calculate score
    let score = 0;
    const missing = [];

    if (hasDiagnosis) {
      score += 33;
    } else {
      missing.push({
        icon: Stethoscope,
        label: "Medical Diagnosis/Symptoms",
        description: "Describe your current condition and symptoms in detail",
      });
    }

    if (hasInServiceEvent) {
      score += 33;
    } else {
      missing.push({
        icon: FileText,
        label: "In-Service Event/Stressor",
        description:
          "Document what happened during your service that caused this condition",
      });
    }

    if (hasNexus) {
      score += 34;
    } else {
      missing.push({
        icon: LinkIcon,
        label: "Nexus Letter Draft",
        description:
          "Generate a medical nexus letter linking your condition to service",
      });
    }

    setCompleteness(score);
    setMissingItems(missing);
  };

  // Get color based on completeness
  const getColor = () => {
    if (completeness === 0)
      return {
        stroke: "text-gray-300",
        fill: "text-gray-400",
        bg: "bg-gray-100",
      };
    if (completeness < 50)
      return { stroke: "text-red-500", fill: "text-red-600", bg: "bg-red-50" };
    if (completeness < 100)
      return {
        stroke: "text-yellow-500",
        fill: "text-yellow-600",
        bg: "bg-yellow-50",
      };
    return {
      stroke: "text-green-500",
      fill: "text-green-600",
      bg: "bg-green-50",
    };
  };

  const color = getColor();

  // SVG circle calculations
  const size = 200;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (completeness / 100) * circumference;

  return (
    <div className={`claim-progress ${className}`}>
      {/* Header */}
      <div className="mb-6 text-center">
        <h3 className="text-lg font-bold text-gray-900 mb-1">
          Claim Readiness
        </h3>
        {conditionName && (
          <p className="text-sm text-gray-600">{conditionName}</p>
        )}
      </div>

      {/* Circular Progress Gauge */}
      <div className="flex justify-center mb-6">
        <div className="relative">
          <svg width={size} height={size} className="transform -rotate-90">
            {/* Background circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="currentColor"
              strokeWidth={strokeWidth}
              fill="none"
              className="text-gray-200"
            />
            {/* Progress circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="currentColor"
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className={`${color.stroke} transition-all duration-1000 ease-out`}
            />
          </svg>

          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className={`text-5xl font-bold ${color.fill}`}>
              {completeness}%
            </div>
            <div className="text-sm text-gray-500 mt-1">Complete</div>
          </div>
        </div>
      </div>

      {/* Status Message */}
      <div
        className={`${color.bg} border border-current rounded-lg p-4 mb-4 ${color.stroke}`}
      >
        {completeness === 100 ? (
          <div className="text-center">
            <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <p className="font-bold text-green-900">Ready to File!</p>
            <p className="text-sm text-green-800 mt-1">
              You have all three essential components. Your claim packet is
              complete.
            </p>
          </div>
        ) : completeness === 0 ? (
          <div className="text-center">
            <Circle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="font-bold text-gray-700">Not Started</p>
            <p className="text-sm text-gray-600 mt-1">
              Select a condition and start building your claim packet.
            </p>
          </div>
        ) : (
          <div className="text-center">
            <AlertCircle className="w-8 h-8 text-current mx-auto mb-2 opacity-70" />
            <p className="font-bold text-current">In Progress</p>
            <p className="text-sm opacity-90 mt-1">
              You&apos;re making progress, but your claim needs more evidence.
            </p>
          </div>
        )}
      </div>

      {/* Missing Items Checklist */}
      {missingItems.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
            ⚠️ Still Needed:
          </h4>
          {missingItems.map((item, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-3 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
            >
              <item.icon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-gray-900 text-sm">
                  {item.label}
                </p>
                <p className="text-xs text-gray-600 mt-1">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Completed Items (if any) */}
      {(checklist.hasDiagnosis ||
        checklist.hasInServiceEvent ||
        checklist.hasNexus) && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="font-semibold text-gray-900 text-sm uppercase tracking-wide mb-3">
            ✅ Completed:
          </h4>
          <div className="space-y-2">
            {checklist.hasDiagnosis && (
              <div className="flex items-center gap-2 text-sm text-green-700">
                <CheckCircle className="w-4 h-4" />
                <span>Medical Diagnosis/Symptoms</span>
              </div>
            )}
            {checklist.hasInServiceEvent && (
              <div className="flex items-center gap-2 text-sm text-green-700">
                <CheckCircle className="w-4 h-4" />
                <span>In-Service Event/Stressor</span>
              </div>
            )}
            {checklist.hasNexus && (
              <div className="flex items-center gap-2 text-sm text-green-700">
                <CheckCircle className="w-4 h-4" />
                <span>Nexus Letter Draft</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-xs text-blue-900">
            <strong>The &quot;Holy Trinity&quot; of VA Claims:</strong>
          </p>
          <ul className="text-xs text-blue-800 mt-2 space-y-1 ml-4 list-disc">
            <li>
              <strong>Diagnosis:</strong> Medical proof you have the condition
            </li>
            <li>
              <strong>In-Service Event:</strong> Proof something happened in
              service
            </li>
            <li>
              <strong>Nexus:</strong> Medical opinion linking the two together
            </li>
          </ul>
          <p className="text-xs text-blue-800 mt-3">
            All three are required for a successful claim. Don&apos;t file until
            you hit 100%.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ClaimProgress;
