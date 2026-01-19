# 🔄 Live Operations System Architecture

## System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER OPENS APP                               │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               �-�
┌──────────────────────────────────────────────────────────────────────┐
│  STEP 1: DATA MIGRATION (runs FIRST - protects user data)           │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ migrationManager.js                                          │   │
│  │ • Check localStorage for vet_rate_data_schema_version        │   │
│  │ • Compare with current SCHEMA_VERSION                        │   │
│  │ • If outdated → Run migrations                               │   │
│  │ • Update version marker                                      │   │
│  │ • Log results to console                                     │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               �-�
┌──────────────────────────────────────────────────────────────────────┐
│  STEP 2: CHANGELOG CHECK (show "What's New")                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Check localStorage: vet_rate_last_seen_version               │   │
│  │ Compare with current APP_VERSION                             │   │
│  │ If different:                                                │   │
│  │   → Load changelog from changelog.json                       │   │
│  │   → Show WhatsNewModal                                       │   │
│  │   → Mark version as seen                                     │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               �-�
┌──────────────────────────────────────────────────────────────────────┐
│  STEP 3: START UPDATE CHECKER (monitor for new versions)            │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ updateChecker.js                                             │   │
│  │ • Fetch /version.json from server (every 15 min)            │   │
│  │ • Compare server version with local APP_VERSION              │   │
│  │ • If server > local:                                         │   │
│  │   → Trigger callback with update info                        │   │
│  │   → App shows UpdateBanner                                   │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               �-�
┌──────────────────────────────────────────────────────────────────────┐
│                      APP FULLY LOADED                                │
│              User can now use all features                           │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Component Interactions

```
┌─────────────────┐
│   App.jsx       │  Main application component
│  (Orchestrator) │  • Imports all live ops utilities
└────────┬────────┘  • Manages state for banners/modals
         │           • Coordinates all systems
         │
    ┌────┴────────────────────────────────────────────┐
    │                                                  │
    �-�                                                  �-�
┌─────────────────────┐                    ┌─────────────────────┐
│  version.js         │                    │  migrationManager.js│
│  (Constants)        │                    │  (Data Protector)   │
│                     │                    │                     │
│  • APP_VERSION      │�-�───────────────────│  • compareVersions()│
│  • SCHEMA_VERSION   │                    │  • migrateUserData()│
│  • Storage keys     │                    │  • MIGRATIONS[]     │
└─────────────────────┘                    └──────────┬──────────┘
         │                                            │
         │                                            │ reads/writes
         │                                            �-�
         │                                  ┌────────────────────┐
         │                                  │  localStorage      │
         │                                  │  • app_version     │
         │                                  │  • schema_version  │
         │                                  │  • user data       │
         │                                  └────────────────────┘
         │
    ┌────┴────────────────────────────────────────────┐
    │                                                  │
    �-�                                                  �-�
┌─────────────────────┐                    ┌─────────────────────┐
│  updateChecker.js   │                    │  debugDump.js       │
│  (Sentinel)         │                    │  (Diagnostics)      │
│                     │                    │                     │
│  • checkForUpdates()│                    │  • createDebugDump()│
│  • applyUpdate()    │                    │  • downloadDebugDump│
│  • 15-min interval  │                    │  • clickCounter()   │
└──────────┬──────────┘                    └──────────┬──────────┘
           │                                          │
           │ fetches                                  │ reads
           �-�                                          �-�
    ┌─────────────────┐                    ┌────────────────────┐
    │ version.json    │                    │  localStorage      │
    │ (Server file)   │                    │  (Full dump)       │
    │                 │                    │                    │
    │ • version       │                    │  • All keys        │
    │ • updateDate    │                    │  • All values      │
    │ • changelog[]   │                    │  • Metadata        │
    └─────────────────┘                    └────────────────────┘
```

---

