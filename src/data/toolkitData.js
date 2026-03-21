/**
 * Toolkit Data - Single Source of Truth
 *
 * This file defines all tools in the Vet-Rate.org arsenal.
 * Used by: AboutUs.jsx, and should match README.md
 *
 * CATEGORY METHODOLOGY:
 * 1. CALCULATE (Blue) - Number-crunching tools that compute ratings, pay, scenarios
 * 2. DISCOVER (Teal) - Research tools to find conditions, connections, exposures
 * 3. BUILD EVIDENCE (Violet) - Document analysis, statement generation, evidence capture
 * 4. QUALITY CONTROL (Rose) - Review, verification, stress-testing before submission
 * 5. MAXIMIZE (Amber) - Strategic tools to increase benefits (TDIU, PACT, appeals)
 * 6. SUPPORT (Sky) - External resources, data management, help finding
 *
 * To update: Edit this file and regenerate README.md tool section if needed.
 */

export const TOOLKIT_CATEGORIES = [
  {
    id: "ratingCalculators",
    emoji: "📊",
    title: "Calculate Your Rating",
    color: "blue",
    tools: [
      {
        name: "Tactical Calculator",
        description:
          "Advanced combined rating calculator with bilateral factors, dependents, and 2026 pay rates",
      },
      {
        name: "Million Dollar Dashboard",
        description:
          "Calculate lifetime benefit value ($1-2.5M+) and retirement projections",
      },
      {
        name: "What-If Sandbox",
        description: "Drag-and-drop rating scenario planner with real VA math",
      },
      {
        name: "Retro Pay Hunter",
        description:
          "Find missed back pay from rating history errors and CUE claims",
        isNew: true,
      },
      {
        name: "Time Machine",
        description: "Intent to File countdown with backpay tracking",
        isNew: true,
      },
    ],
  },
  {
    id: "discoveryResearch",
    emoji: "🔍",
    title: "Discover Your Claims",
    color: "teal",
    tools: [
      {
        name: "BDD Builder",
        description:
          "Pre-discharge claims planner for active duty members transitioning out (180-90 day window)",
        isNew: true,
      },
      {
        name: "Secondary Scout",
        description:
          "Discover 65+ medically-recognized secondary conditions with probability ratings",
      },
      {
        name: "C&P Exam Simulator",
        description:
          "Practice DBQ-aligned questions, view actual exam questions, and get percentage predictions",
      },
      {
        name: "Pathfinder",
        description:
          "AI-powered strategic roadmap from initial claim to appeal",
      },
      {
        name: "MOS Hazard Matcher",
        description:
          "Link military occupational specialties to exposures and conditions",
      },
      {
        name: "PACT Act Navigator",
        description:
          "Identify toxic exposure presumptive conditions and eligibility",
      },
      {
        name: "Web of Conditions",
        description:
          "Interactive force-directed graph visualization of connected disabilities",
      },
    ],
  },
  {
    id: "evidenceBuilding",
    emoji: "📋",
    title: "Build Your Evidence",
    color: "violet",
    tools: [
      {
        name: "C-File AI Analyzer",
        description:
          "Upload your Claims File PDF - AI finds evidence in thousands of pages ($500+ value)",
      },
      {
        name: "Blue Button X-Ray",
        description: "Parse VA health records for claim-relevant diagnoses",
      },
      {
        name: "PDF Evidence Finder",
        description: 'Search 2,000+ page STRs for keywords ("The Needle")',
        isNew: true,
      },
      {
        name: "Witness Bench",
        description:
          "AI-assisted buddy statement generator with smart interview questions",
      },
      {
        name: "Nexus Builder",
        description:
          "Generate medical nexus statements with optional AI enhancement",
      },
      {
        name: "Forms Helper",
        description:
          "Guided assistance for 16+ VA forms with Auto-Scribe PDF filling",
      },
      {
        name: "Symptom Logger",
        description:
          "Track daily symptoms with body map selector for evidence documentation",
      },
      {
        name: "Somatic Target",
        description:
          "Interactive body map that translates clicks into medical terminology",
      },
      {
        name: "Evidence Timeline",
        description: "Visual continuity tracker with automatic gap detection",
        isNew: true,
      },
      {
        name: "FOIA Keysmith",
        description: "Generate FOIA requests for military and VA records",
      },
    ],
  },
  {
    id: "qualityControl",
    emoji: "✅",
    title: "Quality Control",
    color: "rose",
    tools: [
      {
        name: "Red Team",
        description:
          "AI devil's advocate - finds weak language before the VA does",
      },
      {
        name: "The War Game",
        description:
          "Adversarial review - AI Skeptical Examiner stress-tests your claim",
        isNew: true,
      },
      {
        name: "Decision Decoder",
        description: "AI translation of VA decision letters to plain English",
      },
      {
        name: "Denials Decoder",
        description: "OCR scan denial letters + AI analysis (camera or upload)",
        isNew: true,
      },
      {
        name: "Shark Radar",
        description: "Identify predatory claim services and avoid scams",
      },
      {
        name: "Consistency Engine",
        description: "Auto-detect contradictions in your statements",
        isNew: true,
      },
      {
        name: "Evidence Gap Finder",
        description:
          "See exactly what evidence is missing for your target rating",
        isNew: true,
      },
      {
        name: "Risk Assessment",
        description:
          '"Poke the Bear" calculator - check protections before filing',
      },
    ],
  },
  {
    id: "maximizeStrategy",
    emoji: "💰",
    title: "Maximize Your Rating",
    color: "amber",
    tools: [
      {
        name: "TDIU Builder",
        description:
          "Total Disability Individual Unemployability - get 100% pay at lower ratings",
      },
      {
        name: "State Benefit Hunter",
        description:
          "Discover state-level veteran benefits by location (all 50 states + DC)",
      },
      {
        name: "The Tribunal",
        description: "Voice-interactive mock BVA hearing simulator",
        isNew: true,
      },
      {
        name: "Legislative Watchdog",
        description:
          "Track VA rule changes in the Federal Register - never miss a new presumptive",
      },
    ],
  },
  {
    id: "supportResources",
    emoji: "🤝",
    title: "Support & Resources",
    color: "sky",
    tools: [
      {
        name: "VSO Finder",
        description: "Locate free, accredited Veterans Service Officers",
      },
      {
        name: "The Bunker",
        description: "Export/import all your data - never lose your work",
        isNew: true,
      },
      {
        name: "Cloud Sync",
        description: "Back up to YOUR Google Drive (encrypted)",
        isNew: true,
      },
      {
        name: "VA.gov Integration",
        description:
          "Connect to VA.gov APIs - view claims, service history, and appeals (Demo Ready)",
        isNew: true,
      },
      {
        name: "My Packet",
        description: "Save and manage all your claims evidence in one place",
      },
      {
        name: "Knowledge Base",
        description: "AI-powered knowledge graph built from your documents",
        isNew: true,
      },
      {
        name: "VA Resources Hub",
        description:
          "Direct links to official VA programs, crisis support, and benefits",
      },
      {
        name: "Field Manual",
        description: "Comprehensive guide to using every feature",
      },
    ],
  },
];

// Helper to get total tool count
export const getTotalToolCount = () => {
  return TOOLKIT_CATEGORIES.reduce(
    (total, category) => total + category.tools.length,
    0,
  );
};

// Helper to get tool count by category
export const getToolCountByCategory = (categoryId) => {
  const category = TOOLKIT_CATEGORIES.find((c) => c.id === categoryId);
  return category ? category.tools.length : 0;
};

// Helper to get all new tools
export const getNewTools = () => {
  return TOOLKIT_CATEGORIES.flatMap((category) =>
    category.tools
      .filter((tool) => tool.isNew)
      .map((tool) => ({
        ...tool,
        category: category.title,
      })),
  );
};

export default TOOLKIT_CATEGORIES;
