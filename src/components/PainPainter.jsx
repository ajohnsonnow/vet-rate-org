/**
 * Vet-Rate.org - Pain Painter (Interactive Body Map 2.0)
 * "Translates Grunt to Doctor" - Advanced visual pain mapping
 *
 * Veterans often know WHERE it hurts but not the MEDICAL NAME.
 * This translates physical locations to diagnostic codes instantly.
 *
 * Features:
 * - Interactive SVG body with glow effects
 * - Paint mode for heatmap visualization
 * - Diagnostic code suggestions based on location
 * - Nexus pattern detection (connecting conditions)
 * - Export pain map for medical appointments
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { useBodyScrollLock } from "../utils/useBodyScrollLock";
import { useScreenshot } from "../hooks/useScreenshot";
import { getPainMaps, savePainMap } from "../utils/veteranProfile";
import ReportBugLink from "./ReportBugLink";

// Diagnostic codes by body region
const DIAGNOSTIC_CODES = {
  head: [
    {
      code: "8100",
      name: "Migraine Headaches",
      maxRating: 50,
      description: "Characteristic prostrating attacks",
    },
    {
      code: "8045",
      name: "TBI Residuals",
      maxRating: 100,
      description: "Traumatic brain injury residuals",
    },
    {
      code: "6260",
      name: "Tinnitus",
      maxRating: 10,
      description: "Ringing in the ears",
    },
    {
      code: "9304",
      name: "Dementia (TBI)",
      maxRating: 100,
      description: "Dementia due to brain trauma",
    },
  ],
  neck: [
    {
      code: "5237",
      name: "Cervical Strain",
      maxRating: 100,
      description: "Neck strain/sprain",
    },
    {
      code: "5242",
      name: "Cervical DDD",
      maxRating: 100,
      description: "Degenerative disc disease",
    },
    {
      code: "8510",
      name: "Cervical Radiculopathy",
      maxRating: 70,
      description: "Nerve root compression",
    },
  ],
  shoulder_left: [
    {
      code: "5201",
      name: "Shoulder Limitation of Motion (Minor)",
      maxRating: 30,
      description: "Limited arm movement",
    },
    {
      code: "5200",
      name: "Shoulder Ankylosis (Minor)",
      maxRating: 40,
      description: "Frozen shoulder",
    },
    {
      code: "5203",
      name: "Clavicle/Scapula Impairment (Minor)",
      maxRating: 20,
      description: "Collarbone issues",
    },
  ],
  shoulder_right: [
    {
      code: "5201",
      name: "Shoulder Limitation of Motion (Major)",
      maxRating: 40,
      description: "Limited arm movement",
    },
    {
      code: "5200",
      name: "Shoulder Ankylosis (Major)",
      maxRating: 50,
      description: "Frozen shoulder",
    },
    {
      code: "5203",
      name: "Clavicle/Scapula Impairment (Major)",
      maxRating: 20,
      description: "Collarbone issues",
    },
  ],
  upper_back: [
    {
      code: "5237",
      name: "Thoracic Strain",
      maxRating: 100,
      description: "Upper back strain",
    },
    {
      code: "5242",
      name: "Thoracic DDD",
      maxRating: 100,
      description: "Degenerative disc disease",
    },
  ],
  lower_back: [
    {
      code: "5237",
      name: "Lumbosacral Strain",
      maxRating: 100,
      description: "Lower back strain",
    },
    {
      code: "5243",
      name: "IVDS",
      maxRating: 60,
      description: "Intervertebral disc syndrome",
    },
    {
      code: "8520",
      name: "Sciatic Nerve",
      maxRating: 80,
      description: "Sciatica/nerve damage",
    },
    {
      code: "5242",
      name: "Lumbar DDD",
      maxRating: 100,
      description: "Degenerative disc disease",
    },
  ],
  hip_left: [
    {
      code: "5252",
      name: "Hip Limitation of Flexion",
      maxRating: 40,
      description: "Limited hip bending",
    },
    {
      code: "5251",
      name: "Hip Limitation of Extension",
      maxRating: 10,
      description: "Limited hip extension",
    },
    {
      code: "5250",
      name: "Hip Ankylosis",
      maxRating: 90,
      description: "Fused hip joint",
    },
  ],
  hip_right: [
    {
      code: "5252",
      name: "Hip Limitation of Flexion",
      maxRating: 40,
      description: "Limited hip bending",
    },
    {
      code: "5251",
      name: "Hip Limitation of Extension",
      maxRating: 10,
      description: "Limited hip extension",
    },
    {
      code: "5250",
      name: "Hip Ankylosis",
      maxRating: 90,
      description: "Fused hip joint",
    },
  ],
  knee_left: [
    {
      code: "5260",
      name: "Knee Limitation of Flexion",
      maxRating: 30,
      description: "Limited knee bending",
    },
    {
      code: "5261",
      name: "Knee Limitation of Extension",
      maxRating: 50,
      description: "Limited knee straightening",
    },
    {
      code: "5257",
      name: "Knee Instability",
      maxRating: 30,
      description: "Lateral instability",
    },
    {
      code: "5258",
      name: "Torn Meniscus",
      maxRating: 20,
      description: "Cartilage damage with locking",
    },
  ],
  knee_right: [
    {
      code: "5260",
      name: "Knee Limitation of Flexion",
      maxRating: 30,
      description: "Limited knee bending",
    },
    {
      code: "5261",
      name: "Knee Limitation of Extension",
      maxRating: 50,
      description: "Limited knee straightening",
    },
    {
      code: "5257",
      name: "Knee Instability",
      maxRating: 30,
      description: "Lateral instability",
    },
    {
      code: "5258",
      name: "Torn Meniscus",
      maxRating: 20,
      description: "Cartilage damage with locking",
    },
  ],
  ankle_left: [
    {
      code: "5271",
      name: "Ankle Limitation of Motion",
      maxRating: 20,
      description: "Limited ankle movement",
    },
    {
      code: "5270",
      name: "Ankle Ankylosis",
      maxRating: 40,
      description: "Fused ankle",
    },
    {
      code: "5284",
      name: "Foot Injuries",
      maxRating: 30,
      description: "Other foot injuries",
    },
  ],
  ankle_right: [
    {
      code: "5271",
      name: "Ankle Limitation of Motion",
      maxRating: 20,
      description: "Limited ankle movement",
    },
    {
      code: "5270",
      name: "Ankle Ankylosis",
      maxRating: 40,
      description: "Fused ankle",
    },
    {
      code: "5284",
      name: "Foot Injuries",
      maxRating: 30,
      description: "Other foot injuries",
    },
  ],
  elbow_left: [
    {
      code: "5206",
      name: "Elbow Flexion Limitation (Minor)",
      maxRating: 40,
      description: "Limited elbow bending",
    },
    {
      code: "5207",
      name: "Elbow Extension Limitation (Minor)",
      maxRating: 40,
      description: "Limited elbow straightening",
    },
  ],
  elbow_right: [
    {
      code: "5206",
      name: "Elbow Flexion Limitation (Major)",
      maxRating: 50,
      description: "Limited elbow bending",
    },
    {
      code: "5207",
      name: "Elbow Extension Limitation (Major)",
      maxRating: 50,
      description: "Limited elbow straightening",
    },
  ],
  wrist_left: [
    {
      code: "5215",
      name: "Wrist Limitation of Motion (Minor)",
      maxRating: 10,
      description: "Limited wrist movement",
    },
    {
      code: "8515",
      name: "Carpal Tunnel (Minor)",
      maxRating: 40,
      description: "Median nerve compression",
    },
  ],
  wrist_right: [
    {
      code: "5215",
      name: "Wrist Limitation of Motion (Major)",
      maxRating: 10,
      description: "Limited wrist movement",
    },
    {
      code: "8515",
      name: "Carpal Tunnel (Major)",
      maxRating: 50,
      description: "Median nerve compression",
    },
  ],
  chest: [
    {
      code: "6604",
      name: "COPD/Asthma",
      maxRating: 100,
      description: "Chronic obstructive pulmonary disease",
    },
    {
      code: "7005",
      name: "Heart Disease",
      maxRating: 100,
      description: "Arteriosclerotic heart disease",
    },
    {
      code: "5297",
      name: "Rib Removal",
      maxRating: 40,
      description: "Removal of ribs",
    },
  ],
  abdomen: [
    {
      code: "7346",
      name: "GERD/Hiatal Hernia",
      maxRating: 60,
      description: "Acid reflux disease",
    },
    {
      code: "7319",
      name: "IBS",
      maxRating: 30,
      description: "Irritable bowel syndrome",
    },
    {
      code: "7301",
      name: "Peritoneal Adhesions",
      maxRating: 50,
      description: "Scar tissue in abdomen",
    },
  ],
};

// Nexus patterns - common connections between conditions
const NEXUS_PATTERNS = [
  {
    regions: ["lower_back", "hip_left", "hip_right", "knee_left", "knee_right"],
    name: "Lumbar Radiculopathy Pattern",
    description:
      "Lower back conditions often cause radiating pain down the legs. This is commonly rated as sciatica (DC 8520) secondary to lumbar strain.",
    suggestedCodes: ["8520", "5237"],
  },
  {
    regions: [
      "neck",
      "shoulder_left",
      "shoulder_right",
      "elbow_left",
      "elbow_right",
      "wrist_left",
      "wrist_right",
    ],
    name: "Cervical Radiculopathy Pattern",
    description:
      "Neck conditions can cause pain, numbness, and weakness radiating down the arms. Consider cervical radiculopathy (DC 8510).",
    suggestedCodes: ["8510", "5237"],
  },
  {
    regions: [
      "knee_left",
      "knee_right",
      "ankle_left",
      "ankle_right",
      "lower_back",
    ],
    name: "Gait Compensation Pattern",
    description:
      "Pain in lower extremities often leads to abnormal gait, which can cause or aggravate back conditions. Consider secondary service connection.",
    suggestedCodes: ["5237", "5260", "5271"],
  },
  {
    regions: ["head", "neck"],
    name: "Post-Concussive Pattern",
    description:
      "Headaches combined with neck pain often indicate TBI residuals or cervicogenic headaches. Consider both DC 8045 (TBI) and DC 8100 (Migraines).",
    suggestedCodes: ["8045", "8100", "5237"],
  },
];

// Pain types with colors
const PAIN_TYPES = {
  sharp: { color: "#ef4444", name: "Sharp/Stabbing", emoji: "⚡" },
  dull: { color: "#f97316", name: "Dull/Aching", emoji: "😣" },
  burning: { color: "#eab308", name: "Burning", emoji: "🔥" },
  numbness: { color: "#3b82f6", name: "Numbness/Tingling", emoji: "❄️" },
  stiffness: { color: "#8b5cf6", name: "Stiffness", emoji: "🔒" },
};

const PainPainter = ({ onClose, onExport, onReportBug }) => {
  const { t } = useLanguage();
  useBodyScrollLock(true);

  // View state - Standard Views matching VA DBQ diagrams
  const [view, setView] = useState("front"); // 'front' | 'back' | 'left' | 'right'
  const [mode, setMode] = useState("select"); // 'select' | 'paint'
  const [selectedPainType, setSelectedPainType] = useState("sharp");
  const [activeTab, setActiveTab] = useState("map"); // 'map' | 'config'

  // Standard Views Configuration - matches official VA DBQ diagrams
  const STANDARD_VIEWS = {
    front: {
      id: "front",
      name: "Front View",
      icon: "👤",
      shortcut: "F",
      description: "Anterior view showing front of body",
    },
    back: {
      id: "back",
      name: "Back View",
      icon: "🔙",
      shortcut: "B",
      description: "Posterior view showing back of body",
    },
    left: {
      id: "left",
      name: "Left Side",
      icon: "⬅️",
      shortcut: "L",
      description: "Left lateral view showing side profile",
    },
    right: {
      id: "right",
      name: "Right Side",
      icon: "➡️",
      shortcut: "R",
      description: "Right lateral view showing side profile",
    },
  };

  // Pain data
  const [painPoints, setPainPoints] = useState({});
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [hoveredRegion, setHoveredRegion] = useState(null);

  // Body configuration
  const [bodyType, setBodyType] = useState("average"); // 'masculine' | 'feminine' | 'average' | 'trans-ftm' | 'trans-mtf' | 'nonbinary'
  const [bodyScale, setBodyScale] = useState({
    head: 1,
    torso: 1,
    arms: 1,
    legs: 1,
    shoulders: 1,
    hips: 1,
  });
  const [zoom, setZoom] = useState(1);
  // Removed rotation - using standard views instead for WCAG compliance
  const [showPhantomLimbs, setShowPhantomLimbs] = useState({
    leftArm: true,
    rightArm: true,
    leftLeg: true,
    rightLeg: true,
  });

  // Keyboard shortcuts for view switching (WCAG 2.1 keyboard navigation)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only handle when not in an input field
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;

      switch (e.key.toLowerCase()) {
        case "f":
          setView("front");
          break;
        case "b":
          setView("back");
          break;
        case "l":
          setView("left");
          break;
        case "r":
          setView("right");
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Save state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Nexus detection
  const [detectedNexus, setDetectedNexus] = useState([]);

  // Export ref
  const bodyMapRef = useRef(null);
  const { captureScreenshot, downloadScreenshot } = useScreenshot();

  // Body type presets
  const BODY_PRESETS = {
    masculine: {
      name: "Masculine",
      shoulders: 1.15,
      hips: 0.9,
      torso: 1.05,
      arms: 1.05,
      legs: 1,
      head: 1,
      icon: "👨",
    },
    feminine: {
      name: "Feminine",
      shoulders: 0.9,
      hips: 1.1,
      torso: 0.95,
      arms: 0.95,
      legs: 1,
      head: 0.95,
      icon: "👩",
    },
    average: {
      name: "Average",
      shoulders: 1,
      hips: 1,
      torso: 1,
      arms: 1,
      legs: 1,
      head: 1,
      icon: "🧑",
    },
    "trans-ftm": {
      name: "Trans (FtM)",
      shoulders: 1.05,
      hips: 1,
      torso: 1,
      arms: 1,
      legs: 1,
      head: 1,
      icon: "⚧️",
    },
    "trans-mtf": {
      name: "Trans (MtF)",
      shoulders: 0.95,
      hips: 1.05,
      torso: 0.98,
      arms: 0.98,
      legs: 1,
      head: 0.97,
      icon: "⚧️",
    },
    nonbinary: {
      name: "Non-Binary",
      shoulders: 1,
      hips: 1,
      torso: 1,
      arms: 1,
      legs: 1,
      head: 1,
      icon: "🏳️‍🌈",
    },
  };

  // Apply body preset
  const applyBodyPreset = (preset) => {
    setBodyType(preset);
    const config = BODY_PRESETS[preset];
    setBodyScale({
      head: config.head,
      torso: config.torso,
      arms: config.arms,
      legs: config.legs,
      shoulders: config.shoulders,
      hips: config.hips,
    });
  };

  // Detect nexus patterns when pain points change
  useEffect(() => {
    const paintedRegions = Object.keys(painPoints);
    const detected = NEXUS_PATTERNS.filter((pattern) => {
      const matchingRegions = pattern.regions.filter((r) =>
        paintedRegions.includes(r),
      );
      return matchingRegions.length >= 2;
    });
    setDetectedNexus(detected);
  }, [painPoints]);

  // Handle region click
  const handleRegionClick = useCallback(
    (regionId) => {
      if (mode === "paint") {
        // Toggle pain point
        setPainPoints((prev) => {
          const newPoints = { ...prev };
          if (newPoints[regionId]?.type === selectedPainType) {
            delete newPoints[regionId];
          } else {
            newPoints[regionId] = { type: selectedPainType, intensity: 1 };
          }
          return newPoints;
        });
      } else {
        setSelectedRegion(regionId);
      }
    },
    [mode, selectedPainType],
  );

  // Get region style
  const getRegionStyle = useCallback(
    (regionId) => {
      const pain = painPoints[regionId];
      const isHovered = hoveredRegion === regionId;
      const isSelected = selectedRegion === regionId;

      let fill = "rgba(100, 116, 139, 0.3)"; // Default gray
      let stroke = "rgba(148, 163, 184, 0.5)";
      let strokeWidth = 1;
      let filter = "";

      if (pain) {
        fill = PAIN_TYPES[pain.type].color;
        stroke = PAIN_TYPES[pain.type].color;
        filter = "drop-shadow(0 0 8px " + PAIN_TYPES[pain.type].color + ")";
      }

      if (isHovered) {
        fill = pain ? PAIN_TYPES[pain.type].color : "rgba(59, 130, 246, 0.5)";
        strokeWidth = 2;
      }

      if (isSelected) {
        stroke = "#ffffff";
        strokeWidth = 3;
      }

      return { fill, stroke, strokeWidth, filter };
    },
    [painPoints, hoveredRegion, selectedRegion],
  );

  // Render enhanced body SVG with scaling - supports 4 standard views
  const renderBodySVG = () => {
    const s = bodyScale; // shorthand
    const centerX = 150;

    // Calculate scaled positions based on body type
    const shoulderWidth = 50 * s.shoulders;
    const hipWidth = 40 * s.hips;
    const torsoHeight = 60 * s.torso;
    const armLength = 100 * s.arms;
    const legLength = 150 * s.legs;

    // Get regions based on current view
    const getRegionsForView = () => {
      // FRONT VIEW
      if (view === "front") {
        return {
          head: `M ${centerX},${20 * s.head} 
                 Q ${centerX + 30 * s.head},${20 * s.head} ${centerX + 30 * s.head},${50 * s.head} 
                 Q ${centerX + 30 * s.head},${80 * s.head} ${centerX},${80 * s.head} 
                 Q ${centerX - 30 * s.head},${80 * s.head} ${centerX - 30 * s.head},${50 * s.head} 
                 Q ${centerX - 30 * s.head},${20 * s.head} ${centerX},${20 * s.head}`,
          neck: `M ${centerX - 10},80 L ${centerX + 10},80 L ${centerX + 10},100 L ${centerX - 10},100 Z`,
          shoulder_left: showPhantomLimbs.leftArm
            ? `M ${centerX - shoulderWidth},100 Q ${centerX - shoulderWidth - 20},100 ${centerX - shoulderWidth - 20},120 
             L ${centerX - shoulderWidth},130 L ${centerX - 30},110 Z`
            : null,
          shoulder_right: showPhantomLimbs.rightArm
            ? `M ${centerX + shoulderWidth},100 Q ${centerX + shoulderWidth + 20},100 ${centerX + shoulderWidth + 20},120 
             L ${centerX + shoulderWidth},130 L ${centerX + 30},110 Z`
            : null,
          chest: `M ${centerX - 30},100 L ${centerX + 30},100 
                  L ${centerX + 40 * s.shoulders},160 L ${centerX - 40 * s.shoulders},160 Z`,
          abdomen: `M ${centerX - 40 * s.shoulders},160 L ${centerX + 40 * s.shoulders},160 
                    L ${centerX + 35 * s.hips},220 L ${centerX - 35 * s.hips},220 Z`,
          elbow_left: showPhantomLimbs.leftArm
            ? `M ${centerX - 80 * s.arms},150 Q ${centerX - 90 * s.arms},160 ${centerX - 80 * s.arms},180 
             L ${centerX - 65 * s.arms},175 L ${centerX - 65 * s.arms},155 Z`
            : null,
          elbow_right: showPhantomLimbs.rightArm
            ? `M ${centerX + 80 * s.arms},150 Q ${centerX + 90 * s.arms},160 ${centerX + 80 * s.arms},180 
             L ${centerX + 65 * s.arms},175 L ${centerX + 65 * s.arms},155 Z`
            : null,
          wrist_left: showPhantomLimbs.leftArm
            ? `M ${centerX - 95 * s.arms},200 Q ${centerX - 105 * s.arms},210 ${centerX - 95 * s.arms},230 
             L ${centerX - 80 * s.arms},225 L ${centerX - 80 * s.arms},205 Z`
            : null,
          wrist_right: showPhantomLimbs.rightArm
            ? `M ${centerX + 95 * s.arms},200 Q ${centerX + 105 * s.arms},210 ${centerX + 95 * s.arms},230 
             L ${centerX + 80 * s.arms},225 L ${centerX + 80 * s.arms},205 Z`
            : null,
          hip_left: showPhantomLimbs.leftLeg
            ? `M ${centerX - 35 * s.hips},220 L ${centerX - 10},220 L ${centerX - 20 * s.legs},260 L ${centerX - 40 * s.hips},260 Z`
            : null,
          hip_right: showPhantomLimbs.rightLeg
            ? `M ${centerX + 35 * s.hips},220 L ${centerX + 10},220 L ${centerX + 20 * s.legs},260 L ${centerX + 40 * s.hips},260 Z`
            : null,
          knee_left: showPhantomLimbs.leftLeg
            ? `M ${centerX - 40 * s.legs},300 Q ${centerX - 50 * s.legs},320 ${centerX - 40 * s.legs},340 
             L ${centerX - 20 * s.legs},340 L ${centerX - 20 * s.legs},300 Z`
            : null,
          knee_right: showPhantomLimbs.rightLeg
            ? `M ${centerX + 40 * s.legs},300 Q ${centerX + 50 * s.legs},320 ${centerX + 40 * s.legs},340 
             L ${centerX + 20 * s.legs},340 L ${centerX + 20 * s.legs},300 Z`
            : null,
          ankle_left: showPhantomLimbs.leftLeg
            ? `M ${centerX - 40 * s.legs},380 Q ${centerX - 50 * s.legs},395 ${centerX - 40 * s.legs},410 
             L ${centerX - 20 * s.legs},410 L ${centerX - 20 * s.legs},380 Z`
            : null,
          ankle_right: showPhantomLimbs.rightLeg
            ? `M ${centerX + 40 * s.legs},380 Q ${centerX + 50 * s.legs},395 ${centerX + 40 * s.legs},410 
             L ${centerX + 20 * s.legs},410 L ${centerX + 20 * s.legs},380 Z`
            : null,
        };
      }

      // BACK VIEW
      if (view === "back") {
        return {
          head: `M ${centerX},${20 * s.head} 
                 Q ${centerX + 30 * s.head},${20 * s.head} ${centerX + 30 * s.head},${50 * s.head} 
                 Q ${centerX + 30 * s.head},${80 * s.head} ${centerX},${80 * s.head} 
                 Q ${centerX - 30 * s.head},${80 * s.head} ${centerX - 30 * s.head},${50 * s.head} 
                 Q ${centerX - 30 * s.head},${20 * s.head} ${centerX},${20 * s.head}`,
          neck: `M ${centerX - 10},80 L ${centerX + 10},80 L ${centerX + 10},100 L ${centerX - 10},100 Z`,
          upper_back: `M ${centerX - 30},100 L ${centerX + 30},100 L ${centerX + 35 * s.shoulders},160 L ${centerX - 35 * s.shoulders},160 Z`,
          lower_back: `M ${centerX - 35 * s.shoulders},160 L ${centerX + 35 * s.shoulders},160 L ${centerX + 30 * s.hips},220 L ${centerX - 30 * s.hips},220 Z`,
          shoulder_left: showPhantomLimbs.leftArm
            ? `M ${centerX - shoulderWidth},100 Q ${centerX - shoulderWidth - 20},100 ${centerX - shoulderWidth - 20},120 
             L ${centerX - shoulderWidth},130 L ${centerX - 30},110 Z`
            : null,
          shoulder_right: showPhantomLimbs.rightArm
            ? `M ${centerX + shoulderWidth},100 Q ${centerX + shoulderWidth + 20},100 ${centerX + shoulderWidth + 20},120 
             L ${centerX + shoulderWidth},130 L ${centerX + 30},110 Z`
            : null,
          elbow_left: showPhantomLimbs.leftArm
            ? `M ${centerX - 80 * s.arms},150 Q ${centerX - 90 * s.arms},160 ${centerX - 80 * s.arms},180 
             L ${centerX - 65 * s.arms},175 L ${centerX - 65 * s.arms},155 Z`
            : null,
          elbow_right: showPhantomLimbs.rightArm
            ? `M ${centerX + 80 * s.arms},150 Q ${centerX + 90 * s.arms},160 ${centerX + 80 * s.arms},180 
             L ${centerX + 65 * s.arms},175 L ${centerX + 65 * s.arms},155 Z`
            : null,
          wrist_left: showPhantomLimbs.leftArm
            ? `M ${centerX - 95 * s.arms},200 Q ${centerX - 105 * s.arms},210 ${centerX - 95 * s.arms},230 
             L ${centerX - 80 * s.arms},225 L ${centerX - 80 * s.arms},205 Z`
            : null,
          wrist_right: showPhantomLimbs.rightArm
            ? `M ${centerX + 95 * s.arms},200 Q ${centerX + 105 * s.arms},210 ${centerX + 95 * s.arms},230 
             L ${centerX + 80 * s.arms},225 L ${centerX + 80 * s.arms},205 Z`
            : null,
          hip_left: showPhantomLimbs.leftLeg
            ? `M ${centerX - 30 * s.hips},220 L ${centerX - 10},220 L ${centerX - 20},260 L ${centerX - 35 * s.hips},260 Z`
            : null,
          hip_right: showPhantomLimbs.rightLeg
            ? `M ${centerX + 30 * s.hips},220 L ${centerX + 10},220 L ${centerX + 20},260 L ${centerX + 35 * s.hips},260 Z`
            : null,
          knee_left: showPhantomLimbs.leftLeg
            ? `M ${centerX - 40 * s.legs},300 Q ${centerX - 50 * s.legs},320 ${centerX - 40 * s.legs},340 
             L ${centerX - 20 * s.legs},340 L ${centerX - 20 * s.legs},300 Z`
            : null,
          knee_right: showPhantomLimbs.rightLeg
            ? `M ${centerX + 40 * s.legs},300 Q ${centerX + 50 * s.legs},320 ${centerX + 40 * s.legs},340 
             L ${centerX + 20 * s.legs},340 L ${centerX + 20 * s.legs},300 Z`
            : null,
          ankle_left: showPhantomLimbs.leftLeg
            ? `M ${centerX - 40 * s.legs},380 Q ${centerX - 50 * s.legs},395 ${centerX - 40 * s.legs},410 
             L ${centerX - 20 * s.legs},410 L ${centerX - 20 * s.legs},380 Z`
            : null,
          ankle_right: showPhantomLimbs.rightLeg
            ? `M ${centerX + 40 * s.legs},380 Q ${centerX + 50 * s.legs},395 ${centerX + 40 * s.legs},410 
             L ${centerX + 20 * s.legs},410 L ${centerX + 20 * s.legs},380 Z`
            : null,
        };
      }

      // LEFT SIDE VIEW - Side profile showing left arm/leg forward
      if (view === "left") {
        const depth = 25 * s.torso; // Body depth from side
        return {
          head: `M ${centerX},${20 * s.head} 
                 Q ${centerX + 25 * s.head},${20 * s.head} ${centerX + 20 * s.head},${50 * s.head} 
                 Q ${centerX + 15 * s.head},${80 * s.head} ${centerX - 5},${80 * s.head} 
                 Q ${centerX - 25 * s.head},${75 * s.head} ${centerX - 20 * s.head},${50 * s.head} 
                 Q ${centerX - 15 * s.head},${20 * s.head} ${centerX},${20 * s.head}`,
          neck: `M ${centerX - 8},80 L ${centerX + 8},80 L ${centerX + 8},100 L ${centerX - 8},100 Z`,
          // Torso side profile
          chest: `M ${centerX - depth},100 L ${centerX + depth},105 
                  L ${centerX + depth * 1.1},160 L ${centerX - depth * 0.9},160 Z`,
          abdomen: `M ${centerX - depth * 0.9},160 L ${centerX + depth * 1.1},160 
                    L ${centerX + depth * 1.2 * s.hips},220 L ${centerX - depth * 0.8 * s.hips},220 Z`,
          lower_back: `M ${centerX - depth * 0.9},160 L ${centerX - depth * 0.8 * s.hips},220 
                       L ${centerX - depth * 0.5},220 L ${centerX - depth * 0.5},160 Z`,
          // Left arm (visible in front)
          shoulder_left: showPhantomLimbs.leftArm
            ? `M ${centerX + depth},105 Q ${centerX + depth + 20},110 ${centerX + depth + 15},130 
             L ${centerX + depth - 5},125 L ${centerX - 5},110 Z`
            : null,
          elbow_left: showPhantomLimbs.leftArm
            ? `M ${centerX + 30 * s.arms},150 Q ${centerX + 40 * s.arms},165 ${centerX + 35 * s.arms},180 
             L ${centerX + 20 * s.arms},175 L ${centerX + 25 * s.arms},155 Z`
            : null,
          wrist_left: showPhantomLimbs.leftArm
            ? `M ${centerX + 40 * s.arms},200 Q ${centerX + 50 * s.arms},215 ${centerX + 45 * s.arms},235 
             L ${centerX + 30 * s.arms},230 L ${centerX + 35 * s.arms},205 Z`
            : null,
          // Hip/leg side profile
          hip_left: showPhantomLimbs.leftLeg
            ? `M ${centerX + depth * 1.2 * s.hips},220 L ${centerX - depth * 0.3},220 
             L ${centerX + 5},260 L ${centerX + 35 * s.hips},260 Z`
            : null,
          knee_left: showPhantomLimbs.leftLeg
            ? `M ${centerX + 25 * s.legs},300 Q ${centerX + 35 * s.legs},320 ${centerX + 25 * s.legs},340 
             L ${centerX - 5 * s.legs},340 L ${centerX - 5 * s.legs},300 Z`
            : null,
          ankle_left: showPhantomLimbs.leftLeg
            ? `M ${centerX + 25 * s.legs},380 Q ${centerX + 35 * s.legs},395 ${centerX + 25 * s.legs},410 
             L ${centerX - 5 * s.legs},410 L ${centerX - 5 * s.legs},380 Z`
            : null,
        };
      }

      // RIGHT SIDE VIEW - Side profile showing right arm/leg forward
      if (view === "right") {
        const depth = 25 * s.torso;
        return {
          head: `M ${centerX},${20 * s.head} 
                 Q ${centerX - 25 * s.head},${20 * s.head} ${centerX - 20 * s.head},${50 * s.head} 
                 Q ${centerX - 15 * s.head},${80 * s.head} ${centerX + 5},${80 * s.head} 
                 Q ${centerX + 25 * s.head},${75 * s.head} ${centerX + 20 * s.head},${50 * s.head} 
                 Q ${centerX + 15 * s.head},${20 * s.head} ${centerX},${20 * s.head}`,
          neck: `M ${centerX - 8},80 L ${centerX + 8},80 L ${centerX + 8},100 L ${centerX - 8},100 Z`,
          chest: `M ${centerX + depth},100 L ${centerX - depth},105 
                  L ${centerX - depth * 1.1},160 L ${centerX + depth * 0.9},160 Z`,
          abdomen: `M ${centerX + depth * 0.9},160 L ${centerX - depth * 1.1},160 
                    L ${centerX - depth * 1.2 * s.hips},220 L ${centerX + depth * 0.8 * s.hips},220 Z`,
          lower_back: `M ${centerX + depth * 0.9},160 L ${centerX + depth * 0.8 * s.hips},220 
                       L ${centerX + depth * 0.5},220 L ${centerX + depth * 0.5},160 Z`,
          // Right arm (visible in front)
          shoulder_right: showPhantomLimbs.rightArm
            ? `M ${centerX - depth},105 Q ${centerX - depth - 20},110 ${centerX - depth - 15},130 
             L ${centerX - depth + 5},125 L ${centerX + 5},110 Z`
            : null,
          elbow_right: showPhantomLimbs.rightArm
            ? `M ${centerX - 30 * s.arms},150 Q ${centerX - 40 * s.arms},165 ${centerX - 35 * s.arms},180 
             L ${centerX - 20 * s.arms},175 L ${centerX - 25 * s.arms},155 Z`
            : null,
          wrist_right: showPhantomLimbs.rightArm
            ? `M ${centerX - 40 * s.arms},200 Q ${centerX - 50 * s.arms},215 ${centerX - 45 * s.arms},235 
             L ${centerX - 30 * s.arms},230 L ${centerX - 35 * s.arms},205 Z`
            : null,
          // Hip/leg side profile
          hip_right: showPhantomLimbs.rightLeg
            ? `M ${centerX - depth * 1.2 * s.hips},220 L ${centerX + depth * 0.3},220 
             L ${centerX - 5},260 L ${centerX - 35 * s.hips},260 Z`
            : null,
          knee_right: showPhantomLimbs.rightLeg
            ? `M ${centerX - 25 * s.legs},300 Q ${centerX - 35 * s.legs},320 ${centerX - 25 * s.legs},340 
             L ${centerX + 5 * s.legs},340 L ${centerX + 5 * s.legs},300 Z`
            : null,
          ankle_right: showPhantomLimbs.rightLeg
            ? `M ${centerX - 25 * s.legs},380 Q ${centerX - 35 * s.legs},395 ${centerX - 25 * s.legs},410 
             L ${centerX + 5 * s.legs},410 L ${centerX + 5 * s.legs},380 Z`
            : null,
        };
      }

      return {}; // fallback
    };

    const regions = getRegionsForView();

    // Filter out null regions (phantom limbs)
    const activeRegions = Object.fromEntries(
      Object.entries(regions).filter(([_, path]) => path !== null),
    );

    return (
      <svg
        viewBox="0 0 300 440"
        className="w-full max-w-md mx-auto transition-transform duration-300"
        style={{
          filter: "drop-shadow(0 0 20px rgba(0,0,0,0.5))",
          transform: `scale(${zoom})`,
          transformOrigin: "center center",
        }}
        role="img"
        aria-label={`Body diagram - ${STANDARD_VIEWS[view].name}. ${Object.keys(painPoints).length} pain points marked.`}
      >
        {/* Background glow */}
        <defs>
          <radialGradient id="bodyGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(59, 130, 246, 0.1)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>

          {/* Skin tone gradient */}
          <linearGradient id="skinTone" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255, 224, 189, 0.3)" />
            <stop offset="100%" stopColor="rgba(255, 206, 158, 0.2)" />
          </linearGradient>

          {/* Pain type filters */}
          {Object.entries(PAIN_TYPES).map(([type, { color }]) => (
            <filter
              key={type}
              id={`glow-${type}`}
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feFlood floodColor={color} floodOpacity="0.6" />
              <feComposite in2="blur" operator="in" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          ))}
        </defs>

        {/* View label for accessibility */}
        <title>{STANDARD_VIEWS[view].description}</title>

        {/* Body outline background */}
        <ellipse
          cx={centerX}
          cy="220"
          rx={
            view === "left" || view === "right"
              ? 60
              : 100 * Math.max(s.shoulders, s.hips)
          }
          ry={200 * s.torso}
          fill="url(#bodyGlow)"
        />

        {/* Phantom limb indicators - only for front/back views */}
        {(view === "front" || view === "back") && !showPhantomLimbs.leftArm && (
          <text
            x="70"
            y="150"
            fill="rgba(255,100,100,0.5)"
            fontSize="10"
            textAnchor="middle"
          >
            ❌ Removed
          </text>
        )}
        {(view === "front" || view === "back") &&
          !showPhantomLimbs.rightArm && (
            <text
              x="230"
              y="150"
              fill="rgba(255,100,100,0.5)"
              fontSize="10"
              textAnchor="middle"
            >
              ❌ Removed
            </text>
          )}
        {(view === "front" || view === "back") && !showPhantomLimbs.leftLeg && (
          <text
            x="120"
            y="350"
            fill="rgba(255,100,100,0.5)"
            fontSize="10"
            textAnchor="middle"
          >
            ❌
          </text>
        )}
        {(view === "front" || view === "back") &&
          !showPhantomLimbs.rightLeg && (
            <text
              x="180"
              y="350"
              fill="rgba(255,100,100,0.5)"
              fontSize="10"
              textAnchor="middle"
            >
              ❌
            </text>
          )}

        {/* Body regions */}
        {Object.entries(activeRegions).map(([regionId, path]) => {
          const style = getRegionStyle(regionId);
          const pain = painPoints[regionId];

          return (
            <path
              key={regionId}
              d={path}
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
              style={{
                cursor: "pointer",
                transition: "all 0.2s ease",
                filter: pain ? `url(#glow-${pain.type})` : "none",
              }}
              onClick={() => handleRegionClick(regionId)}
              onMouseEnter={() => setHoveredRegion(regionId)}
              onMouseLeave={() => setHoveredRegion(null)}
            />
          );
        })}

        {/* Labels for hovered/selected regions */}
        {(hoveredRegion || selectedRegion) && (
          <text
            x="150"
            y="430"
            textAnchor="middle"
            fill="white"
            fontSize="12"
            fontWeight="bold"
          >
            {(hoveredRegion || selectedRegion)
              .replace(/_/g, " ")
              .replace(/\b\w/g, (l) => l.toUpperCase())}
          </text>
        )}
      </svg>
    );
  };

  // Render diagnostic codes panel
  const renderDiagnosticCodes = () => {
    if (!selectedRegion) {
      return (
        <div className="text-center py-8 text-gray-500">
          <span className="text-4xl">👆</span>
          <p className="mt-2">
            Click a body region to see related diagnostic codes
          </p>
        </div>
      );
    }

    const codes = DIAGNOSTIC_CODES[selectedRegion] || [];
    const regionName = selectedRegion
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());

    return (
      <div className="space-y-3">
        <h4 className="text-lg font-bold text-white flex items-center gap-2">
          <span>📋</span> {regionName} - Diagnostic Codes
        </h4>

        {codes.length > 0 ? (
          <div className="space-y-2">
            {codes.map((code) => (
              <div
                key={code.code}
                className="p-3 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-blue-500/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-blue-400 font-bold">
                    DC {code.code}
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">
                    Max {code.maxRating}%
                  </span>
                </div>
                <p className="text-white font-semibold">{code.name}</p>
                <p className="text-gray-400 text-sm">{code.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No specific codes for this region</p>
        )}
      </div>
    );
  };

  // Render nexus suggestions
  const renderNexusSuggestions = () => {
    if (detectedNexus.length === 0) return null;

    return (
      <div className="bg-purple-900/30 border-2 border-purple-500/50 rounded-xl p-4 mt-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">🔗</span>
          <h4 className="font-bold text-purple-400">Nexus Pattern Detected!</h4>
        </div>

        {detectedNexus.map((nexus, index) => (
          <div key={index} className="p-3 bg-gray-800/50 rounded-lg mb-2">
            <p className="font-semibold text-white">{nexus.name}</p>
            <p className="text-gray-400 text-sm mt-1">{nexus.description}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {nexus.suggestedCodes.map((code) => (
                <span
                  key={code}
                  className="text-xs px-2 py-0.5 bg-purple-500/30 text-purple-300 rounded"
                >
                  DC {code}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Handle export
  const handleExport = async () => {
    if (bodyMapRef.current) {
      await downloadScreenshot(
        bodyMapRef,
        `pain-map-${new Date().toISOString().slice(0, 10)}.png`,
      );
    }
  };

  // Handle save to My Packet
  const handleSaveToPacket = async () => {
    if (Object.keys(painPoints).length === 0) {
      alert("Please mark at least one pain point before saving.");
      return;
    }

    // Capture thumbnail
    let thumbnail = null;
    if (bodyMapRef.current) {
      try {
        thumbnail = await captureScreenshot(bodyMapRef);
      } catch (e) {
        console.log("Could not capture thumbnail");
      }
    }

    // Build pain points array with details
    const painPointsArray = Object.entries(painPoints).map(
      ([region, data]) => ({
        region: region.replace(/_/g, " "),
        bodyPart: region,
        type: PAIN_TYPES[data.type]?.name || data.type,
        severity:
          data.intensity > 0.7
            ? "severe"
            : data.intensity > 0.4
              ? "moderate"
              : "mild",
        notes: "",
      }),
    );

    // Get related conditions from diagnostic codes
    const conditions = [];
    Object.keys(painPoints).forEach((region) => {
      const codes = DIAGNOSTIC_CODES[region];
      if (codes && codes.length > 0) {
        conditions.push(codes[0].name);
      }
    });

    // Generate nexus language
    let nexusLanguage = "";
    if (detectedNexus.length > 0) {
      nexusLanguage = detectedNexus
        .map((n) => `${n.name}: ${n.description}`)
        .join("\n\n");
    }

    const painMap = {
      id: Date.now(),
      name: saveName || `Pain Map - ${new Date().toLocaleDateString()}`,
      savedAt: new Date().toISOString(),
      view,
      painPoints: painPointsArray,
      conditions: [...new Set(conditions)],
      nexusLanguage,
      thumbnail,
    };

    savePainMap(painMap);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      setShowSaveModal(false);
      setSaveName("");
    }, 2000);
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 modal-backdrop overscroll-contain"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-gradient-to-b from-gray-900 to-gray-950 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-700">
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-rose-600 via-pink-600 to-rose-600 text-white px-6 py-6 rounded-t-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-20 translate-x-20" />

          <div className="relative flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                <span className="text-4xl">🎨</span>
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold">
                  Pain Painter{" "}
                  <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded align-middle">
                    BETA
                  </span>
                </h2>
                <p className="text-pink-200 mt-1">
                  "Translate Grunt to Doctor" • Visual Pain Mapping
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onReportBug && (
                <ReportBugLink
                  onClick={onReportBug}
                  variant="light"
                  moduleName="Pain Painter"
                />
              )}
              <button
                onClick={onClose}
                className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
                aria-label="Close"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 p-6">
          {/* Tab Navigation */}
          <div className="flex bg-gray-800 rounded-lg p-1 mb-6">
            <button
              onClick={() => setActiveTab("map")}
              className={`flex-1 px-4 py-2 rounded-md transition-colors flex items-center justify-center gap-2 ${
                activeTab === "map"
                  ? "bg-pink-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <span>🎨</span> Pain Map
            </button>
            <button
              onClick={() => setActiveTab("config")}
              className={`flex-1 px-4 py-2 rounded-md transition-colors flex items-center justify-center gap-2 ${
                activeTab === "config"
                  ? "bg-purple-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <span>⚙️</span> Body Configuration
            </button>
          </div>

          {/* CONFIGURATION TAB */}
          {activeTab === "config" && (
            <div className="space-y-6">
              {/* Body Type Presets */}
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                  <span>🧍</span> Body Type Preset
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                  Select a body type that best represents your physique. This
                  helps create accurate pain documentation.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(BODY_PRESETS).map(([key, preset]) => (
                    <button
                      key={key}
                      onClick={() => applyBodyPreset(key)}
                      className={`p-4 rounded-lg border-2 transition-all text-center ${
                        bodyType === key
                          ? "border-purple-500 bg-purple-900/30"
                          : "border-gray-600 hover:border-gray-500 bg-gray-800/30"
                      }`}
                    >
                      <span className="text-3xl block mb-2">{preset.icon}</span>
                      <span className="text-white font-medium">
                        {preset.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Body Part Scaling */}
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                  <span>📐</span> Fine-Tune Body Proportions
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                  Adjust individual body part sizes for more accurate
                  representation.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(bodyScale).map(([part, value]) => (
                    <div key={part} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-300 capitalize">{part}</span>
                        <span className="text-purple-400">
                          {(value * 100).toFixed(0)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="1.5"
                        step="0.05"
                        value={value}
                        onChange={(e) =>
                          setBodyScale((prev) => ({
                            ...prev,
                            [part]: parseFloat(e.target.value),
                          }))
                        }
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Limb Visibility (Amputees/Phantom Pain) */}
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                  <span>👻</span> Limb Visibility (for Amputees)
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                  Toggle off limbs that have been amputated. You can still
                  document phantom pain sensations in these areas.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(showPhantomLimbs).map(([limb, visible]) => (
                    <label
                      key={limb}
                      className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900/70 transition-colors"
                    >
                      <span className="text-gray-300 capitalize">
                        {limb.replace(/([A-Z])/g, " $1").trim()}
                      </span>
                      <button
                        onClick={() =>
                          setShowPhantomLimbs((prev) => ({
                            ...prev,
                            [limb]: !prev[limb],
                          }))
                        }
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          visible ? "bg-green-600" : "bg-red-600"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            visible ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </label>
                  ))}
                </div>
              </div>

              {/* Zoom & Rotation */}
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                  <span>🔍</span> View Controls
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-300">Zoom</span>
                      <span className="text-purple-400">
                        {(zoom * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setZoom((prev) => Math.max(0.5, prev - 0.1))
                        }
                        className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
                      >
                        −
                      </button>
                      <input
                        type="range"
                        min="0.5"
                        max="2"
                        step="0.1"
                        value={zoom}
                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                        className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                      />
                      <button
                        onClick={() =>
                          setZoom((prev) => Math.min(2, prev + 0.1))
                        }
                        className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Standard Views Section - Replaces rotation */}
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-300">Standard Views</span>
                      <span className="text-purple-400 text-xs">
                        (matches VA DBQ diagrams)
                      </span>
                    </div>
                    <div
                      className="grid grid-cols-4 gap-2"
                      role="group"
                      aria-label="Body view selector"
                    >
                      {Object.entries(STANDARD_VIEWS).map(([key, viewData]) => (
                        <button
                          key={key}
                          onClick={() => setView(key)}
                          className={`p-2 rounded-lg text-center transition-all border-2 ${
                            view === key
                              ? "bg-purple-600 border-purple-400 text-white"
                              : "bg-gray-700 border-gray-600 text-gray-300 hover:border-purple-500"
                          }`}
                          aria-pressed={view === key}
                          aria-label={`${viewData.name} - Press ${viewData.shortcut}`}
                        >
                          <span className="text-lg block">{viewData.icon}</span>
                          <span className="text-xs">
                            {viewData.name.split(" ")[0]}
                          </span>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      ⌨️ Keyboard:{" "}
                      <kbd className="px-1 bg-gray-700 rounded">F</kbd>ront,{" "}
                      <kbd className="px-1 bg-gray-700 rounded">B</kbd>ack,{" "}
                      <kbd className="px-1 bg-gray-700 rounded">L</kbd>eft,{" "}
                      <kbd className="px-1 bg-gray-700 rounded">R</kbd>ight
                    </p>
                    <button
                      onClick={() => {
                        setZoom(1);
                        setView("front");
                      }}
                      className="mt-2 text-xs text-purple-400 hover:text-purple-300"
                    >
                      Reset View
                    </button>
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700">
                <h3 className="text-lg font-bold text-white mb-3">Preview</h3>
                <div className="max-h-64 overflow-hidden">
                  {renderBodySVG()}
                </div>
              </div>
            </div>
          )}

          {/* PAIN MAP TAB */}
          {activeTab === "map" && (
            <>
              {/* Mode Toggle & Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4 mb-4 sm:mb-6">
                {/* Standard Views Toggle - WCAG Compliant */}
                <div
                  className="flex bg-gray-800 rounded-lg p-1"
                  role="tablist"
                  aria-label="Body view selector"
                >
                  {Object.entries(STANDARD_VIEWS).map(([key, viewData]) => (
                    <button
                      key={key}
                      role="tab"
                      onClick={() => setView(key)}
                      aria-selected={view === key}
                      aria-label={`${viewData.name} - Press ${viewData.shortcut}`}
                      tabIndex={view === key ? 0 : -1}
                      className={`px-2 sm:px-3 py-2 rounded-md transition-colors flex items-center gap-1 sm:gap-1.5 min-w-[60px] justify-center ${
                        view === key
                          ? "bg-blue-600 text-white"
                          : "text-gray-400 hover:text-white hover:bg-gray-700"
                      }`}
                    >
                      <span className="text-base">{viewData.icon}</span>
                      <span className="hidden sm:inline text-xs sm:text-sm">
                        {viewData.name.split(" ")[0]}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Mode Toggle */}
                <div className="flex bg-gray-800 rounded-lg p-1">
                  <button
                    onClick={() => setMode("select")}
                    className={`px-3 sm:px-4 py-2 rounded-md transition-colors flex items-center gap-1 sm:gap-2 text-xs sm:text-sm ${
                      mode === "select"
                        ? "bg-green-600 text-white"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <span>👆</span>{" "}
                    <span className="hidden xs:inline">Select</span>
                  </button>
                  <button
                    onClick={() => setMode("paint")}
                    className={`px-3 sm:px-4 py-2 rounded-md transition-colors flex items-center gap-1 sm:gap-2 text-xs sm:text-sm ${
                      mode === "paint"
                        ? "bg-pink-600 text-white"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <span>🎨</span>{" "}
                    <span className="hidden xs:inline">Paint</span>
                  </button>
                </div>

                {/* Quick Zoom Controls */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setZoom((prev) => Math.max(0.5, prev - 0.1))}
                    className="p-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
                    aria-label="Zoom Out"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"
                      />
                    </svg>
                  </button>
                  <span className="text-xs text-gray-400 w-10 text-center">
                    {(zoom * 100).toFixed(0)}%
                  </span>
                  <button
                    onClick={() => setZoom((prev) => Math.min(2, prev + 0.1))}
                    className="p-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
                    aria-label="Zoom In"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Pain Type Selector (Paint Mode) */}
              {mode === "paint" && (
                <div className="mb-6 p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                  <p className="text-sm text-gray-400 mb-3">
                    Select pain type to paint:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(PAIN_TYPES).map(
                      ([type, { color, name, emoji }]) => (
                        <button
                          key={type}
                          onClick={() => setSelectedPainType(type)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                            selectedPainType === type
                              ? "border-white bg-gray-700"
                              : "border-gray-600 hover:border-gray-500"
                          }`}
                          style={{
                            borderColor:
                              selectedPainType === type ? color : undefined,
                          }}
                        >
                          <span>{emoji}</span>
                          <span className="text-white">{name}</span>
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                        </button>
                      ),
                    )}
                  </div>
                </div>
              )}

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Body Map */}
                <div
                  ref={bodyMapRef}
                  className="bg-gray-800/30 rounded-xl p-6 border border-gray-700"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white">
                      {view === "front" ? "🧍 Front View" : "🧍 Back View"}
                    </h3>
                    <button
                      onClick={() => setPainPoints({})}
                      className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 rounded-lg border border-red-500/40 flex items-center gap-2 transition-colors"
                      aria-label="Clear all pain points from the map"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                      <span className="font-semibold">🧹 Tactical Reset</span>
                    </button>
                  </div>

                  {renderBodySVG()}

                  {/* Pain Legend */}
                  {Object.keys(painPoints).length > 0 && (
                    <div className="mt-4 p-3 bg-gray-900/50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-2">
                        Active pain points:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(painPoints).map(([region, pain]) => (
                          <span
                            key={region}
                            className="text-xs px-2 py-1 rounded"
                            style={{
                              backgroundColor:
                                PAIN_TYPES[pain.type].color + "30",
                              color: PAIN_TYPES[pain.type].color,
                            }}
                          >
                            {PAIN_TYPES[pain.type].emoji}{" "}
                            {region.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Info Panel */}
                <div className="space-y-4">
                  {/* Diagnostic Codes */}
                  <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700">
                    {renderDiagnosticCodes()}
                  </div>

                  {/* Nexus Suggestions */}
                  {renderNexusSuggestions()}
                </div>
              </div>

              {/* Export & Save Buttons */}
              <div className="mt-6 flex justify-center gap-4">
                <button
                  onClick={() => setShowSaveModal(true)}
                  disabled={Object.keys(painPoints).length === 0}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                    />
                  </svg>
                  Save to My Packet
                </button>
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white font-semibold rounded-xl transition-all"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Export Pain Map for Doctor
                </button>
              </div>
            </>
          )}

          {/* Save Modal */}
          {showSaveModal && (
            <div className="fixed inset-0 bg-black/70 z-60 flex items-center justify-center p-4">
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full">
                {saveSuccess ? (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg
                        className="w-8 h-8 text-green-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">
                      Saved!
                    </h3>
                    <p className="text-gray-400">
                      Your pain map has been saved to My Packet
                    </p>
                  </div>
                ) : (
                  <>
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                      <span>💾</span> Save Pain Map
                    </h3>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Name this pain map (optional)
                      </label>
                      <input
                        type="text"
                        value={saveName}
                        onChange={(e) => setSaveName(e.target.value)}
                        placeholder={`Pain Map - ${new Date().toLocaleDateString()}`}
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div className="bg-gray-800/50 rounded-lg p-3 mb-4">
                      <p className="text-sm text-gray-400 mb-2">
                        This will save:
                      </p>
                      <ul className="text-sm text-gray-300 space-y-1">
                        <li>
                          • {Object.keys(painPoints).length} pain point
                          {Object.keys(painPoints).length !== 1 ? "s" : ""}
                        </li>
                        <li>• View: {view === "front" ? "Front" : "Back"}</li>
                        {detectedNexus.length > 0 && (
                          <li>
                            • {detectedNexus.length} nexus pattern
                            {detectedNexus.length !== 1 ? "s" : ""} detected
                          </li>
                        )}
                      </ul>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowSaveModal(false)}
                        className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveToPacket}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                      >
                        Save to My Packet
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 bg-gray-800/50 rounded-b-2xl border-t border-gray-700">
          <p className="text-xs text-gray-500 text-center">
            💡 Pro Tip: Use this map during C&P exams to clearly communicate all
            affected areas
          </p>
        </div>
      </div>
    </div>
  );
};

export default PainPainter;
