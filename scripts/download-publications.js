#!/usr/bin/env node
/**
 * Vet-Rate.org Publication Downloader
 * ====================================
 * Downloads official military and VA publications for the reference library.
 * 
 * Usage: node scripts/download-publications.js
 * 
 * Note: Some publications require manual download due to authentication or
 * dynamic page generation. This script handles direct PDF links.
 */

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBS_DIR = path.join(__dirname, '..', 'public', 'pubs');

// Ensure directories exist
const SUBDIRS = ['army', 'navy', 'airforce', 'marines', 'coastguard', 'dod', 'va'];
SUBDIRS.forEach(dir => {
  const fullPath = path.join(PUBS_DIR, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`Created directory: ${fullPath}`);
  }
});

// Publication download list
// Format: { url, filename, folder, description }
const PUBLICATIONS = [
  // ==================== ARMY ====================
  {
    url: 'https://armypubs.army.mil/epubs/DR_pubs/DR_a/ARN30964-AR_40-501-000-WEB-1.pdf',
    filename: 'AR_40-501_Medical_Fitness.pdf',
    folder: 'army',
    description: 'AR 40-501: Standards of Medical Fitness'
  },
  {
    url: 'https://armypubs.army.mil/epubs/DR_pubs/DR_a/ARN36573-AR_600-8-22-001-WEB-2.pdf',
    filename: 'AR_600-8-22_Military_Awards.pdf',
    folder: 'army',
    description: 'AR 600-8-22: Military Awards'
  },
  {
    url: 'https://armypubs.army.mil/epubs/DR_pubs/DR_a/ARN35242-PAM_611-21-002-WEB-2.pdf',
    filename: 'DA_PAM_611-21_MOS_Codes.pdf',
    folder: 'army',
    description: 'DA PAM 611-21: MOS Classification & Structure'
  },
  {
    url: 'https://armypubs.army.mil/epubs/DR_pubs/DR_a/ARN36711-AR_600-8-104-000-WEB-1.pdf',
    filename: 'AR_600-8-104_HR_Records.pdf',
    folder: 'army',
    description: 'AR 600-8-104: Army Military HR Records Management'
  },
  {
    url: 'https://armypubs.army.mil/epubs/DR_pubs/DR_a/ARN30121-AR_15-185-000-WEB-1.pdf',
    filename: 'AR_15-185_ABCMR.pdf',
    folder: 'army',
    description: 'AR 15-185: Army Board for Correction of Military Records'
  },
  
  // ==================== DOD ====================
  {
    url: 'https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/133218p.pdf',
    filename: 'DoDI_1332.18_Disability_Eval_System.pdf',
    folder: 'dod',
    description: 'DoDI 1332.18: Disability Evaluation System'
  },
  {
    url: 'https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/133238p.pdf',
    filename: 'DoDI_1332.38_Physical_Disability_Eval.pdf',
    folder: 'dod',
    description: 'DoDI 1332.38: Physical Disability Evaluation'
  },
  {
    url: 'https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/649004p.pdf',
    filename: 'DoDI_6490.04_Mental_Health_Evals.pdf',
    folder: 'dod',
    description: 'DoDI 6490.04: Mental Health Evaluations'
  },
  {
    url: 'https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/605512p.pdf',
    filename: 'DoDI_6055.12_Hearing_Conservation.pdf',
    folder: 'dod',
    description: 'DoDI 6055.12: Hearing Conservation Program'
  },
  
  // ==================== NAVY ====================
  {
    url: 'https://www.secnav.navy.mil/doni/Directives/01000%20Military%20Personnel%20Support/01-800%20Casualty%20and%20Survivor%20Assistance%20Programs/1850.4F.pdf',
    filename: 'SECNAVINST_1850.4_Disability_Eval.pdf',
    folder: 'navy',
    description: 'SECNAVINST 1850.4: Navy Disability Evaluation Manual'
  },
  {
    url: 'https://www.secnav.navy.mil/doni/Directives/01000%20Military%20Personnel%20Support/01-600%20Performance%20and%20Discipline%20Programs/1650.1J%20CH-1.pdf',
    filename: 'SECNAVINST_1650.1_Awards_Manual.pdf',
    folder: 'navy',
    description: 'SECNAVINST 1650.1: Navy/Marine Awards Manual'
  },
  
  // ==================== AIR FORCE ====================
  // Note: AF pubs require e-publishing account for most, these are public links
  {
    url: 'https://static.e-publishing.af.mil/production/1/af_a1/publication/afi36-3212/afi36-3212.pdf',
    filename: 'AFI_36-3212_Physical_Eval.pdf',
    folder: 'airforce',
    description: 'AFI 36-3212: Physical Evaluation for Retention'
  },
  {
    url: 'https://static.e-publishing.af.mil/production/1/af_a1/publication/afi36-2806/afi36-2806.pdf',
    filename: 'AFI_36-2806_Awards.pdf',
    folder: 'airforce',
    description: 'AFI 36-2806: Awards and Decorations Program'
  },
  
  // ==================== COAST GUARD ====================
  {
    url: 'https://media.defense.gov/2020/Jun/16/2002317063/-1/-1/0/CIM_1850_2E.PDF',
    filename: 'COMDTINST_M1850.2_Disability_Eval.pdf',
    folder: 'coastguard',
    description: 'COMDTINST M1850.2: Physical Disability Evaluation System'
  },
];

