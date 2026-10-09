# Local Processing

Understanding how Vet-Rate.org's client-side architecture protects your privacy.

---

## What is Local Processing?

**Local processing** means all computation happens on your device, in your browser. Nothing is sent to remote servers for processing.

### Traditional Web Apps

```
Your Device → Internet → Server → Database → Processing → Response
```

Your data travels to servers where it's processed and stored.

### Vet-Rate.org

```
Your Device → Your Browser → Processing → Display
                    ↓
            Local Storage
```

Everything stays on your device.

---

## How It Works

### Application Loading

When you visit Vet-Rate.org:

1. **Static files download** - HTML, CSS, JavaScript
2. **Application starts** - React app runs in browser
3. **Data loads** - Disability database loads (public data)
4. **Ready to use** - Everything runs locally

### Your Interactions

When you use the app:

1. **Searches** - Run against local database
2. **Calculations** - Performed in browser
3. **Saving** - Written to browser localStorage
4. **Generation** - PDFs created client-side

---

## Technical Details

### Frontend Only

Vet-Rate.org is a **Single Page Application (SPA)**:

- Built with React
- No backend server for data processing
- Static file hosting only
- All logic in JavaScript running in your browser

### Static Hosting

The site is served as static files:

- HTML files
- JavaScript bundles
- CSS stylesheets
- Static data files (JSON)

No server-side code processes your requests.

### Data Files

The disability database and related data:

- Loaded as static JSON files
- Based on public VA information
- Downloaded to your browser
- Searched locally

---

## What This Means for Privacy

### No Data Transmission

| Action | Traditional App | Vet-Rate.org |
|--------|-----------------|---------------|
| Search | Query sent to server | Happens locally |
| Save | Data sent to database | Saved in localStorage |
| Generate PDF | Server creates PDF | Browser creates PDF |
| Forms | Server processes | Browser processes |

### No Server Logs

Because there's no backend processing:

- No logs of your searches
- No logs of your activity
- No logs of what you view
- No logs of your data

### No Database

There's no central database containing:

- User accounts
- Saved packets
- Personal information
- Usage history

---

## Benefits of Local Processing

### Privacy

- Complete privacy for your data
- No trust required in our servers
- No data breaches possible (no data to breach)

### Speed

- Instant responses (no network latency)
- Works offline (after initial load)
- Fast searches

### Control

- You control your data completely
- Delete anytime
- Export anytime
- No account to manage

---

## Limitations of Local Processing

### No Sync

- Data doesn't sync across devices
- Must manually transfer via backup

### Browser Dependency

- Data tied to specific browser
- Clearing browser data clears app data

### Storage Limits

- Limited by browser localStorage
- Typically 5-10 MB

---

## Offline Capability

Because of local processing:

### Works Offline

After the initial load, most features work without internet:

- ✅ Searching conditions
- ✅ Viewing details
- ✅ My Packet
- ✅ Generating statements
- ✅ Forms Helper

### Requires Internet

Some features need connectivity:

- ❌ External links (VA.gov, etc.)
- ❌ Initial app loading
- ❌ Updates to disability data

---

## Verifying Local Processing

If you want to verify:

### Check Network Activity

1. Open browser developer tools (F12)
2. Go to Network tab
3. Use the app
4. Observe: No data POST requests

### Check Data Storage

1. Open developer tools
2. Go to Application → Local Storage
3. See your data stored locally

### View Source

The application code is viewable in your browser - it's all JavaScript running client-side.
