/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * 
 * DemoDataLoader Component
 * "The Gold Standard" - Pre-fills app with example veteran claim
 * Shows users what a "perfect" claim looks like before they start
 */

import React, { useState } from 'react';
import { saveClaim, saveStatement, clearAllClaims, getSavedClaims } from '../utils/claimsStorage';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * Demo data representing a complete, well-documented claim
 * "Sgt. John Doe" - Fictional veteran with common conditions
 */
const DEMO_VETERAN_DATA = {
  profile: {
    name: 'John Doe',
    rank: 'SGT',
    branch: 'Army',
    mos: '11B - Infantry',
    serviceStart: '2008-06-15',
    serviceEnd: '2016-08-20',
    deployments: ['OIF (Iraq) 2009-2010', 'OEF (Afghanistan) 2012-2013'],
    currentRating: 0
  },
  
  claims: [
    // Primary Condition 1: Tinnitus
    {
      conditionName: 'Tinnitus',
      diagnosticCode: '6260',
      parentCondition: null,
      status: 'Statement Generated',
      notes: 'Constant ringing in both ears since deployment. Exposed to IED blasts and weapon fire without adequate hearing protection during patrols.',
      targetRating: 10,
      ratingSchedule: '38 CFR § 4.87',
      dateSaved: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days ago
    },
    
    // Primary Condition 2: Lumbar Strain
    {
      conditionName: 'Lumbosacral Strain',
      diagnosticCode: '5237',
      parentCondition: null,
      status: 'Statement Generated',
      notes: 'Lower back injury from carrying heavy combat loads (80+ lbs) during dismounted patrols. MRI shows L4-L5 disc bulge.',
      targetRating: 20,
      ratingSchedule: '38 CFR § 4.71a',
      dateSaved: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() // 5 days ago
    },
    
    // Secondary Condition: Migraines (secondary to Tinnitus)
    {
      conditionName: 'Migraine Headaches',
      diagnosticCode: '8100',
      parentCondition: 'Tinnitus',
      status: 'Drafting',
      notes: 'Chronic migraines began 6 months after tinnitus onset. Neurologist confirmed connection between constant tinnitus and migraine triggers.',
      targetRating: 30,
      ratingSchedule: '38 CFR § 4.124a',
      dateSaved: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days ago
    },
    
    // Secondary Condition: Radiculopathy (secondary to Lumbar Strain)
    {
      conditionName: 'Sciatic Nerve Paralysis (Radiculopathy)',
      diagnosticCode: '8520',
      parentCondition: 'Lumbosacral Strain',
      status: 'Drafting',
      notes: 'Left leg radiculopathy stemming from L4-L5 disc bulge. Numbness and shooting pain down left leg.',
      targetRating: 20,
      ratingSchedule: '38 CFR § 4.124a',
      dateSaved: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days ago
    }
  ],
  
  statements: {
    // Statement for Tinnitus
    tinnitus: {
      condition: 'Tinnitus',
      inServiceEvent: `During my deployment to Iraq (2009-2010) and Afghanistan (2012-2013) as an Infantry Sergeant (11B), I was repeatedly exposed to acoustic trauma without adequate hearing protection. Specific incidents include:

• January 2010: IED detonation approximately 15 meters from my position during a mounted patrol in Diyala Province. I experienced immediate hearing loss and ringing that lasted several days.

• Multiple exposure to M2 .50 caliber machine gun fire during convoy operations (estimated 200+ hours cumulative exposure).

• March 2013: Rocket attack on FOB Shank. I was within 50 meters of multiple impact sites and experienced concussive effects.

My service treatment records document complaints of ear ringing on multiple occasions, including entries dated February 2010 and April 2013.`,
      
      currentDiagnosis: `I currently experience constant bilateral tinnitus characterized by:

• A high-pitched ringing sound in both ears, rated 7/10 intensity
• The ringing is present 24/7 and never fully subsides
• Symptoms worsen in quiet environments, particularly affecting sleep
• I require white noise machines to achieve any sleep
• The condition causes difficulty concentrating during conversations

My audiologist at the Portland VA Medical Center diagnosed me with bilateral subjective tinnitus on March 15, 2024, directly attributing it to noise exposure during military service.`,
      
      nexusStatement: `Based on the documented acoustic trauma during my military service and the continuous nature of my symptoms since deployment, my tinnitus is at least as likely as not caused by or aggravated by my military service.

The temporal relationship is clear: I had no hearing issues prior to service, experienced documented acoustic trauma during combat operations, and have had continuous tinnitus symptoms since my first deployment. My VA audiologist has confirmed this service connection in her medical opinion dated March 15, 2024.`,
      
      savedDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()
    },
    
    // Statement for Lumbar Strain
    lumbar: {
      condition: 'Lumbosacral Strain',
      inServiceEvent: `During my eight years of Army Infantry service (2008-2016), I was subjected to extreme physical demands that directly caused my lower back condition:

• Routine combat patrols carrying 80-120 lbs of equipment (body armor, ammunition, water, pack)
• Multiple parachute jumps (23 total) with combat equipment loads
• August 2012: Acute back injury during dismounted patrol in Logar Province when I fell into an irrigation ditch while wearing full combat load. I was evacuated to the aid station and placed on limited duty for 2 weeks.
• Service treatment records document multiple sick call visits for lower back pain: September 2012, February 2013, November 2014.

I was prescribed Motrin and muscle relaxers multiple times but never received definitive treatment due to operational requirements.`,
      
      currentDiagnosis: `Current symptoms of my lumbosacral condition include:

• Chronic lower back pain rated 6/10 at rest, 8/10 with activity
• Limited range of motion: I cannot bend forward past 45 degrees without severe pain
• Pain radiates into my left buttock and down my leg (radiculopathy)
• I cannot sit for more than 30 minutes without needing to stand and stretch
• Flare-ups occur 3-4 times per month, lasting 2-3 days each

MRI dated June 2024 confirms: L4-L5 disc bulge with mild foraminal narrowing and facet joint arthropathy. My VA orthopedic physician diagnosed lumbosacral strain with degenerative changes on July 8, 2024.`,
      
      nexusStatement: `The connection between my military service and current lumbar condition is medically established:

1. Documented in-service injury (August 2012) and multiple treatments
2. Continuous symptoms since service, progressively worsening
3. Imaging confirming structural damage consistent with repetitive trauma
4. VA physician's nexus opinion dated July 8, 2024 stating condition is "at least as likely as not" related to documented in-service injuries

There is no intervening cause - I have had no accidents or injuries since separation that could explain my lumbar degeneration.`,
      
      savedDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
    }
  },
  
  // Evidence timeline events
  timeline: [
    {
      id: 'evt_001',
      date: '2010-01-15',
      type: 'incident',
      title: 'IED Blast Exposure',
      description: 'IED detonation 15m from position during patrol. Immediate tinnitus and temporary hearing loss.',
      location: 'Diyala Province, Iraq',
      witnesses: ['SSG Michael Torres', 'SPC David Kim'],
      evidence: ['Incident Report #2010-DIY-0892', 'Medical Record Entry 01/16/2010']
    },
    {
      id: 'evt_002',
      date: '2012-08-22',
      type: 'injury',
      title: 'Back Injury During Patrol',
      description: 'Fell into irrigation ditch with full combat load. Acute lower back pain, evacuated to aid station.',
      location: 'Logar Province, Afghanistan',
      witnesses: ['SFC James Wilson'],
      evidence: ['SF-600 Chronological Record', 'Limited Duty Profile 08/23/2012']
    },
    {
      id: 'evt_003',
      date: '2024-03-15',
      type: 'diagnosis',
      title: 'VA Audiology Diagnosis',
      description: 'Bilateral subjective tinnitus diagnosed. Audiologist confirmed service connection.',
      location: 'Portland VA Medical Center',
      witnesses: [],
      evidence: ['Audiology Consult Note', 'Nexus Letter']
    }
  ],
  
  // Symptom log entries
  symptomLog: [
    {
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      condition: 'Tinnitus',
      severity: 7,
      notes: 'Ringing very loud today. Had trouble sleeping last night. Used white noise but still took 2 hours to fall asleep.',
      triggers: ['Quiet room', 'Stress from bills']
    },
    {
      date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      condition: 'Lumbosacral Strain',
      severity: 8,
      notes: 'Major flare-up after helping neighbor move boxes. Had to use heating pad all evening. Took ibuprofen.',
      triggers: ['Heavy lifting', 'Bending']
    },
    {
      date: new Date().toISOString(),
      condition: 'Migraine Headaches',
      severity: 6,
      notes: 'Moderate migraine started mid-morning. Tinnitus seems louder than usual. Took Excedrin, resting in dark room.',
      triggers: ['Tinnitus spike', 'Screen time']
    }
  ]
};

