# Compassionate LLM Voice System for Veterans

## 🎯 Overview

The Vet-Rate.org Compassionate Voice System implements a "Supportive Veteran Peer" experience that allows the custom LLMs (Auditor, Scribe, Rater) to "talk back" to veterans in a warm, empathetic tone.

This system follows the **Diamond Standard** - balancing legal accuracy with human compassion.

## 🏗️ Architecture

### Core Components

```
src/
├── config/
│   ├── toneMap.json          # VA jargon → vet-speak translations
│   └── multilingualTone.json # 5-language support (en, es, tl, vi, ko)
├── contexts/
│   └── LanguageContext.jsx   # App-wide language switching
├── utils/
│   ├── voiceEngine.js        # Web Speech API wrapper
│   ├── toneMapper.js         # Compassionate tone transformations
│   ├── safetyRedirect.js     # Panic key & quick exit
│   └── voiceIndex.js         # Central exports
├── hooks/
│   └── useCrisisListener.js  # Voice crisis detection
├── services/
│   └── VoiceOrchestrator.js  # Unified voice for all 3 LLMs
└── components/
    ├── LanguageSelector.jsx       # App language switcher
    ├── InclusiveVoiceSetup.jsx    # Full setup wizard
    ├── InclusiveCaptionEngine.jsx # Real-time captions
    ├── UnityLanguageTutor.jsx     # Language learning
    ├── SafetyCheckModal.jsx       # Safe space verification
    └── QuickExitButton.jsx        # Emergency exit
```

## 🧠 LLM Base Model Transparency

Veterans deserve to know what powers their AI. Our Diamond Swarm agents show:

| Agent | Base Model | Specialization |
|-------|------------|----------------|
| 💎 Diamond Auditor | Qwen2.5-7B-Instruct | VA regulations, 38 CFR, evidence analysis |
| 🎖️ CW4 Writer | Qwen2.5-7B-Instruct | Veteran-voice writing, empathetic statements |
| 🎖️ CW3 Rater | Qwen2.5-7B-Instruct | VA math, bilateral factor, combined ratings |

All models are fine-tuned from **Alibaba's Qwen 2.5** (7 billion parameters) - an open-source, privacy-respecting foundation model.

## 🎭 The "Compassionate Peer" Persona

### Tone Guidelines

1. **Veteran-Centric Empathy**: Lead with validation
   - "I hear you. That frustration is completely valid."
   - "I've looked over your records, and here's what stands out."

2. **Plain Language Translation**: Convert "VA-speak" to "Vet-Speak"
   - "Service Connection" → "Linking it to your time in uniform"
   - "Pyramiding" → "The VA's rule against getting paid twice for the same symptom"

3. **Branch-Specific Honorifics**:
   - Marine: "Semper Fi, Devil Dog."
   - Army: "Hooah, Soldier."
   - Navy: "Shipmate,"
   - Air Force: "Aim High, Airman."

### Model-Specific Behaviors

| Model | Role | Opening Example |
|-------|------|-----------------|
| VetRate-Auditor | Evidence review | "I've audited the evidence. Let's look at what we might be missing..." |
| VetRate-Scribe | Statement writing | "I've drafted your statement for you. Here's how it sounds..." |
| VetRate-Rater | VA math | "I've run the numbers using VA math. Your combined rating comes to..." |

## 🌐 Multilingual Support

### Supported Languages
- 🇺🇸 English (en)
- 🇲🇽 Spanish (es)
- 🇵🇭 Tagalog (tl)
- 🇻🇳 Vietnamese (vi)
- 🇰🇷 Korean (ko)

### Voice-to-Form Translation
Veterans can speak in their native language, and the system will:
1. Transcribe in native language
2. Translate to professional English for VA forms
3. Display both versions for verification
4. Read back summary in native language for confirmation

## 🌐 App-Wide Language Switching

The entire app can be switched to the veteran's native language:

### How It Works
1. Click the language selector in the header (shows current flag + language code)
2. Choose your preferred language
3. The entire UI switches to that language
4. VA forms are **still generated in English** (VA requirement)

