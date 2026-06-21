import globals from "globals";
import tseslint from "typescript-eslint";
import sonarjs from "eslint-plugin-sonarjs";
import pluginJs from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  {
    ignores: [
      "dist/",
      "node_modules/",
      "coverage/",
      ".vitepress/cache",
      "**/*.d.ts",
    ],
  },
  pluginJs.configs.recommended,
  // TypeScript files — strict type-aware rules with full project service
  {
    files: ["**/*.{ts,mts,tsx}"],
    extends: tseslint.configs.strictTypeChecked,
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
      },
    },
  },
  // JavaScript files — type-unaware rules only (no projectService needed)
  {
    files: ["**/*.{js,mjs,cjs,jsx}"],
    extends: tseslint.configs.recommended,
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  sonarjs.configs.recommended,
  // Accessibility and React hooks — explicit plugin registration for flat config.
  // Must cover EVERY extension the rules block below targets (incl. mjs/cjs/mts),
  // or finalizing the config for a .mjs/.cjs file throws "Could not find plugin".
  {
    files: ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"],
    plugins: {
      "jsx-a11y": jsxA11y,
      "react-hooks": reactHooks,
    },
  },
  {
    files: ["**/*.{ts,mts,tsx,js,mjs,cjs,jsx}"],
    rules: {
      // Complexity — raised to 20 to match realistic JS/JSX thresholds
      complexity: ["warn", 20],
      "sonarjs/cognitive-complexity": ["warn", 20],
      "max-lines-per-function": ["warn", { max: 80, skipBlankLines: true, skipComments: true }],

      // Empty catch blocks are an intentional "best-effort, ignore failure" idiom
      "no-empty": ["error", { allowEmptyCatch: true }],

      // Turn off base rule; @typescript-eslint/no-unused-vars supersedes it
      "no-unused-vars": "off",
      // Honor _underscore-prefix convention for intentionally unused variables
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
      }],

      // Redundant with @typescript-eslint/no-unused-vars
      "sonarjs/no-unused-vars": "off",

      // Production console.log is stripped by terser; keep as warn, not error
      "no-console": ["warn", { allow: ["error", "warn"] }],

      // Pattern/regex rules: informational only — not build-blocking
      "sonarjs/slow-regex": "warn",
      "sonarjs/regex-complexity": "warn",
      "sonarjs/no-nested-conditional": "warn",

      // Math.random() is intentional (UI jitter, non-security contexts)
      "sonarjs/pseudo-random": "off",

      // jsx-a11y: tracked as warnings; accessibility fixes ongoing (WCAG 2.2 AA goal)
      "jsx-a11y/label-has-associated-control": "warn",
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/no-static-element-interactions": "warn",
      "jsx-a11y/no-noninteractive-element-interactions": "warn",
      "jsx-a11y/no-autofocus": "warn",
      "jsx-a11y/anchor-is-valid": "warn",
      "jsx-a11y/no-redundant-roles": "warn",
      "jsx-a11y/iframe-has-title": "warn",
      "jsx-a11y/no-noninteractive-tabindex": "warn",

      // react-hooks/exhaustive-deps: warn only — many are intentional empty dep arrays
      "react-hooks/exhaustive-deps": "warn",

      // sonarjs: issues tracked for incremental cleanup — downgrade from error to warn
      "sonarjs/no-dead-store": "warn",
      "sonarjs/no-ignored-exceptions": "warn",
      "sonarjs/no-identical-functions": "warn",
      "sonarjs/no-nested-functions": "warn",
      "sonarjs/no-nested-template-literals": "warn",
      "sonarjs/no-commented-code": "warn",
      "sonarjs/no-invariant-returns": "warn",
      "sonarjs/no-redundant-assignments": "warn",
      "sonarjs/no-all-duplicated-branches": "warn",
      "sonarjs/no-duplicated-branches": "warn",
      "sonarjs/todo-tag": "warn",
      "sonarjs/fixme-tag": "warn",

      // Regex style rules — informational, not correctness
      "sonarjs/duplicates-in-character-class": "warn",
      "sonarjs/concise-regex": "warn",
      "sonarjs/single-char-in-character-classes": "warn",
      "sonarjs/single-character-alternation": "warn",
      "sonarjs/anchor-precedence": "warn",

      // http:// in test data is intentional for sanitization tests
      "sonarjs/no-clear-text-protocols": "warn",

    },
  },
  // Test / e2e specs (Playwright .ts, Vitest .js): these live outside tsconfig's
  // project, so the type-aware parser can't resolve them ("not found by the project
  // service"). Lint them for syntax/style only — disable type-checked rules and the
  // project service. Strict type rules add little value to test scaffolding.
  {
    files: ["tests/**/*.{ts,tsx,mts,cts}", "**/*.{test,spec}.{ts,tsx,mts,cts}"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      parserOptions: { projectService: false, project: null },
    },
    rules: {
      // Non-null assertions are a normal, safe idiom in test scaffolding.
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
  // Node tooling — build/CI scripts and CommonJS modules. They legitimately spawn
  // child processes and use require(); the browser-app security/style rules that
  // flag those don't apply to trusted local tooling.
  {
    files: ["scripts/**", "**/*.cjs", "*.config.{js,mjs,cjs}"],
    rules: {
      "sonarjs/os-command": "off",
      "sonarjs/no-os-command-from-path": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
);
