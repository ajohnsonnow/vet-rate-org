/**
 * SupplyLocker.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * C&P Simulator Rating Calculator
 * 
 * Contains rating calculation logic for each condition based on 38 CFR Part 4.
 * These functions analyze user responses and predict ratings with gap analysis.
 * 
 * CRITICAL: All rating criteria are based on verbatim 38 CFR Part 4 requirements.
 */

/**
 * Calculate Migraine rating based on 38 CFR § 4.124a
 * 
 * Rating criteria:
 * - 50%: "With very frequent completely prostrating and prolonged attacks productive of severe economic inadaptability"
 * - 30%: "With characteristic prostrating attacks occurring on an average once a month over last several months"
 * - 10%: "With characteristic prostrating attacks averaging one in 2 months over last several months"
 * - 0%: "With less frequent attacks"
 */
export function calculateMigraineRating(answers) {
  const result = {
    predictedRating: 0,
    ratingRationale: '',
    gaps: [],
    actionItems: [],
    warnings: []
  };

  const q1 = answers.q1; // Prostrating nature
  const q2 = answers.q2; // Frequency
  const q3 = answers.q3; // Economic inadaptability
  const q4 = answers.q4; // Duration (prolonged)

  // Check if attacks are prostrating (required for any rating above 0%)
  if (q1 !== 'yes_always' && q1 !== 'yes_sometimes') {
    result.predictedRating = 0;
    result.ratingRationale = 'Your answers indicate attacks that do not require stopping activities and lying down. The VA requires attacks to be "prostrating" (completely incapacitating) for a compensable rating.';
    result.gaps.push('Your migraines must be "prostrating" - meaning you must stop all activity and lie down, usually in a dark, quiet room.');
    result.actionItems.push('During the exam, clearly describe that when a migraine hits, you cannot continue working or functioning.');
    result.actionItems.push('Use the specific word "prostrating" when describing your attacks.');
    return result;
  }

  // Check for 50% rating criteria
  // Requires: very frequent + completely prostrating + prolonged + economic inadaptability
  if (q1 === 'yes_always' && 
      q2 === 'very_frequent' && 
      q3 === 'yes_severe' && 
      (q4 === 'days' || q4 === 'many_hours')) {
    
    result.predictedRating = 50;
    result.ratingRationale = 'Your answers align with the 50% rating criteria: very frequent (2+ per month), completely prostrating, prolonged attacks that are productive of severe economic inadaptability (missing work/losing job opportunities).';
    result.actionItems.push('Bring sick leave records showing missed work days due to migraines.');
    result.actionItems.push('Bring a letter from your employer documenting impact on work.');
    result.actionItems.push('Bring your headache diary showing frequency over the last 6-12 months.');
    result.actionItems.push('If you have lost jobs due to migraines, document this.');
    return result;
  }

  // Check for 30% rating criteria
  // Requires: prostrating + averaging once a month
  if (q2 === 'monthly' || q2 === 'very_frequent') {
    result.predictedRating = 30;
    result.ratingRationale = 'Your answers align with the 30% rating criteria: characteristic prostrating attacks occurring on average once a month or more over the last several months.';
    
    // Analyze gap to 50%
    result.gaps.push('**Gap to 50% Rating:**');
    
    if (q3 !== 'yes_severe') {
      result.gaps.push('• The 50% rating requires evidence of "severe economic inadaptability" - meaning the attacks prevent you from maintaining employment or cause significant income loss.');
      result.actionItems.push('Document any missed work days, lost wages, or job losses due to migraines.');
      result.actionItems.push('Bring sick leave records to the exam.');
    }
    
    if (q4 !== 'days' && q4 !== 'many_hours') {
      result.gaps.push('• The 50% rating requires attacks to be "prolonged" (lasting many hours or days).');
      result.actionItems.push('Track how long your prostrating attacks last - if they last 4+ hours, document this.');
    }
    
    if (q2 !== 'very_frequent') {
      result.gaps.push('• The 50% rating requires "very frequent" attacks (typically interpreted as 2+ per month).');
      result.actionItems.push('Keep a detailed headache diary showing frequency.');
    }
    
    result.actionItems.push('Bring a headache diary covering the last 6-12 months.');
    result.actionItems.push('Mention all associated symptoms: nausea, vomiting, photophobia, phonophobia.');
    
    return result;
  }

  // Check for 10% rating criteria
  // Requires: prostrating + averaging 1 in 2 months
  if (q2 === 'bi_monthly') {
    result.predictedRating = 10;
    result.ratingRationale = 'Your answers align with the 10% rating criteria: characteristic prostrating attacks averaging one in 2 months over the last several months.';
    
    // Analyze gap to 30%
    result.gaps.push('**Gap to 30% Rating:**');
    result.gaps.push('• The 30% rating requires prostrating attacks to occur on average once a month (not every 2 months).');
    result.actionItems.push('Keep a detailed headache diary. If your frequency increases to monthly, this would support a 30% rating.');
    result.actionItems.push('During flare-ups or high-stress periods, document if frequency increases.');
    
    // Analyze gap to 50%
    result.gaps.push('**Gap to 50% Rating:**');
    result.gaps.push('• Would require very frequent attacks (2+ per month), economic inadaptability, and prolonged duration.');
    
    result.actionItems.push('Bring your headache diary to the exam.');
    result.actionItems.push('Mention all associated symptoms and severity.');
    
    return result;
  }

  // Less than once every 2 months = 0%
  result.predictedRating = 0;
  result.ratingRationale = 'Your answers indicate prostrating attacks less frequently than once every 2 months. The minimum compensable rating (10%) requires attacks averaging one in 2 months.';
  result.gaps.push('To qualify for a 10% rating, you need prostrating attacks at least once every 2 months on average.');
  result.actionItems.push('Keep a detailed headache diary for the next 6-12 months to document frequency.');
  result.actionItems.push('If your condition worsens, file for an increase.');
  
  return result;
}

