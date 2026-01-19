/**
 * UserManual.jsx - Integrated User Manual for Vet-Rate.org
 * Comprehensive documentation accessible within the web application
 */

import React, { useState, useEffect } from 'react';
import { resetTourState } from './BootCampTour';

// Navigation structure matching the docs - organized by category
const navigationStructure = [
  {
    id: 'home',
    title: 'Home',
    icon: '🏠',
  },
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: '🚀',
    children: [
      { id: 'first-visit', title: 'Your First Visit' },
      { id: 'interface-overview', title: 'Interface Overview' },
      { id: 'accessibility', title: 'Accessibility' },
    ],
  },
  {
    id: 'search',
    title: 'Search & Explore',
    icon: '🔍',
    children: [
      { id: 'how-to-search', title: 'How to Search' },
      { id: 'search-results', title: 'Search Results' },
      { id: 'disability-details', title: 'Disability Details' },
      { id: 'rating-criteria', title: 'Rating Criteria' },
    ],
  },
  // === CALCULATE YOUR RATING ===
  {
    id: 'category-calculate',
    title: '📊 Calculate',
    isCategory: true,
  },
  {
    id: 'tactical-calculator',
    title: 'Tactical Calculator',
    icon: '🧮',
    children: [
      { id: 'calc-overview', title: 'How VA Math Works' },
      { id: 'calc-bilateral', title: 'Bilateral Factor' },
      { id: 'calc-dependents', title: 'Dependent Benefits' },
      { id: 'calc-what-if', title: 'What-If Scenarios' },
    ],
  },
  // === DISCOVER YOUR CLAIMS ===
  {
    id: 'category-discover',
    title: '🔍 Discover',
    isCategory: true,
  },
  {
    id: 'secondary-scout',
    title: 'Secondary Scout',
    icon: '🔬',
    children: [
      { id: 'scout-launching', title: 'Launching Scout' },
      { id: 'scout-results', title: 'Understanding Results' },
      { id: 'scout-add-to-packet', title: 'Add to Packet' },
    ],
  },
  {
    id: 'cap-simulator',
    title: 'C&P Exam Simulator',
    icon: '🎯',
    children: [
      { id: 'simulator-getting-started', title: 'Getting Started' },
      { id: 'condition-selection', title: 'Condition Selection' },
      { id: 'taking-simulation', title: 'Taking the Simulation' },
      { id: 'simulator-results', title: 'Results & Feedback' },
      { id: 'flashcards', title: 'Flashcard Mode' },
    ],
  },
  {
    id: 'pathfinder',
    title: 'Pathfinder',
    icon: '🧭',
  },
  // === BUILD YOUR EVIDENCE ===
  {
    id: 'category-evidence',
    title: '📋 Build Evidence',
    isCategory: true,
  },
  {
    id: 'cfile-analyzer',
    title: 'C-File AI Analyzer',
    icon: '🔎',
    children: [
      { id: 'cfile-what-is', title: 'What is a C-File?' },
      { id: 'cfile-upload', title: 'Uploading Records' },
      { id: 'cfile-analysis', title: 'Understanding Results' },
    ],
  },
  {
    id: 'blue-button',
    title: 'Blue Button X-Ray',
    icon: '💙',
    children: [
      { id: 'blue-overview', title: 'What Is Blue Button?' },
      { id: 'blue-extract', title: 'Extracting Evidence' },
    ],
  },
  {
    id: 'witness-bench',
    title: 'Witness Bench',
    icon: '👥',
    children: [
      { id: 'witness-overview', title: 'Buddy Statements' },
      { id: 'witness-interview', title: 'The Interview' },
      { id: 'witness-output', title: 'Statement Output' },
    ],
  },
  {
    id: 'nexus-builder',
    title: 'Nexus Builder',
    icon: '🔗',
    children: [
      { id: 'what-is-nexus', title: 'What is a Nexus?' },
      { id: 'building-statement', title: 'Building Your Statement' },
      { id: 'doctor-cheat-sheet', title: "Doctor's Cheat Sheet" },
      { id: 'download-options', title: 'Download Options' },
    ],
  },
  {
    id: 'forms-helper',
    title: 'Forms Helper',
    icon: '📋',
    children: [
      { id: 'available-forms', title: 'Available Forms' },
      { id: 'buddy-statements', title: 'Buddy Statements' },
      { id: 'intent-to-file', title: 'Intent to File' },
      { id: 'ptsd-stressor', title: 'PTSD Stressor' },
      { id: 'veteran-profile', title: 'Veteran Profile' },
    ],
  },
  // === QUALITY CONTROL ===
  {
    id: 'category-qc',
    title: '🎯 Quality Control',
    isCategory: true,
  },
  {
    id: 'red-team',
    title: 'Red Team Simulator',
    icon: '🎭',
    children: [
      { id: 'red-overview', title: 'What is Red Team?' },
      { id: 'red-analysis', title: 'Weakness Analysis' },
    ],
  },
  {
    id: 'decision-decoder',
    title: 'Decision Decoder',
    icon: '📜',
    children: [
      { id: 'decoder-overview', title: 'Overview' },
      { id: 'decoder-upload', title: 'Upload Decision' },
      { id: 'decoder-appeal', title: 'Appeal Options' },
    ],
  },
  {
    id: 'shark-radar',
    title: 'Shark Radar',
    icon: '🦈',
  },
  // === ADVANCED STRATEGY ===
  {
    id: 'category-advanced',
    title: '⚡ Advanced Strategy',
    isCategory: true,
  },
  {
    id: 'tdiu-builder',
    title: 'TDIU Builder',
    icon: '💼',
    children: [
      { id: 'tdiu-overview', title: 'What is TDIU?' },
      { id: 'tdiu-eligibility', title: 'Eligibility Check' },
    ],
  },
  {
    id: 'risk-assessment',
    title: 'Risk Assessment',
    icon: '⚠️',
  },
  {
    id: 'symptom-logger',
    title: 'Symptom Logger',
    icon: '📊',
    children: [
      { id: 'symptom-overview', title: 'Why Track Symptoms?' },
      { id: 'symptom-logging', title: 'Logging Symptoms' },
      { id: 'symptom-reports', title: 'Reports & Export' },
    ],
  },
  {
    id: 'pact-act',
    title: 'PACT Act Navigator',
    icon: '☢️',
    children: [
      { id: 'pact-overview', title: 'What is PACT Act?' },
      { id: 'pact-conditions', title: 'Covered Conditions' },
      { id: 'pact-locations', title: 'Covered Locations' },
    ],
  },
  {
    id: 'foia-generator',
    title: 'FOIA Keysmith',
    icon: '🔑',
  },
  // === SHOCK & AWE ===
  {
    id: 'category-shock',
    title: '💎 Shock & Awe',
    isCategory: true,
  },
  {
    id: 'million-dollar',
    title: 'Million Dollar Dashboard',
    icon: '💰',
  },
  {
    id: 'mos-matcher',
    title: 'MOS Hazard Matcher',
    icon: '🎖️',
  },
  {
    id: 'web-conditions',
    title: 'Web of Conditions',
    icon: '🕸️',
  },
  // === SUPPORT & RESOURCES ===
  {
    id: 'category-support',
    title: '🤝 Support',
    isCategory: true,
  },
  {
    id: 'vso-finder',
    title: 'VSO Finder',
    icon: '🏢',
  },
  {
    id: 'state-benefits',
    title: 'State Benefit Hunter',
    icon: '💵',
  },
  // === DATA MANAGEMENT ===
  {
    id: 'category-data',
    title: '📁 Data & Settings',
    isCategory: true,
  },
  {
    id: 'my-packet',
    title: 'My Packet',
    icon: '📁',
    children: [
      { id: 'managing-claims', title: 'Managing Claims' },
      { id: 'saved-forms', title: 'Saved Forms' },
      { id: 'backup-restore', title: 'Backup & Restore' },
      { id: 'exporting-data', title: 'Exporting Data' },
    ],
  },
  {
    id: 'va-resources',
    title: 'VA Resources',
    icon: '🏛️',
    children: [
      { id: 'online-portals', title: 'Online Portals' },
      { id: 'phone-numbers', title: 'Phone Numbers' },
      { id: 'external-resources', title: 'External Resources' },
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    icon: '⚙️',
    children: [
      { id: 'display-mode', title: 'Display Mode' },
      { id: 'accessibility-options', title: 'Accessibility Options' },
      { id: 'data-management', title: 'Data Management' },
    ],
  },
  {
    id: 'reference',
    title: 'Reference',
    icon: '📖',
    children: [
      { id: 'glossary', title: 'Glossary' },
      { id: 'cfr-reference', title: 'CFR Reference' },
      { id: 'keyboard-shortcuts', title: 'Keyboard Shortcuts' },
    ],
  },
  {
    id: 'faq',
    title: 'FAQ',
    icon: '❓',
  },
];

