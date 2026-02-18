# Deprecated / Archived Code

**Date:** 2026-02-15  
**Reason:** Autonomous codebase audit identified these files as dead code — nothing in the active codebase imports them.

## Why These Files Were Moved

These files were built as part of feature development but were never integrated into the main application. They have zero active importers in the source tree. Moving them here:

- Removes them from the active codebase to reduce confusion
- Keeps them recoverable if features are re-activated later
- Improves audit metrics (function coverage, orphan count)

## To Restore a File

Simply move it back to its original location:

```powershell
# Example: restore SecurityManager
Move-Item src/_deprecated/components/SecurityManager.jsx src/components/
```

## Archived Files (53 total)

### Components (31)
- AIDisclaimerBanner.jsx — AI disclaimer banners
- AIReadyCheck.jsx — AI readiness indicator badges
- AISettingsModal.jsx — AI settings configuration modal
- AnalyticsTransparency.jsx — Analytics transparency dashboard
- BugReportButton.jsx — Bug report button widget
- CrisisOverlay.jsx — Crisis intervention overlay
- DD214VisionScanner.jsx — DD214 vision/OCR scanner
- DiamondSwarmExplainer.jsx — Diamond Swarm AI explainer
- DictationButton.jsx — Voice dictation button
- EvidenceImporter.jsx — Evidence file importer
- ExamPrepRoom.jsx — C&P exam prep room
- GuidedOnboarding.jsx — Guided onboarding wizard
- InclusiveCaptionEngine.jsx — Accessibility captions
- InclusiveVoiceSetup.jsx — Voice accessibility setup
- MissionRoadmap.jsx — Mission progress roadmap
- PacketCommander.jsx — Packet commander component
- PanicButton.jsx — Emergency panic button
- PinEntryModal.jsx — PIN entry security modal
- PrivacyHeartbeat.jsx — Privacy status heartbeat
- RedactionMode.jsx — PII redaction mode
- RibbonRack.jsx — Military ribbon rack display
- SafetyCheckModal.jsx — Safety check confirmation
- SecurityManager.jsx — Security manager component
- SecuritySettings.jsx — Security settings panel
- SessionGuardian.jsx — Session guard/timeout
- SessionLock.jsx — Session lock screen
- VaAuthCallback.jsx — VA OAuth callback handler
- VaAuthCallbackNoRouter.jsx — VA OAuth (no-router variant)
- VaFacilitiesDemo.jsx — VA facilities demo
- VaLoginButton.jsx — VA.gov login button
- VaTooltip.jsx — VA terminology tooltips
- VetRateAIAssistant.jsx — VetRate AI assistant
- VetRateSwarmChat.tsx — Multi-agent swarm chat

### Hooks (7)
- useAutoInitAI.js — Auto-initialize AI models
- useAutoSave.js — Auto-save form state
- useCrisisListener.js — Crisis keyword detection
- useDynamicCopy.js — Dynamic copy/content hooks
- useVaFacilities.js — VA facilities API hook
- useVetRateAI.js — VetRate AI integration hook
- useVetRateSwarm.ts — Diamond Swarm agent hook

### Services (4)
- VetRateAssistant.js — VetRate AI assistant service
- VetRateDiamondSwarm.js — Diamond Swarm orchestrator
- VetRateRAG.js — Retrieval-augmented generation
- VetRateWebLLM.js — WebLLM model service

### Utils (10)
- adversarialDrafting.js — Adversarial draft generation
- componentStats.js — Component statistics
- fileNomenclature.js — VA file naming conventions
- glossaryHighlighter.js — Glossary term highlighter
- imagePreprocessor.js — Image preprocessing for OCR
- packetCommander.js — PDF cover sheet generator
- releaseLog.js — Release changelog tracker
- secureStorage.js — AES-GCM encrypted storage
- useRateLimit.js — Rate limiting hook
- vaGlossary.js — VA terminology glossary
- visionPreprocessor.js — Vision model preprocessor
- vkbDocumentIntegration.js — VKB document integration
- webgpuFeatureDetector.js — WebGPU feature detection

### Data (2)
- bva_data_update.js — BVA statistics data
- testDD214Data.js — DD214 test fixtures

### Other (1)
- COPYRIGHT.js — Copyright notice constants