/**
 * Calculate PTSD rating based on 38 CFR § 4.130
 * 
 * Ratings based on level of occupational and social impairment:
 * - 100%: Total occupational and social impairment
 * - 70%: Occupational and social impairment, with deficiencies in most areas
 * - 50%: Occupational and social impairment with reduced reliability and productivity
 * - 30%: Occupational and social impairment with occasional decrease in work efficiency
 * - 10%: Occupational and social impairment due to mild or occasional symptoms
 * - 0%: Symptoms do not interfere with work
 */
export function calculatePTSDRating(answers) {
  const result = {
    predictedRating: 0,
    ratingRationale: '',
    gaps: [],
    actionItems: [],
    warnings: []
  };

  const q1 = answers.q1; // Symptom frequency
  const q2 = answers.q2; // Occupational impairment
  const q3 = answers.q3; // Social impairment
  const q4 = answers.q4; // Suicidal ideation

  // Calculate total severity score
  const q1Weight = { near_continuous: 3, weekly: 2, occasional: 1, rarely: 0 }[q1] || 0;
  const q2Weight = { severe: 3, reduced_reliability: 2, intermittent: 1, occasional: 0.5 }[q2] || 0;
  const q3Weight = { total: 3, severe: 2, moderate: 1, mild: 0.5 }[q3] || 0;
  const q4Weight = { yes_frequent: 3, yes_occasional: 2, past_not_current: 1, no: 0 }[q4] || 0;

  const totalScore = q1Weight + q2Weight + q3Weight + q4Weight;

  // Suicidal ideation check
  if (q4 === 'yes_frequent' || q4 === 'yes_occasional') {
    result.warnings.push('⚠️ CRITICAL: You indicated suicidal thoughts. This is a key symptom for high ratings (70-100%). You MUST mention this to the examiner.');
    result.actionItems.push('Tell the examiner about suicidal thoughts - frequency, triggers, whether you have a plan.');
    result.actionItems.push('If you are in crisis, call 988 (Suicide & Crisis Lifeline) immediately.');
  }

  // Determine rating based on total score and specific criteria
  if (totalScore >= 9 || q2 === 'severe' || q3 === 'total' || q4 === 'yes_frequent') {
    // 70-100% range
    if (q2 === 'severe' && q3 === 'total') {
      result.predictedRating = 100;
      result.ratingRationale = 'Your answers indicate total occupational and social impairment - inability to work and maintain any relationships. This aligns with a 100% rating.';
      result.actionItems.push('Document inability to maintain employment.');
      result.actionItems.push('Bring statements from family/friends about social impairment.');
      result.actionItems.push('Mention any hospitalizations or crisis interventions.');
    } else {
      result.predictedRating = 70;
      result.ratingRationale = 'Your answers indicate occupational and social impairment with deficiencies in most areas. This aligns with a 70% rating. Symptoms include near-continuous symptoms, severe occupational or social impairment, or frequent suicidal ideation.';
      
      result.gaps.push('**Gap to 100% Rating:**');
      result.gaps.push('• The 100% rating requires TOTAL occupational and social impairment - complete inability to work and maintain any relationships.');
      if (q2 !== 'severe') {
        result.gaps.push('• You would need to demonstrate complete inability to maintain employment.');
      }
      if (q3 !== 'total') {
        result.gaps.push('• You would need to demonstrate complete social isolation and inability to maintain any relationships.');
      }
    }
    
  } else if (totalScore >= 6 || q2 === 'reduced_reliability' || q3 === 'severe') {
    // 50% range
    result.predictedRating = 50;
    result.ratingRationale = 'Your answers indicate occupational and social impairment with reduced reliability and productivity. This aligns with a 50% rating. This means you work but miss days, have poor performance, or struggle significantly with relationships.';
    
    result.gaps.push('**Gap to 70% Rating:**');
    result.gaps.push('• The 70% rating requires "deficiencies in most areas" - near-continuous symptoms affecting work, relationships, self-care, judgment, thinking, and mood.');
    result.gaps.push('• Specific symptoms for 70% include: suicidal ideation, obsessional rituals interfering with routine, speech abnormalities, neglect of personal hygiene, inability to maintain relationships.');
    
    result.actionItems.push('Document missed work days, poor performance reviews, or disciplinary actions.');
    result.actionItems.push('Bring buddy statements from coworkers, family, or friends.');
    result.actionItems.push('Mention any ER visits, hospitalizations, or crisis hotline calls.');
    
  } else if (totalScore >= 3 || q2 === 'intermittent' || q3 === 'moderate') {
    // 30% range
    result.predictedRating = 30;
    result.ratingRationale = 'Your answers indicate occupational and social impairment with occasional decrease in work efficiency and intermittent periods of inability to perform occupational tasks. This aligns with a 30% rating.';
    
    result.gaps.push('**Gap to 50% Rating:**');
    result.gaps.push('• The 50% rating requires "reduced reliability and productivity" - meaning you frequently miss work, have poor performance, or have difficulty maintaining employment.');
    result.gaps.push('• Specific symptoms for 50% include: flattened affect, panic attacks (weekly or more), difficulty understanding complex commands, impairment of short/long-term memory, impaired judgment, disturbances of motivation and mood.');
    
    result.actionItems.push('Keep a symptom diary documenting frequency and severity.');
    result.actionItems.push('If you miss work or have reduced productivity, document this.');
    result.actionItems.push('Mention all symptoms: nightmares, flashbacks, hypervigilance, avoidance, panic attacks.');
    
  } else if (totalScore >= 1) {
    // 10% range
    result.predictedRating = 10;
    result.ratingRationale = 'Your answers indicate occupational and social impairment due to mild or occasional symptoms. This aligns with a 10% rating.';
    
    result.gaps.push('**Gap to 30% Rating:**');
    result.gaps.push('• The 30% rating requires "occasional decrease in work efficiency" and "intermittent periods of inability to perform occupational tasks."');
    result.gaps.push('• This means symptoms regularly interfere with work (not just mild impact).');
    
    result.actionItems.push('Be completely honest about symptom severity - do not minimize.');
    result.actionItems.push('Describe your worst days, not your best days.');
    result.actionItems.push('Mention all PTSD symptoms, even if you think they are "normal."');
    
  } else {
    result.predictedRating = 0;
    result.ratingRationale = 'Your answers indicate symptoms that do not interfere with work or social functioning. This aligns with a 0% (non-compensable) rating.';
    result.gaps.push('To qualify for a compensable rating (10% or higher), symptoms must cause occupational or social impairment.');
    result.actionItems.push('If your symptoms worsen, document this and file for an increase.');
  }

  // General action items for all PTSD claims
  result.actionItems.push('Bring buddy statements from people who witness your symptoms.');
  result.actionItems.push('Bring treatment records showing frequency of therapy/psychiatry visits.');
  result.actionItems.push('Mention all medications and side effects.');
  result.actionItems.push('Describe how PTSD affects sleep, relationships, work, and daily life.');
  
  return result;
}

