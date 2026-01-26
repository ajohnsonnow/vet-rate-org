import React, { createContext, useContext, useState, useEffect } from 'react';

/**
 * HelperModeContext - "Spouse Mode" / "Caregiver Mode"
 * 
 * WHY: Many veterans don't use computers; their spouses, adult children, or caregivers 
 * help them navigate the claims process. The interface can be overwhelming for someone
 * who isn't familiar with military/VA terminology.
 * 
 * WHAT IT DOES:
 * - Simplifies language throughout the app (e.g., "Nexus" → "Medical Connection")
 * - Highlights tools most relevant to caregivers (Witness Bench, State Benefits)
 * - Adds helpful tooltips explaining military/VA acronyms
 * - Reduces visual complexity in some interfaces
 * 
 * 100% CLIENT-SIDE: Uses localStorage, no server needed.
 */

const HelperModeContext = createContext();

// Terminology translations for Helper Mode
export const TERMINOLOGY = {
  // Tool Names
  'Nexus Builder': { simple: 'Medical Link Builder', tooltip: 'Creates a document explaining the medical connection between conditions' },
  'Nexus Letter': { simple: 'Medical Connection Letter', tooltip: 'A doctor\'s letter explaining how conditions are connected' },
  'Secondary Scout': { simple: 'Related Conditions Finder', tooltip: 'Finds medical conditions that can be caused by existing disabilities' },
  'C&P Exam': { simple: 'Disability Evaluation Exam', tooltip: 'Compensation & Pension exam - the medical exam the VA orders' },
  'C&P Simulator': { simple: 'Exam Practice Tool', tooltip: 'Practice answering questions before the VA medical exam' },
  'C-File': { simple: 'VA Claims File', tooltip: 'The complete file the VA keeps on a veteran\'s claims' },
  'PACT Act': { simple: 'Toxic Exposure Law', tooltip: 'A 2022 law expanding benefits for veterans exposed to toxic substances' },
  'TDIU': { simple: 'Individual Unemployability', tooltip: 'A benefit for veterans who can\'t work due to their disabilities' },
  'DBQ': { simple: 'Disability Questionnaire', tooltip: 'The form doctors use to document disability severity' },
  'VSO': { simple: 'Free Claims Helper', tooltip: 'Veterans Service Organization - provides free claims assistance' },
  'FOIA': { simple: 'Records Request', tooltip: 'Freedom of Information Act - used to request government records' },
  
  // Technical Terms
  'Bilateral Factor': { simple: 'Both-Sides Bonus', tooltip: 'Extra compensation when both sides of the body are affected' },
  'Presumptive Condition': { simple: 'Automatic Approval Condition', tooltip: 'A condition the VA automatically assumes is service-connected' },
  'Service Connection': { simple: 'Military-Related Link', tooltip: 'The connection between a condition and military service' },
  'Prostrating': { simple: 'Forced to Stop Activities', tooltip: 'An attack so severe you have to stop what you\'re doing' },
  'Rating Schedule': { simple: 'Disability Ratings Guide', tooltip: 'The official guide showing what rating each condition gets' },
  '38 CFR': { simple: 'VA Regulations', tooltip: 'The legal rules the VA follows for disability claims' },
  'Diagnostic Code': { simple: 'Condition Number', tooltip: 'The number code the VA uses for each medical condition' },
  'Effective Date': { simple: 'Start Date for Benefits', tooltip: 'The date your benefits begin - affects back pay' },
  
  // Acronyms
  'PTSD': { simple: 'PTSD (Trauma Disorder)', tooltip: 'Post-Traumatic Stress Disorder' },
  'TBI': { simple: 'TBI (Brain Injury)', tooltip: 'Traumatic Brain Injury' },
  'IBS': { simple: 'IBS (Digestive Issues)', tooltip: 'Irritable Bowel Syndrome' },
  'GERD': { simple: 'GERD (Acid Reflux)', tooltip: 'Gastroesophageal Reflux Disease' },
  'MST': { simple: 'MST (Military Sexual Trauma)', tooltip: 'Military Sexual Trauma' },
  'MOS': { simple: 'Military Job Code', tooltip: 'Military Occupational Specialty - the veteran\'s job in the military' },
};

// Tools most relevant to caregivers/family members
export const CAREGIVER_PRIORITY_TOOLS = [
  'Witness Bench',      // They may need to write buddy statements
  'State Benefits',     // Tax exemptions, etc.
  'Symptom Logger',     // They can help document symptoms
  'Forms Helper',       // Help with paperwork
  'VSO Finder',         // Find free help
  'Field Manual',       // Understanding how to use the site
];

export function HelperModeProvider({ children }) {
  const [isHelperMode, setIsHelperMode] = useState(() => {
    return localStorage.getItem('vetrate-helper-mode') === 'true';
  });

  const [showHelperTooltips, setShowHelperTooltips] = useState(() => {
    const saved = localStorage.getItem('vetrate-helper-tooltips');
    return saved === null ? true : saved === 'true';
  });

  // Save to localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem('vetrate-helper-mode', isHelperMode.toString());
    localStorage.setItem('vetrate-helper-tooltips', showHelperTooltips.toString());
  }, [isHelperMode, showHelperTooltips]);

  // Toggle helper mode
  const toggleHelperMode = () => {
    setIsHelperMode(prev => !prev);
  };

  // Get the appropriate terminology
  const getTerm = (term) => {
    if (!isHelperMode) return term;
    const translation = TERMINOLOGY[term];
    return translation ? translation.simple : term;
  };

  // Get tooltip for a term
  const getTooltip = (term) => {
    const translation = TERMINOLOGY[term];
    return translation ? translation.tooltip : null;
  };

  // Check if a tool is priority for caregivers
  const isCaregiverPriority = (toolName) => {
    return CAREGIVER_PRIORITY_TOOLS.some(t => 
      toolName.toLowerCase().includes(t.toLowerCase())
    );
  };

  const value = {
    isHelperMode,
    setIsHelperMode,
    toggleHelperMode,
    showHelperTooltips,
    setShowHelperTooltips,
    getTerm,
    getTooltip,
    isCaregiverPriority,
    TERMINOLOGY,
  };

  return (
    <HelperModeContext.Provider value={value}>
      {children}
    </HelperModeContext.Provider>
  );
}

export function useHelperMode() {
  const context = useContext(HelperModeContext);
  if (!context) {
    throw new Error('useHelperMode must be used within a HelperModeProvider');
  }
  return context;
}

export default HelperModeContext;