/**
 * Load demo data into the application
 */
export const loadDemoData = () => {
  try {
    // Clear existing data first
    clearAllClaims();
    
    // Save each claim
    DEMO_VETERAN_DATA.claims.forEach(claim => {
      saveClaim({
        ...claim,
        id: `demo_${claim.diagnosticCode}_${Date.now()}`,
      });
    });
    
    // Get saved claims to match IDs for statements
    const savedClaims = getSavedClaims();
    
    // Save statements for conditions that have them
    const tinnitusClaim = savedClaims.find(c => c.conditionName === 'Tinnitus');
    const lumbarClaim = savedClaims.find(c => c.conditionName === 'Lumbosacral Strain');
    
    if (tinnitusClaim) {
      saveStatement(tinnitusClaim.id, {
        ...DEMO_VETERAN_DATA.statements.tinnitus,
        claimId: tinnitusClaim.id
      });
    }
    
    if (lumbarClaim) {
      saveStatement(lumbarClaim.id, {
        ...DEMO_VETERAN_DATA.statements.lumbar,
        claimId: lumbarClaim.id
      });
    }
    
    // Save timeline events
    localStorage.setItem('vetrate_evidence_timeline', JSON.stringify(DEMO_VETERAN_DATA.timeline));
    
    // Save symptom log
    localStorage.setItem('vetrate_symptom_log', JSON.stringify(DEMO_VETERAN_DATA.symptomLog));
    
    // Save veteran profile
    localStorage.setItem('vetrate_veteran_profile', JSON.stringify(DEMO_VETERAN_DATA.profile));
    
    console.log('✅ Demo data loaded successfully');
    return true;
  } catch (error) {
    console.error('❌ Error loading demo data:', error);
    return false;
  }
};