/**
 * Calculate Back Pain rating based on 38 CFR § 4.71a (General Rating Formula for Diseases of the Spine)
 */
export function calculateBackPainRating(answers) {
  const result = {
    predictedRating: 0,
    ratingRationale: '',
    gaps: [],
    actionItems: [],
    warnings: []
  };

  const q1 = answers.q1; // Forward flexion ROM
  const q2 = answers.q2; // Incapacitating episodes
  const q3 = answers.q3; // Radiculopathy
  const q4 = answers.q4; // Gait/assistive devices

  // Primary rating is based on ROM (forward flexion)
  let baseRating = 0;
  
  if (q1 === '30_or_less') {
    baseRating = 40;
    result.ratingRationale = 'Forward flexion limited to 30 degrees or less qualifies for a 40% rating under the General Rating Formula for Diseases of the Spine (38 CFR § 4.71a).';
  } else if (q1 === '30_to_60') {
    baseRating = 20;
    result.ratingRationale = 'Forward flexion limited to 30-60 degrees qualifies for a 20% rating under the General Rating Formula for Diseases of the Spine (38 CFR § 4.71a).';
    
    result.gaps.push('**Gap to 40% Rating:**');
    result.gaps.push('• The 40% rating requires forward flexion limited to 30 degrees or less.');
    result.gaps.push('• During the C&P exam, stop bending at the point where pain starts - do NOT push through the pain.');
    result.warnings.push('⚠️ CRITICAL EXAM TIP: Many veterans bend too far during ROM testing because they want to show effort. STOP at the point of pain. The examiner measures to the point where pain stops you, not where you can force yourself to go.');
  } else if (q1 === '60_to_90') {
    baseRating = 10;
    result.ratingRationale = 'Forward flexion limited to 60-90 degrees, or evidence of "painful motion," qualifies for a 10% rating under 38 CFR § 4.59 (Painful Motion).';
    
    result.gaps.push('**Gap to 20% Rating:**');
    result.gaps.push('• The 20% rating requires forward flexion limited to greater than 30 degrees but not greater than 60 degrees.');
    result.gaps.push('• If your ROM is worse on bad days or after activity, tell the examiner this.');
  } else {
    baseRating = 10; // Painful motion
    result.ratingRationale = 'Normal ROM but with pain qualifies for at least 10% under 38 CFR § 4.59 (Painful Motion). If there is no pain, the rating may be 0%.';
    
    result.gaps.push('**Why the rating is low:**');
    result.gaps.push('• The VA rates spine conditions primarily on Range of Motion (ROM). If you can bend normally (90 degrees forward flexion), the maximum rating for ROM limitation is 10%.');
    result.gaps.push('• However, you may qualify for additional ratings for intervertebral disc syndrome (IVDS), radiculopathy, or muscle spasm.');
  }

  result.predictedRating = baseRating;

  // Check for IVDS (Intervertebral Disc Syndrome) - can add to rating
  if (q2 === 'yes_frequent_episodes') {
    result.warnings.push('⚠️ IMPORTANT: You indicated frequent incapacitating episodes. This may qualify for an additional rating under DC 5243 (Intervertebral Disc Syndrome) of up to 60% if episodes total 6+ weeks per year.');
    result.actionItems.push('Bring documentation of incapacitating episodes: sick leave records, ER visits, bed rest periods.');
    result.actionItems.push('The VA defines "incapacitating" as requiring bed rest prescribed by a physician.');
  } else if (q2 === 'yes_some_episodes') {
    result.warnings.push('⚠️ IMPORTANT: You indicated some incapacitating episodes. This may qualify for an additional rating under DC 5243 (Intervertebral Disc Syndrome) of 20-40% depending on frequency.');
    result.actionItems.push('Document incapacitating episodes - when, how long, what triggered them.');
  }

  // Check for radiculopathy - can be rated separately
  if (q3 !== 'no') {
    result.warnings.push('⚠️ IMPORTANT: You indicated radiculopathy (nerve symptoms). This can be rated SEPARATELY under DC 5243 (Intervertebral Disc Syndrome) or DC 8520 (Paralysis of the Sciatic Nerve).');
    result.actionItems.push('Bring EMG/NCS (nerve conduction study) results if available.');
    result.actionItems.push('Describe the nerve symptoms: where the pain radiates, numbness, tingling, weakness.');
    result.actionItems.push('If you have weakness or loss of reflexes, make sure the examiner tests this.');
    
    if (q3 === 'yes_severe') {
      result.warnings.push('• Severe radiculopathy with weakness can be rated at 40-60% or higher depending on severity.');
    }
  }

  // Check for gait impact
  if (q4 === 'wheelchair' || q4 === 'cane_walker') {
    result.warnings.push('⚠️ IMPORTANT: You use assistive devices. This indicates significant functional impairment that should be documented in the exam.');
    result.actionItems.push('Bring the assistive device to the exam.');
    result.actionItems.push('Explain why you need it (instability, pain, weakness).');
  }

  // General action items
  result.actionItems.push('Bring all imaging reports (MRI, CT, X-ray) to the exam.');
  result.actionItems.push('Bring a list of all treatments tried: physical therapy, injections, surgery, medications.');
  result.actionItems.push('Describe morning stiffness - how long until you can move normally.');
  result.actionItems.push('If today is a "good day," tell the examiner this and describe your typical bad days.');
  result.actionItems.push('Mention any work modifications (unable to lift, stand, sit for long periods).');
  
  return result;
}

