/**
 * VetRate Autonomous Audit - Static AST Mapper
 * 
 * Parses every JS/JSX/TS/TSX file in the src/ directory using Babel's AST parser.
 * Extracts a complete inventory of:
 *   - Exported functions, classes, constants, and React components
 *   - Function parameters and their types (via JSDoc when available)
 *   - Import dependencies (what each file depends on)
 *   - Event handlers (onClick, onSubmit, onChange, etc.)
 *   - Hook usage (useState, useEffect, custom hooks)
 *   - Context providers and consumers
 *
 * Output: reports/ast-map.json — the "ICodebaseMap" for the AI auditor.
 *
 * Think of this like an X-ray machine for your code. It doesn't run anything —
 * it just reads every file and builds a map of "what exists" and "what connects to what."
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';

// Handle ESM/CJS interop for @babel/traverse
const traverse = _traverse.default || _traverse;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_ROOT = path.resolve(__dirname, '../../src');
const REPORT_DIR = path.resolve(__dirname, '../reports');

// ─── File Discovery ───────────────────────────────────────────────
// Recursively finds every source file we care about
function discoverSourceFiles(dir, extensions = ['.js', '.jsx', '.ts', '.tsx']) {
  const files = [];
  
  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        // Skip node_modules, __pycache__, test directories, examples, etc.
        if (['node_modules', '__pycache__', '.git', 'dist', 'examples', '_deprecated'].includes(entry.name)) continue;
        walk(fullPath);
      } else if (extensions.some(ext => entry.name.endsWith(ext))) {
        // Skip documentation/example files that contain concatenated code snippets
        const upperName = entry.name.toUpperCase();
        if (upperName.includes('EXAMPLE') || upperName.includes('SECURITY_EXAMPLES')) continue;
        files.push(fullPath);
      }
    }
  }
  
  walk(dir);
  return files;
}

// ─── AST Parsing ──────────────────────────────────────────────────
// Parses a single file into an AST (Abstract Syntax Tree)
// Think of an AST like a grammar diagram of the code — every variable, function,
// and import becomes a labeled node in a tree structure.
function parseFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf-8');
  try {
    return parse(code, {
      sourceType: 'module',
      plugins: [
        'jsx',
        'typescript',
        'classProperties',
        'optionalChaining',
        'nullishCoalescingOperator',
        'dynamicImport',
        'exportDefaultFrom',
        'decorators-legacy'
      ],
      errorRecovery: true // Don't crash on syntax errors — note them and move on
    });
  } catch (err) {
    return { error: err.message, filePath };
  }
}

// ─── Module Analyzer ──────────────────────────────────────────────
// Walks the AST and extracts everything we need to know about a file
function analyzeModule(ast, filePath) {
  const relativePath = path.relative(SRC_ROOT, filePath).replace(/\\/g, '/');
  
  const moduleInfo = {
    path: relativePath,
    imports: [],          // What this file depends on
    exports: [],          // What this file provides to others
    functions: [],        // All function declarations & expressions
    components: [],       // React components (functions returning JSX)
    hooks: [],            // Custom hook definitions (useXxx)
    hookUsage: [],        // Hooks called within this file
    eventHandlers: [],    // onClick, onSubmit, onChange, etc.
    stateVariables: [],   // useState declarations
    effects: [],          // useEffect calls
    contextUsage: [],     // useContext calls
    constants: [],        // Exported constants
    errors: []            // Parse errors or analysis warnings
  };

  if (ast.error) {
    moduleInfo.errors.push({ type: 'parse_error', message: ast.error });
    return moduleInfo;
  }

  try {
    traverse(ast, {
      // ─── IMPORTS ────────────────────────────────────────
      ImportDeclaration(nodePath) {
        const source = nodePath.node.source.value;
        const specifiers = nodePath.node.specifiers.map(s => {
          if (s.type === 'ImportDefaultSpecifier') return { name: s.local.name, type: 'default' };
          if (s.type === 'ImportNamespaceSpecifier') return { name: s.local.name, type: 'namespace' };
          return { name: s.imported?.name || s.local.name, alias: s.local.name, type: 'named' };
        });
        moduleInfo.imports.push({ source, specifiers });
      },

      // ─── EXPORTS ────────────────────────────────────────
      ExportNamedDeclaration(nodePath) {
        const declaration = nodePath.node.declaration;
        if (declaration) {
          if (declaration.type === 'FunctionDeclaration' && declaration.id) {
            moduleInfo.exports.push({
              name: declaration.id.name,
              type: 'function',
              kind: 'named'
            });
          } else if (declaration.type === 'VariableDeclaration') {
            for (const declarator of declaration.declarations) {
              if (declarator.id?.name) {
                const isFunc = declarator.init && 
                  ['ArrowFunctionExpression', 'FunctionExpression'].includes(declarator.init.type);
                moduleInfo.exports.push({
                  name: declarator.id.name,
                  type: isFunc ? 'function' : 'constant',
                  kind: 'named'
                });
              }
            }
          } else if (declaration.type === 'ClassDeclaration' && declaration.id) {
            moduleInfo.exports.push({
              name: declaration.id.name,
              type: 'class',
              kind: 'named'
            });
          }
        }
        // Handle re-exports: export { X } from './module'
        if (nodePath.node.specifiers?.length > 0 && nodePath.node.source) {
          const reexportSource = nodePath.node.source.value;
          const reexportSpecifiers = [];
          for (const spec of nodePath.node.specifiers) {
            const name = spec.exported?.name || spec.local?.name;
            moduleInfo.exports.push({
              name,
              type: 'reexport',
              kind: 'named',
              source: reexportSource
            });
            reexportSpecifiers.push({ name, alias: name });
          }
          // Also record re-exports as imports so the dependency graph traces them
          moduleInfo.imports.push({ source: reexportSource, specifiers: reexportSpecifiers });
        } else if (nodePath.node.specifiers?.length > 0) {
          for (const spec of nodePath.node.specifiers) {
            moduleInfo.exports.push({
              name: spec.exported?.name || spec.local?.name,
              type: 'named',
              kind: 'named'
            });
          }
        }
      },

      ExportDefaultDeclaration(nodePath) {
        const declaration = nodePath.node.declaration;
        let name = 'default';
        if (declaration.type === 'FunctionDeclaration' && declaration.id) {
          name = declaration.id.name;
        } else if (declaration.type === 'Identifier') {
          name = declaration.name;
        } else if (declaration.type === 'ClassDeclaration' && declaration.id) {
          name = declaration.id.name;
        }
        moduleInfo.exports.push({ name, type: 'default', kind: 'default' });
      },

      // ─── FUNCTIONS ──────────────────────────────────────
      FunctionDeclaration(nodePath) {
        const fn = extractFunctionInfo(nodePath.node, relativePath);
        if (fn) {
          moduleInfo.functions.push(fn);
          // Detect React components (PascalCase + returns JSX)
          if (/^[A-Z]/.test(fn.name) && containsJSX(nodePath.node)) {
            moduleInfo.components.push(fn.name);
          }
          // Detect custom hooks (starts with "use")
          if (/^use[A-Z]/.test(fn.name)) {
            moduleInfo.hooks.push(fn.name);
          }
        }
      },

      VariableDeclarator(nodePath) {
        const init = nodePath.node.init;
        const name = nodePath.node.id?.name;
        if (!name || !init) return;
        
        // Arrow functions and function expressions
        if (['ArrowFunctionExpression', 'FunctionExpression'].includes(init.type)) {
          const fn = extractFunctionInfo({ ...init, id: { name } }, relativePath);
          if (fn) {
            moduleInfo.functions.push(fn);
            if (/^[A-Z]/.test(name) && containsJSX(init)) {
              moduleInfo.components.push(name);
            }
            if (/^use[A-Z]/.test(name)) {
              moduleInfo.hooks.push(name);
            }
          }
        }
      },

      // ─── HOOK USAGE (useState, useEffect, useContext, custom) ────
      CallExpression(nodePath) {
        const callee = nodePath.node.callee;
        let calleeName = null;
        
        if (callee.type === 'Identifier') {
          calleeName = callee.name;
        } else if (callee.type === 'MemberExpression' && callee.property) {
          calleeName = callee.property.name;
        }
        
        if (!calleeName) return;
        
        // Track useState calls
        if (calleeName === 'useState') {
          const parent = nodePath.parent;
          if (parent?.type === 'VariableDeclarator' && parent.id?.type === 'ArrayPattern') {
            const elements = parent.id.elements;
            if (elements.length >= 2) {
              moduleInfo.stateVariables.push({
                getter: elements[0]?.name,
                setter: elements[1]?.name,
                line: nodePath.node.loc?.start?.line
              });
            }
          }
        }
        
        // Track useEffect calls
        if (calleeName === 'useEffect') {
          moduleInfo.effects.push({
            line: nodePath.node.loc?.start?.line,
            hasDeps: nodePath.node.arguments.length > 1
          });
        }
        
        // Track useContext calls
        if (calleeName === 'useContext') {
          const arg = nodePath.node.arguments[0];
          if (arg?.type === 'Identifier') {
            moduleInfo.contextUsage.push(arg.name);
          }
        }
        
        // Track all hook usage (any function starting with "use")
        if (/^use[A-Z]/.test(calleeName)) {
          moduleInfo.hookUsage.push({
            hook: calleeName,
            line: nodePath.node.loc?.start?.line
          });
        }
      },

      // ─── JSX EVENT HANDLERS ─────────────────────────────
      JSXAttribute(nodePath) {
        const attrName = nodePath.node.name?.name;
        if (!attrName) return;
        
        // Capture event handler attributes
        const eventHandlerPattern = /^on[A-Z]/;
        if (eventHandlerPattern.test(attrName)) {
          const value = nodePath.node.value;
          let handlerName = null;
          
          if (value?.type === 'JSXExpressionContainer') {
            const expr = value.expression;
            if (expr.type === 'Identifier') {
              handlerName = expr.name;
            } else if (expr.type === 'ArrowFunctionExpression' || expr.type === 'FunctionExpression') {
              handlerName = '[inline]';
            } else if (expr.type === 'MemberExpression') {
              handlerName = `${expr.object?.name || '?'}.${expr.property?.name || '?'}`;
            } else if (expr.type === 'CallExpression') {
              handlerName = `[call:${expr.callee?.name || expr.callee?.property?.name || '?'}]`;
            }
          }
          
          moduleInfo.eventHandlers.push({
            event: attrName,
            handler: handlerName,
            line: nodePath.node.loc?.start?.line
          });
        }
      }
    });
  } catch (err) {
    moduleInfo.errors.push({ type: 'traverse_error', message: err.message });
  }

  return moduleInfo;
}

// ─── Helper: Extract Function Info ────────────────────────────────
function extractFunctionInfo(node, filePath) {
  const name = node.id?.name || node.key?.name || null;
  if (!name) return null;

  const params = (node.params || []).map(p => {
    if (p.type === 'Identifier') return { name: p.name, type: p.typeAnnotation?.typeAnnotation?.type || 'any' };
    if (p.type === 'AssignmentPattern') return { name: p.left?.name || '?', type: 'default', defaultValue: true };
    if (p.type === 'ObjectPattern') return { name: '{destructured}', type: 'object' };
    if (p.type === 'ArrayPattern') return { name: '[destructured]', type: 'array' };
    if (p.type === 'RestElement') return { name: `...${p.argument?.name || '?'}`, type: 'rest' };
    return { name: '?', type: p.type };
  });

  return {
    name,
    params,
    paramCount: params.length,
    async: node.async || false,
    generator: node.generator || false,
    line: node.loc?.start?.line || null,
    file: filePath
  };
}

// ─── Helper: Check if node body contains JSX ─────────────────────
function containsJSX(node) {
  let hasJSX = false;
  
  function check(n) {
    if (!n || hasJSX) return;
    if (n.type === 'JSXElement' || n.type === 'JSXFragment') {
      hasJSX = true;
      return;
    }
    // Walk child nodes
    for (const key of Object.keys(n)) {
      if (key === 'type' || key === 'loc' || key === 'start' || key === 'end') continue;
      const child = n[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item === 'object' && item.type) check(item);
        }
      } else if (child && typeof child === 'object' && child.type) {
        check(child);
      }
    }
  }
  
  check(node.body);
  return hasJSX;
}

// ─── Main: Run the full AST analysis ──────────────────────────────
function runASTAnalysis() {
  console.log('=== VetRate AST Mapper ===');
  console.log(`Scanning: ${SRC_ROOT}\n`);
  
  const sourceFiles = discoverSourceFiles(SRC_ROOT);
  console.log(`Found ${sourceFiles.length} source files\n`);
  
  const codebaseMap = {
    generatedAt: new Date().toISOString(),
    srcRoot: SRC_ROOT,
    totalFiles: sourceFiles.length,
    modules: [],
    summary: {
      totalFunctions: 0,
      totalComponents: 0,
      totalHooks: 0,
      totalExports: 0,
      totalImports: 0,
      totalEventHandlers: 0,
      totalStateVariables: 0,
      totalEffects: 0,
      filesWithErrors: 0,
      orphanedExports: [],       // Exports nobody imports
      missingImports: [],        // Imports that don't resolve
      deadCode: []               // Functions never called or exported
    }
  };

  for (const filePath of sourceFiles) {
    const ast = parseFile(filePath);
    const moduleInfo = analyzeModule(ast, filePath);
    codebaseMap.modules.push(moduleInfo);
    
    // Running summary
    codebaseMap.summary.totalFunctions += moduleInfo.functions.length;
    codebaseMap.summary.totalComponents += moduleInfo.components.length;
    codebaseMap.summary.totalHooks += moduleInfo.hooks.length;
    codebaseMap.summary.totalExports += moduleInfo.exports.length;
    codebaseMap.summary.totalImports += moduleInfo.imports.length;
    codebaseMap.summary.totalEventHandlers += moduleInfo.eventHandlers.length;
    codebaseMap.summary.totalStateVariables += moduleInfo.stateVariables.length;
    codebaseMap.summary.totalEffects += moduleInfo.effects.length;
    if (moduleInfo.errors.length > 0) codebaseMap.summary.filesWithErrors++;
  }

  // Write the full map
  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
  const outputPath = path.join(REPORT_DIR, 'ast-map.json');
  fs.writeFileSync(outputPath, JSON.stringify(codebaseMap, null, 2));
  
  // Print summary
  console.log('─── Analysis Complete ───');
  console.log(`  Files analyzed:     ${codebaseMap.totalFiles}`);
  console.log(`  Functions found:    ${codebaseMap.summary.totalFunctions}`);
  console.log(`  React Components:   ${codebaseMap.summary.totalComponents}`);
  console.log(`  Custom Hooks:       ${codebaseMap.summary.totalHooks}`);
  console.log(`  Exports:            ${codebaseMap.summary.totalExports}`);
  console.log(`  Import chains:      ${codebaseMap.summary.totalImports}`);
  console.log(`  Event Handlers:     ${codebaseMap.summary.totalEventHandlers}`);
  console.log(`  State Variables:    ${codebaseMap.summary.totalStateVariables}`);
  console.log(`  useEffect calls:    ${codebaseMap.summary.totalEffects}`);
  console.log(`  Files with errors:  ${codebaseMap.summary.filesWithErrors}`);
  console.log(`\n  Report: ${outputPath}`);
  
  return codebaseMap;
}

// Run if called directly
runASTAnalysis();

export { runASTAnalysis, discoverSourceFiles, parseFile, analyzeModule };