// Documentation content - organized by section ID
const documentationContent = {
  home: {
    title: 'Vet-Rate.org User Manual',
    content: `
Welcome to the comprehensive user manual for **Vet-Rate.org** - your complete VA claims toolkit with **40+ powerful tools**.

## About This Manual

This manual covers every feature and function of the Vet-Rate.org platform, designed to help you:

- **Search & understand** 751 VA disability conditions
- **Discover secondary conditions** linked to your service-connected disabilities
- **Calculate combined ratings** with the Tactical Calculator
- **Prepare for C&P exams** with our simulator and Exam Prep Room
- **Analyze your C-File** with AI assistance
- **Build nexus statements** to support your claims
- **Complete VA forms** with guided assistance
- **Organize your claims packet** in one place
- **Find free VSO help** and avoid claim sharks
- **Track regulatory changes** with Legislative Watchdog
- **Stress test your claim** before submission

## All 40+ Tools

### Core Intelligence Tools
| Tool | What It Does |
|------|--------------|
| **Smart Search** | Find any of 751 rated disabilities |
| **PACT Act Navigator** | Identify toxic exposure presumptive conditions |
| **Web of Conditions** | Interactive visualization of connected disabilities |
| **Legislative Watchdog** | Track Federal Register changes affecting veterans |
| **VA Resources Hub** | Direct access to official VA programs |
| **User Manual** | Complete documentation for all features |

### Rating & Benefits Calculators
| Tool | What It Does |
|------|--------------|
| **Tactical Calculator** | Combined ratings with bilateral factors & 2026 pay rates |
| **Million Dollar Dashboard** | Lifetime benefit value & retirement projections |
| **TDIU Builder** | Total Disability Individual Unemployability evaluation |
| **State Benefit Hunter** | Discover state-level veteran benefits |

### Discovery & Research Tools
| Tool | What It Does |
|------|--------------|
| **Secondary Scout** | 500+ medically-recognized secondary conditions |
| **MOS Hazard Matcher** | Link military jobs to exposures and conditions |
| **Pathfinder** | Strategic roadmap from claim to appeal |
| **Risk Assessment** | Identify claim weaknesses before filing |
| **What-If Sandbox** | Model rating scenarios and strategic options |

### Evidence Building Suite
| Tool | What It Does |
|------|--------------|
| **C&P Exam Simulator** | DBQ-aligned practice with percentage predictions |
| **Exam Prep Room** | DBQ preview and examiner question preparation |
| **Nexus Builder** | Medical nexus statements with AI enhancement |
| **Forms Helper** | 16+ VA forms including buddy & PTSD stressor statements |
| **Witness Bench** | AI-powered buddy statement wizard |
| **Symptom Logger** | Track daily symptoms for documentation |
| **Somatic Target** | Interactive body map for pain documentation |
| **Continuity Thread** | Evidence timeline with gap detection |
| **FOIA Keysmith** | Generate records requests for military documents |

### Advanced Analysis
| Tool | What It Does |
|------|--------------|
| **C-File AI Analyzer** | Find evidence in thousands of pages |
| **Decision Decoder** | AI analysis of VA letters for appeal opportunities |
| **Denial Decoder** | OCR scan denial letters to find appeal angles |
| **Blue Button X-Ray** | Extract claim-relevant evidence from medical records |
| **PDF Evidence Finder** | Keyword search across uploaded documents |
| **Red Team Simulator** | Simulate VA examiner review to find weaknesses |

### Battle Labs
| Tool | What It Does |
|------|--------------|
| **The Tribunal** | Mock BVA hearing simulation |
| **Consistency Engine** | Detect contradictions across your evidence |
| **War Game** | Adversarial claim stress testing |
| **Time Machine** | Intent to File deadline countdown tracker |

### Protection & Support
| Tool | What It Does |
|------|--------------|
| **VSO Finder** | Locate accredited Veterans Service Officers |
| **Shark Radar** | Identify predatory claim services |
| **Mission Protocol** | Guided onboarding with mission objectives |

### Data Management
| Tool | What It Does |
|------|--------------|
| **My Packet** | Save and manage all claims evidence |
| **The Bunker** | Export/import your complete data backup |
| **Cloud Sync** | Google Drive backup integration |
| **PDF Reports** | Download comprehensive condition guides |

## Important Notice

> **🆘 Veterans Crisis Line:** Call 988, Press 1 | Text 838255 | Available 24/7

This tool is for **educational purposes only**. It is not affiliated with the VA and does not constitute legal or medical advice.

## Your Privacy

All data stays in your browser. We don't collect, store, or transmit any personal information.
    `,
  },

  'getting-started': {
    title: 'Getting Started',
    content: `
Get up and running with Vet-Rate.org in minutes.

## What You'll Learn

- How to navigate the interface
- Understanding your first search
- Setting up accessibility options
- Making the most of each feature

## Before You Begin

**No account needed!** Vet-Rate.org works entirely in your browser. Your data stays on your device.

## Recommended First Steps

1. **Acknowledge the disclaimer** - Understand this is an educational tool
2. **Search for a condition** - Try your primary service-connected disability
3. **Explore Secondary Scout** - Discover potential secondary claims
4. **Try the C&P Simulator** - Prepare for your exam
5. **Check Settings** - Adjust display and accessibility options
    `,
  },

  'first-visit': {
    title: 'Your First Visit',
    content: `
Here's what to expect when you first visit Vet-Rate.org.

## Interactive Tour

First-time visitors automatically see an **interactive tour** that highlights the key features:
- Where to search
- How to add conditions
- Where your saved data lives

**Want to see the tour again?** Click the button below.

<tour-restart-button></tour-restart-button>

## The Disclaimer

On your first visit, you'll see a disclaimer explaining:
- This is an educational tool
- Not affiliated with the VA
- Not legal or medical advice

Click **"I Understand"** to continue.

## Try Demo Data

New and want to see what a complete claim looks like? Use the **"Load Example Data"** link on the main dashboard to load a sample veteran's packet with:
- Pre-written personal statements
- Evidence timeline
- Secondary conditions

This shows you the "gold standard" before you start your own.

## The Main Interface

After acknowledging the disclaimer, you'll see:

1. **Header** - Navigation to main features
2. **Search Bar** - Search 751 disabilities
3. **Feature Cards** - Quick access to tools
4. **Footer** - Links to policies and support

## Try Your First Search

1. Click the search bar
2. Type a condition name (e.g., "PTSD", "sleep apnea", "tinnitus")
3. Press Enter or click a result
4. View detailed rating criteria

## Next Steps

- Explore the disability details
- Try Secondary Scout for linked conditions
- Practice with the C&P Simulator
    `,
  },

  'interface-overview': {
    title: 'Interface Overview',
    content: `
Learn your way around the Vet-Rate.org interface.

## Header Navigation

| Button | Function |
|--------|----------|
| **Secondary Scout** | Find linked conditions |
| **C&P Simulator** | Practice for exams |
| **My Packet** | View saved claims |
| **VA Resources** | Official VA links |
| **Forms Helper** | VA form assistance |

## Main Content Area

- **Search Bar** - Central search functionality
- **Feature Cards** - Quick-launch tools
- **Search Results** - Condition cards with key info

## Footer

- Privacy Policy
- About Us
- Contact Us
- Bug Report

## Accessibility Menu

Click the **☰** icon in the header for:
- Dark/Light mode toggle
- Color blind modes
- Font size adjustment
- Reduced motion option
    `,
  },

  accessibility: {
    title: 'Accessibility',
    content: `
Vet-Rate.org is designed to be accessible to all veterans.

## Visual Options

### Dark Mode
Reduces eye strain in low-light conditions.

### Color Blind Modes
- **Protanopia** - Red-blind friendly
- **Deuteranopia** - Green-blind friendly  
- **Tritanopia** - Blue-blind friendly
- **High Contrast** - Maximum visibility

### Font Size
Adjustable from small to extra-large.

### Reduced Motion
Disables animations for vestibular sensitivities.

## Keyboard Navigation

- **Tab** - Move between elements
- **Enter** - Activate buttons/links
- **Escape** - Close modals
- **/** - Focus search bar

## Screen Reader Support

- Proper heading hierarchy
- ARIA labels on interactive elements
- Live regions for dynamic content
    `,
  },

  search: {
    title: 'Search & Explore',
    content: `
Master the search functionality to find any VA disability condition.

## What You Can Search

- **751 disabilities** from 38 CFR Part 4
- **Condition names** (e.g., "PTSD", "tinnitus")
- **Diagnostic codes** (e.g., "9411", "6260")
- **Keywords** (e.g., "knee", "back", "anxiety")

## Search Features

- **Instant results** - As you type
- **Fuzzy matching** - Handles typos
- **All body systems** - Complete coverage

## From Search Results

- View rating criteria
- See related conditions
- Launch Secondary Scout
- Add to My Packet
    `,
  },

  'how-to-search': {
    title: 'How to Search',
    content: `
Find exactly what you're looking for.

## Basic Search

1. Click the search bar (or press **/**)
2. Type your search term
3. Results appear automatically

## Search Tips

| Search Type | Example |
|-------------|---------|
| Condition name | "sleep apnea" |
| Diagnostic code | "6847" |
| Body part | "knee" |
| Symptom | "pain" |

## Advanced Tips

- **Partial matches work** - "anx" finds anxiety
- **Case insensitive** - "PTSD" = "ptsd"
- **Multiple words** - "sleep apnea" searches for both
    `,
  },

  'search-results': {
    title: 'Search Results',
    content: `
Understanding your search results.

## Result Cards

Each card shows:
- **Condition name**
- **Diagnostic code**
- **Rating range** (e.g., 0-100%)
- **Body system**

## Actions

- **Click card** - View full details
- **View criteria** - See rating percentages
- **Launch Scout** - Find secondary conditions

## No Results?

Try:
- Different spelling
- Medical terminology
- Related terms
- Diagnostic code directly
    `,
  },

  'disability-details': {
    title: 'Disability Details',
    content: `
Deep dive into any disability condition.

## Information Displayed

- **Official name** and aliases
- **Diagnostic code** from 38 CFR
- **Rating percentages** with criteria
- **Documentation requirements**
- **Related secondary conditions**

## Rating Criteria

Shows each rating level (0%, 10%, 20%, etc.) with:
- Exact criteria required
- Special notes
- DeLuca factors (if applicable)

## Actions Available

- **Build Nexus Statement**
- **Launch Secondary Scout**
- **Add to My Packet**
- **View CFR Reference**
    `,
  },

  'rating-criteria': {
    title: 'Rating Criteria',
    content: `
Understanding VA rating criteria.

## How Ratings Work

The VA assigns percentage ratings (0-100%) based on how your condition affects you:

| Rating | Typical Impact |
|--------|----------------|
| 0% | Diagnosed, minimal impact |
| 10-20% | Mild functional limitation |
| 30-40% | Moderate impairment |
| 50-70% | Significant disability |
| 100% | Total disability |

## Reading the Criteria

Each rating level lists specific requirements. You must meet the criteria for that level.

## VA Math

Combined ratings use VA math (not simple addition):
- 50% + 30% ≠ 80%
- 50% + 30% = 65% (rounds to 70%)

Formula: Combined = A + B × (1 - A)
    `,
  },

  'secondary-scout': {
    title: 'Secondary Scout',
    content: `
Discover secondary conditions linked to your service-connected disabilities.

## What Are Secondary Conditions?

Conditions caused or aggravated by your service-connected disabilities under 38 CFR § 3.310.

## How Secondary Scout Works

1. Enter your service-connected conditions
2. Scout searches the nexus database
3. View potential secondary claims
4. Learn about the medical connection

## Why It Matters

Secondary conditions can significantly increase your combined rating without proving direct service connection.
    `,
  },

  'scout-launching': {
    title: 'Launching Secondary Scout',
    content: `
Start finding your secondary conditions.

## How to Launch

1. Click **"Secondary Scout"** in the header
2. Or click **"Launch Secondary Scout"** on the home page

## Adding Conditions

1. Search for your service-connected conditions
2. Click to add each one
3. Click **"Launch Scout"** when ready

## Tips

- Add ALL your service-connected conditions
- Include conditions rated at 0%
- The more you add, the more connections found
    `,
  },

  'scout-results': {
    title: 'Understanding Scout Results',
    content: `
Make sense of your Secondary Scout findings.

## Result Categories

- **High Connection** - Strong medical link
- **Moderate Connection** - Established link
- **Possible Connection** - May require more evidence

## Each Result Shows

- Secondary condition name
- Which primary it links to
- Medical rationale
- Typical rating range

## What to Do Next

1. Review each suggestion
2. Click **"Learn How"** for nexus guidance
3. Click **"Add to Packet"** to save
4. Consult with VSO or doctor
    `,
  },

  'scout-add-to-packet': {
    title: 'Adding to My Packet',
    content: `
Save secondary condition suggestions for your claims packet.

## How to Save

1. Find a relevant secondary condition
2. Click **"Add to Packet"**
3. Condition is saved to My Packet

## What Gets Saved

- Condition name and code
- Primary condition link
- Medical rationale
- Date added

## Next Steps

1. Open My Packet
2. Build nexus statement
3. Gather supporting evidence
4. File your claim
    `,
  },

  'cap-simulator': {
    title: 'C&P Exam Simulator',
    content: `
Prepare for your Compensation & Pension examination.

## What Is a C&P Exam?

A medical examination by the VA to evaluate your claimed disability. Your rating often depends on this exam.

## What the Simulator Does

- Asks questions based on real DBQs
- Covers condition-specific criteria
- Provides instant feedback
- Estimates potential ratings

## Important

This is for **practice only**. It cannot predict your actual rating. Always be honest in your real exam.
    `,
  },

  'simulator-getting-started': {
    title: 'Getting Started with Simulator',
    content: `
Begin your C&P exam preparation.

## How to Start

1. Click **"C&P Simulator"** in the header
2. Or click **"Launch C&P Simulator"** on the home page
3. Select a condition to practice
4. Answer the questions

## Simulation Modes

- **Full Simulation** - Complete DBQ-style exam
- **Flashcard Mode** - Quick question review

## Best Practices

- Take your time
- Answer honestly (as you would in real exam)
- Review the feedback carefully
- Practice multiple times
    `,
  },

  'condition-selection': {
    title: 'Condition Selection',
    content: `
Choose which condition to simulate.

## Available Conditions

The simulator covers conditions with DBQ-specific questions:
- Mental health (PTSD, depression, anxiety)
- Musculoskeletal (back, knees, shoulders)
- And more

## Selecting a Condition

1. Browse the condition list
2. Use search to filter
3. Click to select
4. Begin simulation

## Multiple Conditions

You can run separate simulations for each claimed condition.
    `,
  },

  'taking-simulation': {
    title: 'Taking the Simulation',
    content: `
What to expect during the simulation.

## Question Types

- **Frequency questions** - How often symptoms occur
- **Severity questions** - How bad symptoms are
- **Functional impact** - How it affects daily life
- **Treatment questions** - What treatments you've tried

## Answering Questions

- Select the option that best describes your situation
- Consider your worst days (flare-ups)
- Think about functional limitations

## Navigation

- Use **Next** to proceed
- Use **Back** to review
- Progress bar shows completion
    `,
  },

  'simulator-results': {
    title: 'Results & Feedback',
    content: `
Understanding your simulation results.

## What You'll See

- **Estimated rating range**
- **Key factors** that influenced the estimate
- **Suggestions** for documentation
- **What to discuss** in your real exam

## Important Disclaimer

This estimate is for **educational purposes only**:
- Not a prediction of your actual rating
- Based on your self-reported answers
- Actual VA decisions may differ

## Using the Feedback

- Identify gaps in documentation
- Know what criteria matter
- Prepare talking points for C&P
    `,
  },

  flashcards: {
    title: 'Flashcard Mode',
    content: `
Quick-review C&P exam concepts.

## What Are Flashcards?

Quick question-and-answer cards for reviewing:
- Rating criteria
- Key terminology
- What examiners look for

## How to Use

1. Select flashcard mode
2. Read the question
3. Think of your answer
4. Flip to see the answer
5. Mark as learned or review again

## Benefits

- Quick review sessions
- No pressure
- Learn at your pace
- Reinforce key concepts
    `,
  },

  'nexus-builder': {
    title: 'Nexus Builder',
    content: `
Create supporting statements for your claims.

## What Is a Nexus?

A medical connection between your current condition and military service. Required for service connection.

## What Nexus Builder Does

- Guides you through statement creation
- Provides templates and language
- Creates doctor-friendly summaries
- Generates downloadable documents

## Types of Statements

- **Personal statements** - Your own words
- **Doctor's cheat sheet** - For medical providers
- **Nexus framework** - Connection outline
    `,
  },

  'what-is-nexus': {
    title: 'What is a Nexus?',
    content: `
Understanding the nexus requirement.

## The Three Elements

To establish service connection, you need:

1. **Current diagnosis** - You have the condition now
2. **In-service event** - Something happened during service
3. **Nexus** - Medical link between them

## Nexus Language

The magic words: **"at least as likely as not"**

This means 50% or greater probability - not certainty.

## Who Can Provide Nexus?

- VA examiners (during C&P)
- Private physicians
- Specialists in the relevant field

## Why It Matters

Without a nexus, your claim will likely be denied - even with a diagnosis and in-service event.
    `,
  },

  'building-statement': {
    title: 'Building Your Statement',
    content: `
Create your personal statement step by step.

## What to Include

1. **Your information** - Name, service dates
2. **The condition** - What you're claiming
3. **In-service connection** - What happened
4. **Current impact** - How it affects you now
5. **Timeline** - Continuity of symptoms

## Writing Tips

- Be specific with dates and events
- Describe functional limitations
- Use "I" statements
- Be honest and accurate

## The Builder Process

1. Select or enter your condition
2. Answer guided questions
3. Review generated statement
4. Download or edit as needed
    `,
  },

  'doctor-cheat-sheet': {
    title: "Doctor's Cheat Sheet",
    content: `
Help your doctor help you.

## What Is It?

A summary document to give your physician including:
- The condition you're claiming
- Rating criteria from 38 CFR
- Key phrases for nexus letters
- What the VA needs to see

## Why Use It?

Most doctors don't know VA requirements. This helps them:
- Understand what to document
- Use correct terminology
- Provide useful opinions

## How to Use

1. Generate the cheat sheet
2. Print or email to your doctor
3. Discuss at your appointment
4. Request an opinion letter
    `,
  },

  'download-options': {
    title: 'Download Options',
    content: `
Export your statements and documents.

## Available Formats

- **PDF** - Print-ready document
- **Word (.docx)** - Editable format
- **Text** - Plain text copy

## What Gets Downloaded

- Your personal statement
- Doctor's cheat sheet
- Supporting information

## After Downloading

1. Review for accuracy
2. Sign if required
3. Keep copies
4. Submit with your claim
    `,
  },

  'forms-helper': {
    title: 'Forms Helper',
    content: `
Get help filling out VA forms.

## Available Forms

- **Buddy Statements** - Third-party support
- **Intent to File** - Protect your effective date
- **PTSD Stressor** - Document traumatic events
- **Veteran Profile** - Your information template

## How It Works

1. Select a form
2. Follow the guided wizard
3. Enter your information
4. Generate completed form
5. Download and submit

## Important

Forms Helper assists with completion but doesn't submit to VA. You must submit through official channels.
    `,
  },

  'available-forms': {
    title: 'Available Forms',
    content: `
Forms Helper currently supports:

## Buddy Statement (VA Form 21-4138)
Third-party statements supporting your claim. One of the most powerful forms of evidence!

## Intent to File
Protect your effective date while gathering evidence. Gives you 1 year to complete your claim.

## PTSD Stressor Statement (VA Form 21-0781)
Document the traumatic events related to your PTSD claim.

## Veteran Profile
Not a VA form - a personal reference document with your key information.

## Coming Soon
We're working on adding more forms. Let us know which ones you need!
    `,
  },

  'buddy-statements': {
    title: 'Buddy Statements',
    content: `
Powerful supporting evidence from people who know you.

## What Is a Buddy Statement?

A written statement from someone who can attest to:
- Your condition or symptoms
- Events during service
- How your disability affects you

## Who Can Write One?

- Fellow service members
- Family members
- Friends
- Coworkers
- Anyone with relevant knowledge

## What to Include

- Relationship to you
- What they witnessed
- Specific examples
- Dates if possible

## Using the Helper

1. Open Forms Helper
2. Select Buddy Statements
3. Enter information
4. Generate the form
5. Have your buddy sign it
    `,
  },

  'intent-to-file': {
    title: 'Intent to File',
    content: `
Protect your effective date.

## What Is Intent to File?

A notice to VA that you plan to file a claim. It:
- Reserves your effective date
- Gives you 1 year to complete your claim
- Protects back pay potential

## Why It Matters

Your effective date determines when benefits start. Filing ITF first can mean more back pay.

## How to File

**Best method:** File online at VA.gov

**Using Forms Helper:** 
- Generate the form
- Submit via mail or fax
- Note: Online is faster

## After Filing

You have 1 year to submit your full claim with evidence.
    `,
  },

  'ptsd-stressor': {
    title: 'PTSD Stressor Statement',
    content: `
Document traumatic events for your PTSD claim.

## What Is It?

VA Form 21-0781 - describes the traumatic event(s) that caused your PTSD.

## What to Include

- What happened
- When it happened
- Where it happened
- Who was involved
- How it affected you

## Types of Stressors

- Combat-related
- Personal assault (MST) - use 21-0781a
- Non-combat trauma
- Fear of hostile activity

## Tips

- Be as specific as possible
- Include dates, locations, unit info
- Describe your reaction
- Note any witnesses

## The Helper guides you through each section.
    `,
  },

  'veteran-profile': {
    title: 'Veteran Profile',
    content: `
Keep your information organized.

## What Is It?

A personal reference document with your key information:
- Service dates
- Duty stations
- Current conditions
- Claim information

## Not a VA Form

This is for your reference - not submitted to VA.

## Why Use It?

- Quick reference for filling forms
- Keep information consistent
- Track your claims history
- Share with VSO
    `,
  },

  // ========== NEW TOOLS DOCUMENTATION ==========

  'tactical-calculator': {
    title: 'Tactical Calculator',
    content: `
Calculate your combined VA disability rating with precision.

## What It Does

- Calculates combined ratings using official VA math (38 CFR § 4.25)
- Applies the Bilateral Factor for paired extremities
- Shows 2026 compensation rates with dependents
- Projects "What If" scenarios

## Why VA Math Matters

The VA doesn't add ratings. They use "efficiency" math:
- 50% + 30% ≠ 80%
- 50% + 30% = 65% (rounds to 70%)

## Features

| Feature | Description |
|---------|-------------|
| **Combined Rating** | Precise VA math calculation |
| **Bilateral Factor** | 10% boost for paired limbs |
| **Pay Calculator** | Monthly/yearly compensation |
| **Dependents** | Spouse, children, parents |
| **What-If** | Test adding new ratings |
    `,
  },

  'calc-overview': {
    title: 'How VA Math Works',
    content: `
Understanding the VA Combined Ratings Table.

## The Formula

Combined = A + B × (1 - A)

Where A and B are decimal ratings.

## Example

50% + 30%:
1. Convert: 0.50 + 0.30
2. Calculate: 0.50 + (0.30 × 0.50) = 0.50 + 0.15 = 0.65
3. Result: 65% (rounds to 70%)

## Key Rules

- Ratings are applied largest first
- Final result rounds to nearest 10
- 0.5 rounds UP (favorable to veteran)

## Why This Matters

Understanding VA math helps you:
- Know your realistic combined rating
- Identify which conditions will boost you most
- Plan strategic claim filing
    `,
  },

  'calc-bilateral': {
    title: 'Bilateral Factor',
    content: `
Get a 10% boost for paired extremity conditions.

## What Is It?

Per 38 CFR § 4.26, when you have conditions affecting both:
- Arms/shoulders
- Legs/hips/knees
- Hands/feet

You get a 10% increase on the COMBINED bilateral rating.

## Example

Left knee 20% + Right knee 10%:
1. Combine: 20% + 10% = 28%
2. Add 10%: 28% × 1.10 = 30.8%
3. Use 31% in final calculation

## How to Use

1. Mark conditions as Left/Right/Bilateral
2. Calculator automatically applies the factor
3. See the bilateral bonus in your breakdown
    `,
  },

  'calc-dependents': {
    title: 'Dependent Benefits',
    content: `
Additional compensation for dependents at 30%+.

## Who Qualifies

Veterans rated 30% or higher can receive additional compensation for:
- Spouse
- Children under 18
- Children 18-23 in school
- Dependent parents

## 2026 Rates Example (100%)

| Dependent | Additional |
|-----------|------------|
| Spouse | +$219.59/mo |
| Child <18 | +$109.11/mo |
| Child 18+ in school | +$352.45/mo |
| 1 Parent | +$176.24/mo |
| 2 Parents | +$352.48/mo |

## Spouse Aid & Attendance

Extra amount if your spouse requires A&A care.
    `,
  },

  'calc-what-if': {
    title: 'What-If Scenarios',
    content: `
Test how new ratings would affect your combined.

## How to Use

1. Enter your current conditions
2. Click "What If" or add a test condition
3. See projected new combined rating
4. Compare pay difference

## Strategic Planning

Use What-If to:
- Prioritize which claims to file first
- See impact of potential rating increases
- Plan for secondary conditions
- Understand diminishing returns at higher ratings
    `,
  },

  'cfile-analyzer': {
    title: 'C-File AI Analyzer',
    content: `
AI-powered analysis of your VA claims file.

## What Others Charge $500+ For - FREE

The C-File Analyzer uses AI to:
- Identify favorable evidence
- Find missing nexus connections
- Spot rating inconsistencies
- Suggest claim strategies

## What Is a C-File?

Your Claims File (C-File) contains everything VA has about you:
- Service records
- Medical records
- Previous decisions
- Correspondence

## Privacy First

Your documents are processed locally or with your own API key. We never store your records.
    `,
  },

  'cfile-what-is': {
    title: 'What is a C-File?',
    content: `
Your complete VA claims history.

## Contents

- Service treatment records
- VA medical records
- Private medical records you've submitted
- Previous rating decisions
- Exam reports
- Correspondence

## How to Get Yours

1. Request via VA.gov
2. Submit FOIA request (use our FOIA Generator)
3. Request through your VSO

## Why Review It?

- Find evidence you didn't know existed
- Identify errors in previous decisions
- Prepare stronger appeals
- Understand VA's reasoning
    `,
  },

  'cfile-upload': {
    title: 'Uploading Records',
    content: `
How to use the C-File Analyzer.

## Supported Formats

- PDF files
- Text documents
- Images (with OCR)

## Privacy

Your files are processed:
- In your browser (when possible)
- Via your own API key (Gemini)
- Never stored on our servers

## Tips

- Upload complete documents
- Include decision letters
- Add medical records
- Include service records
    `,
  },

  'cfile-analysis': {
    title: 'Understanding Results',
    content: `
Reading your C-File analysis.

## What You'll See

- **Favorable Evidence** - Supports your claims
- **Missing Elements** - What you need
- **Inconsistencies** - Potential rating errors
- **Action Items** - Next steps

## Using the Results

1. Review highlighted evidence
2. Note missing documentation
3. Identify appeal opportunities
4. Plan your next filing
    `,
  },

  'decision-decoder': {
    title: 'Decision Decoder',
    content: `
Understand VA decision letters and find appeal opportunities.

## What It Does

Upload your VA decision letter and get:
- Plain-English explanation
- Rating breakdown analysis
- Appeal option recommendations
- Timeline information

## Decision Types

- **Rating Decision** - Initial claim result
- **Statement of Case** - Appeal response
- **Supplemental Decision** - New evidence result
- **Board Decision** - BVA ruling
    `,
  },

  'decoder-overview': {
    title: 'Decision Decoder Overview',
    content: `
Turn confusing VA letters into actionable information.

## The Problem

VA decision letters are:
- Full of legal jargon
- Hard to understand
- Confusing on appeal rights
- Easy to miss deadlines

## The Solution

Decision Decoder:
- Translates to plain English
- Highlights key dates
- Explains your options
- Suggests next steps
    `,
  },

  'decoder-upload': {
    title: 'Upload Decision',
    content: `
How to upload your decision letter.

## Steps

1. Click "Upload Decision Letter"
2. Select your PDF or image
3. Wait for AI analysis
4. Review the breakdown

## Tips

- Upload complete letters
- Include all pages
- Clearer scans work better
    `,
  },

  'decoder-appeal': {
    title: 'Appeal Options',
    content: `
Understanding your appeal choices.

## Appeal Lanes (AMA)

| Lane | Best For | Timeline |
|------|----------|----------|
| **Supplemental Claim** | New evidence | ~4-6 months |
| **Higher-Level Review** | VA error | ~4-6 months |
| **Board Appeal** | Complex issues | 1-2+ years |

## Key Deadlines

- **1 Year** - Appeal most decisions
- **Continuous Pursuit** - Maintain effective date

## Decision Decoder Shows

- Which lane fits your situation
- Required evidence
- Expected timelines
- Strategic recommendations
    `,
  },

  'blue-button': {
    title: 'Blue Button X-Ray',
    content: `
Extract claim-relevant evidence from your VA medical records.

## What Is Blue Button?

Blue Button is the VA's health record download system. X-Ray helps you find the evidence hidden in those records.

## What It Finds

- Diagnosis dates
- Symptom documentation
- Treatment history
- Provider opinions
- Medication records

## Why It Matters

Your VA records often contain evidence you didn't know existed - including statements from doctors that support service connection.
    `,
  },

  'blue-overview': {
    title: 'What Is Blue Button?',
    content: `
VA's health record download system.

## Getting Your Records

1. Go to va.gov/my-health/medical-records/download/
2. Sign in with Login.gov or ID.me
3. **Step 1:** Select "All Time" date range
4. **Step 2:** Check "Select all VA records"
5. **Step 3:** Choose "Text file" format
6. Click "Download report"

## Record Types Included

- Lab and test results
- Care summaries and notes
- Vaccines
- Allergies and reactions
- Health conditions
- Vitals
- Medications
- Appointments (last 2 years)
- VA demographics
- DOD military service info (1980+)

## Using with X-Ray

1. Download Blue Button records (text file)
2. Upload to X-Ray
3. AI extracts evidence
4. Review findings
    `,
  },

  'blue-extract': {
    title: 'Extracting Evidence',
    content: `
Finding hidden evidence in your records.

## What X-Ray Looks For

- **Diagnoses** - Condition names and dates
- **Nexus Language** - "Related to," "caused by," etc.
- **Symptom Severity** - Frequency, duration, impact
- **Treatment Records** - Continuity of care

## Using Results

1. Review extracted evidence
2. Note strong statements
3. Identify gaps
4. Build your claim
    `,
  },

  'red-team': {
    title: 'Red Team Simulator',
    content: `
Think like a VA examiner to strengthen your claim.

## What Is Red Teaming?

Military concept: Have someone attack your own plan to find weaknesses before the enemy does.

## How It Works

1. Enter your claim details
2. AI simulates examiner review
3. See potential denial reasons
4. Get strengthening recommendations

## What You Learn

- Weak points in your evidence
- Missing documentation
- Examiner perspective
- How to address gaps
    `,
  },

  'red-overview': {
    title: 'What is Red Team?',
    content: `
Adversarial analysis of your claim.

## The Concept

Before filing, understand how VA might deny your claim. Then fix those weaknesses.

## Examiner Perspective

VA examiners look for:
- Nexus to service
- Current diagnosis
- Severity evidence
- Rating criteria fit

## Benefits

- File stronger claims
- Fewer denials
- Better preparation
- Realistic expectations
    `,
  },

  'red-analysis': {
    title: 'Weakness Analysis',
    content: `
Understanding Red Team results.

## Risk Levels

- 🟢 **Low Risk** - Strong evidence
- 🟡 **Medium Risk** - Needs strengthening
- 🔴 **High Risk** - Likely denial point

## Common Weaknesses

- Missing nexus statement
- No current diagnosis
- Gaps in treatment
- Inconsistent statements

## Action Items

Each weakness includes:
- What's missing
- Why it matters
- How to fix it
    `,
  },

  'witness-bench': {
    title: 'Witness Bench',
    content: `
AI-powered buddy statement wizard.

## The Problem

Veterans downplay their symptoms. Witnesses see the truth.

## How It Works

1. Select relationship to veteran
2. Enter the condition
3. Answer interview questions
4. AI generates formal statement

## Why Buddy Statements Matter

Third-party observations are powerful evidence:
- Spouses see sleep problems
- Coworkers see work limitations
- Friends see personality changes
- Battle buddies saw the event
    `,
  },

  'witness-overview': {
    title: 'Buddy Statements',
    content: `
Third-party evidence for your claim.

## What Is a Buddy Statement?

A lay/witness statement (VA Form 21-10210) from someone who:
- Witnessed the event
- Observes your symptoms
- Knows your limitations

## Who Can Write One?

- Spouse/partner
- Family members
- Fellow veterans
- Coworkers
- Friends
- Neighbors

## What Makes Them Powerful?

Specific, observable details that veterans often don't report themselves.
    `,
  },

  'witness-interview': {
    title: 'The Interview',
    content: `
Guided questions for powerful statements.

## How It Works

The Witness Bench asks questions designed to elicit:
- Specific examples
- Observable behaviors
- Changes over time
- Impact on daily life

## Question Types

- Sleep behaviors
- Social withdrawal
- Activity limitations
- Work impact
- Personality changes

## Tips

- Be specific
- Give examples
- Include dates when possible
- Describe what you SEE, not diagnose
    `,
  },

  'witness-output': {
    title: 'Statement Output',
    content: `
Your completed buddy statement.

## Generated Content

- Properly formatted statement
- First-person narrative
- Specific observations
- Attestation clause

## Download Options

- **PDF** - Ready to print/sign
- **DOCX** - Edit in Word
- **Copy** - Paste anywhere

## Next Steps

1. Review for accuracy
2. Witness signs and dates
3. Submit with claim
    `,
  },

  'risk-assessment': {
    title: 'Risk Assessment',
    content: `
Identify potential weaknesses before filing.

## What It Does

Analyzes your claim for:
- Evidence gaps
- Documentation issues
- Rating criteria fit
- Strategic concerns

## Risk Categories

| Category | Description |
|----------|-------------|
| **Evidence** | Medical documentation |
| **Nexus** | Service connection link |
| **Severity** | Rating level support |
| **Timing** | Effective date issues |

## How to Use

1. Enter your conditions
2. Add your evidence
3. Review risk analysis
4. Address weaknesses before filing
    `,
  },

  'tdiu-builder': {
    title: 'TDIU Builder',
    content: `
Evaluate your eligibility for Total Disability Individual Unemployability.

## What Is TDIU?

Compensation at the 100% rate when you can't work due to service-connected disabilities, even if your combined rating is less than 100%.

## Eligibility Requirements

**Schedular:**
- One disability at 60%+, OR
- Combined 70%+ with one at 40%+

**Extraschedular:**
- Any rating if you can't work

## What TDIU Builder Does

- Checks your eligibility
- Calculates your ratings
- Identifies qualifying conditions
- Guides your application
    `,
  },

  'tdiu-overview': {
    title: 'What is TDIU?',
    content: `
100% pay without 100% rating.

## The Concept

If your service-connected disabilities prevent you from maintaining "substantially gainful employment," you may qualify for TDIU.

## Types

- **Schedular TDIU** - Meet rating requirements
- **Extraschedular TDIU** - Special circumstances

## Benefits

- Paid at 100% rate
- May be easier than proving 100% schedular
- Protects if you can't work
    `,
  },

  'tdiu-eligibility': {
    title: 'Eligibility Check',
    content: `
Do you qualify for TDIU?

## Schedular Requirements

**Option 1:** Single disability at 60%+

**Option 2:** Combined 70%+ with at least one disability at 40%+

## Employment Factor

Must be unable to secure and follow "substantially gainful employment" due to service-connected disabilities.

## TDIU Builder Shows

- Your current rating math
- Which option you might qualify for
- Which conditions count
- What evidence you need
    `,
  },

  'symptom-logger': {
    title: 'Symptom Logger',
    content: `
Track your symptoms over time to build evidence.

## Why Track?

- Document severity patterns
- Show "bad days" frequency
- Build evidence for ratings
- Prepare for C&P exams

## What to Log

- Pain levels
- Flare-up frequency
- Sleep disruption
- Mood changes
- Activity limitations
- Medication use

## How It Helps

Your symptom history becomes powerful evidence showing the true impact of your conditions.
    `,
  },

  'symptom-overview': {
    title: 'Why Track Symptoms?',
    content: `
Build an evidence trail.

## The Problem

At C&P exams, veterans often:
- Forget their worst days
- Understate their symptoms
- Can't remember frequency

## The Solution

Daily logging creates:
- Objective record
- Frequency data
- Severity patterns
- Evidence for claims

## What Raters Want

- How often symptoms occur
- How severe they get
- How they affect function
- Treatment response
    `,
  },

  'symptom-logging': {
    title: 'Logging Symptoms',
    content: `
Recording your daily symptoms.

## Quick Log

- Select condition
- Rate severity (1-10)
- Add notes
- Save

## Detail Log

- Time of day
- Duration
- Triggers
- Impact on activities
- Medications taken

## Consistency

Log regularly - even good days. It shows the complete picture.
    `,
  },

  'symptom-reports': {
    title: 'Reports & Export',
    content: `
Using your symptom data.

## Reports Available

- **Summary** - Overview by condition
- **Trends** - Severity over time
- **Frequency** - How often symptoms occur
- **Calendar** - Visual timeline

## Export Options

- PDF report
- CSV data
- Print-friendly

## For Your C&P Exam

Bring your symptom log to show the examiner your true condition over time, not just that one day.
    `,
  },

  'million-dollar': {
    title: 'Million Dollar Dashboard',
    content: `
See the lifetime value of your VA benefits.

## What It Shows

- **Lifetime Compensation** - Total benefits over time
- **Healthcare Value** - VA medical savings
- **Education Benefits** - GI Bill value
- **Other Benefits** - Insurance, commissary, etc.

## Why "Million Dollar"?

A 100% disabled veteran retiring at 50 with 35+ years of benefits often receives over $1 million in total value.

## Calculations Include

- Monthly compensation × life expectancy
- Healthcare cost savings
- Dependent benefits
- COLA adjustments (estimated)

## Motivation

See the true value of fighting for accurate ratings.
    `,
  },

  'pact-act': {
    title: 'PACT Act Navigator',
    content: `
Find toxic exposure conditions covered by the PACT Act.

## What Is the PACT Act?

The Promise to Address Comprehensive Toxics (PACT) Act of 2022 expanded VA benefits for veterans exposed to:
- Burn pits
- Agent Orange
- Radiation
- Other toxic substances

## What Changed

- New presumptive conditions
- Expanded locations
- Extended timeframes
- Easier service connection

## How Navigator Helps

1. Enter your service details
2. See which exposures apply
3. Find presumptive conditions
4. Learn filing requirements
    `,
  },

  'pact-overview': {
    title: 'What is PACT Act?',
    content: `
Major expansion of toxic exposure benefits.

## Key Provisions

- 23+ new presumptive conditions
- Burn pit exposure recognition
- Agent Orange expansion
- Radiation exposure updates

## Who Benefits

Veterans who served in:
- Gulf War (1990+)
- Post-9/11 conflicts
- Vietnam (expanded)
- Specific bases/locations

## Timeline

- Some conditions presumptive now
- Others phased in through 2026
    `,
  },

  'pact-conditions': {
    title: 'Covered Conditions',
    content: `
Presumptive conditions under PACT Act.

## Respiratory

- Asthma
- Rhinitis
- Sinusitis
- Constrictive bronchiolitis
- Pulmonary fibrosis
- And more...

## Cancers

- Head/neck cancers
- Respiratory cancers
- GI cancers
- Reproductive cancers
- Kidney cancer
- Multiple others

## Other

- Hypertension (Agent Orange)
- Various other conditions

Navigator shows which conditions apply to your service.
    `,
  },

  'pact-locations': {
    title: 'Covered Locations',
    content: `
Where toxic exposure is presumed.

## Gulf War / Post-9/11

- Iraq
- Afghanistan
- Kuwait
- Saudi Arabia
- And other Southwest Asia locations

## Agent Orange

- Vietnam
- Thailand (certain bases)
- Korean DMZ
- Guam
- Other specific locations

## Other

- Radiation exposure sites
- Water contamination (Camp Lejeune)
- Specific bases with known exposures
    `,
  },

  'state-benefits': {
    title: 'State Benefit Hunter',
    content: `
Discover state-level veteran benefits you may be missing.

## What It Finds

- Property tax exemptions
- State income tax breaks
- Education benefits
- Employment preferences
- Vehicle registration discounts
- Recreation passes
- And more...

## How to Use

1. Enter your state
2. Enter your rating
3. See available benefits
4. Get links to apply

## Why It Matters

State benefits can add thousands in annual savings on top of federal VA compensation.
    `,
  },

  'vso-finder': {
    title: 'VSO Finder',
    content: `
Find FREE, accredited help near you.

## What Is a VSO?

Veterans Service Organizations provide FREE assistance with VA claims:
- DAV
- VFW
- American Legion
- County/State VSOs

## Why Use a VSO?

- 100% free
- Accredited by VA
- Experienced with claims
- Can access your records
- Represent you at hearings

## How to Find One

1. Enter your ZIP code
2. See local options
3. Verify accreditation
4. Schedule appointment

## Warning

BEWARE of "claim sharks" who charge fees! Legitimate VSOs are FREE.
    `,
  },

  'mos-matcher': {
    title: 'MOS Hazard Matcher',
    content: `
Link your military job to exposures and conditions.

## What It Does

Enter your MOS/Rating/AFSC and see:
- Known hazards of that job
- Common conditions
- Exposure documentation
- Nexus suggestions

## Why It Matters

Your job specialty often involved exposures that cause conditions decades later. Documentation helps prove the connection.

## Examples

- Infantry → Hearing loss, joint problems
- Burn pit exposure → Respiratory conditions
- Mechanics → Chemical exposures
- Aviation → Hearing, toxic exposures
    `,
  },

  'web-conditions': {
    title: 'Web of Conditions',
    content: `
Visualize how conditions connect to each other.

## The Interactive Map

See a visual web showing:
- Primary conditions (your service-connected)
- Secondary conditions (caused by primaries)
- Connection strength
- Medical nexus logic

## How to Use

1. Click a primary condition
2. See connected secondaries
3. Click connection lines
4. Read the nexus explanation

## Why It Helps

Understand the medical logic connecting conditions, making it easier to argue secondary claims.
    `,
  },

  'foia-generator': {
    title: 'FOIA Generator',
    content: `
Create Freedom of Information Act requests for your records.

## What You Can Request

- Service personnel records
- Medical records
- VA claims file (C-File)
- Unit records
- Investigation reports

## How It Works

1. Select record type
2. Enter your information
3. Generate the request
4. Submit to appropriate agency

## Why Use FOIA?

Sometimes records aren't in your C-File. FOIA requests can uncover documentation that supports your claim.
    `,
  },

  'shark-radar': {
    title: 'Shark Radar',
    content: `
Identify and avoid predatory claim services.

## Warning Signs

- Upfront fees for initial claims
- Percentage of backpay demands
- Pressure tactics
- Guarantees of ratings
- Unlicensed "consultants"

## Safe Options

- VSOs (always free)
- VA-accredited attorneys (regulated fees)
- VA-accredited claims agents (regulated fees)

## Red Flags

| Warning | Safe Alternative |
|---------|------------------|
| "Pay us 5x your backpay" | VSO (free) |
| "Guaranteed 100%" | No one can guarantee |
| "Act now or lose benefits" | You have time |
| Unlicensed | Check VA accreditation |

## Verify

Always verify accreditation at VA.gov before signing anything.
    `,
  },

  'pathfinder': {
    title: 'Pathfinder',
    content: `
Your strategic roadmap from claim to benefits.

## What It Does

Creates a step-by-step plan based on:
- Your current rating
- Conditions you want to claim
- Your evidence situation
- Your timeline

## The Path

1. **Assessment** - Where you are now
2. **Planning** - What to file and when
3. **Evidence** - What you need
4. **Filing** - How to submit
5. **Exam** - Preparation
6. **Decision** - Next steps

## Customized Strategy

Pathfinder considers your specific situation to recommend whether to file primary claims, secondaries, increases, or appeals.
    `,
  },

  'my-packet': {
    title: 'My Packet',
    content: `
Organize all your claims in one place.

## What Is My Packet?

Your personal claims organizer containing:
- Saved conditions
- Secondary condition suggestions
- Nexus statements
- Forms in progress

## Features

- Add/remove conditions
- Track status
- Store statements
- Export everything

## Data Storage

All data stored locally in your browser. Use Backup & Restore to save externally.
    `,
  },

  'managing-claims': {
    title: 'Managing Claims',
    content: `
Organize your disability claims.

## Adding Claims

- From search results
- From Secondary Scout
- Manual entry

## Claim Information

Each saved claim shows:
- Condition name
- Diagnostic code
- Primary or secondary
- Linked conditions
- Status

## Actions

- Edit claim details
- Build nexus statement
- Remove from packet
- Export data
    `,
  },

  'saved-forms': {
    title: 'Saved Forms',
    content: `
Access your form progress.

## What Gets Saved

- Buddy statement drafts
- Completed forms
- Personal statements

## Finding Your Forms

1. Open My Packet
2. Click "Forms" tab
3. Select a form to continue

## Editing

- Resume where you left off
- Update information
- Re-download when ready
    `,
  },

  'backup-restore': {
    title: 'Backup & Restore',
    content: `
Protect your data.

## Why Backup?

Your data is stored in your browser. If you:
- Clear browser data
- Use a different browser
- Use a different device

...your data won't be there.

## How to Backup

1. Open My Packet
2. Click "Backup Data"
3. Save the file somewhere safe

## How to Restore

1. Open My Packet
2. Click "Restore Data"
3. Select your backup file
4. Confirm restoration

## Best Practices

- Backup regularly
- Keep multiple copies
- Use cloud storage
    `,
  },

  'exporting-data': {
    title: 'Exporting Data',
    content: `
Download your claims packet.

## Export Options

- **Full Backup** - All data, restorable
- **PDF Summary** - Printable overview
- **Individual Items** - Specific documents

## Full Backup

Creates a .json file containing everything. Use this for data portability.

## PDF Summary

Generates a printable document with:
- All saved conditions
- Statements
- Notes

## Individual Export

Download specific:
- Nexus statements
- Completed forms
- Condition details
    `,
  },

  'va-resources': {
    title: 'VA Resources',
    content: `
Quick access to official VA resources.

## Categories

- **Online Portals** - VA.gov, eBenefits, My HealtheVet
- **Phone Numbers** - Key VA contacts
- **External Resources** - VSOs, legal help

## Important Numbers

| Service | Number |
|---------|--------|
| VA Benefits | 1-800-827-1000 |
| VA Health | 1-877-222-8387 |
| Crisis Line | 988 (Press 1) |

## We Are NOT the VA

Vet-Rate.org is independent. For official help, use VA resources.
    `,
  },

  'online-portals': {
    title: 'Online Portals',
    content: `
## VA.gov
Main VA portal for:
- Filing claims
- Checking status
- Managing benefits

## My HealtheVet
Health records and:
- Prescription refills
- Secure messaging
- Appointment scheduling

## eBenefits
Legacy portal (transitioning to VA.gov):
- Benefits letters
- Disability rating info
- Dependents management
    `,
  },

  'phone-numbers': {
    title: 'Phone Numbers',
    content: `
## Emergency

**Veterans Crisis Line:** 988, Press 1
Text: 838255

## General VA

- **Benefits Hotline:** 1-800-827-1000
- **Health Care:** 1-877-222-8387
- **GI Bill:** 1-888-442-4551

## Specialized

- **Women Veterans:** 1-855-829-6636
- **Homeless Veterans:** 1-877-424-3838
- **Caregiver Support:** 1-855-260-3274
    `,
  },

  'external-resources': {
    title: 'External Resources',
    content: `
## Veterans Service Organizations (VSOs)

Free claims help from accredited representatives:
- **DAV** - Disabled American Veterans
- **VFW** - Veterans of Foreign Wars
- **American Legion**
- **Vietnam Veterans of America**

## Legal Help

- **VA Accredited Attorneys**
- **Legal aid societies**
- **Law school clinics**

## Find a VSO

Visit VA.gov and search for accredited representatives in your area.
    `,
  },

  settings: {
    title: 'Settings',
    content: `
Customize your Vet-Rate.org experience.

## Display Settings

- Dark/Light mode
- Color blind modes
- Font size

## Accessibility

- Reduced motion
- Screen reader optimization

## Data

- Clear local data
- Backup/Restore
    `,
  },

  'display-mode': {
    title: 'Display Mode',
    content: `
Choose your preferred appearance.

## Light Mode
Default bright theme. Best for well-lit environments.

## Dark Mode
Reduced brightness theme. Best for:
- Low light conditions
- Reducing eye strain
- OLED screen battery savings

## How to Change

1. Click the accessibility menu (☰)
2. Toggle Dark Mode on/off

Setting is saved for future visits.
    `,
  },

  'accessibility-options': {
    title: 'Accessibility Options',
    content: `
Make Vet-Rate.org work for you.

## Color Blind Modes

- **Protanopia** - Red-blind friendly
- **Deuteranopia** - Green-blind friendly
- **Tritanopia** - Blue-blind friendly
- **High Contrast** - Maximum visibility

## Font Size

Adjustable sizes from small to extra-large.

## Reduced Motion

Disables animations and transitions for:
- Vestibular sensitivities
- Motion sickness
- Distraction reduction

All settings persist across sessions.
    `,
  },

  'data-management': {
    title: 'Data Management',
    content: `
Control your local data.

## Where Data Lives

All data stored in your browser's localStorage:
- Only on your device
- Only in this browser
- Cleared if you clear browser data

## Managing Data

### View Storage Used
Check how much space your data uses.

### Clear All Data
Remove everything. **Cannot be undone!**

### Backup First
Always backup before clearing data.

## Privacy

We never see, collect, or transmit your data. It stays on your device.
    `,
  },

  reference: {
    title: 'Reference',
    content: `
Quick reference materials.

## Glossary
Definitions of common VA terms.

## CFR Reference
Guide to 38 CFR sections.

## Keyboard Shortcuts
Navigate efficiently with your keyboard.
    `,
  },

  glossary: {
    title: 'Glossary',
    content: `
Common VA claims terminology.

## A-C

- **C&P Exam** - Compensation and Pension examination
- **CFR** - Code of Federal Regulations
- **Combined Rating** - Total disability percentage using VA math

## D-I

- **DBQ** - Disability Benefits Questionnaire
- **DeLuca Factors** - Additional impairment factors (pain, fatigue, etc.)
- **IMO** - Independent Medical Opinion
- **ITF** - Intent to File

## N-S

- **Nexus** - Medical connection between condition and service
- **Secondary Condition** - Disability caused by service-connected condition
- **Service Connection** - VA recognition that condition is related to service

## T-V

- **TDIU** - Total Disability Individual Unemployability
- **VA Math** - Method for calculating combined ratings
- **VSO** - Veterans Service Organization
    `,
  },

  'cfr-reference': {
    title: 'CFR Reference',
    content: `
Key Code of Federal Regulations sections.

## 38 CFR Part 3 - Adjudication

- **§ 3.303** - Principles of service connection
- **§ 3.310** - Secondary service connection
- **§ 3.317** - Gulf War presumptives

## 38 CFR Part 4 - Rating Schedule

- **§ 4.71a** - Musculoskeletal system
- **§ 4.97** - Respiratory system
- **§ 4.104** - Cardiovascular system
- **§ 4.124a** - Neurological conditions
- **§ 4.130** - Mental disorders

## Key Principles

- **§ 4.3** - Reasonable doubt favors veteran
- **§ 4.7** - Higher rating when between levels
    `,
  },

  'keyboard-shortcuts': {
    title: 'Keyboard Shortcuts',
    content: `
Navigate efficiently with your keyboard.

## Global

| Shortcut | Action |
|----------|--------|
| **/** | Focus search |
| **Escape** | Close modal |
| **Tab** | Next element |
| **Shift+Tab** | Previous element |

## Within Modals

| Shortcut | Action |
|----------|--------|
| **Escape** | Close |
| **Enter** | Confirm/Submit |
| **Tab** | Navigate fields |

## Browser Shortcuts

| Shortcut | Action |
|----------|--------|
| **Ctrl+R** | Refresh |
| **Ctrl+F** | Find on page |
| **Ctrl++/-** | Zoom in/out |
    `,
  },

  faq: {
    title: 'Frequently Asked Questions',
    content: `
Common questions answered.

## General

**Is Vet-Rate.org affiliated with the VA?**
No. We are an independent educational resource.

**Is it free?**
Yes, completely free. No subscriptions or hidden costs.

**Do I need an account?**
No. Everything works in your browser without login.

## Privacy

**Is my data safe?**
Yes. Data stays in your browser and is never transmitted.

**Can you see my information?**
No. We have no ability to access your data.

## Features

**Will the C&P Simulator predict my rating?**
No. It's for educational preparation only.

**Are the secondary conditions reliable?**
They're based on medical literature, but success depends on evidence. Consult professionals.

**Can I submit forms directly to VA?**
No. You must submit through official VA channels.

## Technical

**My data disappeared!**
Likely browser data was cleared. Restore from backup if you have one.

**Why won't PDFs download?**
Check your popup blocker and browser permissions.

## Getting Help

**How do I report a bug?**
Use the Bug Squasher tool in the footer.

**Where can I get claims help?**
Contact a VSO - free and accredited assistance.

## Crisis Support

**🆘 Veterans Crisis Line:** 988, Press 1 | Text 838255
Available 24/7
    `,
  },
};

