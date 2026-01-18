# Data Management

Control how your data is stored, backed up, and managed in Vet-Rate.org.

---

## How Data is Stored

### Local Storage

All your data is stored locally in your browser:

| Data Type | Storage Location |
|-----------|------------------|
| **My Packet** | Browser localStorage |
| **Settings** | Browser localStorage |
| **Veteran Profile** | Browser localStorage |
| **Form Drafts** | Browser localStorage |

### What This Means

- ✅ Data never leaves your device
- ✅ No account required
- ✅ Complete privacy
- ✅ Instant access
- ❌ No sync across devices
- ❌ Data can be lost if browser data is cleared

---

## Checking Storage Usage

### How Much Space?

Browser localStorage typically allows 5-10 MB per site.

Approximate usage:

| Data | Typical Size |
|------|--------------|
| Settings | <1 KB |
| Veteran Profile | 1-2 KB |
| Per Condition | 5-15 KB |
| Per Statement | 10-30 KB |
| Full Packet (10 conditions) | 200-400 KB |

### Checking Usage

In most browsers:

1. Open Developer Tools (F12)
2. Go to Application/Storage tab
3. View localStorage usage

---

## Backing Up Data

### Why Backup?

Regular backups protect against:

- Browser data clearing
- Browser reinstall
- Computer changes
- Accidental deletion

### How to Backup

<div class="step-container">
<div class="step">
Open <strong>My Packet</strong>
</div>
<div class="step">
Click <strong>"Backup" or "Export"</strong>
</div>
<div class="step">
<strong>Save</strong> the JSON file
</div>
<div class="step">
Store in a <strong>safe location</strong>
</div>
</div>

### Backup Best Practices

!!! tip "Backup Schedule"
    
    - **Weekly** during active claims work
    - **Before** clearing browser data
    - **Before** major changes
    - **After** adding important content
    - Store **multiple copies** (local + cloud)

---

## Restoring Data

### From Backup File

<div class="step-container">
<div class="step">
Open <strong>My Packet</strong>
</div>
<div class="step">
Click <strong>"Restore" or "Import"</strong>
</div>
<div class="step">
<strong>Select</strong> your backup file
</div>
<div class="step">
Choose <strong>restore option</strong>
</div>
</div>

### Restore Options

| Option | What Happens |
|--------|--------------|
| **Replace** | Backup replaces all current data |
| **Merge** | Backup data merges with current |

---

## Clearing Data

### Clear All Data

To remove all Vet-Rate.org data:

<div class="step-container">
<div class="step">
Open browser <strong>Settings</strong>
</div>
<div class="step">
Find <strong>"Clear browsing data"</strong> or <strong>"Privacy"</strong>
</div>
<div class="step">
Select <strong>"Cookies and site data"</strong>
</div>
<div class="step">
Clear for <strong>vet-rate.org</strong> specifically (if possible)
</div>
</div>

### In-App Clear

If available:

1. Open **Settings**
2. Click **"Clear All Data"**
3. Confirm deletion

### What Gets Cleared

- My Packet contents
- Saved forms
- Veteran Profile
- Settings preferences
- All local storage

!!! warning "Backup First!"
    Always backup your data before clearing. This action is **irreversible**.

---

## Transferring Data

### To Another Browser

<div class="step-container">
<div class="step">
<strong>Export backup</strong> from current browser
</div>
<div class="step">
Open Vet-Rate.org in <strong>new browser</strong>
</div>
<div class="step">
<strong>Import backup</strong> in new browser
</div>
</div>

### To Another Device

<div class="step-container">
<div class="step">
<strong>Export backup</strong> from current device
</div>
<div class="step">
<strong>Transfer file</strong> (email, cloud, USB)
</div>
<div class="step">
<strong>Import backup</strong> on new device
</div>
</div>

---

## Privacy Controls

### Data We Don't Collect

Vet-Rate.org does NOT collect:

- ❌ Personal information
- ❌ Usage data
- ❌ Analytics
- ❌ Tracking information
- ❌ Your saved content

### Your Control

You have complete control:

- View all your data (it's in your browser)
- Export all your data
- Delete all your data
- No account to delete

---

## Storage Limits

### Browser Limits

Different browsers have different limits:

| Browser | Typical Limit |
|---------|---------------|
| Chrome | 5 MB per origin |
| Firefox | 10 MB per origin |
| Safari | 5 MB per origin |
| Edge | 10 MB per origin |

### If Storage is Full

If you hit storage limits:

1. Delete old/unused conditions
2. Remove completed forms
3. Export and delete archived data
4. Clear other site data from browser

---

## Troubleshooting

### Data Not Saving

- Check if localStorage is enabled
- Check if private/incognito browsing
- Check available storage space

### Data Disappeared

- Check if browser data was cleared
- Check if you're in a different browser
- Try restoring from backup

### Can't Export Backup

- Check browser download permissions
- Check available disk space
- Try a different browser
