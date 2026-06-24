#!/usr/bin/env node
/**
 * DBQ Forms Fetcher & Cacher
 * 
 * Fetches all official VA Disability Benefits Questionnaire (DBQ) PDFs
 * from the Production VA Forms API and caches them locally.
 * 
 * Why Production API?
 * - Forms are PUBLIC data (no special auth needed)
 * - Sandbox returns dummy/empty results
 * - We want REAL forms for the demo
 * 
 * Why Local Cache?
 * - Avoids CORS issues when opening PDFs in browser
 * - No API rate limits during demo
 * - Faster load times
 * - Works offline
 * 
 * Usage: npm run update-forms
 * 
 * @author Vet-Rate.org
 * @see https://developer.va.gov/explore/forms/docs/va_forms
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // API endpoint configuration
  // Set USE_PRODUCTION to true when you have a production API key
  USE_PRODUCTION: process.env.VA_FORMS_PRODUCTION === 'true',
  
  // Use curated list of real DBQs (bypasses API entirely)
  // This is useful when you only have a sandbox key but want real forms
  USE_CURATED_LIST: process.env.VA_FORMS_USE_CURATED === 'true' || true, // Default to true for reliable results
  
  // Endpoints
  SANDBOX_API: 'https://sandbox-api.va.gov/services/va_forms/v0/forms',
  PRODUCTION_API: 'https://api.va.gov/services/va_forms/v0/forms',
  
  get API_BASE() {
    return this.USE_PRODUCTION ? this.PRODUCTION_API : this.SANDBOX_API;
  },
  
  // Output paths
  OUTPUT_DIR: path.resolve(__dirname, '../public/forms'),
  INDEX_FILE: 'dbq-index.json',
  
  // Search queries to find all DBQs
  SEARCH_QUERIES: [
    'Disability Benefits Questionnaire',
    '21-0960',
  ],
  
  // Form number prefixes that indicate DBQs
  DBQ_PREFIXES: ['21-0960'],
  
  // Rate limiting (be nice to VA servers)
  DELAY_BETWEEN_DOWNLOADS_MS: 500,
  REQUEST_TIMEOUT_MS: 30000,
  MAX_RETRIES: 3,
  
  // Pagination
  PER_PAGE: 100,
};

// ============================================================================
// CURATED DBQ LIST (Real VA Forms - Direct URLs)
// ============================================================================
// These are official VA.gov DBQ forms with direct PDF links.
// This list ensures we get REAL forms even without production API access.
// URL Format: https://www.benefits.va.gov/compensation/docs/[name].pdf
// Source: https://www.benefits.va.gov/compensation/dbq_publicdbqs.asp

const CURATED_DBQ_FORMS = [
  // Mental Health / Psychological
  { id: 'PTSD-Review', title: 'PTSD Review Disability Benefits Questionnaire', category: 'Mental Health', url: 'https://www.benefits.va.gov/compensation/docs/PTSD_Review.pdf' },
  { id: 'Mental-Disorders', title: 'Mental Disorders (other than PTSD and Eating Disorders) Disability Benefits Questionnaire', category: 'Mental Health', url: 'https://www.benefits.va.gov/compensation/docs/Mental_Disorders.pdf' },
  { id: 'Eating-Disorders', title: 'Eating Disorders Disability Benefits Questionnaire', category: 'Mental Health', url: 'https://www.benefits.va.gov/compensation/docs/Eating_Disorders.pdf' },
  
  // Musculoskeletal
  { id: 'Knee-Lower-Leg', title: 'Knee and Lower Leg Conditions Disability Benefits Questionnaire', category: 'Musculoskeletal', url: 'https://www.benefits.va.gov/compensation/docs/Knee_and_Lower_Leg.pdf' },
  { id: 'Hip-Thigh', title: 'Hip and Thigh Conditions Disability Benefits Questionnaire', category: 'Musculoskeletal', url: 'https://www.benefits.va.gov/compensation/docs/Hip_and_Thigh.pdf' },
  { id: 'Shoulder-Arm', title: 'Shoulder and/or Arm Conditions Disability Benefits Questionnaire', category: 'Musculoskeletal', url: 'https://www.benefits.va.gov/compensation/docs/Shoulder_and_or_Arm.pdf' },
  { id: 'Back-Thoracolumbar', title: 'Back (Thoracolumbar Spine) Conditions Disability Benefits Questionnaire', category: 'Musculoskeletal', url: 'https://www.benefits.va.gov/compensation/docs/Back_Thoracolumbar_Spine.pdf' },
  { id: 'Neck-Cervical', title: 'Neck (Cervical Spine) Conditions Disability Benefits Questionnaire', category: 'Musculoskeletal', url: 'https://www.benefits.va.gov/compensation/docs/Neck_Conditions_Cervical_Spine.pdf' },
  { id: 'Ankle', title: 'Ankle Conditions Disability Benefits Questionnaire', category: 'Musculoskeletal', url: 'https://www.benefits.va.gov/compensation/docs/ankle.pdf' },
  { id: 'Elbow-Forearm', title: 'Elbow and Forearm Conditions Disability Benefits Questionnaire', category: 'Musculoskeletal', url: 'https://www.benefits.va.gov/compensation/docs/Elbow_and_Forearm.pdf' },
  { id: 'Foot-Conditions', title: 'Foot Conditions Including Flatfoot (Pes Planus) Disability Benefits Questionnaire', category: 'Musculoskeletal', url: 'https://www.benefits.va.gov/compensation/docs/Foot_Conditions_Including_Flatfoot_Pes_Planus.pdf' },
  { id: 'Wrist', title: 'Wrist Conditions Disability Benefits Questionnaire', category: 'Musculoskeletal', url: 'https://www.benefits.va.gov/compensation/docs/wrist.pdf' },
  { id: 'Hand-Finger', title: 'Hand and Finger Conditions Disability Benefits Questionnaire', category: 'Musculoskeletal', url: 'https://www.benefits.va.gov/compensation/docs/Hand_and_Finger.pdf' },
  { id: 'Muscle-Injuries', title: 'Muscle Injuries Disability Benefits Questionnaire', category: 'Musculoskeletal', url: 'https://www.benefits.va.gov/compensation/docs/Muscle_Injuries.pdf' },
  { id: 'TMJ', title: 'Temporomandibular Disorders Disability Benefits Questionnaire', category: 'Musculoskeletal', url: 'https://www.benefits.va.gov/compensation/docs/Temporomandibular_Disorders.pdf' },
  { id: 'Amputations', title: 'Amputations Disability Benefits Questionnaire', category: 'Musculoskeletal', url: 'https://www.benefits.va.gov/compensation/docs/amputations.pdf' },
  { id: 'Bones-Skeletal', title: 'Bones and Other Skeletal Conditions Disability Benefits Questionnaire', category: 'Musculoskeletal', url: 'https://www.benefits.va.gov/compensation/docs/Bones_and_Other_Skeletal_Conditions.pdf' },
  { id: 'Osteomyelitis', title: 'Osteomyelitis Disability Benefits Questionnaire', category: 'Musculoskeletal', url: 'https://www.benefits.va.gov/compensation/docs/Osteomyelitis.pdf' },
  { id: 'Fibromyalgia', title: 'Fibromyalgia Disability Benefits Questionnaire', category: 'Musculoskeletal', url: 'https://www.benefits.va.gov/compensation/docs/Fibromyalgia.pdf' },
  { id: 'Arthritis', title: 'Arthritis Disability Benefits Questionnaire', category: 'Musculoskeletal', url: 'https://www.benefits.va.gov/compensation/docs/Arthritis.pdf' },
  
  // Neurological
  { id: 'CNS-Neuromuscular', title: 'Central Nervous System and Neuromuscular Diseases Disability Benefits Questionnaire', category: 'Neurological', url: 'https://www.benefits.va.gov/compensation/docs/Central_Nervous_System_and_Neuromuscular_Diseases.pdf' },
  { id: 'Cranial-Nerves', title: 'Cranial Nerve Conditions Disability Benefits Questionnaire', category: 'Neurological', url: 'https://www.benefits.va.gov/compensation/docs/Cranial_Nerve_Conditions.pdf' },
  { id: 'Diabetic-Neuropathy', title: 'Diabetic Peripheral Neuropathy Disability Benefits Questionnaire', category: 'Neurological', url: 'https://www.benefits.va.gov/compensation/docs/Diabetic_Peripheral_Neuropathy.pdf' },
  { id: 'Headaches', title: 'Headaches (Including Migraines) Disability Benefits Questionnaire', category: 'Neurological', url: 'https://www.benefits.va.gov/compensation/docs/Headaches_Including_Migraines.pdf' },
  { id: 'Narcolepsy', title: 'Narcolepsy Disability Benefits Questionnaire', category: 'Neurological', url: 'https://www.benefits.va.gov/compensation/docs/Narcolepsy.pdf' },
  { id: 'Peripheral-Nerves', title: 'Peripheral Nerves Conditions Disability Benefits Questionnaire', category: 'Neurological', url: 'https://www.benefits.va.gov/compensation/docs/Peripheral_Nerves.pdf' },
  { id: 'Seizure-Epilepsy', title: 'Seizure Disorders (Epilepsy) Disability Benefits Questionnaire', category: 'Neurological', url: 'https://www.benefits.va.gov/compensation/docs/Seizure_Disorders_Epilepsy.pdf' },
  { id: 'ALS', title: 'ALS (Lou Gehrig\'s Disease) Disability Benefits Questionnaire', category: 'Neurological', url: 'https://www.benefits.va.gov/compensation/docs/ALS_Lou_Gehrigs_Disease.pdf' },
  { id: 'Multiple-Sclerosis', title: 'Multiple Sclerosis (MS) Disability Benefits Questionnaire', category: 'Neurological', url: 'https://www.benefits.va.gov/compensation/docs/Multiple_Sclerosis.pdf' },
  { id: 'Parkinsons', title: 'Parkinson\'s Disease Disability Benefits Questionnaire', category: 'Neurological', url: 'https://www.benefits.va.gov/compensation/docs/Parkinsons_Disease.pdf' },
  
  // Respiratory
  { id: 'Respiratory', title: 'Respiratory Conditions (Other Than Tuberculosis and Sleep Apnea) Disability Benefits Questionnaire', category: 'Respiratory', url: 'https://www.benefits.va.gov/compensation/docs/Respiratory_Conditions_Other_than_Tuberculosis_and_Sleep_Apnea.pdf' },
  { id: 'Sleep-Apnea', title: 'Sleep Apnea Disability Benefits Questionnaire', category: 'Respiratory', url: 'https://www.benefits.va.gov/compensation/docs/Sleep_Apnea.pdf' },
  { id: 'Tuberculosis', title: 'Tuberculosis Disability Benefits Questionnaire', category: 'Respiratory', url: 'https://www.benefits.va.gov/compensation/docs/Tuberculosis.pdf' },
  { id: 'Sinusitis-Rhinitis', title: 'Sinusitis, Rhinitis and Other Conditions of the Nose, Throat, Larynx and Pharynx Disability Benefits Questionnaire', category: 'Respiratory', url: 'https://www.benefits.va.gov/compensation/docs/Sinusitis_Rhinitis_and_Other_Conditions_of_the_Nose_Throat_Larynx_and_Pharynx.pdf' },
  
  // Cardiovascular
  { id: 'Heart', title: 'Heart Conditions Disability Benefits Questionnaire', category: 'Cardiovascular', url: 'https://www.benefits.va.gov/compensation/docs/Heart.pdf' },
  { id: 'Hypertension', title: 'Hypertension Disability Benefits Questionnaire', category: 'Cardiovascular', url: 'https://www.benefits.va.gov/compensation/docs/hypertension.pdf' },
  { id: 'Artery-Vein', title: 'Artery and Vein Conditions Disability Benefits Questionnaire', category: 'Cardiovascular', url: 'https://www.benefits.va.gov/compensation/docs/Artery_and_Vein.pdf' },
  
  // Digestive/Gastrointestinal
  { id: 'Esophageal', title: 'Esophageal Disorders Disability Benefits Questionnaire', category: 'Digestive', url: 'https://www.benefits.va.gov/compensation/docs/esophageal-disorders.pdf' },
  { id: 'Stomach-Duodenum', title: 'Stomach and Duodenum Conditions Disability Benefits Questionnaire', category: 'Digestive', url: 'https://www.benefits.va.gov/compensation/docs/stomach-and-duodenum.pdf' },
  { id: 'Intestines', title: 'Intestinal Conditions Disability Benefits Questionnaire', category: 'Digestive', url: 'https://www.benefits.va.gov/compensation/docs/intestines.pdf' },
  { id: 'Liver', title: 'Liver Conditions Disability Benefits Questionnaire', category: 'Digestive', url: 'https://www.benefits.va.gov/compensation/docs/liver-conditions.pdf' },
  { id: 'Gallbladder', title: 'Gallbladder Conditions Disability Benefits Questionnaire', category: 'Digestive', url: 'https://www.benefits.va.gov/compensation/docs/gallbladder.pdf' },
  { id: 'Pancreas', title: 'Pancreas Conditions Disability Benefits Questionnaire', category: 'Digestive', url: 'https://www.benefits.va.gov/compensation/docs/pancreas.pdf' },
  { id: 'Peritoneal-Adhesions', title: 'Peritoneal Adhesions Disability Benefits Questionnaire', category: 'Digestive', url: 'https://www.benefits.va.gov/compensation/docs/peritoneal-adhesions.pdf' },
  { id: 'Rectum-Anus', title: 'Rectum and Anus Conditions Disability Benefits Questionnaire', category: 'Digestive', url: 'https://www.benefits.va.gov/compensation/docs/rectum-and-anus.pdf' },
  { id: 'Hernias', title: 'Hernias (Including Abdominal, Inguinal and Femoral Hernias) Disability Benefits Questionnaire', category: 'Digestive', url: 'https://www.benefits.va.gov/compensation/docs/hernias-including-abdominal-inguinal-and-femoral-hernias.pdf' },
  
  // Hearing/Vision/ENT
  { id: 'Ear-Vestibular', title: 'Ear Conditions (Including Vestibular and Infectious) Disability Benefits Questionnaire', category: 'Hearing/Vision', url: 'https://www.benefits.va.gov/compensation/docs/Ear_Including_Vestibular_and_Infectious.pdf' },
  { id: 'Eye-Conditions', title: 'Eye Conditions Disability Benefits Questionnaire', category: 'Hearing/Vision', url: 'https://www.benefits.va.gov/compensation/docs/Eye_Conditions.pdf' },
  { id: 'Smell-Taste', title: 'Loss of Sense of Smell and/or Taste Disability Benefits Questionnaire', category: 'Hearing/Vision', url: 'https://www.benefits.va.gov/compensation/docs/Loss_of_Sense_of_Smell_and_or_Taste.pdf' },
  
  // Skin
  { id: 'Skin-Diseases', title: 'Skin Diseases Disability Benefits Questionnaire', category: 'Skin', url: 'https://www.benefits.va.gov/compensation/docs/Skin_Diseases.pdf' },
  { id: 'Scars', title: 'Scars/Disfigurement Disability Benefits Questionnaire', category: 'Skin', url: 'https://www.benefits.va.gov/compensation/docs/scars.pdf' },
  
  // Endocrine
  { id: 'Diabetes', title: 'Diabetes Mellitus Disability Benefits Questionnaire', category: 'Endocrine', url: 'https://www.benefits.va.gov/compensation/docs/Diabetes_Mellitus.pdf' },
  { id: 'Endocrine-Other', title: 'Endocrine Diseases (Other Than Thyroid, Parathyroid or Diabetes Mellitus) Disability Benefits Questionnaire', category: 'Endocrine', url: 'https://www.benefits.va.gov/compensation/docs/Endocrine_Other_than_Thyroid_Parathyroid_and_Diabetes_Mellitus.pdf' },
  { id: 'Thyroid-Parathyroid', title: 'Thyroid and Parathyroid Conditions Disability Benefits Questionnaire', category: 'Endocrine', url: 'https://www.benefits.va.gov/compensation/docs/Thyroid_and_Parathyroid.pdf' },
  
  // Genitourinary
  { id: 'Kidney', title: 'Kidney Conditions (Nephrology) Disability Benefits Questionnaire', category: 'Genitourinary', url: 'https://www.benefits.va.gov/compensation/docs/kidney.pdf' },
  { id: 'Male-Reproductive', title: 'Male Reproductive Organ Conditions (Including Prostate Cancer) Disability Benefits Questionnaire', category: 'Genitourinary', url: 'https://www.benefits.va.gov/compensation/docs/Male_Reproductive_Organ.pdf' },
  { id: 'Urinary-Tract', title: 'Urinary Tract Conditions Disability Benefits Questionnaire', category: 'Genitourinary', url: 'https://www.benefits.va.gov/compensation/docs/Urinary_Tract_Conditions.pdf' },
  
  // Gynecological
  { id: 'Gynecological', title: 'Gynecological Conditions Disability Benefits Questionnaire', category: 'Gynecological', url: 'https://www.benefits.va.gov/compensation/docs/Gynecological_Conditions.pdf' },
  { id: 'Breast', title: 'Breast Conditions and Disorders Disability Benefits Questionnaire', category: 'Gynecological', url: 'https://www.benefits.va.gov/compensation/docs/Breast_Conditions.pdf' },
  
  // Hematologic
  { id: 'Hematologic-Lymphatic', title: 'Hematologic and Lymphatic Conditions, Including Leukemia Disability Benefits Questionnaire', category: 'Hematologic', url: 'https://www.benefits.va.gov/compensation/docs/Hematologic_and_Lymphatic_Conditions_Including_Leukemia.pdf' },
  
  // Infectious Disease
  { id: 'HIV', title: 'HIV-Related Illnesses Disability Benefits Questionnaire', category: 'Infectious Disease', url: 'https://www.benefits.va.gov/compensation/docs/HIV_Related_Illnesses.pdf' },
  { id: 'Infectious-Other', title: 'Infectious Diseases (other than HIV, Hepatitis and Tuberculosis) Disability Benefits Questionnaire', category: 'Infectious Disease', url: 'https://www.benefits.va.gov/compensation/docs/Infectious_Diseases_Other_than_HIV_Related_Illness_Chronic_Fatigue_Syndrome_and_Tuberculosis.pdf' },
  { id: 'Persian-Gulf-Infectious', title: 'Persian Gulf/Afghanistan Infectious Diseases Disability Benefits Questionnaire', category: 'Infectious Disease', url: 'https://www.benefits.va.gov/compensation/docs/Persian_Gulf_Afghanistan_Infectious_Diseases.pdf' },
  
  // Dental/Oral
  { id: 'Oral-Dental', title: 'Oral and Dental Conditions Disability Benefits Questionnaire', category: 'Dental/Oral', url: 'https://www.benefits.va.gov/compensation/docs/oral-and-dental.pdf' },
  
  // General/Other
  { id: 'Chronic-Fatigue', title: 'Chronic Fatigue Syndrome Disability Benefits Questionnaire', category: 'General', url: 'https://www.benefits.va.gov/compensation/docs/Chronic_Fatigue_Syndrome.pdf' },
  { id: 'Nutritional', title: 'Nutritional Deficiencies Disability Benefits Questionnaire', category: 'General', url: 'https://www.benefits.va.gov/compensation/docs/Nutritional_Deficiencies.pdf' },
  { id: 'Lupus-Autoimmune', title: 'Systemic Lupus Erythematosus (SLE) and Other Autoimmune Diseases Disability Benefits Questionnaire', category: 'General', url: 'https://www.benefits.va.gov/compensation/docs/Systemic_Lupus_Erythematosus_and_Other_Autoimmune_Diseases.pdf' },
  { id: 'Spina-Bifida', title: 'Spina Bifida Disability Benefits Questionnaire', category: 'General', url: 'https://www.benefits.va.gov/compensation/docs/Spina_Bifida.pdf' },
  
  // Separation Health Assessment
  { id: 'SHA-Part-A', title: 'Separation Health Assessment DBQ - Part A (Self-Assessment)', category: 'General', url: 'https://www.benefits.va.gov/compensation/docs/SHA_DBQ_Part_A_Self-Assessment.pdf' },
];

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Get API key from environment
 */
