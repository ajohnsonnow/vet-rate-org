# Exporting Data

Download your packet data in various formats for submission, records, or sharing.

---

## Export Options

My Packet supports a few different export paths, depending on what you need:

| Format                  | Best For                                | Contains                                                 |
| ----------------------- | --------------------------------------- | -------------------------------------------------------- |
| **Statement Download**  | A single condition's paperwork          | One nexus statement, as TXT / Word / PDF                 |
| **Local Backup (JSON)** | Data preservation, transferring devices | Everything - claims, statements, forms, profile, ratings |
| **Dossier (HTML)**      | Human-readable full report              | Everything, formatted as a readable, printable page      |
| **Saved Form Download** | A single Forms Helper document          | One form, as plain text                                  |

![Backup Manager's Export Your Data and Dossier sections](../assets/images/screenshots/my-packet/backup-export.png)
_The Local Backup (JSON) and Dossier (HTML) exports both live in the Backup Manager, alongside Google Drive Sync._

---

## Statement Download (Per Condition)

### What's Included

Downloading a statement gives you that condition's generated nexus statement, in your choice of format.

### How to Export

<div class="step-container">
<div class="step">
Open <strong>My Packet</strong> and find the condition
</div>
<div class="step">
Click <strong>"View Statement"</strong> and check the <strong>certification checkbox</strong> confirming you've reviewed it
</div>
<div class="step">
Back on the card, click <strong>"Download"</strong>
</div>
<div class="step">
Choose <strong>TXT, Word (.docx), or PDF</strong>
</div>
</div>

!!! info "Certification Required"
The Download button stays disabled until you've opened the statement and checked the certification box - a safeguard to make sure you actually reviewed AI-assisted or template content before it leaves the app.

---

## Local Backup (JSON)

### What's Included

A complete, machine-readable export of your whole packet:

- All conditions with metadata
- All statements (raw text)
- All saved forms
- Veteran profile
- Service history, ratings, timeline events, pain maps

### How to Export

See [Backup & Restore](backup-restore.md) for detailed instructions - click **"Local Backup"** in My Packet's toolbar, or **"Download Backup"** in the fuller Backup Manager.

### Output

```
vet-rate-complete-backup-2026-08-20.json
```

---

## Dossier (HTML)

### What's Included

A single, human-readable HTML report covering everything in your packet - conditions, statements, forms - formatted to read cleanly and print directly from any browser, with no app required to open it.

### How to Export

<div class="step-container">
<div class="step">
Open the <strong>Backup Manager</strong> (Support & Resources → Backup Manager, or from within My Packet)
</div>
<div class="step">
Click <strong>"Preview"</strong> to check it first, or <strong>"Download Dossier"</strong> to save it
</div>
</div>

### Use Cases

- Sharing your whole packet with a VSO who doesn't use Vet-Rate
- A durable, app-independent copy of your work
- Printing a full reference copy

---

## Saved Form Download

<div class="step-container">
<div class="step">
Open <strong>My Packet</strong> → <strong>Forms</strong> tab
</div>
<div class="step">
Click <strong>"View"</strong> on the form
</div>
<div class="step">
Click <strong>"Download"</strong> in the viewer
</div>
</div>

Saved forms download as plain text (.txt) only - see [Saved Forms](saved-forms.md) for details.

---

## Export for VA Submission

### What VA Needs

When submitting to the VA, export:

| Document                 | Purpose                        |
| ------------------------ | ------------------------------ |
| **Statement in Support** | Your personal statement        |
| **VA Forms**             | Official forms (21-0966, etc.) |
| **Evidence list**        | What you're submitting         |

### Don't Include

For VA submission, you typically don't need:

- Doctor's Cheat Sheets (those are for your doctor)
- Internal notes
- Draft versions

### Submission Checklist

Before submitting:

- ☐ Statement reviewed and certified before downloading
- ☐ No draft watermarks
- ☐ Signatures added (if required)
- ☐ Dates correct
- ☐ Personal information verified

---

## Organizing Exports

### Recommended Folder Structure

```
VA_Claims/
├── Backups/
│   └── vet-rate-complete-backup-2026-08-20.json
├── Statements/
│   ├── PTSD_Statement.pdf
│   └── BackPain_Statement.docx
├── Forms/
│   └── PTSD_Stressor_Statement.txt
├── Medical_Records/
│   └── [your records]
└── Submissions/
    └── [what you sent to VA]
```

### Naming Conventions

The app names downloaded files for you; if you rename them, keep it consistent:

```
[ConditionName]_[DocumentType]_[Date].[ext]

Examples:
PTSD_NexusStatement_2026-08-20.pdf
BackPain_Statement_2026-08-20.docx
IntentToFile_2026-08-20.txt
```

---

## Sharing Exports

### With VSO

- Download individual statements as PDF or Word and email them
- Or export the full **Dossier (HTML)** for a single file covering your whole packet
- Print either for in-person meetings

### With Healthcare Providers

Share Doctor's Cheat Sheets generated in Nexus Builder:

- Download as PDF and print for appointments
- Email if they accept electronic documents

### With Legal Representatives

- **Dossier (HTML)** for a readable overview of everything
- **Local Backup (JSON)** if they need the complete, structured data

---

## Troubleshooting

### Export Won't Start

- Check popup blocker settings
- Try a different browser
- Ensure sufficient storage space

### Download Button Is Disabled

- You need to open the statement and check the certification checkbox first - see [Statement Download](#statement-download-per-condition) above

### PDF or Word File Won't Open

- Ensure you have a PDF reader or word processor installed
- Try downloading again
- Check file size (very large files may have issues)

### Missing Data in Export

- Verify the data exists in My Packet
- A Local Backup or Dossier only includes what's currently saved - try exporting again after saving