/**
 * Calculate Tinnitus rating based on 38 CFR § 4.87a
 */
export function calculateTinnitusRating(answers) {
  const result = {
    predictedRating: 0,
    ratingRationale: '',
    gaps: [],
    actionItems: [],
    warnings: []
  };

  const q1 = answers.q1;

  // Tinnitus is a flat 10% if recurrent
  if (q1 === 'yes_constant' || q1 === 'yes_frequent' || q1 === 'yes_recurrent') {
    result.predictedRating = 10;
    result.ratingRationale = 'Recurrent tinnitus is rated at a flat 10% under 38 CFR § 4.87a, Diagnostic Code 6260. There is no higher or lower rating for tinnitus alone.';
    
    result.actionItems.push('The VA does not require objective evidence of tinnitus - your report of the symptom is sufficient.');
    result.actionItems.push('Describe how tinnitus affects you: sleep problems, concentration difficulties, need for white noise.');
    result.actionItems.push('If you also have hearing loss, that is rated separately under different diagnostic codes (6100-6130).');
    
    result.warnings.push('ℹ️ NOTE: Tinnitus has only one rating level (10%). You cannot get a higher rating for more severe tinnitus.');
    result.warnings.push('ℹ️ However, if tinnitus is caused by or causes mental health issues (anxiety, depression, sleep disorders), those can be claimed separately.');
    
  } else {
    result.predictedRating = 0;
    result.ratingRationale = 'Occasional tinnitus (less than weekly) does not meet the "recurrent" criteria for a compensable rating.';
    
    result.gaps.push('To qualify for a 10% rating, tinnitus must be "recurrent" - occurring regularly (typically weekly or more).');
    result.actionItems.push('If your tinnitus frequency increases, file for service connection or an increase.');
  }

  return result;
}

