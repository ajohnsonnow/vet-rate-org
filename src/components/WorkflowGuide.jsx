/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 *
 * WorkflowGuide Component
 * "Mission Briefings" - Guided workflows for every VA claims process
 * Maps out step-by-step paths through all available tools
 */

import { useState, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import {
  X,
  ChevronRight,
  CheckCircle,
  Play,
  Map,
  FileText,
  TrendingUp,
  GitBranch,
  Scale,
  Stethoscope,
  Shield,
  Award,
  Clock,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import ResponsiveModal from "./common/ResponsiveModal";

// Storage key for workflow progress
const WORKFLOW_PROGRESS_KEY = "vet_rate_workflow_progress";

// ============================================
// WORKFLOW DEFINITIONS
// ============================================
const WORKFLOWS = {
  getting_started: {
    id: "getting_started",
    title: "Getting Started: Import Your DD214",
    subtitle: "Your first mission - upload your discharge papers",
    icon: FileText,
    color: "green",
    bgGradient: "from-green-600 to-green-800",
    borderColor: "border-green-500",
    description:
      "Start your VA claims journey by uploading your DD214. This auto-fills your service information across all tools and unlocks MOS-specific hazards.",
    estimatedTime: "5 minutes",
    difficulty: "Beginner",
    steps: [
      {
        id: "locate",
        title: "Locate Your DD214",
        description:
          "Find your DD Form 214 (Certificate of Release or Discharge from Active Duty). Check your files, VA.gov, or ebenefits.",
        tool: null,
        toolName: null,
        critical: true,
        tip: "If you can't find it, request a copy from the National Archives or your state VA office.",
      },
      {
        id: "upload",
        title: "Upload DD214 to Analyzer",
        description:
          "Drop your DD214 PDF into the DD214 Analyzer. It will extract your service dates, MOS, awards, and deployment info.",
        tool: "dd214-analyzer",
        toolName: "DD214 Analyzer",
        critical: true,
        tip: "The analyzer reads BOTH image PDFs and text-based PDFs. Drag and drop or click to upload.",
      },
      {
        id: "review",
        title: "Review Extracted Data",
        description:
          "Check the extracted information for accuracy. The AI reads your DD214 and fills in your veteran profile automatically.",
        tool: "dd214-analyzer",
        toolName: "DD214 Analyzer",
        tip: "Verify dates, MOS codes, and awards match your actual records.",
      },
      {
        id: "save",
        title: "Save to My Packet",
        description:
          "Save the uploaded DD214 to My Packet for easy access. This will be required for most VA claims.",
        tool: "my-packet",
        toolName: "My Packet",
        tip: "Your DD214 stays in your browser - it's never sent to any server.",
      },
      {
        id: "explore",
        title: "Explore MOS Hazards",
        description:
          "Check the MOS Hazard Matcher to see conditions commonly linked to your military job.",
        tool: "mos-hazard",
        toolName: "MOS Hazard Matcher",
        tip: "Your MOS code unlocks specific hazards and conditions you may have been exposed to.",
      },
      {
        id: "timeline",
        title: "Build Service Timeline",
        description:
          "Create a visual timeline of your deployments, injuries, and key events from your DD214 data.",
        tool: "timeline-wizard",
        toolName: "Timeline Wizard",
        tip: "This timeline helps prove in-service events for your claims.",
      },
    ],
  },

  original_claim: {
    id: "original_claim",
    title: "Filing an Original Claim",
    subtitle: "First time claiming a condition",
    icon: FileText,
    color: "blue",
    bgGradient: "from-blue-600 to-blue-800",
    borderColor: "border-blue-500",
    description:
      "Complete workflow for veterans filing their first disability claim for a condition.",
    estimatedTime: "2-4 weeks preparation",
    difficulty: "Standard",
    steps: [
      {
        id: "itf",
        title: "File Intent to File (ITF)",
        description:
          "Lock in your effective date for potential backpay. This is CRITICAL - do it first!",
        tool: "forms-helper",
        toolName: "Forms Helper",
        form: "VA Form 21-0966",
        critical: true,
        tip: "You have 1 year from ITF to submit your full claim. File this TODAY.",
      },
      {
        id: "profile",
        title: "Complete Veteran Profile",
        description: "Enter your service dates, branch, and basic information.",
        tool: "veteran-profile",
        toolName: "Veteran Profile",
        tip: "This info auto-fills across all tools, saving you time.",
      },
      {
        id: "conditions",
        title: "Identify Your Conditions",
        description:
          "Search the VA rating database to find your diagnoses and understand rating criteria.",
        tool: "conditions-search",
        toolName: "Conditions Search",
        tip: "Look up exact diagnostic codes - they matter for your rating.",
      },
      {
        id: "calculator",
        title: "Calculate Potential Rating",
        description:
          "Use the VA math calculator to estimate your combined rating percentage.",
        tool: "tactical-calculator",
        toolName: "Tactical Calculator",
        tip: 'VA uses "fuzzy math" - 50% + 30% does NOT equal 80%!',
      },
      {
        id: "secondary",
        title: "Discover Secondary Conditions",
        description:
          "Find conditions caused by your primary disability for additional compensation.",
        tool: "secondary-scout",
        toolName: "Secondary Scout",
        tip: "Many veterans miss secondary conditions worth thousands in backpay.",
      },
      {
        id: "evidence",
        title: "Build Your Evidence Package",
        description:
          'Gather the "Big 3": Diagnosis, Nexus Letter, and In-Service Event proof.',
        tool: "my-packet",
        toolName: "My Packet",
        tip: "The strongest claims have all three types of evidence.",
      },
      {
        id: "nexus",
        title: "Generate Nexus Letter",
        description:
          "Create a medical opinion linking your condition to military service.",
        tool: "nexus-builder",
        toolName: "Nexus Builder",
        tip: 'This is the "missing link" that connects diagnosis to service.',
      },
      {
        id: "statement",
        title: "Write Personal Statement",
        description:
          "Document how your condition affects your daily life in your own words.",
        tool: "statement-analyzer",
        toolName: "Statement Analyzer",
        tip: "Be honest and detailed. The VA MUST consider your testimony.",
      },
      {
        id: "buddy",
        title: "Get Buddy Statements",
        description:
          "Collect statements from family, friends, or fellow service members.",
        tool: "witness-bench",
        toolName: "Witness Bench",
        tip: "Third-party observations add credibility to your claim.",
      },
      {
        id: "cp_prep",
        title: "Prepare for C&P Exam",
        description: "Practice for your Compensation & Pension examination.",
        tool: "the-tribunal",
        toolName: "The Tribunal",
        tip: "Do NOT downplay symptoms. Describe your WORST days.",
      },
      {
        id: "submit",
        title: "Submit Your Claim",
        description: "File VA Form 21-526EZ with all supporting evidence.",
        tool: "forms-helper",
        toolName: "Forms Helper",
        form: "VA Form 21-526EZ",
        tip: "Submit via VA.gov, mail, or in-person at regional office.",
      },
    ],
  },

  claim_increase: {
    id: "claim_increase",
    title: "Filing for an Increase",
    subtitle: "Condition has gotten worse",
    icon: TrendingUp,
    color: "amber",
    bgGradient: "from-amber-600 to-amber-800",
    borderColor: "border-amber-500",
    description:
      "When a service-connected condition worsens, you can file for an increased rating.",
    estimatedTime: "1-2 weeks preparation",
    difficulty: "Moderate",
    steps: [
      {
        id: "itf",
        title: "File Intent to File (ITF)",
        description: "Protect your effective date for the increased rating.",
        tool: "forms-helper",
        toolName: "Forms Helper",
        form: "VA Form 21-0966",
        critical: true,
        tip: "Start the clock on backpay from today.",
      },
      {
        id: "current_rating",
        title: "Review Current Rating Criteria",
        description:
          "Understand what rating level you currently have and what the next level requires.",
        tool: "conditions-search",
        toolName: "Conditions Search",
        tip: "Know the exact criteria for the rating you want.",
      },
      {
        id: "symptoms",
        title: "Document Worsened Symptoms",
        description:
          "Log how your symptoms have increased in frequency or severity.",
        tool: "symptom-logger",
        toolName: "Symptom Logger",
        tip: "Track patterns over time to show worsening.",
      },
      {
        id: "calculator",
        title: "Calculate New Potential Rating",
        description:
          "See how an increase would affect your overall combined rating.",
        tool: "tactical-calculator",
        toolName: "Tactical Calculator",
        tip: "Sometimes a small increase can bump you to a higher tier.",
      },
      {
        id: "evidence",
        title: "Gather New Medical Evidence",
        description: "Get recent treatment records showing worsened condition.",
        tool: "my-packet",
        toolName: "My Packet",
        tip: "Recent evidence within last 6-12 months is most persuasive.",
      },
      {
        id: "statement",
        title: "Write Updated Statement",
        description:
          "Explain how your condition has worsened since last rating.",
        tool: "statement-analyzer",
        toolName: "Statement Analyzer",
        tip: "Compare then vs now - be specific about the decline.",
      },
      {
        id: "cp_prep",
        title: "Prepare for New C&P Exam",
        description: "You will likely be re-examined. Prepare thoroughly.",
        tool: "the-tribunal",
        toolName: "The Tribunal",
        critical: true,
        tip: "Focus on worst-day symptoms and functional limitations.",
      },
      {
        id: "submit",
        title: "Submit Increase Claim",
        description: "File claim for increased compensation.",
        tool: "forms-helper",
        toolName: "Forms Helper",
        form: "VA Form 21-526EZ",
        tip: 'Check "Claim for Increase" on the form.',
      },
    ],
  },

  secondary_claim: {
    id: "secondary_claim",
    title: "Filing a Secondary Claim",
    subtitle: "Condition caused by existing disability",
    icon: GitBranch,
    color: "teal",
    bgGradient: "from-teal-600 to-teal-800",
    borderColor: "border-teal-500",
    description:
      "Claim conditions that were caused or aggravated by your service-connected disabilities.",
    estimatedTime: "2-3 weeks preparation",
    difficulty: "Moderate",
    steps: [
      {
        id: "itf",
        title: "File Intent to File (ITF)",
        description: "Protect your effective date for the secondary condition.",
        tool: "forms-helper",
        toolName: "Forms Helper",
        form: "VA Form 21-0966",
        critical: true,
        tip: "Start the backpay clock immediately.",
      },
      {
        id: "discover",
        title: "Discover Secondary Conditions",
        description:
          "Find medically-recognized connections between your rated conditions and new ones.",
        tool: "secondary-scout",
        toolName: "Secondary Scout",
        tip: "Many conditions have documented medical links - find yours.",
      },
      {
        id: "web",
        title: "Map Your Condition Web",
        description: "Visualize how your conditions connect to each other.",
        tool: "web-of-conditions",
        toolName: "Web of Conditions",
        tip: "See the full picture of connected conditions.",
      },
      {
        id: "calculator",
        title: "Calculate Combined Impact",
        description:
          "See how adding secondary conditions affects your total rating.",
        tool: "tactical-calculator",
        toolName: "Tactical Calculator",
        tip: "Multiple conditions combine to higher overall rating.",
      },
      {
        id: "evidence",
        title: "Build Evidence Package",
        description:
          "Gather diagnosis and proof of the connection to your primary condition.",
        tool: "my-packet",
        toolName: "My Packet",
        tip: "You need both a diagnosis AND proof of causation.",
      },
      {
        id: "nexus",
        title: "Generate Secondary Nexus",
        description:
          "Create a medical opinion showing the secondary relationship.",
        tool: "nexus-builder",
        toolName: "Nexus Builder",
        critical: true,
        tip: "The nexus must explain how Condition A caused/worsened Condition B.",
      },
      {
        id: "statement",
        title: "Write Supporting Statement",
        description:
          "Explain in your own words how your conditions are related.",
        tool: "statement-analyzer",
        toolName: "Statement Analyzer",
        tip: "Describe the timeline - when did secondary symptoms start?",
      },
      {
        id: "submit",
        title: "Submit Secondary Claim",
        description: "File your secondary condition claim.",
        tool: "forms-helper",
        toolName: "Forms Helper",
        form: "VA Form 21-526EZ",
        tip: "Clearly identify the primary condition it's secondary to.",
      },
    ],
  },

  fighting_denial: {
    id: "fighting_denial",
    title: "Fighting a Denial",
    subtitle: "Appealing an unfavorable decision",
    icon: Scale,
    color: "rose",
    bgGradient: "from-rose-600 to-rose-800",
    borderColor: "border-rose-500",
    description:
      "Complete workflow for challenging a VA denial and winning on appeal.",
    estimatedTime: "2-6 weeks (deadline dependent)",
    difficulty: "Advanced",
    steps: [
      {
        id: "deadline",
        title: "CHECK YOUR DEADLINE",
        description:
          "You have exactly 1 YEAR from decision date to appeal. Verify your deadline NOW.",
        tool: "claim-navigator",
        toolName: "Claim Navigator",
        critical: true,
        tip: "CRITICAL: Miss this deadline and you lose appeal rights!",
      },
      {
        id: "decode",
        title: "Decode the Denial",
        description:
          "Understand exactly WHY you were denied - the specific reasons matter.",
        tool: "denial-decoder",
        toolName: "Denial Decoder",
        tip: "The denial letter contains clues on how to win.",
      },
      {
        id: "choose_lane",
        title: "Choose Appeal Lane",
        description: "Decide between Supplemental Claim, HLR, or Board Appeal.",
        tool: "claim-navigator",
        toolName: "Claim Navigator",
        tip: "Supplemental = new evidence. HLR = procedural error. Board = judge review.",
      },
      {
        id: "analyze",
        title: "Analyze What Went Wrong",
        description: "Review your original claim to find weaknesses.",
        tool: "cfile-analyzer",
        toolName: "C-File Analyzer",
        tip: "Often denials happen due to missing nexus or weak evidence.",
      },
      {
        id: "new_evidence",
        title: "Gather NEW Evidence",
        description:
          "You need NEW and RELEVANT evidence for a Supplemental Claim.",
        tool: "my-packet",
        toolName: "My Packet",
        critical: true,
        tip: "Same evidence = same result. You need something new.",
      },
      {
        id: "nexus",
        title: "Get Stronger Nexus Letter",
        description:
          "A stronger medical opinion can overcome the previous denial.",
        tool: "nexus-builder",
        toolName: "Nexus Builder",
        tip: "Address the specific denial reason in your nexus.",
      },
      {
        id: "statement",
        title: "Write Rebuttal Statement",
        description: "Directly address and counter each denial reason.",
        tool: "statement-analyzer",
        toolName: "Statement Analyzer",
        tip: "Quote the denial reason and explain why it's wrong.",
      },
      {
        id: "buddy",
        title: "Add Buddy Statements",
        description:
          "Third-party evidence can fill gaps in your original claim.",
        tool: "witness-bench",
        toolName: "Witness Bench",
        tip: "Witnesses can verify things you couldn't prove before.",
      },
      {
        id: "submit",
        title: "Submit Appeal",
        description:
          "File the appropriate appeal form based on your chosen lane.",
        tool: "forms-helper",
        toolName: "Forms Helper",
        form: "VA Form 20-0995/20-0996/10182",
        tip: "Double-check you're filing the correct form for your lane.",
      },
    ],
  },

  cp_exam_prep: {
    id: "cp_exam_prep",
    title: "C&P Exam Preparation",
    subtitle: "Getting ready for your examination",
    icon: Stethoscope,
    color: "violet",
    bgGradient: "from-violet-600 to-violet-800",
    borderColor: "border-violet-500",
    description:
      "The C&P exam often determines your rating. Prepare thoroughly to get an accurate assessment.",
    estimatedTime: "3-7 days before exam",
    difficulty: "Critical",
    steps: [
      {
        id: "understand",
        title: "Understand the C&P Process",
        description:
          "Learn what happens during a C&P exam and what the examiner is looking for.",
        tool: "cp-simulator",
        toolName: "C&P Simulator",
        tip: "The examiner uses DBQs - know what they're measuring.",
      },
      {
        id: "criteria",
        title: "Review Rating Criteria",
        description:
          "Know the exact symptoms and limitations that qualify for each rating level.",
        tool: "conditions-search",
        toolName: "Conditions Search",
        critical: true,
        tip: "Memorize the criteria for the rating you deserve.",
      },
      {
        id: "symptoms",
        title: "Document Your Symptoms",
        description:
          "Create a detailed log of your symptoms to reference during the exam.",
        tool: "symptom-logger",
        toolName: "Symptom Logger",
        tip: "Bring this log to the exam - you're allowed notes.",
      },
      {
        id: "practice",
        title: "Practice Exam Questions",
        description: "Rehearse answers to common C&P exam questions.",
        tool: "the-tribunal",
        toolName: "The Tribunal",
        critical: true,
        tip: "Practice describing your WORST days, not average days.",
      },
      {
        id: "statement",
        title: "Prepare Written Summary",
        description:
          "Have a written statement ready in case you forget something.",
        tool: "statement-analyzer",
        toolName: "Statement Analyzer",
        tip: "You can hand the examiner a written summary.",
      },
      {
        id: "evidence",
        title: "Bring Supporting Documents",
        description: "Bring copies of key evidence to the exam.",
        tool: "my-packet",
        toolName: "My Packet",
        tip: "Bring buddy statements, treatment records, and your nexus letter.",
      },
      {
        id: "checklist",
        title: "Pre-Exam Checklist",
        description: "Review everything the night before your exam.",
        tool: "commanders-checklist",
        toolName: "Commander's Checklist",
        tip: "Get good sleep, arrive early, and be honest about your worst days.",
      },
    ],
  },

  tdiu_claim: {
    id: "tdiu_claim",
    title: "Filing for TDIU",
    subtitle: "Total Disability Individual Unemployability",
    icon: Shield,
    color: "sky",
    bgGradient: "from-sky-600 to-sky-800",
    borderColor: "border-sky-500",
    description:
      "If your service-connected disabilities prevent you from maintaining gainful employment, you may qualify for TDIU (100% pay without 100% rating).",
    estimatedTime: "2-4 weeks preparation",
    difficulty: "Advanced",
    steps: [
      {
        id: "eligibility",
        title: "Check TDIU Eligibility",
        description:
          "Verify you meet the rating thresholds: 60% single or 70% combined (with one 40%+).",
        tool: "tactical-calculator",
        toolName: "Tactical Calculator",
        tip: "Even if you don't meet thresholds, you may qualify for extraschedular TDIU.",
      },
      {
        id: "itf",
        title: "File Intent to File",
        description: "Protect your effective date for TDIU benefits.",
        tool: "forms-helper",
        toolName: "Forms Helper",
        form: "VA Form 21-0966",
        critical: true,
        tip: "TDIU backpay can be substantial - protect your date.",
      },
      {
        id: "work_history",
        title: "Document Work History",
        description: "Gather employment records showing your work limitations.",
        tool: "tdiu-builder",
        toolName: "TDIU Builder",
        tip: "Document failed work attempts and reasons for leaving jobs.",
      },
      {
        id: "impact",
        title: "Document Functional Impact",
        description:
          "Show how disabilities prevent sedentary AND physical work.",
        tool: "tdiu-builder",
        toolName: "TDIU Builder",
        critical: true,
        tip: "You must show inability to maintain ANY gainful employment.",
      },
      {
        id: "statement",
        title: "Write TDIU Statement",
        description:
          "Explain in detail why you cannot work due to your disabilities.",
        tool: "statement-analyzer",
        toolName: "Statement Analyzer",
        tip: "Describe a typical day and why work is impossible.",
      },
      {
        id: "nexus",
        title: "Get Unemployability Opinion",
        description:
          "Medical opinion stating your disabilities prevent employment.",
        tool: "nexus-builder",
        toolName: "Nexus Builder",
        tip: "Have your doctor specifically address work capacity.",
      },
      {
        id: "employer",
        title: "Get Employer Statements",
        description:
          "Request statements from former employers about why you left.",
        tool: "witness-bench",
        toolName: "Witness Bench",
        tip: "Employer verification strengthens your case significantly.",
      },
      {
        id: "submit",
        title: "Submit TDIU Claim",
        description: "File VA Form 21-8940 with all supporting documentation.",
        tool: "forms-helper",
        toolName: "Forms Helper",
        form: "VA Form 21-8940",
        tip: "Be completely honest about any income you receive.",
      },
    ],
  },

  pact_act: {
    id: "pact_act",
    title: "PACT Act Toxic Exposure",
    subtitle: "Burn pits, Agent Orange, contaminated water",
    icon: AlertTriangle,
    color: "orange",
    bgGradient: "from-orange-600 to-orange-800",
    borderColor: "border-orange-500",
    description:
      "The PACT Act (2022) expanded benefits for toxic exposure. If you served near burn pits, Agent Orange areas, or contaminated bases, you may have presumptive conditions.",
    estimatedTime: "1-3 weeks preparation",
    difficulty: "Standard (Presumptive)",
    steps: [
      {
        id: "eligibility",
        title: "Check PACT Act Eligibility",
        description:
          "Verify your service locations and dates qualify under PACT Act.",
        tool: "pact-navigator",
        toolName: "PACT Navigator",
        critical: true,
        tip: "PACT Act covers Gulf War, Post-9/11, Vietnam, and more.",
      },
      {
        id: "itf",
        title: "File Intent to File",
        description:
          "Lock in your effective date - especially important for presumptive claims.",
        tool: "forms-helper",
        toolName: "Forms Helper",
        form: "VA Form 21-0966",
        critical: true,
        tip: "PACT Act claims may be backdated - protect your date NOW.",
      },
      {
        id: "conditions",
        title: "Identify Presumptive Conditions",
        description:
          "Find which of your conditions are presumptive under PACT Act.",
        tool: "conditions-search",
        toolName: "Conditions Search",
        tip: "Presumptive = no nexus needed, just diagnosis + eligible service.",
      },
      {
        id: "exposure",
        title: "Document Exposure",
        description:
          "Gather evidence of your toxic exposure locations and dates.",
        tool: "mos-hazard-matcher",
        toolName: "MOS Hazard Matcher",
        tip: "Your DD-214 and service records show locations.",
      },
      {
        id: "diagnosis",
        title: "Get Current Diagnosis",
        description: "Obtain formal diagnosis for your presumptive conditions.",
        tool: "my-packet",
        toolName: "My Packet",
        tip: "Presumptive only needs diagnosis - no nexus required!",
      },
      {
        id: "statement",
        title: "Write Exposure Statement",
        description: "Document your specific toxic exposure experiences.",
        tool: "statement-analyzer",
        toolName: "Statement Analyzer",
        tip: "Describe what you saw, smelled, and were exposed to.",
      },
      {
        id: "submit",
        title: "Submit PACT Act Claim",
        description: "File your toxic exposure claim.",
        tool: "forms-helper",
        toolName: "Forms Helper",
        form: "VA Form 21-526EZ",
        tip: "Mark as PACT Act claim - these get priority processing.",
      },
    ],
  },

  retro_pay: {
    id: "retro_pay",
    title: "Hunting Retroactive Pay",
    subtitle: "Find money the VA owes you",
    icon: Award,
    color: "emerald",
    bgGradient: "from-emerald-600 to-emerald-800",
    borderColor: "border-emerald-500",
    description:
      "Veterans often have backdated effective dates they don't know about. Find out if the VA owes you retroactive pay.",
    estimatedTime: "1-2 weeks research",
    difficulty: "Research-Heavy",
    steps: [
      {
        id: "understand",
        title: "Understand Effective Dates",
        description: "Learn how effective dates work and when backpay applies.",
        tool: "retro-pay-hunter",
        toolName: "Retro Pay Hunter",
        tip: "Effective date = when your benefits start, even if decided later.",
      },
      {
        id: "review",
        title: "Review Your Rating History",
        description: "Look at all your past decisions for potential errors.",
        tool: "cfile-analyzer",
        toolName: "C-File Analyzer",
        tip: "Request your C-File from the VA if you don't have it.",
      },
      {
        id: "calculate",
        title: "Calculate Potential Backpay",
        description: "Use the backpay calculator to see what you may be owed.",
        tool: "backpay-calculator",
        toolName: "Backpay Calculator",
        tip: "Backpay can add up to tens of thousands of dollars.",
      },
      {
        id: "cue",
        title: "Check for Clear & Unmistakable Error",
        description:
          "Look for CUE errors in past decisions that can be challenged.",
        tool: "denial-decoder",
        toolName: "Denial Decoder",
        tip: "CUE claims have no time limit - you can file anytime.",
      },
      {
        id: "evidence",
        title: "Gather Supporting Evidence",
        description:
          "Collect documents showing earlier effective date should apply.",
        tool: "my-packet",
        toolName: "My Packet",
        tip: "Earlier medical records, ITF dates, and service records matter.",
      },
      {
        id: "submit",
        title: "Submit Earlier Effective Date Claim",
        description: "File for correction of effective date if warranted.",
        tool: "forms-helper",
        toolName: "Forms Helper",
        tip: "This can be filed as a CUE claim or Supplemental Claim.",
      },
    ],
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================
const loadWorkflowProgress = () => {
  try {
    const saved = localStorage.getItem(WORKFLOW_PROGRESS_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

const saveWorkflowProgress = (progress) => {
  try {
    localStorage.setItem(WORKFLOW_PROGRESS_KEY, JSON.stringify(progress));
  } catch (e) {
    console.error("Failed to save workflow progress:", e);
  }
};

// ============================================
// MAIN COMPONENT
// ============================================
export default function WorkflowGuide({ onClose, onToolSelect }) {
  // eslint-disable-next-line no-unused-vars
  const { t } = useLanguage();
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [progress, setProgress] = useState(loadWorkflowProgress);

  // Save progress when it changes
  useEffect(() => {
    saveWorkflowProgress(progress);
  }, [progress]);

  const toggleStepComplete = (workflowId, stepId) => {
    setProgress((prev) => {
      const workflowProgress = prev[workflowId] || {};
      return {
        ...prev,
        [workflowId]: {
          ...workflowProgress,
          [stepId]: !workflowProgress[stepId],
        },
      };
    });
  };

  const getWorkflowCompletion = (workflowId) => {
    const workflow = WORKFLOWS[workflowId];
    const workflowProgress = progress[workflowId] || {};
    const completed = workflow.steps.filter(
      (step) => workflowProgress[step.id],
    ).length;
    return Math.round((completed / workflow.steps.length) * 100);
  };

  const handleToolClick = (toolId) => {
    if (onToolSelect) {
      onToolSelect(toolId);
      onClose();
    }
  };

  const resetWorkflowProgress = (workflowId) => {
    setProgress((prev) => {
      const newProgress = { ...prev };
      delete newProgress[workflowId];
      return newProgress;
    });
  };

  // Workflow Selection Grid
  const WorkflowGrid = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Object.values(WORKFLOWS).map((workflow) => {
        const Icon = workflow.icon;
        const completion = getWorkflowCompletion(workflow.id);
        const hasStarted = completion > 0;

        return (
          <button
            key={workflow.id}
            onClick={() => setSelectedWorkflow(workflow.id)}
            className={`relative p-5 rounded-xl border-2 ${workflow.borderColor} bg-gradient-to-br ${workflow.bgGradient} 
              hover:scale-[1.02] transition-all duration-200 text-left group overflow-hidden`}
          >
            {/* Progress bar background */}
            <div
              className="absolute inset-0 bg-white/10 transition-all duration-500"
              style={{ width: `${completion}%` }}
            />

            <div className="relative z-10">
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded-lg bg-white/20`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                {hasStarted && (
                  <span className="text-xs font-bold text-white/90 bg-white/20 px-2 py-1 rounded-full">
                    {completion}% Complete
                  </span>
                )}
              </div>

              <h3 className="text-lg font-bold text-white mb-1">
                {workflow.title}
              </h3>
              <p className="text-white/80 text-sm mb-3">{workflow.subtitle}</p>

              <div className="flex items-center justify-between text-xs text-white/70">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {workflow.estimatedTime}
                </span>
                <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  View Steps <ChevronRight className="w-4 h-4" />
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );

  // Workflow Detail View
  const WorkflowDetail = ({ workflowId }) => {
    const workflow = WORKFLOWS[workflowId];
    const Icon = workflow.icon;
    const workflowProgress = progress[workflowId] || {};
    const completion = getWorkflowCompletion(workflowId);

    return (
      <div className="space-y-6">
        {/* Header */}
        <div
          className={`p-6 rounded-xl bg-gradient-to-br ${workflow.bgGradient} border-2 ${workflow.borderColor}`}
        >
          <button
            onClick={() => setSelectedWorkflow(null)}
            className="text-white/80 hover:text-white text-sm flex items-center gap-1 mb-4"
          >
            <ChevronRight className="w-4 h-4 rotate-180" /> Back to All
            Workflows
          </button>

          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-white/20">
              <Icon className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white mb-1">
                {workflow.title}
              </h2>
              <p className="text-white/80 mb-3">{workflow.description}</p>
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="bg-white/20 text-white px-3 py-1 rounded-full flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {workflow.estimatedTime}
                </span>
                <span className="bg-white/20 text-white px-3 py-1 rounded-full">
                  {workflow.difficulty}
                </span>
                <span className="bg-white/20 text-white px-3 py-1 rounded-full">
                  {workflow.steps.length} Steps
                </span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex justify-between text-sm text-white/80 mb-1">
              <span>Progress</span>
              <span>{completion}%</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-500"
                style={{ width: `${completion}%` }}
              />
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {workflow.steps.map((step, index) => {
            const isComplete = workflowProgress[step.id];

            return (
              <div
                key={step.id}
                className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                  isComplete
                    ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700"
                    : step.critical
                      ? "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700"
                      : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Step number / checkbox */}
                  <button
                    onClick={() => toggleStepComplete(workflowId, step.id)}
                    className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      isComplete
                        ? "bg-green-500 text-white"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                    }`}
                  >
                    {isComplete ? (
                      <CheckCircle className="w-6 h-6" />
                    ) : (
                      <span className="font-bold">{index + 1}</span>
                    )}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4
                        className={`font-bold ${isComplete ? "text-green-700 dark:text-green-300 line-through" : "text-gray-900 dark:text-white"}`}
                      >
                        {step.critical && !isComplete && (
                          <span className="text-red-500 mr-1">⚠️</span>
                        )}
                        {step.title}
                      </h4>
                      {step.form && (
                        <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">
                          {step.form}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {step.description}
                    </p>

                    {/* Tip */}
                    {step.tip && (
                      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-2 mb-3">
                        <p className="text-xs text-amber-800 dark:text-amber-300">
                          <strong>💡 Pro Tip:</strong> {step.tip}
                        </p>
                      </div>
                    )}

                    {/* Tool link */}
                    {step.tool && step.toolName && (
                      <button
                        onClick={() => handleToolClick(step.tool)}
                        className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                          isComplete
                            ? "text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                            : "text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                        }`}
                      >
                        <Play className="w-4 h-4" />
                        Open {step.toolName}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Reset button */}
        {completion > 0 && (
          <div className="text-center pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => resetWorkflowProgress(workflowId)}
              className="text-sm text-gray-500 hover:text-red-500 transition-colors"
            >
              Reset Progress for This Workflow
            </button>
          </div>
        )}
      </div>
    );
  };

  const footer = (
    <div className="flex items-center justify-between">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        💾 Progress auto-saved locally
      </p>
      <button
        onClick={onClose}
        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
      >
        Close
      </button>
    </div>
  );

  return (
    <ResponsiveModal
      isOpen
      onClose={onClose}
      size="xl"
      labelledBy="workflow-guide-title"
      header={
        <div className="bg-gradient-to-r from-gray-800 via-gray-900 to-gray-800 border-b-2 border-va-gold px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-va-gold/20 rounded-lg">
              <Map className="w-6 h-6 text-va-gold" />
            </div>
            <div>
              <h2
                id="workflow-guide-title"
                className="text-xl font-bold text-white"
              >
                🗺️ Mission Briefings{" "}
                <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded align-middle">
                  BETA
                </span>
              </h2>
              <p className="text-gray-400 text-sm">
                Step-by-step workflows for every VA process
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6 text-gray-400 hover:text-white" />
          </button>
        </div>
      }
      footer={footer}
    >
      <div>
        {selectedWorkflow ? (
          <WorkflowDetail workflowId={selectedWorkflow} />
        ) : (
          <>
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Choose Your Mission
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Select a workflow to see step-by-step guidance through the VA
                claims process. Each step links directly to the right tool.
              </p>
            </div>
            <WorkflowGrid />
          </>
        )}
      </div>
    </ResponsiveModal>
  );
}
