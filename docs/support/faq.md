# Frequently Asked Questions

Common questions and answers about Vet-Rate.org.

---

## General Questions

### What is Vet-Rate.org?

Vet-Rate.org is a free, educational toolkit for veterans navigating the VA disability claims process. It provides:

- Disability rating criteria information
- Secondary conditions discovery
- C&P exam preparation
- Forms assistance
- Nexus statement building

### Is Vet-Rate.org affiliated with the VA?

**No.** Vet-Rate.org is an independent educational resource. We are not affiliated with, endorsed by, or officially connected to the Department of Veterans Affairs.

### Is Vet-Rate.org free?

**Yes.** Vet-Rate.org is completely free to use. No subscriptions, no premium features, no hidden costs.

### Do I need to create an account?

**No.** Vet-Rate.org requires no registration or login. Your data is stored locally in your browser.

---

## Privacy & Data

### Is my data safe?

Yes. Your data is stored **only** in your browser's local storage. It never leaves your device and is never transmitted to any server.

**With Cloud AI (Google Gemini):** Only the specific text you choose to enhance is sent to Google (no names, SSN, dates, or PII).

**With Local AI (Faraday Cage):** Absolutely nothing leaves your device. The AI model runs entirely on your GPU with zero data transmission.

### Can you see my information?

**No.** We have no ability to see, access, or retrieve any information you enter. Everything stays on your device.

### What happens if I clear my browser data?

Your Vet-Rate.org data will be deleted. Always **backup your data** before clearing browser storage.

### Can I use this on multiple devices?

Yes, but data doesn't sync automatically. You'll need to:

1. Export a backup from one device
2. Transfer the file
3. Import on the other device

---

## Features

### How accurate is the disability information?

We source information from:

- 38 CFR Part 4 (Schedule for Rating Disabilities)
- Public VA resources
- Official rating criteria

However, VA interpretation and application may vary. Always consult official sources and professionals.

### Are the secondary condition suggestions reliable?

Secondary Scout suggestions are based on:

- Medical literature
- Known connections per 38 CFR § 3.310

Suggestions are **educational**. Success depends on individual circumstances and evidence. Consult a professional before filing.

### Will the C&P Simulator predict my rating?

**No.** The simulator is for **educational preparation only**. It helps you understand what's evaluated but cannot predict actual VA decisions.

### What is the AI Statement Assistant?

The AI Statement Assistant is an **optional** feature that uses Google Gemini to help write more professional and effective claim statements. Key points:

- ✅ **Completely optional** - Works without it
- ✅ **Privacy-first** - No names, SSN, dates, or PII sent
- ✅ **Consent required** - You approve each AI request
- ✅ **Toggle versions** - Switch between AI and original
- ✅ **Free** - No cost for AI features

[Learn more about AI privacy →](../privacy/ai-assistant/)

### Is my data shared with AI?

Only if you explicitly consent. When you click "Enhance with AI":

1. You see exactly what will be shared
2. You click to consent (or cancel)
3. Only condition names and symptom descriptions are sent
4. **Never sent:** Your name, SSN, dates, locations, or any PII

### Can I use Vet-Rate without AI?

**Yes, absolutely!** The AI assistant is 100% optional. All features work perfectly with locally-processed templates. Your data never leaves your device unless you choose AI enhancement.

### What is the Faraday Cage (Local AI)?

The **Faraday Cage** is an advanced feature that allows you to run AI models entirely on your computer using WebGPU technology. Your data **never leaves your device** - not even to cloud AI services.

**Key Features:**

- ✅ **100% Offline** - Works even without internet
- ✅ **Zero Data Transmission** - All processing on your GPU
- ✅ **Multiple Models** - From 360MB to 8GB models
- ✅ **Full Privacy** - Perfect for sensitive medical data

**Requirements:**

- WebGPU-compatible browser (Chrome 113+, Edge 113+)
- Modern GPU (NVIDIA RTX 20/30/40 series, AMD RDNA2+, Intel Arc, or Apple M1/M2/M3)
- 2-8GB VRAM depending on model size

### How do I enable Local AI (Faraday Cage)?

**Step 1: Check WebGPU Compatibility**

1. Click the AI status indicator in the header (or **"AI Settings"** in the mobile menu) to open the **AI Command Center**
2. Look for the green checkmark next to "WebGPU Available"
3. If red ❌, your browser/GPU doesn't support WebGPU yet

**Step 2: Enable Experimental Mode (Important!)**

1. In the Faraday Cage panel, find "Experimental WebGPU Mode"
2. Check the box to enable experimental features
3. Confirm the warning about experimental features

