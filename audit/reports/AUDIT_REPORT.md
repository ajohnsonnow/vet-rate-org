# VetRate Autonomous Audit Report

**Generated:** 2026-02-18T05:50:18.793Z
**Overall Score:** 100/100 (Grade: A)

## Static Analysis

| Metric | Count |
|--------|-------|
| Source files | 288 |
| Functions | 2399 |
| React Components | 297 |
| Custom Hooks | 34 |
| Exports | 1285 |
| Event Handlers | 2179 |
| Files with errors | 0 |

### Risk Distribution
- **High Risk:** 283 functions
- **Medium Risk:** 799 functions
- **Low Risk:** 1317 functions

### High-Risk Functions (require testing)

| Function | File | Async | Params |
|----------|------|-------|--------|
| `authenticatedFetch` | api/va.js | Yes | 3 |
| `getDisabilityRating` | api/va.js | Yes | 1 |
| `authenticatedFetch` | api/vaSandbox.js | Yes | 3 |
| `handleCrisisEvent` | App.jsx | No | 1 |
| `handleSendToCalculator` | App.jsx | No | 3 |
| `generateCodeVerifier` | auth/useVaAuth.js | No | 0 |
| `generateCodeChallenge` | auth/useVaAuth.js | Yes | 1 |
| `base64URLEncode` | auth/useVaAuth.js | No | 1 |
| `generateState` | auth/useVaAuth.js | No | 0 |
| `saveTokens` | auth/useVaAuth.js | No | 1 |
| `getStoredTokens` | auth/useVaAuth.js | No | 0 |
| `clearTokens` | auth/useVaAuth.js | No | 0 |
| `isTokenExpired` | auth/useVaAuth.js | No | 1 |
| `useVaAuth` | auth/useVaAuth.js | No | 0 |
| `checkAuth` | auth/useVaAuth.js | Yes | 0 |
| `fetchUserInfo` | auth/useVaAuth.js | Yes | 1 |
| `refreshAccessToken` | auth/useVaAuth.js | Yes | 1 |
| `VaAuthCallback` | auth/VaAuthCallback.jsx | No | 0 |
| `handleCallback` | auth/VaAuthCallback.jsx | Yes | 0 |
| `AtomicWipe` | components/AtomicWipe.jsx | No | 1 |
| `handleAtomicWipe` | components/AtomicWipe.jsx | Yes | 0 |
| `ConfirmModal` | components/AtomicWipe.jsx | No | 1 |
| `BunkerPrivacyNotice` | components/AtomicWipe.jsx | No | 0 |
| `BackupManager` | components/BackupManager.jsx | No | 1 |
| `loadDbqStats` | components/BackupManager.jsx | Yes | 0 |
| `handleExport` | components/BackupManager.jsx | Yes | 0 |
| `handleFileSelect` | components/BackupManager.jsx | Yes | 1 |
| `handleDragOver` | components/BackupManager.jsx | No | 1 |
| `handleDragLeave` | components/BackupManager.jsx | No | 1 |
| `handleDrop` | components/BackupManager.jsx | No | 1 |

## Dynamic Testing Results

| Metric | Value |
|--------|-------|
| Total Tests | 85 |
| Passed | 85 |
| Failed | 0 |
| Skipped | 0 |
| Pass Rate | 100% |

## Gap Analysis

| Metric | Count |
|--------|-------|
| Unwired components | 0 |
| Unused exports | 0 |
| Function coverage | 100% |
| Testable UI flows | 157 |
| Isolated components | 41 |

## Dependency Health

| Metric | Count |
|--------|-------|
| Orphaned files | 0 |
| Circular dependencies | 0 |
| Unresolved imports | 0 |
| Architectural violations | 0 |
| External packages | 21 |

## Score Breakdown

**Final Score: 100/100 (A)**

No deductions - clean audit!
