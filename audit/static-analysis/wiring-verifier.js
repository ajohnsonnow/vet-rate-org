/**
 * VetRate Autonomous Audit - UI-to-Function Wiring Verifier
 * 
 * This is the "detective" script. It answers the critical question:
 * "When a user clicks a button in the UI, does the right function actually run?"
 *
 * It works by cross-referencing three data sources:
 *   1. The AST map (what functions exist)
 *   2. The dependency graph (what imports what)
 *   3. The App.jsx state/event analysis (which show* states trigger which components)
 *
 * For each component rendered in App.jsx, it traces:
 *   show state variable → setter function → event handler → component render → 
 *   component's internal functions → utility/service calls
 *
 * Output: reports/wiring-map.json — a complete UI-to-backend wiring audit.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';

const traverse = _traverse.default || _traverse;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPORT_DIR = path.resolve(__dirname, '../reports');
const SRC_ROOT = path.resolve(__dirname, '../../src');

// ─── App.jsx State-to-Component Mapper ────────────────────────────
// Reads App.jsx and maps every showXxx state to its component
function mapAppStateToComponents() {
  const appPath = path.join(SRC_ROOT, 'App.jsx');
  const code = fs.readFileSync(appPath, 'utf-8');
  
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator'],
    errorRecovery: true
  });

  const stateToComponent = [];
  const imports = [];
  const stateVariables = [];
  const eventHandlerWiring = [];

  traverse(ast, {
    // Gather all imports to know which components are available
    ImportDeclaration(nodePath) {
      const source = nodePath.node.source.value;
      const specifiers = nodePath.node.specifiers.map(s => ({
        name: s.local.name,
        type: s.type === 'ImportDefaultSpecifier' ? 'default' : 'named'
      }));
      imports.push({ source, specifiers });
    },

    // Find all useState calls for show* variables
    CallExpression(nodePath) {
      if (nodePath.node.callee?.name !== 'useState') return;
      const parent = nodePath.parent;
      if (parent?.type !== 'VariableDeclarator') return;
      if (parent.id?.type !== 'ArrayPattern') return;
      
      const elements = parent.id.elements;
      if (elements.length < 2) return;
      
      const getter = elements[0]?.name;
      const setter = elements[1]?.name;
      
      if (getter && setter) {
        stateVariables.push({
          getter,
          setter,
          isShowState: getter.startsWith('show'),
          line: nodePath.node.loc?.start?.line
        });
      }
    },

    // Find JSX usage patterns: {showXxx && <Component />}
    JSXElement(nodePath) {
      const openingElement = nodePath.node.openingElement;
      const componentName = openingElement?.name?.name;
      if (!componentName) return;

      // Pattern 1: isOpen={showXxx} prop pattern (modal/overlay components)
      for (const attr of (openingElement.attributes || [])) {
        if (attr.type === 'JSXAttribute' && attr.value?.type === 'JSXExpressionContainer') {
          const attrName = attr.name?.name;
          const expr = attr.value.expression;
          if ((attrName === 'isOpen' || attrName === 'open' || attrName === 'visible' || attrName === 'show') &&
              expr.type === 'Identifier') {
            stateToComponent.push({
              stateVariable: expr.name,
              component: componentName,
              renderPattern: 'prop-controlled',
              line: nodePath.node.loc?.start?.line
            });
          }
        }
      }

      // Walk up to find conditional rendering patterns
      let current = nodePath;
      while (current.parentPath) {
        const parent = current.parentPath;
        
        // Pattern 2: {stateVar && <Component />}
        if (parent.node.type === 'LogicalExpression' && parent.node.operator === '&&') {
          // Collect ALL identifiers from chained && expressions
          // e.g., showX && data && <Component /> → finds showX and data
          const collectIdentifiers = (node) => {
            const ids = [];
            if (node.type === 'Identifier') {
              ids.push(node.name);
            } else if (node.type === 'LogicalExpression' && node.operator === '&&') {
              ids.push(...collectIdentifiers(node.left));
              ids.push(...collectIdentifiers(node.right));
            }
            return ids;
          };
          
          const identifiers = collectIdentifiers(parent.node.left);
          for (const id of identifiers) {
            stateToComponent.push({
              stateVariable: id,
              component: componentName,
              renderPattern: 'conditional-and',
              line: parent.node.loc?.start?.line
            });
          }
          break;
        }
        
        // Pattern 3: ternary — showXxx ? <Component /> : null
        if (parent.node.type === 'ConditionalExpression') {
          const test = parent.node.test;
          if (test.type === 'Identifier') {
            stateToComponent.push({
              stateVariable: test.name,
              component: componentName,
              renderPattern: 'ternary',
              line: parent.node.loc?.start?.line
            });
          }
          break;
        }
        current = parent;
      }
    },

    // Find onClick/onClose handlers that set show states
    JSXAttribute(nodePath) {
      const attrName = nodePath.node.name?.name;
      if (!attrName) return;
      
      // Look for onClose, onClick, onOpen patterns
      if (/^on[A-Z]/.test(attrName)) {
        const value = nodePath.node.value;
        if (value?.type === 'JSXExpressionContainer') {
          const expr = value.expression;
          let handlerDescription = null;
          let targetState = null;
          
          if (expr.type === 'ArrowFunctionExpression') {
            // () => setShowXxx(true/false)
            const body = expr.body;
            if (body.type === 'CallExpression' && body.callee?.type === 'Identifier') {
              handlerDescription = body.callee.name;
              if (body.callee.name.startsWith('setShow')) {
                targetState = body.callee.name.replace('set', '').replace(/^(.)/, c => c.toLowerCase());
              }
            } else if (body.type === 'BlockStatement') {
              // Multi-statement arrow function — look for setShow calls inside
              for (const stmt of body.body) {
                if (stmt.type === 'ExpressionStatement' && 
                    stmt.expression?.type === 'CallExpression' &&
                    stmt.expression.callee?.type === 'Identifier' &&
                    stmt.expression.callee.name.startsWith('setShow')) {
                  targetState = stmt.expression.callee.name.replace('set', '').replace(/^(.)/, c => c.toLowerCase());
                  handlerDescription = stmt.expression.callee.name;
                }
              }
            }
          } else if (expr.type === 'Identifier') {
            handlerDescription = expr.name;
          }

          // Get parent component context
          let parentComponent = null;
          let current = nodePath.parentPath;
          while (current) {
            if (current.node.type === 'JSXOpeningElement' && current.node.name?.name) {
              parentComponent = current.node.name.name;
              break;
            }
            current = current.parentPath;
          }
          
          eventHandlerWiring.push({
            event: attrName,
            handler: handlerDescription,
            targetState,
            parentComponent,
            line: nodePath.node.loc?.start?.line
          });
        }
      }
    }
  });

  return { imports, stateVariables, stateToComponent, eventHandlerWiring };
}

// ─── Component Internal Wiring ────────────────────────────────────
// For each component file, map its internal function calls to utils/services
function analyzeComponentWiring(astMap, depGraph) {
  const componentWiring = [];

  for (const mod of astMap.modules) {
    if (!mod.path.startsWith('components/')) continue;
    if (mod.components.length === 0) continue;

    const wiring = {
      component: mod.components[0] || path.basename(mod.path, path.extname(mod.path)),
      file: mod.path,
      // What utilities/services does this component use?
      utilImports: mod.imports
        .filter(i => i.source.includes('utils/') || i.source.includes('../utils/'))
        .map(i => ({
          source: i.source,
          functions: i.specifiers.map(s => s.name)
        })),
      serviceImports: mod.imports
        .filter(i => i.source.includes('services/') || i.source.includes('../services/'))
        .map(i => ({
          source: i.source,
          functions: i.specifiers.map(s => s.name)
        })),
      hookImports: mod.imports
        .filter(i => i.source.includes('hooks/') || i.source.includes('../hooks/'))
        .map(i => ({
          source: i.source,
          hooks: i.specifiers.map(s => s.name)
        })),
      contextImports: mod.imports
        .filter(i => i.source.includes('contexts/') || i.source.includes('../contexts/'))
        .map(i => ({
          source: i.source,
          contexts: i.specifiers.map(s => s.name)
        })),
      dataImports: mod.imports
        .filter(i => i.source.includes('data/') || i.source.includes('../data/'))
        .map(i => ({
          source: i.source,
          data: i.specifiers.map(s => s.name)
        })),
      // Internal event handlers
      eventHandlers: mod.eventHandlers,
      // State management
      stateCount: mod.stateVariables.length,
      states: mod.stateVariables,
      // Effects (side effects that wire to external calls)
      effectCount: mod.effects.length,
      // Total internal functions
      internalFunctions: mod.functions.map(f => ({
        name: f.name,
        params: f.paramCount,
        async: f.async
      })),
      // Hook usage
      hookUsage: mod.hookUsage.map(h => h.hook)
    };

    componentWiring.push(wiring);
  }

  return componentWiring;
}

// ─── Wiring Completeness Check ────────────────────────────────────
// Verifies that every function exported by utils/services is actually used somewhere
function checkWiringCompleteness(astMap) {
  // Build a map of what's exported from utils/services/hooks
  const availableFunctions = [];
  const usedFunctions = new Set();

  for (const mod of astMap.modules) {
    const isUtilOrService = mod.path.startsWith('utils/') || 
                            mod.path.startsWith('services/') || 
                            mod.path.startsWith('hooks/') ||
                            mod.path.startsWith('api/');
    
    if (isUtilOrService) {
      for (const exp of mod.exports) {
        // Don't count re-exports twice — the source module already counts them
        if (exp.type === 'reexport') continue;
        availableFunctions.push({
          name: exp.name,
          file: mod.path,
          type: exp.type
        });
      }
    }
  }

  // Check what's imported across all files (static imports)
  for (const mod of astMap.modules) {
    for (const imp of mod.imports) {
      for (const spec of imp.specifiers) {
        usedFunctions.add(spec.name);
      }
    }
  }

  // Also check for re-exports — if a function is re-exported, count it as used
  for (const mod of astMap.modules) {
    for (const exp of mod.exports) {
      if (exp.type === 'reexport' && exp.source) {
        // The local name in the re-export source is used
        usedFunctions.add(exp.name);
      }
    }
  }

  // Also scan for dynamic import() usage patterns in component files
  // e.g., const { buildSystemPrompt } = await import('./aiSystemPrompts')
  // or: const { buildDKBContext } = await getAISystemPrompts()
  const SRC_ROOT_PATH = path.resolve(__dirname, '../../src');
  for (const mod of astMap.modules) {
    const fullPath = path.join(SRC_ROOT_PATH, mod.path);
    if (!fs.existsSync(fullPath)) continue;
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      // Match destructured dynamic imports (direct or via wrapper):
      //   { func1, func2 } = await import('...')
      //   { func1, func2 } = await getModule()  
      const dynamicDestructures = content.matchAll(/\{\s*([^}]+)\}\s*=\s*await\s+(?:import\s*\(|[a-zA-Z_$]\w*\s*\()/g);
      for (const match of dynamicDestructures) {
        const names = match[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0].trim());
        for (const name of names) {
          if (name && /^[a-zA-Z_$]/.test(name)) usedFunctions.add(name);
        }
      }
      // Also match: const mod = await import('...'); mod.funcName(...)
      const dotAccessAfterImport = content.matchAll(/=\s*await\s+import\s*\([^)]+\)[\s\S]*?\.\s*([a-zA-Z_$]\w*)\s*[(\[;,]/g);
      for (const match of dotAccessAfterImport) {
        usedFunctions.add(match[1]);
      }
    } catch {
      // Skip files that can't be read
    }
  }

  // ─── Same-file internal usage detection ───────────────────────────
  // An exported function that is also *called* or *referenced* elsewhere
  // in its own module counts as "used" — it's part of the module's
  // public API AND actively wired into internal logic.
  for (const mod of astMap.modules) {
    const isUtilOrService = mod.path.startsWith('utils/') ||
                            mod.path.startsWith('services/') ||
                            mod.path.startsWith('hooks/') ||
                            mod.path.startsWith('api/');
    if (!isUtilOrService) continue;

    const fullPath = path.join(SRC_ROOT_PATH, mod.path);
    if (!fs.existsSync(fullPath)) continue;
    let content;
    try { content = fs.readFileSync(fullPath, 'utf-8'); } catch { continue; }

    for (const exp of mod.exports) {
      if (exp.type === 'reexport' || exp.name === 'default') continue;
      if (usedFunctions.has(exp.name)) continue; // already known-used

      // Check if identifier appears more than once in the file
      // (once = declaration/export site, >1 = also referenced internally)
      const escaped = exp.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp('\\b' + escaped + '\\b', 'g');
      const hits = content.match(re) || [];
      if (hits.length > 1) {
        usedFunctions.add(exp.name);
      }
    }
  }

  const unusedExports = availableFunctions.filter(f => 
    f.name !== 'default' && !usedFunctions.has(f.name)
  );

  const coverage = {
    totalExportedFunctions: availableFunctions.length,
    usedFunctions: availableFunctions.filter(f => usedFunctions.has(f.name)).length,
    unusedExports,
    coveragePercent: availableFunctions.length > 0
      ? Math.round((availableFunctions.filter(f => usedFunctions.has(f.name)).length / availableFunctions.length) * 100)
      : 100
  };

  return coverage;
}

// ─── Main ─────────────────────────────────────────────────────────
function runWiringVerification() {
  console.log('\n=== VetRate UI-to-Function Wiring Verifier ===\n');
  
  const astMapPath = path.join(REPORT_DIR, 'ast-map.json');
  const depGraphPath = path.join(REPORT_DIR, 'dependency-graph.json');
  
  if (!fs.existsSync(astMapPath)) {
    console.error('ERROR: ast-map.json not found. Run ast-mapper.js first.');
    process.exit(1);
  }

  const astMap = JSON.parse(fs.readFileSync(astMapPath, 'utf-8'));
  const depGraph = fs.existsSync(depGraphPath) 
    ? JSON.parse(fs.readFileSync(depGraphPath, 'utf-8'))
    : null;

  // 1. Map App.jsx state to components
  console.log('Phase 1: Mapping App.jsx state → component rendering...');
  const appWiring = mapAppStateToComponents();
  console.log(`  Found ${appWiring.stateVariables.length} state variables`);
  console.log(`  Found ${appWiring.stateToComponent.length} state-to-component bindings`);
  console.log(`  Found ${appWiring.eventHandlerWiring.length} event handler wirings`);

  // 2. Analyze component-level wiring
  console.log('\nPhase 2: Analyzing component internal wiring...');
  const componentWiring = analyzeComponentWiring(astMap, depGraph);
  console.log(`  Analyzed ${componentWiring.length} components`);

  // 3. Check wiring completeness
  console.log('\nPhase 3: Checking wiring completeness...');
  const completeness = checkWiringCompleteness(astMap);
  console.log(`  Exported functions: ${completeness.totalExportedFunctions}`);
  console.log(`  Used functions:     ${completeness.usedFunctions}`);
  console.log(`  Unused exports:     ${completeness.unusedExports.length}`);
  console.log(`  Coverage:           ${completeness.coveragePercent}%`);

  // 4. Find unwired components (in App.jsx but no state toggle)
  const importedComponents = new Set(
    appWiring.imports
      .filter(i => i.source.startsWith('./components/'))
      .flatMap(i => i.specifiers.map(s => s.name))
  );
  
  const wiredComponents = new Set(appWiring.stateToComponent.map(s => s.component));
  const unwiredComponents = [...importedComponents].filter(c => 
    !wiredComponents.has(c) && 
    // These are always-rendered or utility components, not show/hide toggleable
    !['Header', 'SearchBar', 'Disclaimer', 'ToastContainer', 'FloatingBugButton',
      'ReportBugLink', 'CrisisModal', 'UpdateBanner', 'WhatsNewModal', 'DisclaimerSplash',
      'QuickExitButton', 'LoadingBunker', 'AnimatedBug', 'AIAssistant', 'SecurityBadge',
      'MobileNotice', 'GlobalCommandSearch', 'MobileBottomNav', 'MobileNavSpacer',
      'StressReliefDivision', 'BootCampTour', 'DemoDataLoader', 'VaApiStatusBanner',
      'MobileSaveReminder', 'TermsOfServiceModal', 'CrisisOverlay', 'PWAInstallButton',
      'VersionDropdown', 'SearchResultCard', 'QuickConditionPicker', 'AdminLogin',
      'AdminPanel', 'AdminAuthProvider', 'LocalAIProvider', 'HelperModeProvider',
      'ToastProvider', 'FocusModeProvider', 'LanguageProvider', 'PIISensitive',
      'ShareButton', 'ZonkButton', 'BuyMeCoffee', 'useToast', 'CommandersChecklist'
    ].includes(c)
  );

  // 5. Compile final report
  const wiringReport = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalAppStateVariables: appWiring.stateVariables.length,
      showStateVariables: appWiring.stateVariables.filter(s => s.isShowState).length,
      stateToComponentBindings: appWiring.stateToComponent.length,
      eventHandlerWirings: appWiring.eventHandlerWiring.length,
      componentsAnalyzed: componentWiring.length,
      importedButUnwiredComponents: unwiredComponents.length,
      exportedFunctions: completeness.totalExportedFunctions,
      usedFunctions: completeness.usedFunctions,
      functionCoveragePercent: completeness.coveragePercent
    },
    // Detailed app-level wiring
    appStateToComponent: appWiring.stateToComponent,
    appEventHandlers: appWiring.eventHandlerWiring,
    // Components that are imported but have no show* toggle
    unwiredComponents: unwiredComponents.map(c => ({
      component: c,
      note: 'Imported in App.jsx but no show* state toggle found — verify rendering path'
    })),
    // Per-component deep wiring
    componentWiring,
    // Unused utility functions
    unusedExports: completeness.unusedExports,
    // All show-state → component pairs for test generation
    testableFlows: appWiring.stateToComponent.map(binding => ({
      trigger: `Click to set ${binding.stateVariable} = true`,
      component: binding.component,
      stateVariable: binding.stateVariable,
      setter: `set${binding.stateVariable.charAt(0).toUpperCase()}${binding.stateVariable.slice(1)}`,
      verifyRender: `Expect <${binding.component} /> to be visible`,
      line: binding.line
    }))
  };

  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
  const outputPath = path.join(REPORT_DIR, 'wiring-map.json');
  fs.writeFileSync(outputPath, JSON.stringify(wiringReport, null, 2));

  console.log('\n─── Wiring Verification Complete ───');
  if (unwiredComponents.length > 0) {
    console.log(`\n  Components imported but no show-state found:`);
    for (const c of unwiredComponents) {
      console.log(`    - ${c}`);
    }
  }
  if (completeness.unusedExports.length > 0) {
    console.log(`\n  Unused exported functions (${completeness.unusedExports.length}):`);
    for (const e of completeness.unusedExports.slice(0, 15)) {
      console.log(`    - ${e.name} (${e.file})`);
    }
    if (completeness.unusedExports.length > 15) {
      console.log(`    ... and ${completeness.unusedExports.length - 15} more`);
    }
  }
  console.log(`\n  Report: ${outputPath}`);
  
  return wiringReport;
}

runWiringVerification();

export { mapAppStateToComponents, analyzeComponentWiring, checkWiringCompleteness, runWiringVerification };