/**
 * Calculate Knee Pain rating based on 38 CFR § 4.71a
 */
export function calculateKneePainRating(answers) {
  const result = {
    predictedRating: 0,
    ratingRationale: '',
    gaps: [],
    actionItems: [],
    warnings: []
  };

  const q1 = answers.q1; // Flexion ROM
  const q2 = answers.q2; // Instability
  const q3 = answers.q3; // Swelling

  // Base rating on flexion limitation (DC 5260)
  let baseRating = 0;
  
  if (q1 === '45_or_less') {
    baseRating = 30;
    result.ratingRationale = 'Knee flexion limited to 45 degrees or less qualifies for a 30% rating under DC 5260 (Limitation of Flexion of the Knee).';
  } else if (q1 === '45_to_90') {
    baseRating = 20;
    result.ratingRationale = 'Knee flexion limited to between 45-90 degrees qualifies for a 20% rating under DC 5260.';
    
    result.gaps.push('**Gap to 30% Rating:**');
    result.gaps.push('• The 30% rating requires flexion limited to 45 degrees or less.');
  } else if (q1 === '90_to_110') {
    baseRating = 10;
    result.ratingRationale = 'Knee flexion limited to between 90-110 degrees qualifies for a 10% rating under DC 5260.';
    
    result.gaps.push('**Gap to 20% Rating:**');
    result.gaps.push('• The 20% rating requires flexion limited to not more than 90 degrees.');
  } else {
    baseRating = 0;
    result.ratingRationale = 'Normal or near-normal knee flexion (110+ degrees) does not qualify for a rating based on ROM limitation alone.';
    
    result.gaps.push('**Why ROM rating is 0%:**');
    result.gaps.push('• The VA rates knee conditions primarily on Range of Motion. Normal flexion is 140 degrees.');
    result.gaps.push('• However, you may qualify for ratings based on instability, arthritis, or other factors.');
  }

  result.predictedRating = baseRating;

  // Check for instability (DC 5257) - SEPARATE rating
  if (q2 === 'severe_recurrent') {
    result.warnings.push('⚠️ IMPORTANT: Severe recurrent instability requiring a brace can qualify for a SEPARATE rating of 10-20% under DC 5257 (Recurrent Subluxation or Lateral Instability).');
    result.actionItems.push('Bring your knee brace to the exam and explain when/why you wear it.');
    result.actionItems.push('Describe specific incidents when your knee gave out (when, where, what happened).');
    result.actionItems.push('If you have ligament damage (ACL, MCL, PCL, LCL), mention this - it supports the instability rating.');
  } else if (q2 === 'moderate' || q2 === 'mild') {
    result.warnings.push('⚠️ IMPORTANT: Knee instability can qualify for a SEPARATE rating under DC 5257. You may be able to get both a flexion limitation rating AND an instability rating.');
    result.actionItems.push('Document instability episodes - when they occur, what causes them.');
  }

  // Check for swelling (can add to the rating)
  if (q3 === 'persistent') {
    result.warnings.push('⚠️ IMPORTANT: Persistent swelling can add an additional 10% to your knee rating under the notes for DC 5260.');
    result.actionItems.push('Point out the swelling during the exam.');
    result.actionItems.push('Mention if swelling limits your ability to bend the knee or causes pain.');
  } else if (q3 === 'recurrent') {
    result.warnings.push('ℹ️ Recurrent swelling should be documented. Mention when it occurs and what causes it.');
  }

  // General action items
  result.actionItems.push('Bring imaging reports (MRI showing meniscus tears, cartilage damage, ligament tears).');
  result.actionItems.push('Bring documentation of any knee surgeries (meniscectomy, ACL repair, etc.).');
  result.actionItems.push('The examiner will use a goniometer to measure your knee flexion - stop when it hurts, don\'t push through pain.');
  result.actionItems.push('You may qualify for MULTIPLE separate ratings: flexion limitation + instability + arthritis.');
  result.actionItems.push('If you have the opposite knee also service-connected, mention bilateral factor (can increase rating).');
  
  return result;
}

/**
 * Get calculator function by name
 */
export function getCalculatorFunction(calculatorName) {
  const calculators = {
    calculateMigraineRating,
    calculatePTSDRating,
    calculateBackPainRating,
    calculateTinnitusRating,
    calculateKneePainRating
  };
  
  return calculators[calculatorName];
}