function getApiKey() {
  // Try Forms-specific key FIRST, then fall back to general
  const key = process.env.VITE_VA_FORMS_API_KEY || 
              process.env.VITE_VA_API_KEY ||
              process.env.VA_FORMS_API_KEY ||
              process.env.VA_API_KEY;
  
  if (!key) {
    console.error('\n❌ ERROR: VA API Key not found!');
    console.error('   Please set one of these environment variables:');
    console.error('   - VITE_VA_FORMS_API_KEY (preferred)');
    console.error('   - VITE_VA_API_KEY');
    console.error('   - VA_API_KEY\n');
    process.exit(1);
  }
  
  return key;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Make HTTP GET request with timeout
 */
function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Vet-Rate.org DBQ Fetcher/1.0',
        ...headers,
      },
      timeout: CONFIG.REQUEST_TIMEOUT_MS,
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data); // Return raw if not JSON
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

/**
 * Download file with progress
 */
function downloadFile(url, destPath, retries = 0) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    
    https.get(url, { timeout: CONFIG.REQUEST_TIMEOUT_MS }, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(destPath);
        return downloadFile(response.headers.location, destPath, retries)
          .then(resolve)
          .catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', async (err) => {
      file.close();
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      
      if (retries < CONFIG.MAX_RETRIES) {
        console.log(`   ⟳ Retry ${retries + 1}/${CONFIG.MAX_RETRIES}...`);
        await sleep(1000 * (retries + 1)); // Exponential backoff
        downloadFile(url, destPath, retries + 1).then(resolve).catch(reject);
      } else {
        reject(err);
      }
    }).on('timeout', async () => {
      file.close();
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      
      if (retries < CONFIG.MAX_RETRIES) {
        console.log(`   ⟳ Timeout, retry ${retries + 1}/${CONFIG.MAX_RETRIES}...`);
        await sleep(1000 * (retries + 1));
        downloadFile(url, destPath, retries + 1).then(resolve).catch(reject);
      } else {
        reject(new Error('Download timeout'));
      }
    });
  });
}