**Step 3: Chrome Flags (Required for Full Compatibility)**

For best results, launch Chrome with experimental WebGPU features:

**Windows:**

```
chrome.exe --enable-dawn-features=allow_unsafe_apis
```

**Mac:**

```
open -a "Google Chrome" --args --enable-dawn-features=allow_unsafe_apis
```

**Linux:**

```
google-chrome --enable-dawn-features=allow_unsafe_apis
```

**Step 4: Select and Load a Model**

1. Choose a model based on your VRAM:
   - **360MB-1.7GB models**: 2GB VRAM minimum
   - **3GB models**: 4GB VRAM recommended
   - **7-8GB models**: 8GB+ VRAM required
2. Click "Load Model"
3. First load takes 5-10 minutes (downloads and caches)
4. Future loads are instant!

### Why do I get "u8 type not supported" errors?

This error means WebGPU experimental features aren't fully enabled. **Solutions:**

1. ✅ **Enable Experimental Mode** in Faraday Cage settings
2. ✅ **Launch Chrome with flags** (see above)
3. ✅ **Update Chrome** to the latest version
4. ✅ **Update GPU drivers** to the latest version
5. ✅ **Try a smaller model** (360M or 1B models)

If errors persist after following all steps, your GPU may not support the required experimental features yet.

### Cloud AI vs Local AI - Which should I use?

**Use Cloud AI (Google Gemini) if:**

- ✅ You want the fastest processing
- ✅ You have a good internet connection
- ✅ You're comfortable with Google's privacy policies
- ✅ Your GPU doesn't support WebGPU

**Use Local AI (Faraday Cage) if:**

- ✅ Maximum privacy is essential (PTSD, MST, sensitive medical data)
- ✅ You want to work completely offline
- ✅ You have a compatible GPU with sufficient VRAM
- ✅ You don't want to use API keys or cloud services

Both options are completely free and work with all AI features in Vet-Rate.org!

### Can I submit forms directly to the VA?

**No.** Forms Helper assists with completing forms, but you must still:

1. Download the completed form
2. Sign it (if required)
3. Submit through official VA channels (VA.gov, mail, etc.)

---

## Technical Issues

### Why did my data disappear?

Possible causes:

- Browser data was cleared
- Different browser being used
- Different device being used
- localStorage was disabled
- Private browsing mode was used

**Solution:** Restore from a backup file.

### Why won't PDFs download?

Check:

- Popup blocker isn't blocking downloads
- Browser has download permissions
- Sufficient disk space

Try a different browser if issues persist.

### Why is the site slow?

The disability database is loaded locally. On first visit or after cache clear:

- Initial load may take a moment
- Subsequent use should be fast

If persistently slow:

- Check internet connection
- Try clearing cache
- Try different browser

### Why can't I save to My Packet?

Possible issues:

- localStorage is disabled
- Storage quota exceeded
- Private browsing mode

**Solutions:**

1. Enable localStorage in browser settings
2. Delete old data to free space
3. Use regular browsing mode

---

## VA Claims Process

### Can Vet-Rate.org file my claim?

**No.** Vet-Rate.org is an educational and preparation tool. You must file claims through:

- VA.gov
- eBenefits
- VSO representative
- VA Regional Office

### Should I use a VSO?

We recommend consulting a VSO (Veterans Service Organization) for:

- Free professional assistance
- Claims filing
- Appeals
- Complex situations

VSOs are accredited and free.

### How long does the claims process take?

This varies greatly. Current average times are available at VA.gov. Using Vet-Rate.org to prepare well-documented claims may help.

---

## Getting Help

### How do I report a bug?

Use the **Bug Squasher** tool in the footer, or see [Reporting Bugs](reporting-bugs.md).

### How do I suggest a feature?

Same process as bugs - use Bug Squasher or Contact Us.

### Where can I get help with my VA claim?

- **VSOs** - Free claims assistance
- **VA Hotline** - 1-800-827-1000
- **VA.gov** - Official information

### What if I'm in crisis?

<div class="crisis-banner">
🆘 <strong>Veterans Crisis Line:</strong> Call 988, Press 1 | Text 838255 | Chat at VeteransCrisisLine.net - Available 24/7
</div>

---

## About Us

### Who made Vet-Rate.org?

Vet-Rate.org was created to help fellow veterans navigate the claims process. See "About Us" in the footer for more information.

### How can I support Vet-Rate.org?

- Use and share with fellow veterans
- Report bugs and suggest improvements
- Consider donations if offered

### Can I contribute?

We welcome:

- Bug reports
- Feature suggestions
- Data corrections
- Feedback