## UI Component Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         Screen Layout                           │
│                                                                 │
│  ┌───────────────────────────────────────────────────────┐     │
│  │ UpdateBanner (z-index: 50, fixed top)                 │     │
│  │ • Shows when update available                         │     │
│  │ • Blue gradient background                            │     │
│  │ • "Update Now" button → applyUpdate()                 │     │
│  │ • "X" dismiss button                                  │     │
│  └───────────────────────────────────────────────────────┘     │
│                                                                 │
│  ┌───────────────────────────────────────────────────────┐     │
│  │                  Main App Content                     │     │
│  │  (Header, Search, Results, Tools, etc.)              │     │
│  └───────────────────────────────────────────────────────┘     │
│                                                                 │
│  ┌───────────────────────────────────────────────────────┐     │
│  │ Footer                                                │     │
│  │  • Copyright text (clickable - 7 times → debug dump)  │     │
│  │  • Links to policies                                  │     │
│  └───────────────────────────────────────────────────────┘     │
│                                                                 │
│  ┌───────────────────────────────────────────────────────┐     │
│  │ WhatsNewModal (z-index: 50, centered overlay)         │     │
│  │ • Shows on version change                             │     │
│  │ • Lists changelog entries                             │     │
│  │ • Categorized by type (feature/fix/security)          │     │
│  │ • "Great, Let's Get to Work!" button                  │     │
│  └───────────────────────────────────────────────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow on Deploy

```
Developer Updates Code
        │
        �-�
┌──────────────────────────────────────────────────────────┐
│ 1. UPDATE VERSION FILES                                  │
│    • src/utils/version.js → APP_VERSION = "1.1.0"       │
│    • src/data/changelog.json → Add v1.1.0 entry         │
│    • public/version.json → version = "1.1.0"            │
└────────────────────┬─────────────────────────────────────┘
                     │
                     �-�
┌──────────────────────────────────────────────────────────┐
│ 2. ADD MIGRATION (if schema changed)                     │
│    • src/utils/migrationManager.js → Add to MIGRATIONS[]│
│    • Update SCHEMA_VERSION                               │
└────────────────────┬─────────────────────────────────────┘
                     │
                     �-�
┌──────────────────────────────────────────────────────────┐
│ 3. BUILD & DEPLOY                                        │
│    npm run build                                         │
│    git push origin main (Render auto-deploys)            │
└────────────────────┬─────────────────────────────────────┘
                     │
                     �-�
┌──────────────────────────────────────────────────────────┐
│ 4. SERVER NOW HAS:                                       │
│    • New code (JS/CSS/HTML)                              │
│    • Updated version.json                                │
└────────────────────┬─────────────────────────────────────┘
                     │
                     �-�
┌──────────────────────────────────────────────────────────┐
│ 5. USER'S BROWSER (within 15 minutes)                    │
│    • updateChecker fetches version.json                  │
│    • Detects server version > local version              │
│    • Shows UpdateBanner                                  │
└────────────────────┬─────────────────────────────────────┘
                     │
                     �-�
┌──────────────────────────────────────────────────────────┐
│ 6. USER CLICKS "UPDATE NOW"                              │
│    • applyUpdate() called                                │
│    • window.location.reload(true) - hard reload          │
│    • Browser fetches fresh code from server              │
└────────────────────┬─────────────────────────────────────┘
                     │
                     �-�
┌──────────────────────────────────────────────────────────┐
│ 7. APP LOADS WITH NEW VERSION                            │
│    • Migration runs (if needed)                          │
│    • WhatsNewModal shows changelog                       │
│    • User sees new features!                             │
└──────────────────────────────────────────────────────────┘
```

---

## Migration Sequence

```
User has old data (v1.0.0) → App updated to v1.2.0
                                    │
                                    �-�
┌────────────────────────────────────────────────────────┐
│ migrationManager.migrateUserData()                     │
└──────────────────┬─────────────────────────────────────┘
                   │
                   �-�
┌────────────────────────────────────────────────────────┐
│ Read localStorage: vet_rate_data_schema_version = 1.0.0│
│ Current SCHEMA_VERSION = 1.2.0                         │
│ Outdated! Need to migrate.                             │
└──────────────────┬─────────────────────────────────────┘
                   │
                   �-�
┌────────────────────────────────────────────────────────┐
│ Find migrations: 1.0.0 → 1.1.0, 1.1.0 → 1.2.0         │
└──────────────────┬─────────────────────────────────────┘
                   │
                   �-�
┌────────────────────────────────────────────────────────┐
│ Run migration 1: 1.0.0 → 1.1.0                         │
│ • Transform data structure                             │
│ • Add new fields with defaults                         │
│ • Keep old fields for compatibility                    │
└──────────────────┬─────────────────────────────────────┘
                   │
                   �-�
┌────────────────────────────────────────────────────────┐
│ Run migration 2: 1.1.0 → 1.2.0                         │
│ • Further transformations                              │
│ • Cleanup old fields                                   │
└──────────────────┬─────────────────────────────────────┘
                   │
                   �-�
┌────────────────────────────────────────────────────────┐
│ Update version markers:                                │
│ • vet_rate_data_schema_version = 1.2.0                 │
│ • vet_rate_app_version = 1.2.0                         │
└──────────────────┬─────────────────────────────────────┘
                   │
                   �-�
┌────────────────────────────────────────────────────────┐
│ Log success to console                                 │
│ "✅ Migration complete! Now at v1.2.0"                 │
└────────────────────────────────────────────────────────┘
```

