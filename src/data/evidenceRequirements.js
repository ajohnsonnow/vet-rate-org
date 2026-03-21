/**
 * Evidence Requirements Schema
 * "The Missing Link" - Defines what evidence is required for each rating level
 *
 * This schema maps conditions to their specific evidence requirements at each rating tier.
 * Used by the Evidence Gap Visualizer to show veterans exactly what they need.
 *
 * ALL CRITERIA ARE SOURCED DIRECTLY FROM 38 CFR PART 4 (eCFR)
 * Last Updated: January 2026
 */

export const EVIDENCE_REQUIREMENTS = {
  // ============================================
  // RESPIRATORY SYSTEM (38 CFR § 4.97)
  // ============================================

  // Sleep Apnea (DC 6847) - Per 38 CFR § 4.97
  sleep_apnea: {
    name: "Sleep Apnea",
    diagnosticCode: "6847",
    category: "Respiratory",
    cfr: "38 CFR § 4.97, DC 6847",
    ratings: {
      0: {
        label: "0% - Asymptomatic but documented",
        requirements: [
          {
            id: "diagnosis",
            label: "Sleep Study/Diagnosis",
            type: "required",
            description:
              "Polysomnography (sleep study) documenting sleep apnea diagnosis",
          },
        ],
      },
      30: {
        label: "30% - Persistent daytime hypersomnolence",
        requirements: [
          {
            id: "diagnosis",
            label: "Sleep Study/Diagnosis",
            type: "required",
            description: "Polysomnography documenting diagnosis",
          },
          {
            id: "hypersomnolence",
            label: "Daytime Hypersomnolence Documentation",
            type: "required",
            description:
              "Medical records showing persistent daytime sleepiness affecting daily activities",
          },
          {
            id: "nexus",
            label: "Service Connection/Nexus",
            type: "required",
            description: "Nexus letter or opinion linking to service",
          },
        ],
      },
      50: {
        label: "50% - Requires breathing assistance device (CPAP)",
        requirements: [
          {
            id: "diagnosis",
            label: "Sleep Study/Diagnosis",
            type: "required",
            description: "Polysomnography documenting diagnosis",
          },
          {
            id: "cpap_prescription",
            label: "CPAP/BiPAP Prescription",
            type: "required",
            description: "Current prescription for breathing assistance device",
          },
          {
            id: "cpap_compliance",
            label: "Device Usage Records",
            type: "recommended",
            description:
              "CPAP compliance data showing regular use (strengthens claim)",
          },
          {
            id: "nexus",
            label: "Service Connection/Nexus",
            type: "required",
            description: "Nexus letter or opinion linking to service",
          },
        ],
      },
      100: {
        label:
          "100% - Chronic respiratory failure with CO2 retention or tracheostomy",
        requirements: [
          {
            id: "diagnosis",
            label: "Sleep Study/Diagnosis",
            type: "required",
            description: "Polysomnography documenting diagnosis",
          },
          {
            id: "respiratory_failure",
            label: "Respiratory Failure Documentation",
            type: "required",
            description:
              "Medical records documenting chronic respiratory failure with CO2 retention",
          },
          {
            id: "trach_required",
            label: "Tracheostomy or Cor Pulmonale",
            type: "required",
            description:
              "Documentation of tracheostomy requirement OR cor pulmonale",
          },
          {
            id: "nexus",
            label: "Service Connection/Nexus",
            type: "required",
            description: "Nexus letter or opinion linking to service",
          },
        ],
      },
    },
    tips: [
      "The key difference between 30% and 50% is the CPAP prescription - per 38 CFR § 4.97",
      "Request CPAP compliance reports from your DME supplier",
      "Secondary to PTSD claims require a nexus explaining the connection",
      "Weight gain from PTSD medications can cause/aggravate sleep apnea",
    ],
  },

  // Asthma (DC 6602) - Per 38 CFR § 4.97
  asthma: {
    name: "Asthma (Bronchial)",
    diagnosticCode: "6602",
    category: "Respiratory",
    cfr: "38 CFR § 4.97, DC 6602",
    ratings: {
      10: {
        label:
          "10% - FEV-1 71-80% or FEV-1/FVC 71-80%, or intermittent inhalational therapy",
        requirements: [
          {
            id: "diagnosis",
            label: "Asthma Diagnosis",
            type: "required",
            description: "Documented diagnosis of bronchial asthma",
          },
          {
            id: "pft",
            label: "Pulmonary Function Tests (PFT)",
            type: "required",
            description:
              "PFT showing FEV-1 of 71-80% predicted, or FEV-1/FVC of 71-80%",
          },
          {
            id: "inhaler",
            label: "Inhalational Therapy",
            type: "required",
            description:
              "Documentation of intermittent inhalational or oral bronchodilator therapy",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      30: {
        label:
          "30% - FEV-1 56-70% or FEV-1/FVC 56-70%, or daily inhalational therapy",
        requirements: [
          {
            id: "diagnosis",
            label: "Asthma Diagnosis",
            type: "required",
            description: "Documented diagnosis",
          },
          {
            id: "pft",
            label: "Pulmonary Function Tests",
            type: "required",
            description:
              "PFT showing FEV-1 of 56-70% predicted, or FEV-1/FVC of 56-70%",
          },
          {
            id: "daily_therapy",
            label: "Daily Therapy Documentation",
            type: "required",
            description:
              "Evidence of daily inhalational or oral bronchodilator therapy",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      60: {
        label:
          "60% - FEV-1 40-55% or FEV-1/FVC 40-55%, or monthly visits for exacerbations",
        requirements: [
          {
            id: "diagnosis",
            label: "Asthma Diagnosis",
            type: "required",
            description: "Documented diagnosis",
          },
          {
            id: "pft",
            label: "Pulmonary Function Tests",
            type: "required",
            description:
              "PFT showing FEV-1 of 40-55% predicted, or FEV-1/FVC of 40-55%",
          },
          {
            id: "exacerbations",
            label: "Monthly Exacerbation Records",
            type: "required",
            description:
              "Medical records showing at least monthly physician visits for required care of exacerbations",
          },
          {
            id: "steroid_courses",
            label: "Systemic Corticosteroid Courses",
            type: "recommended",
            description:
              "Documentation of three or more courses of systemic corticosteroids per year",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      100: {
        label:
          "100% - FEV-1 less than 40% or FEV-1/FVC less than 40%, or more than one attack per week",
        requirements: [
          {
            id: "diagnosis",
            label: "Asthma Diagnosis",
            type: "required",
            description: "Documented diagnosis",
          },
          {
            id: "pft_severe",
            label: "Severely Reduced PFT",
            type: "required",
            description:
              "PFT showing FEV-1 less than 40% predicted, or FEV-1/FVC less than 40%",
          },
          {
            id: "weekly_attacks",
            label: "Weekly Attack Documentation",
            type: "required",
            description:
              "Medical records showing more than one attack per week with episodes of respiratory failure",
          },
          {
            id: "daily_steroids",
            label: "Daily High-Dose Steroids",
            type: "required",
            description:
              "Requirement for daily use of systemic high dose corticosteroids or immuno-suppressive medications",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
    },
    tips: [
      "PFT results are critical - request copies of all pulmonary function tests",
      "Document all ER visits and hospitalizations for asthma attacks",
      "Keep a log of rescue inhaler use",
      "Exposure to burn pits, dust, or chemicals during service can establish nexus",
    ],
  },

  // Sinusitis (DC 6510-6514) - Per 38 CFR § 4.97
  sinusitis: {
    name: "Sinusitis (Chronic)",
    diagnosticCode: "6510-6514",
    category: "Respiratory",
    cfr: "38 CFR § 4.97, DC 6510-6514",
    ratings: {
      0: {
        label: "0% - Detected by X-ray only",
        requirements: [
          {
            id: "diagnosis",
            label: "Sinusitis Diagnosis",
            type: "required",
            description: "X-ray or CT scan showing sinusitis",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      10: {
        label:
          "10% - 1-2 incapacitating episodes per year OR 3-6 non-incapacitating episodes",
        requirements: [
          {
            id: "diagnosis",
            label: "Sinusitis Diagnosis",
            type: "required",
            description: "CT scan or clinical diagnosis of chronic sinusitis",
          },
          {
            id: "episodes",
            label: "Episode Documentation",
            type: "required",
            description:
              "Medical records showing 1-2 incapacitating episodes per year requiring prolonged antibiotics, OR 3-6 non-incapacitating episodes with headache, pain, and purulent discharge",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      30: {
        label:
          "30% - 3+ incapacitating episodes per year OR more than 6 non-incapacitating episodes",
        requirements: [
          {
            id: "diagnosis",
            label: "Sinusitis Diagnosis",
            type: "required",
            description: "CT scan or clinical diagnosis",
          },
          {
            id: "frequent_episodes",
            label: "Frequent Episode Documentation",
            type: "required",
            description:
              "Medical records showing 3+ incapacitating episodes per year requiring prolonged antibiotics, OR more than 6 non-incapacitating episodes per year",
          },
          {
            id: "antibiotics",
            label: "Antibiotic Treatment Records",
            type: "recommended",
            description: "Prescription records for antibiotic treatments",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      50: {
        label:
          "50% - Following radical surgery with chronic osteomyelitis, or near constant sinusitis",
        requirements: [
          {
            id: "diagnosis",
            label: "Sinusitis Diagnosis",
            type: "required",
            description: "CT scan or clinical diagnosis",
          },
          {
            id: "surgery",
            label: "Radical Surgery Documentation",
            type: "required",
            description:
              "Records of radical surgery with chronic osteomyelitis",
          },
          {
            id: "constant_symptoms",
            label: "Near Constant Symptoms",
            type: "required",
            description:
              "Documentation of near constant sinusitis characterized by headaches, pain and tenderness of affected sinus, and purulent discharge or crusting after repeated surgeries",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
    },
    tips: [
      "CT scans are more definitive than X-rays for sinusitis documentation",
      "Keep records of all antibiotic prescriptions",
      '"Incapacitating" means requiring bed rest and treatment by a physician',
      "Document all missed work due to sinus issues",
    ],
  },

  // Allergic Rhinitis (DC 6522) - Per 38 CFR § 4.97
  allergic_rhinitis: {
    name: "Allergic/Vasomotor Rhinitis",
    diagnosticCode: "6522",
    category: "Respiratory",
    cfr: "38 CFR § 4.97, DC 6522",
    ratings: {
      10: {
        label:
          "10% - Without polyps, but with greater than 50% obstruction on both sides or complete obstruction on one side",
        requirements: [
          {
            id: "diagnosis",
            label: "Rhinitis Diagnosis",
            type: "required",
            description: "Clinical diagnosis of allergic or vasomotor rhinitis",
          },
          {
            id: "obstruction",
            label: "Nasal Obstruction Documentation",
            type: "required",
            description:
              "Examination showing greater than 50% obstruction of nasal passages on both sides, or complete obstruction on one side",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service (dust, allergen exposure, etc.)",
          },
        ],
      },
      30: {
        label: "30% - With polyps",
        requirements: [
          {
            id: "diagnosis",
            label: "Rhinitis Diagnosis",
            type: "required",
            description: "Clinical diagnosis",
          },
          {
            id: "polyps",
            label: "Nasal Polyps Documentation",
            type: "required",
            description:
              "Medical records or examination findings documenting presence of nasal polyps",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
    },
    tips: [
      "Get a current nasal endoscopy to document obstruction percentage",
      "Polyps significantly increase rating - request imaging or endoscopy",
      "Common secondary to Gulf War service or burn pit exposure",
      "Document all allergy medications and their effectiveness",
    ],
  },

  // COPD (DC 6604) - Per 38 CFR § 4.97
  copd: {
    name: "Chronic Obstructive Pulmonary Disease (COPD)",
    diagnosticCode: "6604",
    category: "Respiratory",
    cfr: "38 CFR § 4.97, DC 6604",
    ratings: {
      10: {
        label: "10% - FEV-1 71-80% or FEV-1/FVC 71-80%, or DLCO 66-80%",
        requirements: [
          {
            id: "diagnosis",
            label: "COPD Diagnosis",
            type: "required",
            description: "Documented diagnosis of COPD",
          },
          {
            id: "pft",
            label: "Pulmonary Function Tests",
            type: "required",
            description:
              "PFT showing FEV-1 of 71-80% predicted, or FEV-1/FVC of 71-80%, or DLCO (SB) of 66-80% predicted",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description:
              "Nexus to service (smoking during service, burn pits, environmental exposure)",
          },
        ],
      },
      30: {
        label: "30% - FEV-1 56-70% or FEV-1/FVC 56-70%, or DLCO 56-65%",
        requirements: [
          {
            id: "diagnosis",
            label: "COPD Diagnosis",
            type: "required",
            description: "Documented diagnosis",
          },
          {
            id: "pft",
            label: "Pulmonary Function Tests",
            type: "required",
            description:
              "PFT showing FEV-1 of 56-70%, or FEV-1/FVC of 56-70%, or DLCO (SB) of 56-65% predicted",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      60: {
        label:
          "60% - FEV-1 40-55% or FEV-1/FVC 40-55%, or DLCO 40-55%, or max oxygen consumption 15-20 ml/kg/min",
        requirements: [
          {
            id: "diagnosis",
            label: "COPD Diagnosis",
            type: "required",
            description: "Documented diagnosis",
          },
          {
            id: "pft",
            label: "Pulmonary Function Tests",
            type: "required",
            description:
              "PFT showing FEV-1 of 40-55%, or FEV-1/FVC of 40-55%, or DLCO (SB) of 40-55% predicted",
          },
          {
            id: "oxygen_consumption",
            label: "Cardiopulmonary Exercise Test",
            type: "recommended",
            description:
              "Maximum exercise capacity testing showing 15-20 ml/kg/min oxygen consumption",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      100: {
        label:
          "100% - FEV-1 less than 40% or FEV-1/FVC less than 40%, or DLCO less than 40%, or max oxygen consumption less than 15 ml/kg/min, or cor pulmonale, or requires outpatient oxygen therapy",
        requirements: [
          {
            id: "diagnosis",
            label: "COPD Diagnosis",
            type: "required",
            description: "Documented diagnosis",
          },
          {
            id: "pft_severe",
            label: "Severely Reduced PFT",
            type: "required",
            description:
              "PFT showing FEV-1 less than 40%, or FEV-1/FVC less than 40%, or DLCO (SB) less than 40% predicted",
          },
          {
            id: "oxygen_therapy",
            label: "Supplemental Oxygen Prescription",
            type: "required",
            description:
              "Documentation of requirement for outpatient oxygen therapy",
          },
          {
            id: "cor_pulmonale",
            label: "Cor Pulmonale or Right Heart Failure",
            type: "recommended",
            description:
              "Cardiac evaluation showing cor pulmonale (right heart failure secondary to lung disease)",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
    },
    tips: [
      "Request PFT with DLCO (diffusion capacity) - this often shows worse impairment",
      "Burn pit exposure during deployment can establish service connection under PACT Act",
      "Document smoking history and when it started (during service)",
      "Supplemental oxygen prescription = 100% rating",
    ],
  },

  // ============================================
  // MENTAL HEALTH (38 CFR § 4.130)
  // ============================================

  // PTSD (DC 9411) - Per 38 CFR § 4.130
  ptsd: {
    name: "PTSD",
    diagnosticCode: "9411",
    category: "Mental Health",
    cfr: "38 CFR § 4.130, DC 9411",
    ratings: {
      0: {
        label: "0% - Diagnosed, symptoms controlled by continuous medication",
        requirements: [
          {
            id: "diagnosis",
            label: "PTSD Diagnosis",
            type: "required",
            description:
              "Formal PTSD diagnosis from qualified mental health professional per DSM-5 criteria",
          },
          {
            id: "stressor",
            label: "In-Service Stressor",
            type: "required",
            description:
              "Documented stressor event during service (combat, MST, fear of hostile activity)",
          },
        ],
      },
      10: {
        label:
          "10% - Occupational/social impairment due to mild or transient symptoms",
        requirements: [
          {
            id: "diagnosis",
            label: "PTSD Diagnosis",
            type: "required",
            description: "Formal PTSD diagnosis",
          },
          {
            id: "stressor",
            label: "In-Service Stressor",
            type: "required",
            description: "Documented stressor event",
          },
          {
            id: "treatment",
            label: "Treatment Records",
            type: "required",
            description:
              "Evidence of symptoms controlled by continuous medication",
          },
          {
            id: "mild_symptoms",
            label: "Mild Symptoms Documentation",
            type: "required",
            description:
              "Medical notes documenting mild or transient symptoms decreasing work efficiency during stress",
          },
        ],
      },
      30: {
        label:
          "30% - Occasional decrease in work efficiency with intermittent periods of inability to perform tasks",
        requirements: [
          {
            id: "diagnosis",
            label: "PTSD Diagnosis",
            type: "required",
            description: "Formal PTSD diagnosis",
          },
          {
            id: "stressor",
            label: "In-Service Stressor",
            type: "required",
            description: "Documented stressor event",
          },
          {
            id: "depression",
            label: "Depressed Mood Documentation",
            type: "required",
            description:
              "Medical notes documenting depressed mood, anxiety, suspiciousness, panic attacks (weekly or less), chronic sleep impairment, or mild memory loss",
          },
          {
            id: "sleep",
            label: "Sleep Impairment",
            type: "recommended",
            description:
              "Documentation of chronic sleep disturbance (nightmares, insomnia)",
          },
          {
            id: "memory",
            label: "Memory Issues",
            type: "recommended",
            description:
              "Evidence of mild memory loss (forgetting names, directions, recent events)",
          },
        ],
      },
      50: {
        label: "50% - Reduced reliability and productivity",
        requirements: [
          {
            id: "diagnosis",
            label: "PTSD Diagnosis",
            type: "required",
            description: "Formal PTSD diagnosis",
          },
          {
            id: "stressor",
            label: "In-Service Stressor",
            type: "required",
            description: "Documented stressor event",
          },
          {
            id: "panic",
            label: "Panic Attacks",
            type: "required",
            description: "Documentation of panic attacks more than once a week",
          },
          {
            id: "relationships",
            label: "Relationship Difficulties",
            type: "required",
            description:
              "Evidence of difficulty in establishing and maintaining effective work and social relationships",
          },
          {
            id: "judgment",
            label: "Impaired Judgment/Thinking",
            type: "required",
            description:
              "Documentation of flattened affect, circumstantial speech, impaired judgment, or disturbances of motivation and mood",
          },
          {
            id: "buddy_statements",
            label: "Buddy/Lay Statements",
            type: "recommended",
            description:
              "Statements from family/friends about behavioral changes observed",
          },
        ],
      },
      70: {
        label:
          "70% - Deficiencies in most areas (work, school, family, judgment, thinking, mood)",
        requirements: [
          {
            id: "diagnosis",
            label: "PTSD Diagnosis",
            type: "required",
            description: "Formal PTSD diagnosis",
          },
          {
            id: "stressor",
            label: "In-Service Stressor",
            type: "required",
            description: "Documented stressor event",
          },
          {
            id: "suicidal_ideation",
            label: "Suicidal Ideation",
            type: "required",
            description:
              "Documented history of suicidal ideation (even passive)",
          },
          {
            id: "obsessional",
            label: "Obsessional Rituals",
            type: "required",
            description:
              "Evidence of obsessional rituals interfering with routine activities",
          },
          {
            id: "continuous_depression",
            label: "Near-Continuous Depression/Panic",
            type: "required",
            description:
              "Documentation of near-continuous panic or depression affecting ability to function",
          },
          {
            id: "speech",
            label: "Speech Impairment",
            type: "recommended",
            description:
              "Evidence of intermittently illogical, obscure, or irrelevant speech",
          },
          {
            id: "spatial",
            label: "Spatial Disorientation",
            type: "recommended",
            description: "Documentation of spatial disorientation",
          },
          {
            id: "impulse_control",
            label: "Impaired Impulse Control",
            type: "recommended",
            description:
              "Evidence of impaired impulse control (unprovoked irritability with periods of violence)",
          },
        ],
      },
      100: {
        label: "100% - Total occupational and social impairment",
        requirements: [
          {
            id: "diagnosis",
            label: "PTSD Diagnosis",
            type: "required",
            description: "Formal PTSD diagnosis",
          },
          {
            id: "stressor",
            label: "In-Service Stressor",
            type: "required",
            description: "Documented stressor event",
          },
          {
            id: "danger",
            label: "Persistent Danger to Self/Others",
            type: "required",
            description: "Evidence of persistent danger to self or others",
          },
          {
            id: "hallucinations",
            label: "Gross Impairment/Hallucinations",
            type: "required",
            description:
              "Documentation of gross impairment in thought processes, persistent delusions, or hallucinations",
          },
          {
            id: "memory_severe",
            label: "Severe Memory Impairment",
            type: "required",
            description:
              "Evidence of memory loss for names of close relatives, own occupation, or own name",
          },
          {
            id: "adl",
            label: "ADL Impairment",
            type: "required",
            description:
              "Documentation of inability to perform activities of daily living (including maintenance of minimal personal hygiene)",
          },
          {
            id: "disorientation",
            label: "Disorientation to Time/Place",
            type: "required",
            description: "Evidence of disorientation to time or place",
          },
        ],
      },
    },
    tips: [
      "Request your complete mental health records from VA",
      "Buddy statements are CRITICAL for documenting behavioral changes",
      "Keep a symptom journal between C&P exams documenting frequency and severity",
      "The GAF score is no longer used - focus on functional impact",
      "All mental health ratings use the SAME criteria under General Rating Formula",
    ],
  },

  // Major Depressive Disorder (DC 9434) - Per 38 CFR § 4.130
  depression: {
    name: "Major Depressive Disorder",
    diagnosticCode: "9434",
    category: "Mental Health",
    cfr: "38 CFR § 4.130, DC 9434",
    ratings: {
      0: {
        label: "0% - Diagnosed, symptoms controlled by continuous medication",
        requirements: [
          {
            id: "diagnosis",
            label: "MDD Diagnosis",
            type: "required",
            description:
              "Formal diagnosis of Major Depressive Disorder per DSM-5 criteria",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description:
              "Nexus to service or secondary to service-connected condition",
          },
        ],
      },
      10: {
        label:
          "10% - Occupational/social impairment due to mild or transient symptoms",
        requirements: [
          {
            id: "diagnosis",
            label: "MDD Diagnosis",
            type: "required",
            description: "Formal diagnosis",
          },
          {
            id: "mild_symptoms",
            label: "Mild Symptoms",
            type: "required",
            description:
              "Documentation of mild or transient symptoms that decrease work efficiency only during periods of significant stress",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service or secondary condition",
          },
        ],
      },
      30: {
        label: "30% - Occasional decrease in work efficiency",
        requirements: [
          {
            id: "diagnosis",
            label: "MDD Diagnosis",
            type: "required",
            description: "Formal diagnosis",
          },
          {
            id: "depression_docs",
            label: "Depressive Symptoms",
            type: "required",
            description:
              "Medical notes documenting depressed mood, anxiety, suspiciousness, chronic sleep impairment",
          },
          {
            id: "memory",
            label: "Mild Memory Loss",
            type: "recommended",
            description: "Evidence of mild memory loss",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      50: {
        label: "50% - Reduced reliability and productivity",
        requirements: [
          {
            id: "diagnosis",
            label: "MDD Diagnosis",
            type: "required",
            description: "Formal diagnosis",
          },
          {
            id: "flattened_affect",
            label: "Flattened Affect",
            type: "required",
            description: "Documentation of flattened affect",
          },
          {
            id: "panic",
            label: "Panic Attacks",
            type: "required",
            description: "Evidence of panic attacks more than once a week",
          },
          {
            id: "relationships",
            label: "Relationship Difficulties",
            type: "required",
            description:
              "Documentation of difficulty maintaining effective relationships",
          },
          {
            id: "judgment",
            label: "Impaired Judgment",
            type: "recommended",
            description: "Evidence of impaired judgment or abstract thinking",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      70: {
        label: "70% - Deficiencies in most areas",
        requirements: [
          {
            id: "diagnosis",
            label: "MDD Diagnosis",
            type: "required",
            description: "Formal diagnosis",
          },
          {
            id: "suicidal",
            label: "Suicidal Ideation",
            type: "required",
            description: "Documented suicidal ideation",
          },
          {
            id: "continuous_depression",
            label: "Near-Continuous Depression",
            type: "required",
            description:
              "Documentation of near-continuous depression affecting function independently, appropriately, and effectively",
          },
          {
            id: "impulse",
            label: "Impaired Impulse Control",
            type: "required",
            description: "Evidence of impaired impulse control",
          },
          {
            id: "speech",
            label: "Speech Impairment",
            type: "recommended",
            description: "Intermittently illogical or obscure speech",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      100: {
        label: "100% - Total occupational and social impairment",
        requirements: [
          {
            id: "diagnosis",
            label: "MDD Diagnosis",
            type: "required",
            description: "Formal diagnosis",
          },
          {
            id: "danger",
            label: "Danger to Self/Others",
            type: "required",
            description: "Evidence of persistent danger to self or others",
          },
          {
            id: "memory_severe",
            label: "Severe Memory Loss",
            type: "required",
            description: "Memory loss for names of close relatives or own name",
          },
          {
            id: "adl",
            label: "ADL Impairment",
            type: "required",
            description: "Inability to perform activities of daily living",
          },
          {
            id: "disorientation",
            label: "Disorientation",
            type: "required",
            description: "Disorientation to time or place",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
    },
    tips: [
      "Depression uses SAME criteria as PTSD - General Rating Formula for Mental Disorders",
      "Often claimed secondary to chronic pain conditions",
      "Document all medications and their side effects",
      "Hospitalizations or ER visits for mental health crises are powerful evidence",
    ],
  },

  // Generalized Anxiety Disorder (DC 9400) - Per 38 CFR § 4.130
  anxiety: {
    name: "Generalized Anxiety Disorder",
    diagnosticCode: "9400",
    category: "Mental Health",
    cfr: "38 CFR § 4.130, DC 9400",
    ratings: {
      0: {
        label: "0% - Diagnosed, symptoms controlled by continuous medication",
        requirements: [
          {
            id: "diagnosis",
            label: "GAD Diagnosis",
            type: "required",
            description:
              "Formal diagnosis of Generalized Anxiety Disorder per DSM-5",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      10: {
        label: "10% - Mild or transient symptoms",
        requirements: [
          {
            id: "diagnosis",
            label: "GAD Diagnosis",
            type: "required",
            description: "Formal diagnosis",
          },
          {
            id: "mild_symptoms",
            label: "Mild Symptoms",
            type: "required",
            description:
              "Documentation of mild symptoms decreasing work efficiency only during significant stress",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      30: {
        label: "30% - Occasional decrease in work efficiency",
        requirements: [
          {
            id: "diagnosis",
            label: "GAD Diagnosis",
            type: "required",
            description: "Formal diagnosis",
          },
          {
            id: "anxiety_docs",
            label: "Anxiety Documentation",
            type: "required",
            description:
              "Medical notes showing anxiety, suspiciousness, or panic attacks weekly or less",
          },
          {
            id: "sleep",
            label: "Chronic Sleep Impairment",
            type: "recommended",
            description: "Evidence of chronic sleep issues from anxiety",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      50: {
        label: "50% - Reduced reliability and productivity",
        requirements: [
          {
            id: "diagnosis",
            label: "GAD Diagnosis",
            type: "required",
            description: "Formal diagnosis",
          },
          {
            id: "panic_weekly",
            label: "Weekly+ Panic Attacks",
            type: "required",
            description: "Documentation of panic attacks more than once a week",
          },
          {
            id: "relationships",
            label: "Relationship Difficulties",
            type: "required",
            description: "Evidence of difficulty maintaining relationships",
          },
          {
            id: "motivation",
            label: "Disturbances of Motivation",
            type: "required",
            description: "Documentation of disturbances of motivation and mood",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      70: {
        label: "70% - Deficiencies in most areas",
        requirements: [
          {
            id: "diagnosis",
            label: "GAD Diagnosis",
            type: "required",
            description: "Formal diagnosis",
          },
          {
            id: "suicidal",
            label: "Suicidal Ideation",
            type: "required",
            description: "Documented suicidal ideation",
          },
          {
            id: "continuous_panic",
            label: "Near-Continuous Panic",
            type: "required",
            description:
              "Documentation of near-continuous panic affecting function",
          },
          {
            id: "neglect",
            label: "Neglect of Personal Hygiene",
            type: "recommended",
            description:
              "Evidence of neglect of personal appearance and hygiene",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      100: {
        label: "100% - Total occupational and social impairment",
        requirements: [
          {
            id: "diagnosis",
            label: "GAD Diagnosis",
            type: "required",
            description: "Formal diagnosis",
          },
          {
            id: "danger",
            label: "Danger to Self/Others",
            type: "required",
            description: "Persistent danger evidence",
          },
          {
            id: "gross_impairment",
            label: "Gross Impairment",
            type: "required",
            description: "Grossly inappropriate behavior",
          },
          {
            id: "disorientation",
            label: "Disorientation",
            type: "required",
            description: "Disorientation to time or place",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
    },
    tips: [
      "All anxiety disorders rated under same General Rating Formula",
      "Document panic attack frequency, duration, and triggers",
      "Get statements from employer about work performance issues",
      "Commonly secondary to PTSD or chronic pain conditions",
    ],
  },

  // ============================================
  // MUSCULOSKELETAL (38 CFR § 4.71a)
  // ============================================

  // Lumbar Strain (DC 5237) - Per 38 CFR § 4.71a
  lumbar_strain: {
    name: "Lumbar Strain / Back Condition",
    diagnosticCode: "5237",
    category: "Musculoskeletal",
    cfr: "38 CFR § 4.71a, DC 5235-5243 (General Rating Formula for Diseases and Injuries of the Spine)",
    ratings: {
      10: {
        label:
          "10% - Forward flexion greater than 60° but not greater than 85°, OR combined ROM greater than 120° but not greater than 235°",
        requirements: [
          {
            id: "diagnosis",
            label: "Back Condition Diagnosis",
            type: "required",
            description:
              "Documented diagnosis of lumbar condition (strain, DDD, etc.)",
          },
          {
            id: "rom",
            label: "Range of Motion Testing",
            type: "required",
            description:
              "ROM testing showing forward flexion 61-85° OR combined ROM 121-235°, OR muscle spasm, guarding, or localized tenderness not resulting in abnormal gait",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service or secondary to another condition",
          },
        ],
      },
      20: {
        label:
          "20% - Forward flexion greater than 30° but not greater than 60°, OR combined ROM not greater than 120°",
        requirements: [
          {
            id: "diagnosis",
            label: "Back Condition Diagnosis",
            type: "required",
            description: "Documented diagnosis",
          },
          {
            id: "rom",
            label: "Range of Motion Testing",
            type: "required",
            description:
              "ROM showing forward flexion 31-60° OR combined ROM 120° or less, OR muscle spasm/guarding severe enough to result in abnormal gait or spinal contour",
          },
          {
            id: "muscle_spasm",
            label: "Muscle Spasm/Guarding",
            type: "recommended",
            description:
              "Evidence of muscle spasm or guarding severe enough to cause abnormal gait or abnormal spinal contour",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      40: {
        label:
          "40% - Forward flexion 30° or less, OR favorable ankylosis of entire thoracolumbar spine",
        requirements: [
          {
            id: "diagnosis",
            label: "Back Condition Diagnosis",
            type: "required",
            description: "Documented diagnosis",
          },
          {
            id: "rom_severe",
            label: "Severely Limited ROM",
            type: "required",
            description: "ROM testing showing forward flexion 30° or less",
          },
          {
            id: "ankylosis_favorable",
            label: "Favorable Ankylosis Assessment",
            type: "recommended",
            description:
              "Assessment for favorable ankylosis of entire thoracolumbar spine",
          },
          {
            id: "flare_documentation",
            label: "Flare-Up Documentation",
            type: "recommended",
            description:
              "Documentation of flare-ups causing additional functional loss",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      50: {
        label: "50% - Unfavorable ankylosis of entire thoracolumbar spine",
        requirements: [
          {
            id: "diagnosis",
            label: "Back Condition Diagnosis",
            type: "required",
            description: "Documented diagnosis",
          },
          {
            id: "ankylosis_unfavorable",
            label: "Unfavorable Ankylosis",
            type: "required",
            description:
              "Medical evidence of unfavorable ankylosis of entire thoracolumbar spine (fixed in flexion or extension)",
          },
          {
            id: "imaging",
            label: "Imaging Studies",
            type: "required",
            description:
              "MRI/X-ray showing structural abnormalities supporting ankylosis",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      100: {
        label: "100% - Unfavorable ankylosis of entire spine",
        requirements: [
          {
            id: "diagnosis",
            label: "Back Condition Diagnosis",
            type: "required",
            description: "Documented diagnosis",
          },
          {
            id: "ankylosis_entire",
            label: "Entire Spine Ankylosis",
            type: "required",
            description:
              "Medical evidence of unfavorable ankylosis of ENTIRE spine (cervical + thoracolumbar)",
          },
          {
            id: "imaging",
            label: "Comprehensive Imaging",
            type: "required",
            description: "Full spine imaging showing complete fusion/ankylosis",
          },
          {
            id: "functional",
            label: "Functional Impact",
            type: "required",
            description: "Documentation of severe functional limitations",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
    },
    tips: [
      "ROM testing on your WORST day - document flare-ups with medical visits",
      "Per Correia, examiner MUST test active, passive, AND weight-bearing ROM",
      "Radiculopathy (nerve pain down legs) is rated SEPARATELY under DC 8520",
      "Combined ROM = forward flexion + extension + left/right lateral flexion + left/right rotation",
      "Muscle spasm causing abnormal gait can warrant 20% even with better ROM",
    ],
  },

  // Cervical Strain (DC 5237) - Per 38 CFR § 4.71a
  cervical_strain: {
    name: "Cervical Strain / Neck Condition",
    diagnosticCode: "5237",
    category: "Musculoskeletal",
    cfr: "38 CFR § 4.71a, DC 5235-5243 (General Rating Formula for Diseases and Injuries of the Spine)",
    ratings: {
      10: {
        label:
          "10% - Forward flexion greater than 30° but not greater than 40°, OR combined ROM greater than 170° but not greater than 335°",
        requirements: [
          {
            id: "diagnosis",
            label: "Cervical Condition Diagnosis",
            type: "required",
            description: "Documented diagnosis of cervical condition",
          },
          {
            id: "rom",
            label: "Range of Motion Testing",
            type: "required",
            description:
              "ROM showing forward flexion 31-40° OR combined cervical ROM 171-335°, OR muscle spasm/guarding not resulting in abnormal gait",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      20: {
        label:
          "20% - Forward flexion greater than 15° but not greater than 30°, OR combined ROM not greater than 170°",
        requirements: [
          {
            id: "diagnosis",
            label: "Cervical Condition Diagnosis",
            type: "required",
            description: "Documented diagnosis",
          },
          {
            id: "rom",
            label: "Range of Motion Testing",
            type: "required",
            description:
              "ROM showing forward flexion 16-30° OR combined ROM 170° or less, OR muscle spasm/guarding severe enough to result in abnormal gait or spinal contour",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      30: {
        label:
          "30% - Forward flexion 15° or less, OR favorable ankylosis of entire cervical spine",
        requirements: [
          {
            id: "diagnosis",
            label: "Cervical Condition Diagnosis",
            type: "required",
            description: "Documented diagnosis",
          },
          {
            id: "rom_severe",
            label: "Severely Limited ROM",
            type: "required",
            description:
              "ROM showing forward flexion 15° or less, OR favorable ankylosis of entire cervical spine",
          },
          {
            id: "imaging",
            label: "Imaging Studies",
            type: "recommended",
            description: "MRI/X-ray showing structural damage",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      40: {
        label: "40% - Unfavorable ankylosis of entire cervical spine",
        requirements: [
          {
            id: "diagnosis",
            label: "Cervical Condition Diagnosis",
            type: "required",
            description: "Documented diagnosis",
          },
          {
            id: "ankylosis",
            label: "Unfavorable Ankylosis",
            type: "required",
            description:
              "Medical evidence of unfavorable ankylosis of entire cervical spine",
          },
          {
            id: "imaging",
            label: "Imaging Studies",
            type: "required",
            description: "Imaging supporting ankylosis",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
    },
    tips: [
      "Cervical conditions often cause upper extremity radiculopathy - rate separately",
      "Document headaches caused by cervical strain",
      "Normal cervical ROM: flexion 45°, extension 45°, lateral 45° each, rotation 80° each",
      "Sleep position difficulties are important functional impact evidence",
    ],
  },

  // Intervertebral Disc Syndrome (DC 5243) - Per 38 CFR § 4.71a
  ivds: {
    name: "Intervertebral Disc Syndrome (IVDS)",
    diagnosticCode: "5243",
    category: "Musculoskeletal",
    cfr: "38 CFR § 4.71a, DC 5243 (Formula for Rating IVDS Based on Incapacitating Episodes)",
    ratings: {
      10: {
        label:
          "10% - Incapacitating episodes having a total duration of at least 1 week but less than 2 weeks during the past 12 months",
        requirements: [
          {
            id: "diagnosis",
            label: "IVDS Diagnosis",
            type: "required",
            description:
              "MRI or CT showing disc herniation/bulging or diagnosis of IVDS",
          },
          {
            id: "episodes",
            label: "Incapacitating Episode Documentation",
            type: "required",
            description:
              "Medical records showing at least 1 week but less than 2 weeks of bed rest prescribed by a physician",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      20: {
        label:
          "20% - Incapacitating episodes having a total duration of at least 2 weeks but less than 4 weeks",
        requirements: [
          {
            id: "diagnosis",
            label: "IVDS Diagnosis",
            type: "required",
            description: "MRI/CT confirming disc disease",
          },
          {
            id: "episodes",
            label: "Incapacitating Episode Documentation",
            type: "required",
            description:
              "Medical records showing at least 2 weeks but less than 4 weeks of physician-prescribed bed rest",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      40: {
        label:
          "40% - Incapacitating episodes having a total duration of at least 4 weeks but less than 6 weeks",
        requirements: [
          {
            id: "diagnosis",
            label: "IVDS Diagnosis",
            type: "required",
            description: "MRI/CT confirming disc disease",
          },
          {
            id: "episodes",
            label: "Incapacitating Episode Documentation",
            type: "required",
            description:
              "Medical records showing at least 4 weeks but less than 6 weeks of physician-prescribed bed rest",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      60: {
        label:
          "60% - Incapacitating episodes having a total duration of at least 6 weeks during the past 12 months",
        requirements: [
          {
            id: "diagnosis",
            label: "IVDS Diagnosis",
            type: "required",
            description: "MRI/CT confirming disc disease",
          },
          {
            id: "episodes_severe",
            label: "Severe Incapacitating Episodes",
            type: "required",
            description:
              "Medical records showing at least 6 weeks of physician-prescribed bed rest during past 12 months",
          },
          {
            id: "nerve_studies",
            label: "Nerve Conduction Studies",
            type: "recommended",
            description: "EMG/NCS documenting nerve involvement",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
    },
    tips: [
      "IVDS can be rated under ROM formula OR incapacitating episodes formula - VA must use higher",
      '"Incapacitating episode" requires PHYSICIAN-PRESCRIBED bed rest and treatment',
      "Keep detailed records of all episodes requiring bed rest",
      "Radiculopathy from disc disease rated SEPARATELY",
    ],
  },

  // Knee Conditions (DC 5260/5261) - Per 38 CFR § 4.71a
  knee_limitation: {
    name: "Knee Condition (Limitation of Motion)",
    diagnosticCode: "5260/5261",
    category: "Musculoskeletal",
    cfr: "38 CFR § 4.71a, DC 5260 (Flexion) and DC 5261 (Extension)",
    ratings: {
      0: {
        label: "0% - Flexion limited to 60° OR Extension limited to 5°",
        requirements: [
          {
            id: "diagnosis",
            label: "Knee Diagnosis",
            type: "required",
            description: "Documented knee condition diagnosis",
          },
          {
            id: "rom",
            label: "Range of Motion Testing",
            type: "required",
            description:
              "ROM testing showing flexion limited to 60° OR extension limited to 5°",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      10: {
        label: "10% - Flexion limited to 45° OR Extension limited to 10°",
        requirements: [
          {
            id: "diagnosis",
            label: "Knee Diagnosis",
            type: "required",
            description: "Documented knee condition",
          },
          {
            id: "rom",
            label: "Range of Motion Testing",
            type: "required",
            description:
              "ROM testing showing flexion limited to 45° OR extension limited to 10°",
          },
          {
            id: "pain",
            label: "Painful Motion Documentation",
            type: "recommended",
            description: "Documentation of painful motion",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      20: {
        label: "20% - Flexion limited to 30° OR Extension limited to 15°",
        requirements: [
          {
            id: "diagnosis",
            label: "Knee Diagnosis",
            type: "required",
            description: "Documented knee condition",
          },
          {
            id: "rom_moderate",
            label: "Moderate ROM Limitation",
            type: "required",
            description:
              "ROM testing showing flexion limited to 30° OR extension limited to 15°",
          },
          {
            id: "imaging",
            label: "Imaging Studies",
            type: "recommended",
            description: "X-ray or MRI showing structural damage",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      30: {
        label: "30% - Flexion limited to 15° OR Extension limited to 20°",
        requirements: [
          {
            id: "diagnosis",
            label: "Knee Diagnosis",
            type: "required",
            description: "Documented knee condition",
          },
          {
            id: "rom_severe",
            label: "Severe ROM Limitation",
            type: "required",
            description:
              "ROM testing showing flexion limited to 15° OR extension limited to 20°",
          },
          {
            id: "imaging",
            label: "Imaging Studies",
            type: "required",
            description: "X-ray or MRI showing significant damage",
          },
          {
            id: "functional",
            label: "Functional Impact",
            type: "recommended",
            description: "Documentation of impact on walking, stairs, etc.",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      40: {
        label: "40% - Extension limited to 30°",
        requirements: [
          {
            id: "diagnosis",
            label: "Knee Diagnosis",
            type: "required",
            description: "Documented knee condition",
          },
          {
            id: "rom_severe",
            label: "Severe Extension Limitation",
            type: "required",
            description: "ROM testing showing extension limited to 30°",
          },
          {
            id: "imaging",
            label: "Imaging Studies",
            type: "required",
            description: "Imaging showing structural cause",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      50: {
        label: "50% - Extension limited to 45°",
        requirements: [
          {
            id: "diagnosis",
            label: "Knee Diagnosis",
            type: "required",
            description: "Documented knee condition",
          },
          {
            id: "rom_severe",
            label: "Severe Extension Limitation",
            type: "required",
            description: "ROM testing showing extension limited to 45°",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
    },
    tips: [
      "You can get SEPARATE ratings for flexion AND extension limitations",
      "Instability (DC 5257) can be rated IN ADDITION to ROM limitations",
      "Normal knee ROM: 0° extension to 140° flexion",
      "Document flare-ups and additional ROM loss during flares",
      "Bilateral knees are each rated separately with bilateral factor applied",
    ],
  },

  // Knee Instability (DC 5257) - Per 38 CFR § 4.71a
  knee_instability: {
    name: "Knee Instability/Subluxation",
    diagnosticCode: "5257",
    category: "Musculoskeletal",
    cfr: "38 CFR § 4.71a, DC 5257",
    ratings: {
      10: {
        label: "10% - Slight recurrent subluxation or lateral instability",
        requirements: [
          {
            id: "diagnosis",
            label: "Knee Instability Diagnosis",
            type: "required",
            description: "Documented knee instability or recurrent subluxation",
          },
          {
            id: "examination",
            label: "Physical Examination",
            type: "required",
            description:
              "Examination showing slight instability (positive drawer test, varus/valgus stress test)",
          },
          {
            id: "history",
            label: "History of Giving Way",
            type: "recommended",
            description: "Statements documenting knee giving way or buckling",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      20: {
        label: "20% - Moderate recurrent subluxation or lateral instability",
        requirements: [
          {
            id: "diagnosis",
            label: "Knee Instability Diagnosis",
            type: "required",
            description: "Documented knee instability",
          },
          {
            id: "examination",
            label: "Physical Examination",
            type: "required",
            description:
              "Examination showing moderate instability with documented laxity",
          },
          {
            id: "brace",
            label: "Brace Requirement",
            type: "recommended",
            description: "Documentation of knee brace prescription",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      30: {
        label: "30% - Severe recurrent subluxation or lateral instability",
        requirements: [
          {
            id: "diagnosis",
            label: "Knee Instability Diagnosis",
            type: "required",
            description: "Documented knee instability",
          },
          {
            id: "examination",
            label: "Physical Examination",
            type: "required",
            description:
              "Examination showing severe instability with significant laxity",
          },
          {
            id: "falls",
            label: "Fall History",
            type: "recommended",
            description:
              "Documentation of falls or near-falls due to instability",
          },
          {
            id: "mri",
            label: "MRI Evidence",
            type: "recommended",
            description: "MRI showing ligament damage (ACL, PCL, MCL, LCL)",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
    },
    tips: [
      "Instability is rated IN ADDITION to limitation of motion - you can get both",
      "ACL, PCL, MCL, LCL tears all cause instability",
      'Keep a log of all episodes where knee "gave out" or buckled',
      "Knee brace prescription strengthens your claim",
    ],
  },

  // Degenerative Arthritis (DC 5003) - Per 38 CFR § 4.71a
  degenerative_arthritis: {
    name: "Degenerative Arthritis (Osteoarthritis)",
    diagnosticCode: "5003",
    category: "Musculoskeletal",
    cfr: "38 CFR § 4.71a, DC 5003",
    ratings: {
      10: {
        label:
          "10% - X-ray evidence of arthritis with limitation of motion not compensable OR involvement of 2+ major joints or groups with occasional incapacitating exacerbations",
        requirements: [
          {
            id: "diagnosis",
            label: "Arthritis Diagnosis",
            type: "required",
            description: "X-ray evidence of degenerative arthritis",
          },
          {
            id: "xray",
            label: "X-Ray Evidence",
            type: "required",
            description:
              "X-ray showing degenerative changes (bone spurs, joint space narrowing, etc.)",
          },
          {
            id: "limitation",
            label: "Limited ROM",
            type: "required",
            description:
              "ROM limitation that does not meet compensable level under appropriate DC, OR involvement of 2+ major joints",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      20: {
        label:
          "20% - X-ray evidence with involvement of 2+ major joints or groups with occasional incapacitating exacerbations",
        requirements: [
          {
            id: "diagnosis",
            label: "Arthritis Diagnosis",
            type: "required",
            description: "X-ray confirmed arthritis",
          },
          {
            id: "multiple_joints",
            label: "Multiple Joint Involvement",
            type: "required",
            description:
              "Documentation of arthritis in 2+ major joints or 2+ minor joint groups",
          },
          {
            id: "exacerbations",
            label: "Incapacitating Exacerbations",
            type: "required",
            description: "Evidence of occasional incapacitating exacerbations",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
    },
    tips: [
      "Arthritis is typically rated based on limitation of motion under specific joint DC",
      "If ROM limitation is not compensable, 10% can be assigned with X-ray evidence",
      "Each joint with arthritis can potentially be rated separately",
      "Weight-bearing joint arthritis often progresses - request periodic re-evaluation",
    ],
  },

  // Shoulder Limitation (DC 5201) - Per 38 CFR § 4.71a
  shoulder_limitation: {
    name: "Shoulder Limitation of Motion",
    diagnosticCode: "5201",
    category: "Musculoskeletal",
    cfr: "38 CFR § 4.71a, DC 5201",
    ratings: {
      20: {
        label: "20% - ARM limited to shoulder level (90°) - Major or Minor arm",
        requirements: [
          {
            id: "diagnosis",
            label: "Shoulder Diagnosis",
            type: "required",
            description: "Documented shoulder condition",
          },
          {
            id: "rom",
            label: "Range of Motion Testing",
            type: "required",
            description:
              "ROM showing arm can only be raised to shoulder level (90°)",
          },
          {
            id: "dominance",
            label: "Arm Dominance",
            type: "required",
            description:
              "Documentation of whether major (dominant) or minor arm",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      30: {
        label:
          "30% - ARM limited to midway between side and shoulder level (45°) - Major arm / 20% Minor arm",
        requirements: [
          {
            id: "diagnosis",
            label: "Shoulder Diagnosis",
            type: "required",
            description: "Documented shoulder condition",
          },
          {
            id: "rom",
            label: "Range of Motion Testing",
            type: "required",
            description:
              "ROM showing arm limited to midway between side and shoulder level (approximately 45°)",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      40: {
        label: "40% - ARM limited to 25° from side - Major arm / 30% Minor arm",
        requirements: [
          {
            id: "diagnosis",
            label: "Shoulder Diagnosis",
            type: "required",
            description: "Documented shoulder condition",
          },
          {
            id: "rom_severe",
            label: "Severe ROM Limitation",
            type: "required",
            description: "ROM showing arm limited to 25° from side",
          },
          {
            id: "imaging",
            label: "Imaging Studies",
            type: "recommended",
            description: "MRI or X-ray showing structural damage",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
    },
    tips: [
      "Major arm = dominant arm (typically right for right-handed person)",
      "Major arm gets higher rating than minor arm at certain levels",
      "Rotator cuff tears are common - get MRI documentation",
      "Document which arm is dominant in your claim",
    ],
  },

  // Ankle Limitation (DC 5271) - Per 38 CFR § 4.71a
  ankle_limitation: {
    name: "Ankle Limitation of Motion",
    diagnosticCode: "5271",
    category: "Musculoskeletal",
    cfr: "38 CFR § 4.71a, DC 5271",
    ratings: {
      10: {
        label: "10% - Moderate limitation of motion",
        requirements: [
          {
            id: "diagnosis",
            label: "Ankle Diagnosis",
            type: "required",
            description: "Documented ankle condition",
          },
          {
            id: "rom",
            label: "Range of Motion Testing",
            type: "required",
            description:
              "ROM showing moderate limitation (dorsiflexion less than 20°, plantar flexion less than 45°)",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      20: {
        label: "20% - Marked limitation of motion",
        requirements: [
          {
            id: "diagnosis",
            label: "Ankle Diagnosis",
            type: "required",
            description: "Documented ankle condition",
          },
          {
            id: "rom_marked",
            label: "Marked ROM Limitation",
            type: "required",
            description:
              "ROM showing marked limitation (significantly reduced from normal)",
          },
          {
            id: "imaging",
            label: "Imaging Studies",
            type: "recommended",
            description: "X-ray or MRI showing structural cause",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
    },
    tips: [
      "Normal ankle: 20° dorsiflexion, 45° plantar flexion",
      "20% is maximum for limitation of motion alone",
      "Ankle instability can be rated separately under DC 5262",
      "Document impact on walking, running, stairs",
    ],
  },

  // Plantar Fasciitis / Foot Conditions (DC 5276/5284) - Per 38 CFR § 4.71a
  plantar_fasciitis: {
    name: "Plantar Fasciitis / Foot Injuries",
    diagnosticCode: "5276/5284",
    category: "Musculoskeletal",
    cfr: "38 CFR § 4.71a, DC 5276 (Flatfoot) / DC 5284 (Other Foot Injuries)",
    ratings: {
      10: {
        label: "10% - Moderate symptoms",
        requirements: [
          {
            id: "diagnosis",
            label: "Foot Condition Diagnosis",
            type: "required",
            description:
              "Documented diagnosis of plantar fasciitis or foot injury",
          },
          {
            id: "symptoms",
            label: "Symptom Documentation",
            type: "required",
            description:
              "Medical records showing moderate symptoms (pain with weight bearing, tenderness)",
          },
          {
            id: "orthotics",
            label: "Orthotic Use",
            type: "recommended",
            description: "Prescription for orthotics or shoe inserts",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description:
              "Nexus to service (often from running, marching, boots)",
          },
        ],
      },
      20: {
        label: "20% - Moderately severe symptoms",
        requirements: [
          {
            id: "diagnosis",
            label: "Foot Condition Diagnosis",
            type: "required",
            description: "Documented foot condition",
          },
          {
            id: "symptoms",
            label: "Moderately Severe Symptoms",
            type: "required",
            description:
              "Evidence of moderately severe symptoms (objective evidence of marked deformity, pain with manipulation, swelling)",
          },
          {
            id: "imaging",
            label: "Imaging Studies",
            type: "recommended",
            description: "X-ray or MRI showing structural changes",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      30: {
        label: "30% - Severe symptoms",
        requirements: [
          {
            id: "diagnosis",
            label: "Foot Condition Diagnosis",
            type: "required",
            description: "Documented foot condition",
          },
          {
            id: "severe_symptoms",
            label: "Severe Symptoms",
            type: "required",
            description:
              "Evidence of severe symptoms (marked pronation, extreme tenderness of plantar surfaces, marked inward displacement)",
          },
          {
            id: "gait",
            label: "Gait Abnormality",
            type: "recommended",
            description: "Documentation of antalgic gait",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
    },
    tips: [
      "Both feet together can be rated or each foot separately depending on DC used",
      "DC 5284 (other foot injuries) may provide better rating than specific DCs",
      "Document all treatments tried: orthotics, injections, physical therapy",
      "Running and prolonged standing during service establishes nexus",
    ],
  },

  // ============================================
  // AUDITORY CONDITIONS (38 CFR § 4.85-4.87)
  // ============================================

  // Tinnitus (DC 6260) - Per 38 CFR § 4.87
  tinnitus: {
    name: "Tinnitus",
    diagnosticCode: "6260",
    category: "Auditory",
    cfr: "38 CFR § 4.87, DC 6260",
    ratings: {
      10: {
        label: "10% - Maximum schedular rating for tinnitus",
        requirements: [
          {
            id: "diagnosis",
            label: "Tinnitus Diagnosis",
            type: "required",
            description:
              "Documented diagnosis of tinnitus (ringing, buzzing, hissing in ears)",
          },
          {
            id: "audiogram",
            label: "Audiological Exam",
            type: "required",
            description:
              "Audiogram or statement from audiologist confirming tinnitus",
          },
          {
            id: "noise_exposure",
            label: "Noise Exposure Evidence",
            type: "required",
            description:
              "Service records showing noise exposure (MOS, combat, flight line, artillery, etc.)",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus linking tinnitus to service noise exposure",
          },
        ],
      },
    },
    tips: [
      "10% is the MAXIMUM schedular rating for tinnitus regardless of whether bilateral or unilateral",
      "This is one of the easiest conditions to claim and service-connect",
      "Your DD-214 MOS alone can prove noise exposure (infantry, artillery, aviation, etc.)",
      "Hearing loss can and should be claimed SEPARATELY",
    ],
  },

  // Hearing Loss (DC 6100) - Per 38 CFR § 4.85
  hearing_loss: {
    name: "Hearing Loss (Bilateral)",
    diagnosticCode: "6100",
    category: "Auditory",
    cfr: "38 CFR § 4.85-4.86, DC 6100",
    ratings: {
      0: {
        label:
          "0% - Hearing impairment exists but does not meet compensable level",
        requirements: [
          {
            id: "diagnosis",
            label: "Hearing Loss Diagnosis",
            type: "required",
            description: "Audiogram showing hearing loss",
          },
          {
            id: "audiogram",
            label: "VA Audiogram with Speech Recognition",
            type: "required",
            description:
              "Audiogram with pure tone averages and Maryland CNC speech recognition scores",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to noise exposure in service",
          },
        ],
      },
      10: {
        label: "10% - Per Table VI/VIa and Table VII combination",
        requirements: [
          {
            id: "diagnosis",
            label: "Hearing Loss Diagnosis",
            type: "required",
            description: "Audiogram confirming hearing loss",
          },
          {
            id: "audiogram",
            label: "VA Audiogram",
            type: "required",
            description:
              "Audiogram with PTA and speech recognition scores meeting 10% level per Table VII",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
    },
    tips: [
      "Hearing loss ratings are determined by a mathematical formula using Tables VI/VIa and VII",
      "Both puretone averages AND speech recognition (Maryland CNC) scores are used",
      "Get your worst audiogram results - test when ears are most affected",
      "Exceptional patterns under § 4.86 may allow higher rating",
      "Claim SEPARATELY from tinnitus - you can get both",
    ],
  },

  // Meniere\'s Disease (DC 6205) - Per 38 CFR § 4.87
  menieres: {
    name: "Meniere's Disease",
    diagnosticCode: "6205",
    category: "Auditory",
    cfr: "38 CFR § 4.87, DC 6205",
    ratings: {
      30: {
        label:
          "30% - Hearing impairment with vertigo less than once a month, with or without tinnitus",
        requirements: [
          {
            id: "diagnosis",
            label: "Meniere's Diagnosis",
            type: "required",
            description: "Documented diagnosis of Meniere's disease",
          },
          {
            id: "hearing_loss",
            label: "Hearing Impairment",
            type: "required",
            description: "Audiogram showing hearing loss",
          },
          {
            id: "vertigo",
            label: "Vertigo Documentation",
            type: "required",
            description:
              "Medical records showing vertigo attacks occurring less than once a month",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      60: {
        label:
          "60% - Hearing impairment with attacks of vertigo and cerebellar gait 1-4 times monthly",
        requirements: [
          {
            id: "diagnosis",
            label: "Meniere's Diagnosis",
            type: "required",
            description: "Documented diagnosis of Meniere's disease",
          },
          {
            id: "hearing_loss",
            label: "Hearing Impairment",
            type: "required",
            description: "Documented hearing loss",
          },
          {
            id: "vertigo_monthly",
            label: "Monthly Vertigo Episodes",
            type: "required",
            description:
              "Medical records showing vertigo attacks with cerebellar gait occurring 1-4 times monthly",
          },
          {
            id: "tinnitus",
            label: "Tinnitus",
            type: "recommended",
            description: "Documentation of associated tinnitus",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      100: {
        label:
          "100% - Hearing impairment with attacks of vertigo and cerebellar gait more than once weekly",
        requirements: [
          {
            id: "diagnosis",
            label: "Meniere's Diagnosis",
            type: "required",
            description: "Documented diagnosis of Meniere's disease",
          },
          {
            id: "hearing_loss",
            label: "Hearing Impairment",
            type: "required",
            description: "Documented hearing loss",
          },
          {
            id: "vertigo_weekly",
            label: "Weekly Vertigo Episodes",
            type: "required",
            description:
              "Medical records showing vertigo attacks occurring more than once weekly with cerebellar gait",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
    },
    tips: [
      "Document EVERY vertigo episode - frequency determines rating",
      "Meniere's can be secondary to acoustic trauma during service",
      "Hearing loss, tinnitus, and vertigo together suggest Meniere's",
      "Keep a symptom diary of vertigo attacks with duration and severity",
    ],
  },

  // ============================================
  // NEUROLOGICAL CONDITIONS (38 CFR § 4.124a)
  // ============================================

  // Migraine Headaches (DC 8100) - Per 38 CFR § 4.124a
  migraines: {
    name: "Migraine Headaches",
    diagnosticCode: "8100",
    category: "Neurological",
    cfr: "38 CFR § 4.124a, DC 8100",
    ratings: {
      0: {
        label: "0% - Less frequent attacks than 10% criteria",
        requirements: [
          {
            id: "diagnosis",
            label: "Migraine Diagnosis",
            type: "required",
            description: "Documented diagnosis of migraine headaches",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      10: {
        label:
          "10% - Characteristic prostrating attacks averaging one in 2 months over the last several months",
        requirements: [
          {
            id: "diagnosis",
            label: "Migraine Diagnosis",
            type: "required",
            description: "Documented diagnosis",
          },
          {
            id: "frequency",
            label: "Attack Frequency Documentation",
            type: "required",
            description:
              "Medical records showing prostrating attacks averaging 1 every 2 months",
          },
          {
            id: "prostrating",
            label: "Prostrating Nature",
            type: "required",
            description:
              'Documentation that attacks are "prostrating" (must stop activity and lie down)',
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      30: {
        label:
          "30% - Characteristic prostrating attacks occurring on average once a month over the last several months",
        requirements: [
          {
            id: "diagnosis",
            label: "Migraine Diagnosis",
            type: "required",
            description: "Documented diagnosis",
          },
          {
            id: "frequency_monthly",
            label: "Monthly Attack Documentation",
            type: "required",
            description:
              "Medical records or headache diary showing monthly prostrating attacks",
          },
          {
            id: "headache_log",
            label: "Headache Diary/Log",
            type: "recommended",
            description:
              "Personal headache log documenting frequency, duration, and severity",
          },
          {
            id: "missed_work",
            label: "Work Impact",
            type: "recommended",
            description: "Documentation of missed work or reduced productivity",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      50: {
        label:
          "50% - Very frequent completely prostrating and prolonged attacks productive of severe economic inadaptability",
        requirements: [
          {
            id: "diagnosis",
            label: "Migraine Diagnosis",
            type: "required",
            description: "Documented diagnosis",
          },
          {
            id: "frequent_attacks",
            label: "Very Frequent Attacks",
            type: "required",
            description:
              "Documentation of very frequent (multiple per week) completely prostrating and prolonged attacks",
          },
          {
            id: "economic_impact",
            label: "Economic Impact Evidence",
            type: "required",
            description:
              "Evidence of severe economic inadaptability (job loss, reduced hours, FMLA records, work restrictions)",
          },
          {
            id: "headache_log",
            label: "Detailed Headache Diary",
            type: "required",
            description: "Comprehensive headache log showing attack patterns",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
    },
    tips: [
      "Keep a DETAILED headache diary - DATE, TIME, DURATION, SYMPTOMS",
      '"Prostrating" means you must stop what you are doing and lie down - document this',
      "FMLA records and employer statements are GOLD for proving economic impact",
      "Buddy statements from family about your episodes during migraines are valuable",
    ],
  },

  // Traumatic Brain Injury (DC 8045) - Per 38 CFR § 4.124a
  tbi: {
    name: "Traumatic Brain Injury (TBI)",
    diagnosticCode: "8045",
    category: "Neurological",
    cfr: "38 CFR § 4.124a, DC 8045",
    ratings: {
      0: {
        label: "0% - Documented TBI, no residuals",
        requirements: [
          {
            id: "diagnosis",
            label: "TBI Diagnosis",
            type: "required",
            description: "Documented traumatic brain injury",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "In-service TBI event",
          },
        ],
      },
      10: {
        label: "10% - Cognitive impairment level 1 (mild)",
        requirements: [
          {
            id: "diagnosis",
            label: "TBI Diagnosis",
            type: "required",
            description: "Documented TBI",
          },
          {
            id: "cognitive_testing",
            label: "Cognitive Testing",
            type: "required",
            description:
              "Neuropsychological testing showing mild cognitive impairment",
          },
          {
            id: "functional_impact",
            label: "Functional Impairment",
            type: "required",
            description:
              "Documentation of how cognitive issues affect daily function",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "In-service TBI event (blast, concussion, etc.)",
          },
        ],
      },
      40: {
        label: "40% - Cognitive impairment level 2 (moderate)",
        requirements: [
          {
            id: "diagnosis",
            label: "TBI Diagnosis",
            type: "required",
            description: "Documented TBI",
          },
          {
            id: "cognitive_testing",
            label: "Cognitive Testing",
            type: "required",
            description:
              "Neuropsychological testing showing moderate cognitive impairment",
          },
          {
            id: "work_impact",
            label: "Occupational Impact",
            type: "required",
            description:
              "Documentation of occupational impairment from cognitive deficits",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "In-service TBI event",
          },
        ],
      },
      70: {
        label: "70% - Cognitive impairment level 3 (moderately severe)",
        requirements: [
          {
            id: "diagnosis",
            label: "TBI Diagnosis",
            type: "required",
            description: "Documented TBI",
          },
          {
            id: "cognitive_testing",
            label: "Cognitive Testing",
            type: "required",
            description:
              "Neuropsychological testing showing moderately severe impairment",
          },
          {
            id: "supervision",
            label: "Supervision Needs",
            type: "required",
            description:
              "Documentation showing need for some supervision or assistance",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "In-service TBI event",
          },
        ],
      },
      100: {
        label:
          "100% - Total impairment of cognitive, emotional, or social functioning",
        requirements: [
          {
            id: "diagnosis",
            label: "TBI Diagnosis",
            type: "required",
            description: "Documented TBI",
          },
          {
            id: "total_impairment",
            label: "Total Impairment Documentation",
            type: "required",
            description: "Evidence of total occupational and social impairment",
          },
          {
            id: "constant_supervision",
            label: "Constant Supervision",
            type: "required",
            description: "Documentation of need for constant supervision",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "In-service TBI event",
          },
        ],
      },
    },
    tips: [
      "TBI residuals are rated based on THREE areas: cognitive, emotional/behavioral, and physical",
      "Each area is rated separately, then highest rating (at minimum 10%) applies",
      "Request comprehensive neuropsychological testing",
      "Document ALL TBI residuals: headaches, vision changes, memory, mood changes",
    ],
  },

  // Radiculopathy/Sciatica (DC 8520) - Per 38 CFR § 4.124a
  radiculopathy: {
    name: "Radiculopathy (Sciatic Nerve)",
    diagnosticCode: "8520",
    category: "Neurological",
    cfr: "38 CFR § 4.124a, DC 8520",
    ratings: {
      10: {
        label: "10% - Mild incomplete paralysis",
        requirements: [
          {
            id: "diagnosis",
            label: "Radiculopathy Diagnosis",
            type: "required",
            description: "Documented radiculopathy from nerve root compression",
          },
          {
            id: "nerve_exam",
            label: "Neurological Examination",
            type: "required",
            description: "Examination showing mild sensory or motor deficits",
          },
          {
            id: "emg",
            label: "EMG/NCS",
            type: "recommended",
            description:
              "Nerve conduction studies documenting nerve involvement",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service-connected back/neck condition",
          },
        ],
      },
      20: {
        label: "20% - Moderate incomplete paralysis",
        requirements: [
          {
            id: "diagnosis",
            label: "Radiculopathy Diagnosis",
            type: "required",
            description: "Documented radiculopathy",
          },
          {
            id: "nerve_exam",
            label: "Neurological Examination",
            type: "required",
            description:
              "Examination showing moderate sensory or motor deficits",
          },
          {
            id: "emg",
            label: "EMG/NCS",
            type: "required",
            description:
              "Nerve conduction studies showing moderate involvement",
          },
          {
            id: "functional",
            label: "Functional Impact",
            type: "recommended",
            description: "Documentation of impact on walking, standing, etc.",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service-connected condition",
          },
        ],
      },
      40: {
        label: "40% - Moderately severe incomplete paralysis",
        requirements: [
          {
            id: "diagnosis",
            label: "Radiculopathy Diagnosis",
            type: "required",
            description: "Documented radiculopathy",
          },
          {
            id: "nerve_exam",
            label: "Neurological Examination",
            type: "required",
            description:
              "Examination showing moderately severe sensory and motor deficits",
          },
          {
            id: "emg",
            label: "EMG/NCS",
            type: "required",
            description:
              "Nerve conduction studies showing significant involvement",
          },
          {
            id: "atrophy",
            label: "Muscle Atrophy",
            type: "recommended",
            description: "Documentation of muscle atrophy",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service-connected condition",
          },
        ],
      },
      60: {
        label: "60% - Severe incomplete paralysis with marked muscular atrophy",
        requirements: [
          {
            id: "diagnosis",
            label: "Radiculopathy Diagnosis",
            type: "required",
            description: "Documented radiculopathy",
          },
          {
            id: "severe_exam",
            label: "Severe Neurological Findings",
            type: "required",
            description:
              "Examination showing severe sensory and motor deficits",
          },
          {
            id: "marked_atrophy",
            label: "Marked Muscular Atrophy",
            type: "required",
            description: "Documentation of marked muscular atrophy",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service-connected condition",
          },
        ],
      },
      80: {
        label:
          "80% - Complete paralysis (foot dangles, no movement possible below knee)",
        requirements: [
          {
            id: "diagnosis",
            label: "Radiculopathy Diagnosis",
            type: "required",
            description: "Documented complete sciatic nerve paralysis",
          },
          {
            id: "complete_paralysis",
            label: "Complete Paralysis Documentation",
            type: "required",
            description:
              "Examination showing foot dangles and drops, no active movement possible of muscles below knee",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service-connected condition",
          },
        ],
      },
    },
    tips: [
      "Radiculopathy is rated SEPARATELY from the back/neck condition causing it",
      "Get EMG/nerve conduction studies to document nerve involvement",
      "Each leg can be rated separately if both affected",
      "Upper extremity radiculopathy uses different DCs (8510-8519)",
    ],
  },

  // Peripheral Neuropathy - Upper (DC 8515) - Per 38 CFR § 4.124a
  carpal_tunnel: {
    name: "Carpal Tunnel Syndrome / Median Nerve",
    diagnosticCode: "8515",
    category: "Neurological",
    cfr: "38 CFR § 4.124a, DC 8515",
    ratings: {
      10: {
        label: "10% - Mild incomplete paralysis (major or minor hand)",
        requirements: [
          {
            id: "diagnosis",
            label: "Carpal Tunnel Diagnosis",
            type: "required",
            description:
              "Documented carpal tunnel syndrome or median nerve dysfunction",
          },
          {
            id: "nerve_exam",
            label: "Neurological Examination",
            type: "required",
            description: "Positive Tinel and Phalen signs, sensory deficits",
          },
          {
            id: "emg",
            label: "EMG/NCS",
            type: "recommended",
            description:
              "Nerve conduction studies showing median nerve involvement",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service (repetitive motion, trauma)",
          },
        ],
      },
      30: {
        label:
          "30% - Moderate incomplete paralysis (major hand) / 20% (minor hand)",
        requirements: [
          {
            id: "diagnosis",
            label: "Carpal Tunnel Diagnosis",
            type: "required",
            description: "Documented carpal tunnel",
          },
          {
            id: "nerve_exam",
            label: "Neurological Examination",
            type: "required",
            description: "Moderate sensory and motor deficits",
          },
          {
            id: "emg",
            label: "EMG/NCS",
            type: "required",
            description:
              "Nerve conduction studies showing moderate involvement",
          },
          {
            id: "functional",
            label: "Grip Weakness",
            type: "recommended",
            description: "Documentation of grip weakness and dropping objects",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      50: {
        label:
          "50% - Severe incomplete paralysis (major hand) / 40% (minor hand)",
        requirements: [
          {
            id: "diagnosis",
            label: "Carpal Tunnel Diagnosis",
            type: "required",
            description: "Documented carpal tunnel",
          },
          {
            id: "severe_findings",
            label: "Severe Neurological Findings",
            type: "required",
            description: "Significant sensory loss and thenar atrophy",
          },
          {
            id: "emg",
            label: "EMG/NCS",
            type: "required",
            description: "Nerve conduction studies showing severe involvement",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      70: {
        label: "70% - Complete paralysis (major hand) / 60% (minor hand)",
        requirements: [
          {
            id: "diagnosis",
            label: "Median Nerve Paralysis",
            type: "required",
            description: "Complete median nerve paralysis",
          },
          {
            id: "complete_paralysis",
            label: "Complete Paralysis Evidence",
            type: "required",
            description:
              "Hand inclined to ulnar side, index and middle fingers extended, unable to flex, unable to make fist",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
    },
    tips: [
      "Different ratings for dominant (major) vs non-dominant (minor) hand",
      "EMG/NCS is key evidence - request if not done",
      "Bilateral carpal tunnel = separate ratings for each hand",
      "Post-surgical carpal tunnel can still be rated if residuals exist",
    ],
  },

  // Diabetic Peripheral Neuropathy (DC 8520/8521) - Per 38 CFR § 4.124a
  diabetic_neuropathy: {
    name: "Diabetic Peripheral Neuropathy (Lower Extremities)",
    diagnosticCode: "8520/8521",
    category: "Neurological",
    cfr: "38 CFR § 4.124a, DC 8520-8530",
    ratings: {
      10: {
        label: "10% - Mild incomplete paralysis (each extremity)",
        requirements: [
          {
            id: "diagnosis",
            label: "Neuropathy Diagnosis",
            type: "required",
            description: "Documented peripheral neuropathy diagnosis",
          },
          {
            id: "diabetes",
            label: "Diabetes Diagnosis",
            type: "required",
            description: "Service-connected diabetes mellitus",
          },
          {
            id: "nerve_exam",
            label: "Neurological Examination",
            type: "required",
            description:
              "Examination showing mild sensory deficits (numbness, tingling)",
          },
          {
            id: "emg",
            label: "EMG/NCS",
            type: "recommended",
            description: "Nerve conduction studies documenting neuropathy",
          },
        ],
      },
      20: {
        label: "20% - Moderate incomplete paralysis (each extremity)",
        requirements: [
          {
            id: "diagnosis",
            label: "Neuropathy Diagnosis",
            type: "required",
            description: "Documented peripheral neuropathy",
          },
          {
            id: "diabetes",
            label: "Diabetes Diagnosis",
            type: "required",
            description: "Service-connected diabetes mellitus",
          },
          {
            id: "moderate_symptoms",
            label: "Moderate Symptoms",
            type: "required",
            description: "Evidence of moderate sensory and motor deficits",
          },
          {
            id: "emg",
            label: "EMG/NCS",
            type: "required",
            description:
              "Nerve conduction studies showing moderate involvement",
          },
        ],
      },
      40: {
        label: "40% - Moderately severe incomplete paralysis (each extremity)",
        requirements: [
          {
            id: "diagnosis",
            label: "Neuropathy Diagnosis",
            type: "required",
            description: "Documented peripheral neuropathy",
          },
          {
            id: "diabetes",
            label: "Diabetes Diagnosis",
            type: "required",
            description: "Service-connected diabetes mellitus",
          },
          {
            id: "severe_symptoms",
            label: "Moderately Severe Symptoms",
            type: "required",
            description: "Significant sensory and motor impairment",
          },
          {
            id: "atrophy",
            label: "Muscle Atrophy",
            type: "recommended",
            description: "Evidence of muscle atrophy",
          },
        ],
      },
    },
    tips: [
      "Diabetic neuropathy is rated SECONDARY to diabetes - diabetes must be service-connected first",
      "Each extremity (both legs, both arms if affected) rated separately",
      "EMG/nerve conduction studies provide objective evidence",
      "Document all symptoms: numbness, burning, pain, weakness",
    ],
  },

  // Seizure Disorders/Epilepsy (DC 8910-8914) - Per 38 CFR § 4.124a
  seizures: {
    name: "Seizure Disorder / Epilepsy",
    diagnosticCode: "8910-8914",
    category: "Neurological",
    cfr: "38 CFR § 4.124a, DC 8910-8914",
    ratings: {
      10: {
        label: "10% - Confirmed diagnosis with history of seizures",
        requirements: [
          {
            id: "diagnosis",
            label: "Seizure Disorder Diagnosis",
            type: "required",
            description: "Documented diagnosis of epilepsy or seizure disorder",
          },
          {
            id: "eeg",
            label: "EEG",
            type: "recommended",
            description: "EEG showing seizure activity or abnormalities",
          },
          {
            id: "medications",
            label: "Anticonvulsant Medications",
            type: "recommended",
            description: "Prescription records for seizure medications",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service (TBI, injury, illness)",
          },
        ],
      },
      20: {
        label:
          "20% - At least 1 major seizure in last 2 years OR 2+ minor seizures in last 6 months",
        requirements: [
          {
            id: "diagnosis",
            label: "Seizure Disorder Diagnosis",
            type: "required",
            description: "Documented seizure disorder",
          },
          {
            id: "seizure_log",
            label: "Seizure Frequency Documentation",
            type: "required",
            description:
              "Medical records documenting at least 1 major seizure in last 2 years OR 2+ minor seizures in last 6 months",
          },
          {
            id: "medications",
            label: "Continuous Medication",
            type: "required",
            description: "Evidence of continuous medication requirement",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      40: {
        label:
          "40% - At least 1 major seizure in last 6 months OR 2+ in last year, OR 5-8 minor seizures weekly",
        requirements: [
          {
            id: "diagnosis",
            label: "Seizure Disorder Diagnosis",
            type: "required",
            description: "Documented seizure disorder",
          },
          {
            id: "frequent_seizures",
            label: "Frequent Seizure Documentation",
            type: "required",
            description:
              "Medical records showing at least 1 major seizure in last 6 months OR 2+ in last year, OR 5-8 minor seizures weekly",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      60: {
        label:
          "60% - At least 1 major seizure in last 4 months, OR 9-10 minor seizures weekly",
        requirements: [
          {
            id: "diagnosis",
            label: "Seizure Disorder Diagnosis",
            type: "required",
            description: "Documented seizure disorder",
          },
          {
            id: "very_frequent",
            label: "Very Frequent Seizures",
            type: "required",
            description:
              "Documentation of at least 1 major seizure in last 4 months, OR 9-10 minor seizures weekly",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      80: {
        label:
          "80% - At least 1 major seizure in last 3 months, OR 10+ minor seizures weekly",
        requirements: [
          {
            id: "diagnosis",
            label: "Seizure Disorder Diagnosis",
            type: "required",
            description: "Documented seizure disorder",
          },
          {
            id: "severe_frequency",
            label: "Severe Seizure Frequency",
            type: "required",
            description:
              "Documentation of at least 1 major seizure in last 3 months, OR 10+ minor seizures weekly",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      100: {
        label: "100% - Averaging 1+ major seizure per month over last year",
        requirements: [
          {
            id: "diagnosis",
            label: "Seizure Disorder Diagnosis",
            type: "required",
            description: "Documented seizure disorder",
          },
          {
            id: "monthly_major",
            label: "Monthly Major Seizures",
            type: "required",
            description:
              "Documentation averaging at least 1 major seizure per month over last year",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
    },
    tips: [
      "Keep a detailed seizure diary with dates, times, types, duration",
      '"Major" seizures involve loss of consciousness; "minor" may be partial/focal',
      "Often secondary to TBI - establish TBI service connection first",
      "Witness statements about seizure episodes are valuable evidence",
    ],
  },

  // ============================================
  // CARDIOVASCULAR SYSTEM (38 CFR § 4.104)
  // ============================================

  // Hypertension (DC 7101) - Per 38 CFR § 4.104
  hypertension: {
    name: "Hypertension",
    diagnosticCode: "7101",
    category: "Cardiovascular",
    cfr: "38 CFR § 4.104, DC 7101",
    ratings: {
      10: {
        label:
          "10% - Diastolic 100-109, or systolic 160-199, or history of diastolic 100+ requiring continuous medication",
        requirements: [
          {
            id: "diagnosis",
            label: "Hypertension Diagnosis",
            type: "required",
            description: "Documented diagnosis of hypertension",
          },
          {
            id: "bp_readings",
            label: "Blood Pressure Readings",
            type: "required",
            description:
              "Multiple BP readings showing diastolic 100-109 OR systolic 160-199, OR history of diastolic 100+ requiring continuous medication for control",
          },
          {
            id: "medications",
            label: "Medication Records",
            type: "required",
            description:
              "Prescription records showing continuous antihypertensive medication",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description:
              "Nexus to service (started during/within 1 year of service, or secondary to another condition)",
          },
        ],
      },
      20: {
        label: "20% - Diastolic 110-119, or systolic 200+",
        requirements: [
          {
            id: "diagnosis",
            label: "Hypertension Diagnosis",
            type: "required",
            description: "Documented diagnosis",
          },
          {
            id: "bp_readings",
            label: "Blood Pressure Readings",
            type: "required",
            description:
              "Multiple BP readings showing diastolic predominantly 110-119 OR systolic predominantly 200+",
          },
          {
            id: "medications",
            label: "Medication Records",
            type: "recommended",
            description:
              "Records showing multiple antihypertensive medications",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      40: {
        label: "40% - Diastolic 120-129",
        requirements: [
          {
            id: "diagnosis",
            label: "Hypertension Diagnosis",
            type: "required",
            description: "Documented diagnosis",
          },
          {
            id: "bp_readings",
            label: "Blood Pressure Readings",
            type: "required",
            description:
              "Multiple BP readings showing diastolic predominantly 120-129",
          },
          {
            id: "end_organ",
            label: "End Organ Impact",
            type: "recommended",
            description: "Evidence of impact on heart, kidneys, or eyes",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      60: {
        label: "60% - Diastolic 130+",
        requirements: [
          {
            id: "diagnosis",
            label: "Hypertension Diagnosis",
            type: "required",
            description: "Documented diagnosis",
          },
          {
            id: "bp_readings",
            label: "Blood Pressure Readings",
            type: "required",
            description:
              "Multiple BP readings showing diastolic predominantly 130 or more",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
    },
    tips: [
      "Hypertension must be confirmed by readings taken on at least 2 different days",
      "Commonly claimed as secondary to PTSD, kidney disease, sleep apnea",
      "Document UNCONTROLLED readings - not readings taken after medication",
      "Presumptive for Gulf War veterans under certain circumstances",
    ],
  },

  // Coronary Artery Disease (DC 7005) - Per 38 CFR § 4.104
  cad: {
    name: "Coronary Artery Disease (CAD)",
    diagnosticCode: "7005",
    category: "Cardiovascular",
    cfr: "38 CFR § 4.104, DC 7005",
    ratings: {
      10: {
        label:
          "10% - Workload greater than 7 METs but not greater than 10 METs",
        requirements: [
          {
            id: "diagnosis",
            label: "CAD Diagnosis",
            type: "required",
            description:
              "Documented coronary artery disease (catheterization, stress test, imaging)",
          },
          {
            id: "mets",
            label: "Exercise/METs Testing",
            type: "required",
            description:
              "Stress test or estimation showing workload >7 but ≤10 METs resulting in dyspnea, fatigue, angina, dizziness, or syncope",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description:
              "Nexus to service (presumptive for Vietnam/Agent Orange, or ischemic heart disease)",
          },
        ],
      },
      30: {
        label:
          "30% - Workload greater than 5 METs but not greater than 7 METs, OR evidence of cardiac hypertrophy/dilatation on testing",
        requirements: [
          {
            id: "diagnosis",
            label: "CAD Diagnosis",
            type: "required",
            description: "Documented CAD",
          },
          {
            id: "mets",
            label: "Exercise/METs Testing",
            type: "required",
            description:
              "Stress test showing workload >5 but ≤7 METs, OR evidence of cardiac hypertrophy or dilatation on EKG, echo, or X-ray",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      60: {
        label:
          "60% - More than one episode of acute congestive heart failure in past year, OR workload 3-5 METs, OR LVEF 30-50%",
        requirements: [
          {
            id: "diagnosis",
            label: "CAD Diagnosis",
            type: "required",
            description: "Documented CAD",
          },
          {
            id: "chf_or_mets",
            label: "CHF Episodes or Low METs",
            type: "required",
            description:
              "Documentation of more than one CHF episode in past year, OR workload 3-5 METs, OR LVEF 30-50%",
          },
          {
            id: "echo",
            label: "Echocardiogram",
            type: "required",
            description: "Echo showing ejection fraction measurement",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      100: {
        label:
          "100% - Chronic CHF, OR workload 3 METs or less, OR LVEF less than 30%",
        requirements: [
          {
            id: "diagnosis",
            label: "CAD Diagnosis",
            type: "required",
            description: "Documented CAD",
          },
          {
            id: "chf_or_lvef",
            label: "Chronic CHF or Severely Reduced EF",
            type: "required",
            description:
              "Documentation of chronic congestive heart failure, OR workload ≤3 METs, OR LVEF <30%",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
    },
    tips: [
      "CAD/Ischemic Heart Disease is PRESUMPTIVE for Vietnam veterans exposed to Agent Orange",
      "Request stress test with METs estimation and echocardiogram with ejection fraction",
      "Stent placement or bypass surgery can establish diagnosis",
      "Heart attack (myocardial infarction) establishes CAD diagnosis",
    ],
  },

  // ============================================
  // DIGESTIVE SYSTEM (38 CFR § 4.114)
  // ============================================

  // GERD (DC 7346) - Per 38 CFR § 4.114
  gerd: {
    name: "GERD / Hiatal Hernia",
    diagnosticCode: "7346",
    category: "Digestive",
    cfr: "38 CFR § 4.114, DC 7346",
    ratings: {
      10: {
        label: "10% - Two or more symptoms of less severity",
        requirements: [
          {
            id: "diagnosis",
            label: "GERD Diagnosis",
            type: "required",
            description:
              "Endoscopy or clinical diagnosis of GERD/hiatal hernia",
          },
          {
            id: "symptoms",
            label: "Symptom Documentation",
            type: "required",
            description:
              "Medical records showing two or more symptoms (heartburn, regurgitation, dysphagia, pyrosis)",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description:
              "Nexus to service (often secondary to PTSD medications or MST)",
          },
        ],
      },
      30: {
        label:
          "30% - Persistently recurrent epigastric distress with dysphagia, pyrosis, and regurgitation, with considerable impairment of health",
        requirements: [
          {
            id: "diagnosis",
            label: "GERD Diagnosis",
            type: "required",
            description: "Endoscopy or clinical diagnosis",
          },
          {
            id: "persistent",
            label: "Persistent Symptoms",
            type: "required",
            description:
              "Documentation of persistently recurrent epigastric distress",
          },
          {
            id: "dysphagia",
            label: "Dysphagia",
            type: "required",
            description: "Documentation of difficulty swallowing",
          },
          {
            id: "substernal_pain",
            label: "Substernal/Arm/Shoulder Pain",
            type: "required",
            description: "Documentation of substernal, arm, or shoulder pain",
          },
          {
            id: "health_impairment",
            label: "Health Impairment",
            type: "required",
            description: "Evidence of considerable impairment to health",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      60: {
        label:
          "60% - Symptoms of pain, vomiting, material weight loss and hematemesis or melena with moderate anemia; or other symptom combinations productive of severe impairment of health",
        requirements: [
          {
            id: "diagnosis",
            label: "GERD Diagnosis",
            type: "required",
            description: "Endoscopy showing severe damage",
          },
          {
            id: "pain",
            label: "Pain Documentation",
            type: "required",
            description: "Documented persistent pain",
          },
          {
            id: "vomiting",
            label: "Vomiting/Hematemesis",
            type: "required",
            description:
              "Evidence of significant vomiting or hematemesis (vomiting blood) or melena (blood in stool)",
          },
          {
            id: "weight_loss",
            label: "Material Weight Loss",
            type: "required",
            description:
              "Documentation of material weight loss (documented weight history)",
          },
          {
            id: "anemia",
            label: "Anemia",
            type: "required",
            description: "Lab work showing moderate anemia",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
    },
    tips: [
      "GERD is commonly rated as secondary to PTSD medications (NSAIDs, etc.)",
      "Keep a food/symptom diary",
      "Document any esophageal damage from endoscopy (erosions, Barrett's, stricture)",
      "Weight loss must be documented with actual weight records",
    ],
  },

  // Irritable Bowel Syndrome (DC 7319) - Per 38 CFR § 4.114
  ibs: {
    name: "Irritable Bowel Syndrome (IBS)",
    diagnosticCode: "7319",
    category: "Digestive",
    cfr: "38 CFR § 4.114, DC 7319",
    ratings: {
      0: {
        label:
          "0% - Mild disturbances of bowel function with occasional episodes of abdominal distress",
        requirements: [
          {
            id: "diagnosis",
            label: "IBS Diagnosis",
            type: "required",
            description: "Documented IBS diagnosis",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      10: {
        label:
          "10% - Moderate - frequent episodes of bowel disturbance with abdominal distress",
        requirements: [
          {
            id: "diagnosis",
            label: "IBS Diagnosis",
            type: "required",
            description: "Documented IBS diagnosis",
          },
          {
            id: "frequency",
            label: "Frequent Episodes",
            type: "required",
            description:
              "Medical records showing frequent episodes of bowel disturbance with abdominal distress",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description:
              "Nexus to service (often secondary to anxiety, PTSD, or Gulf War)",
          },
        ],
      },
      30: {
        label:
          "30% - Severe - diarrhea or alternating diarrhea and constipation, with more or less constant abdominal distress",
        requirements: [
          {
            id: "diagnosis",
            label: "IBS Diagnosis",
            type: "required",
            description: "Documented IBS diagnosis",
          },
          {
            id: "severe_symptoms",
            label: "Severe Symptoms",
            type: "required",
            description:
              "Documentation of diarrhea or alternating diarrhea/constipation with more or less constant abdominal distress",
          },
          {
            id: "daily_impact",
            label: "Daily Life Impact",
            type: "recommended",
            description:
              "Evidence of impact on work, travel, or daily activities",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
    },
    tips: [
      "IBS is presumptive for Gulf War veterans as a functional GI disorder",
      "Commonly secondary to PTSD or anxiety",
      "Keep a detailed symptom diary",
      "30% is the maximum rating for IBS",
    ],
  },

  // ============================================
  // ENDOCRINE SYSTEM (38 CFR § 4.119)
  // ============================================

  // Diabetes Mellitus (DC 7913) - Per 38 CFR § 4.119
  diabetes: {
    name: "Diabetes Mellitus",
    diagnosticCode: "7913",
    category: "Endocrine",
    cfr: "38 CFR § 4.119, DC 7913",
    ratings: {
      10: {
        label: "10% - Manageable by restricted diet only",
        requirements: [
          {
            id: "diagnosis",
            label: "Diabetes Diagnosis",
            type: "required",
            description:
              "Documented diagnosis of diabetes mellitus (Type I or II)",
          },
          {
            id: "diet_controlled",
            label: "Diet Control",
            type: "required",
            description:
              "Medical records showing diabetes controlled by diet alone without oral hypoglycemic agent or insulin",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description:
              "Nexus to service (presumptive for Agent Orange exposure)",
          },
        ],
      },
      20: {
        label:
          "20% - Requiring insulin and restricted diet, OR oral hypoglycemic agent and restricted diet",
        requirements: [
          {
            id: "diagnosis",
            label: "Diabetes Diagnosis",
            type: "required",
            description: "Documented diabetes",
          },
          {
            id: "medication",
            label: "Medication Documentation",
            type: "required",
            description:
              "Prescription records showing insulin OR oral hypoglycemic medication",
          },
          {
            id: "diet",
            label: "Restricted Diet",
            type: "required",
            description: "Evidence of required dietary restrictions",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      40: {
        label:
          "40% - Requiring insulin, restricted diet, and regulation of activities",
        requirements: [
          {
            id: "diagnosis",
            label: "Diabetes Diagnosis",
            type: "required",
            description: "Documented diabetes",
          },
          {
            id: "insulin",
            label: "Insulin Requirement",
            type: "required",
            description: "Prescription records showing insulin requirement",
          },
          {
            id: "activity_regulation",
            label: "Activity Regulation",
            type: "required",
            description:
              "Medical documentation showing doctor-prescribed regulation of activities to avoid hypoglycemic episodes",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      60: {
        label:
          "60% - Requiring insulin, restricted diet, regulation of activities, with episodes of ketoacidosis or hypoglycemic reactions requiring 1-2 hospitalizations per year OR twice monthly visits to diabetic care provider",
        requirements: [
          {
            id: "diagnosis",
            label: "Diabetes Diagnosis",
            type: "required",
            description: "Documented diabetes",
          },
          {
            id: "insulin",
            label: "Insulin Requirement",
            type: "required",
            description: "Insulin prescription",
          },
          {
            id: "hospitalizations",
            label: "Hospitalizations/Visits",
            type: "required",
            description:
              "Records showing 1-2 hospitalizations per year for ketoacidosis/hypoglycemic reactions OR twice monthly diabetic care visits",
          },
          {
            id: "complications",
            label: "Complications",
            type: "recommended",
            description:
              "Documentation of progressive loss of weight and strength",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      100: {
        label:
          "100% - Requiring more than one daily injection of insulin, restricted diet, regulation of activities, with episodes of ketoacidosis or hypoglycemic reactions requiring 3+ hospitalizations per year OR weekly visits, with progressive loss of weight and strength",
        requirements: [
          {
            id: "diagnosis",
            label: "Diabetes Diagnosis",
            type: "required",
            description: "Documented diabetes",
          },
          {
            id: "multiple_injections",
            label: "Multiple Daily Injections",
            type: "required",
            description:
              "Documentation of more than one insulin injection daily",
          },
          {
            id: "hospitalizations_severe",
            label: "Frequent Hospitalizations",
            type: "required",
            description:
              "Records showing 3+ hospitalizations per year for ketoacidosis/hypoglycemic reactions OR weekly diabetic care visits",
          },
          {
            id: "weight_loss",
            label: "Progressive Weight/Strength Loss",
            type: "required",
            description:
              "Documented progressive loss of weight and strength attributable to diabetes",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
    },
    tips: [
      "Diabetes Type II is PRESUMPTIVE for Vietnam veterans exposed to Agent Orange",
      "Diabetic complications (neuropathy, retinopathy, nephropathy) are rated SEPARATELY",
      '"Regulation of activities" means doctor-ordered avoidance of strenuous activities - get this in writing',
      "Document ALL hospitalizations for diabetic emergencies",
    ],
  },

  // Hypothyroidism (DC 7903) - Per 38 CFR § 4.119
  hypothyroidism: {
    name: "Hypothyroidism",
    diagnosticCode: "7903",
    category: "Endocrine",
    cfr: "38 CFR § 4.119, DC 7903",
    ratings: {
      10: {
        label:
          "10% - Fatigability, or continuous medication required for control",
        requirements: [
          {
            id: "diagnosis",
            label: "Hypothyroidism Diagnosis",
            type: "required",
            description:
              "Documented hypothyroidism with lab confirmation (elevated TSH, low T4)",
          },
          {
            id: "medication",
            label: "Continuous Medication",
            type: "required",
            description:
              "Prescription records showing continuous thyroid medication (levothyroxine)",
          },
          {
            id: "symptoms",
            label: "Fatigability Documentation",
            type: "recommended",
            description: "Medical notes documenting fatigability",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description:
              "Nexus to service (or secondary to radiation exposure, medications)",
          },
        ],
      },
      30: {
        label: "30% - Fatigability, constipation, mental sluggishness",
        requirements: [
          {
            id: "diagnosis",
            label: "Hypothyroidism Diagnosis",
            type: "required",
            description: "Documented hypothyroidism",
          },
          {
            id: "symptoms",
            label: "Symptom Documentation",
            type: "required",
            description:
              "Medical records documenting fatigability, constipation, AND mental sluggishness",
          },
          {
            id: "medication",
            label: "Medication Records",
            type: "required",
            description: "Continuous medication requirement",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      60: {
        label: "60% - Muscular weakness, mental disturbance, weight gain",
        requirements: [
          {
            id: "diagnosis",
            label: "Hypothyroidism Diagnosis",
            type: "required",
            description: "Documented hypothyroidism",
          },
          {
            id: "muscular_weakness",
            label: "Muscular Weakness",
            type: "required",
            description: "Documentation of muscular weakness",
          },
          {
            id: "mental_disturbance",
            label: "Mental Disturbance",
            type: "required",
            description:
              "Evidence of mental disturbance (dementia, slowing of thought, depression)",
          },
          {
            id: "weight_gain",
            label: "Weight Gain",
            type: "required",
            description: "Documented weight gain",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      100: {
        label:
          "100% - Cold intolerance, muscular weakness, cardiovascular involvement, mental disturbance, bradycardia, sleepiness",
        requirements: [
          {
            id: "diagnosis",
            label: "Hypothyroidism Diagnosis",
            type: "required",
            description: "Documented severe hypothyroidism (myxedema)",
          },
          {
            id: "severe_symptoms",
            label: "Severe Symptom Complex",
            type: "required",
            description:
              "Documentation of cold intolerance, muscular weakness, cardiovascular involvement (less than 60 beats per minute), mental disturbance, bradycardia, and sleepiness",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
    },
    tips: [
      "Get regular thyroid panel labs to document condition",
      "Document ALL symptoms - fatigue, weight changes, cold intolerance, constipation, depression",
      "May be secondary to radiation exposure, certain medications, or autoimmune conditions",
      "Mental symptoms can overlap with depression rating - be strategic",
    ],
  },

  // ============================================
  // SKIN CONDITIONS (38 CFR § 4.118)
  // ============================================

  // Eczema/Dermatitis (DC 7806) - Per 38 CFR § 4.118
  eczema: {
    name: "Dermatitis / Eczema",
    diagnosticCode: "7806",
    category: "Skin",
    cfr: "38 CFR § 4.118, DC 7806",
    ratings: {
      0: {
        label:
          "0% - Less than 5% of entire body or exposed areas affected, no more than topical therapy required",
        requirements: [
          {
            id: "diagnosis",
            label: "Dermatitis/Eczema Diagnosis",
            type: "required",
            description: "Documented diagnosis of dermatitis or eczema",
          },
          {
            id: "photos",
            label: "Photographs",
            type: "recommended",
            description: "Photos during flare-ups showing affected areas",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      10: {
        label:
          "10% - At least 5% but less than 20% of entire body or exposed areas affected, OR intermittent systemic therapy required for total duration of less than 6 weeks during past 12 months",
        requirements: [
          {
            id: "diagnosis",
            label: "Dermatitis/Eczema Diagnosis",
            type: "required",
            description: "Documented diagnosis",
          },
          {
            id: "body_area",
            label: "Affected Area Documentation",
            type: "required",
            description:
              "Examination or photos showing 5-20% of body or exposed areas affected",
          },
          {
            id: "systemic_therapy",
            label: "Systemic Therapy",
            type: "required",
            description:
              "OR documentation of intermittent systemic therapy (corticosteroids, immunosuppressives) for less than 6 weeks/year",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      30: {
        label:
          "30% - 20-40% of entire body or exposed areas affected, OR systemic therapy required for 6 weeks or more but not constantly during past 12 months",
        requirements: [
          {
            id: "diagnosis",
            label: "Dermatitis/Eczema Diagnosis",
            type: "required",
            description: "Documented diagnosis",
          },
          {
            id: "body_area",
            label: "Affected Area Documentation",
            type: "required",
            description:
              "Documentation showing 20-40% of body or exposed areas affected",
          },
          {
            id: "systemic_therapy",
            label: "Systemic Therapy 6+ Weeks",
            type: "required",
            description:
              "OR documentation of systemic therapy for 6+ weeks but not constantly",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      60: {
        label:
          "60% - More than 40% of entire body or exposed areas affected, OR constant or near-constant systemic therapy required during past 12 months",
        requirements: [
          {
            id: "diagnosis",
            label: "Dermatitis/Eczema Diagnosis",
            type: "required",
            description: "Documented diagnosis",
          },
          {
            id: "body_area_severe",
            label: "Severe Affected Area",
            type: "required",
            description:
              "Documentation showing more than 40% of body or exposed areas affected",
          },
          {
            id: "constant_therapy",
            label: "Constant Systemic Therapy",
            type: "required",
            description:
              "OR documentation of constant/near-constant systemic therapy during past 12 months",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
    },
    tips: [
      "PHOTOGRAPH your skin during flare-ups - this is critical evidence",
      '"Systemic therapy" = oral or injected medications (prednisone, methotrexate, biologics)',
      "Topical steroids are NOT systemic therapy",
      '"Exposed areas" = head, face, neck, hands',
      "Schedule C&P exam during a flare-up if possible",
    ],
  },

  // Psoriasis (DC 7816) - Per 38 CFR § 4.118
  psoriasis: {
    name: "Psoriasis",
    diagnosticCode: "7816",
    category: "Skin",
    cfr: "38 CFR § 4.118, DC 7816",
    ratings: {
      0: {
        label:
          "0% - Less than 5% of entire body or exposed areas affected, no more than topical therapy required",
        requirements: [
          {
            id: "diagnosis",
            label: "Psoriasis Diagnosis",
            type: "required",
            description: "Documented psoriasis diagnosis",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      10: {
        label:
          "10% - At least 5% but less than 20% of entire body or exposed areas affected, OR intermittent systemic therapy less than 6 weeks in past 12 months",
        requirements: [
          {
            id: "diagnosis",
            label: "Psoriasis Diagnosis",
            type: "required",
            description: "Documented diagnosis",
          },
          {
            id: "body_area",
            label: "Affected Area",
            type: "required",
            description:
              "Documentation of 5-20% body/exposed area involvement OR intermittent systemic therapy",
          },
          {
            id: "photos",
            label: "Photographs",
            type: "recommended",
            description: "Photos during flare-ups",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      30: {
        label:
          "30% - 20-40% of entire body or exposed areas, OR systemic therapy 6+ weeks but not constant",
        requirements: [
          {
            id: "diagnosis",
            label: "Psoriasis Diagnosis",
            type: "required",
            description: "Documented diagnosis",
          },
          {
            id: "body_area",
            label: "Affected Area",
            type: "required",
            description:
              "Documentation of 20-40% involvement OR systemic therapy 6+ weeks",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      60: {
        label:
          "60% - More than 40% of entire body or exposed areas, OR constant/near-constant systemic therapy",
        requirements: [
          {
            id: "diagnosis",
            label: "Psoriasis Diagnosis",
            type: "required",
            description: "Documented diagnosis",
          },
          {
            id: "severe_involvement",
            label: "Severe Involvement",
            type: "required",
            description:
              "Documentation of >40% body involvement OR constant systemic therapy",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
    },
    tips: [
      "Same criteria as eczema - body percentage OR systemic therapy determines rating",
      "Biologic medications (Humira, Enbrel) count as systemic therapy",
      "Psoriatic arthritis rated separately under musculoskeletal",
      "Photograph during flare-ups - the condition fluctuates",
    ],
  },

  // Scars (DC 7804) - Per 38 CFR § 4.118
  scars_painful: {
    name: "Scars - Painful/Unstable",
    diagnosticCode: "7804",
    category: "Skin",
    cfr: "38 CFR § 4.118, DC 7804",
    ratings: {
      10: {
        label: "10% - One or two scars that are unstable or painful",
        requirements: [
          {
            id: "scars",
            label: "Scar Documentation",
            type: "required",
            description:
              "Documentation of 1-2 scars that are unstable (frequent loss of covering over scar) or painful",
          },
          {
            id: "examination",
            label: "Physical Examination",
            type: "required",
            description:
              "Examination documenting pain on palpation or instability",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service (surgical scars, trauma, etc.)",
          },
        ],
      },
      20: {
        label: "20% - Three or four scars that are unstable or painful",
        requirements: [
          {
            id: "scars",
            label: "Multiple Scars",
            type: "required",
            description: "Documentation of 3-4 unstable or painful scars",
          },
          {
            id: "examination",
            label: "Physical Examination",
            type: "required",
            description: "Examination documenting each scar",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      30: {
        label: "30% - Five or more scars that are unstable or painful",
        requirements: [
          {
            id: "scars",
            label: "Five+ Scars",
            type: "required",
            description: "Documentation of 5+ unstable or painful scars",
          },
          {
            id: "examination",
            label: "Physical Examination",
            type: "required",
            description: "Examination documenting each scar",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
    },
    tips: [
      "Each painful/unstable scar counts toward the total",
      "Unstable = frequent loss of covering of skin over scar",
      "Surgical scars from service-connected surgeries are ratable",
      "Can also rate under DC 7801-7805 for size/location if more beneficial",
    ],
  },

  // ============================================
  // GENITOURINARY SYSTEM (38 CFR § 4.115a/4.115b)
  // ============================================

  // Chronic Kidney Disease (DC 7502) - Per 38 CFR § 4.115b
  chronic_kidney_disease: {
    name: "Chronic Kidney Disease (CKD)",
    diagnosticCode: "7502",
    category: "Genitourinary",
    cfr: "38 CFR § 4.115b, DC 7502",
    ratings: {
      0: {
        label:
          "0% - Reduced kidney function with GFR 60-89 ml/min OR persistent albuminuria",
        requirements: [
          {
            id: "diagnosis",
            label: "CKD Diagnosis",
            type: "required",
            description: "Documented chronic kidney disease",
          },
          {
            id: "gfr",
            label: "GFR Testing",
            type: "required",
            description:
              "Lab work showing GFR 60-89 ml/min/1.73m² OR persistent albuminuria",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description:
              "Nexus to service (Agent Orange presumptive, or secondary to diabetes/hypertension)",
          },
        ],
      },
      30: {
        label: "30% - Persistent edema and albumin in urine, GFR 30-59 ml/min",
        requirements: [
          {
            id: "diagnosis",
            label: "CKD Diagnosis",
            type: "required",
            description: "Documented CKD Stage 3",
          },
          {
            id: "gfr",
            label: "GFR Testing",
            type: "required",
            description: "Lab work showing GFR 30-59 ml/min/1.73m²",
          },
          {
            id: "edema",
            label: "Edema Documentation",
            type: "required",
            description: "Clinical findings of persistent edema",
          },
          {
            id: "albuminuria",
            label: "Albuminuria",
            type: "required",
            description: "Persistent albumin in urine",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      60: {
        label:
          "60% - Pronounced edema, marked albumin, BUN 40-80 mg/dl or creatinine 4-10 mg/dl, GFR 15-29 ml/min",
        requirements: [
          {
            id: "diagnosis",
            label: "CKD Diagnosis",
            type: "required",
            description: "Documented CKD Stage 4",
          },
          {
            id: "gfr",
            label: "GFR Testing",
            type: "required",
            description: "Lab work showing GFR 15-29 ml/min/1.73m²",
          },
          {
            id: "labs",
            label: "Lab Values",
            type: "required",
            description: "BUN 40-80 mg/dl or creatinine 4-10 mg/dl",
          },
          {
            id: "edema",
            label: "Pronounced Edema",
            type: "required",
            description: "Documentation of pronounced edema",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      100: {
        label:
          "100% - Requiring regular dialysis or kidney transplant, OR GFR less than 15 ml/min",
        requirements: [
          {
            id: "diagnosis",
            label: "End-Stage Renal Disease",
            type: "required",
            description: "Documented ESRD/CKD Stage 5",
          },
          {
            id: "dialysis",
            label: "Dialysis or Transplant",
            type: "required",
            description:
              "Documentation of regular dialysis (hemodialysis or peritoneal) OR kidney transplant",
          },
          {
            id: "gfr",
            label: "GFR Less Than 15",
            type: "required",
            description: "Lab work showing GFR less than 15 ml/min/1.73m²",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
    },
    tips: [
      "CKD often secondary to service-connected diabetes or hypertension",
      "Get regular labs showing GFR, creatinine, BUN, and urinalysis",
      "Document ALL symptoms: fatigue, edema, nausea, poor appetite",
      "Agent Orange exposure may establish presumptive service connection",
    ],
  },

  // Erectile Dysfunction (DC 7522) - Per 38 CFR § 4.115b
  erectile_dysfunction: {
    name: "Erectile Dysfunction",
    diagnosticCode: "7522",
    category: "Genitourinary",
    cfr: "38 CFR § 4.115b, DC 7522",
    ratings: {
      0: {
        label: "0% - Deformity of penis with loss of normal function",
        requirements: [
          {
            id: "diagnosis",
            label: "ED Diagnosis",
            type: "required",
            description: "Documented erectile dysfunction diagnosis",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description:
              "Nexus to service (often secondary to diabetes, PTSD medications, spinal injury)",
          },
        ],
      },
    },
    tips: [
      "Most commonly rated as secondary to diabetes, PTSD, or medications for service-connected conditions",
      "Document all medications tried (Viagra, Cialis, etc.) and their effectiveness",
      "May also claim as secondary to spinal injury or nerve damage",
      "SMC(k) may be available if loss is due to service-connected injury",
    ],
  },

  // Urinary Frequency (DC 7542) - Per 38 CFR § 4.115b
  urinary_frequency: {
    name: "Urinary Frequency/Incontinence",
    diagnosticCode: "7542",
    category: "Genitourinary",
    cfr: "38 CFR § 4.115b, DC 7542",
    ratings: {
      10: {
        label:
          "10% - Daytime frequency - No more than once per hour, or occasional stress incontinence",
        requirements: [
          {
            id: "diagnosis",
            label: "Urinary Condition Diagnosis",
            type: "required",
            description:
              "Documented diagnosis of urinary frequency or incontinence",
          },
          {
            id: "frequency",
            label: "Frequency Documentation",
            type: "required",
            description:
              "Medical records showing daytime frequency no more than once per hour, or occasional stress incontinence",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description:
              "Nexus to service (often secondary to diabetes, prostate issues, spinal injury)",
          },
        ],
      },
      20: {
        label:
          "20% - Daytime frequency - More than once per hour, or episodes of incontinence requiring use of absorbent materials",
        requirements: [
          {
            id: "diagnosis",
            label: "Urinary Condition Diagnosis",
            type: "required",
            description: "Documented diagnosis",
          },
          {
            id: "frequency_severe",
            label: "Severe Frequency",
            type: "required",
            description:
              "Documentation of daytime frequency more than once per hour",
          },
          {
            id: "incontinence",
            label: "Incontinence Episodes",
            type: "required",
            description:
              "Evidence of incontinence requiring absorbent materials (pads, diapers)",
          },
          {
            id: "diary",
            label: "Voiding Diary",
            type: "recommended",
            description: "Voiding diary documenting frequency and episodes",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      40: {
        label:
          "40% - Requiring the use of an appliance or constant absorbent materials",
        requirements: [
          {
            id: "diagnosis",
            label: "Urinary Condition Diagnosis",
            type: "required",
            description: "Documented diagnosis",
          },
          {
            id: "appliance",
            label: "Appliance/Constant Protection",
            type: "required",
            description:
              "Documentation of requirement for urinary appliance (catheter, external collection device) OR constant use of absorbent materials",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      60: {
        label:
          "60% - Requiring the use of an appliance with complications (such as frequent episodes of urinary tract infection)",
        requirements: [
          {
            id: "diagnosis",
            label: "Urinary Condition Diagnosis",
            type: "required",
            description: "Documented diagnosis",
          },
          {
            id: "appliance",
            label: "Appliance Use",
            type: "required",
            description: "Documentation of urinary appliance use",
          },
          {
            id: "complications",
            label: "Frequent Complications",
            type: "required",
            description:
              "Medical records showing frequent UTIs, urosepsis, or other complications requiring hospitalization or antibiotic therapy",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
    },
    tips: [
      "Keep a voiding diary documenting times and urgency",
      "Document all pads/diapers purchased - receipts help prove constant use",
      "Often secondary to diabetes, prostate conditions, or spinal injuries",
      "UTI history strengthens claim for higher ratings",
    ],
  },

  // ============================================
  // EYE CONDITIONS (38 CFR § 4.79)
  // ============================================

  // Dry Eye Syndrome (DC 6025) - Per 38 CFR § 4.79
  dry_eye: {
    name: "Dry Eye Syndrome",
    diagnosticCode: "6025",
    category: "Eye",
    cfr: "38 CFR § 4.79, DC 6025",
    ratings: {
      10: {
        label:
          "10% - Episodic dry eye requiring only occasional use of lubricants",
        requirements: [
          {
            id: "diagnosis",
            label: "Dry Eye Diagnosis",
            type: "required",
            description: "Documented diagnosis of dry eye syndrome",
          },
          {
            id: "treatment",
            label: "Treatment Documentation",
            type: "required",
            description: "Records of lubricant eye drop use",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description:
              "Nexus to service (dust exposure, desert deployment, LASIK in service)",
          },
        ],
      },
      20: {
        label: "20% - Chronic dry eye requiring frequent use of lubricants",
        requirements: [
          {
            id: "diagnosis",
            label: "Dry Eye Diagnosis",
            type: "required",
            description: "Documented chronic dry eye",
          },
          {
            id: "frequent_treatment",
            label: "Frequent Treatment",
            type: "required",
            description: "Evidence of frequent/daily lubricant use",
          },
          {
            id: "ophthalmology",
            label: "Specialist Records",
            type: "recommended",
            description: "Ophthalmology records documenting severity",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      30: {
        label: "30% - Severe dry eye with visual impairment from complications",
        requirements: [
          {
            id: "diagnosis",
            label: "Dry Eye Diagnosis",
            type: "required",
            description: "Documented severe dry eye",
          },
          {
            id: "complications",
            label: "Complications",
            type: "required",
            description:
              "Evidence of visual impairment or corneal complications",
          },
          {
            id: "visual_acuity",
            label: "Visual Acuity Testing",
            type: "required",
            description: "Documentation of visual impairment",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
    },
    tips: [
      "Common condition for desert deployment veterans",
      "LASIK surgery during service can cause dry eye",
      "Document ALL eye drops used and frequency",
      "Can be secondary to Sjögren syndrome or medications",
    ],
  },

  // ============================================
  // DENTAL & ORAL CONDITIONS (38 CFR § 4.150)
  // ============================================

  // Temporomandibular Joint (TMJ) Disorder (DC 9905) - Per 38 CFR § 4.150
  tmj: {
    name: "Temporomandibular Joint (TMJ) Disorder",
    diagnosticCode: "9905",
    category: "Dental/Oral",
    cfr: "38 CFR § 4.150, DC 9905",
    ratings: {
      10: {
        label: "10% - Limited motion with pain on both sides",
        requirements: [
          {
            id: "diagnosis",
            label: "TMJ Disorder Diagnosis",
            type: "required",
            description: "Documented TMJ disorder or TMD",
          },
          {
            id: "rom",
            label: "Limited Motion",
            type: "required",
            description:
              "Examination showing limited jaw motion (interincisal opening 30-40 mm) with pain on both sides",
          },
          {
            id: "pain",
            label: "Pain Documentation",
            type: "required",
            description: "Medical records documenting bilateral jaw pain",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description:
              "Nexus to service (dental work in service, trauma, or secondary to PTSD/bruxism)",
          },
        ],
      },
      20: {
        label: "20% - Interincisal opening 20-30 mm",
        requirements: [
          {
            id: "diagnosis",
            label: "TMJ Disorder Diagnosis",
            type: "required",
            description: "Documented TMJ disorder",
          },
          {
            id: "rom_moderate",
            label: "Moderate Limitation",
            type: "required",
            description: "Examination showing interincisal opening of 20-30 mm",
          },
          {
            id: "imaging",
            label: "Imaging Studies",
            type: "recommended",
            description: "MRI or X-ray showing TMJ abnormalities",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      30: {
        label: "30% - Interincisal opening 15-20 mm",
        requirements: [
          {
            id: "diagnosis",
            label: "TMJ Disorder Diagnosis",
            type: "required",
            description: "Documented TMJ disorder",
          },
          {
            id: "rom_severe",
            label: "Severe Limitation",
            type: "required",
            description: "Examination showing interincisal opening of 15-20 mm",
          },
          {
            id: "diet",
            label: "Dietary Impact",
            type: "recommended",
            description: "Documentation of inability to eat certain foods",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      40: {
        label: "40% - Interincisal opening less than 15 mm",
        requirements: [
          {
            id: "diagnosis",
            label: "TMJ Disorder Diagnosis",
            type: "required",
            description: "Documented TMJ disorder",
          },
          {
            id: "rom_severe",
            label: "Very Severe Limitation",
            type: "required",
            description:
              "Examination showing interincisal opening less than 15 mm",
          },
          {
            id: "functional",
            label: "Functional Impact",
            type: "required",
            description:
              "Documentation of severe functional impact on eating, speaking, dental hygiene",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      50: {
        label: "50% - Interincisal opening less than 10 mm OR ankylosis",
        requirements: [
          {
            id: "diagnosis",
            label: "TMJ Disorder Diagnosis",
            type: "required",
            description: "Documented severe TMJ disorder",
          },
          {
            id: "ankylosis",
            label: "Ankylosis or Extreme Limitation",
            type: "required",
            description:
              "Examination showing interincisal opening less than 10 mm OR evidence of ankylosis",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
    },
    tips: [
      "Normal interincisal opening is 40-50 mm (measured between front teeth)",
      "Often secondary to PTSD (teeth grinding/bruxism)",
      "Get measured during C&P exam with calipers",
      "Document all treatments tried: night guard, physical therapy, medications",
    ],
  },

  // ============================================
  // HEMIC & LYMPHATIC SYSTEM (38 CFR § 4.117)
  // ============================================

  // Anemia (DC 7700-7716) - Per 38 CFR § 4.117
  anemia: {
    name: "Anemia",
    diagnosticCode: "7700-7716",
    category: "Hemic/Lymphatic",
    cfr: "38 CFR § 4.117, DC 7700-7716",
    ratings: {
      0: {
        label: "0% - Hemoglobin 10 g/100 ml or higher with symptoms",
        requirements: [
          {
            id: "diagnosis",
            label: "Anemia Diagnosis",
            type: "required",
            description: "Documented diagnosis of anemia",
          },
          {
            id: "lab",
            label: "Lab Results",
            type: "required",
            description: "Lab work showing hemoglobin 10 g/100ml or higher",
          },
          {
            id: "symptoms",
            label: "Symptom Documentation",
            type: "required",
            description:
              "Documentation of symptoms (fatigue, weakness, dyspnea)",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description:
              "Nexus to service (often secondary to GI bleeding, CKD, or medications)",
          },
        ],
      },
      10: {
        label: "10% - Hemoglobin 9-10 g/100 ml with symptoms",
        requirements: [
          {
            id: "diagnosis",
            label: "Anemia Diagnosis",
            type: "required",
            description: "Documented anemia",
          },
          {
            id: "lab",
            label: "Lab Results",
            type: "required",
            description: "Lab work showing hemoglobin 9-10 g/100ml",
          },
          {
            id: "symptoms",
            label: "Symptom Documentation",
            type: "required",
            description: "Documentation of anemia symptoms",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      30: {
        label: "30% - Hemoglobin 7-9 g/100 ml with symptoms",
        requirements: [
          {
            id: "diagnosis",
            label: "Anemia Diagnosis",
            type: "required",
            description: "Documented anemia",
          },
          {
            id: "lab",
            label: "Lab Results",
            type: "required",
            description: "Lab work showing hemoglobin 7-9 g/100ml",
          },
          {
            id: "moderate_symptoms",
            label: "Moderate Symptoms",
            type: "required",
            description:
              "Documentation of moderate symptoms requiring treatment",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      70: {
        label: "70% - Hemoglobin 5-7 g/100 ml requiring transfusions",
        requirements: [
          {
            id: "diagnosis",
            label: "Severe Anemia Diagnosis",
            type: "required",
            description: "Documented severe anemia",
          },
          {
            id: "lab",
            label: "Lab Results",
            type: "required",
            description: "Lab work showing hemoglobin 5-7 g/100ml",
          },
          {
            id: "transfusions",
            label: "Transfusion Requirement",
            type: "required",
            description:
              "Documentation of requirement for periodic transfusions",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      100: {
        label:
          "100% - Hemoglobin less than 5 g/100 ml, requiring hospitalization or frequent transfusions",
        requirements: [
          {
            id: "diagnosis",
            label: "Life-Threatening Anemia",
            type: "required",
            description: "Documented life-threatening anemia",
          },
          {
            id: "lab",
            label: "Critically Low Labs",
            type: "required",
            description: "Lab work showing hemoglobin less than 5 g/100ml",
          },
          {
            id: "hospitalizations",
            label: "Hospitalizations",
            type: "required",
            description:
              "Documentation of hospitalizations or frequent transfusions",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
    },
    tips: [
      "Anemia is often secondary to GI bleeding (ulcers, GERD), CKD, or medications",
      "Get regular CBC (Complete Blood Count) labs",
      "Document fatigue, dizziness, shortness of breath",
      "Iron, B12, and folate levels help determine cause",
    ],
  },

  // ============================================
  // GYNECOLOGICAL CONDITIONS (38 CFR § 4.116)
  // ============================================

  // Endometriosis (DC 7629) - Per 38 CFR § 4.116
  endometriosis: {
    name: "Endometriosis",
    diagnosticCode: "7629",
    category: "Gynecological",
    cfr: "38 CFR § 4.116, DC 7629",
    ratings: {
      10: {
        label:
          "10% - Pelvic pain without menstrual cyclicity requiring continuous treatment",
        requirements: [
          {
            id: "diagnosis",
            label: "Endometriosis Diagnosis",
            type: "required",
            description:
              "Documented diagnosis of endometriosis (often via laparoscopy)",
          },
          {
            id: "pain",
            label: "Chronic Pelvic Pain",
            type: "required",
            description:
              "Documentation of pelvic pain without menstrual cyclicity",
          },
          {
            id: "treatment",
            label: "Continuous Treatment",
            type: "required",
            description: "Evidence of continuous treatment requirement",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      30: {
        label:
          "30% - Pelvic pain with menstrual cyclicity confirmed by laparoscopy",
        requirements: [
          {
            id: "diagnosis",
            label: "Endometriosis Diagnosis",
            type: "required",
            description: "Laparoscopically confirmed endometriosis",
          },
          {
            id: "pain_cyclical",
            label: "Cyclical Pelvic Pain",
            type: "required",
            description:
              "Documentation of pelvic pain with menstrual cyclicity",
          },
          {
            id: "laparoscopy",
            label: "Laparoscopy Report",
            type: "required",
            description: "Surgical report confirming endometriosis",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
      50: {
        label:
          "50% - Lesions involving bowel or bladder confirmed by laparoscopy",
        requirements: [
          {
            id: "diagnosis",
            label: "Endometriosis Diagnosis",
            type: "required",
            description: "Documented severe endometriosis",
          },
          {
            id: "organ_involvement",
            label: "Bowel/Bladder Involvement",
            type: "required",
            description:
              "Laparoscopy confirming lesions involving bowel or bladder",
          },
          {
            id: "functional_impact",
            label: "Functional Impact",
            type: "required",
            description: "Documentation of urinary or bowel dysfunction",
          },
          {
            id: "nexus",
            label: "Service Connection",
            type: "required",
            description: "Nexus to service",
          },
        ],
      },
    },
    tips: [
      "Diagnosis typically requires laparoscopy",
      "Document all menstrual symptoms, pain patterns, treatments tried",
      "Can cause infertility - document if applicable",
      "May be rated higher if bowel/bladder involvement present",
    ],
  },
};

/**
 * Get all available conditions with their basic info
 */
export const getAvailableConditions = () => {
  return Object.entries(EVIDENCE_REQUIREMENTS).map(([key, data]) => ({
    id: key,
    name: data.name,
    diagnosticCode: data.diagnosticCode,
    category: data.category,
    cfr: data.cfr,
    availableRatings: Object.keys(data.ratings).map((r) => parseInt(r)),
  }));
};

/**
 * Get requirements for a specific condition and rating
 */
export const getRequirements = (conditionId, targetRating) => {
  const condition = EVIDENCE_REQUIREMENTS[conditionId];
  if (!condition) return null;

  const rating = condition.ratings[targetRating];
  if (!rating) return null;

  return {
    condition: condition.name,
    diagnosticCode: condition.diagnosticCode,
    cfr: condition.cfr,
    targetRating,
    ratingLabel: rating.label,
    requirements: rating.requirements,
    tips: condition.tips,
  };
};

/**
 * Analyze evidence against requirements
 * @param {string} conditionId - The condition ID
 * @param {number} targetRating - Target rating percentage
 * @param {Array} userEvidence - Array of evidence IDs the user has
 * @returns {Object} - Analysis result with gaps and completeness
 */
export const analyzeEvidenceGaps = (
  conditionId,
  targetRating,
  userEvidence = [],
) => {
  const requirements = getRequirements(conditionId, targetRating);
  if (!requirements) return null;

  const evidenceSet = new Set(userEvidence);

  const analysis = requirements.requirements.map((req) => ({
    ...req,
    status: evidenceSet.has(req.id) ? "found" : "missing",
    isCritical: req.type === "required" && !evidenceSet.has(req.id),
  }));

  const requiredCount = requirements.requirements.filter(
    (r) => r.type === "required",
  ).length;
  const requiredFoundCount = analysis.filter(
    (a) => a.type === "required" && a.status === "found",
  ).length;
  const completenessPercent =
    requiredCount > 0
      ? Math.round((requiredFoundCount / requiredCount) * 100)
      : 0;

  const criticalGaps = analysis.filter((a) => a.isCritical);
  const recommendations = analysis.filter(
    (a) => a.type === "recommended" && a.status === "missing",
  );

  return {
    ...requirements,
    analysis,
    completenessPercent,
    criticalGaps,
    recommendations,
    isClaimReady: criticalGaps.length === 0,
  };
};

/**
 * Get conditions by category
 */
export const getConditionsByCategory = () => {
  const categories = {};

  Object.entries(EVIDENCE_REQUIREMENTS).forEach(([key, data]) => {
    if (!categories[data.category]) {
      categories[data.category] = [];
    }
    categories[data.category].push({
      id: key,
      name: data.name,
      diagnosticCode: data.diagnosticCode,
    });
  });

  return categories;
};

export default EVIDENCE_REQUIREMENTS;