### Implementation
```jsx
// In any component
import { useLanguage } from '../contexts/LanguageContext';

function MyComponent() {
  const { t, language, setLanguage } = useLanguage();
  
  return (
    <div>
      <h1>{t('header', 'title')}</h1>  {/* Translated */}
      <p>{t('calculator', 'combinedRating')}</p>
      <button onClick={() => setLanguage('es')}>Español</button>
    </div>
  );
}
```

### Translation Coverage
- Navigation & common UI elements
- Crisis intervention messages
- Calculator labels
- Voice feature controls
- Safety messages
- Branch-specific greetings
- Validation phrases

## 🛡️ Safety Features

### Crisis Interceptor Integration
- Real-time monitoring for distress keywords in all 5 languages
- Immediate voice override with crisis resources
- 988 Veterans Crisis Line information in native language

### Panic Key ("Quick Exit")
- Triple-tap `Escape` key for instant redirect
- Silences all audio
- Clears session data
- Redirects to neutral site (weather.com)

### Safe Space Verification
Before enabling voice features, veterans confirm:
- ✓ Private location
- ✓ Emotionally ready
- ✓ Aware of exit options

## 📱 Accessibility Features

### TBI/PTSD-Friendly Audio
- Default slower speech rate (0.88x)
- Lower pitch for calming effect
- Adjustable settings per veteran preference

### Visual Accessibility
- High-contrast captioning
- Real-time word highlighting
- Bilingual display (native + English)

### Disability Accommodations
- Large touch targets (48x48px minimum)
- Haptic feedback for confirmations
- Shake-to-exit on mobile

## 🎓 Unity Language Tutor

Learn the languages of fellow veterans:
- Phonetic approximations
- Spaced repetition technique
- Branch-specific greetings
- Cultural context notes

## 📋 Usage Guide

### Quick Start
```javascript
import { initializeCompassionateVoice } from './utils/voiceIndex';
import { getVoiceOrchestrator } from './services/VoiceOrchestrator';

// Initialize on app load
initializeCompassionateVoice();

// Enable voice for a session
const orchestrator = getVoiceOrchestrator();
orchestrator.setLanguage('es');
orchestrator.setBranch('Marine');
orchestrator.enable();

// Announce LLM output
orchestrator.announce({
  text: "Your combined rating is 80%",
  sourceModel: 'RATER'
});
```

### Component Usage
```jsx
import InclusiveVoiceSetup from './components/InclusiveVoiceSetup';
import QuickExitButton from './components/QuickExitButton';

function App() {
  return (
    <>
      <QuickExitButton position="top-right" variant="subtle" />
      <InclusiveVoiceSetup 
        onComplete={(settings) => console.log('Voice enabled:', settings)}
        showSafetyCheck={true}
      />
    </>
  );
}
```

## 🔐 Privacy & Security

- **100% Client-Side**: No voice data ever leaves the device
- **No PII Storage**: Voice preferences stored locally only
- **Session-Only Transcripts**: Cleared on panic exit
- **Anonymous Analytics**: Only safety feature usage counts (no content)

## 🚀 Implementation Checklist

- [x] Tone Mapping Dictionary (toneMap.json)
- [x] Multilingual Support (multilingualTone.json)
- [x] Voice Engine (Web Speech API)
- [x] Tone Transformation Utility
- [x] Safety Redirect System
- [x] Crisis Listener Hook
- [x] Voice Orchestrator Service
- [x] Inclusive Voice Setup UI
- [x] Real-time Caption Engine
- [x] Unity Language Tutor
- [x] Safe Space Modal
- [x] Quick Exit Button

## 📚 Related Documentation

- [Crisis Interceptor](../utils/crisisInterceptor.js)
- [Unified AI Service](../utils/unifiedAIService.js)
- [Diamond Swarm Architecture](../utils/diamondSwarm.js)

---

*Built with the Diamond Standard for Vet-Rate.org*
*"Your Story. Your Privacy. Our Honor."*
