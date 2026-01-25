/**
 * SAFETY NETS INTEGRATION GUIDE
 * Quick reference for wiring up the three new safety net features
 */

// ============================================================================
// 1. INTENT TO FILE GUARD - Add to App.jsx
// ============================================================================

// In src/App.jsx:
import IntentToFileGuard from './components/IntentToFileGuard';

function App() {
  return (
    <div className="App">
      {/* Add at the very top, before all other UI */}
      <IntentToFileGuard />
      
      <Header />
      {/* Rest of app */}
    </div>
  );
}

// ============================================================================
// 2. VSO HANDOFF REPORT - Add Export Button
// ============================================================================

// Example A: In PathfinderDashboard.jsx (Strategic View)
import { generateAndDownloadVSOHandoff } from '../utils/providerBriefGenerator';

function PathfinderDashboard({ rankedClaims }) {
  const handleVSOExport = () => {
    // Gather user profile from state/localStorage
    const userProfile = {
      firstName: localStorage.getItem('vet_rate_first_name') || 'John',
      lastName: localStorage.getItem('vet_rate_last_name') || 'Doe',
      dob: localStorage.getItem('vet_rate_dob') || '1985-05-15',
      serviceEra: localStorage.getItem('vet_rate_service_era') || 'Post-9/11',
      dischargeStatus: localStorage.getItem('vet_rate_discharge_status') || 'Honorable',
      spnCode: localStorage.getItem('vet_rate_spn_code') || 'N/A',
      pactStatus: localStorage.getItem('vet_rate_pact_eligible') === 'true',
      hasCombatMedal: localStorage.getItem('vet_rate_combat_medal') === 'true',
      serviceStartDate: localStorage.getItem('vet_rate_service_start') || '',
      serviceEndDate: localStorage.getItem('vet_rate_service_end') || '',
      phone: localStorage.getItem('vet_rate_phone') || '',
      email: localStorage.getItem('vet_rate_email') || '',
      ssn: localStorage.getItem('vet_rate_ssn') || '' // Will show last 4 digits only
    };

    // Use rankedClaims from PathfinderDashboard props
    generateAndDownloadVSOHandoff(userProfile, rankedClaims, {
      includeAllClaims: false // Only >60% viability claims
    });
  };

  return (
    <div>
      {/* Add button in header/toolbar */}
      <div className="flex justify-between items-center mb-6">
        <h2>Pathfinder: Claim Strategy</h2>
        <button
          onClick={handleVSOExport}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded flex items-center gap-2"
        >
          📋 Export to VSO
        </button>
      </div>
      
      {/* Claim cards */}
      {rankedClaims.map(claim => <ClaimCard key={claim.id} claim={claim} />)}
    </div>
  );
}

// Example B: In MyPacket.jsx (Evidence Management)
import { generateAndDownloadVSOHandoff } from '../utils/providerBriefGenerator';

function MyPacket() {
  const handleVSOHandoff = () => {
    // Reconstruct claims list from saved data
    const savedClaims = JSON.parse(localStorage.getItem('vet_rate_saved_claims') || '[]');
    
    const claimsList = savedClaims.map(claim => ({
      name: claim.conditionName,
      score: claim.viabilityScore || 50,
      strategyNote: claim.strategyNote || 'Direct service connection',
      requirements: claim.checklist || [],
      category: claim.category || 'Other',
      tags: claim.tags || [],
      isPresumptive: claim.isPresumptive || false
    }));

    const userProfile = {
      /* ... same as above ... */
    };

    generateAndDownloadVSOHandoff(userProfile, claimsList);
  };

  return (
    <div>
      <button onClick={handleVSOHandoff} className="btn-primary">
        📋 Generate VSO Handoff Report
      </button>
      {/* Packet contents */}
    </div>
  );
}

// ============================================================================
// 3. BLUE BUTTON INJECTION - Wire to BlueButtonXRay
// ============================================================================

// In src/components/BlueButtonXRay.jsx:
import { injectMedicalData, getInjectionSummary } from '../hooks/useBlueButtonInjection';

