import React, { useState, useEffect, useRef } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { triggerBlobDownload } from "../utils/sanitize";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";
import jsPDF from "jspdf";
import ReportBugLink from "./ReportBugLink";
import BuyMeCoffee from "./BuyMeCoffee";
import AIConsentModal from "./AIConsentModal";
import VoiceInputButton, { isSpeechRecognitionSupported } from "./VoiceInput";
import ResponsiveModal from "./common/ResponsiveModal";
import { fillAndDownloadForm } from "../utils/pdfFormFiller";
import {
  enhanceFormStatement,
  getAIDataDisclosure,
} from "../utils/aiStatementHelper";
import {
  isAnyAIAvailable,
  getAIStatus,
  AI_MODES,
} from "../utils/unifiedAIService";
import { AIStatusBadge } from "./AIModeSelector";
import { LLMRecommendationBadge } from "./LLMRecommendation";
import ShareButton, { PIISensitive } from "./ShareButton";
import { markAsModified, saveOnStepComplete } from "../utils/persistentStorage";
import {
  getVeteranProfile,
  saveVeteranProfile,
  hasVeteranProfile,
  saveForm,
  getSavedForms,
  exportAllVeteranData,
  importVeteranData,
} from "../utils/veteranProfile";

/**
 * FormsHelper Component
 * Comprehensive forms wizard to help veterans fill out VA forms,
 * especially buddy/lay statements which are notoriously difficult to get.
 */
