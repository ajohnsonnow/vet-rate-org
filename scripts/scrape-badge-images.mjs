/**
 * Military Badge Image Scraper - Wikimedia Commons Edition
 * ========================================================
 * 
 * Downloads badge images from Wikimedia Commons using their
 * Special:FilePath endpoint which is more reliable.
 * 
 * Run: node scripts/scrape-badge-images.mjs
 */

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Output directories
const BADGES_DIR = path.join(projectRoot, 'public', 'images', 'badges');
const TABS_DIR = path.join(projectRoot, 'public', 'images', 'tabs');

// Ensure directories exist
[BADGES_DIR, TABS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
});

// Wikimedia Commons file names (without "File:" prefix)
// Using Special:FilePath/FILENAME which provides direct redirects
const BADGE_SOURCES = {
  // === ARMY COMBAT BADGES ===
  'combat-infantryman-badge': {
    name: 'Combat Infantryman Badge',
    file: 'Combat_Infantry_Badge.svg',
    category: 'army-combat',
  },
  'combat-action-badge': {
    name: 'Combat Action Badge',
    file: 'Combat_Action_Badge.svg',
    category: 'army-combat',
  },
  'combat-medical-badge': {
    name: 'Combat Medical Badge',
    file: 'Combat_Medical_Badge.svg',
    category: 'army-combat',
  },
  'expert-infantryman-badge': {
    name: 'Expert Infantryman Badge',
    file: 'Expert_Infantry_Badge.svg',
    category: 'army-skill',
  },
  'expert-field-medical-badge': {
    name: 'Expert Field Medical Badge',
    file: 'Expert_Field_Medical_Badge.svg',
    category: 'army-skill',
  },
  'expert-soldier-badge': {
    name: 'Expert Soldier Badge',
    file: 'Expert_Soldier_Badge.svg',
    category: 'army-skill',
  },
  
  // === AIRBORNE BADGES ===
  'master-parachutist-badge': {
    name: 'Master Parachutist Badge',
    file: 'Master_Parachutist_badge_(United_States).svg',
    category: 'airborne',
  },
  'senior-parachutist-badge': {
    name: 'Senior Parachutist Badge',
    file: 'Senior_Parachutist_badge_(United_States).svg',
    category: 'airborne',
  },
  'parachutist-badge': {
    name: 'Parachutist Badge',
    file: 'Parachutist_badge_(United_States).svg',
    category: 'airborne',
  },
  'air-assault-badge': {
    name: 'Air Assault Badge',
    file: 'Air_Assault_Badge.svg',
    category: 'army-skill',
  },
  'pathfinder-badge': {
    name: 'Pathfinder Badge',
    file: 'Pathfinder_Badge.svg',
    category: 'army-skill',
  },
  
  // === NAVY WARFARE PINS ===
  'surface-warfare-officer': {
    name: 'Surface Warfare Officer',
    file: 'Surface_Warfare_Officer_Insignia.svg',
    category: 'navy-warfare',
  },
  'enlisted-surface-warfare': {
    name: 'Enlisted Surface Warfare Specialist',
    file: 'Enlisted_Surface_Warfare_Specialist_Insignia.svg',
    category: 'navy-warfare',
  },
  'submarine-warfare-officer': {
    name: 'Submarine Warfare Officer',
    file: 'Submarine_Officer.svg',
    category: 'navy-warfare',
  },
  'submarine-warfare-enlisted': {
    name: 'Submarine Warfare Enlisted',
    file: 'Submarine_Enlisted.svg',
    category: 'navy-warfare',
  },
  'naval-aviator': {
    name: 'Naval Aviator Wings',
    file: 'Naval_Aviator_Badge.svg',
    category: 'aviation',
  },
  'navy-seal-trident': {
    name: 'SEAL Trident',
    file: 'Naval_Special_Warfare_Trident_insignia.svg',
    category: 'special-warfare',
  },
  'fleet-marine-force': {
    name: 'Fleet Marine Force',
    file: 'Fleet_Marine_Force_Ribbon.svg',
    category: 'navy-warfare',
  },
  
  // === AIR FORCE BADGES ===
  'command-pilot': {
    name: 'Command Pilot Wings',
    file: 'Command_Pilot_Badge.svg',
    category: 'aviation',
  },
  'senior-pilot': {
    name: 'Senior Pilot Wings',
    file: 'Senior_Pilot_Badge.svg',
    category: 'aviation',
  },
  'pilot-wings': {
    name: 'Pilot Wings',
    file: 'Pilot_badge.svg',
    category: 'aviation',
  },
  'combat-control-team': {
    name: 'Combat Control Badge',
    file: 'USAF_Combat_Controller_Badge.svg',
    category: 'special-tactics',
  },
  'pararescue': {
    name: 'Pararescue Badge',
    file: 'USAF_Pararescue_Badge.svg',
    category: 'special-tactics',
  },
  'tactical-air-control': {
    name: 'TACP Badge',
    file: 'USAF_Tactical_Air_Control_Party_Badge.svg',
    category: 'special-tactics',
  },
  
  // === SPACE FORCE ===
  'space-operations-badge': {
    name: 'Space Operations Badge',
    file: 'Space_Operations_Badge.svg',
    category: 'space-force',
  },
  'master-space-badge': {
    name: 'Master Space Badge',
    file: 'Master_Space_Badge.svg',
    category: 'space-force',
  },
  'senior-space-badge': {
    name: 'Senior Space Badge',
    file: 'Senior_Space_Badge.svg',
    category: 'space-force',
  },
  
  // === COAST GUARD ===
  'cutterman-officer': {
    name: 'Cutterman Officer',
    file: 'USCG_Cutterman_pin.svg',
    category: 'coast-guard',
  },
  'rescue-swimmer': {
    name: 'Rescue Swimmer',
    file: 'USCG_Rescue_Swimmer.svg',
    category: 'coast-guard',
  },
  
  // === MARKSMANSHIP ===
  'expert-marksmanship-rifle': {
    name: 'Expert Rifle Badge',
    file: 'Rifle_Marksmanship_Badge_(Expert).svg',
    category: 'marksmanship',
  },
  'sharpshooter-marksmanship-rifle': {
    name: 'Sharpshooter Rifle Badge',
    file: 'Rifle_Marksmanship_Badge_(Sharpshooter).svg',
    category: 'marksmanship',
  },
  'marksman-marksmanship-rifle': {
    name: 'Marksman Rifle Badge',
    file: 'Rifle_Marksmanship_Badge_(Marksman).svg',
    category: 'marksmanship',
  },
  
  // === DRIVERS ===
  'driver-badge-w': {
    name: 'Driver Badge Wheeled',
    file: 'Driver_and_Mechanic_Badge_(W_bar).svg',
    category: 'army-skill',
  },
  'driver-badge-t': {
    name: 'Driver Badge Tracked',
    file: 'Driver_and_Mechanic_Badge_(T_bar).svg',
    category: 'army-skill',
  },
  'mechanic-badge': {
    name: 'Mechanic Badge',
    file: 'Driver_and_Mechanic_Badge_(M_bar).svg',
    category: 'army-skill',
  },
};