function BlueButtonXRay() {
  const [problemList, setProblemList] = useState([]);
  const [injectionSummary, setInjectionSummary] = useState([]);

  const handleFileUpload = async (file) => {
    // Parse Blue Button XML/JSON (existing logic)
    const parsedData = await parseBlueButtonFile(file);
    
    // Extract diagnosis codes
    const diagnosisCodes = parsedData.conditions.map(condition => {
      // Format: "ICD-10: G47.33 - Obstructive Sleep Apnea"
      return `ICD-10: ${condition.code} - ${condition.name}`;
    });
    
    setProblemList(diagnosisCodes);

    // ========================================
    // NEW: Inject into intake answers
    // ========================================
    const { answers, tags } = injectMedicalData(diagnosisCodes);
    
    // Merge with existing intake answers
    const currentAnswers = JSON.parse(localStorage.getItem('vet_rate_intake_answers') || '{}');
    const updatedAnswers = { ...currentAnswers, ...answers };
    localStorage.setItem('vet_rate_intake_answers', JSON.stringify(updatedAnswers));

    // Merge with existing user tags
    const currentTags = JSON.parse(localStorage.getItem('vet_rate_user_tags') || '[]');
    const updatedTags = [...new Set([...currentTags, ...tags])];
    localStorage.setItem('vet_rate_user_tags', JSON.stringify(updatedTags));

    // Generate summary for display
    const summary = getInjectionSummary(diagnosisCodes);
    setInjectionSummary(summary);

    // Show success notification
    alert(`✅ Auto-answered ${Object.keys(answers).length} questions from Blue Button!\n` +
          `Added ${tags.length} medical tags.`);
  };

  return (
    <div>
      {/* File upload */}
      <input type="file" onChange={(e) => handleFileUpload(e.target.files[0])} />

      {/* Display injection summary */}
      {injectionSummary.length > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-500 rounded p-4 mt-4">
          <h3 className="font-bold text-green-700 dark:text-green-300">
            ✅ Auto-Answered Questions from Blue Button
          </h3>
          <ul className="mt-2 space-y-1 text-sm">
            {injectionSummary.map((item, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <span className="font-mono text-xs">{item.icd10}</span>
                <span className="text-gray-600 dark:text-gray-400">{item.condition}</span>
                <span className="ml-auto px-2 py-0.5 bg-green-100 dark:bg-green-800 rounded text-xs">
                  {item.confidence} confidence
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Existing BlueButtonXRay UI */}
    </div>
  );
}

// ============================================================================
// 4. SMART INTAKE - Automatic Question Skipping
// ============================================================================

// In src/components/SmartIntake.jsx (or wherever intake form is):
import { getFilteredQuestions } from '../hooks/useSmartIntake';

function SmartIntake() {
  // Load auto-answered questions from localStorage
  const userAnswers = JSON.parse(localStorage.getItem('vet_rate_intake_answers') || '{}');
  const userTags = JSON.parse(localStorage.getItem('vet_rate_user_tags') || '[]');

  // Get filtered questions (auto-answered questions are skipped)
  const filteredQuestions = getFilteredQuestions(userTags, userAnswers);

  return (
    <div>
      <h2>Smart Intake Form</h2>
      
      {/* Show efficiency metric */}
      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded mb-4">
        <p className="text-sm">
          ✅ Skipped {totalQuestions - filteredQuestions.length} of {totalQuestions} questions
          {' '}({Math.round((1 - filteredQuestions.length / totalQuestions) * 100)}% faster)
        </p>
      </div>

      {/* Render only unanswered questions */}
      {filteredQuestions.map(q => (
        <QuestionCard key={q.id} question={q} />
      ))}
    </div>
  );
}

// ============================================================================
// 5. STATE MANAGEMENT INTEGRATION (Optional - Future Enhancement)
// ============================================================================

// If you decide to create a centralized store (src/store/gatewayStore.js):

import create from 'zustand';
import { persist } from 'zustand/middleware';
import { injectMedicalData } from '../hooks/useBlueButtonInjection';

export const useGatewayStore = create(
  persist(
    (set, get) => ({
      // State
      userProfile: {},
      userTags: [],
      intakeAnswers: {},
      claimsList: [],

      // Actions
      setUserProfile: (profile) => set({ userProfile: profile }),

      addUserTags: (tags) => set((state) => ({
        userTags: [...new Set([...state.userTags, ...tags])]
      })),

      updateIntakeAnswers: (answers) => set((state) => ({
        intakeAnswers: { ...state.intakeAnswers, ...answers }
      })),

      // Blue Button injection action
      injectMedicalData: (problemList) => {
        const { answers, tags } = injectMedicalData(problemList);
        
        set((state) => ({
          intakeAnswers: { ...state.intakeAnswers, ...answers },
          userTags: [...new Set([...state.userTags, ...tags])]
        }));

        return { answers, tags };
      },

      // Add claim to list
      addClaim: (claim) => set((state) => ({
        claimsList: [...state.claimsList, claim]
      })),

      // Export to VSO
      exportToVSO: () => {
        const { userProfile, claimsList } = get();
        generateAndDownloadVSOHandoff(userProfile, claimsList);
      }
    }),
    {
      name: 'gateway-store', // localStorage key
      getStorage: () => localStorage
    }
  )
);

// Usage in components:
import { useGatewayStore } from '../store/gatewayStore';

function MyComponent() {
  const { intakeAnswers, injectMedicalData } = useGatewayStore();

  const handleBlueButtonParse = (problemList) => {
    const { answers, tags } = injectMedicalData(problemList);
    alert(`Injected ${Object.keys(answers).length} answers and ${tags.length} tags!`);
  };

  return <div>...</div>;
}

// ============================================================================
// TESTING SNIPPETS
// ============================================================================

// Test Intent to File Guard
localStorage.removeItem('vet_rate_itf_date'); // Reset for testing
// Refresh page - should see blue alert banner

// Test VSO Handoff
const testUserProfile = {
  firstName: 'Test',
  lastName: 'Veteran',
  dob: '1985-05-15',
  serviceEra: 'Post-9/11',
  dischargeStatus: 'Honorable',
  spnCode: 'JFX',
  pactStatus: true,
  hasCombatMedal: true,
  serviceStartDate: '2005-01-01',
  serviceEndDate: '2013-12-31',
  phone: '555-1234',
  email: 'test@example.com',
  ssn: '123-45-6789'
};

const testClaims = [
  {
    name: 'PTSD',
    score: 85,
    strategyNote: 'Combat-related with buddy statements',
    requirements: [{ met: true }, { met: true }, { met: false }],
    category: 'Mental Health',
    tags: ['COMBAT_STRESSOR'],
    isPresumptive: false
  }
];

import { generateAndDownloadVSOHandoff } from './utils/providerBriefGenerator';
generateAndDownloadVSOHandoff(testUserProfile, testClaims);

// Test Blue Button Injection
import { injectMedicalData } from './hooks/useBlueButtonInjection';

const testProblemList = [
  'ICD-10: G47.33 - Obstructive Sleep Apnea',
  'ICD-10: F43.10 - PTSD',
  'ICD-10: M54.5 - Low Back Pain'
];

const { answers, tags } = injectMedicalData(testProblemList);
console.log('Auto-Answers:', answers);
console.log('Auto-Tags:', tags);