---

## Debug Workflow

```
User reports bug → Support asks for debug dump
        │
        �-�
┌────────────────────────────────────────────────────────┐
│ USER: Clicks copyright 7 times rapidly                 │
└──────────────────┬─────────────────────────────────────┘
                   │
                   �-�
┌────────────────────────────────────────────────────────┐
│ debugDump.createClickCounter()                         │
│ • Counts clicks within 2-second window                 │
│ • On 7th click → trigger callback                      │
└──────────────────┬─────────────────────────────────────┘
                   │
                   �-�
┌────────────────────────────────────────────────────────┐
│ debugDump.downloadDebugDump()                          │
│ • Collects all localStorage data                       │
│ • Adds browser/system metadata                         │
│ • Creates JSON file                                    │
│ • Triggers download                                    │
└──────────────────┬─────────────────────────────────────┘
                   │
                   �-�
┌────────────────────────────────────────────────────────┐
│ User emails: vet-rate-debug-dump-2026-01-18.json      │
└──────────────────┬─────────────────────────────────────┘
                   │
                   �-�
┌────────────────────────────────────────────────────────┐
│ DEVELOPER: Opens file, reviews data                    │
│ • See exact user state                                 │
│ • Check version numbers                                │
│ • Review stored data                                   │
└──────────────────┬─────────────────────────────────────┘
                   │
                   �-�
┌────────────────────────────────────────────────────────┐
│ DEVELOPER: Load dump locally                           │
│ • Paste JSON in console                                │
│ • Import into localStorage                             │
│ • Reload → See exact bug                               │
└────────────────────────────────────────────────────────┘
```

---

## Version Check Timeline

```
Day 1, 00:00 - Deploy v1.1.0
    │
    ├─ User A visits at 00:05
    │  → Still on v1.0.0 (no check yet)
    │
    ├─ User B visits at 00:15
    │  → Update check runs
    │  → Detects v1.1.0 available
    │  → Shows UpdateBanner
    │  → User clicks "Update Now"
    │  → Hard reload → Now on v1.1.0
    │  → WhatsNewModal shows
    │
    ├─ User C visits at 01:00
    │  → Still on v1.0.0
    │  → Update check runs (been 15 min)
    │  → Shows UpdateBanner
    │
    └─ User D visits at 12:00
       → New user, downloads v1.1.0 directly
       → No update needed
       → No WhatsNewModal (first visit)
```

---

## File Structure

```
vet-rate-org-official/
│
├── src/
│   ├── utils/
│   │   ├── version.js ..................... Version constants
│   │   ├── migrationManager.js ............ Data migrations
│   │   ├── updateChecker.js ............... Update detection
│   │   └── debugDump.js ................... Diagnostic tool
│   │
│   ├── components/
│   │   ├── UpdateBanner.jsx ............... Update notification UI
│   │   └── WhatsNewModal.jsx .............. Changelog display
│   │
│   ├── data/
│   │   └── changelog.json ................. Version history
│   │
│   └── App.jsx ............................ Main orchestrator
│
├── public/
│   └── version.json ....................... Server version file
│
└── docs/
    ├── LIVE_OPS_PROTOCOL.md ............... Full documentation
    ├── QUICK_UPDATE_GUIDE.md .............. Quick reference
    └── LIVE_OPS_README.md ................. System overview
```

---

## Key Concepts

### Hard Reload vs Soft Reload
```
Soft Reload (F5):
    Browser Cache → Cached Code
    
Hard Reload (Ctrl+F5 or reload(true)):
    Server → Fresh Code
```

### Semantic Versioning
```
1.2.3
│ │ └─ PATCH: Bug fixes
│ └─── MINOR: New features
└───── MAJOR: Breaking changes
```

### Migration Safety
```
Old Data + Old Code = ✅ Works
Old Data + New Code = ❌ Breaks (without migration)
Old Data + Migration + New Code = ✅ Works
```

---

This system ensures your updates never break a veteran's work. �-️
