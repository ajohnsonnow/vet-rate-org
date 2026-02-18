const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const w = JSON.parse(fs.readFileSync(path.join(__dirname, 'reports/wiring-map.json'), 'utf-8'));
const unused = w.unusedExports;

console.log('Deep analysis of 53 unused exports:\n');
console.log('Checking if each function is referenced ANYWHERE in the entire codebase...\n');

const srcRoot = path.join(__dirname, '..', 'src');

// For each unused export, search the whole src/ for any reference
const categories = { dead: [], futureApi: [] };

for (const exp of unused) {
  const name = exp.name;
  const file = exp.file;
  
  // Search entire src/ for this name (excluding the file it's defined in)
  try {
    const result = execSync(
      `findstr /s /r /c:"\\<${name}\\>" "${srcRoot}\\*.js" "${srcRoot}\\*.jsx" "${srcRoot}\\*.ts" "${srcRoot}\\*.tsx" 2>nul`,
      { encoding: 'utf-8', maxBuffer: 1024 * 1024 }
    ).trim();
    
    const lines = result.split('\n').filter(l => l.trim());
    // Filter out lines from the defining file
    const defFile = path.join(srcRoot, file).replace(/\//g, '\\');
    const externalRefs = lines.filter(l => !l.startsWith(defFile));
    
    if (externalRefs.length === 0) {
      categories.dead.push({ name, file, note: 'No external references found' });
    } else {
      categories.futureApi.push({ name, file, refs: externalRefs.length });
    }
  } catch (e) {
    // findstr returns exit code 1 when nothing found
    categories.dead.push({ name, file, note: 'No references found at all' });
  }
}

console.log(`\n=== TRULY DEAD (${categories.dead.length}) — safe to remove export ===`);
const deadByFile = {};
for (const d of categories.dead) {
  if (!deadByFile[d.file]) deadByFile[d.file] = [];
  deadByFile[d.file].push(d.name);
}
for (const [f, names] of Object.entries(deadByFile)) {
  console.log(`  ${f}: ${names.join(', ')}`);
}

console.log(`\n=== HAS EXTERNAL REFS (${categories.futureApi.length}) — wiring verifier missed them ===`);
for (const f of categories.futureApi) {
  console.log(`  ${f.name} (${f.file}) — ${f.refs} external refs`);
}
