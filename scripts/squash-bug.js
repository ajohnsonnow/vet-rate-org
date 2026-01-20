/**
 * BUG SQUASHER CLI
 * 
 * Automates adding squashed bugs to the tracker.
 * 
 * Usage:
 *   npm run squash-bug                    # Interactive mode
 *   npm run squash-bug -- --id "BUG-ABC123" --title "Fixed the thing"
 *   npm run squash-bug -- --parse         # Parse from clipboard (bug report format)
 * 
 * The script will:
 * 1. Generate a unique bug ID if not provided
 * 2. Add the bug to src/data/squashedBugs.js
 * 3. Mark it as recent (isRecent: true)
 * 4. Update the count automatically
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const squashedBugsPath = path.join(rootDir, 'src', 'data', 'squashedBugs.js');

// ═══════════════════════════════════════════════════════════════════════════════
// Bug Categories
// ═══════════════════════════════════════════════════════════════════════════════

const CATEGORIES = [
  'UI',
  'Data',
  'Feature',
  'Performance',
  'Mobile',
  'Accessibility',
  'Build',
  'Search',
  'PDF',
  'Other'
];

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function generateBugId() {
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BUG-${year}-${random}`;
}

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    interactive: true,
    parse: false,
    id: null,
    title: null,
    description: null,
    category: null,
    reportedBy: 'Community'
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--parse':
        parsed.parse = true;
        parsed.interactive = false;
        break;
      case '--id':
        parsed.id = args[++i];
        parsed.interactive = false;
        break;
      case '--title':
        parsed.title = args[++i];
        parsed.interactive = false;
        break;
      case '--desc':
      case '--description':
        parsed.description = args[++i];
        break;
      case '--category':
        parsed.category = args[++i];
        break;
      case '--reporter':
        parsed.reportedBy = args[++i];
        break;
      case '--internal':
        parsed.reportedBy = 'Internal QA';
        break;
    }
  }

  return parsed;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Parse Bug Report from Text
// ═══════════════════════════════════════════════════════════════════════════════

function parseBugReportText(text) {
  const bug = {
    id: null,
    title: null,
    description: null,
    category: null,
    reportedBy: 'Community'
  };

  // Extract Report ID
  const idMatch = text.match(/Report ID:\s*(BUG-[A-Z0-9-]+)/i);
  if (idMatch) bug.id = idMatch[1];

  // Extract Category
  const categoryMatch = text.match(/Category:\s*([^\n]+)/i);
  if (categoryMatch) {
    const cat = categoryMatch[1].trim();
    // Map category from bug report to our categories
    if (cat.includes('UI') || cat.includes('Display')) bug.category = 'UI';
    else if (cat.includes('Data') || cat.includes('Incorrect')) bug.category = 'Data';
    else if (cat.includes('Feature') || cat.includes('Not Working')) bug.category = 'Feature';
    else if (cat.includes('Performance') || cat.includes('Speed')) bug.category = 'Performance';
    else if (cat.includes('Mobile') || cat.includes('Responsive')) bug.category = 'Mobile';
    else if (cat.includes('Accessibility')) bug.category = 'Accessibility';
    else if (cat.includes('Search')) bug.category = 'Search';
    else if (cat.includes('PDF')) bug.category = 'PDF';
    else bug.category = 'Other';
  }

  // Extract Module as part of title context
  const moduleMatch = text.match(/Module:\s*([^\n]+)/i);
  const module = moduleMatch ? moduleMatch[1].trim() : '';

  // Extract User Description
  const descMatch = text.match(/USER DESCRIPTION[\s─]*\n([\s\S]*?)(?=─|STEPS TO|EXPECTED|$)/i);
  if (descMatch) {
    const desc = descMatch[1].trim();
    if (desc && desc !== '(No description provided)') {
      bug.description = desc.split('\n')[0].substring(0, 200); // First line, max 200 chars
    }
  }

  // Generate title from description or module
  if (bug.description) {
    bug.title = bug.description.substring(0, 80);
    if (bug.description.length > 80) bug.title += '...';
  } else if (module) {
    bug.title = `Issue in ${module}`;
  }

  return bug;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Interactive Mode
// ═══════════════════════════════════════════════════════════════════════════════

async function interactiveMode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

  console.log('\n🐛 Bug Squasher - Add Squashed Bug\n');
  console.log('─'.repeat(50));

  // Check if user wants to paste a bug report
  const pasteReport = await question('\nPaste a bug report? (y/n): ');
  
  let bug = {};

  if (pasteReport.toLowerCase() === 'y') {
    console.log('\nPaste the bug report text (press Enter twice when done):\n');
    
    let reportText = '';
    let emptyLineCount = 0;
    
    const collectLines = () => new Promise(resolve => {
      const lineHandler = (line) => {
        if (line === '') {
          emptyLineCount++;
          if (emptyLineCount >= 2) {
            rl.removeListener('line', lineHandler);
            resolve(reportText);
            return;
          }
        } else {
          emptyLineCount = 0;
        }
        reportText += line + '\n';
      };
      rl.on('line', lineHandler);
    });

    reportText = await collectLines();
    bug = parseBugReportText(reportText);
    
    console.log('\n📋 Parsed from report:');
    console.log(`   ID: ${bug.id || '(will generate)'}`);
    console.log(`   Title: ${bug.title || '(need input)'}`);
    console.log(`   Category: ${bug.category || '(need input)'}`);
  }

  // Get/confirm bug details
  if (!bug.id) {
    const customId = await question(`\nBug ID (Enter for auto-generate): `);
    bug.id = customId || generateBugId();
  }

  if (!bug.title) {
    bug.title = await question('\nBug title (brief description): ');
  } else {
    const confirmTitle = await question(`\nTitle: "${bug.title}"\nPress Enter to keep or type new: `);
    if (confirmTitle) bug.title = confirmTitle;
  }

  if (!bug.description) {
    bug.description = await question('\nFix description (what you did to fix it): ');
  } else {
    const confirmDesc = await question(`\nDescription: "${bug.description}"\nPress Enter to keep or type new: `);
    if (confirmDesc) bug.description = confirmDesc;
  }

  if (!bug.category) {
    console.log('\nCategories:', CATEGORIES.join(', '));
    bug.category = await question('Category: ');
  }

  const reporter = await question('\nReported by (Community/Internal QA) [Community]: ');
  bug.reportedBy = reporter || 'Community';

  rl.close();
  return bug;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Add Bug to File
// ═══════════════════════════════════════════════════════════════════════════════

function addBugToFile(bug) {
  // Read current file
  let content = fs.readFileSync(squashedBugsPath, 'utf8');

  // Find the insertion point (after "ADD NEW SQUASHED BUGS AT THE TOP")
  const insertMarker = '// === ADD NEW SQUASHED BUGS AT THE TOP ===';
  const insertIndex = content.indexOf(insertMarker);

  if (insertIndex === -1) {
    console.error('❌ Could not find insertion marker in squashedBugs.js');
    process.exit(1);
  }

  const today = getTodayDate();
  
  // Create the new bug entry
  const newBugEntry = `
  {
    id: '${bug.id}',
    title: '${bug.title.replace(/'/g, "\\'")}',
    description: '${(bug.description || '').replace(/'/g, "\\'")}',
    category: '${bug.category}',
    reportedDate: '${today}',
    squashedDate: '${today}',
    reportedBy: '${bug.reportedBy}',
    isRecent: true
  },`;

  // Insert after the marker
  const markerEnd = insertIndex + insertMarker.length;
  content = content.slice(0, markerEnd) + newBugEntry + content.slice(markerEnd);

  // Clear isRecent from older bugs (keep only last 5 as recent)
  // Count occurrences of isRecent: true
  const recentMatches = content.match(/isRecent:\s*true/g);
  if (recentMatches && recentMatches.length > 6) {
    // Find and update older ones
    let count = 0;
    content = content.replace(/isRecent:\s*true/g, (match) => {
      count++;
      return count <= 6 ? match : 'isRecent: false';
    });
  }

  // Write back
  fs.writeFileSync(squashedBugsPath, content, 'utf8');

  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('        🐛💀 Bug Squasher - Mark Bug as SQUASHED');
  console.log('═══════════════════════════════════════════════════════════════');

  const args = parseArgs();
  let bug;

  if (args.interactive) {
    bug = await interactiveMode();
  } else if (args.parse) {
    // Read from stdin for piped input
    console.log('\nReading bug report from stdin...');
    let input = '';
    process.stdin.setEncoding('utf8');
    for await (const chunk of process.stdin) {
      input += chunk;
    }
    bug = parseBugReportText(input);
    if (!bug.id) bug.id = generateBugId();
  } else {
    // Use command line args
    bug = {
      id: args.id || generateBugId(),
      title: args.title || 'Bug fix',
      description: args.description || '',
      category: args.category || 'Other',
      reportedBy: args.reportedBy
    };
  }

  // Validate
  if (!bug.title) {
    console.error('❌ Bug title is required');
    process.exit(1);
  }

  if (!CATEGORIES.includes(bug.category)) {
    console.log(`⚠️  Unknown category "${bug.category}", defaulting to "Other"`);
    bug.category = 'Other';
  }

  // Add to file
  console.log('\n📝 Adding squashed bug...');
  console.log(`   ID: ${bug.id}`);
  console.log(`   Title: ${bug.title}`);
  console.log(`   Category: ${bug.category}`);
  console.log(`   Reporter: ${bug.reportedBy}`);

  addBugToFile(bug);

  console.log('\n✅ Bug squashed and added to tracker!');
  console.log('\n📋 Next steps:');
  console.log('   1. Run: npm run build');
  console.log('   2. The counter will automatically update');
  console.log('   3. Bug will appear in What\'s New modal');
  
  console.log('\n═══════════════════════════════════════════════════════════════');
}

main().catch(console.error);
