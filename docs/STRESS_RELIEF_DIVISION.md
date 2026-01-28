# 🎮 Stress Relief Division - Technical Documentation

**Section 9.4: Behavioral Stress-Testing Hook (Experimental)**

## Overview

The Stress Relief Division is an intentional easter egg built into Vet-Rate.org that serves dual purposes:

1. **Technical**: Validates client-side WebAssembly (WASM) performance and input-latency under high CPU/GPU loads
2. **Therapeutic**: Provides a "Mental Health Break" feature for the beta-testing veteran community

## Activation

Type `IDDQD` (the classic DOOM god-mode cheat code) anywhere on the site.

The system uses a string-buffer listener that detects the sequence without interfering with normal text input.

## Technical Implementation

### File Structure

```
/src
  /components
    StressReliefDivision.jsx   # Main UI component
  /utils
    easterEggs.js              # Hooks for cheat code detection & gamepad support
```

### Key Components

| Component | Purpose |
|-----------|---------|
| `useIDDQD()` | Hook that listens for the IDDQD sequence globally |
| `useGamepadBridge()` | Maps Xbox/PlayStation controller inputs to keyboard events |
| `useDoomPerformance()` | Monitors FPS for the WASM engine |
| `DoomLauncher` | CRT-styled terminal launcher UI |
| `StressReliefDivision` | Main container with glitch effects and overlay |

### Controller Support

The Gamepad API bridge maps standard controller buttons:

| Button | Keyboard Equivalent |
|--------|---------------------|
| A/X | Space (Use/Shoot) |
| B/O | Escape (Menu) |
| X/□ | Tab (Map) |
| Y/△ | Enter |
| LB/RB | Q/E (Weapons) |
| D-Pad | Arrow Keys |
| Left Stick | Movement |

### Performance Features

- **Lazy Loading**: The game iframe is only loaded after activation
- **SharedArrayBuffer Ready**: Headers configured for multi-threaded WASM
- **Scanline Effect**: CSS-based CRT simulation for authentic 1993 experience
- **FPS Counter**: Real-time performance monitoring in the corner

## Legal Considerations

The implementation uses the **DOOM Shareware** version which id Software has explicitly allowed for free distribution since 1993. No copyrighted WAD files are hosted; the game runs via an external DOS emulator service.

## "Non-Profit" Classification

For grant applications and Articles of Incorporation purposes, this module can be classified as:

> "A User Resiliency & High-Load Testing Module that provides therapeutic stress relief functionality aligned with the organization's wellness mission for veterans."

## Usage Statistics

The easter egg tracks:
- `activationCount`: How many times IDDQD was entered
- No PII or gameplay data is collected

## Disabling the Feature

To disable for production:

```jsx
// In App.jsx, comment out:
// import StressReliefDivision from './components/StressReliefDivision';
// ...
// <StressReliefDivision />
```

Or set an environment variable:
```env
VITE_DISABLE_EASTER_EGGS=true
```

## The "Doom Clause" (Terms of Service)

```
Section 9: The Doom Clause
Users acknowledge that clearing a room of Imps provides a statistically 
significant (though totally unverified) boost to morale before navigating 
the VA's 10-10EZ form. By entering 'IDDQD', the user agrees to waive all 
claims of "being too busy to file."
```

---

*"Sometimes you just need to slay some demons before tackling the VA paperwork."*

— Vet-Rate.org Stress Relief Division, Est. 2026
