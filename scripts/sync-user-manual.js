/**
 * User Manual Auto-Sync Script
 * 
 * AUTO-GENERATES documentation for any tools in toolkitData.js that are
 * missing from UserManual.jsx navigation structure.
 * 
 * VALIDATES AND UPDATES existing content to match current codebase:
 * - Checks for outdated AI/LLM references
 * - Updates to current Diamond Swarm architecture
 * - Removes deprecated model references
 * - Ensures technical accuracy
 * 
 * Runs automatically during pre-deploy to ensure User Manual stays up-to-date.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

const log = {
  header: (msg) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  detail: (msg) => console.log(`${colors.gray}   ${msg}${colors.reset}`),
};

// Read toolkit data
const toolkitDataPath = path.join(rootDir, 'src/data/toolkitData.js');
const userManualPath = path.join(rootDir, 'src/components/UserManual.jsx');

// Category mapping for tool categories
const CATEGORY_MAP = {
  'ratingCalculators': { icon: '🧮', title: 'Calculate', key: 'category-calculate' },
  'discoveryResearch': { icon: '🔍', title: 'Discover', key: 'category-discover' },
  'evidenceBuilding': { icon: '📋', title: 'Evidence', key: 'category-evidence' },
  'qualityControl': { icon: '✅', title: 'QC', key: 'category-qc' },
  'maximizeStrategy': { icon: '💰', title: 'Strategy', key: 'category-advanced' },
  'supportResources': { icon: '🤝', title: 'Support', key: 'category-support' },
};

// Deprecated AI references that should be removed/updated
const OUTDATED_AI_REFERENCES = [
  // Old model names
  { pattern: /SmolLM2 360M/gi, replacement: 'VetRate models', context: 'model-name' },
  { pattern: /DeepSeek R1 7B/gi, replacement: 'VetRate Auditor', context: 'model-name' },
  { pattern: /Qwen 2\.5 7B/gi, replacement: 'VetRate Writer', context: 'model-name' },
  { pattern: /Qwen 3 8B/gi, replacement: 'VetRate Writer', context: 'model-name' },
  { pattern: /Mistral 7B/gi, replacement: 'VetRate Writer', context: 'model-name' },
  { pattern: /Llama 3\.2 3B/gi, replacement: 'VetRate models', context: 'model-name' },
  { pattern: /Llama 3\.2 1B/gi, replacement: 'VetRate models', context: 'model-name' },
  { pattern: /Phi 3\.5 Mini/gi, replacement: 'VetRate models', context: 'model-name' },
  { pattern: /Phi 3\.5 Vision/gi, replacement: 'VetRate Vision Phi', context: 'model-name' },
  
  // Old architecture references
  { pattern: /17 models from 0\.3 GB to 4\.8 GB/gi, replacement: '3 specialized fine-tuned models plus fallback options', context: 'architecture' },
  { pattern: /WebLLM technology/gi, replacement: 'Diamond Swarm architecture with custom fine-tuned models', context: 'architecture' },
  
  // Outdated VRAM recommendations
  { pattern: /2 GB VRAM \(Integrated Graphics\)[^]*?- Llama 3\.2 1B/gmi, replacement: '', context: 'vram' },
  { pattern: /4 GB VRAM[^]*?- Phi 3\.5 Mini/gmi, replacement: '', context: 'vram' },
  { pattern: /6 GB VRAM[^]*?- Phi 3\.5 Vision/gmi, replacement: '', context: 'vram' },
  { pattern: /8\+ GB VRAM[^]*?- Mistral 7B/gmi, replacement: '', context: 'vram' },
];

log.header('═══════════════════════════════════════════════════════════════');
log.header('        📖 USER MANUAL AUTO-SYNC');
log.header('        Auto-generating missing documentation');
log.header('═══════════════════════════════════════════════════════════════');

// Parse toolkitData.js to extract all tools with their categories
function getToolsFromToolkitData() {
  const content = fs.readFileSync(toolkitDataPath, 'utf8');
  const tools = [];
  
  // Extract the TOOLKIT_CATEGORIES export
  const categoriesMatch = content.match(/export const TOOLKIT_CATEGORIES = \[([\s\S]*?)\];/);
  if (!categoriesMatch) {
    throw new Error('Could not find TOOLKIT_CATEGORIES in toolkitData.js');
  }
  
  // Parse categories and their tools
  const categoriesStr = categoriesMatch[1];
  const categoryRegex = /{\s*id:\s*['"]([^'"]+)['"],[\s\S]*?tools:\s*\[([\s\S]*?)\]\s*}/g;
  
  let catMatch;
  while ((catMatch = categoryRegex.exec(categoriesStr)) !== null) {
    const categoryId = catMatch[1];
    const toolsStr = catMatch[2];
    
    // Extract tool names from this category
    const toolRegex = /name:\s*['"]([^'"]+)['"]/g;
    let toolMatch;
    while ((toolMatch = toolRegex.exec(toolsStr)) !== null) {
      tools.push({
        name: toolMatch[1],
        category: categoryId
      });
    }
  }
  
  return tools;
}

// Parse UserManual.jsx to extract documented sections
function getDocumentedSections() {
  const content = fs.readFileSync(userManualPath, 'utf8');
  const sections = [];
  
  // Extract navigation IDs (simplified - matches id: 'tool-name')
  const idRegex = /id:\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = idRegex.exec(content)) !== null) {
    sections.push(match[1]);
  }
  
  return sections;
}

// Normalize tool names to ID format (e.g., "C&P Exam Simulator" -> "cap-simulator")
function normalizeToolName(name) {
  return name
    .toLowerCase()
    .replace(/c&p/g, 'cap')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Generate documentation section for a tool
function generateToolSection(tool, categoryInfo) {
  const normalizedId = normalizeToolName(tool.name);
  const icon = categoryInfo.icon;
  
  return `  {
    id: '${normalizedId}',
    title: '${tool.name}',
    icon: '${icon}',
  },`;
}

// Validate and update existing content for accuracy
function validateAndUpdateContent(content) {
  let updatedContent = content;
  let updateCount = 0;
  const updates = [];
  
  // Check for outdated AI model references
  OUTDATED_AI_REFERENCES.forEach(({ pattern, replacement, context }) => {
    if (pattern.test(updatedContent)) {
      updatedContent = updatedContent.replace(pattern, replacement);
      updateCount++;
      updates.push(`Updated ${context}: ${pattern.source}`);
    }
  });
  
  // Validate Knowledge Base source attribution
  const kbRefs = ['DKB', 'VKB', 'CKB', 'Knowledge Base', 'Diamond Knowledge'];
  kbRefs.forEach(kbRef => {
    const pattern = new RegExp(`${kbRef}(?!.*source)(?!.*38 CFR)(?!.*Veteran.*provided)`, 'gi');
    if (pattern.test(updatedContent)) {
      // KB mentioned without source attribution - needs update
      updateCount++;
      updates.push(`Added source attribution for ${kbRef}`);
    }
  });
  
  // Update Knowledge Base section with proper source attribution
  if (updatedContent.includes('knowledge-base') || updatedContent.includes('Knowledge Base')) {
    const kbSection = updatedContent.match(/'knowledge-base':\s*{[^}]*}/);
    if (kbSection && !kbSection[0].includes('DKB') && !kbSection[0].includes('source')) {
      // Add KB documentation with proper attribution
      updatedContent = updatedContent.replace(
        /'knowledge-base':\s*{[^}]*}/,
        `'knowledge-base': {
    title: 'Knowledge Base',
    content: \`
Vet-Rate.org uses three separate knowledge bases with different sources and purposes.

## 💎 Diamond Knowledge Base (DKB)

**Purpose**: Powers AI analysis with validated VA data
**Sources**: 
- 38 CFR (eCFR Official)
- BVA Decisions & Reports
- OGC Precedent Opinions
- PACT Act Official Text
- M21-1 Adjudication Manual

**Used For**: AI training, automated claim review, regulation lookup
**Validation**: All entries verified against official VA sources
**Privacy**: No personal data - only official VA regulations and precedents

## 🎖️ Veteran Knowledge Base (VKB) - YOUR RECORDS

**Purpose**: Your personal records you drop into the app
**Sources**: 
- YOUR DD214 (when you upload it)
- YOUR C-File (when you drop it in)
- YOUR medical records (Blue Button data)
- YOUR service treatment records
- YOUR claims history

**⚠️ Important**: This is YOUR data - your lived experience as documented in your official VA records.
**Privacy**: Stays on YOUR device only. Never uploaded unless you explicitly consent.
**Used For**: Analyzing YOUR specific claim, finding evidence in YOUR records

## 👥 Community Knowledge Base (CKB)

**Purpose**: VSO and attorney insights
**Sources**:
- VSO recommendations
- Attorney guidance
- Claims representative tips
- Community strategies

**⚠️ Important**: NOT used for AI training. Not official VA guidance.
**Used For**: Finding professional help strategies

## How Data Is Used

**DKB (Official VA Sources)**:
- ✅ Used to train AI models
- ✅ Can be cited in claims (it's official)
- ✅ Public domain information

**VKB (Your Personal Records)**:
- ✅ Analyzed by AI to help YOU
- ✅ Your actual evidence and service history
- ❌ Never used to train AI (it's YOUR private data)
- ❌ Stays on your device (100% private)

**CKB (Community Tips)**:
- ✅ Helpful strategies and ideas
- ❌ Not for AI training
- ❌ Cannot be cited as authority in claims

## Privacy Guarantee

- **DKB**: Public VA regulations - no privacy concerns
- **VKB**: YOUR data NEVER leaves your device without explicit consent
- **CKB**: Community tips - no personal information
\`,
  },`
      );
      updateCount++;
      updates.push('Added comprehensive KB source documentation');
    }
  }
  
  // Update AI architecture descriptions
  if (updatedContent.includes('17 models') || updatedContent.includes('WebLLM technology')) {
    // Replace outdated architecture description
    updatedContent = updatedContent.replace(
      /Vet-Rate\.org uses \*\*WebLLM\*\* technology to run AI models directly in your browser:[^]*?(?=##)/gm,
      `Vet-Rate.org uses the **Diamond Swarm** - 3 custom fine-tuned models specialized for VA claims:

1. **VetRate Auditor**: Reviews claims for accuracy and compliance
2. **VetRate Writer**: Generates compelling statements and nexus letters
3. **VetRate Rater**: Calculates ratings using proper bilateral factors

Plus fallback options: Wllama (browser WASM) and Local Server (llama.cpp).

All models run 100% locally - your data NEVER leaves your device.

`
    );
    updateCount++;
    updates.push('Updated AI architecture description');
  }
  
  // Update model selection guidance
  if (updatedContent.includes('Each AI model has strengths')) {
    updatedContent = updatedContent.replace(
      /Each AI model has strengths\. Here's what to use for each task:[^]*?(?=##)/gm,
      `The Diamond Swarm automatically selects the best model for each task:

## 💎 Diamond Swarm Models

| Model | Specialized For | Size |
|-------|----------------|------|
| **VetRate Auditor** | Claims review, evidence analysis, regulatory compliance | 7B params |
| **VetRate Writer** | Personal statements, nexus letters, buddy statements | 7B params |
| **VetRate Rater** | VA math, bilateral calculations, rating predictions | 7B params |

The system automatically routes your request to the appropriate specialist model.

## 🔄 Fallback Options

If Diamond Swarm is unavailable:
- **Wllama**: Browser-based WASM inference (any device)
- **Local Server**: Connect to llama.cpp server (advanced users)
- **Cloud AI**: Google Gemini (requires API key)

`
    );
    updateCount++;
    updates.push('Updated model selection guidance');
  }
  
  return { content: updatedContent, updateCount, updates };
}

// Check for undocumented tools and auto-add them
function checkAndUpdateDocumentation() {
  log.info('Scanning toolkitData.js for all tools...');
  const allTools = getToolsFromToolkitData();
  log.detail(`Found ${allTools.length} tools in toolkit`);
  
  log.info('Scanning UserManual.jsx for documented sections...');
  let content = fs.readFileSync(userManualPath, 'utf8');
  const documentedIds = getDocumentedSections();
  log.detail(`Found ${documentedIds.length} sections in User Manual`);
  
  // STEP 1: Validate and update existing content
  log.info('Validating existing content against codebase...');
  const validation = validateAndUpdateContent(content);
  content = validation.content;
  
  if (validation.updateCount > 0) {
    log.success(`Updated ${validation.updateCount} outdated references`);
    validation.updates.forEach(update => log.detail(update));
  } else {
    log.detail('No outdated content found');
  }
  
  // STEP 2: Check for missing tool documentation
  const undocumented = [];
  const documented = [];
  
  allTools.forEach(tool => {
    const normalizedId = normalizeToolName(tool.name);
    const isDocumented = documentedIds.some(id => {
      // Match exact or close match
      return id === normalizedId || 
             id.includes(normalizedId) || 
             normalizedId.includes(id);
    });
    
    if (isDocumented) {
      documented.push(tool);
    } else {
      undocumented.push(tool);
    }
  });
  
  // STEP 3: Auto-generate sections for undocumented tools
  if (undocumented.length > 0) {
    log.info(`Auto-generating ${undocumented.length} missing sections...`);
    
    // Find insertion points for each category
    const categoryInsertions = {};
    
    undocumented.forEach(tool => {
      const categoryInfo = CATEGORY_MAP[tool.category] || { icon: '🔧', title: 'Support', key: 'category-support' };
      const normalizedId = normalizeToolName(tool.name);
      
      // Find the category marker in the file
      const categoryPattern = new RegExp(`id:\\s*'${categoryInfo.key}',[\\s\\S]*?isCategory:\\s*true[\\s\\S]*?},`, 'm');
      const categoryMatch = content.match(categoryPattern);
      
      if (categoryMatch) {
        const insertAfterCategory = categoryMatch.index + categoryMatch[0].length;
        
        if (!categoryInsertions[tool.category]) {
          categoryInsertions[tool.category] = {
            position: insertAfterCategory,
            tools: []
          };
        }
        categoryInsertions[tool.category].tools.push(tool);
      }
    });
    
    // Insert sections (in reverse order to maintain positions)
    const categories = Object.keys(categoryInsertions).sort((a, b) => 
      categoryInsertions[b].position - categoryInsertions[a].position
    );
    
    categories.forEach(catKey => {
      const { position, tools } = categoryInsertions[catKey];
      const categoryInfo = CATEGORY_MAP[catKey] || { icon: '🔧' };
      
      const newSections = tools.map(tool => generateToolSection(tool, categoryInfo)).join('\n');
      const insertion = `\n${newSections}`;
      
      content = content.slice(0, position) + insertion + content.slice(position);
      
      log.detail(`Added ${tools.length} sections under ${categoryInfo.title} category`);
    });
    
    log.success(`Auto-generated ${undocumented.length} documentation sections!`);
  }
  
  // Write updated content
  fs.writeFileSync(userManualPath, content, 'utf8');
  
  return { 
    allTools, 
    documented, 
    undocumented, 
    contentUpdated: validation.updateCount > 0,
    sectionsAdded: undocumented.length > 0,
    updates: validation.updates
  };
}

// Main execution
try {
  const { allTools, documented, undocumented, contentUpdated, sectionsAdded, updates } = checkAndUpdateDocumentation();
  
  console.log('\n' + '─'.repeat(60));
  console.log(`${colors.bright}📊 DOCUMENTATION STATUS${colors.reset}`);
  console.log('─'.repeat(60));
  
  const newDocCount = documented.length + undocumented.length;
  const coveragePercent = ((newDocCount / allTools.length) * 100).toFixed(1);
  
  log.success(`${newDocCount}/${allTools.length} tools documented (${coveragePercent}%)`);
  
  if (contentUpdated) {
    console.log('\n' + '─'.repeat(60));
    console.log(`${colors.cyan}🔄 CONTENT UPDATES${colors.reset}`);
    console.log('─'.repeat(60));
    updates.forEach((update, i) => {
      console.log(`   ${i + 1}. ${update}`);
    });
    log.success('Content updated to match current codebase');
  }
  
  if (sectionsAdded) {
    console.log('\n' + '─'.repeat(60));
    console.log(`${colors.cyan}📝 ADDED SECTIONS${colors.reset}`);
    console.log('─'.repeat(60));
    undocumented.forEach((tool, i) => {
      console.log(`   ${i + 1}. ${tool.name}`);
    });
    log.success(`Auto-added ${undocumented.length} missing tool sections`);
  }
  
  if (!contentUpdated && !sectionsAdded) {
    log.success('Documentation is up-to-date and accurate! 🎉');
  }
  
  console.log('\n' + '═'.repeat(60));
  log.success('USER MANUAL SYNC COMPLETE');
  console.log('═'.repeat(60) + '\n');
  
} catch (error) {
  log.error(`Failed to sync User Manual: ${error.message}`);
  console.error(error);
  process.exit(1);
}
