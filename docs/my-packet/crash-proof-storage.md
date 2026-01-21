# Crash-Proof Storage System

Your veteran data is protected by a multi-layered storage system designed to survive browser crashes, cache clears, and device changes.

<div class="crisis-banner">
🆘 <strong>Veterans Crisis Line:</strong> Call 988, Press 1 | Text 838255 | Available 24/7
</div>

---

## How Your Data is Protected

Vet-Rate.org now uses a **"Save-As-You-Go"** protocol that ensures your work is never lost.

### The Protection Layers

| Layer | Description | Survives |
|-------|-------------|----------|
| **💾 File System** | Saves directly to your computer (Desktop only) | ✅ Crashes, ✅ Cache clear, ✅ Uninstall |
| **📦 IndexedDB** | Modern browser storage with large capacity | ✅ Crashes, ✅ Tab closes, ❌ Cache clear |
| **⚡ Memory Buffer** | Real-time changes before save | ❌ (temporary) |

---

## Desktop Users (Best Experience)

On desktop browsers (Chrome, Edge, Firefox on Windows/Mac), you get the **Gold Standard** protection:

### How It Works

1. **Click "💾 Save My Packet"** - Creates a file on your actual hard drive
2. **Continue working** - Changes auto-save to that file as you type
3. **Never worry about losing data** - Even if your browser crashes, power goes out, or you clear cache

### File Location

When you click "Save My Packet", your browser will ask where to save the file. We recommend:
- `Documents/My-Vet-Rate-Packet.json`
- A cloud-synced folder like OneDrive or Google Drive

### Resume Where You Left Off

Coming back tomorrow? Click **"📂 Resume Packet"** and select your saved file. You'll pick up exactly where you left off.

---

## Mobile Users (Android/iOS)

Mobile browsers don't support direct file system access, so we use a **Download Backup** approach:

### How It Works

1. **Work normally** - Data saves to your browser's internal storage
2. **Download regularly** - Use "Local Backup" to download your packet
3. **Store safely** - Keep the downloaded file in a safe location

### Important for Mobile

!!! warning "Mobile Limitations"
    
    On mobile devices, clearing your browser data **will erase** your saved work.
    
    **Always download a backup before:**
    - Clearing browser cache
    - Reinstalling the browser
    - Using a different device

---

## Auto-Save Features

### Form Auto-Save

When filling out forms in Forms Helper:
- Every field change triggers an auto-save
- Data is protected within **1.5 seconds** of your last keystroke
- Visual indicator shows save status

### Step Transitions

When clicking "Next" on multi-step forms:
- Data is saved **before** the screen changes
- You can't lose progress mid-form

### Milestone Saves

Even if you stop typing:
- Automatic save every **30 seconds** if changes exist
- Peace of mind during long sessions

---

## Unsaved Changes Warning

If you try to close your browser tab with unsaved changes:

- **Desktop**: A warning dialog appears
- **Mobile**: Same warning, plus periodic reminder to download backup

The warning says: "Changes you made may not be saved."

---

## Save Status Indicators

Look for these indicators in My Packet:

| Status | Meaning |
|--------|---------|
| ✅ Saved | All changes safely stored |
| 💾 Saving... | Save in progress |
| ⚠️ Unsaved changes | Changes pending (will auto-save soon) |
| ❌ Save failed | Issue saving - data backed up to browser |

---

## Restoring From Backup

### Method 1: Resume Packet (Desktop)

1. Click **"📂 Resume Packet"**
2. Select your `My-Vet-Rate-Packet.json` file
3. All data is restored instantly

### Method 2: Restore from Local Backup

1. Click **"Restore"** button
2. Select any Vet-Rate backup file (`.json`)
3. Choose merge or replace mode
4. Data is imported

---

## Best Practices

### For Maximum Safety

1. **Desktop**: Click "Save My Packet" once, then work normally
2. **Mobile**: Download backup daily (or before closing)
3. **All devices**: Keep a backup copy in cloud storage
4. **Multiple devices**: Use the same packet file via cloud sync

### Recommended Backup Locations

| Location | Why |
|----------|-----|
| Google Drive / OneDrive | Automatic sync across devices |
| Desktop/Documents | Easy to find |
| External USB drive | Air-gapped backup |
| Email to yourself | Off-site backup |

---

## Technical Details

### Supported Browsers (File System API)

- ✅ Google Chrome 86+
- ✅ Microsoft Edge 86+
- ✅ Opera 72+
- ⚠️ Firefox (limited support)
- ❌ Safari (not supported)
- ❌ All mobile browsers

### Data Format

Your packet file is a standard JSON file containing:
- Veteran profile
- Saved claims
- Generated statements
- Form data
- Service history
- Ratings
- Gap analyses

### Security Notes

- **No server storage**: Your data never leaves your device
- **No account needed**: Everything is local
- **Encrypted at rest**: Uses your device's native encryption (if enabled)
- **Portable**: Take your data anywhere via the JSON file

---

## Troubleshooting

### "Save My Packet" Not Working?

- **Check browser**: Must be Chrome, Edge, or Opera
- **Check device**: Must be desktop/laptop, not mobile
- **Pop-up blocker**: May need to allow the file picker

### Lost Data After Cache Clear?

If you cleared cache without a backup:
1. Data may still be in IndexedDB - try reloading
2. Check if you have any downloaded backup files
3. Unfortunately, cache clear on mobile is permanent

### "Resume Packet" Shows Wrong Data?

- Make sure you're selecting the most recent backup file
- Check the file's "Last Modified" date
- Rename old backups to avoid confusion

---

## FAQ

**Q: Does this work offline?**
A: Yes! Once loaded, all features work offline.

**Q: How big can my packet get?**
A: The JSON file can grow quite large. There's no hard limit, but keep it under 50MB.

**Q: Can I edit the JSON file directly?**
A: You can, but it's not recommended. Invalid JSON will break the import.

**Q: What if I lose my packet file?**
A: Without a backup, data cannot be recovered. Always maintain backup copies!
