# 🚀 Quick Integration Guide

## Add Security Features to Your App in 5 Minutes

### Step 1: Update main.jsx

```jsx
// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import SecurityManager from './components/SecurityManager';
import { RedactionProvider } from './components/RedactionMode';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SecurityManager>
      <RedactionProvider>
        <App />
      </RedactionProvider>
    </SecurityManager>
  </React.StrictMode>
);
```

### Step 2: Update Header Component

```jsx
// src/components/Header.jsx
import { RedactionToggle } from './RedactionMode';
import SecuritySettings from './SecuritySettings';
import { useState } from 'react';

function Header({ securityContext }) {
  const [showSecuritySettings, setShowSecuritySettings] = useState(false);

  return (
    <header>
      {/* Your existing header content */}
      
      {/* Add these buttons to your nav */}
      <div className="flex items-center gap-4">
        
        {/* Redaction Toggle */}
        <RedactionToggle />
        
        {/* Security Settings Button */}
        <button
          onClick={() => setShowSecuritySettings(true)}
          className="px-3 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          title="Security Settings"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </button>
      </div>

      {/* Security Settings Modal */}
      <SecuritySettings
        isOpen={showSecuritySettings}
        onClose={() => setShowSecuritySettings(false)}
        securityContext={securityContext}
      />
    </header>
  );
}
```

### Step 3: Add Dictation to Text Inputs

For any text input (like Personal Statement in Nexus Builder):

```jsx
// Example: NexusBuilder.jsx
import DictationButton from './DictationButton';

function PersonalStatementSection() {
  const [statement, setStatement] = useState('');

  return (
    <div className="relative">
      <label>Personal Statement</label>
      <textarea
        value={statement}
        onChange={(e) => setStatement(e.target.value)}
        className="w-full p-4 border rounded-lg"
        rows={10}
      />
      
      {/* Add dictation button in top-right corner */}
      <div className="absolute right-3 top-10">
        <DictationButton
          onTranscript={(text) => {
            setStatement(prev => prev + (prev ? ' ' : '') + text);
          }}
          size="md"
        />
      </div>
    </div>
  );
}
```

### Step 4: Mark Sensitive Data for Redaction

Anywhere you display personal info:

```jsx
// Example: MyPacket.jsx or any component showing personal data
import { Redactable } from './RedactionMode';

function ClaimCard({ claim }) {
  return (
    <div className="card">
      <h3>
        <Redactable type="name">
          {claim.veteranName}
        </Redactable>
      </h3>
      
      <p>
        SSN: <Redactable type="ssn">{claim.ssn}</Redactable>
      </p>
      
      <p>
        Address: <Redactable type="address">{claim.address}</Redactable>
      </p>
      
      <p>
        Claim #: <Redactable type="claim-number">{claim.claimNumber}</Redactable>
      </p>
    </div>
  );
}
```

### Step 5: (Optional) Replace localStorage Calls

To enable encryption, gradually replace:

```jsx
// OLD - Plaintext storage
localStorage.setItem('vet_rate_saved_claims', JSON.stringify(claims));
const claims = JSON.parse(localStorage.getItem('vet_rate_saved_claims'));

// NEW - Encrypted storage (requires user PIN)
import { secureSetItem, secureGetItem } from './utils/secureStorage';

// In component with access to securityContext
const { currentPin } = securityContext;

// Save
await secureSetItem('vet_rate_saved_claims', claims, currentPin);

// Load
const claims = await secureGetItem('vet_rate_saved_claims', currentPin);
```

---

## 🎯 Priority Implementation Order

If you want to roll out gradually:

1. **Start Here**: Add The Shield (CSP) - Already done in index.html ✅
2. **Next**: Add Redaction Mode to Header - 5 minutes
3. **Then**: Add Dictation buttons to text inputs - 10 minutes per component
4. **Finally**: Integrate Vault encryption - Requires testing with users

---

## 🧪 Testing Checklist

### Test The Vault
- [ ] First visit shows "Setup Encryption" prompt
- [ ] Create PIN (4-8 digits)
- [ ] Refresh page - should ask for PIN
- [ ] Enter correct PIN - unlocks
- [ ] Enter wrong PIN - error message
- [ ] Change PIN - works correctly

### Test Dead Man's Switch
- [ ] Leave page idle for 13 minutes
- [ ] See warning at 13:00 mark
- [ ] Countdown shows correctly
- [ ] "I'm Still Here" button resets timer
- [ ] "Lock Now" immediately locks
- [ ] After 15 min idle, screen locks

### Test The Redactor
- [ ] Toggle "Redact for Screenshot" button
- [ ] Personal info becomes blurred
- [ ] Take screenshot - verify blur visible
- [ ] Toggle off - info becomes clear
- [ ] Works with SSN, Name, Address, Phone, Claim #

### Test The Scribe
- [ ] Click microphone button
- [ ] Button turns red and pulses
- [ ] Speak clearly
- [ ] Words appear in text field
- [ ] Click again to stop
- [ ] Check browser compatibility (Chrome/Edge best)

### Test The Shield
- [ ] Open browser console (F12)
- [ ] Look for CSP violations
- [ ] Should see: "Refused to load..." for any blocked content
- [ ] Verify only allowed domains can connect

---

## 🐛 Common Issues & Fixes

### "Microphone not working"
**Cause**: Browser needs permission or HTTPS required
**Fix**: Deploy to HTTPS (localhost and file:// won't work)

### "PIN not accepting"
**Cause**: Different browser/device or cache cleared
**Fix**: Each browser has separate encryption - by design

### "CSP blocking my scripts"
**Cause**: New third-party service not in whitelist
**Fix**: Add domain to CSP in index.html

### "Vault not prompting"
**Cause**: Not enabled by default
**Fix**: User must opt-in via Security Settings

---

## 📞 Need Help?

All files are heavily commented. Look for:
- `secureStorage.js` - Encryption logic
- `SecurityManager.jsx` - Orchestration
- `SECURITY_ARCHITECTURE.md` - Full documentation

**Built by a veteran, for veterans.** 🇺🇸