// Tab sources
const TAB_SOURCES = {
  'ranger-tab': {
    name: 'Ranger Tab',
    file: 'Ranger_Tab.svg',
    category: 'tab',
  },
  'special-forces-tab': {
    name: 'Special Forces Tab',
    file: 'Special_Forces_Tab.svg',
    category: 'tab',
  },
  'sapper-tab': {
    name: 'Sapper Tab',
    file: 'Sapper_tab.svg',
    category: 'tab',
  },
  'airborne-tab': {
    name: 'Airborne Tab',
    file: 'Airborne_Tab.svg',
    category: 'tab',
  },
  'mountain-tab': {
    name: 'Mountain Tab',
    file: 'Mountain_Tab.svg',
    category: 'tab',
  },
  'presidents-hundred-tab': {
    name: "President's Hundred Tab",
    file: "President's_Hundred_Tab.svg",
    category: 'tab',
  },
};

// Download function using Wikimedia Commons Special:FilePath
async function downloadFromWikimedia(filename, outputPath) {
  // Use the Special:FilePath endpoint which handles redirects properly
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}`;
  
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        'User-Agent': 'VetRate.org/1.0 (https://vet-rate.org; contact@vet-rate.org) Node.js badge-scraper',
        'Accept': 'image/*,*/*;q=0.9',
      },
      followAllRedirects: true,
    }, (response) => {
      // Handle redirect chain
      if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
        const redirectUrl = response.headers.location;
        if (!redirectUrl) {
          reject(new Error('Redirect without location'));
          return;
        }
        
        // Follow the redirect
        const protocol = redirectUrl.startsWith('https') ? https : http;
        protocol.get(redirectUrl, {
          headers: {
            'User-Agent': 'VetRate.org/1.0 (https://vet-rate.org) badge-scraper',
          },
        }, (redirectResponse) => {
          if (redirectResponse.statusCode !== 200) {
            reject(new Error(`HTTP ${redirectResponse.statusCode} after redirect`));
            return;
          }
          
          const fileStream = fs.createWriteStream(outputPath);
          redirectResponse.pipe(fileStream);
          
          fileStream.on('finish', () => {
            fileStream.close();
            resolve(outputPath);
          });
          
          fileStream.on('error', (err) => {
            fs.unlink(outputPath, () => {});
            reject(err);
          });
        }).on('error', reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      
      const fileStream = fs.createWriteStream(outputPath);
      response.pipe(fileStream);
      
      fileStream.on('finish', () => {
        fileStream.close();
        resolve(outputPath);
      });
      
      fileStream.on('error', (err) => {
        fs.unlink(outputPath, () => {});
        reject(err);
      });
    });
    
    request.on('error', reject);
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('Timeout'));
    });
  });
}

// Get file extension from filename
function getExtension(filename) {
  const match = filename.match(/\.(svg|png|jpg|jpeg|gif|webp)$/i);
  return match ? match[1].toLowerCase() : 'svg';
}

// Main scraping function
async function scrapeBadges() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║       MILITARY BADGE IMAGE SCRAPER (Wikimedia Commons)           ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');
  
  const results = {
    success: [],
    failed: [],
  };
  
  // Download badges
  console.log('📥 DOWNLOADING BADGE IMAGES...\n');
  
  const badgeEntries = Object.entries(BADGE_SOURCES);
  
  for (let i = 0; i < badgeEntries.length; i++) {
    const [id, badge] = badgeEntries[i];
    console.log(`[${i + 1}/${badgeEntries.length}] 🎖️  ${badge.name}`);
    
    const ext = getExtension(badge.file);
    const filename = `${id}.${ext}`;
    const outputPath = path.join(BADGES_DIR, filename);
    
    // Skip if already exists
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      if (stats.size > 100) {
        console.log(`   ✅ Already exists: ${filename} (${(stats.size / 1024).toFixed(1)} KB)`);
        results.success.push({ id, name: badge.name, file: filename });
        continue;
      }
    }
    
    try {
      console.log(`   📥 Fetching: ${badge.file}`);
      await downloadFromWikimedia(badge.file, outputPath);
      const stats = fs.statSync(outputPath);
      console.log(`   ✅ Saved: ${filename} (${(stats.size / 1024).toFixed(1)} KB)`);
      results.success.push({ id, name: badge.name, file: filename });
    } catch (err) {
      console.log(`   ❌ Failed: ${err.message}`);
      results.failed.push({ id, name: badge.name, error: err.message });
    }
    
    // Longer delay to avoid rate limiting (1.5 seconds)
    await new Promise(r => setTimeout(r, 1500));
  }
  
  // Download tabs
  console.log('\n📥 DOWNLOADING TAB IMAGES...\n');
  
  const tabEntries = Object.entries(TAB_SOURCES);
  
  for (let i = 0; i < tabEntries.length; i++) {
    const [id, tab] = tabEntries[i];
    console.log(`[${i + 1}/${tabEntries.length}] 📛 ${tab.name}`);
    
    const ext = getExtension(tab.file);
    const filename = `${id}.${ext}`;
    const outputPath = path.join(TABS_DIR, filename);
    
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      if (stats.size > 100) {
        console.log(`   ✅ Already exists: ${filename} (${(stats.size / 1024).toFixed(1)} KB)`);
        results.success.push({ id, name: tab.name, file: filename });
        continue;
      }
    }
    
    try {
      console.log(`   📥 Fetching: ${tab.file}`);
      await downloadFromWikimedia(tab.file, outputPath);
      const stats = fs.statSync(outputPath);
      console.log(`   ✅ Saved: ${filename} (${(stats.size / 1024).toFixed(1)} KB)`);
      results.success.push({ id, name: tab.name, file: filename });
    } catch (err) {
      console.log(`   ❌ Failed: ${err.message}`);
      results.failed.push({ id, name: tab.name, error: err.message });
    }
    
    await new Promise(r => setTimeout(r, 1500));
  }
  
  // Summary
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                         DOWNLOAD SUMMARY                          ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  
  console.log(`\n✅ Successfully downloaded: ${results.success.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  
  if (results.failed.length > 0) {
    console.log('\nFailed downloads:');
    results.failed.forEach(f => console.log(`   - ${f.name} (${f.id}): ${f.error}`));
  }
  
  // Create manifest file
  const manifest = {
    generated: new Date().toISOString(),
    source: 'Wikimedia Commons',
    license: 'Public Domain / CC-BY-SA',
    badges: results.success.filter(r => !TAB_SOURCES[r.id]),
    tabs: results.success.filter(r => TAB_SOURCES[r.id]),
    failed: results.failed,
    directories: {
      badges: '/images/badges/',
      tabs: '/images/tabs/',
    },
  };
  
  const manifestPath = path.join(projectRoot, 'public', 'images', 'badge_manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\n📋 Manifest saved to: ${manifestPath}`);
  
  console.log('\n🎉 Badge scraping complete!');
  console.log(`   📁 Badges: ${BADGES_DIR}`);
  console.log(`   📁 Tabs: ${TABS_DIR}`);
  
  return results;
}

// Run the scraper
scrapeBadges().catch(console.error);