/**
 * Progress bar helper
 */
function progressBar(current, total, width = 30) {
  const percent = Math.round((current / total) * 100);
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `[${bar}] ${percent}% (${current}/${total})`;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Search for forms matching a query
 */
async function searchForms(apiKey, query, page = 1) {
  const url = new URL(CONFIG.API_BASE);
  url.searchParams.set('query', query);
  url.searchParams.set('page', page);
  url.searchParams.set('per_page', CONFIG.PER_PAGE);
  
  // VA Forms API requires lowercase 'apikey' header (per their docs)
  const response = await httpGet(url.toString(), { 'apikey': apiKey });
  return response;
}

/**
 * Fetch all pages of results for a query
 */
async function fetchAllPages(apiKey, query) {
  const allForms = [];
  let page = 1;
  let hasMore = true;
  
  console.log(`\n🔍 Searching: "${query}"`);
  
  while (hasMore) {
    try {
      const response = await searchForms(apiKey, query, page);
      const forms = response.data || [];
      
      if (forms.length === 0) {
        hasMore = false;
      } else {
        allForms.push(...forms);
        console.log(`   Page ${page}: Found ${forms.length} forms (Total: ${allForms.length})`);
        
        // Check if there are more pages
        const pagination = response.meta?.pagination;
        if (pagination && pagination.current_page >= pagination.total_pages) {
          hasMore = false;
        } else if (forms.length < CONFIG.PER_PAGE) {
          hasMore = false;
        } else {
          page++;
          await sleep(200); // Rate limit
        }
      }
    } catch (error) {
      console.error(`   ❌ Error on page ${page}: ${error.message}`);
      hasMore = false;
    }
  }
  
  return allForms;
}

// ============================================================================
// FILTERING
// ============================================================================

/**
 * Check if a form is a valid DBQ
 */
function isValidDbq(form) {
  const attrs = form.attributes || form;
  const formName = (attrs.form_name || attrs.name || '').toUpperCase();
  const title = (attrs.title || '').toLowerCase();
  const url = attrs.url || '';
  const deleted = attrs.deleted_at || attrs.deleted;
  
  // Skip deleted forms
  if (deleted) return false;
  
  // Skip non-PDF forms
  if (!url || !url.toLowerCase().endsWith('.pdf')) return false;
  
  // Check if it's a DBQ by form number prefix
  const isDbqPrefix = CONFIG.DBQ_PREFIXES.some(prefix => 
    formName.startsWith(prefix.toUpperCase())
  );
  
  // Check if title contains DBQ indicators
  const isDbqTitle = title.includes('questionnaire') || 
                     title.includes('dbq') ||
                     title.includes('disability benefits');
  
  return isDbqPrefix || isDbqTitle;
}

/**
 * Deduplicate forms by form number
 */
function deduplicateForms(forms) {
  const seen = new Map();
  
  for (const form of forms) {
    const attrs = form.attributes || form;
    const formName = attrs.form_name || attrs.name || '';
    
    // Keep the most recent version (by last_revision_on)
    if (!seen.has(formName)) {
      seen.set(formName, form);
    } else {
      const existing = seen.get(formName);
      const existingDate = existing.attributes?.last_revision_on || '';
      const newDate = attrs.last_revision_on || '';
      
      if (newDate > existingDate) {
        seen.set(formName, form);
      }
    }
  }
  
  return Array.from(seen.values());
}

// ============================================================================
// MAIN WORKFLOW
// ============================================================================

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('   🏥 Vet-Rate.org DBQ Forms Fetcher');
  console.log('   Disability Benefits Questionnaire Cache Builder');
  console.log('═'.repeat(60));
  
  // Get API key (optional when using curated list)
  let apiKey = null;
  try {
    apiKey = getApiKey();
    console.log(`\n✅ API Key found: ${apiKey.substring(0, 8)}...`);
  } catch (e) {
    if (!CONFIG.USE_CURATED_LIST) throw e;
    console.log('\n⚠️  No API key found, but curated list will be used');
  }
  
  // Show mode
  console.log(`📋 Mode: ${CONFIG.USE_CURATED_LIST ? 'CURATED LIST (Real DBQ Forms)' : 'VA API'}`);
  
  // Ensure output directory exists
  if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
    fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
    console.log(`📁 Created: ${CONFIG.OUTPUT_DIR}`);
  } else {
    console.log(`📁 Output: ${CONFIG.OUTPUT_DIR}`);
  }
  
  let uniqueForms = [];
  
  if (CONFIG.USE_CURATED_LIST) {
    // =========================================================================
    // CURATED LIST MODE - Use our pre-defined list of real DBQ forms
    // =========================================================================
    console.log('\n' + '─'.repeat(60));
    console.log('📥 Using curated DBQ form list...');
    console.log('─'.repeat(60));
    
    // Convert curated list to same format as API response
    uniqueForms = CURATED_DBQ_FORMS.map(form => ({
      attributes: {
        form_name: form.id,
        title: form.title,
        url: form.url,
      },
      _category: form.category, // Preserve category
    }));
    
    console.log(`   ✓ ${uniqueForms.length} official DBQ forms loaded`);
    
  } else {
    // =========================================================================
    // API MODE - Fetch from VA Forms API
    // =========================================================================
    console.log('\n' + '─'.repeat(60));
    console.log('📥 STEP 1: Fetching form metadata from VA API...');
    console.log('─'.repeat(60));
    
    const allForms = [];
    
    for (const query of CONFIG.SEARCH_QUERIES) {
      const forms = await fetchAllPages(apiKey, query);
      allForms.push(...forms);
      await sleep(500);
    }
    
    console.log(`\n📊 Total forms fetched: ${allForms.length}`);
    
    // Filter & deduplicate
    console.log('\n' + '─'.repeat(60));
    console.log('🔬 STEP 2: Filtering for valid DBQs...');
    console.log('─'.repeat(60));
    
    const dbqForms = allForms.filter(isValidDbq);
    console.log(`   ✓ Valid DBQs: ${dbqForms.length}`);
    
    uniqueForms = deduplicateForms(dbqForms);
    console.log(`   ✓ After deduplication: ${uniqueForms.length}`);
    
    // Sort by form number
    uniqueForms.sort((a, b) => {
      const nameA = (a.attributes?.form_name || '').toUpperCase();
      const nameB = (b.attributes?.form_name || '').toUpperCase();
      return nameA.localeCompare(nameB);
    });
    
    if (uniqueForms.length === 0) {
      console.log('\n⚠️  No DBQ forms found! Check your API key and network connection.');
      console.log('   Tip: Set USE_CURATED_LIST=true to use pre-defined forms.');
      process.exit(1);
    }
  }
  
  // =========================================================================
  // DOWNLOAD PDFs
  // =========================================================================
  console.log('\n' + '─'.repeat(60));
  console.log('⬇️  Downloading PDFs...');
  console.log('─'.repeat(60));
  
  const downloadResults = [];
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < uniqueForms.length; i++) {
    const form = uniqueForms[i];
    const attrs = form.attributes || form;
    const formName = attrs.form_name || attrs.name || `form-${i}`;
    const title = attrs.title || 'Unknown';
    const pdfUrl = attrs.url;
    const preservedCategory = form._category; // From curated list
    
    // Sanitize filename
    const safeFileName = formName.replace(/[^a-zA-Z0-9-_]/g, '_') + '.pdf';
    const destPath = path.join(CONFIG.OUTPUT_DIR, safeFileName);
    
    process.stdout.write(`\r${progressBar(i + 1, uniqueForms.length)} ${formName.padEnd(15)}`);
    
    // Check if already downloaded
    if (fs.existsSync(destPath)) {
      const stats = fs.statSync(destPath);
      if (stats.size > 1000) { // Sanity check - PDF should be > 1KB
        skipCount++;
        downloadResults.push({
          id: formName,
          title: title,
          path: `/forms/${safeFileName}`,
          url: pdfUrl,
          status: 'cached',
          lastRevision: attrs.last_revision_on,
          pages: attrs.pages,
          _category: preservedCategory,
        });
        await sleep(50);
        continue;
      }
    }
    
    // Download
    try {
      await downloadFile(pdfUrl, destPath);
      successCount++;
      downloadResults.push({
        id: formName,
        title: title,
        path: `/forms/${safeFileName}`,
        url: pdfUrl,
        status: 'downloaded',
        lastRevision: attrs.last_revision_on,
        pages: attrs.pages,
        _category: preservedCategory,
      });
    } catch (error) {
      errorCount++;
      console.log(`\n   ❌ Failed: ${formName} - ${error.message}`);
      downloadResults.push({
        id: formName,
        title: title,
        path: null,
        url: pdfUrl,
        status: 'error',
        error: error.message,
        _category: preservedCategory,
      });
    }
    
    await sleep(CONFIG.DELAY_BETWEEN_DOWNLOADS_MS);
  }
  
  console.log('\n');
  console.log(`   ✅ Downloaded: ${successCount}`);
  console.log(`   📦 Cached: ${skipCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  
  // =========================================================================
  // STEP 4: GENERATE INDEX
  // =========================================================================
  console.log('\n' + '─'.repeat(60));
  console.log('📋 STEP 4: Generating index...');
  console.log('─'.repeat(60));
  
  // Filter out errors for the index
  const successfulForms = downloadResults.filter(f => f.path !== null);
  
  // Create index with categories
  const index = {
    generated: new Date().toISOString(),
    total: successfulForms.length,
    forms: successfulForms.map(f => ({
      id: f.id,
      title: f.title,
      path: f.path,
      lastRevision: f.lastRevision,
      pages: f.pages,
      category: f._category || categorizeDbq(f.title), // Use preserved or auto-detect
    })),
  };
  
  const indexPath = path.join(CONFIG.OUTPUT_DIR, CONFIG.INDEX_FILE);
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
  console.log(`   ✓ Index saved: ${indexPath}`);
  console.log(`   ✓ Total forms indexed: ${index.total}`);
  
  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n' + '═'.repeat(60));
  console.log('   ✅ DBQ CACHE BUILD COMPLETE!');
  console.log('═'.repeat(60));
  console.log(`
📊 Summary:
   • Forms downloaded: ${successCount}
   • Forms cached: ${skipCount}
   • Errors: ${errorCount}
   • Total available: ${successfulForms.length}
   
📁 Files:
   • PDFs: ${CONFIG.OUTPUT_DIR}
   • Index: ${indexPath}
   
🚀 Your DBQ Finder now has local access to all official VA forms!
`);
}

/**
 * Categorize DBQ by title keywords
 */
function categorizeDbq(title) {
  const t = title.toLowerCase();
  
  if (t.includes('mental') || t.includes('ptsd') || t.includes('anxiety') || t.includes('depression') || t.includes('eating')) {
    return 'Mental Health';
  }
  if (t.includes('knee') || t.includes('back') || t.includes('shoulder') || t.includes('neck') || t.includes('hip') || 
      t.includes('ankle') || t.includes('wrist') || t.includes('elbow') || t.includes('spine') || t.includes('muscle') ||
      t.includes('joint') || t.includes('range of motion') || t.includes('musculoskeletal')) {
    return 'Musculoskeletal';
  }
  if (t.includes('sleep') || t.includes('respiratory') || t.includes('lung') || t.includes('sinus') || t.includes('nose') || t.includes('rhinitis')) {
    return 'Respiratory';
  }
  if (t.includes('heart') || t.includes('hypertension') || t.includes('artery') || t.includes('cardio') || t.includes('vascular')) {
    return 'Cardiovascular';
  }
  if (t.includes('headache') || t.includes('migraine') || t.includes('nerve') || t.includes('seizure') || t.includes('neuro') || t.includes('brain')) {
    return 'Neurological';
  }
  if (t.includes('stomach') || t.includes('intestin') || t.includes('liver') || t.includes('gerd') || t.includes('digestive') || t.includes('esophag')) {
    return 'Digestive';
  }
  if (t.includes('skin') || t.includes('scar') || t.includes('burn') || t.includes('dermat')) {
    return 'Skin';
  }
  if (t.includes('hearing') || t.includes('tinnitus') || t.includes('ear') || t.includes('eye') || t.includes('vision')) {
    return 'Hearing/Vision';
  }
  if (t.includes('diabetes') || t.includes('thyroid') || t.includes('endocrine')) {
    return 'Endocrine';
  }
  if (t.includes('kidney') || t.includes('bladder') || t.includes('urinary') || t.includes('genito')) {
    return 'Genitourinary';
  }
  if (t.includes('dental') || t.includes('oral') || t.includes('mouth')) {
    return 'Dental/Oral';
  }
  if (t.includes('hematologic') || t.includes('blood') || t.includes('lymph')) {
    return 'Hematologic';
  }
  if (t.includes('infectious') || t.includes('hepatitis') || t.includes('hiv') || t.includes('tb')) {
    return 'Infectious Disease';
  }
  if (t.includes('gynecological') || t.includes('breast')) {
    return 'Gynecological';
  }
  
  return 'General';
}

// ============================================================================
// RUN
// ============================================================================

// Load environment variables from .env.local FIRST (before any code runs)
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  // Split by any newline type and handle CRLF/LF mixed
  const lines = envContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  
  for (const line of lines) {
    // Skip comments and empty lines
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) continue;
    
    // Parse KEY=VALUE format
    const eqIndex = trimmedLine.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmedLine.substring(0, eqIndex).trim();
      const value = trimmedLine.substring(eqIndex + 1).trim().replace(/^["']|["']$/g, '');
      // Always set (override any existing)
      process.env[key] = value;
    }
  }
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
