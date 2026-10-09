/**
 * VetRate Autonomous Audit - Dependency Graph Builder
 * 
 * Takes the AST map and builds a complete dependency graph showing:
 *   - Which files import from which other files
 *   - Orphaned files (nothing imports them, and they're not entry points)
 *   - Circular dependencies (A imports B imports C imports A)
 *   - Missing imports (file references something that doesn't exist)
 *   - Cross-boundary violations (e.g., utils importing from components)
 *
 * Think of this like a highway map of your code — every road (import) between
 * every city (file). We're looking for dead-end roads, loops, and illegal turns.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPORT_DIR = path.resolve(__dirname, '../reports');
const SRC_ROOT = path.resolve(__dirname, '../../src');

// ─── Architectural Boundaries ─────────────────────────────────────
// These rules define what's allowed to import what.
// Violations indicate architectural drift or tight coupling.
const ARCHITECTURAL_RULES = [
  {
    name: 'utils-cannot-import-components',
    description: 'Utility files should never depend on React components',
    from: /^utils\//,
    cannotImportFrom: /^components\//,
    severity: 'error'
  },
  {
    name: 'data-cannot-import-components',
    description: 'Data files should be pure data, not depend on UI',
    from: /^data\//,
    cannotImportFrom: /^components\//,
    severity: 'error'
  },
  {
    name: 'utils-cannot-import-hooks',
    description: 'Utilities should not use React hooks',
    from: /^utils\//,
    cannotImportFrom: /^hooks\//,
    severity: 'warning'
  },
  {
    name: 'services-cannot-import-components',
    description: 'Service layer should not depend on UI layer',
    from: /^services\//,
    cannotImportFrom: /^components\//,
    severity: 'error'
  },
  {
    name: 'api-cannot-import-components',
    description: 'API layer should not depend on UI layer',
    from: /^api\//,
    cannotImportFrom: /^components\//,
    severity: 'error'
  }
];

// ─── Import Resolution ────────────────────────────────────────────
// Resolves relative imports to actual file paths
function resolveImportPath(importSource, importerPath) {
  // Skip node_modules / external packages
  if (!importSource.startsWith('.') && !importSource.startsWith('/')) {
    return { type: 'external', package: importSource };
  }
  
  const importerDir = path.dirname(importerPath);
  let resolved = path.posix.join(importerDir, importSource);
  
  // Try common extensions
  const extensions = ['', '.js', '.jsx', '.ts', '.tsx', '/index.js', '/index.jsx', '/index.ts', '/index.tsx'];
  for (const ext of extensions) {
    const candidate = resolved + ext;
    const fullPath = path.join(SRC_ROOT, candidate);
    if (fs.existsSync(fullPath)) {
      return { type: 'internal', resolvedPath: candidate };
    }
  }
  
  return { type: 'unresolved', originalSource: importSource, from: importerPath };
}

// ─── Graph Builder ────────────────────────────────────────────────
function buildDependencyGraph(astMap) {
  const graph = {
    nodes: new Map(),      // filePath -> { imports: [], importedBy: [] }
    edges: [],             // { from, to, specifiers }
    external: new Set(),   // External package names
    orphans: [],           // Files nothing imports
    circular: [],          // Circular dependency chains
    unresolved: [],        // Imports that couldn't be resolved
    violations: [],        // Architectural boundary violations
    stats: {}
  };

  // Initialize nodes
  for (const mod of astMap.modules) {
    graph.nodes.set(mod.path, {
      path: mod.path,
      exports: mod.exports.map(e => e.name),
      components: mod.components,
      imports: [],
      importedBy: []
    });
  }

  // Build edges
  for (const mod of astMap.modules) {
    for (const imp of mod.imports) {
      const resolved = resolveImportPath(imp.source, mod.path);
      
      if (resolved.type === 'external') {
        graph.external.add(resolved.package);
        continue;
      }
      
      if (resolved.type === 'unresolved') {
        graph.unresolved.push({
          from: mod.path,
          importSource: imp.source,
          specifiers: imp.specifiers.map(s => s.name)
        });
        continue;
      }
      
      const edge = {
        from: mod.path,
        to: resolved.resolvedPath,
        specifiers: imp.specifiers.map(s => s.name)
      };
      graph.edges.push(edge);
      
      // Update node relationships
      const fromNode = graph.nodes.get(mod.path);
      if (fromNode) fromNode.imports.push(resolved.resolvedPath);
      
      const toNode = graph.nodes.get(resolved.resolvedPath);
      if (toNode) toNode.importedBy.push(mod.path);
    }
  }

  // ─── Detect Orphans ──────────────────────────────────────────
  // Entry points that are OK to have no importers
  const entryPoints = ['App.jsx', 'main.jsx', 'index.css'];
  
  // Also find files referenced via dynamic import() or new URL() patterns
  // These won't show up in the static import graph
  const dynamicallyImported = new Set();
  for (const mod of astMap.modules) {
    // Scan raw function calls for import() with string args
    for (const fn of mod.functions) {
      if (fn.name === 'import') dynamicallyImported.add(fn.name);
    }
  }
  
  // Check all source files for dynamic import() patterns
  const srcFiles = [...graph.nodes.keys()];
  for (const filePath of srcFiles) {
    const fullPath = path.join(SRC_ROOT, filePath);
    if (!fs.existsSync(fullPath)) continue;
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      // Match import('./path/to/file') or import("./path/to/file")
      const dynamicImports = content.matchAll(/import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g);
      for (const match of dynamicImports) {
        const resolved = resolveImportPath(match[1], filePath);
        if (resolved.type === 'internal') {
          dynamicallyImported.add(resolved.resolvedPath);
          // Also update the node's importedBy list
          const toNode = graph.nodes.get(resolved.resolvedPath);
          if (toNode) toNode.importedBy.push(filePath + ' (dynamic)');
        }
      }
      // Match new URL('./worker.js', import.meta.url) patterns
      const workerURLs = content.matchAll(/new\s+URL\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*import\.meta\.url\s*\)/g);
      for (const match of workerURLs) {
        const resolved = resolveImportPath(match[1], filePath);
        if (resolved.type === 'internal') {
          dynamicallyImported.add(resolved.resolvedPath);
          const toNode = graph.nodes.get(resolved.resolvedPath);
          if (toNode) toNode.importedBy.push(filePath + ' (worker)');
        }
      }
    } catch (e) {
      // Skip files that can't be read
    }
  }
  
  for (const [filePath, node] of graph.nodes) {
    if (node.importedBy.length === 0 && 
        !entryPoints.includes(filePath) && 
        !dynamicallyImported.has(filePath)) {
      // Check if it's a test file or config (also OK)
      if (!filePath.includes('test/') && !filePath.includes('config/') && !filePath.includes('examples/')) {
        graph.orphans.push({
          path: filePath,
          exports: node.exports,
          components: node.components
        });
      }
    }
  }

  // ─── Detect Circular Dependencies ────────────────────────────
  const visited = new Set();
  const recursionStack = new Set();
  
  function detectCycle(node, path) {
    visited.add(node);
    recursionStack.add(node);
    
    const nodeData = graph.nodes.get(node);
    if (!nodeData) {
      recursionStack.delete(node);
      return;
    }
    
    for (const dep of nodeData.imports) {
      if (!visited.has(dep)) {
        detectCycle(dep, [...path, dep]);
      } else if (recursionStack.has(dep)) {
        // Found a cycle
        const cycleStart = path.indexOf(dep);
        const cycle = cycleStart >= 0 ? path.slice(cycleStart) : [dep, ...path];
        graph.circular.push({
          chain: [...cycle, dep],
          severity: 'warning'
        });
      }
    }
    
    recursionStack.delete(node);
  }
  
  for (const [filePath] of graph.nodes) {
    if (!visited.has(filePath)) {
      detectCycle(filePath, [filePath]);
    }
  }

  // ─── Enforce Architectural Rules ─────────────────────────────
  for (const edge of graph.edges) {
    for (const rule of ARCHITECTURAL_RULES) {
      if (rule.from.test(edge.from) && rule.cannotImportFrom.test(edge.to)) {
        graph.violations.push({
          rule: rule.name,
          description: rule.description,
          severity: rule.severity,
          from: edge.from,
          to: edge.to,
          specifiers: edge.specifiers
        });
      }
    }
  }

  // ─── Statistics ──────────────────────────────────────────────
  graph.stats = {
    totalInternalFiles: graph.nodes.size,
    totalInternalEdges: graph.edges.length,
    externalPackages: graph.external.size,
    orphanedFiles: graph.orphans.length,
    circularDependencies: graph.circular.length,
    unresolvedImports: graph.unresolved.length,
    architecturalViolations: graph.violations.length,
    violationsByRule: {}
  };

  for (const v of graph.violations) {
    graph.stats.violationsByRule[v.rule] = (graph.stats.violationsByRule[v.rule] || 0) + 1;
  }

  return graph;
}

// ─── Report Generation ────────────────────────────────────────────
function generateDependencyReport(graph) {
  // Convert Map to Object for JSON serialization
  const nodesObj = {};
  for (const [key, val] of graph.nodes) {
    nodesObj[key] = val;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    stats: graph.stats,
    orphans: graph.orphans,
    circular: graph.circular,
    unresolved: graph.unresolved,
    violations: graph.violations,
    externalPackages: [...graph.external].sort(),
    // Full graph data for deep analysis
    nodes: nodesObj,
    edges: graph.edges
  };

  const outputPath = path.join(REPORT_DIR, 'dependency-graph.json');
  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

  // Print summary
  console.log('\n=== VetRate Dependency Graph ===');
  console.log(`  Internal files:        ${graph.stats.totalInternalFiles}`);
  console.log(`  Internal imports:      ${graph.stats.totalInternalEdges}`);
  console.log(`  External packages:     ${graph.stats.externalPackages}`);
  console.log(`  Orphaned files:        ${graph.stats.orphanedFiles}`);
  console.log(`  Circular dependencies: ${graph.stats.circularDependencies}`);
  console.log(`  Unresolved imports:    ${graph.stats.unresolvedImports}`);
  console.log(`  Arch violations:       ${graph.stats.architecturalViolations}`);
  
  if (graph.violations.length > 0) {
    console.log('\n  ⚠ Architectural Violations:');
    for (const v of graph.violations) {
      console.log(`    [${v.severity.toUpperCase()}] ${v.rule}`);
      console.log(`      ${v.from} → ${v.to}`);
    }
  }

  if (graph.orphans.length > 0) {
    console.log(`\n  Orphaned files (${graph.orphans.length}):`);
    for (const o of graph.orphans.slice(0, 10)) {
      console.log(`    - ${o.path}`);
    }
    if (graph.orphans.length > 10) {
      console.log(`    ... and ${graph.orphans.length - 10} more`);
    }
  }

  console.log(`\n  Report: ${outputPath}`);
  return report;
}

// ─── Main ─────────────────────────────────────────────────────────
function runDependencyAnalysis() {
  const astMapPath = path.join(REPORT_DIR, 'ast-map.json');
  
  if (!fs.existsSync(astMapPath)) {
    console.error('ERROR: ast-map.json not found. Run ast-mapper.js first.');
    console.error(`  Expected at: ${astMapPath}`);
    process.exit(1);
  }

  const astMap = JSON.parse(fs.readFileSync(astMapPath, 'utf-8'));
  const graph = buildDependencyGraph(astMap);
  const report = generateDependencyReport(graph);
  return report;
}

runDependencyAnalysis();

export { buildDependencyGraph, generateDependencyReport, runDependencyAnalysis };
