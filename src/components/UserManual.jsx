/**
 * UserManual.jsx - Integrated User Manual for Vet-Rate.org
 * Comprehensive documentation accessible within the web application
 */

import React, { useState, useEffect } from 'react';

// Navigation structure matching the docs
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
    id: 'nexus-builder',
    title: 'Nexus Builder',
    icon: '📝',
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
Welcome to the comprehensive user manual for **Vet-Rate.org** — your complete VA claims toolkit.

## About This Manual

This manual covers every feature and function of the Vet-Rate.org platform, designed to help you:

- **Search & understand** 748 VA disability conditions
- **Discover secondary conditions** linked to your service-connected disabilities
- **Prepare for C&P exams** with our simulator
- **Build nexus statements** to support your claims
- **Complete VA forms** with guided assistance
- **Organize your claims packet** in one place

## Quick Navigation

| Feature | What It Does |
|---------|--------------|
| **Search** | Find any of 748 rated disabilities |
| **Secondary Scout** | Discover potential secondary claims |
| **C&P Simulator** | Practice for your exam |
| **Nexus Builder** | Create supporting statements |
| **Forms Helper** | Fill out VA forms |
| **My Packet** | Manage all your claims |

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

1. **Acknowledge the disclaimer** — Understand this is an educational tool
2. **Search for a condition** — Try your primary service-connected disability
3. **Explore Secondary Scout** — Discover potential secondary claims
4. **Try the C&P Simulator** — Prepare for your exam
5. **Check Settings** — Adjust display and accessibility options
    `,
  },

  'first-visit': {
    title: 'Your First Visit',
    content: `
Here's what to expect when you first visit Vet-Rate.org.

## The Disclaimer

On your first visit, you'll see a disclaimer explaining:
- This is an educational tool
- Not affiliated with the VA
- Not legal or medical advice

Click **"I Understand"** to continue.

## The Main Interface

After acknowledging the disclaimer, you'll see:

1. **Header** — Navigation to main features
2. **Search Bar** — Search 748 disabilities
3. **Feature Cards** — Quick access to tools
4. **Footer** — Links to policies and support

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

- **Search Bar** — Central search functionality
- **Feature Cards** — Quick-launch tools
- **Search Results** — Condition cards with key info

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
- **Protanopia** — Red-blind friendly
- **Deuteranopia** — Green-blind friendly  
- **Tritanopia** — Blue-blind friendly
- **High Contrast** — Maximum visibility

### Font Size
Adjustable from small to extra-large.

### Reduced Motion
Disables animations for vestibular sensitivities.

## Keyboard Navigation