/**
 * Check if demo data is currently loaded
 */
export const isDemoDataLoaded = () => {
  const profile = localStorage.getItem('vetrate_veteran_profile');
  if (profile) {
    try {
      const parsed = JSON.parse(profile);
      return parsed.name === 'John Doe';
    } catch {
      return false;
    }
  }
  return false;
};

/**
 * Clear demo data and reset to clean state
 */
export const clearDemoData = () => {
  clearAllClaims();
  localStorage.removeItem('vetrate_evidence_timeline');
  localStorage.removeItem('vetrate_symptom_log');
  localStorage.removeItem('vetrate_veteran_profile');
};

/**
 * DemoDataLoader Component
 * Shows a link/button to load example data with confirmation
 */
const DemoDataLoader = ({ onDataLoaded, variant = 'link' }) => {
  const { t } = useLanguage();
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const handleLoadDemo = () => {
    // Check if there's existing data
    const existingClaims = getSavedClaims();
    if (existingClaims.length > 0) {
      setShowConfirm(true);
    } else {
      performLoad();
    }
  };
  
  const performLoad = () => {
    setLoading(true);
    
    // Small delay to show loading state
    setTimeout(() => {
      const success = loadDemoData();
      setLoading(false);
      setShowConfirm(false);
      
      if (success && onDataLoaded) {
        onDataLoaded();
      }
    }, 500);
  };
  
  if (variant === 'card') {
    return (
      <>
        <div className="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📋</span>
            <div className="flex-1">
              <h3 className="font-bold text-white mb-1">New to Vet-Rate?</h3>
              <p className="text-gray-300 text-sm mb-3">
                See what a <strong>complete, well-documented claim</strong> looks like. 
                Load our example packet to learn by example.
              </p>
              <button
                onClick={handleLoadDemo}
                disabled={loading}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Loading...
                  </>
                ) : (
                  <>
                    <span>📥</span>
                    Load Example Packet
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        
        {/* Confirmation Modal */}
        {showConfirm && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 border border-yellow-500/50 rounded-lg max-w-md w-full p-6">
              <div className="text-center mb-4">
                <span className="text-4xl">⚠️</span>
              </div>
              <h3 className="text-xl font-bold text-yellow-400 text-center mb-3">
                Replace Current Data?
              </h3>
              <p className="text-gray-300 text-center mb-6">
                Loading example data will <strong className="text-red-400">overwrite</strong> your current saved claims and statements. 
                This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  onClick={performLoad}
                  disabled={loading}
                  className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white py-2 rounded font-semibold transition disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Load Example'}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
  
  // Default: Link variant
  return (
    <>
      <button
        onClick={handleLoadDemo}
        disabled={loading}
        className="text-blue-400 hover:text-blue-300 text-sm underline underline-offset-2 transition-colors disabled:opacity-50"
      >
        {loading ? '⏳ Loading...' : '📋 New here? Load Example Data to see how it works'}
      </button>
      
      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-yellow-500/50 rounded-lg max-w-md w-full p-6">
            <div className="text-center mb-4">
              <span className="text-4xl">⚠️</span>
            </div>
            <h3 className="text-xl font-bold text-yellow-400 text-center mb-3">
              Replace Current Data?
            </h3>
            <p className="text-gray-300 text-center mb-6">
              Loading example data will <strong className="text-red-400">overwrite</strong> your current saved claims and statements. 
              This action cannot be undone.
            </p>
            <p className="text-gray-400 text-sm text-center mb-6">
              💡 Tip: Use the Backup Manager to save your current data first.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={performLoad}
                disabled={loading}
                className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white py-2 rounded font-semibold transition disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Proceed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DemoDataLoader;