const FormsHelper = ({ onClose, onReportBug, onOpenAISettings }) => {
  const { t } = useLanguage();

  // AI Status monitoring
  const [aiStatus, setAIStatus] = useState(getAIStatus());

  useEffect(() => {
    const interval = setInterval(() => {
      setAIStatus(getAIStatus());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const [selectedForm, setSelectedForm] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({});
  const [generatedContent, setGeneratedContent] = useState(null);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  // Veteran Profile State
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [veteranProfile, setVeteranProfile] = useState({});
  const [profileSaved, setProfileSaved] = useState(false);
  const [showBackupRestore, setShowBackupRestore] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const fileInputRef = useRef(null);
  const formsContentRef = useRef(null);

  // AI Enhancement State
  const [showAIConsent, setShowAIConsent] = useState(false);
  const [isEnhancingWithAI, setIsEnhancingWithAI] = useState(false);
  const [aiEnhancedContent, setAiEnhancedContent] = useState(null);
  const [showAIVersion, setShowAIVersion] = useState(false);
  const [aiError, setAiError] = useState(null);

  // Load veteran profile on mount
  useEffect(() => {
    const profile = getVeteranProfile();
    setVeteranProfile(profile);
    // Pre-fill formData with profile data
    if (profile && Object.keys(profile).length > 0) {
      setFormData((prev) => ({
        ...prev,
        // Name fields
        veteranName:
          `${profile.firstName || ""} ${profile.middleInitial || ""} ${profile.lastName || ""}`.trim(),
        veteranFirstName: profile.firstName,
        veteranMiddleInitial: profile.middleInitial,
        veteranLastName: profile.lastName,
        fullName:
          profile.fullName ||
          `${profile.firstName || ""} ${profile.middleInitial || ""} ${profile.lastName || ""}`.trim(),

        // Identification
        ssn: profile.ssn,
        ssnLast4: profile.ssnLast4 || profile.ssn,
        ssnFull: profile.ssnFull,
        vaFileNumber: profile.vaFileNumber,
        serviceNumber: profile.serviceNumber,
        dob: profile.dob,
        placeOfBirth: profile.placeOfBirth,

        // Contact
        email: profile.email,
        phone: profile.phone,
        alternatePhone: profile.alternatePhone,

        // Address
        street: profile.street,
        apt: profile.apt,
        city: profile.city,
        state: profile.state,
        zip: profile.zip,
        country: profile.country || "United States",
        homeOfRecord: profile.homeOfRecord,

        // Military Service
        veteranBranch: profile.branch,
        branch: profile.branch,
        rankAtDischarge: profile.rankAtDischarge,
        payGrade: profile.payGrade,
        mos: profile.mos,
        mosTitle: profile.mosTitle,
        serviceStartDate: profile.serviceStartDate,
        serviceEndDate: profile.serviceEndDate,
        characterOfService: profile.characterOfService,
        separationType: profile.separationType,
      }));
    }
  }, []);

  // Handle profile field change
  const handleProfileChange = (field, value) => {
    setVeteranProfile((prev) => ({ ...prev, [field]: value }));
    setProfileSaved(false);
  };

  // Save profile
  const handleSaveProfile = () => {
    const success = saveVeteranProfile(veteranProfile);
    if (success) {
      setProfileSaved(true);
      // Update formData with new profile
      setFormData((prev) => ({
        ...prev,
        veteranName:
          `${veteranProfile.firstName || ""} ${veteranProfile.middleInitial || ""} ${veteranProfile.lastName || ""}`.trim(),
        veteranFirstName: veteranProfile.firstName,
        veteranMiddleInitial: veteranProfile.middleInitial,
        veteranLastName: veteranProfile.lastName,
        ssn: veteranProfile.ssn,
        dob: veteranProfile.dob,
        email: veteranProfile.email,
        phone: veteranProfile.phone,
        street: veteranProfile.street,
        apt: veteranProfile.apt,
        city: veteranProfile.city,
        state: veteranProfile.state,
        zip: veteranProfile.zip,
        country: veteranProfile.country || "United States",
        veteranBranch: veteranProfile.branch,
        vaFileNumber: veteranProfile.vaFileNumber,
        serviceNumber: veteranProfile.serviceNumber,
      }));
      setTimeout(() => setProfileSaved(false), 3000);
    }
  };

  // Backup all data
  const handleBackup = () => {
    const data = exportAllVeteranData();
    const jsonString = JSON.stringify(data, null, 2);
    // deepcode ignore javascript/DOMXSS: triggerBlobDownload reconstructs URL from UUID regex only — a.href is literal 'blob:' + origin + '/' + UUID, no user content reaches the DOM
    const blob = new Blob([jsonString], { type: "application/json" });
    triggerBlobDownload(
      blob,
      `vet-rate-forms-backup-${new Date().toISOString().split("T")[0]}.json`,
    );
    setImportStatus({
      type: "success",
      message: "Backup created successfully!",
    });
    setTimeout(() => setImportStatus(null), 3000);
  };

  // Restore from backup
  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      setImportStatus({
        type: "error",
        message: "Please select a .json backup file",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const result = importVeteranData(data, "replace");

        if (result.success) {
          setVeteranProfile(getVeteranProfile());
          setImportStatus({ type: "success", message: result.message });
        } else {
          setImportStatus({ type: "error", message: result.message });
        }
      } catch (err) {
        setImportStatus({
          type: "error",
          message: "Invalid backup file format",
        });
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  // Save form to My Packet
  const handleSaveToPacket = () => {
    const formId = saveForm({
      formType: selectedForm?.id,
      formNumber: selectedForm?.formNumber,
      formName: selectedForm?.name,
      title: formData.conditionName || selectedForm?.name,
      formData: formData,
      generatedContent: generatedContent,
      status: "Draft",
    });

    if (formId) {
      setImportStatus({ type: "success", message: "Form saved to My Packet!" });
      setTimeout(() => setImportStatus(null), 3000);
    }
  };

  // Available forms with comprehensive guidance
  const forms = [
    {
      id: "buddy-statement",
      formNumber: "VA Form 21-10210",
      name: "Buddy / Lay Statement",
      icon: "👥",
      description:
        "Get someone who witnessed your condition or knows about your service to provide supporting evidence. This is one of the most powerful forms of evidence!",
      difficulty: "Most Requested",
      difficultyColor:
        "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      link: "https://www.va.gov/supporting-forms-for-claims/lay-witness-statement-form-21-10210/",
      tips: [
        "Can be from fellow service members, family, friends, or coworkers",
        "The witness describes what they personally observed",
        "Multiple statements from different people strengthen your claim",
        "Witnesses do NOT need to be medical professionals",
      ],
    },
    {
      id: "intent-to-file",
      formNumber: "VA Form 21-0966",
      name: "Intent to File",
      icon: "📅",
      description:
        "Protect your effective date while you gather evidence! File this FIRST to lock in your potential start date for benefits.",
      difficulty: "File First",
      difficultyColor:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      link: "https://www.va.gov/supporting-forms-for-claims/intent-to-file-form-21-0966/",
      tips: [
        "Locks in your effective date for up to 1 year",
        "You can submit online, by phone, or by mail",
        "Always do this BEFORE gathering evidence",
        "Could mean thousands in back pay",
      ],
    },
    {
      id: "medical-release",
      formNumber: "VA Forms 21-4142/4142a",
      name: "Medical Records Release",
      icon: "🏥",
      description:
        "Authorize the VA to obtain your private medical records. Essential if you have treatment records outside the VA system.",
      difficulty: "Essential",
      difficultyColor:
        "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      link: "https://www.va.gov/supporting-forms-for-claims/release-information-to-va-form-21-4142/",
      tips: [
        "Use for any non-VA medical treatment",
        "Include all doctors, hospitals, and specialists",
        "Be as specific as possible with dates",
        "Expires after 180 days from signature",
      ],
    },
    {
      id: "personal-statement",
      formNumber: "VA Form 21-4138",
      name: "Statement in Support of Claim",
      icon: "📝",
      description:
        "Your opportunity to explain your condition in your own words. Describe how your disability affects your daily life.",
      difficulty: "Important",
      difficultyColor:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      link: "https://www.va.gov/forms/21-4138",
      tips: [
        "Be specific and detailed about symptoms",
        "Describe your worst days, not your best",
        "Include specific examples and incidents",
        "Explain how it affects work, family, and daily activities",
      ],
    },
    {
      id: "ptsd-stressor",
      formNumber: "VA Form 21-0781",
      name: "PTSD Stressor Statement",
      icon: "🧠",
      description:
        "Required for PTSD claims. Document the traumatic event(s) that caused your PTSD with as much detail as possible.",
      difficulty: "PTSD Claims",
      difficultyColor:
        "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      link: "https://www.va.gov/find-forms/about-form-21-0781/",
      tips: [
        "Be as specific as possible about dates and locations",
        "Include unit assignments and duty stations",
        "Describe the event in detail (who, what, where, when)",
        "You may qualify for reduced evidence requirements under certain circumstances",
      ],
    },
    {
      id: "priority-processing",
      formNumber: "VA Form 20-10207",
      name: "Priority Processing Request",
      icon: "⚡",
      description:
        "Request faster processing if you're experiencing financial hardship, terminal illness, homelessness, or other urgent circumstances.",
      difficulty: "Urgent Cases",
      difficultyColor:
        "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      link: "https://www.va.gov/supporting-forms-for-claims/request-priority-processing-form-20-10207/",
      tips: [
        "Must have an existing pending claim",
        "Qualifies for: terminal illness, financial hardship, homelessness, ALS, age 85+",
        "Medal of Honor recipients automatically qualify",
        "Former POWs may also qualify",
      ],
    },
    {
      id: "vso-appointment",
      formNumber: "VA Form 21-22",
      name: "VSO Appointment",
      icon: "🤝",
      description:
        "Appoint a Veterans Service Organization (VSO) to help with your claim. VSOs provide FREE assistance and can access your VA records.",
      difficulty: "Get Free Help",
      difficultyColor:
        "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
      link: "https://www.va.gov/find-forms/about-form-21-22/",
      tips: [
        "VSOs provide FREE claims assistance - no fees allowed",
        "They can access your VA records and submit evidence on your behalf",
        "Popular VSOs: DAV, American Legion, VFW, VVA, AMVETS",
        "You can change VSOs at any time by filing a new 21-22",
      ],
    },
    {
      id: "vso-appointment-individual",
      formNumber: "VA Form 21-22a",
      name: "Individual Representative",
      icon: "👔",
      description:
        "Appoint an individual (attorney or claims agent) to represent you. Unlike VSOs, attorneys may charge fees after your claim is decided.",
      difficulty: "Attorney/Agent",
      difficultyColor:
        "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200",
      link: "https://www.va.gov/find-forms/about-form-21-22a/",
      tips: [
        "Use for attorneys or accredited claims agents",
        "Attorneys may charge fees only AFTER initial claim decision",
        "VA limits fees to 33.3% of past-due benefits",
        "Verify your representative at VA.gov accreditation search",
      ],
    },
    // === ADDITIONAL FORMS (9 more to complete 17 total) ===
    {
      id: "third-party-authorization",
      formNumber: "VA Form 21-0845",
      name: "Third Party Authorization",
      icon: "🔐",
      description:
        "Authorize a third party (family member, caregiver, or other individual) to receive information about your VA claim or benefits.",
      difficulty: "Privacy Control",
      difficultyColor:
        "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
      link: "https://www.va.gov/find-forms/about-form-21-0845/",
      tips: [
        "Use when you want someone else to communicate with VA on your behalf",
        "Specify exactly what information they can receive",
        "Can be limited to specific claims or all VA matters",
        "You can revoke authorization at any time",
      ],
    },
    {
      id: "personal-records-request",
      formNumber: "VA Form 20-10206",
      name: "Freedom of Information Act (FOIA) Request",
      icon: "📂",
      description:
        "Request copies of your VA records under the Freedom of Information Act or Privacy Act. Get your C-file, medical records, or other VA documents.",
      difficulty: "Records Request",
      difficultyColor:
        "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
      link: "https://www.va.gov/find-forms/about-form-20-10206/",
      tips: [
        "Use to request your complete C-file (claims file)",
        "Can request medical records, rating decisions, and more",
        "Processing can take 30-90+ days depending on request complexity",
        "Helpful for understanding past VA decisions or preparing appeals",
      ],
    },
    {
      id: "alternate-signer",
      formNumber: "VA Form 21-0972",
      name: "Alternate Signer Certification",
      icon: "✍️",
      description:
        "Authorize someone else to sign VA forms on your behalf if you are unable to sign due to physical or mental conditions.",
      difficulty: "Accessibility",
      difficultyColor:
        "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
      link: "https://www.va.gov/find-forms/about-form-21-0972/",
      tips: [
        "Use when the veteran cannot physically sign documents",
        "Alternate signer must be 18+ and not a VA employee handling the claim",
        "Requires documentation of why veteran cannot sign",
        "Common for hospitalized, incapacitated, or disabled veterans",
      ],
    },
    {
      id: "nursing-home-info",
      formNumber: "VA Form 21-0779",
      name: "Nursing Home Information",
      icon: "🏠",
      description:
        "Provide information about nursing home residence for Aid & Attendance or Housebound benefits. Required for veterans in nursing facilities.",
      difficulty: "A&A/Housebound",
      difficultyColor:
        "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
      link: "https://www.va.gov/find-forms/about-form-21-0779/",
      tips: [
        "Required for Aid & Attendance claims if in a nursing home",
        "Nursing home must complete parts of this form",
        "Includes facility information and level of care",
        "Critical for pension with Aid & Attendance claims",
      ],
    },
    {
      id: "substitution-request",
      formNumber: "VA Form 21P-0847",
      name: "Request for Substitution",
      icon: "🔄",
      description:
        "Request to continue a deceased veteran's pending claim. Allows eligible survivors to step into the veteran's claim.",
      difficulty: "Survivors",
      difficultyColor:
        "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
      link: "https://www.va.gov/find-forms/about-form-21p-0847/",
      tips: [
        "Must be filed within 1 year of veteran's death",
        "Only applies to claims pending at time of death",
        "Eligible substitutes: spouse, child, or dependent parent",
        "Allows continuation of claim without starting over",
      ],
    },
    {
      id: "income-asset-statement",
      formNumber: "VA Form 21P-0969",
      name: "Income & Asset Statement",
      icon: "💰",
      description:
        "Report income and assets for VA pension benefits. Required for pension claims to determine eligibility and benefit amount.",
      difficulty: "Pension Claims",
      difficultyColor:
        "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
      link: "https://www.va.gov/find-forms/about-form-21p-0969/",
      tips: [
        "Required for VA pension and survivors pension claims",
        "Report all income sources: Social Security, retirement, etc.",
        "List all assets: bank accounts, property, investments",
        "Medical expenses can be deducted from countable income",
      ],
    },
    {
      id: "medical-expense-report",
      formNumber: "VA Form 21P-8416",
      name: "Medical Expense Report",
      icon: "🧾",
      description:
        "Report unreimbursed medical expenses for pension benefit calculations. These expenses reduce countable income and may increase your pension.",
      difficulty: "Pension Claims",
      difficultyColor:
        "bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-200",
      link: "https://www.va.gov/find-forms/about-form-21p-8416/",
      tips: [
        "Submit with pension claims or as annual update",
        "Include: prescriptions, doctor visits, medical equipment, insurance premiums",
        "Care costs (nursing home, in-home care) count as medical expenses",
        "Keep receipts - VA may request documentation",
      ],
    },
    {
      id: "employment-info",
      formNumber: "VA Form 21-4192",
      name: "Request for Employment Information",
      icon: "💼",
      description:
        "Request employment verification from employers. Critical for TDIU (Total Disability Individual Unemployability) claims.",
      difficulty: "TDIU Claims",
      difficultyColor:
        "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
      link: "https://www.va.gov/find-forms/about-form-21-4192/",
      tips: [
        "Essential for TDIU claims - proves employment limitations",
        "Send to your last employer(s) for completion",
        "Employer documents work accommodations, missed days, job loss reasons",
        "Strengthens claim that disabilities prevent substantial employment",
      ],
    },
  ];

  // Buddy Statement wizard steps
  const buddyStatementSteps = [
    {
      title: "Who Will Write This Statement?",
      fields: [
        {
          name: "witnessName",
          label: "Witness Full Name",
          type: "text",
          required: true,
          placeholder: "John M. Smith",
        },
        {
          name: "witnessRelation",
          label: "Relationship to Veteran",
          type: "select",
          required: true,
          options: [
            { value: "", label: "Select relationship..." },
            { value: "fellow-service-member", label: "Fellow Service Member" },
            { value: "supervisor", label: "Military Supervisor/NCO/Officer" },
            { value: "spouse", label: "Spouse" },
            { value: "family", label: "Family Member" },
            { value: "friend", label: "Friend" },
            { value: "coworker", label: "Civilian Coworker" },
            { value: "caregiver", label: "Caregiver" },
            { value: "other", label: "Other" },
          ],
        },
        {
          name: "witnessPhone",
          label: "Witness Phone (optional)",
          type: "tel",
          placeholder: "(555) 123-4567",
        },
        {
          name: "witnessEmail",
          label: "Witness Email (optional)",
          type: "email",
          placeholder: "witness@email.com",
        },
      ],
    },
    {
      title: "Veteran Information",
      fields: [
        {
          name: "veteranName",
          label: "Veteran Full Name",
          type: "text",
          required: true,
          placeholder: "Jane M. Veteran",
        },
        {
          name: "veteranBranch",
          label: "Branch of Service",
          type: "select",
          required: true,
          options: [
            { value: "", label: "Select branch..." },
            { value: "Army", label: "U.S. Army" },
            { value: "Navy", label: "U.S. Navy" },
            { value: "Air Force", label: "U.S. Air Force" },
            { value: "Marine Corps", label: "U.S. Marine Corps" },
            { value: "Coast Guard", label: "U.S. Coast Guard" },
            { value: "Space Force", label: "U.S. Space Force" },
            { value: "National Guard", label: "National Guard" },
          ],
        },
        {
          name: "knownSince",
          label: "How long have you known the veteran?",
          type: "text",
          required: true,
          placeholder: "Since 2015 / 8 years / etc.",
        },
        {
          name: "howKnown",
          label: "How did you come to know the veteran?",
          type: "textarea",
          required: true,
          placeholder:
            "We served together at Fort Bragg from 2015-2018 in the same platoon...",
        },
      ],
    },
    {
      title: "What Condition Are You Writing About?",
      fields: [
        {
          name: "conditionName",
          label: "Condition/Disability Being Claimed",
          type: "text",
          required: true,
          placeholder: "PTSD, back pain, knee injury, hearing loss, etc.",
        },
        {
          name: "conditionType",
          label: "Type of Statement",
          type: "select",
          required: true,
          options: [
            { value: "", label: "Select type..." },
            {
              value: "witnessed-incident",
              label: "I witnessed the incident/injury",
            },
            {
              value: "witnessed-symptoms",
              label: "I witnessed symptoms/effects of the condition",
            },
            {
              value: "know-before-after",
              label: "I knew the veteran before and after service",
            },
            {
              value: "daily-impact",
              label: "I observe how the condition affects daily life",
            },
            {
              value: "work-impact",
              label: "I observe how the condition affects work/employment",
            },
            {
              value: "character-change",
              label: "I witnessed personality/behavioral changes",
            },
          ],
        },
      ],
    },
    {
      title: "What Did You Observe?",
      subtitle:
        "Be specific about what you personally saw, heard, or experienced. Use concrete examples.",
      fields: [
        {
          name: "whatObserved",
          label: "Describe what you personally witnessed or observed",
          type: "textarea",
          required: true,
          placeholder: `Example: During our deployment to Iraq in 2016, I was present when the IED exploded near our convoy. I saw [Veteran Name] thrown from the vehicle and witnessed them struggle to get up, holding their back in obvious pain...

Or: Since my spouse returned from deployment, I have witnessed them wake up multiple times per night from nightmares, sweating and disoriented. They refuse to go to crowded places and become extremely anxious...`,
          rows: 6,
        },
        {
          name: "whenObserved",
          label: "When did this occur? (approximate dates)",
          type: "text",
          required: true,
          placeholder:
            "July 2016 during deployment / Since returning home in 2018 / etc.",
        },
        {
          name: "whereObserved",
          label: "Where did this occur?",
          type: "text",
          required: true,
          placeholder:
            "Baghdad, Iraq / Fort Hood, TX / At home / At work / etc.",
        },
      ],
    },
    {
      title: "Impact on Daily Life",
      subtitle:
        "Describe how this condition affects the veteran's life today. This helps demonstrate severity.",
      fields: [
        {
          name: "dailyImpact",
          label: "How does this condition affect their daily activities?",
          type: "textarea",
          required: false,
          placeholder:
            "Example: They can no longer play with their children due to back pain. They have trouble sleeping and are often exhausted. They avoid social gatherings and have become withdrawn...",
          rows: 4,
        },
        {
          name: "workImpact",
          label: "How does this condition affect their work/employment?",
          type: "textarea",
          required: false,
          placeholder:
            "Example: They have had to reduce their hours at work. They have been written up for missing days due to flare-ups. They can no longer perform physical tasks required by their job...",
          rows: 4,
        },
        {
          name: "specificExamples",
          label: "Any specific incidents or examples you can share?",
          type: "textarea",
          required: false,
          placeholder:
            "Example: Last Thanksgiving, they had a panic attack and had to leave the family gathering. On 3/15/2023, I saw them unable to get out of bed due to severe pain...",
          rows: 4,
        },
      ],
    },
    {
      title: "Final Details",
      fields: [
        {
          name: "additionalInfo",
          label: "Any additional information that might help?",
          type: "textarea",
          required: false,
          placeholder:
            "Any other relevant details about what you've witnessed...",
          rows: 3,
        },
        {
          name: "willingToTestify",
          label: "I am willing to provide additional testimony if needed",
          type: "checkbox",
        },
      ],
    },
  ];

  // Personal Statement wizard steps
  const personalStatementSteps = [
    {
      title: "Basic Information",
      fields: [
        {
          name: "veteranName",
          label: "Your Full Name",
          type: "text",
          required: true,
          placeholder: "Jane M. Veteran",
        },
        {
          name: "conditionName",
          label: "Condition You Are Claiming",
          type: "text",
          required: true,
          placeholder: "PTSD, back pain, knee injury, etc.",
        },
        {
          name: "claimType",
          label: "Type of Claim",
          type: "select",
          required: true,
          options: [
            { value: "", label: "Select type..." },
            { value: "initial", label: "New/Initial Claim" },
            { value: "increase", label: "Claim for Increase" },
            { value: "secondary", label: "Secondary Condition" },
            { value: "reopened", label: "Reopened Claim" },
          ],
        },
        {
          name: "primaryCondition",
          label: "If Secondary: Connected to which primary condition?",
          type: "text",
          required: false,
          placeholder: "e.g., PTSD, lumbar strain, etc.",
        },
      ],
    },
    {
      title: "When Did It Start?",
      fields: [
        {
          name: "onsetDate",
          label: "When did you first notice symptoms?",
          type: "text",
          required: true,
          placeholder:
            "During deployment in 2016 / After training accident / etc.",
        },
        {
          name: "inServiceEvent",
          label: "What in-service event, injury, or exposure caused this?",
          type: "textarea",
          required: true,
          placeholder:
            "Describe the specific event, injury, training accident, exposure, or circumstances that led to this condition...",
          rows: 4,
        },
        {
          name: "firstTreatment",
          label: "When did you first seek treatment?",
          type: "text",
          required: false,
          placeholder: "Saw medic in 2016 / VA treatment in 2018 / etc.",
        },
      ],
    },
    {
      title: "Describe Your Symptoms",
      subtitle:
        "Be specific and describe your WORST days, not your best. The VA needs to understand the full impact.",
      fields: [
        {
          name: "symptoms",
          label: "What symptoms do you experience?",
          type: "textarea",
          required: true,
          placeholder: `List your symptoms in detail:
- Pain level (on a scale of 1-10)
- Frequency (daily, weekly, constant)
- What triggers symptoms
- What makes them worse
- Physical limitations
- Mental/emotional effects`,
          rows: 6,
        },
        {
          name: "worstDays",
          label: "Describe your worst days with this condition",
          type: "textarea",
          required: true,
          placeholder:
            "On my worst days, I cannot get out of bed. The pain is at a 9/10 and radiates down my leg. I cannot sit for more than 10 minutes without severe discomfort...",
          rows: 4,
        },
        {
          name: "flareUps",
          label: "Do you have flare-ups? How often and how severe?",
          type: "textarea",
          required: false,
          placeholder:
            "I experience flare-ups approximately 3-4 times per month, lasting 2-3 days each...",
          rows: 3,
        },
      ],
    },
    {
      title: "Impact on Your Life",
      fields: [
        {
          name: "workImpact",
          label: "How does this affect your work/employment?",
          type: "textarea",
          required: true,
          placeholder:
            "I have missed X days of work. I can no longer perform certain tasks. I had to change careers because...",
          rows: 4,
        },
        {
          name: "dailyImpact",
          label: "How does this affect daily activities?",
          type: "textarea",
          required: true,
          placeholder:
            "I can no longer: play with my children, do yard work, drive for long periods, exercise, etc.",
          rows: 4,
        },
        {
          name: "socialImpact",
          label: "How does this affect relationships and social life?",
          type: "textarea",
          required: false,
          placeholder:
            "I have withdrawn from family activities. My relationship with my spouse has suffered. I avoid social gatherings...",
          rows: 3,
        },
      ],
    },
    {
      title: "Treatment History",
      fields: [
        {
          name: "currentTreatment",
          label: "What treatment are you currently receiving?",
          type: "textarea",
          required: false,
          placeholder:
            "Physical therapy, medications (list names), injections, surgery history, etc.",
          rows: 3,
        },
        {
          name: "medications",
          label: "List all medications for this condition",
          type: "textarea",
          required: false,
          placeholder: "Gabapentin 300mg 3x daily, Meloxicam 15mg daily, etc.",
          rows: 3,
        },
        {
          name: "treatmentEffectiveness",
          label: "How effective has treatment been?",
          type: "textarea",
          required: false,
          placeholder:
            "Medications provide temporary relief but do not eliminate symptoms. Physical therapy helps but symptoms always return...",
          rows: 3,
        },
      ],
    },
  ];

  // PTSD Stressor Statement steps
  const ptsdStressorSteps = [
    {
      title: "Basic Information",
      fields: [
        {
          name: "veteranName",
          label: "Your Full Name",
          type: "text",
          required: true,
        },
        {
          name: "serviceDates",
          label: "Dates of Service",
          type: "text",
          required: true,
          placeholder: "MM/YYYY to MM/YYYY",
        },
        {
          name: "branch",
          label: "Branch of Service",
          type: "select",
          required: true,
          options: [
            { value: "", label: "Select branch..." },
            { value: "Army", label: "U.S. Army" },
            { value: "Navy", label: "U.S. Navy" },
            { value: "Air Force", label: "U.S. Air Force" },
            { value: "Marine Corps", label: "U.S. Marine Corps" },
            { value: "Coast Guard", label: "U.S. Coast Guard" },
            { value: "Space Force", label: "U.S. Space Force" },
          ],
        },
      ],
    },
    {
      title: "Stressor Event Details",
      subtitle:
        "Describe the traumatic event(s) in as much detail as you can. This is difficult, but important for your claim.",
      fields: [
        {
          name: "stressorType",
          label: "Type of Stressor",
          type: "select",
          required: true,
          options: [
            { value: "", label: "Select type..." },
            { value: "combat", label: "Combat-related" },
            { value: "mst", label: "Military Sexual Trauma (MST)" },
            { value: "personal-assault", label: "Personal Assault" },
            { value: "accident", label: "Serious Accident" },
            { value: "death", label: "Witnessing Death/Injury" },
            {
              value: "fear-hostile",
              label: "Fear of Hostile Military Activity",
            },
            { value: "other", label: "Other Trauma" },
          ],
        },
        {
          name: "eventDate",
          label: "Date of Event (as specific as possible)",
          type: "text",
          required: true,
          placeholder: "July 15, 2016 or July 2016 or Summer 2016",
        },
        {
          name: "eventLocation",
          label: "Location of Event",
          type: "text",
          required: true,
          placeholder: "City, Country / Base Name / Ship Name, etc.",
        },
      ],
    },
    {
      title: "Describe the Event",
      subtitle: "Take your time. Include as many details as you can remember.",
      fields: [
        {
          name: "eventDescription",
          label: "What happened?",
          type: "textarea",
          required: true,
          placeholder: `Describe the event in detail:
- What were you doing before the event?
- What exactly happened?
- Who was involved?
- What did you see, hear, smell?
- How did you respond?
- What happened immediately after?`,
          rows: 8,
        },
        {
          name: "unitInfo",
          label: "Unit/Assignment at time of event",
          type: "text",
          required: false,
          placeholder: "1st Battalion, 506th Infantry, 101st Airborne",
        },
      ],
    },
    {
      title: "Corroborating Information",
      fields: [
        {
          name: "witnesses",
          label: "Names of anyone who witnessed or can verify the event",
          type: "textarea",
          required: false,
          placeholder:
            "List names, ranks, and how they were involved (if known)",
          rows: 3,
        },
        {
          name: "documentation",
          label: "Any documentation that might verify this event?",
          type: "textarea",
          required: false,
          placeholder:
            "Unit logs, news reports, awards/medals, after-action reports, police reports, medical records, etc.",
          rows: 3,
        },
        {
          name: "reportedTo",
          label: "Did you report this event to anyone? Who?",
          type: "textarea",
          required: false,
          placeholder: "NCO, Officer, Chaplain, Medical, Military Police, etc.",
          rows: 2,
        },
      ],
    },
    {
      title: "Current PTSD Symptoms",
      fields: [
        {
          name: "symptoms",
          label: "What PTSD symptoms do you experience?",
          type: "checklist",
          required: true,
          options: [
            "Nightmares or disturbing dreams",
            "Flashbacks (reliving the event)",
            "Intrusive thoughts or memories",
            "Avoiding reminders of the trauma",
            "Difficulty sleeping",
            "Hypervigilance (always on alert)",
            "Exaggerated startle response",
            "Difficulty concentrating",
            "Irritability or anger outbursts",
            "Emotional numbness",
            "Feeling detached from others",
            "Negative thoughts about self or world",
            "Memory problems",
            "Loss of interest in activities",
            "Difficulty feeling positive emotions",
          ],
        },
        {
          name: "symptomDetails",
          label: "Describe your most severe symptoms",
          type: "textarea",
          required: true,
          placeholder:
            "Describe how often symptoms occur and how they affect you...",
          rows: 4,
        },
      ],
    },
  ];

  // Intent to File wizard steps
  const intentToFileSteps = [
    {
      title: "Your Information",
      fields: [
        {
          name: "veteranName",
          label: "Your Full Legal Name",
          type: "text",
          required: true,
          placeholder: "Jane M. Veteran",
        },
        {
          name: "ssn",
          label: "Last 4 of SSN (optional - for your reference only)",
          type: "text",
          placeholder: "XXXX",
        },
        {
          name: "dob",
          label: "Date of Birth",
          type: "text",
          required: true,
          placeholder: "MM/DD/YYYY",
        },
        {
          name: "vaFileNumber",
          label: "VA File Number (if known)",
          type: "text",
          placeholder: "Optional",
        },
      ],
    },
    {
      title: "Contact Information",
      fields: [
        {
          name: "address",
          label: "Mailing Address",
          type: "textarea",
          required: true,
          placeholder: "123 Main St\nCity, State ZIP",
          rows: 3,
        },
        {
          name: "phone",
          label: "Phone Number",
          type: "tel",
          required: true,
          placeholder: "(555) 123-4567",
        },
        {
          name: "email",
          label: "Email Address",
          type: "email",
          required: true,
          placeholder: "veteran@email.com",
        },
      ],
    },
    {
      title: "Type of Benefit",
      subtitle: "What type of benefit are you intending to file for?",
      fields: [
        {
          name: "benefitType",
          label: "Benefit Type",
          type: "select",
          required: true,
          options: [
            { value: "", label: "Select benefit type..." },
            { value: "compensation", label: "Disability Compensation" },
            { value: "pension", label: "Pension" },
            { value: "survivors", label: "Survivors Benefits (DIC)" },
          ],
        },
        {
          name: "conditions",
          label: "What condition(s) do you plan to claim? (Brief list)",
          type: "textarea",
          required: false,
          placeholder:
            "PTSD, back injury, hearing loss, etc.\n(This is for your planning - the actual claim will include full details)",
          rows: 3,
        },
      ],
    },
    {
      title: "Important Information",
      subtitle: "Review this important information about Intent to File",
      fields: [
        {
          name: "understandDeadline",
          label:
            "I understand I have 1 YEAR from today to submit my complete claim to preserve this effective date",
          type: "checkbox",
          required: true,
        },
        {
          name: "understandNotClaim",
          label:
            "I understand this is NOT a claim - I still need to submit a complete claim (VA Form 21-526EZ)",
          type: "checkbox",
          required: true,
        },
        {
          name: "preferredMethod",
          label: "How do you plan to submit?",
          type: "select",
          required: true,
          options: [
            { value: "", label: "Select method..." },
            {
              value: "online",
              label: "Online at VA.gov (Recommended - Instant confirmation)",
            },
            { value: "phone", label: "By Phone (1-800-827-1000)" },
            { value: "mail", label: "By Mail" },
            { value: "inperson", label: "In Person at VA Regional Office" },
          ],
        },
      ],
    },
  ];

  // Medical Records Release wizard steps
  const medicalReleaseSteps = [
    {
      title: "Your Information",
      fields: [
        {
          name: "veteranName",
          label: "Veteran Full Legal Name",
          type: "text",
          required: true,
          placeholder: "Jane M. Veteran",
        },
        {
          name: "ssn",
          label: "Last 4 of SSN (for your reference)",
          type: "text",
          placeholder: "XXXX",
        },
        {
          name: "dob",
          label: "Date of Birth",
          type: "text",
          required: true,
          placeholder: "MM/DD/YYYY",
        },
        {
          name: "vaFileNumber",
          label: "VA File Number (if known)",
          type: "text",
          placeholder: "Optional",
        },
        {
          name: "phone",
          label: "Phone Number",
          type: "tel",
          required: true,
          placeholder: "(555) 123-4567",
        },
        {
          name: "address",
          label: "Current Mailing Address",
          type: "textarea",
          required: true,
          placeholder: "123 Main St\nCity, State ZIP",
          rows: 3,
        },
      ],
    },
    {
      title: "Healthcare Provider #1",
      subtitle:
        "Enter information for the first healthcare provider whose records you want the VA to obtain",
      fields: [
        {
          name: "provider1Name",
          label: "Provider/Facility Name",
          type: "text",
          required: true,
          placeholder: "Dr. Smith / City Hospital / Urgent Care Clinic",
        },
        {
          name: "provider1Address",
          label: "Provider Address",
          type: "textarea",
          required: true,
          placeholder: "456 Medical Blvd\nCity, State ZIP",
          rows: 3,
        },
        {
          name: "provider1Phone",
          label: "Provider Phone",
          type: "tel",
          placeholder: "(555) 987-6543",
        },
        {
          name: "provider1Fax",
          label: "Provider Fax (if known)",
          type: "tel",
          placeholder: "(555) 987-6544",
        },
        {
          name: "provider1Dates",
          label: "Dates of Treatment",
          type: "text",
          required: true,
          placeholder: "January 2020 - Present / 03/2019 - 06/2022",
        },
        {
          name: "provider1Conditions",
          label: "Conditions Treated",
          type: "textarea",
          required: true,
          placeholder: "Back pain, knee injury, anxiety, etc.",
          rows: 2,
        },
      ],
    },
    {
      title: "Healthcare Provider #2 (Optional)",
      subtitle:
        "Add another provider if needed. Leave blank if not applicable.",
      fields: [
        {
          name: "provider2Name",
          label: "Provider/Facility Name",
          type: "text",
          placeholder: "Leave blank if no additional provider",
        },
        {
          name: "provider2Address",
          label: "Provider Address",
          type: "textarea",
          placeholder: "Address",
          rows: 3,
        },
        {
          name: "provider2Phone",
          label: "Provider Phone",
          type: "tel",
          placeholder: "(555) 987-6543",
        },
        {
          name: "provider2Dates",
          label: "Dates of Treatment",
          type: "text",
          placeholder: "January 2020 - Present",
        },
        {
          name: "provider2Conditions",
          label: "Conditions Treated",
          type: "textarea",
          placeholder: "Conditions treated at this provider",
          rows: 2,
        },
      ],
    },
    {
      title: "Healthcare Provider #3 (Optional)",
      subtitle:
        "Add another provider if needed. Leave blank if not applicable.",
      fields: [
        {
          name: "provider3Name",
          label: "Provider/Facility Name",
          type: "text",
          placeholder: "Leave blank if no additional provider",
        },
        {
          name: "provider3Address",
          label: "Provider Address",
          type: "textarea",
          placeholder: "Address",
          rows: 3,
        },
        {
          name: "provider3Phone",
          label: "Provider Phone",
          type: "tel",
          placeholder: "(555) 987-6543",
        },
        {
          name: "provider3Dates",
          label: "Dates of Treatment",
          type: "text",
          placeholder: "January 2020 - Present",
        },
        {
          name: "provider3Conditions",
          label: "Conditions Treated",
          type: "textarea",
          placeholder: "Conditions treated at this provider",
          rows: 2,
        },
      ],
    },
    {
      title: "Authorization Details",
      fields: [
        {
          name: "recordTypes",
          label: "What types of records should the VA request?",
          type: "checklist",
          required: true,
          options: [
            "Complete medical records",
            "Treatment notes/progress notes",
            "Lab results",
            "Imaging (X-rays, MRI, CT scans)",
            "Surgical records",
            "Mental health records",
            "Physical therapy records",
            "Prescription history",
            "Diagnosis and prognosis",
            "Disability/work restriction documentation",
          ],
        },
        {
          name: "additionalInstructions",
          label: "Any special instructions for the provider?",
          type: "textarea",
          required: false,
          placeholder:
            "Optional: Any specific records or time periods to focus on...",
          rows: 2,
        },
        {
          name: "understandExpiration",
          label:
            "I understand this authorization expires 180 days from signature",
          type: "checkbox",
          required: true,
        },
      ],
    },
  ];

  // Priority Processing Request wizard steps
  const priorityProcessingSteps = [
    {
      title: "Your Information",
      fields: [
        {
          name: "veteranName",
          label: "Veteran Full Legal Name",
          type: "text",
          required: true,
          placeholder: "Jane M. Veteran",
        },
        {
          name: "ssn",
          label: "Last 4 of SSN (for your reference)",
          type: "text",
          placeholder: "XXXX",
        },
        {
          name: "dob",
          label: "Date of Birth",
          type: "text",
          required: true,
          placeholder: "MM/DD/YYYY",
        },
        {
          name: "vaFileNumber",
          label: "VA File Number (if known)",
          type: "text",
          placeholder: "Optional",
        },
        {
          name: "phone",
          label: "Phone Number",
          type: "tel",
          required: true,
          placeholder: "(555) 123-4567",
        },
        {
          name: "email",
          label: "Email Address",
          type: "email",
          required: true,
          placeholder: "veteran@email.com",
        },
      ],
    },
    {
      title: "Existing Claim Information",
      subtitle:
        "You must have an existing pending claim to request priority processing",
      fields: [
        {
          name: "claimType",
          label: "Type of Pending Claim",
          type: "select",
          required: true,
          options: [
            { value: "", label: "Select claim type..." },
            {
              value: "initial",
              label: "Initial Disability Compensation Claim",
            },
            { value: "increase", label: "Claim for Increased Rating" },
            { value: "secondary", label: "Secondary Service Connection Claim" },
            { value: "pension", label: "Pension Claim" },
            {
              value: "dic",
              label: "DIC (Dependency and Indemnity Compensation)",
            },
            { value: "appeal", label: "Appeal" },
            { value: "other", label: "Other VA Benefit Claim" },
          ],
        },
        {
          name: "claimDate",
          label: "Approximate Date Claim Filed",
          type: "text",
          required: true,
          placeholder: "MM/DD/YYYY or Month YYYY",
        },
        {
          name: "claimDescription",
          label: "Brief Description of Claim",
          type: "textarea",
          required: true,
          placeholder:
            "Example: Claim for PTSD and back condition filed after deployment to Afghanistan...",
          rows: 3,
        },
      ],
    },
    {
      title: "Reason for Priority Processing",
      subtitle: "Select all qualifying reasons that apply to your situation",
      fields: [
        {
          name: "priorityReasons",
          label: "Qualifying Circumstances",
          type: "checklist",
          required: true,
          options: [
            "Terminal illness (life expectancy of 6 months or less)",
            "Serious illness requiring immediate care",
            "Financial hardship (facing eviction, utilities shutoff, etc.)",
            "Homeless or at imminent risk of homelessness",
            "ALS (Amyotrophic Lateral Sclerosis) diagnosis",
            "Age 85 or older",
            "Medal of Honor recipient",
            "Former Prisoner of War (POW)",
            "Experiencing extreme financial hardship",
            "Survivor of Military Sexual Trauma with pending MST claim",
            "Purple Heart recipient",
            "Very Seriously Injured/Ill (VSI) or Seriously Injured/Ill (SI)",
            "Other qualifying hardship",
          ],
        },
      ],
    },
    {
      title: "Explain Your Situation",
      subtitle:
        "Provide details about why you need expedited processing. Be specific.",
      fields: [
        {
          name: "hardshipExplanation",
          label: "Explain your hardship or qualifying circumstance",
          type: "textarea",
          required: true,
          placeholder: `Be specific about your situation:

If financial hardship: Explain what bills you cannot pay, eviction notices received, utilities being shut off, etc.

If medical: Describe your diagnosis, prognosis, and why expedited processing is critical.

If homeless: Describe your current living situation and any documentation you have.

Include specific dates, amounts, and documentation you can provide.`,
          rows: 8,
        },
        {
          name: "supportingDocs",
          label: "What supporting documentation can you provide?",
          type: "checklist",
          required: false,
          options: [
            "Medical documentation of terminal/serious illness",
            "Doctor's statement about prognosis",
            "Eviction notice or past due rent notice",
            "Utility shutoff notice",
            "Bank statements showing financial hardship",
            "Homeless shelter documentation",
            "DD-214 showing POW status",
            "Medal of Honor documentation",
            "Other qualifying documentation",
          ],
        },
      ],
    },
    {
      title: "Contact for Urgent Matters",
      fields: [
        {
          name: "emergencyContact",
          label: "Emergency Contact Name",
          type: "text",
          required: false,
          placeholder: "Optional",
        },
        {
          name: "emergencyPhone",
          label: "Emergency Contact Phone",
          type: "tel",
          required: false,
          placeholder: "(555) 123-4567",
        },
        {
          name: "bestTimeToCall",
          label: "Best Time to Reach You",
          type: "text",
          required: false,
          placeholder: "Mornings / Afternoons / Anytime",
        },
        {
          name: "additionalInfo",
          label: "Any additional information the VA should know?",
          type: "textarea",
          required: false,
          placeholder: "Any other relevant details about your situation...",
          rows: 3,
        },
      ],
    },
  ];

  // VSO Appointment wizard steps (21-22)
  const vsoAppointmentSteps = [
    {
      title: "Your Information",
      fields: [
        {
          name: "veteranFirstName",
          label: "First Name",
          type: "text",
          required: true,
          placeholder: "John",
        },
        {
          name: "veteranMiddleInitial",
          label: "Middle Initial",
          type: "text",
          required: false,
          placeholder: "M",
        },
        {
          name: "veteranLastName",
          label: "Last Name",
          type: "text",
          required: true,
          placeholder: "Smith",
        },
        {
          name: "ssn",
          label: "Last 4 of Social Security Number",
          type: "text",
          required: true,
          placeholder: "1234",
        },
        {
          name: "vaFileNumber",
          label: "VA File Number (if different from SSN)",
          type: "text",
          required: false,
          placeholder: "Optional",
        },
        { name: "dob", label: "Date of Birth", type: "date", required: true },
        {
          name: "insuranceNumber",
          label: "Insurance File Number (if applicable)",
          type: "text",
          required: false,
          placeholder: "Optional",
        },
      ],
    },
    {
      title: "Contact Information",
      fields: [
        {
          name: "phone",
          label: "Telephone Number",
          type: "tel",
          required: true,
          placeholder: "(555) 123-4567",
        },
        {
          name: "email",
          label: "Email Address",
          type: "email",
          required: false,
          placeholder: "veteran@email.com",
        },
        {
          name: "street",
          label: "Street Address",
          type: "text",
          required: true,
          placeholder: "123 Main Street",
        },
        {
          name: "apt",
          label: "Apt/Unit Number",
          type: "text",
          required: false,
          placeholder: "Apt 4B",
        },
        {
          name: "city",
          label: "City",
          type: "text",
          required: true,
          placeholder: "Anytown",
        },
        {
          name: "state",
          label: "State",
          type: "text",
          required: true,
          placeholder: "CA",
        },
        {
          name: "zip",
          label: "ZIP Code",
          type: "text",
          required: true,
          placeholder: "12345",
        },
        {
          name: "country",
          label: "Country",
          type: "text",
          required: false,
          placeholder: "USA",
        },
      ],
    },
    {
      title: "Select Your VSO",
      fields: [
        {
          name: "vsoName",
          label: "Veterans Service Organization Name",
          type: "select",
          required: true,
          options: [
            { value: "", label: "Select a VSO..." },
            { value: "DAV", label: "Disabled American Veterans (DAV)" },
            { value: "American Legion", label: "The American Legion" },
            { value: "VFW", label: "Veterans of Foreign Wars (VFW)" },
            { value: "VVA", label: "Vietnam Veterans of America (VVA)" },
            { value: "AMVETS", label: "AMVETS" },
            { value: "PVA", label: "Paralyzed Veterans of America (PVA)" },
            { value: "WWP", label: "Wounded Warrior Project" },
            { value: "BVA", label: "Blinded Veterans Association (BVA)" },
            { value: "MOPH", label: "Military Order of the Purple Heart" },
            { value: "State VSO", label: "State Veterans Service Office" },
            { value: "County VSO", label: "County Veterans Service Office" },
            { value: "Other", label: "Other (specify below)" },
          ],
        },
        {
          name: "vsoOther",
          label: "If Other, specify VSO name",
          type: "text",
          required: false,
          placeholder: "Enter VSO name",
        },
        {
          name: "vsoAddress",
          label: "VSO Office Address (optional)",
          type: "text",
          required: false,
          placeholder: "Your local VSO office address",
        },
      ],
    },
    {
      title: "Authorization Scope",
      fields: [
        {
          name: "authorizationScope",
          label: "What are you authorizing the VSO to do?",
          type: "checklist",
          required: true,
          options: [
            "Access my VA records",
            "Represent me in all VA claims matters",
            "Submit evidence and documentation on my behalf",
            "Attend C&P exams with me (if allowed)",
            "Appeal decisions on my behalf",
          ],
        },
        {
          name: "limitAccess",
          label: "Limit access to specific records?",
          type: "select",
          required: true,
          options: [
            {
              value: "no",
              label: "No - Grant full access to all my VA records",
            },
            {
              value: "yes",
              label: "Yes - I want to limit access to certain records",
            },
          ],
        },
        {
          name: "accessLimitations",
          label: "If limiting access, specify restrictions:",
          type: "textarea",
          required: false,
          placeholder: "Describe any limitations on record access...",
          rows: 3,
        },
      ],
    },
  ];

  // Individual Representative (21-22a) wizard steps
  const individualRepSteps = [
    {
      title: "Your Information",
      fields: [
        {
          name: "veteranFirstName",
          label: "First Name",
          type: "text",
          required: true,
          placeholder: "John",
        },
        {
          name: "veteranMiddleInitial",
          label: "Middle Initial",
          type: "text",
          required: false,
          placeholder: "M",
        },
        {
          name: "veteranLastName",
          label: "Last Name",
          type: "text",
          required: true,
          placeholder: "Smith",
        },
        {
          name: "ssn",
          label: "Last 4 of Social Security Number",
          type: "text",
          required: true,
          placeholder: "1234",
        },
        {
          name: "vaFileNumber",
          label: "VA File Number (if different from SSN)",
          type: "text",
          required: false,
          placeholder: "Optional",
        },
        { name: "dob", label: "Date of Birth", type: "date", required: true },
      ],
    },
    {
      title: "Contact Information",
      fields: [
        {
          name: "phone",
          label: "Telephone Number",
          type: "tel",
          required: true,
          placeholder: "(555) 123-4567",
        },
        {
          name: "email",
          label: "Email Address",
          type: "email",
          required: false,
          placeholder: "veteran@email.com",
        },
        {
          name: "street",
          label: "Street Address",
          type: "text",
          required: true,
          placeholder: "123 Main Street",
        },
        {
          name: "apt",
          label: "Apt/Unit Number",
          type: "text",
          required: false,
          placeholder: "Apt 4B",
        },
        {
          name: "city",
          label: "City",
          type: "text",
          required: true,
          placeholder: "Anytown",
        },
        {
          name: "state",
          label: "State",
          type: "text",
          required: true,
          placeholder: "CA",
        },
        {
          name: "zip",
          label: "ZIP Code",
          type: "text",
          required: true,
          placeholder: "12345",
        },
      ],
    },
    {
      title: "Representative Information",
      fields: [
        {
          name: "repType",
          label: "Type of Representative",
          type: "select",
          required: true,
          options: [
            { value: "", label: "Select type..." },
            { value: "attorney", label: "Attorney" },
            { value: "claims-agent", label: "Accredited Claims Agent" },
          ],
        },
        {
          name: "repName",
          label: "Representative Full Name",
          type: "text",
          required: true,
          placeholder: "Jane A. Attorney, Esq.",
        },
        {
          name: "repOrganization",
          label: "Law Firm / Organization",
          type: "text",
          required: false,
          placeholder: "Smith & Associates Law Firm",
        },
        {
          name: "repAddress",
          label: "Representative Address",
          type: "text",
          required: true,
          placeholder: "456 Legal Way, Suite 100",
        },
        {
          name: "repCity",
          label: "City",
          type: "text",
          required: true,
          placeholder: "Anytown",
        },
        {
          name: "repState",
          label: "State",
          type: "text",
          required: true,
          placeholder: "CA",
        },
        {
          name: "repZip",
          label: "ZIP Code",
          type: "text",
          required: true,
          placeholder: "12345",
        },
        {
          name: "repPhone",
          label: "Representative Phone",
          type: "tel",
          required: true,
          placeholder: "(555) 987-6543",
        },
        {
          name: "repEmail",
          label: "Representative Email",
          type: "email",
          required: false,
          placeholder: "attorney@lawfirm.com",
        },
      ],
    },
    {
      title: "Fee Agreement & Authorization",
      fields: [
        {
          name: "feeAgreement",
          label: "Fee Agreement Status",
          type: "select",
          required: true,
          options: [
            { value: "", label: "Select..." },
            {
              value: "attached",
              label: "Fee agreement is attached with this form",
            },
            {
              value: "will-submit",
              label: "Fee agreement will be submitted separately",
            },
            { value: "no-fee", label: "No fee will be charged (pro bono)" },
          ],
        },
        {
          name: "feeUnderstanding",
          label: "I understand the fee rules:",
          type: "checklist",
          required: true,
          options: [
            "Attorneys/agents may only charge fees AFTER VA issues an initial decision",
            "VA limits fees to 33.3% of past-due benefits (unless higher approved)",
            "The fee agreement must be filed with the VA",
            "I can revoke this appointment at any time by filing a new form",
          ],
        },
        {
          name: "authorizationScope",
          label: "Authorization Scope",
          type: "checklist",
          required: true,
          options: [
            "Access my VA records",
            "Represent me in all VA claims matters",
            "Submit evidence on my behalf",
            "File appeals on my behalf",
          ],
        },
      ],
    },
  ];

  // Third Party Authorization (21-0845) wizard steps
  const thirdPartyAuthSteps = [
    {
      title: "Your Information (Veteran/Claimant)",
      fields: [
        {
          name: "veteranFirstName",
          label: "First Name",
          type: "text",
          required: true,
          placeholder: "John",
        },
        {
          name: "veteranMiddleInitial",
          label: "Middle Initial",
          type: "text",
          required: false,
          placeholder: "M",
        },
        {
          name: "veteranLastName",
          label: "Last Name",
          type: "text",
          required: true,
          placeholder: "Smith",
        },
        {
          name: "ssn",
          label: "Last 4 of Social Security Number",
          type: "text",
          required: true,
          placeholder: "1234",
        },
        {
          name: "vaFileNumber",
          label: "VA File Number (if different from SSN)",
          type: "text",
          required: false,
          placeholder: "Optional",
        },
        { name: "dob", label: "Date of Birth", type: "date", required: true },
      ],
    },
    {
      title: "Your Contact Information",
      fields: [
        {
          name: "phone",
          label: "Telephone Number",
          type: "tel",
          required: true,
          placeholder: "(555) 123-4567",
        },
        {
          name: "email",
          label: "Email Address",
          type: "email",
          required: false,
          placeholder: "veteran@email.com",
        },
        {
          name: "street",
          label: "Street Address",
          type: "text",
          required: true,
          placeholder: "123 Main Street",
        },
        {
          name: "city",
          label: "City",
          type: "text",
          required: true,
          placeholder: "Anytown",
        },
        {
          name: "state",
          label: "State",
          type: "text",
          required: true,
          placeholder: "CA",
        },
        {
          name: "zip",
          label: "ZIP Code",
          type: "text",
          required: true,
          placeholder: "12345",
        },
      ],
    },
    {
      title: "Authorized Third Party Information",
      fields: [
        {
          name: "thirdPartyName",
          label: "Full Name of Authorized Person",
          type: "text",
          required: true,
          placeholder: "Jane Smith",
        },
        {
          name: "thirdPartyRelationship",
          label: "Relationship to You",
          type: "select",
          required: true,
          options: [
            { value: "", label: "Select relationship..." },
            { value: "spouse", label: "Spouse" },
            { value: "child", label: "Adult Child" },
            { value: "parent", label: "Parent" },
            { value: "sibling", label: "Sibling" },
            { value: "caregiver", label: "Caregiver" },
            { value: "friend", label: "Friend" },
            { value: "other", label: "Other" },
          ],
        },
        {
          name: "thirdPartyPhone",
          label: "Third Party Phone",
          type: "tel",
          required: true,
          placeholder: "(555) 987-6543",
        },
        {
          name: "thirdPartyEmail",
          label: "Third Party Email",
          type: "email",
          required: false,
          placeholder: "helper@email.com",
        },
        {
          name: "thirdPartyAddress",
          label: "Third Party Address",
          type: "text",
          required: true,
          placeholder: "456 Oak Street, Anytown, CA 12345",
        },
      ],
    },
    {
      title: "Authorization Scope",
      fields: [
        {
          name: "authorizationScope",
          label: "What can this person do on your behalf?",
          type: "checklist",
          required: true,
          options: [
            "Receive information about my VA claim status",
            "Discuss my benefits and payment information",
            "Receive copies of correspondence from VA",
            "Discuss medical records related to my claim",
            "Schedule and discuss C&P exams",
          ],
        },
        {
          name: "authorizationDuration",
          label: "How long should this authorization last?",
          type: "select",
          required: true,
          options: [
            { value: "", label: "Select duration..." },
            { value: "6-months", label: "6 months" },
            { value: "1-year", label: "1 year" },
            { value: "2-years", label: "2 years" },
            { value: "until-revoked", label: "Until I revoke it" },
          ],
        },
        {
          name: "limitToSpecificClaim",
          label: "Limit to a specific claim?",
          type: "select",
          required: true,
          options: [
            { value: "", label: "Select..." },
            { value: "no", label: "No - authorize for ALL my VA matters" },
            { value: "yes", label: "Yes - only for a specific claim" },
          ],
        },
        {
          name: "specificClaimDetails",
          label: "If limited, specify which claim:",
          type: "textarea",
          required: false,
          placeholder: "e.g., PTSD claim filed January 2026",
        },
      ],
    },
  ];

  // FOIA/Privacy Act Request (20-10206) wizard steps
  const foiaRequestSteps = [
    {
      title: "Your Information",
      fields: [
        {
          name: "veteranFirstName",
          label: "First Name",
          type: "text",
          required: true,
          placeholder: "John",
        },
        {
          name: "veteranMiddleInitial",
          label: "Middle Initial",
          type: "text",
          required: false,
          placeholder: "M",
        },
        {
          name: "veteranLastName",
          label: "Last Name",
          type: "text",
          required: true,
          placeholder: "Smith",
        },
        {
          name: "ssn",
          label: "Social Security Number",
          type: "text",
          required: true,
          placeholder: "123-45-6789",
        },
        {
          name: "vaFileNumber",
          label: "VA File Number (if known)",
          type: "text",
          required: false,
          placeholder: "Optional",
        },
        { name: "dob", label: "Date of Birth", type: "date", required: true },
        {
          name: "branchOfService",
          label: "Branch of Service",
          type: "select",
          required: true,
          options: [
            { value: "", label: "Select branch..." },
            { value: "army", label: "Army" },
            { value: "navy", label: "Navy" },
            { value: "air-force", label: "Air Force" },
            { value: "marines", label: "Marine Corps" },
            { value: "coast-guard", label: "Coast Guard" },
            { value: "space-force", label: "Space Force" },
          ],
        },
      ],
    },
    {
      title: "Contact Information",
      fields: [
        {
          name: "phone",
          label: "Telephone Number",
          type: "tel",
          required: true,
          placeholder: "(555) 123-4567",
        },
        {
          name: "email",
          label: "Email Address",
          type: "email",
          required: false,
          placeholder: "veteran@email.com",
        },
        {
          name: "street",
          label: "Street Address",
          type: "text",
          required: true,
          placeholder: "123 Main Street",
        },
        {
          name: "city",
          label: "City",
          type: "text",
          required: true,
          placeholder: "Anytown",
        },
        {
          name: "state",
          label: "State",
          type: "text",
          required: true,
          placeholder: "CA",
        },
        {
          name: "zip",
          label: "ZIP Code",
          type: "text",
          required: true,
          placeholder: "12345",
        },
      ],
    },
    {
      title: "Records Requested",
      fields: [
        {
          name: "recordsRequested",
          label: "What records do you want?",
          type: "checklist",
          required: true,
          options: [
            "Complete C-file (claims file)",
            "Rating decision letters",
            "Medical records from VA treatment",
            "C&P exam reports",
            "Service treatment records (if in VA possession)",
            "Award letters",
            "Correspondence sent to/from VA",
            "Vocational rehabilitation records",
            "Education benefits records",
          ],
        },
        {
          name: "dateRange",
          label: "Date range for records (if applicable)",
          type: "text",
          required: false,
          placeholder: 'e.g., January 2020 - Present, or "All records"',
        },
        {
          name: "specificConditions",
          label: "Specific conditions or claims (optional)",
          type: "textarea",
          required: false,
          placeholder:
            "e.g., Records related to my PTSD claim, knee injury, etc.",
        },
      ],
    },
    {
      title: "Delivery Preferences",
      fields: [
        {
          name: "deliveryMethod",
          label: "How do you want to receive records?",
          type: "select",
          required: true,
          options: [
            { value: "", label: "Select delivery method..." },
            { value: "mail", label: "Mail to my address" },
            { value: "email", label: "Email (if available)" },
            { value: "pickup", label: "Pick up at VA Regional Office" },
          ],
        },
        {
          name: "expediteReason",
          label: "Do you need expedited processing?",
          type: "select",
          required: true,
          options: [
            { value: "", label: "Select..." },
            { value: "no", label: "No - standard processing is fine" },
            {
              value: "appeal-deadline",
              label: "Yes - I have an appeal deadline",
            },
            { value: "legal-matter", label: "Yes - For legal proceedings" },
            { value: "other", label: "Yes - Other urgent reason" },
          ],
        },
        {
          name: "expediteDetails",
          label: "If expedited, explain why:",
          type: "textarea",
          required: false,
          placeholder: "e.g., Appeal deadline is March 15, 2026",
        },
      ],
    },
  ];

  // Alternate Signer Certification (21-0972) wizard steps
  const alternateSignerSteps = [
    {
      title: "Veteran Information",
      fields: [
        {
          name: "veteranFirstName",
          label: "Veteran First Name",
          type: "text",
          required: true,
          placeholder: "John",
        },
        {
          name: "veteranMiddleInitial",
          label: "Middle Initial",
          type: "text",
          required: false,
          placeholder: "M",
        },
        {
          name: "veteranLastName",
          label: "Veteran Last Name",
          type: "text",
          required: true,
          placeholder: "Smith",
        },
        {
          name: "ssn",
          label: "Last 4 of SSN",
          type: "text",
          required: true,
          placeholder: "1234",
        },
        {
          name: "vaFileNumber",
          label: "VA File Number",
          type: "text",
          required: false,
          placeholder: "If different from SSN",
        },
        { name: "dob", label: "Date of Birth", type: "date", required: true },
      ],
    },
    {
      title: "Why Alternate Signer is Needed",
      fields: [
        {
          name: "unableToSignReason",
          label: "Reason veteran cannot sign",
          type: "select",
          required: true,
          options: [
            { value: "", label: "Select reason..." },
            {
              value: "physical-disability",
              label: "Physical disability prevents signing",
            },
            { value: "hospitalized", label: "Veteran is hospitalized" },
            { value: "cognitive-impairment", label: "Cognitive impairment" },
            { value: "vision-impairment", label: "Vision impairment" },
            { value: "paralysis", label: "Paralysis or mobility limitation" },
            { value: "other", label: "Other medical condition" },
          ],
        },
        {
          name: "conditionDetails",
          label: "Please describe the condition in detail:",
          type: "textarea",
          required: true,
          placeholder:
            "Explain why the veteran is unable to physically sign documents...",
        },
        {
          name: "isPermanent",
          label: "Is this condition permanent?",
          type: "select",
          required: true,
          options: [
            { value: "", label: "Select..." },
            { value: "yes", label: "Yes - Permanent condition" },
            { value: "no", label: "No - Temporary condition" },
          ],
        },
      ],
    },
    {
      title: "Alternate Signer Information",
      fields: [
        {
          name: "altSignerName",
          label: "Alternate Signer Full Name",
          type: "text",
          required: true,
          placeholder: "Jane A. Smith",
        },
        {
          name: "altSignerRelationship",
          label: "Relationship to Veteran",
          type: "select",
          required: true,
          options: [
            { value: "", label: "Select relationship..." },
            { value: "spouse", label: "Spouse" },
            { value: "adult-child", label: "Adult Child" },
            { value: "parent", label: "Parent" },
            { value: "sibling", label: "Sibling" },
            { value: "legal-guardian", label: "Legal Guardian" },
            {
              value: "court-appointed",
              label: "Court-Appointed Representative",
            },
            { value: "other", label: "Other" },
          ],
        },
        {
          name: "altSignerPhone",
          label: "Phone Number",
          type: "tel",
          required: true,
          placeholder: "(555) 123-4567",
        },
        {
          name: "altSignerEmail",
          label: "Email",
          type: "email",
          required: false,
          placeholder: "signer@email.com",
        },
        {
          name: "altSignerAddress",
          label: "Address",
          type: "text",
          required: true,
          placeholder: "123 Main St, City, State ZIP",
        },
      ],
    },
    {
      title: "Certification & Acknowledgment",
      fields: [
        {
          name: "certifications",
          label: "The alternate signer certifies:",
          type: "checklist",
          required: true,
          options: [
            "I am at least 18 years of age",
            "I am not a VA employee involved in processing this claim",
            "I am signing on behalf of the veteran at their request or due to their inability",
            "I understand that signing for the veteran makes me responsible for the accuracy of information",
            "I have witnessed that the veteran is unable to sign due to the stated condition",
          ],
        },
        {
          name: "witnessStatement",
          label: "Additional witness statement (optional):",
          type: "textarea",
          required: false,
          placeholder:
            "Describe your observations of why the veteran cannot sign...",
        },
      ],
    },
  ];

  // Nursing Home Information (21-0779) wizard steps
  const nursingHomeSteps = [
    {
      title: "Veteran Information",
      fields: [
        {
          name: "veteranFirstName",
          label: "First Name",
          type: "text",
          required: true,
          placeholder: "John",
        },
        {
          name: "veteranMiddleInitial",
          label: "Middle Initial",
          type: "text",
          required: false,
          placeholder: "M",
        },
        {
          name: "veteranLastName",
          label: "Last Name",
          type: "text",
          required: true,
          placeholder: "Smith",
        },
        {
          name: "ssn",
          label: "Social Security Number",
          type: "text",
          required: true,
          placeholder: "123-45-6789",
        },
        {
          name: "vaFileNumber",
          label: "VA File Number",
          type: "text",
          required: false,
          placeholder: "If different from SSN",
        },
        { name: "dob", label: "Date of Birth", type: "date", required: true },
      ],
    },
    {
      title: "Nursing Home Facility Information",
      fields: [
        {
          name: "facilityName",
          label: "Nursing Home Name",
          type: "text",
          required: true,
          placeholder: "Sunny Valley Care Center",
        },
        {
          name: "facilityAddress",
          label: "Facility Street Address",
          type: "text",
          required: true,
          placeholder: "100 Care Drive",
        },
        {
          name: "facilityCity",
          label: "City",
          type: "text",
          required: true,
          placeholder: "Anytown",
        },
        {
          name: "facilityState",
          label: "State",
          type: "text",
          required: true,
          placeholder: "CA",
        },
        {
          name: "facilityZip",
          label: "ZIP Code",
          type: "text",
          required: true,
          placeholder: "12345",
        },
        {
          name: "facilityPhone",
          label: "Facility Phone",
          type: "tel",
          required: true,
          placeholder: "(555) 123-4567",
        },
        {
          name: "facilityType",
          label: "Type of Facility",
          type: "select",
          required: true,
          options: [
            { value: "", label: "Select type..." },
            {
              value: "skilled-nursing",
              label: "Skilled Nursing Facility (SNF)",
            },
            { value: "nursing-home", label: "Nursing Home" },
            { value: "assisted-living", label: "Assisted Living Facility" },
            { value: "va-clc", label: "VA Community Living Center" },
            { value: "state-veterans-home", label: "State Veterans Home" },
          ],
        },
      ],
    },
    {
      title: "Admission & Care Details",
      fields: [
        {
          name: "admissionDate",
          label: "Date of Admission",
          type: "date",
          required: true,
        },
        {
          name: "expectedStay",
          label: "Expected Length of Stay",
          type: "select",
          required: true,
          options: [
            { value: "", label: "Select..." },
            {
              value: "short-term",
              label: "Short-term rehabilitation (less than 90 days)",
            },
            { value: "long-term", label: "Long-term care (90 days or more)" },
            { value: "permanent", label: "Permanent placement" },
            { value: "unknown", label: "Unknown at this time" },
          ],
        },
        {
          name: "levelOfCare",
          label: "Level of Care Provided",
          type: "checklist",
          required: true,
          options: [
            "Assistance with daily activities (bathing, dressing, eating)",
            "24-hour nursing supervision",
            "Medication management",
            "Physical therapy",
            "Memory care / dementia care",
            "Hospice care",
          ],
        },
        {
          name: "medicaidStatus",
          label: "Medicaid Status",
          type: "select",
          required: true,
          options: [
            { value: "", label: "Select..." },
            { value: "not-receiving", label: "Not receiving Medicaid" },
            { value: "receiving", label: "Currently receiving Medicaid" },
            { value: "pending", label: "Medicaid application pending" },
          ],
        },
      ],
    },
    {
      title: "Benefit Purpose",
      fields: [
        {
          name: "benefitRequested",
          label: "What benefit are you requesting?",
          type: "select",
          required: true,
          options: [
            { value: "", label: "Select benefit..." },
            { value: "aid-attendance", label: "Aid & Attendance" },
            { value: "housebound", label: "Housebound Benefits" },
            { value: "pension", label: "VA Pension" },
            {
              value: "dic",
              label: "Dependency and Indemnity Compensation (DIC)",
            },
          ],
        },
        {
          name: "currentlyReceiving",
          label: "Are you currently receiving VA benefits?",
          type: "select",
          required: true,
          options: [
            { value: "", label: "Select..." },
            { value: "no", label: "No - This is a new claim" },
            { value: "compensation", label: "Yes - Disability Compensation" },
            { value: "pension", label: "Yes - VA Pension" },
            { value: "both", label: "Yes - Both Compensation and Pension" },
          ],
        },
        {
          name: "additionalInfo",
          label: "Additional information about care needs:",
          type: "textarea",
          required: false,
          placeholder:
            "Describe any special circumstances or care requirements...",
        },
      ],
    },
  ];

  // Request for Substitution (21P-0847) wizard steps
  const substitutionRequestSteps = [
    {
      title: "Deceased Veteran Information",
      fields: [
        {
          name: "veteranFirstName",
          label: "Veteran First Name",
          type: "text",
          required: true,
          placeholder: "John",
        },
        {
          name: "veteranMiddleInitial",
          label: "Middle Initial",
          type: "text",
          required: false,
          placeholder: "M",
        },
        {
          name: "veteranLastName",
          label: "Veteran Last Name",
          type: "text",
          required: true,
          placeholder: "Smith",
        },
        {
          name: "veteranSSN",
          label: "Veteran Social Security Number",
          type: "text",
          required: true,
          placeholder: "123-45-6789",
        },
        {
          name: "vaFileNumber",
          label: "VA File Number",
          type: "text",
          required: false,
          placeholder: "If different from SSN",
        },
        {
          name: "veteranDOB",
          label: "Veteran Date of Birth",
          type: "date",
          required: true,
        },
        {
          name: "dateOfDeath",
          label: "Date of Death",
          type: "date",
          required: true,
        },
      ],
    },
    {
      title: "Substitute (Your) Information",
      fields: [
        {
          name: "substituteFirstName",
          label: "Your First Name",
          type: "text",
          required: true,
          placeholder: "Jane",
        },
        {
          name: "substituteMiddleInitial",
          label: "Middle Initial",
          type: "text",
          required: false,
          placeholder: "A",
        },
        {
          name: "substituteLastName",
          label: "Your Last Name",
          type: "text",
          required: true,
          placeholder: "Smith",
        },
        {
          name: "substituteSSN",
          label: "Your Social Security Number",
          type: "text",
          required: true,
          placeholder: "123-45-6789",
        },
        {
          name: "substituteDOB",
          label: "Your Date of Birth",
          type: "date",
          required: true,
        },
        {
          name: "relationshipToVeteran",
          label: "Your Relationship to Veteran",
          type: "select",
          required: true,
          options: [
            { value: "", label: "Select relationship..." },
            { value: "spouse", label: "Surviving Spouse" },
            { value: "child", label: "Child of Veteran" },
            { value: "parent", label: "Dependent Parent" },
          ],
        },
      ],
    },
    {
      title: "Contact Information",
      fields: [
        {
          name: "phone",
          label: "Phone Number",
          type: "tel",
          required: true,
          placeholder: "(555) 123-4567",
        },
        {
          name: "email",
          label: "Email Address",
          type: "email",
          required: false,
          placeholder: "email@example.com",
        },
        {
          name: "street",
          label: "Street Address",
          type: "text",
          required: true,
          placeholder: "123 Main Street",
        },
        {
          name: "city",
          label: "City",
          type: "text",
          required: true,
          placeholder: "Anytown",
        },
        {
          name: "state",
          label: "State",
          type: "text",
          required: true,
          placeholder: "CA",
        },
        {
          name: "zip",
          label: "ZIP Code",
          type: "text",
          required: true,
          placeholder: "12345",
        },
      ],
    },
    {
      title: "Pending Claim Information",
      fields: [
        {
          name: "pendingClaimType",
          label: "Type of pending claim",
          type: "checklist",
          required: true,
          options: [
            "Disability Compensation claim",
            "Pension claim",
            "Dependency and Indemnity Compensation (DIC)",
            "Appeal of previous decision",
            "Supplemental claim",
            "Other benefit claim",
          ],
        },
        {
          name: "claimDetails",
          label: "Describe the pending claim:",
          type: "textarea",
          required: true,
          placeholder:
            "Describe what the veteran was claiming when they passed...",
        },
        {
          name: "claimFiledDate",
          label: "Approximate date claim was filed:",
          type: "date",
          required: false,
        },
        {
          name: "acknowledgments",
          label: "I understand:",
          type: "checklist",
          required: true,
          options: [
            "This request must be filed within 1 year of the veteran's death",
            "I am eligible to substitute as the surviving spouse, child, or dependent parent",
            "I will receive any benefits that would have been due to the veteran",
            "I may need to provide proof of my relationship (marriage certificate, birth certificate, etc.)",
          ],
        },
      ],
    },
  ];

  // Income and Asset Statement (21P-0969) wizard steps
  const incomeAssetSteps = [
    {
      title: "Veteran/Claimant Information",
      fields: [
        {
          name: "veteranFirstName",
          label: "First Name",
          type: "text",
          required: true,
          placeholder: "John",
        },
        {
          name: "veteranMiddleInitial",
          label: "Middle Initial",
          type: "text",
          required: false,
          placeholder: "M",
        },
        {
          name: "veteranLastName",
          label: "Last Name",
          type: "text",
          required: true,
          placeholder: "Smith",
        },
        {
          name: "ssn",
          label: "Social Security Number",
          type: "text",
          required: true,
          placeholder: "123-45-6789",
        },
        {
          name: "vaFileNumber",
          label: "VA File Number",
          type: "text",
          required: false,
          placeholder: "If different from SSN",
        },
        { name: "dob", label: "Date of Birth", type: "date", required: true },
        {
          name: "maritalStatus",
          label: "Marital Status",
          type: "select",
          required: true,
          options: [
            { value: "", label: "Select..." },
            { value: "single", label: "Single/Never Married" },
            { value: "married", label: "Married" },
            { value: "divorced", label: "Divorced" },
            { value: "widowed", label: "Widowed" },
          ],
        },
      ],
    },
    {
      title: "Monthly Income",
      fields: [
        {
          name: "socialSecurityIncome",
          label: "Social Security (monthly)",
          type: "text",
          required: true,
          placeholder: "$1,500",
        },
        {
          name: "militaryRetirement",
          label: "Military Retirement Pay (monthly)",
          type: "text",
          required: false,
          placeholder: "$0",
        },
        {
          name: "civilServiceRetirement",
          label: "Civil Service/Federal Retirement",
          type: "text",
          required: false,
          placeholder: "$0",
        },
        {
          name: "otherRetirement",
          label: "Other Pension/Retirement",
          type: "text",
          required: false,
          placeholder: "$0",
        },
        {
          name: "wages",
          label: "Wages/Salary (if working)",
          type: "text",
          required: false,
          placeholder: "$0",
        },
        {
          name: "interestDividends",
          label: "Interest and Dividends",
          type: "text",
          required: false,
          placeholder: "$0",
        },
        {
          name: "rentalIncome",
          label: "Rental Income",
          type: "text",
          required: false,
          placeholder: "$0",
        },
        {
          name: "otherIncome",
          label: "Any Other Income",
          type: "text",
          required: false,
          placeholder: "$0",
        },
        {
          name: "otherIncomeSource",
          label: "If other income, describe source:",
          type: "text",
          required: false,
          placeholder: "e.g., Annuity, royalties, etc.",
        },
      ],
    },
    {
      title: "Assets",
      fields: [
        {
          name: "bankAccounts",
          label: "Bank Accounts (total all checking/savings)",
          type: "text",
          required: true,
          placeholder: "$5,000",
        },
        {
          name: "stocks",
          label: "Stocks, Bonds, Mutual Funds",
          type: "text",
          required: false,
          placeholder: "$0",
        },
        {
          name: "ira401k",
          label: "IRA, 401k, Retirement Accounts",
          type: "text",
          required: false,
          placeholder: "$25,000",
        },
        {
          name: "realEstate",
          label: "Real Estate (other than primary home)",
          type: "text",
          required: false,
          placeholder: "$0",
        },
        {
          name: "vehicles",
          label: "Vehicles (fair market value)",
          type: "text",
          required: false,
          placeholder: "$8,000",
        },
        {
          name: "otherAssets",
          label: "Other Assets",
          type: "text",
          required: false,
          placeholder: "$0",
        },
        {
          name: "primaryHomeValue",
          label: "Primary Home Value (for reference only)",
          type: "text",
          required: false,
          placeholder: "$150,000 - typically excluded",
        },
      ],
    },
    {
      title: "Medical Expenses (Deductible)",
      fields: [
        {
          name: "healthInsurancePremiums",
          label: "Health Insurance Premiums (monthly)",
          type: "text",
          required: false,
          placeholder: "$200",
        },
        {
          name: "medicarePartB",
          label: "Medicare Part B Premium",
          type: "text",
          required: false,
          placeholder: "$175",
        },
        {
          name: "prescriptions",
          label: "Prescription Medications (monthly avg)",
          type: "text",
          required: false,
          placeholder: "$50",
        },
        {
          name: "doctorVisits",
          label: "Doctor Visits (monthly avg)",
          type: "text",
          required: false,
          placeholder: "$0",
        },
        {
          name: "nursingHomeCost",
          label: "Nursing Home / Assisted Living (monthly)",
          type: "text",
          required: false,
          placeholder: "$0",
        },
        {
          name: "inHomeCare",
          label: "In-Home Care Costs (monthly)",
          type: "text",
          required: false,
          placeholder: "$0",
        },
        {
          name: "medicalEquipment",
          label: "Medical Equipment (monthly avg)",
          type: "text",
          required: false,
          placeholder: "$0",
        },
        {
          name: "otherMedical",
          label: "Other Medical Expenses",
          type: "text",
          required: false,
          placeholder: "$0",
        },
        {
          name: "medicalExpenseNote",
          label: "Note about medical expenses:",
          type: "textarea",
          required: false,
          placeholder:
            "Medical expenses reduce your countable income, which may increase your pension benefit.",
        },
      ],
    },
  ];

  // Medical Expense Report (21P-8416) wizard steps
  const medicalExpenseSteps = [
    {
      title: "Your Information",
      fields: [
        {
          name: "veteranFirstName",
          label: "First Name",
          type: "text",
          required: true,
          placeholder: "John",
        },
        {
          name: "veteranMiddleInitial",
          label: "Middle Initial",
          type: "text",
          required: false,
          placeholder: "M",
        },
        {
          name: "veteranLastName",
          label: "Last Name",
          type: "text",
          required: true,
          placeholder: "Smith",
        },
        {
          name: "ssn",
          label: "Social Security Number",
          type: "text",
          required: true,
          placeholder: "123-45-6789",
        },
        {
          name: "vaFileNumber",
          label: "VA File Number",
          type: "text",
          required: false,
          placeholder: "If different from SSN",
        },
        {
          name: "phone",
          label: "Phone Number",
          type: "tel",
          required: true,
          placeholder: "(555) 123-4567",
        },
      ],
    },
    {
      title: "Reporting Period",
      fields: [
        {
          name: "reportingYear",
          label: "Year being reported",
          type: "text",
          required: true,
          placeholder: "2025",
        },
        {
          name: "reportPeriodStart",
          label: "Period Start Date",
          type: "date",
          required: true,
        },
        {
          name: "reportPeriodEnd",
          label: "Period End Date",
          type: "date",
          required: true,
        },
        {
          name: "reportType",
          label: "Type of Report",
          type: "select",
          required: true,
          options: [
            { value: "", label: "Select..." },
            { value: "annual", label: "Annual report of all medical expenses" },
            {
              value: "initial",
              label: "Initial claim - listing ongoing expenses",
            },
            { value: "update", label: "Update/correction to previous report" },
          ],
        },
      ],
    },
    {
      title: "Insurance & Care Costs",
      fields: [
        {
          name: "healthInsurance",
          label: "Health Insurance Premiums (total for period)",
          type: "text",
          required: false,
          placeholder: "$2,400",
        },
        {
          name: "medicarePartB",
          label: "Medicare Part B (total for period)",
          type: "text",
          required: false,
          placeholder: "$2,100",
        },
        {
          name: "medicareSupplement",
          label: "Medicare Supplement / Medigap",
          type: "text",
          required: false,
          placeholder: "$0",
        },
        {
          name: "prescriptionPlan",
          label: "Prescription Drug Plan Premium",
          type: "text",
          required: false,
          placeholder: "$0",
        },
        {
          name: "nursingHome",
          label: "Nursing Home / Assisted Living",
          type: "text",
          required: false,
          placeholder: "$0",
        },
        {
          name: "adultDayCare",
          label: "Adult Day Care",
          type: "text",
          required: false,
          placeholder: "$0",
        },
        {
          name: "homeHealthAide",
          label: "Home Health Aide / In-Home Care",
          type: "text",
          required: false,
          placeholder: "$0",
        },
      ],
    },
    {
      title: "Out-of-Pocket Medical Costs",
      fields: [
        {
          name: "prescriptions",
          label: "Prescription Medications (out of pocket)",
          type: "text",
          required: false,
          placeholder: "$600",
        },
        {
          name: "doctorCopays",
          label: "Doctor Visit Copays",
          type: "text",
          required: false,
          placeholder: "$200",
        },
        {
          name: "hospitalCopays",
          label: "Hospital / ER Copays",
          type: "text",
          required: false,
          placeholder: "$0",
        },
        {
          name: "dentalExpenses",
          label: "Dental Expenses",
          type: "text",
          required: false,
          placeholder: "$500",
        },
        {
          name: "visionExpenses",
          label: "Vision / Eye Care",
          type: "text",
          required: false,
          placeholder: "$200",
        },
        {
          name: "hearingAids",
          label: "Hearing Aids / Hearing Care",
          type: "text",
          required: false,
          placeholder: "$0",
        },
        {
          name: "medicalEquipment",
          label: "Medical Equipment / Supplies",
          type: "text",
          required: false,
          placeholder: "$0",
        },
        {
          name: "transportation",
          label: "Medical Transportation (mileage, etc.)",
          type: "text",
          required: false,
          placeholder: "$0",
        },
        {
          name: "otherMedical",
          label: "Other Medical Expenses",
          type: "text",
          required: false,
          placeholder: "$0",
        },
        {
          name: "otherDescription",
          label: "If other, describe:",
          type: "textarea",
          required: false,
          placeholder: "List any other medical expenses not covered above...",
        },
      ],
    },
  ];

  // Employment Information Request (21-4192) wizard steps
  const employmentInfoSteps = [
    {
      title: "Veteran Information",
      fields: [
        {
          name: "veteranFirstName",
          label: "First Name",
          type: "text",
          required: true,
          placeholder: "John",
        },
        {
          name: "veteranMiddleInitial",
          label: "Middle Initial",
          type: "text",
          required: false,
          placeholder: "M",
        },
        {
          name: "veteranLastName",
          label: "Last Name",
          type: "text",
          required: true,
          placeholder: "Smith",
        },
        {
          name: "ssn",
          label: "Social Security Number",
          type: "text",
          required: true,
          placeholder: "123-45-6789",
        },
        {
          name: "vaFileNumber",
          label: "VA File Number",
          type: "text",
          required: false,
          placeholder: "If different from SSN",
        },
        { name: "dob", label: "Date of Birth", type: "date", required: true },
        {
          name: "phone",
          label: "Phone Number",
          type: "tel",
          required: true,
          placeholder: "(555) 123-4567",
        },
      ],
    },
    {
      title: "Employer Information",
      fields: [
        {
          name: "employerName",
          label: "Employer/Company Name",
          type: "text",
          required: true,
          placeholder: "ABC Company Inc.",
        },
        {
          name: "employerAddress",
          label: "Employer Street Address",
          type: "text",
          required: true,
          placeholder: "500 Business Park Drive",
        },
        {
          name: "employerCity",
          label: "City",
          type: "text",
          required: true,
          placeholder: "Anytown",
        },
        {
          name: "employerState",
          label: "State",
          type: "text",
          required: true,
          placeholder: "CA",
        },
        {
          name: "employerZip",
          label: "ZIP Code",
          type: "text",
          required: true,
          placeholder: "12345",
        },
        {
          name: "employerPhone",
          label: "Employer Phone Number",
          type: "tel",
          required: true,
          placeholder: "(555) 555-1000",
        },
        {
          name: "supervisorName",
          label: "Supervisor / HR Contact Name",
          type: "text",
          required: false,
          placeholder: "Jane Manager",
        },
      ],
    },
    {
      title: "Employment Details",
      fields: [
        {
          name: "jobTitle",
          label: "Job Title / Position",
          type: "text",
          required: true,
          placeholder: "Warehouse Associate",
        },
        {
          name: "startDate",
          label: "Employment Start Date",
          type: "date",
          required: true,
        },
        {
          name: "endDate",
          label: "Employment End Date (if no longer employed)",
          type: "date",
          required: false,
        },
        {
          name: "stillEmployed",
          label: "Are you still employed here?",
          type: "select",
          required: true,
          options: [
            { value: "", label: "Select..." },
            { value: "yes", label: "Yes - Still employed" },
            { value: "no", label: "No - No longer employed" },
          ],
        },
        {
          name: "hoursPerWeek",
          label: "Hours Worked Per Week",
          type: "text",
          required: true,
          placeholder: "40",
        },
        {
          name: "earnings",
          label: "Earnings (hourly rate or annual salary)",
          type: "text",
          required: true,
          placeholder: "$15/hour or $45,000/year",
        },
      ],
    },
    {
      title: "Disability Impact on Employment",
      fields: [
        {
          name: "reasonForLeaving",
          label: "If no longer employed, reason for leaving:",
          type: "select",
          required: false,
          options: [
            { value: "", label: "Select if applicable..." },
            { value: "disability", label: "Left due to disability" },
            { value: "laid-off", label: "Laid off / Position eliminated" },
            { value: "terminated", label: "Terminated" },
            { value: "resigned", label: "Resigned for other reasons" },
            { value: "retired", label: "Retired" },
          ],
        },
        {
          name: "accommodations",
          label: "What accommodations were made for your disability?",
          type: "checklist",
          required: false,
          options: [
            "Reduced work hours",
            "Modified job duties",
            "Special equipment provided",
            "Frequent breaks allowed",
            "Work from home / Remote work",
            "Reassignment to less demanding position",
            "No accommodations were made",
            "No accommodations were needed",
          ],
        },
        {
          name: "missedWork",
          label: "Time missed from work due to disability:",
          type: "select",
          required: true,
          options: [
            { value: "", label: "Select..." },
            { value: "none", label: "Rarely missed work" },
            { value: "occasional", label: "1-5 days per month" },
            { value: "frequent", label: "6-10 days per month" },
            { value: "very-frequent", label: "More than 10 days per month" },
            { value: "unable-to-work", label: "Unable to work at all" },
          ],
        },
        {
          name: "impactDescription",
          label: "Describe how your disability affected your work:",
          type: "textarea",
          required: true,
          placeholder:
            "Explain specific ways your service-connected disabilities impacted your ability to perform your job, maintain attendance, or led to leaving employment...",
        },
      ],
    },
  ];

  // Get steps for selected form
  const getFormSteps = () => {
    switch (selectedForm?.id) {
      case "buddy-statement":
        return buddyStatementSteps;
      case "personal-statement":
        return personalStatementSteps;
      case "ptsd-stressor":
        return ptsdStressorSteps;
      case "intent-to-file":
        return intentToFileSteps;
      case "medical-release":
        return medicalReleaseSteps;
      case "priority-processing":
        return priorityProcessingSteps;
      case "vso-appointment":
        return vsoAppointmentSteps;
      case "vso-appointment-individual":
        return individualRepSteps;
      // New forms
      case "third-party-authorization":
        return thirdPartyAuthSteps;
      case "personal-records-request":
        return foiaRequestSteps;
      case "alternate-signer":
        return alternateSignerSteps;
      case "nursing-home-info":
        return nursingHomeSteps;
      case "substitution-request":
        return substitutionRequestSteps;
      case "income-asset-statement":
        return incomeAssetSteps;
      case "medical-expense-report":
        return medicalExpenseSteps;
      case "employment-info":
        return employmentInfoSteps;
      default:
        return [];
    }
  };

  const handleFieldChange = (fieldName, value) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
    // Trigger auto-save for crash protection
    markAsModified();
  };

  const handleChecklistChange = (fieldName, option, checked) => {
    const currentValues = formData[fieldName] || [];
    if (checked) {
      setFormData((prev) => ({
        ...prev,
        [fieldName]: [...currentValues, option],
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [fieldName]: currentValues.filter((v) => v !== option),
      }));
    }
    // Trigger auto-save for crash protection
    markAsModified();
  };

  const generateBuddyStatement = () => {
    const currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const relationLabels = {
      "fellow-service-member": "Fellow Service Member",
      supervisor: "Military Supervisor/NCO/Officer",
      spouse: "Spouse",
      family: "Family Member",
      friend: "Friend",
      coworker: "Civilian Coworker",
      caregiver: "Caregiver",
      other: "Other",
    };

    // Clean, official format that works as an attachment to VA Form 21-10210
    let statement = `STATEMENT IN SUPPORT OF CLAIM
(To Be Submitted with VA Form 21-10210)

--------------------------------------------------------------------------------

SECTION I - PERSON PROVIDING STATEMENT (WITNESS/AFFIANT)

Full Name: ${formData.witnessName || "________________________________________"}

Relationship to Veteran: ${relationLabels[formData.witnessRelation] || formData.witnessRelation || "____________________"}

Contact Phone: ${formData.witnessPhone || "________________________________________"}

Contact Email: ${formData.witnessEmail || "________________________________________"}

--------------------------------------------------------------------------------

SECTION II - VETERAN INFORMATION

Veteran's Full Name: ${formData.veteranName || "________________________________________"}

Branch of Service: ${formData.veteranBranch || "________________________________________"}

Condition/Disability Claimed: ${formData.conditionName || "________________________________________"}

--------------------------------------------------------------------------------

SECTION III - STATEMENT

A. How I Know the Veteran:

${formData.howKnown || "[Describe how you came to know the veteran]"}

Length of Acquaintance: ${formData.knownSince || "________________________________________"}


B. What I Personally Witnessed or Observed:

${formData.whatObserved || "[Describe what you personally witnessed regarding the veteran's condition, injury, or symptoms]"}


C. When and Where These Observations Occurred:

Timeframe: ${formData.whenObserved || "________________________________________"}

Location: ${formData.whereObserved || "________________________________________"}

`;

    if (
      formData.dailyImpact ||
      formData.workImpact ||
      formData.specificExamples
    ) {
      statement += `
D. Impact of Condition on Veteran's Daily Life:

`;
      if (formData.dailyImpact) {
        statement += `Impact on Daily Activities:
${formData.dailyImpact}

`;
      }
      if (formData.workImpact) {
        statement += `Impact on Employment/Work:
${formData.workImpact}

`;
      }
      if (formData.specificExamples) {
        statement += `Specific Examples/Incidents:
${formData.specificExamples}

`;
      }
    }

    if (formData.additionalInfo) {
      statement += `
E. Additional Information:

${formData.additionalInfo}

`;
    }

    statement += `--------------------------------------------------------------------------------

SECTION IV - CERTIFICATION AND SIGNATURE

I hereby certify that the statements made herein are true and correct to the best of my knowledge and belief. I understand that a false statement may be grounds for punishment as provided by 18 U.S.C. 1001 (making false statements to a federal agency).

${formData.willingToTestify ? "[X] I am willing to provide additional testimony or clarification if requested.\n" : "[ ] I am willing to provide additional testimony or clarification if requested.\n"}

Signature: ________________________________________

Printed Name: ${formData.witnessName || "________________________________________"}

Date Signed: ${currentDate}

--------------------------------------------------------------------------------

FOR VA USE ONLY - DO NOT WRITE BELOW THIS LINE

Received by: _________________ Date: _________ File Number: _________________

--------------------------------------------------------------------------------

INSTRUCTIONS:

1. The witness should review this statement for accuracy, then print and sign it.

2. This statement should be submitted as an attachment to VA Form 21-10210 
   (Lay/Witness Statement).

3. Submit online at: https://www.va.gov/supporting-forms-for-claims/lay-witness-statement-form-21-10210/
   Or mail to your VA Regional Office.

4. Retain a copy of this signed statement for your records.

5. The veteran should include this statement with their VA disability claim.
`;

    return statement;
  };

  const generatePersonalStatement = () => {
    const currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const claimTypeLabels = {
      initial: "Initial Service Connection",
      increase: "Claim for Increased Rating",
      secondary: "Secondary Service Connection",
      reopened: "Reopened Claim",
    };

    let statement = `STATEMENT IN SUPPORT OF CLAIM
(To Be Submitted with VA Form 21-4138)

--------------------------------------------------------------------------------

SECTION I - CLAIMANT INFORMATION

Full Name: ${formData.veteranName || "________________________________________"}

Claim Type: ${claimTypeLabels[formData.claimType] || formData.claimType || "____________________"}

Condition Claimed: ${formData.conditionName || "________________________________________"}
${
  formData.claimType === "secondary" && formData.primaryCondition
    ? `
Secondary to (Primary Condition): ${formData.primaryCondition}
`
    : ""
}
--------------------------------------------------------------------------------

SECTION II - IN-SERVICE EVENT/INJURY/ONSET

A. When Symptoms First Began:

${formData.onsetDate || "[Date or timeframe when symptoms first appeared]"}


B. In-Service Event, Injury, or Exposure:

${formData.inServiceEvent || "[Describe the specific event, injury, training accident, exposure, or circumstances that led to or caused this condition]"}

${
  formData.firstTreatment
    ? `
C. First Treatment Sought:

${formData.firstTreatment}
`
    : ""
}
--------------------------------------------------------------------------------

SECTION III - CURRENT SYMPTOMS AND SEVERITY

A. Description of Symptoms:

${formData.symptoms || "[Describe your current symptoms in detail - include frequency, severity, triggers, and physical/mental effects]"}


B. Description of Worst Days:

${formData.worstDays || "[Describe what your worst days look like - this helps the VA understand the full impact of your condition]"}

${
  formData.flareUps
    ? `
C. Flare-Ups:

${formData.flareUps}
`
    : ""
}
--------------------------------------------------------------------------------

SECTION IV - FUNCTIONAL IMPACT

A. Impact on Employment:

${formData.workImpact || "[Describe how this condition affects your ability to work - missed days, limitations, accommodations needed, etc.]"}


B. Impact on Daily Activities:

${formData.dailyImpact || "[Describe how this condition affects daily life - self-care, household tasks, hobbies, driving, etc.]"}

${
  formData.socialImpact
    ? `
C. Impact on Relationships and Social Activities:

${formData.socialImpact}
`
    : ""
}
--------------------------------------------------------------------------------
${
  formData.currentTreatment ||
  formData.medications ||
  formData.treatmentEffectiveness
    ? `
SECTION V - TREATMENT HISTORY
${
  formData.currentTreatment
    ? `
A. Current Treatment:

${formData.currentTreatment}
`
    : ""
}${
        formData.medications
          ? `
B. Current Medications:

${formData.medications}
`
          : ""
      }${
        formData.treatmentEffectiveness
          ? `
C. Treatment Effectiveness:

${formData.treatmentEffectiveness}
`
          : ""
      }
--------------------------------------------------------------------------------
`
    : ""
}
CERTIFICATION AND SIGNATURE

I hereby certify that the statements made herein are true and correct to the best of my knowledge and belief. I understand that a false statement may be grounds for punishment as provided by 18 U.S.C. 1001.


Signature: ________________________________________

Printed Name: ${formData.veteranName || "________________________________________"}

Date Signed: ${currentDate}

--------------------------------------------------------------------------------

FOR VA USE ONLY - DO NOT WRITE BELOW THIS LINE

Received by: _________________ Date: _________ File Number: _________________

--------------------------------------------------------------------------------

INSTRUCTIONS:

1. Review this statement for accuracy and completeness.

2. Print and sign where indicated.

3. Submit with VA Form 21-4138 or as an attachment to your VA disability claim.

4. Submit online at: https://www.va.gov/disability/file-disability-claim-form-21-526ez/
   Or mail to your VA Regional Office.

5. Retain a copy for your records.
`;

    return statement;
  };

  const generatePTSDStatement = () => {
    const currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const stressorLabels = {
      combat: "Combat-Related Trauma",
      mst: "Military Sexual Trauma (MST)",
      "personal-assault": "Personal Assault",
      accident: "Serious Accident/Injury",
      death: "Witnessing Death or Serious Injury",
      "fear-hostile": "Fear of Hostile Military/Terrorist Activity",
      other: "Other Traumatic Event",
    };

    let statement = `STATEMENT IN SUPPORT OF CLAIM FOR PTSD
(To Be Submitted with VA Form 21-0781)

--------------------------------------------------------------------------------

SECTION I - VETERAN IDENTIFICATION

Full Name: ${formData.veteranName || "________________________________________"}

Branch of Service: ${formData.branch || "________________________________________"}

Dates of Military Service: ${formData.serviceDates || "________________________________________"}

--------------------------------------------------------------------------------

SECTION II - STRESSOR EVENT INFORMATION

Type of Stressor: ${stressorLabels[formData.stressorType] || formData.stressorType || "____________________"}

Date of Incident: ${formData.eventDate || "________________________________________"}
(Provide as specific a date as possible - month/year minimum)

Location of Incident: ${formData.eventLocation || "________________________________________"}
(City/Base/Country or geographic location)

${formData.unitInfo ? `Unit Assignment at Time of Event: ${formData.unitInfo}` : "Unit Assignment at Time of Event: ________________________________________"}

--------------------------------------------------------------------------------

SECTION III - DETAILED DESCRIPTION OF STRESSOR EVENT

${formData.eventDescription || "[Provide a detailed description of the traumatic event. Include: what happened before, during, and after the event; who was involved; what you saw, heard, and felt; how you responded; and the immediate aftermath.]"}

--------------------------------------------------------------------------------

SECTION IV - CORROBORATING EVIDENCE

A. Witnesses to Event:
${formData.witnesses || "None identified / Unknown"}

B. Supporting Documentation:
${formData.documentation || "None identified"}

C. Was This Event Reported? To Whom?
${formData.reportedTo || "Not reported / Unknown"}

--------------------------------------------------------------------------------

SECTION V - CURRENT PTSD SYMPTOMS

Check all symptoms you currently experience:

${
  Array.isArray(formData.symptoms) && formData.symptoms.length > 0
    ? formData.symptoms.map((s) => `[X] ${s}`).join("\n")
    : `[ ] Nightmares or disturbing dreams
[ ] Flashbacks (reliving the event)
[ ] Intrusive thoughts or memories
[ ] Avoiding reminders of the trauma
[ ] Difficulty sleeping
[ ] Hypervigilance (always on alert)
[ ] Exaggerated startle response
[ ] Difficulty concentrating
[ ] Irritability or anger outbursts
[ ] Emotional numbness
[ ] Feeling detached from others
[ ] Negative thoughts about self or world
[ ] Memory problems
[ ] Loss of interest in activities
[ ] Difficulty feeling positive emotions`
}

${
  formData.symptomDetails
    ? `
Detailed Description of Symptoms:

${formData.symptomDetails}
`
    : ""
}
--------------------------------------------------------------------------------

CERTIFICATION AND SIGNATURE

I hereby certify that the statements made herein are true and correct to the best of my knowledge and recollection. I understand that a false statement may be grounds for punishment as provided by 18 U.S.C. 1001.


Signature: ________________________________________

Printed Name: ${formData.veteranName || "________________________________________"}

Date Signed: ${currentDate}

--------------------------------------------------------------------------------

FOR VA USE ONLY - DO NOT WRITE BELOW THIS LINE

Received by: _________________ Date: _________ File Number: _________________

--------------------------------------------------------------------------------

INSTRUCTIONS:

1. This statement should accompany VA Form 21-0781 (Statement in Support of 
   Claim for Service Connection for PTSD).

2. For MST claims, use VA Form 21-0781a instead.

3. Submit online at: https://www.va.gov/disability/file-disability-claim-form-21-526ez/
   Or mail to your VA Regional Office.

4. Retain a copy for your records.

IMPORTANT NOTES:

- Combat veterans may have reduced evidentiary requirements under 38 CFR 3.304(f)(2)
- MST claims have special evidence provisions under 38 CFR 3.304(f)(5)
- Fear of hostile activity claims: 38 CFR 3.304(f)(3)

CRISIS RESOURCES:

- Veterans Crisis Line: Dial 988, Press 1
- Crisis Text Line: Text 838255
- VA PTSD Resources: https://www.ptsd.va.gov/
`;

    return statement;
  };

  const generateIntentToFile = () => {
    const currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const oneYearFromNow = new Date(
      Date.now() + 365 * 24 * 60 * 60 * 1000,
    ).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const benefitLabels = {
      compensation: "Disability Compensation",
      pension: "Pension",
      survivors: "Survivors Benefits (DIC)",
    };

    const methodLabels = {
      online: "Online at VA.gov (Recommended)",
      phone: "By Phone (1-800-827-1000)",
      mail: "By Mail",
      inperson: "In Person at VA Regional Office",
    };

    let statement = `INTENT TO FILE WORKSHEET
VA Form 21-0966 - Reference Document

================================================================================

                    *** IMPORTANT ACTION REQUIRED ***

This document is your PLANNING WORKSHEET for filing an Intent to File.

To protect your effective date, you must submit an Intent to File through 
one of the official VA channels listed below. This worksheet is for your 
records only and does NOT constitute an official Intent to File.

================================================================================

SUBMIT YOUR INTENT TO FILE NOW:

Option 1 (Fastest): Online at VA.gov
https://www.va.gov/supporting-forms-for-claims/intent-to-file-form-21-0966/

Option 2: By Phone
Call 1-800-827-1000 (M-F, 8am-9pm ET)
Tell the representative you want to file an "Intent to File"

Option 3: In Person
Visit your local VA Regional Office
https://www.va.gov/find-locations/

================================================================================

YOUR INFORMATION FOR REFERENCE:

Full Name: ${formData.veteranName || "________________________________________"}

Date of Birth: ${formData.dob || "________________________________________"}

VA File Number (if known): ${formData.vaFileNumber || "________________________________________"}

Mailing Address:
${formData.address || "________________________________________"}

Phone: ${formData.phone || "________________________________________"}

Email: ${formData.email || "________________________________________"}

================================================================================

BENEFIT TYPE: ${benefitLabels[formData.benefitType] || "________________________________________"}

${
  formData.conditions
    ? `
Conditions You Plan to Claim:
${formData.conditions}
`
    : ""
}
Preferred Submission Method: ${methodLabels[formData.preferredMethod] || "________________________________________"}

================================================================================

                         *** CRITICAL DEADLINES ***

If you file your Intent to File on: ${currentDate}

Your deadline to submit a complete claim is: ${oneYearFromNow}

You have exactly ONE YEAR from your Intent to File date to submit your 
complete disability claim (VA Form 21-526EZ).

================================================================================

WHY INTENT TO FILE MATTERS:

If approved, your VA benefits can be BACKDATED to your Intent to File date.

Example: 
- You file Intent to File on ${currentDate}
- You submit your complete claim 6 months later
- If approved, you receive 6 months of BACK PAY

This could be worth thousands of dollars!

================================================================================

NEXT STEPS CHECKLIST:

[ ] 1. Submit Intent to File TODAY (use one of the methods above)

[ ] 2. Save your confirmation number: _______________________

[ ] 3. Note your 1-year deadline: ${oneYearFromNow}

[ ] 4. Gather evidence:
    [ ] Service treatment records
    [ ] VA medical records  
    [ ] Private medical records
    [ ] Buddy statements
    [ ] Nexus letters (if applicable)

[ ] 5. File complete claim (VA Form 21-526EZ) before deadline

================================================================================

RESOURCES:

File Intent to File Online:
https://www.va.gov/supporting-forms-for-claims/intent-to-file-form-21-0966/

File Disability Claim Online:
https://www.va.gov/disability/file-disability-claim-form-21-526ez/

Find a VA Regional Office:
https://www.va.gov/find-locations/

Find an Accredited VSO:
https://www.va.gov/vso/

VA Benefits Hotline: 1-800-827-1000

================================================================================
`;

    return statement;
  };

  const generateMedicalRelease = () => {
    const currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const expirationDate = new Date(
      Date.now() + 180 * 24 * 60 * 60 * 1000,
    ).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    let statement = `AUTHORIZATION TO DISCLOSE INFORMATION TO VA
Reference Worksheet for VA Forms 21-4142 & 21-4142a

================================================================================

                      *** REFERENCE DOCUMENT ***

This worksheet contains the information you will need to complete the 
official VA Form 21-4142 (Authorization to Disclose Information) and 
VA Form 21-4142a (General Release for Medical Provider Information).

Submit the official forms online at:
https://www.va.gov/supporting-forms-for-claims/release-information-to-va-form-21-4142/

================================================================================

SECTION I - VETERAN/CLAIMANT INFORMATION

Full Name: ${formData.veteranName || "________________________________________"}

Date of Birth: ${formData.dob || "________________________________________"}

VA File Number: ${formData.vaFileNumber || "________________________________________"}

Telephone: ${formData.phone || "________________________________________"}

Mailing Address:
${formData.address || "________________________________________"}

================================================================================

SECTION II - HEALTHCARE PROVIDER INFORMATION

PROVIDER #1:

Name of Provider/Facility: ${formData.provider1Name || "________________________________________"}

Street Address:
${formData.provider1Address || "________________________________________"}

Telephone: ${formData.provider1Phone || "________________________________________"}

Fax Number: ${formData.provider1Fax || "________________________________________"}

Dates of Treatment: ${formData.provider1Dates || "________________________________________"}

Condition(s) Treated: ${formData.provider1Conditions || "________________________________________"}

`;

    if (formData.provider2Name) {
      statement += `--------------------------------------------------------------------------------

PROVIDER #2:

Name of Provider/Facility: ${formData.provider2Name}

Street Address:
${formData.provider2Address || "________________________________________"}

Telephone: ${formData.provider2Phone || "________________________________________"}

Dates of Treatment: ${formData.provider2Dates || "________________________________________"}

Condition(s) Treated: ${formData.provider2Conditions || "________________________________________"}

`;
    }

    if (formData.provider3Name) {
      statement += `--------------------------------------------------------------------------------

PROVIDER #3:

Name of Provider/Facility: ${formData.provider3Name}

Street Address:
${formData.provider3Address || "________________________________________"}

Telephone: ${formData.provider3Phone || "________________________________________"}

Dates of Treatment: ${formData.provider3Dates || "________________________________________"}

Condition(s) Treated: ${formData.provider3Conditions || "________________________________________"}

`;
    }

    statement += `================================================================================

SECTION III - RECORDS REQUESTED

Types of records the VA should request:

${
  Array.isArray(formData.recordTypes) && formData.recordTypes.length > 0
    ? formData.recordTypes.map((r) => `[X] ${r}`).join("\n")
    : `[ ] Complete medical records
[ ] Treatment notes/progress notes
[ ] Lab results
[ ] Imaging (X-rays, MRI, CT scans)
[ ] Surgical records
[ ] Mental health records
[ ] Physical therapy records
[ ] Prescription history
[ ] Diagnosis and prognosis
[ ] Disability/work restriction documentation`
}

${
  formData.additionalInstructions
    ? `
Special Instructions:
${formData.additionalInstructions}
`
    : ""
}
================================================================================

SECTION IV - AUTHORIZATION

I authorize the healthcare provider(s) listed above to release medical 
information pertaining to the conditions listed to the Department of 
Veterans Affairs. This information is needed to evaluate my claim for 
VA disability benefits.

EXPIRATION: This authorization expires ${expirationDate}
            (180 days from the date of signature)


Signature: ________________________________________

Printed Name: ${formData.veteranName || "________________________________________"}

Date Signed: ${currentDate}

================================================================================

SUBMISSION INSTRUCTIONS:

1. Use this worksheet to gather your information

2. Submit official forms online (recommended):
   https://www.va.gov/supporting-forms-for-claims/release-information-to-va-form-21-4142/

3. Or download and mail the forms:
   - VA Form 21-4142: https://www.va.gov/find-forms/about-form-21-4142/
   - VA Form 21-4142a: https://www.va.gov/find-forms/about-form-21-4142a/

4. Submit a SEPARATE 21-4142 for EACH healthcare provider

================================================================================

IMPORTANT REMINDERS:

[ ] Verify provider addresses and phone numbers are current
[ ] Include complete dates of treatment (from - to)
[ ] List ALL conditions treated by each provider
[ ] Authorization expires in 180 days - submit promptly
[ ] Keep copies of all signed forms for your records
[ ] Follow up with the VA if records aren't obtained within 30 days

================================================================================

PROVIDER VERIFICATION CHECKLIST:

Before submitting, contact each provider to confirm:
[ ] They still have your records on file
[ ] Their mailing address is correct
[ ] Their fax number is correct (if applicable)
[ ] Records will be released to VA upon request

================================================================================
`;

    return statement;
  };

  const generatePriorityProcessing = () => {
    const currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const claimTypeLabels = {
      initial: "Initial Disability Compensation Claim",
      increase: "Claim for Increased Rating",
      secondary: "Secondary Service Connection Claim",
      pension: "Pension Claim",
      dic: "Dependency and Indemnity Compensation (DIC)",
      appeal: "Appeal",
      other: "Other VA Benefit Claim",
    };

    let statement = `REQUEST FOR PRIORITY PROCESSING
(To Be Submitted with VA Form 20-10207)

================================================================================

                    *** URGENT HARDSHIP REQUEST ***

This document contains information for your Request for Priority Processing.
You MUST have an existing pending claim to request expedited processing.

Submit the official form online at:
https://www.va.gov/supporting-forms-for-claims/request-priority-processing-form-20-10207/

================================================================================

SECTION I - CLAIMANT INFORMATION

Full Name: ${formData.veteranName || "________________________________________"}

Date of Birth: ${formData.dob || "________________________________________"}

VA File Number: ${formData.vaFileNumber || "________________________________________"}

Telephone: ${formData.phone || "________________________________________"}

Email: ${formData.email || "________________________________________"}

================================================================================

SECTION II - EXISTING CLAIM INFORMATION

Type of Pending Claim: ${claimTypeLabels[formData.claimType] || "________________________________________"}

Date Claim Was Filed: ${formData.claimDate || "________________________________________"}

Description of Claim:
${formData.claimDescription || "________________________________________"}

================================================================================

SECTION III - QUALIFYING CIRCUMSTANCES

Check all that apply to your situation:

${
  Array.isArray(formData.priorityReasons) && formData.priorityReasons.length > 0
    ? formData.priorityReasons.map((r) => `[X] ${r}`).join("\n")
    : `[ ] Terminal illness (life expectancy of 6 months or less)
[ ] Serious illness requiring immediate care
[ ] Financial hardship (facing eviction, utilities shutoff, etc.)
[ ] Homeless or at imminent risk of homelessness
[ ] ALS (Amyotrophic Lateral Sclerosis) diagnosis
[ ] Age 85 or older
[ ] Medal of Honor recipient
[ ] Former Prisoner of War (POW)
[ ] Experiencing extreme financial hardship
[ ] Survivor of Military Sexual Trauma with pending MST claim
[ ] Purple Heart recipient
[ ] Very Seriously Injured/Ill (VSI) or Seriously Injured/Ill (SI)
[ ] Other qualifying hardship`
}

================================================================================

SECTION IV - DETAILED EXPLANATION OF HARDSHIP

Describe your hardship situation in detail, including specific dates, 
amounts, and circumstances:

${formData.hardshipExplanation || "[Provide detailed explanation of your hardship, including specific evidence such as eviction notices, medical documentation, financial statements, etc.]"}

================================================================================

SECTION V - SUPPORTING DOCUMENTATION

I have the following documentation to support my request:

${
  Array.isArray(formData.supportingDocs) && formData.supportingDocs.length > 0
    ? formData.supportingDocs.map((d) => `[X] ${d}`).join("\n")
    : `[ ] Medical documentation of terminal/serious illness
[ ] Doctor's statement about prognosis
[ ] Eviction notice or past due rent notice
[ ] Utility shutoff notice
[ ] Bank statements showing financial hardship
[ ] Homeless shelter documentation
[ ] DD-214 showing POW status
[ ] Medal of Honor documentation
[ ] Other qualifying documentation`
}

================================================================================

SECTION VI - EMERGENCY CONTACT INFORMATION

Emergency Contact Name: ${formData.emergencyContact || "________________________________________"}

Emergency Contact Phone: ${formData.emergencyPhone || "________________________________________"}

Best Time to Reach You: ${formData.bestTimeToCall || "________________________________________"}

${
  formData.additionalInfo
    ? `
Additional Information:
${formData.additionalInfo}
`
    : ""
}
================================================================================

CERTIFICATION AND SIGNATURE

I certify under penalty of perjury that the information provided in this 
request is true and correct. I understand that making false statements may 
result in criminal penalties under 18 U.S.C. 1001 and denial of my request.


Signature: ________________________________________

Printed Name: ${formData.veteranName || "________________________________________"}

Date Signed: ${currentDate}

================================================================================

SUBMISSION INSTRUCTIONS:

1. Gather ALL supporting documentation before submitting

2. Submit online (recommended):
   https://www.va.gov/supporting-forms-for-claims/request-priority-processing-form-20-10207/

3. Or call the VA at 1-800-827-1000 to request expedited processing

4. Upload or mail ALL supporting documentation with your request

5. Keep copies of everything for your records

================================================================================

IMPORTANT NOTES:

- Priority processing is NOT guaranteed
- You MUST have an existing pending claim
- Provide as much documentation as possible
- The more evidence you provide, the better your chances
- Follow up within 2 weeks if you don't receive confirmation

================================================================================

EMERGENCY RESOURCES:

If you are in crisis, please use these resources immediately:

Veterans Crisis Line: Dial 988, Press 1
Crisis Text Line: Text 838255

Homeless Veterans Hotline: 1-877-4AID-VET (1-877-424-3838)
https://www.va.gov/homeless/

National Suicide Prevention Lifeline: 988
https://988lifeline.org/

VA Benefits Hotline: 1-800-827-1000

================================================================================
`;

    return statement;
  };

  // Generate VSO Appointment (21-22)
  const generateVSOAppointment = () => {
    const currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const vsoName =
      formData.vsoName === "Other" ? formData.vsoOther : formData.vsoName;

    let statement = `APPOINTMENT OF VETERANS SERVICE ORGANIZATION
VA Form 21-22 Information Sheet

================================================================================

                    APPOINTING A VSO AS YOUR REPRESENTATIVE

This document contains information for your VA Form 21-22.
A VSO can help with your VA claims at NO COST to you.

Official Form: https://www.va.gov/find-forms/about-form-21-22/
Find a VSO: https://www.va.gov/vso/

================================================================================

SECTION I - VETERAN/CLAIMANT INFORMATION

Name: ${formData.veteranFirstName || ""} ${formData.veteranMiddleInitial || ""} ${formData.veteranLastName || ""}

Last 4 of SSN: XXX-XX-${formData.ssn || "____"}

Date of Birth: ${formData.dob || "________________________________________"}

VA File Number: ${formData.vaFileNumber || "Same as SSN"}

Insurance File Number: ${formData.insuranceNumber || "N/A"}

================================================================================

SECTION II - CONTACT INFORMATION

Telephone: ${formData.phone || "________________________________________"}

Email: ${formData.email || "________________________________________"}

Address:
${formData.street || "________________________________________"}
${formData.apt ? `Apt/Unit: ${formData.apt}` : ""}
${formData.city || "_____________"}, ${formData.state || "__"} ${formData.zip || "_____"}
${formData.country || "United States"}

================================================================================

SECTION III - VETERANS SERVICE ORGANIZATION

Organization Name: ${vsoName || "________________________________________"}

${formData.vsoAddress ? `VSO Office Address: ${formData.vsoAddress}` : ""}

================================================================================

SECTION IV - AUTHORIZATION

I hereby appoint the above-named organization to represent me in the 
preparation, presentation, and prosecution of claims for benefits from 
the Department of Veterans Affairs.

Authorization Scope:
${
  Array.isArray(formData.authorizationScope) &&
  formData.authorizationScope.length > 0
    ? formData.authorizationScope.map((a) => `[X] ${a}`).join("\n")
    : `[X] Access my VA records
[X] Represent me in all VA claims matters
[X] Submit evidence and documentation on my behalf
[X] Appeal decisions on my behalf`
}

Record Access: ${formData.limitAccess === "yes" ? "LIMITED (see restrictions below)" : "FULL ACCESS TO ALL RECORDS"}

${
  formData.limitAccess === "yes" && formData.accessLimitations
    ? `\nAccess Limitations:\n${formData.accessLimitations}`
    : ""
}

================================================================================

VETERAN CERTIFICATION

I certify that I have read and understand the Privacy Act notice and 
the terms of this appointment.

Signature: ________________________________________

Printed Name: ${formData.veteranFirstName || ""} ${formData.veteranLastName || ""}

Date: ${currentDate}

================================================================================

WHAT HAPPENS NEXT:

1. Complete the official VA Form 21-22:
   https://www.va.gov/find-forms/about-form-21-22/

2. Submit online through VA.gov (recommended) or mail to your regional office

3. Contact your chosen VSO to introduce yourself:
   - DAV: 1-877-426-2838 | www.dav.org
   - American Legion: 1-800-433-3318 | www.legion.org
   - VFW: 1-833-839-8387 | www.vfw.org
   - AMVETS: 1-877-726-8387 | www.amvets.org

4. Gather any evidence or documentation for your claims

5. Your VSO will have access to your VA records within a few days

================================================================================

IMPORTANT NOTES:

✓ VSO services are 100% FREE - they cannot charge you any fees
✓ You can change VSOs at any time by filing a new 21-22
✓ Your previous representative appointment will be automatically revoked
✓ VSOs are trained and accredited by the VA
✓ They can represent you for ALL VA benefits, not just disability

================================================================================

FIND YOUR LOCAL VSO:

Online Directory: https://www.va.gov/vso/
VA Benefits Hotline: 1-800-827-1000

================================================================================
`;

    return statement;
  };

  // Generate Individual Representative Appointment (21-22a)
  const generateIndividualRepAppointment = () => {
    const currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const repTypeLabel =
      formData.repType === "attorney" ? "Attorney" : "Accredited Claims Agent";

    let statement = `APPOINTMENT OF INDIVIDUAL AS CLAIMANT'S REPRESENTATIVE
VA Form 21-22a Information Sheet

================================================================================

              APPOINTING AN ATTORNEY OR CLAIMS AGENT

This document contains information for your VA Form 21-22a.
Use this form to appoint an individual (attorney or claims agent).

Official Form: https://www.va.gov/find-forms/about-form-21-22a/
Find Accredited Representatives: https://www.va.gov/ogc/apps/accreditation/

================================================================================

SECTION I - VETERAN/CLAIMANT INFORMATION

Name: ${formData.veteranFirstName || ""} ${formData.veteranMiddleInitial || ""} ${formData.veteranLastName || ""}

Last 4 of SSN: XXX-XX-${formData.ssn || "____"}

Date of Birth: ${formData.dob || "________________________________________"}

VA File Number: ${formData.vaFileNumber || "Same as SSN"}

================================================================================

SECTION II - VETERAN CONTACT INFORMATION

Telephone: ${formData.phone || "________________________________________"}

Email: ${formData.email || "________________________________________"}

Address:
${formData.street || "________________________________________"}
${formData.apt ? `Apt/Unit: ${formData.apt}` : ""}
${formData.city || "_____________"}, ${formData.state || "__"} ${formData.zip || "_____"}

================================================================================

SECTION III - REPRESENTATIVE INFORMATION

Representative Type: ${repTypeLabel}

Name: ${formData.repName || "________________________________________"}

Organization/Firm: ${formData.repOrganization || "N/A"}

Address:
${formData.repAddress || "________________________________________"}
${formData.repCity || "_____________"}, ${formData.repState || "__"} ${formData.repZip || "_____"}

Telephone: ${formData.repPhone || "________________________________________"}

Email: ${formData.repEmail || "________________________________________"}

================================================================================

SECTION IV - FEE AGREEMENT

Fee Agreement Status: ${formData.feeAgreement === "attached" ? "ATTACHED" : formData.feeAgreement === "will-submit" ? "TO BE SUBMITTED SEPARATELY" : "NO FEE (PRO BONO)"}

IMPORTANT FEE RULES - I understand and acknowledge:
${
  Array.isArray(formData.feeUnderstanding) &&
  formData.feeUnderstanding.length > 0
    ? formData.feeUnderstanding.map((f) => `[X] ${f}`).join("\n")
    : `[X] Attorneys/agents may only charge fees AFTER VA issues an initial decision
[X] VA limits fees to 33.3% of past-due benefits (unless higher approved)
[X] The fee agreement must be filed with the VA
[X] I can revoke this appointment at any time by filing a new form`
}

================================================================================

SECTION V - AUTHORIZATION

I authorize this representative to:
${
  Array.isArray(formData.authorizationScope) &&
  formData.authorizationScope.length > 0
    ? formData.authorizationScope.map((a) => `[X] ${a}`).join("\n")
    : `[X] Access my VA records
[X] Represent me in all VA claims matters
[X] Submit evidence on my behalf
[X] File appeals on my behalf`
}

================================================================================

VETERAN CERTIFICATION

I certify that:
- I have read and understand the Privacy Act notice
- I understand the fee agreement terms
- I knowingly appoint this individual as my representative

Veteran Signature: ________________________________________

Printed Name: ${formData.veteranFirstName || ""} ${formData.veteranLastName || ""}

Date: ${currentDate}

================================================================================

REPRESENTATIVE CERTIFICATION

Representative Signature: ________________________________________

Printed Name: ${formData.repName || ""}

Date: ________________________________________

================================================================================

WHAT HAPPENS NEXT:

1. Complete the official VA Form 21-22a:
   https://www.va.gov/find-forms/about-form-21-22a/

2. Ensure your representative is VA-accredited:
   https://www.va.gov/ogc/apps/accreditation/

3. Execute your fee agreement (if applicable)

4. Submit the form and fee agreement to VA

5. Your representative will receive access to your records

================================================================================

FEE LIMITATIONS (per 38 CFR § 14.636):

- Fees may ONLY be charged after VA issues an initial decision
- Maximum fee is 33.3% of past-due benefits
- Higher fees require VA approval
- Fee agreements must be in writing and filed with VA
- Fees for "frivolous" claims are not allowed

================================================================================

VERIFY ACCREDITATION:

Before hiring any attorney or claims agent, verify they are accredited:
https://www.va.gov/ogc/apps/accreditation/

VA Office of General Counsel Accreditation Search
Phone: 1-202-461-7699

================================================================================
`;

    return statement;
  };

  // Third Party Authorization generator
  const generateThirdPartyAuth = () => {
    const currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const relationshipLabels = {
      spouse: "Spouse",
      child: "Adult Child",
      parent: "Parent",
      sibling: "Sibling",
      caregiver: "Caregiver",
      friend: "Friend",
      other: "Other",
    };
    const durationLabels = {
      "6-months": "6 Months",
      "1-year": "1 Year",
      "2-years": "2 Years",
      "until-revoked": "Until Revoked",
    };

    return `THIRD PARTY AUTHORIZATION INFORMATION
VA Form 21-0845

================================================================================

VETERAN/CLAIMANT INFORMATION

Name: ${formData.veteranFirstName || ""} ${formData.veteranMiddleInitial || ""} ${formData.veteranLastName || ""}
Last 4 of SSN: XXX-XX-${formData.ssn || "____"}
Date of Birth: ${formData.dob || "____"}
VA File Number: ${formData.vaFileNumber || "Same as SSN"}

Contact:
Phone: ${formData.phone || "____"}
Email: ${formData.email || "____"}
Address: ${formData.street || "____"}, ${formData.city || "____"}, ${formData.state || "__"} ${formData.zip || "_____"}

================================================================================

AUTHORIZED THIRD PARTY

Name: ${formData.thirdPartyName || "____"}
Relationship: ${relationshipLabels[formData.thirdPartyRelationship] || formData.thirdPartyRelationship || "____"}
Phone: ${formData.thirdPartyPhone || "____"}
Email: ${formData.thirdPartyEmail || "____"}
Address: ${formData.thirdPartyAddress || "____"}

================================================================================

AUTHORIZATION DETAILS

Duration: ${durationLabels[formData.authorizationDuration] || "____"}

This person is authorized to:
${Array.isArray(formData.authorizationScope) ? formData.authorizationScope.map((s) => `[X] ${s}`).join("\n") : "[  ] See form for authorizations"}

Limited to specific claim: ${formData.limitToSpecificClaim === "yes" ? "YES" : "NO"}
${formData.specificClaimDetails ? `Claim Details: ${formData.specificClaimDetails}` : ""}

================================================================================

Date: ${currentDate}

Complete official form at: https://www.va.gov/find-forms/about-form-21-0845/

================================================================================
`;
  };

  // FOIA Request generator
  const generateFOIARequest = () => {
    const currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const branchLabels = {
      army: "U.S. Army",
      navy: "U.S. Navy",
      "air-force": "U.S. Air Force",
      marines: "U.S. Marine Corps",
      "coast-guard": "U.S. Coast Guard",
      "space-force": "U.S. Space Force",
    };

    return `FREEDOM OF INFORMATION ACT / PRIVACY ACT REQUEST
VA Form 20-10206

================================================================================

REQUESTOR INFORMATION

Name: ${formData.veteranFirstName || ""} ${formData.veteranMiddleInitial || ""} ${formData.veteranLastName || ""}
SSN: ${formData.ssn || "____"}
Date of Birth: ${formData.dob || "____"}
VA File Number: ${formData.vaFileNumber || "Same as SSN"}
Branch of Service: ${branchLabels[formData.branchOfService] || "____"}

Contact:
Phone: ${formData.phone || "____"}
Email: ${formData.email || "____"}
Address: ${formData.street || "____"}, ${formData.city || "____"}, ${formData.state || "__"} ${formData.zip || "_____"}

================================================================================

RECORDS REQUESTED

${Array.isArray(formData.recordsRequested) ? formData.recordsRequested.map((r) => `[X] ${r}`).join("\n") : "[  ] See form for records requested"}

Date Range: ${formData.dateRange || "All available records"}

Specific Conditions/Claims: ${formData.specificConditions || "All conditions on file"}

================================================================================

DELIVERY PREFERENCES

Method: ${formData.deliveryMethod === "mail" ? "Mail to my address" : formData.deliveryMethod === "email" ? "Email" : "Pick up at VARO"}
Expedited Processing: ${formData.expediteReason !== "no" ? "YES - " + (formData.expediteDetails || formData.expediteReason) : "No"}

================================================================================

IMPORTANT NOTES:
- Processing typically takes 30-90+ days
- Expedited requests require justification
- Some records may require redaction of third-party information
- There is no fee for veterans requesting their own records

Date: ${currentDate}

Complete official form at: https://www.va.gov/find-forms/about-form-20-10206/

================================================================================
`;
  };

  // Alternate Signer generator
  const generateAlternateSigner = () => {
    const currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const reasonLabels = {
      "physical-disability": "Physical Disability",
      hospitalized: "Hospitalized",
      "cognitive-impairment": "Cognitive Impairment",
      "vision-impairment": "Vision Impairment",
      paralysis: "Paralysis/Mobility Limitation",
      other: "Other Medical Condition",
    };
    const relationLabels = {
      spouse: "Spouse",
      "adult-child": "Adult Child",
      parent: "Parent",
      sibling: "Sibling",
      "legal-guardian": "Legal Guardian",
      "court-appointed": "Court-Appointed Representative",
      other: "Other",
    };

    return `ALTERNATE SIGNER CERTIFICATION
VA Form 21-0972

================================================================================

VETERAN INFORMATION

Name: ${formData.veteranFirstName || ""} ${formData.veteranMiddleInitial || ""} ${formData.veteranLastName || ""}
Last 4 of SSN: XXX-XX-${formData.ssn || "____"}
Date of Birth: ${formData.dob || "____"}
VA File Number: ${formData.vaFileNumber || "Same as SSN"}

================================================================================

REASON FOR ALTERNATE SIGNER

Reason: ${reasonLabels[formData.unableToSignReason] || formData.unableToSignReason || "____"}
Permanent Condition: ${formData.isPermanent === "yes" ? "YES" : "NO"}

Description:
${formData.conditionDetails || "____"}

================================================================================

ALTERNATE SIGNER INFORMATION

Name: ${formData.altSignerName || "____"}
Relationship to Veteran: ${relationLabels[formData.altSignerRelationship] || "____"}
Phone: ${formData.altSignerPhone || "____"}
Email: ${formData.altSignerEmail || "____"}
Address: ${formData.altSignerAddress || "____"}

================================================================================

CERTIFICATIONS

The alternate signer certifies:
${Array.isArray(formData.certifications) ? formData.certifications.map((c) => `[X] ${c}`).join("\n") : "[  ] See form for certifications"}

${formData.witnessStatement ? `Additional Statement: ${formData.witnessStatement}` : ""}

================================================================================

Date: ${currentDate}

Complete official form at: https://www.va.gov/find-forms/about-form-21-0972/

================================================================================
`;
  };

  // Nursing Home Information generator
  const generateNursingHome = () => {
    const currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const facilityTypes = {
      "skilled-nursing": "Skilled Nursing Facility",
      "nursing-home": "Nursing Home",
      "assisted-living": "Assisted Living",
      "va-clc": "VA Community Living Center",
      "state-veterans-home": "State Veterans Home",
    };
    const stayLabels = {
      "short-term": "Short-term (< 90 days)",
      "long-term": "Long-term (90+ days)",
      permanent: "Permanent",
      unknown: "Unknown",
    };

    return `NURSING HOME INFORMATION
VA Form 21-0779

================================================================================

VETERAN INFORMATION

Name: ${formData.veteranFirstName || ""} ${formData.veteranMiddleInitial || ""} ${formData.veteranLastName || ""}
SSN: ${formData.ssn || "____"}
Date of Birth: ${formData.dob || "____"}
VA File Number: ${formData.vaFileNumber || "Same as SSN"}

================================================================================

NURSING HOME FACILITY

Name: ${formData.facilityName || "____"}
Type: ${facilityTypes[formData.facilityType] || "____"}
Address: ${formData.facilityAddress || "____"}, ${formData.facilityCity || "____"}, ${formData.facilityState || "__"} ${formData.facilityZip || "_____"}
Phone: ${formData.facilityPhone || "____"}

================================================================================

ADMISSION DETAILS

Admission Date: ${formData.admissionDate || "____"}
Expected Stay: ${stayLabels[formData.expectedStay] || "____"}

Level of Care:
${Array.isArray(formData.levelOfCare) ? formData.levelOfCare.map((l) => `[X] ${l}`).join("\n") : "[  ] See form for care details"}

Medicaid Status: ${formData.medicaidStatus === "receiving" ? "Currently Receiving" : formData.medicaidStatus === "pending" ? "Application Pending" : "Not Receiving"}

================================================================================

BENEFIT REQUESTED

Benefit Type: ${formData.benefitRequested === "aid-attendance" ? "Aid & Attendance" : formData.benefitRequested === "housebound" ? "Housebound" : formData.benefitRequested === "pension" ? "VA Pension" : formData.benefitRequested === "dic" ? "DIC" : "____"}
Currently Receiving VA Benefits: ${formData.currentlyReceiving !== "no" ? "YES - " + formData.currentlyReceiving : "NO"}

${formData.additionalInfo ? `Additional Info: ${formData.additionalInfo}` : ""}

================================================================================

Date: ${currentDate}

Complete official form at: https://www.va.gov/find-forms/about-form-21-0779/

================================================================================
`;
  };

  // Substitution Request generator
  const generateSubstitutionRequest = () => {
    const currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const relationLabels = {
      spouse: "Surviving Spouse",
      child: "Child",
      parent: "Dependent Parent",
    };

    return `REQUEST FOR SUBSTITUTION OF CLAIMANT
VA Form 21P-0847

================================================================================

DECEASED VETERAN INFORMATION

Name: ${formData.veteranFirstName || ""} ${formData.veteranMiddleInitial || ""} ${formData.veteranLastName || ""}
SSN: ${formData.veteranSSN || "____"}
Date of Birth: ${formData.veteranDOB || "____"}
Date of Death: ${formData.dateOfDeath || "____"}
VA File Number: ${formData.vaFileNumber || "Same as SSN"}

================================================================================

SUBSTITUTE CLAIMANT INFORMATION (YOU)

Name: ${formData.substituteFirstName || ""} ${formData.substituteMiddleInitial || ""} ${formData.substituteLastName || ""}
SSN: ${formData.substituteSSN || "____"}
Date of Birth: ${formData.substituteDOB || "____"}
Relationship to Veteran: ${relationLabels[formData.relationshipToVeteran] || "____"}

Contact:
Phone: ${formData.phone || "____"}
Email: ${formData.email || "____"}
Address: ${formData.street || "____"}, ${formData.city || "____"}, ${formData.state || "__"} ${formData.zip || "_____"}

================================================================================

PENDING CLAIM INFORMATION

Type of Pending Claim:
${Array.isArray(formData.pendingClaimType) ? formData.pendingClaimType.map((t) => `[X] ${t}`).join("\n") : "[  ] See form for claim types"}

Claim Details: ${formData.claimDetails || "____"}
Approximate Filing Date: ${formData.claimFiledDate || "Unknown"}

================================================================================

ACKNOWLEDGMENTS

${Array.isArray(formData.acknowledgments) ? formData.acknowledgments.map((a) => `[X] ${a}`).join("\n") : "[  ] See form for acknowledgments"}

================================================================================

IMPORTANT: Request must be filed within 1 YEAR of the veteran's death.

Date: ${currentDate}

Complete official form at: https://www.va.gov/find-forms/about-form-21p-0847/

================================================================================
`;
  };

  // Income & Asset Statement generator
  const generateIncomeAsset = () => {
    const currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const maritalLabels = {
      single: "Single",
      married: "Married",
      divorced: "Divorced",
      widowed: "Widowed",
    };

    return `INCOME AND ASSET STATEMENT
VA Form 21P-0969

================================================================================

CLAIMANT INFORMATION

Name: ${formData.veteranFirstName || ""} ${formData.veteranMiddleInitial || ""} ${formData.veteranLastName || ""}
SSN: ${formData.ssn || "____"}
Date of Birth: ${formData.dob || "____"}
VA File Number: ${formData.vaFileNumber || "Same as SSN"}
Marital Status: ${maritalLabels[formData.maritalStatus] || "____"}

================================================================================

MONTHLY INCOME

Social Security:                    ${formData.socialSecurityIncome || "$0"}
Military Retirement:                ${formData.militaryRetirement || "$0"}
Civil Service/Federal Retirement:   ${formData.civilServiceRetirement || "$0"}
Other Pension/Retirement:           ${formData.otherRetirement || "$0"}
Wages/Salary:                       ${formData.wages || "$0"}
Interest & Dividends:               ${formData.interestDividends || "$0"}
Rental Income:                      ${formData.rentalIncome || "$0"}
Other Income:                       ${formData.otherIncome || "$0"}
${formData.otherIncomeSource ? `  Source: ${formData.otherIncomeSource}` : ""}

================================================================================

ASSETS

Bank Accounts (total):              ${formData.bankAccounts || "$0"}
Stocks/Bonds/Mutual Funds:          ${formData.stocks || "$0"}
IRA/401k/Retirement:                ${formData.ira401k || "$0"}
Real Estate (not primary home):     ${formData.realEstate || "$0"}
Vehicles:                           ${formData.vehicles || "$0"}
Other Assets:                       ${formData.otherAssets || "$0"}

Primary Home (reference):           ${formData.primaryHomeValue || "N/A - typically excluded"}

================================================================================

DEDUCTIBLE MEDICAL EXPENSES (MONTHLY)

Health Insurance Premiums:          ${formData.healthInsurancePremiums || "$0"}
Medicare Part B:                    ${formData.medicarePartB || "$0"}
Prescriptions:                      ${formData.prescriptions || "$0"}
Doctor Visits:                      ${formData.doctorVisits || "$0"}
Nursing Home/Assisted Living:       ${formData.nursingHomeCost || "$0"}
In-Home Care:                       ${formData.inHomeCare || "$0"}
Medical Equipment:                  ${formData.medicalEquipment || "$0"}
Other Medical:                      ${formData.otherMedical || "$0"}

${formData.medicalExpenseNote ? `Note: ${formData.medicalExpenseNote}` : ""}

================================================================================

Date: ${currentDate}

Complete official form at: https://www.va.gov/find-forms/about-form-21p-0969/

================================================================================
`;
  };

  // Medical Expense Report generator
  const generateMedicalExpenseReport = () => {
    const currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const reportTypes = {
      annual: "Annual Report",
      initial: "Initial Claim",
      update: "Update/Correction",
    };

    return `MEDICAL EXPENSE REPORT
VA Form 21P-8416

================================================================================

CLAIMANT INFORMATION

Name: ${formData.veteranFirstName || ""} ${formData.veteranMiddleInitial || ""} ${formData.veteranLastName || ""}
SSN: ${formData.ssn || "____"}
VA File Number: ${formData.vaFileNumber || "Same as SSN"}
Phone: ${formData.phone || "____"}

================================================================================

REPORTING PERIOD

Year: ${formData.reportingYear || "____"}
Period: ${formData.reportPeriodStart || "____"} to ${formData.reportPeriodEnd || "____"}
Report Type: ${reportTypes[formData.reportType] || "____"}

================================================================================

INSURANCE & CARE COSTS (FOR PERIOD)

Health Insurance Premiums:          ${formData.healthInsurance || "$0"}
Medicare Part B:                    ${formData.medicarePartB || "$0"}
Medicare Supplement/Medigap:        ${formData.medicareSupplement || "$0"}
Prescription Drug Plan Premium:     ${formData.prescriptionPlan || "$0"}
Nursing Home/Assisted Living:       ${formData.nursingHome || "$0"}
Adult Day Care:                     ${formData.adultDayCare || "$0"}
Home Health Aide/In-Home Care:      ${formData.homeHealthAide || "$0"}

================================================================================

OUT-OF-POCKET MEDICAL COSTS (FOR PERIOD)

Prescriptions:                      ${formData.prescriptions || "$0"}
Doctor Visit Copays:                ${formData.doctorCopays || "$0"}
Hospital/ER Copays:                 ${formData.hospitalCopays || "$0"}
Dental Expenses:                    ${formData.dentalExpenses || "$0"}
Vision/Eye Care:                    ${formData.visionExpenses || "$0"}
Hearing Aids/Care:                  ${formData.hearingAids || "$0"}
Medical Equipment/Supplies:         ${formData.medicalEquipment || "$0"}
Medical Transportation:             ${formData.transportation || "$0"}
Other Medical:                      ${formData.otherMedical || "$0"}

${formData.otherDescription ? `Other Description: ${formData.otherDescription}` : ""}

================================================================================

KEEP YOUR RECEIPTS - VA may request documentation.

Date: ${currentDate}

Complete official form at: https://www.va.gov/find-forms/about-form-21p-8416/

================================================================================
`;
  };

  // Employment Information generator
  const generateEmploymentInfo = () => {
    const currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const leaveReasons = {
      disability: "Left Due to Disability",
      "laid-off": "Laid Off/Position Eliminated",
      terminated: "Terminated",
      resigned: "Resigned",
      retired: "Retired",
    };
    const missedLabels = {
      none: "Rarely Missed",
      occasional: "1-5 days/month",
      frequent: "6-10 days/month",
      "very-frequent": "10+ days/month",
      "unable-to-work": "Unable to Work",
    };

    return `REQUEST FOR EMPLOYMENT INFORMATION
VA Form 21-4192

================================================================================

This form is for TDIU (Total Disability Individual Unemployability) claims.
Send this to your employer(s) for completion.

================================================================================

VETERAN INFORMATION

Name: ${formData.veteranFirstName || ""} ${formData.veteranMiddleInitial || ""} ${formData.veteranLastName || ""}
SSN: ${formData.ssn || "____"}
Date of Birth: ${formData.dob || "____"}
VA File Number: ${formData.vaFileNumber || "Same as SSN"}
Phone: ${formData.phone || "____"}

================================================================================

EMPLOYER INFORMATION

Company Name: ${formData.employerName || "____"}
Address: ${formData.employerAddress || "____"}, ${formData.employerCity || "____"}, ${formData.employerState || "__"} ${formData.employerZip || "_____"}
Phone: ${formData.employerPhone || "____"}
Supervisor/HR Contact: ${formData.supervisorName || "____"}

================================================================================

EMPLOYMENT DETAILS

Job Title: ${formData.jobTitle || "____"}
Start Date: ${formData.startDate || "____"}
End Date: ${formData.endDate || "N/A - Still Employed"}
Still Employed: ${formData.stillEmployed === "yes" ? "YES" : "NO"}
Hours Per Week: ${formData.hoursPerWeek || "____"}
Earnings: ${formData.earnings || "____"}

================================================================================

DISABILITY IMPACT ON EMPLOYMENT

${formData.stillEmployed !== "yes" && formData.reasonForLeaving ? `Reason for Leaving: ${leaveReasons[formData.reasonForLeaving] || formData.reasonForLeaving}` : ""}

Accommodations Made:
${Array.isArray(formData.accommodations) ? formData.accommodations.map((a) => `[X] ${a}`).join("\n") : "[  ] See form for accommodations"}

Time Missed Due to Disability: ${missedLabels[formData.missedWork] || "____"}

Impact Description:
${formData.impactDescription || "____"}

================================================================================

IMPORTANT FOR TDIU CLAIMS:
- This form strengthens your claim by documenting employment limitations
- Send to your last employer(s) with a cover letter
- Employer should complete the employer section and return to VA

Date: ${currentDate}

Complete official form at: https://www.va.gov/find-forms/about-form-21-4192/

================================================================================
`;
  };

  const generateContent = () => {
    let content;
    switch (selectedForm?.id) {
      case "buddy-statement":
        content = generateBuddyStatement();
        break;
      case "personal-statement":
        content = generatePersonalStatement();
        break;
      case "ptsd-stressor":
        content = generatePTSDStatement();
        break;
      case "intent-to-file":
        content = generateIntentToFile();
        break;
      case "medical-release":
        content = generateMedicalRelease();
        break;
      case "priority-processing":
        content = generatePriorityProcessing();
        break;
      case "vso-appointment":
        content = generateVSOAppointment();
        break;
      case "vso-appointment-individual":
        content = generateIndividualRepAppointment();
        break;
      // New forms
      case "third-party-authorization":
        content = generateThirdPartyAuth();
        break;
      case "personal-records-request":
        content = generateFOIARequest();
        break;
      case "alternate-signer":
        content = generateAlternateSigner();
        break;
      case "nursing-home-info":
        content = generateNursingHome();
        break;
      case "substitution-request":
        content = generateSubstitutionRequest();
        break;
      case "income-asset-statement":
        content = generateIncomeAsset();
        break;
      case "medical-expense-report":
        content = generateMedicalExpenseReport();
        break;
      case "employment-info":
        content = generateEmploymentInfo();
        break;
      default:
        content = "";
    }
    setGeneratedContent(content);
    return content;
  };

  const handleFinishWizard = () => {
    generateContent();
    setCurrentStep(getFormSteps().length + 1);
    // Reset AI state when generating new content
    setAiEnhancedContent(null);
    setShowAIVersion(false);
    setAiError(null);
  };

  // Check if current form type supports AI enhancement
  const isAIEnabledFormType = () => {
    const aiEnabledForms = [
      "buddy-statement",
      "personal-statement",
      "ptsd-stressor",
    ];
    return aiEnabledForms.includes(selectedForm?.id);
  };

  // Get the statement type for AI disclosure
  const getAIStatementType = () => {
    switch (selectedForm?.id) {
      case "buddy-statement":
        return "buddy";
      case "ptsd-stressor":
        return "ptsd";
      default:
        return "personal";
    }
  };

  // Handle AI enhancement request
  const handleAIEnhanceClick = () => {
    setShowAIConsent(true);
  };

  // Handle AI consent and proceed with enhancement
  const handleAIConsent = async () => {
    setShowAIConsent(false);
    setIsEnhancingWithAI(true);
    setAiError(null);

    try {
      const result = await enhanceFormStatement(selectedForm?.id, formData);

      if (result.success) {
        setAiEnhancedContent(result.content);
        setShowAIVersion(true);
      } else {
        setAiError(result.error || "Failed to enhance statement with AI.");
      }
    } catch (error) {
      console.error("AI enhancement error:", error);
      setAiError("An unexpected error occurred. Please try again.");
    } finally {
      setIsEnhancingWithAI(false);
    }
  };

  // Handle canceling AI consent
  const handleAICancel = () => {
    setShowAIConsent(false);
  };

  // Toggle between AI and standard version
  const toggleAIVersion = () => {
    setShowAIVersion(!showAIVersion);
  };

  // Get the current display content (AI or standard)
  const getDisplayContent = () => {
    return showAIVersion && aiEnhancedContent
      ? aiEnhancedContent
      : generatedContent;
  };

  const downloadAsTxt = (content, fileName) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    if (!url.startsWith("blob:")) return; // Validate blob URL
    // deepcode ignore javascript/DOMXSS: URL is a validated blob: object URL created locally
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAsDocx = async (content, fileName) => {
    try {
      const lines = content.split("\n");
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: lines.map((line) => {
              if (line.startsWith("═")) {
                return new Paragraph({ text: "" });
              }
              if (line.match(/^[A-Z]{2,}.*:$/)) {
                return new Paragraph({
                  children: [new TextRun({ text: line, bold: true })],
                  spacing: { before: 200, after: 100 },
                });
              }
              return new Paragraph({
                children: [new TextRun(line)],
                spacing: { after: 50 },
              });
            }),
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      if (!url.startsWith("blob:")) return; // Validate blob URL
      // deepcode ignore javascript/DOMXSS: URL is a validated blob: object URL created locally
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error generating DOCX:", error);
      alert("Error generating Word document. Please try TXT format.");
    }
  };

  const downloadAsPdf = (content, fileName) => {
    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 15;
      const maxWidth = pageWidth - margin * 2;
      let yPosition = 20;

      pdf.setFontSize(10);
      const lines = pdf.splitTextToSize(content, maxWidth);

      lines.forEach((line) => {
        if (yPosition > pdf.internal.pageSize.getHeight() - 20) {
          pdf.addPage();
          yPosition = 20;
        }
        pdf.text(line, margin, yPosition);
        yPosition += 5;
      });

      pdf.save(`${fileName}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Error generating PDF. Please try TXT format.");
    }
  };

  const handleDownloadOfficialPdf = async () => {
    try {
      // Show loading state
      const result = await fillAndDownloadForm(selectedForm?.id, formData);
      if (result.success) {
        console.log(`Downloaded: ${result.fileName}`);
      }
    } catch (error) {
      console.error("Error generating official PDF:", error);
      alert(
        "Error generating official PDF form. Downloading text version instead.",
      );
      handleDownload("pdf");
    }
  };

  const handleDownload = (format) => {
    const content = generatedContent || generateContent();
    const fileName = `VA-${selectedForm?.formNumber?.replace(/\s+/g, "-")}-${formData.conditionName?.replace(/\s+/g, "-") || "Statement"}`;

    switch (format) {
      case "txt":
        downloadAsTxt(content, fileName);
        break;
      case "docx":
        downloadAsDocx(content, fileName);
        break;
      case "pdf":
        downloadAsPdf(content, fileName);
        break;
      default:
        downloadAsTxt(content, fileName);
    }
    setShowDownloadMenu(false);
  };

  const renderField = (field) => {
    if (field.type === "checklist") {
      return (
        <div key={field.name} className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            {field.label}{" "}
            {field.required && <span className="text-red-500">*</span>}
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {field.options.map((option) => (
              <label
                key={option}
                className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={(formData[field.name] || []).includes(option)}
                  onChange={(e) =>
                    handleChecklistChange(field.name, option, e.target.checked)
                  }
                  className="mt-1 rounded border-gray-300 text-va-blue focus:ring-va-blue"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {option}
                </span>
              </label>
            ))}
          </div>
        </div>
      );
    }

    if (field.type === "checkbox") {
      return (
        <label
          key={field.name}
          className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700 cursor-pointer mb-4"
        >
          <input
            type="checkbox"
            checked={formData[field.name] || false}
            onChange={(e) => handleFieldChange(field.name, e.target.checked)}
            className="rounded border-gray-300 text-va-blue focus:ring-va-blue"
          />
          <span className="text-gray-700 dark:text-gray-300">
            {field.label}
          </span>
        </label>
      );
    }

    if (field.type === "select") {
      return (
        <div key={field.name} className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {field.label}{" "}
            {field.required && <span className="text-red-500">*</span>}
          </label>
          <select
            value={formData[field.name] || ""}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-va-blue focus:ring-va-blue"
            required={field.required}
          >
            {field.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (field.type === "textarea") {
      return (
        <div key={field.name} className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {field.label}{" "}
            {field.required && <span className="text-red-500">*</span>}
          </label>
          <div className="relative">
            <textarea
              value={formData[field.name] || ""}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              rows={field.rows || 4}
              className="w-full pr-12 rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-va-blue focus:ring-va-blue"
              required={field.required}
            />
            {isSpeechRecognitionSupported() && (
              <div
                className="absolute right-2 top-2"
                aria-label="Click to dictate using voice"
              >
                <VoiceInputButton
                  onTranscript={(text) => {
                    const currentValue = formData[field.name] || "";
                    handleFieldChange(
                      field.name,
                      currentValue ? `${currentValue} ${text}` : text,
                    );
                  }}
                  size="sm"
                />
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div key={field.name} className="mb-4">
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          {field.label}{" "}
          {field.required && <span className="text-red-500">*</span>}
        </label>
        <input
          type={field.type}
          value={formData[field.name] || ""}
          onChange={(e) => handleFieldChange(field.name, e.target.value)}
          placeholder={field.placeholder}
          className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-va-blue focus:ring-va-blue"
          required={field.required}
        />
      </div>
    );
  };

  const renderFormSelection = () => (
    <div className="space-y-4">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          📋 {t("formsHelper", "title")}{" "}
          <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded align-middle">
            {t("formsHelper", "beta")}
          </span>
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          {t("formsHelper", "selectFormPrompt")}
        </p>
        <span className="inline-block mt-2 px-3 py-1 bg-va-blue/10 dark:bg-va-gold/10 text-va-blue dark:text-va-gold text-sm font-medium rounded-full">
          {forms.length} {t("formsHelper", "formsAvailable")}
        </span>
      </div>

      {/* Hidden file input for restore */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".json"
        className="hidden"
      />

      {/* Backup/Restore and Profile Buttons */}
      <div className="flex flex-wrap gap-3 justify-center mb-6">
        <button
          onClick={() => setShowProfileSetup(!showProfileSetup)}
          className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all ${
            showProfileSetup
              ? "bg-va-blue text-white"
              : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-va-blue hover:text-white dark:hover:bg-va-gold dark:hover:text-gray-900"
          }`}
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
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          {hasVeteranProfile()
            ? t("formsHelper", "editYourProfile")
            : t("formsHelper", "setUpProfile")}
        </button>
        <button
          onClick={handleBackup}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold flex items-center gap-2 transition-all"
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
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
          {t("formsHelper", "backupAllData")}
        </button>
        <button
          onClick={handleRestoreClick}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold flex items-center gap-2 transition-all"
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
          {t("formsHelper", "restoreFromBackup")}
        </button>
      </div>

      {/* Import Status Message */}
      {importStatus && (
        <div
          className={`p-3 rounded-lg text-center font-medium mb-4 ${
            importStatus.type === "success"
              ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border border-green-300 dark:border-green-700"
              : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-700"
          }`}
        >
          {importStatus.type === "success" ? "✅" : "❌"} {importStatus.message}
        </div>
      )}

      {/* Profile Setup Panel */}
      {showProfileSetup && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-200 dark:border-blue-700 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-blue-900 dark:text-blue-200 flex items-center gap-2">
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
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              {t("formsHelper", "profileTitle")}
            </h3>
            {profileSaved && (
              <span className="text-green-600 dark:text-green-400 text-sm font-medium flex items-center gap-1">
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {t("formsHelper", "saved")}
              </span>
            )}
          </div>

          <p className="text-sm text-blue-800 dark:text-blue-300 mb-4">
            {t("formsHelper", "profileDesc")}
          </p>

          <div className="grid gap-4 md:grid-cols-3 mb-4">
            {/* Name Fields */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("formsHelper", "firstName")} *
              </label>
              <input
                type="text"
                value={veteranProfile.firstName || ""}
                onChange={(e) =>
                  handleProfileChange("firstName", e.target.value)
                }
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-va-blue focus:border-va-blue"
                placeholder="John"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("formsHelper", "middleInitial")}
              </label>
              <input
                type="text"
                value={veteranProfile.middleInitial || ""}
                onChange={(e) =>
                  handleProfileChange(
                    "middleInitial",
                    e.target.value.toUpperCase().slice(0, 1),
                  )
                }
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-va-blue focus:border-va-blue"
                placeholder="A"
                maxLength={1}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("formsHelper", "lastName")} *
              </label>
              <input
                type="text"
                value={veteranProfile.lastName || ""}
                onChange={(e) =>
                  handleProfileChange("lastName", e.target.value)
                }
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-va-blue focus:border-va-blue"
                placeholder="Smith"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 mb-4">
            {/* SSN, DOB, VA File Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("formsHelper", "ssnLast4")} *
              </label>
              <input
                type="text"
                value={veteranProfile.ssn || ""}
                onChange={(e) =>
                  handleProfileChange(
                    "ssn",
                    e.target.value.replace(/\D/g, "").slice(0, 4),
                  )
                }
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-va-blue focus:border-va-blue"
                placeholder="1234"
                maxLength={4}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t("formsHelper", "ssnLast4Helper")}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("formsHelper", "dateOfBirth")} *
              </label>
              <input
                type="date"
                value={veteranProfile.dob || ""}
                onChange={(e) => handleProfileChange("dob", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-va-blue focus:border-va-blue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("formsHelper", "vaFileNumber")}
              </label>
              <input
                type="text"
                value={veteranProfile.vaFileNumber || ""}
                onChange={(e) =>
                  handleProfileChange("vaFileNumber", e.target.value)
                }
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-va-blue focus:border-va-blue"
                placeholder={t("formsHelper", "vaFileNumberPlaceholder")}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 mb-4">
            {/* Phone, Email, Branch */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("formsHelper", "phoneNumber")}
              </label>
              <input
                type="tel"
                value={veteranProfile.phone || ""}
                onChange={(e) => handleProfileChange("phone", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-va-blue focus:border-va-blue"
                placeholder="(555) 123-4567"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("formsHelper", "emailAddress")}
              </label>
              <input
                type="email"
                value={veteranProfile.email || ""}
                onChange={(e) => handleProfileChange("email", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-va-blue focus:border-va-blue"
                placeholder="veteran@email.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("formsHelper", "serviceBranch")}
              </label>
              <select
                value={veteranProfile.branch || ""}
                onChange={(e) => handleProfileChange("branch", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-va-blue focus:border-va-blue"
              >
                <option value="">{t("formsHelper", "selectBranch")}</option>
                <option value="Army">Army</option>
                <option value="Navy">Navy</option>
                <option value="Air Force">Air Force</option>
                <option value="Marine Corps">Marine Corps</option>
                <option value="Coast Guard">Coast Guard</option>
                <option value="Space Force">Space Force</option>
                <option value="National Guard">National Guard</option>
                <option value="Reserve">Reserve</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4 mb-4">
            {/* Address */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("formsHelper", "streetAddress")}
              </label>
              <input
                type="text"
                value={veteranProfile.street || ""}
                onChange={(e) => handleProfileChange("street", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-va-blue focus:border-va-blue"
                placeholder="123 Main Street"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("formsHelper", "aptUnit")}
              </label>
              <input
                type="text"
                value={veteranProfile.apt || ""}
                onChange={(e) => handleProfileChange("apt", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-va-blue focus:border-va-blue"
                placeholder="Apt 4B"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("formsHelper", "city")}
              </label>
              <input
                type="text"
                value={veteranProfile.city || ""}
                onChange={(e) => handleProfileChange("city", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-va-blue focus:border-va-blue"
                placeholder="Anytown"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("formsHelper", "state")}
              </label>
              <input
                type="text"
                value={veteranProfile.state || ""}
                onChange={(e) =>
                  handleProfileChange(
                    "state",
                    e.target.value.toUpperCase().slice(0, 2),
                  )
                }
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-va-blue focus:border-va-blue"
                placeholder="CA"
                maxLength={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("formsHelper", "zipCode")}
              </label>
              <input
                type="text"
                value={veteranProfile.zip || ""}
                onChange={(e) =>
                  handleProfileChange(
                    "zip",
                    e.target.value.replace(/\D/g, "").slice(0, 5),
                  )
                }
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-va-blue focus:border-va-blue"
                placeholder="12345"
                maxLength={5}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("formsHelper", "country")}
              </label>
              <input
                type="text"
                value={veteranProfile.country || "United States"}
                onChange={(e) => handleProfileChange("country", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-va-blue focus:border-va-blue"
              />
            </div>
          </div>

          {/* Military Service Section - Collapsible */}
          <details className="mb-4 border border-blue-200 dark:border-blue-700 rounded-lg">
            <summary className="cursor-pointer px-4 py-3 bg-blue-100 dark:bg-blue-900/40 rounded-t-lg font-medium text-blue-900 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors flex items-center gap-2">
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
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              {t("formsHelper", "militaryServiceDetails")}
            </summary>
            <div className="p-4 bg-white dark:bg-gray-800 rounded-b-lg space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Service Number
                  </label>
                  <input
                    type="text"
                    value={veteranProfile.serviceNumber || ""}
                    onChange={(e) =>
                      handleProfileChange("serviceNumber", e.target.value)
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-va-blue focus:border-va-blue"
                    placeholder="If different from SSN"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Rank at Discharge
                  </label>
                  <input
                    type="text"
                    value={veteranProfile.rankAtDischarge || ""}
                    onChange={(e) =>
                      handleProfileChange("rankAtDischarge", e.target.value)
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-va-blue focus:border-va-blue"
                    placeholder="e.g., E-5/SGT"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Pay Grade
                  </label>
                  <input
                    type="text"
                    value={veteranProfile.payGrade || ""}
                    onChange={(e) =>
                      handleProfileChange(
                        "payGrade",
                        e.target.value.toUpperCase(),
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-va-blue focus:border-va-blue"
                    placeholder="e.g., E-5, O-3"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    MOS/Rating Code
                  </label>
                  <input
                    type="text"
                    value={veteranProfile.mos || ""}
                    onChange={(e) => handleProfileChange("mos", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-va-blue focus:border-va-blue"
                    placeholder="e.g., 11B, IT2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Service Start Date
                  </label>
                  <input
                    type="date"
                    value={veteranProfile.serviceStartDate || ""}
                    onChange={(e) =>
                      handleProfileChange("serviceStartDate", e.target.value)
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-va-blue focus:border-va-blue"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Service End Date
                  </label>
                  <input
                    type="date"
                    value={veteranProfile.serviceEndDate || ""}
                    onChange={(e) =>
                      handleProfileChange("serviceEndDate", e.target.value)
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-va-blue focus:border-va-blue"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Character of Service
                  </label>
                  <select
                    value={veteranProfile.characterOfService || ""}
                    onChange={(e) =>
                      handleProfileChange("characterOfService", e.target.value)
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-va-blue focus:border-va-blue"
                  >
                    <option value="">Select...</option>
                    <option value="Honorable">Honorable</option>
                    <option value="General (Under Honorable)">
                      General (Under Honorable)
                    </option>
                    <option value="Other Than Honorable">
                      Other Than Honorable
                    </option>
                    <option value="Bad Conduct">Bad Conduct</option>
                    <option value="Dishonorable">Dishonorable</option>
                    <option value="Entry Level Separation">
                      Entry Level Separation
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Place of Birth
                  </label>
                  <input
                    type="text"
                    value={veteranProfile.placeOfBirth || ""}
                    onChange={(e) =>
                      handleProfileChange("placeOfBirth", e.target.value)
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-va-blue focus:border-va-blue"
                    placeholder="City, State"
                  />
                </div>
              </div>
            </div>
          </details>

          {/* Sensitive Data Section - Collapsible with Warning */}
          <details className="mb-4 border border-amber-200 dark:border-amber-700 rounded-lg">
            <summary className="cursor-pointer px-4 py-3 bg-amber-100 dark:bg-amber-900/40 rounded-t-lg font-medium text-amber-900 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors flex items-center gap-2">
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
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              {t("formsHelper", "sensitiveInfoOptional")}
              <span className="ml-auto text-xs text-amber-700 dark:text-amber-400">
                ⚠️ {t("formsHelper", "localStorageOnly")}
              </span>
            </summary>
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-b-lg space-y-4">
              <div className="bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-200">
                <strong>⚠️ {t("formsHelper", "privacyNotice")}:</strong>{" "}
                {t("formsHelper", "privacyNoticeText")}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Full SSN (XXX-XX-XXXX)
                  </label>
                  <input
                    type="password"
                    value={veteranProfile.ssnFull || ""}
                    onChange={(e) => {
                      let val = e.target.value.replace(/\D/g, "").slice(0, 9);
                      if (val.length > 5)
                        val =
                          val.slice(0, 3) +
                          "-" +
                          val.slice(3, 5) +
                          "-" +
                          val.slice(5);
                      else if (val.length > 3)
                        val = val.slice(0, 3) + "-" + val.slice(3);
                      handleProfileChange("ssnFull", val);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    placeholder="XXX-XX-XXXX"
                    autoComplete="off"
                  />
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Only needed for certain VA forms
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Home of Record
                  </label>
                  <input
                    type="text"
                    value={veteranProfile.homeOfRecord || ""}
                    onChange={(e) =>
                      handleProfileChange("homeOfRecord", e.target.value)
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-va-blue focus:border-va-blue"
                    placeholder="City, State at enlistment"
                  />
                </div>
              </div>
            </div>
          </details>

          <div className="flex items-center justify-between border-t border-blue-200 dark:border-blue-700 pt-4">
            <p className="text-xs text-blue-700 dark:text-blue-400">
              🔒 {t("formsHelper", "privacyLocalStorage")}
            </p>
            <button
              onClick={handleSaveProfile}
              className="px-6 py-2 bg-va-blue hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-2 transition-all"
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
                  d="M5 13l4 4L19 7"
                />
              </svg>
              {t("formsHelper", "saveProfile")}
            </button>
          </div>
        </div>
      )}

      {/* Profile saved indicator - show when profile exists */}
      {hasVeteranProfile() && !showProfileSetup && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-green-600 dark:text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-green-800 dark:text-green-200 font-medium">
              {t("formsHelper", "profileSavedMsg")}
            </span>
          </div>
          <button
            onClick={() => setShowProfileSetup(true)}
            className="text-sm text-green-700 dark:text-green-300 underline hover:no-underline"
          >
            {t("formsHelper", "edit")}
          </button>
        </div>
      )}

      {/* Info box about buddy statements */}
      <div className="bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <h3 className="font-bold text-purple-900 dark:text-purple-200">
              {t("formsHelper", "proTip")}{" "}
              {t("formsHelper", "buddyStatementsPowerful")}
            </h3>
            <p className="text-sm text-purple-800 dark:text-purple-300 mt-1">
              {t("formsHelper", "buddyStatementsDesc")}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {forms.map((form) => (
          <button
            key={form.id}
            onClick={() => {
              setSelectedForm(form);
              setFormData({});
              setCurrentStep(0);
              setGeneratedContent(null);
            }}
            className="text-left p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-va-blue dark:hover:border-va-gold transition-all hover:shadow-lg bg-white dark:bg-gray-800 group"
          >
            <div className="flex items-start gap-3">
              <span className="text-3xl">{form.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-va-blue dark:group-hover:text-va-gold">
                    {form.name}
                  </h3>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${form.difficultyColor}`}
                  >
                    {form.difficulty}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  {form.formNumber}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                  {form.description}
                </p>
              </div>
              <svg
                className="w-5 h-5 text-gray-400 group-hover:text-va-blue dark:group-hover:text-va-gold flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </button>
        ))}
      </div>

      {/* Quick links section */}
      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
          📎 {t("formsHelper", "quickLinksToForms")}
        </h3>
        <div className="flex flex-wrap gap-2">
          {forms.map((form) => (
            <a
              key={form.id}
              href={form.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-va-blue hover:text-white dark:hover:bg-va-gold dark:hover:text-va-blue rounded-lg transition-colors"
            >
              {form.formNumber} ↗
            </a>
          ))}
        </div>
      </div>
    </div>
  );

  const renderFormInfo = () => {
    if (!selectedForm) return null;

    const steps = getFormSteps();
    const hasWizard = steps.length > 0;

    return (
      <div className="space-y-6">
        {/* Form header */}
        <div className="flex items-start gap-4">
          <span className="text-4xl">{selectedForm.icon}</span>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {selectedForm.name}
            </h2>
            <p className="text-va-blue dark:text-va-gold font-medium">
              {selectedForm.formNumber}
            </p>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              {selectedForm.description}
            </p>
          </div>
        </div>

        {/* Tips */}
        <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4">
          <h3 className="font-bold text-green-900 dark:text-green-200 mb-2">
            💡 {t("formsHelper", "tipsForSuccess")}
          </h3>
          <ul className="space-y-1">
            {selectedForm.tips.map((tip, i) => (
              <li
                key={i}
                className="text-sm text-green-800 dark:text-green-300 flex items-start gap-2"
              >
                <span className="text-green-600">✓</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3">
          {hasWizard ? (
            <button
              onClick={() => setCurrentStep(1)}
              className="flex-1 px-6 py-3 bg-va-blue hover:bg-blue-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"
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
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
              {t("formsHelper", "startGuidedBuilder")}
            </button>
          ) : (
            <a
              href={selectedForm.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 px-6 py-3 bg-va-blue hover:bg-blue-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"
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
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
              {t("formsHelper", "goToVAForm")}
            </a>
          )}
          <a
            href={selectedForm.link}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-medium flex items-center gap-2 transition-colors text-gray-700 dark:text-gray-300"
          >
            {t("formsHelper", "officialForm")} ↗
          </a>
        </div>

        <button
          onClick={() => setSelectedForm(null)}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1"
        >
          ← {t("formsHelper", "backToAllForms")}
        </button>
      </div>
    );
  };

  const renderWizardStep = () => {
    const steps = getFormSteps();
    if (currentStep === 0 || currentStep > steps.length) return null;

    const step = steps[currentStep - 1];
    const isLastStep = currentStep === steps.length;

    return (
      <div className="space-y-6">
        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-2">
            <span>
              {t("formsHelper", "stepOf")
                .replace("{current}", currentStep)
                .replace("{total}", steps.length)}
            </span>
            <span>{selectedForm?.name}</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-va-blue h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Step content */}
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {step.title}
          </h3>
          {step.subtitle && (
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {step.subtitle}
            </p>
          )}

          <div className="space-y-4">
            {step.fields.map((field) => renderField(field))}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => {
              if (currentStep === 1) {
                setCurrentStep(0);
              } else {
                setCurrentStep((prev) => prev - 1);
              }
            }}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-1"
          >
            ← {t("formsHelper", "back")}
          </button>

          {isLastStep ? (
            <button
              onClick={handleFinishWizard}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold flex items-center gap-2"
            >
              {t("formsHelper", "generateStatement")}
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
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
          ) : (
            <button
              onClick={() => setCurrentStep((prev) => prev + 1)}
              className="px-6 py-2 bg-va-blue hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2"
            >
              {t("formsHelper", "next")}
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
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderReviewStep = () => {
    if (!generatedContent) return null;

    const displayContent = getDisplayContent();

    return (
      <div className="space-y-6">
        {/* Success message */}
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <h3 className="font-bold text-green-900 dark:text-green-200">
                {t("formsHelper", "statementGenerated")}
              </h3>
              <p className="text-sm text-green-800 dark:text-green-300">
                {t("formsHelper", "statementGeneratedDesc")}
              </p>
            </div>
          </div>
        </div>

        {/* AI Enhancement Option - Only show for supported form types */}
        {isAIEnabledFormType() && isAnyAIAvailable() && (
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border-2 border-purple-300 dark:border-purple-600 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="text-3xl">✨</span>
                <div>
                  <h3 className="font-bold text-purple-900 dark:text-purple-200 text-lg flex items-center gap-2">
                    {t("formsHelper", "aiStatementAssistant")}
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        aiStatus.effectiveMode === AI_MODES.LOCAL
                          ? "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300"
                          : "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
                      }`}
                    >
                      {aiStatus.effectiveMode === AI_MODES.LOCAL
                        ? "🔒 Local AI"
                        : "☁️ Cloud AI"}
                    </span>
                  </h3>
                  <p className="text-sm text-purple-700 dark:text-purple-300">
                    {t("formsHelper", "aiEnhanceDesc")}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400 mt-2">
                    <span>💡</span>
                    <span>
                      <strong>{t("formsHelper", "tip")}:</strong>{" "}
                      {t("formsHelper", "aiTipAllModels")}
                    </span>
                  </div>
                  {aiStatus.effectiveMode === AI_MODES.LOCAL && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      ✅ {t("formsHelper", "aiPrivateNotice")}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {!aiEnhancedContent ? (
                  <button
                    onClick={handleAIEnhanceClick}
                    disabled={isEnhancingWithAI}
                    className="px-5 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                  >
                    {isEnhancingWithAI ? (
                      <>
                        <svg
                          className="animate-spin h-5 w-5"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        {t("formsHelper", "enhancing")}
                      </>
                    ) : (
                      <>
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
                            d="M13 10V3L4 14h7v7l9-11h-7z"
                          />
                        </svg>
                        {t("formsHelper", "enhanceWithAI")}
                      </>
                    )}
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={toggleAIVersion}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        showAIVersion
                          ? "bg-purple-600 text-white"
                          : "bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200"
                      }`}
                    >
                      ✨ {t("formsHelper", "aiVersion")}
                    </button>
                    <button
                      onClick={toggleAIVersion}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        !showAIVersion
                          ? "bg-purple-600 text-white"
                          : "bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200"
                      }`}
                    >
                      📝 {t("formsHelper", "original")}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* AI Error Message */}
            {aiError && (
              <div className="mt-3 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm">
                ⚠️ {aiError}
              </div>
            )}

            {/* Version indicator */}
            {aiEnhancedContent && (
              <div className="mt-3 text-sm text-purple-600 dark:text-purple-300">
                {showAIVersion
                  ? `✨ ${t("formsHelper", "viewingAIVersion")}`
                  : `📝 ${t("formsHelper", "viewingOriginal")}`}
              </div>
            )}
          </div>
        )}

        {/* AI Not Available Message - Show for supported form types when AI is not configured */}
        {isAIEnabledFormType() && !isAnyAIAvailable() && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-600 rounded-xl p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">✨</span>
                <div>
                  <h3 className="font-bold text-amber-900 dark:text-amber-200">
                    {t("formsHelper", "aiEnhancementAvailable")}
                  </h3>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    {t("formsHelper", "aiEnhancementAvailableDesc")}
                  </p>
                </div>
              </div>
              <button
                onClick={onOpenAISettings}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold whitespace-nowrap transition-colors"
              >
                ⚙️ {t("formsHelper", "configureAI")}
              </button>
            </div>
          </div>
        )}

        {/* Download Options - Prominent */}
        <div className="bg-white dark:bg-gray-800 border-2 border-va-blue dark:border-va-gold rounded-lg p-4">
          <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <span className="text-xl">📥</span>{" "}
            {t("formsHelper", "downloadYourForm")}
            {showAIVersion && aiEnhancedContent && (
              <span className="text-sm font-normal text-purple-600 dark:text-purple-400">
                ({t("formsHelper", "aiEnhanced")})
              </span>
            )}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Primary: Official PDF */}
            <button
              onClick={() => handleDownloadOfficialPdf()}
              className="flex items-center gap-3 p-4 bg-gradient-to-r from-va-blue to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg transition-all shadow-md hover:shadow-lg"
            >
              <span className="text-2xl">📋</span>
              <div className="text-left">
                <div className="font-bold">
                  {t("formsHelper", "officialVAFormPdf")}
                </div>
                <div className="text-sm text-blue-100">
                  {t("formsHelper", "readyToSign")}
                </div>
              </div>
            </button>

            {/* Secondary options */}
            <div className="flex gap-2">
              <button
                onClick={() => handleDownload("txt")}
                className="flex-1 flex flex-col items-center justify-center p-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-all"
              >
                <span className="text-xl">📄</span>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  .TXT
                </span>
              </button>
              <button
                onClick={() => handleDownload("docx")}
                className="flex-1 flex flex-col items-center justify-center p-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-all"
              >
                <span className="text-xl">📝</span>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  .DOCX
                </span>
              </button>
              <button
                onClick={() => handleDownload("pdf")}
                className="flex-1 flex flex-col items-center justify-center p-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-all"
              >
                <span className="text-xl">📑</span>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  .PDF
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Save to My Packet */}
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📦</span>
              <div>
                <h3 className="font-bold text-purple-900 dark:text-purple-200">
                  {t("formsHelper", "saveToMyPacket")}
                </h3>
                <p className="text-sm text-purple-700 dark:text-purple-300">
                  {t("formsHelper", "saveToPacketDesc")}
                </p>
              </div>
            </div>
            <button
              onClick={handleSaveToPacket}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold flex items-center gap-2 transition-all"
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
              {t("formsHelper", "saveToPacketBtn")}
            </button>
          </div>
        </div>

        {/* Import Status Message */}
        {importStatus && (
          <div
            className={`p-3 rounded-lg text-center font-medium ${
              importStatus.type === "success"
                ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border border-green-300 dark:border-green-700"
                : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-700"
            }`}
          >
            {importStatus.type === "success" ? "✅" : "❌"}{" "}
            {importStatus.message}
          </div>
        )}

        {/* Preview */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <details className="group" open={showAIVersion && aiEnhancedContent}>
            <summary className="bg-gray-50 dark:bg-gray-700 px-4 py-2 border-b border-gray-200 dark:border-gray-600 cursor-pointer flex items-center justify-between">
              <span className="font-medium text-gray-700 dark:text-gray-300">
                📄 {t("formsHelper", "textPreview")}{" "}
                {showAIVersion && aiEnhancedContent
                  ? `(${t("formsHelper", "aiEnhanced")})`
                  : ""}{" "}
                ({t("formsHelper", "clickToExpand")})
              </span>
              <svg
                className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </summary>
            <pre className="p-4 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono overflow-auto max-h-72">
              {displayContent}
            </pre>
          </details>
        </div>

        {/* Next steps */}
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
          <h3 className="font-bold text-yellow-900 dark:text-yellow-200 mb-2">
            📋 {t("formsHelper", "nextSteps")}
          </h3>
          <ol className="list-decimal list-inside text-sm text-yellow-800 dark:text-yellow-300 space-y-1">
            <li>
              <strong>{t("formsHelper", "download")}</strong>{" "}
              {t("formsHelper", "nextStepDownload")}
            </li>
            <li>
              <strong>{t("formsHelper", "review")}</strong>{" "}
              {t("formsHelper", "nextStepReview")}
            </li>
            <li>
              <strong>{t("formsHelper", "print")}</strong>{" "}
              {t("formsHelper", "nextStepPrint")}
            </li>
            <li>
              <strong>{t("formsHelper", "sign")}</strong>{" "}
              {t("formsHelper", "nextStepSign")}
            </li>
            <li>
              <strong>{t("formsHelper", "submit")}</strong>{" "}
              {t("formsHelper", "nextStepSubmit")}{" "}
              <a
                href={selectedForm?.link}
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-bold"
              >
                VA.gov
              </a>{" "}
              {t("formsHelper", "orMailTo")}
            </li>
          </ol>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              setCurrentStep(1);
              setGeneratedContent(null);
              setAiEnhancedContent(null);
              setShowAIVersion(false);
            }}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-1"
          >
            ← {t("formsHelper", "editAnswers")}
          </button>
          <button
            onClick={() => {
              setSelectedForm(null);
              setFormData({});
              setCurrentStep(0);
              setGeneratedContent(null);
              setAiEnhancedContent(null);
              setShowAIVersion(false);
            }}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-medium"
          >
            {t("formsHelper", "startNewForm")}
          </button>
          <a
            href={selectedForm?.link}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-va-gold hover:bg-yellow-400 text-va-blue rounded-lg font-bold flex items-center gap-2"
          >
            {t("formsHelper", "submitAtVA")}
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
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    const steps = getFormSteps();

    // No form selected - show form selection
    if (!selectedForm) {
      return renderFormSelection();
    }

    // Form selected but wizard not started - show form info
    if (currentStep === 0) {
      return renderFormInfo();
    }

    // In wizard steps (steps are 1-indexed, so currentStep 1 = step index 0)
    if (currentStep >= 1 && currentStep <= steps.length && !generatedContent) {
      return renderWizardStep();
    }

    // Past wizard or content generated - show review/download
    return renderReviewStep();
  };

  return (
    <>
      <ResponsiveModal
        isOpen
        onClose={onClose}
        size="xl"
        labelledBy="forms-helper-title"
        header={
          <div className="flex-shrink-0 bg-gradient-to-r from-violet-600 to-purple-600 text-white px-6 py-4 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📋</span>
                <div>
                  <h2 id="forms-helper-title" className="text-xl font-bold">
                    {t("formsHelper", "title")}
                  </h2>
                  <p className="text-violet-100 text-sm">
                    {t("formsHelper", "subtitle")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <LLMRecommendationBadge toolId="forms-helper" />
                <AIStatusBadge onClick={onOpenAISettings} showLabel={false} />
                <ShareButton
                  targetRef={formsContentRef}
                  filename="va-forms-helper"
                  variant="icon"
                />
                <ReportBugLink
                  onClick={onReportBug}
                  variant="light"
                  moduleName="Forms Helper"
                />
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
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
        }
        footer={
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-gray-500 dark:text-gray-400">
            <p>📌 {t("formsHelper", "footerPrivacy")}</p>
          </div>
        }
      >
        <div ref={formsContentRef}>{renderContent()}</div>
      </ResponsiveModal>

      {/* Luna encouragement — lifted above the z-60 shell */}
      <div className="relative z-[70]">
        <BuyMeCoffee show={true} trigger="forms-helper" />
      </div>

      {/* AI consent gate — lifted above the z-60 shell */}
      <div className="relative z-[70]">
        <AIConsentModal
          isOpen={showAIConsent}
          onConsent={handleAIConsent}
          onCancel={handleAICancel}
          statementType={getAIStatementType()}
        />
      </div>
    </>
  );
};

export default FormsHelper;