- **Tab** — Move between elements
- **Enter** — Activate buttons/links
- **Escape** — Close modals
- **/** — Focus search bar

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

- **748 disabilities** from 38 CFR Part 4
- **Condition names** (e.g., "PTSD", "tinnitus")
- **Diagnostic codes** (e.g., "9411", "6260")
- **Keywords** (e.g., "knee", "back", "anxiety")

## Search Features

- **Instant results** — As you type
- **Fuzzy matching** — Handles typos
- **All body systems** — Complete coverage

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

- **Partial matches work** — "anx" finds anxiety
- **Case insensitive** — "PTSD" = "ptsd"
- **Multiple words** — "sleep apnea" searches for both
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

- **Click card** — View full details
- **View criteria** — See rating percentages
- **Launch Scout** — Find secondary conditions

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

- **High Connection** — Strong medical link
- **Moderate Connection** — Established link
- **Possible Connection** — May require more evidence

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

- **Full Simulation** — Complete DBQ-style exam
- **Flashcard Mode** — Quick question review

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

- **Frequency questions** — How often symptoms occur
- **Severity questions** — How bad symptoms are
- **Functional impact** — How it affects daily life
- **Treatment questions** — What treatments you've tried

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

- **Personal statements** — Your own words
- **Doctor's cheat sheet** — For medical providers
- **Nexus framework** — Connection outline
    `,
  },

  'what-is-nexus': {
    title: 'What is a Nexus?',
    content: `
Understanding the nexus requirement.

## The Three Elements

To establish service connection, you need:

1. **Current diagnosis** — You have the condition now
2. **In-service event** — Something happened during service
3. **Nexus** — Medical link between them

## Nexus Language

The magic words: **"at least as likely as not"**

This means 50% or greater probability — not certainty.

## Who Can Provide Nexus?

- VA examiners (during C&P)
- Private physicians
- Specialists in the relevant field

## Why It Matters

Without a nexus, your claim will likely be denied — even with a diagnosis and in-service event.
    `,
  },

  'building-statement': {
    title: 'Building Your Statement',
    content: `
Create your personal statement step by step.

## What to Include

1. **Your information** — Name, service dates
2. **The condition** — What you're claiming
3. **In-service connection** — What happened
4. **Current impact** — How it affects you now
5. **Timeline** — Continuity of symptoms

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

- **PDF** — Print-ready document
- **Word (.docx)** — Editable format
- **Text** — Plain text copy

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

- **Buddy Statements** — Third-party support
- **Intent to File** — Protect your effective date
- **PTSD Stressor** — Document traumatic events
- **Veteran Profile** — Your information template

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
Not a VA form — a personal reference document with your key information.

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

VA Form 21-0781 — describes the traumatic event(s) that caused your PTSD.

## What to Include

- What happened
- When it happened
- Where it happened
- Who was involved
- How it affected you

## Types of Stressors

- Combat-related
- Personal assault (MST) — use 21-0781a
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

This is for your reference — not submitted to VA.

## Why Use It?

- Quick reference for filling forms
- Keep information consistent
- Track your claims history
- Share with VSO
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

- **Full Backup** — All data, restorable
- **PDF Summary** — Printable overview
- **Individual Items** — Specific documents

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

- **Online Portals** — VA.gov, eBenefits, My HealtheVet
- **Phone Numbers** — Key VA contacts
- **External Resources** — VSOs, legal help

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
- **DAV** — Disabled American Veterans
- **VFW** — Veterans of Foreign Wars
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

- **Protanopia** — Red-blind friendly
- **Deuteranopia** — Green-blind friendly
- **Tritanopia** — Blue-blind friendly
- **High Contrast** — Maximum visibility

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

- **C&P Exam** — Compensation and Pension examination
- **CFR** — Code of Federal Regulations
- **Combined Rating** — Total disability percentage using VA math

## D-I

- **DBQ** — Disability Benefits Questionnaire
- **DeLuca Factors** — Additional impairment factors (pain, fatigue, etc.)
- **IMO** — Independent Medical Opinion
- **ITF** — Intent to File

## N-S

- **Nexus** — Medical connection between condition and service
- **Secondary Condition** — Disability caused by service-connected condition
- **Service Connection** — VA recognition that condition is related to service

## T-V

- **TDIU** — Total Disability Individual Unemployability
- **VA Math** — Method for calculating combined ratings
- **VSO** — Veterans Service Organization
    `,
  },

  'cfr-reference': {
    title: 'CFR Reference',
    content: `
Key Code of Federal Regulations sections.

## 38 CFR Part 3 — Adjudication

- **§ 3.303** — Principles of service connection
- **§ 3.310** — Secondary service connection
- **§ 3.317** — Gulf War presumptives

## 38 CFR Part 4 — Rating Schedule

- **§ 4.71a** — Musculoskeletal system
- **§ 4.97** — Respiratory system
- **§ 4.104** — Cardiovascular system
- **§ 4.124a** — Neurological conditions
- **§ 4.130** — Mental disorders

## Key Principles

- **§ 4.3** — Reasonable doubt favors veteran
- **§ 4.7** — Higher rating when between levels
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
Contact a VSO — free and accredited assistance.

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
                {section.children ? (
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