// Simple markdown-like renderer
const renderContent = (content) => {
  if (!content) return null;
  
  const lines = content.trim().split('\n');
  const elements = [];
  let inTable = false;
  let tableRows = [];
  let inList = false;
  let listItems = [];
  let inBlockquote = false;
  let blockquoteContent = [];
  
  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="list-disc pl-6 mb-4 space-y-1">
          {listItems.map((item, i) => (
            <li key={i} className="text-gray-700 dark:text-gray-300">{renderInline(item)}</li>
          ))}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };
  
  const flushBlockquote = () => {
    if (blockquoteContent.length > 0) {
      elements.push(
        <blockquote key={`bq-${elements.length}`} className="border-l-4 border-va-gold pl-4 py-2 my-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-r">
          {blockquoteContent.map((line, i) => (
            <p key={i} className="text-gray-700 dark:text-gray-300">{renderInline(line)}</p>
          ))}
        </blockquote>
      );
      blockquoteContent = [];
      inBlockquote = false;
    }
  };
  
  const flushTable = () => {
    if (tableRows.length > 0) {
      const headers = tableRows[0];
      const dataRows = tableRows.slice(2); // Skip header separator
      elements.push(
        <div key={`table-${elements.length}`} className="overflow-x-auto mb-4">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {headers.map((cell, i) => (
                  <th key={i} className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {renderInline(cell.trim())}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {dataRows.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {row.map((cell, cellIdx) => (
                    <td key={cellIdx} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                      {renderInline(cell.trim())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      inTable = false;
    }
  };
  
  const renderInline = (text) => {
    if (!text) return text;
    
    // Handle bold
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Handle inline code
    text = text.replace(/`(.+?)`/g, '<code class="bg-gray-100 dark:bg-gray-800 px-1 rounded text-sm">$1</code>');
    // Handle links
    text = text.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-va-blue dark:text-va-gold hover:underline">$1</a>');
    
    return <span dangerouslySetInnerHTML={{ __html: text }} />;
  };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Empty line - flush lists/blockquotes
    if (line.trim() === '') {
      flushList();
      flushBlockquote();
      flushTable();
      continue;
    }
    
    // Headers
    if (line.startsWith('## ')) {
      flushList();
      flushBlockquote();
      flushTable();
      elements.push(
        <h2 key={`h2-${i}`} className="text-xl font-bold text-gray-900 dark:text-white mt-6 mb-3">
          {line.slice(3)}
        </h2>
      );
      continue;
    }
    
    if (line.startsWith('### ')) {
      flushList();
      flushBlockquote();
      flushTable();
      elements.push(
        <h3 key={`h3-${i}`} className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">
          {line.slice(4)}
        </h3>
      );
      continue;
    }
    
    // Blockquote
    if (line.startsWith('> ')) {
      flushList();
      flushTable();
      inBlockquote = true;
      blockquoteContent.push(line.slice(2));
      continue;
    }
    
    // Table
    if (line.startsWith('|')) {
      flushList();
      flushBlockquote();
      inTable = true;
      const cells = line.split('|').filter(cell => cell.trim() !== '');
      tableRows.push(cells);
      continue;
    }
    
    // List item
    if (line.startsWith('- ')) {
      flushBlockquote();
      flushTable();
      inList = true;
      listItems.push(line.slice(2));
      continue;
    }
    
    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      flushBlockquote();
      flushTable();
      const match = line.match(/^\d+\.\s(.+)/);
      if (match) {
        if (!inList) {
          inList = true;
        }
        listItems.push(match[1]);
      }
      continue;
    }
    
    // Special: Tour restart button
    if (line.includes('<tour-restart-button>')) {
      flushList();
      flushBlockquote();
      flushTable();
      elements.push(
        <div key={`tour-btn-${i}`} className="my-4">
          <button
            onClick={() => {
              resetTourState();
              alert('Tour reset! Close this manual and refresh the page to see the tour again.');
            }}
            className="inline-flex items-center gap-2 bg-va-gold hover:bg-yellow-400 text-gray-900 px-4 py-2 rounded-lg font-semibold transition-all hover:scale-105"
          >
            🎓 Restart Interactive Tour
          </button>
        </div>
      );
      continue;
    }
    
    // Regular paragraph
    flushList();
    flushBlockquote();
    flushTable();
    elements.push(
      <p key={`p-${i}`} className="text-gray-700 dark:text-gray-300 mb-3">
        {renderInline(line)}
      </p>
    );
  }
  
  // Flush remaining
  flushList();
  flushBlockquote();
  flushTable();
  
  return elements;
};

const UserManual = ({ onClose, onReportBug }) => {
  const [currentSection, setCurrentSection] = useState('home');
  const [expandedSections, setExpandedSections] = useState(['getting-started']);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Get current content
  const currentContent = documentationContent[currentSection] || documentationContent.home;
  
  // Toggle section expansion
  const toggleSection = (sectionId) => {
    setExpandedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };
  
  // Search functionality
  const searchResults = searchQuery.trim() 
    ? Object.entries(documentationContent).filter(([id, content]) => 
        content.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        content.content.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 10)
    : [];
  
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex">
      {/* Main container */}
      <div className="flex-1 flex flex-col md:flex-row bg-white dark:bg-gray-900 m-0 md:m-4 rounded-none md:rounded-xl overflow-hidden">
        
        {/* Mobile header */}
        <div className="md:hidden flex items-center justify-between bg-gradient-to-r from-va-blue to-emerald-700 text-white p-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-white/20 rounded-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="font-bold">📖 User Manual</h1>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Sidebar */}
        <div className={`${sidebarOpen ? 'block' : 'hidden'} md:block w-full md:w-72 lg:w-80 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-shrink-0 overflow-y-auto`}>
          {/* Desktop header */}
          <div className="hidden md:block sticky top-0 bg-gradient-to-r from-va-blue to-emerald-700 text-white p-4">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-lg font-bold flex items-center gap-2">
                📖 User Manual
              </h1>
              <button onClick={onClose} className="p-1 hover:bg-white/20 rounded">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search documentation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 pl-9 bg-white/20 rounded-lg text-white placeholder-white/70 text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
              />
              <svg className="absolute left-3 top-2.5 w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          
          {/* Search results */}
          {searchQuery.trim() && (
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">SEARCH RESULTS</h3>
              {searchResults.length > 0 ? (
                <div className="space-y-1">
                  {searchResults.map(([id, content]) => (
                    <button
                      key={id}
                      onClick={() => {
                        setCurrentSection(id);
                        setSearchQuery('');
                        setSidebarOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                    >
                      {content.title}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No results found</p>
              )}
            </div>
          )}
          
          {/* Navigation */}
          <nav className="p-3">
            {navigationStructure.map((section) => (
              <div key={section.id} className="mb-1">
                {/* Category Headers */}
                {section.isCategory ? (
                  <div className="mt-4 mb-2 px-3 py-1 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                    {section.title}
                  </div>
                ) : section.children ? (
                  <>
                    <button
                      onClick={() => toggleSection(section.id)}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
                    >
                      <span className="flex items-center gap-2">
                        <span>{section.icon}</span>
                        <span>{section.title}</span>
                      </span>
                      <svg 
                        className={`w-4 h-4 transition-transform ${expandedSections.includes(section.id) ? 'rotate-90' : ''}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    {expandedSections.includes(section.id) && (
                      <div className="ml-6 mt-1 space-y-1">
                        <button
                          onClick={() => {
                            setCurrentSection(section.id);
                            setSidebarOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-sm rounded-lg ${
                            currentSection === section.id 
                              ? 'bg-va-blue text-white' 
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}
                        >
                          Overview
                        </button>
                        {section.children.map((child) => (
                          <button
                            key={child.id}
                            onClick={() => {
                              setCurrentSection(child.id);
                              setSidebarOpen(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 text-sm rounded-lg ${
                              currentSection === child.id 
                                ? 'bg-va-blue text-white' 
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                          >
                            {child.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setCurrentSection(section.id);
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg ${
                      currentSection === section.id 
                        ? 'bg-va-blue text-white' 
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span>{section.icon}</span>
                    <span>{section.title}</span>
                  </button>
                )}
              </div>
            ))}
          </nav>
          
          {/* Report bug link */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onReportBug}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
            >
              🐛 Report a Bug
            </button>
          </div>
        </div>
        
        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-6 md:p-8">
            {/* Breadcrumb */}
            <nav className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              <button 
                onClick={() => setCurrentSection('home')}
                className="hover:text-va-blue dark:hover:text-va-gold"
              >
                Home
              </button>
              {currentSection !== 'home' && (
                <>
                  <span className="mx-2">/</span>
                  <span className="text-gray-900 dark:text-white">{currentContent.title}</span>
                </>
              )}
            </nav>
            
            {/* Title */}
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
              {currentContent.title}
            </h1>
            
            {/* Content */}
            <div className="prose dark:prose-invert max-w-none">
              {renderContent(currentContent.content)}
            </div>
            
            {/* Navigation buttons */}
            <div className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-700 flex justify-between">
              <button
                onClick={() => setCurrentSection('home')}
                className="flex items-center gap-2 text-va-blue dark:text-va-gold hover:underline"
              >
                ← Back to Home
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Close Manual
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManual;