function noop() {}

// Download function with redirect handling
function downloadFile(url, destPath, description) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    console.log(`\n📥 Downloading: ${description}`);
    console.log(`   URL: ${url}`);
    console.log(`   To: ${destPath}`);
    
    const request = protocol.get(url, { 
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        console.log(`   ↪️ Redirecting to: ${response.headers.location}`);
        downloadFile(response.headers.location, destPath, description)
          .then(resolve)
          .catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      const file = fs.createWriteStream(destPath);
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        const stats = fs.statSync(destPath);
        console.log(`   ✅ Complete (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlink(destPath, noop); // Delete partial file
        reject(err);
      });
    });
    
    request.on('error', reject);
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('Request timed out'));
    });
  });
}

// Main execution
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Vet-Rate.org Publication Downloader');
  console.log('  Downloading official military & VA publications');
  console.log('═══════════════════════════════════════════════════════════════');
  
  const results = { success: [], failed: [], skipped: [] };
  
  for (const pub of PUBLICATIONS) {
    const destPath = path.join(PUBS_DIR, pub.folder, pub.filename);
    
    // Skip if already exists
    if (fs.existsSync(destPath)) {
      console.log(`\n⏭️  Skipping (exists): ${pub.filename}`);
      results.skipped.push(pub);
      continue;
    }
    
    try {
      await downloadFile(pub.url, destPath, pub.description);
      results.success.push(pub);
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
      results.failed.push({ ...pub, error: error.message });
    }
    
    // Small delay between downloads to be nice to servers
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  DOWNLOAD SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  ✅ Downloaded: ${results.success.length}`);
  console.log(`  ⏭️  Skipped:    ${results.skipped.length}`);
  console.log(`  ❌ Failed:     ${results.failed.length}`);
  
  if (results.failed.length > 0) {
    console.log('\n  Failed downloads (may require manual download):');
    results.failed.forEach(pub => {
      console.log(`    - ${pub.description}`);
      console.log(`      ${pub.url}`);
    });
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  MANUAL DOWNLOAD REQUIRED:');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  The following require manual download (auth or dynamic pages):');
  console.log('');
  console.log('  📘 38 CFR Part 4 (VA Rating Schedule):');
  console.log('     https://www.ecfr.gov/current/title-38/chapter-I/part-4');
  console.log('     → Save as PDF from browser');
  console.log('');
  console.log('  📘 38 CFR Part 3 (Service Connection):');
  console.log('     https://www.ecfr.gov/current/title-38/chapter-I/part-3');
  console.log('     → Save as PDF from browser');
  console.log('');
  console.log('  📘 M21-1 Adjudication Manual:');
  console.log('     https://www.knowva.ebenefits.va.gov/');
  console.log('     → Requires VA login, save relevant sections');
  console.log('');
  console.log('  📘 NAVMED P-117 (Navy Medical Manual):');
  console.log('     https://www.med.navy.mil/Directives/Pages/NAVMED-P-117.aspx');
  console.log('     → Multiple chapters, download individually');
  console.log('');
  console.log('  📘 MCO 1900.16 (Marine Separations):');
  console.log('     https://www.marines.mil/Portals/1/Publications/');
  console.log('     → Search and download');
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(console.error);
