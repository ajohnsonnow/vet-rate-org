# Exporting Data

Download your packet data in various formats for submission, records, or sharing.

---

## Export Options

My Packet supports multiple export formats:

| Format | Best For | Contains |
|--------|----------|----------|
| **PDF Bundle** | VA submission | All documents formatted for print |
| **JSON Backup** | Data preservation | Complete data, machine-readable |
| **Summary PDF** | Quick reference | Overview of all conditions |
| **Individual PDFs** | Specific documents | One document at a time |

---

## PDF Bundle Export

### What's Included

The PDF bundle contains:

- Cover page with your information
- Table of contents
- Each condition with:
    - Details and rating criteria
    - Nexus statement
    - Doctor's cheat sheet
- All completed forms

### How to Export

<div class="step-container">
<div class="step">
Open <strong>My Packet</strong>
</div>
<div class="step">
Click <strong>"Export"</strong>
</div>
<div class="step">
Select <strong>"PDF Bundle"</strong>
</div>
<div class="step">
Choose <strong>which conditions</strong> to include
</div>
<div class="step">
Click <strong>"Generate PDF"</strong>
</div>
<div class="step">
<strong>Download</strong> the file
</div>
</div>

### Output

You'll receive a single PDF file:

```
MyPacket_Export_2024-01-15.pdf
```

---

## JSON Backup Export

### What's Included

Complete data export:

- All conditions with metadata
- All statements (raw text)
- All forms (field data)
- Veteran profile
- Application settings
- Notes and statuses

### How to Export

See [Backup & Restore](backup-restore.md) for detailed instructions.

### Output

```
vetrate_backup_2024-01-15.json
```

---

## Summary PDF

### What's Included

A concise overview:

- List of all conditions
- Claim types (Primary/Secondary)
- Current statuses
- Key dates
- One-page format

### How to Export

<div class="step-container">
<div class="step">
Open <strong>My Packet</strong>
</div>
<div class="step">
Click <strong>"Export"</strong>
</div>
<div class="step">
Select <strong>"Summary PDF"</strong>
</div>
<div class="step">
<strong>Download</strong> the file
</div>
</div>

### Use Cases

- Quick reference for VSO meetings
- Personal tracking
- Appointment preparation

---

## Individual Document Export

### Export Single Document

<div class="step-container">
<div class="step">
Find the <strong>specific document</strong> in My Packet
</div>
<div class="step">
Click <strong>"Download"</strong> on that document
</div>
<div class="step">
Choose format (<strong>PDF</strong>)
</div>
<div class="step">
<strong>Save</strong> to device
</div>
</div>

### Available Documents

- Statement in Support of Claim
- Doctor's Cheat Sheet
- Completed VA forms
- Condition summary sheets

---

## Selective Export

### Choose What to Include

When exporting PDF Bundle:

#### Conditions

- ☑️ Include all conditions
- ☑️ Select specific conditions
- ☑️ Filter by status

#### Documents

- ☑️ Nexus Statements
- ☑️ Doctor's Cheat Sheets
- ☑️ VA Forms
- ☑️ Rating Criteria
- ☑️ Notes

#### Formatting

- ☑️ Include cover page
- ☑️ Include table of contents
- ☑️ Include page numbers
- ☑️ Include export date

---

## Export for VA Submission

### What VA Needs

When submitting to the VA, export:

| Document | Purpose |
|----------|---------|
| **Statement in Support** | Your personal statement |
| **VA Forms** | Official forms (21-0966, etc.) |
| **Evidence list** | What you're submitting |

### Don't Include

For VA submission, you typically don't need:

- Doctor's Cheat Sheets (those are for your doctor)
- Internal notes
- Draft versions

### Submission Checklist

Before submitting:

- ☐ All documents reviewed
- ☐ No draft watermarks
- ☐ Signatures added (if required)
- ☐ Dates correct
- ☐ Personal information verified

---

## Organizing Exports

### Recommended Folder Structure

```
VA_Claims/
├── Exports/
│   ├── MyPacket_Export_2024-01-15.pdf
│   └── vetrate_backup_2024-01-15.json
├── Statements/
│   ├── PTSD_Statement.pdf
│   └── BackPain_Statement.pdf
├── Forms/
│   ├── Intent_to_File.pdf
│   └── Buddy_Statement_John.pdf
├── Medical_Records/
│   └── [your records]
└── Submissions/
    └── [what you sent to VA]
```

### Naming Conventions

Use clear, consistent names:

```
[ConditionName]_[DocumentType]_[Date].pdf

Examples:
PTSD_NexusStatement_2024-01-15.pdf
BackPain_DoctorCheatSheet_2024-01-15.pdf
IntentToFile_2024-01-15.pdf
```

---

## Sharing Exports

### With VSO

Export a PDF Bundle or Summary to share:

- Email the PDF
- Print for in-person meetings
- Upload to VSO portal if available

### With Healthcare Providers

Share Doctor's Cheat Sheets:

- Print for appointments
- Email if they accept electronic documents

### With Legal Representatives

Export complete documentation:

- PDF Bundle for review
- JSON Backup for complete data

---

## Troubleshooting

### Export Won't Start

- Check popup blocker settings
- Try a different browser
- Ensure sufficient storage space

### PDF Won't Open

- Ensure you have a PDF reader
- Try downloading again
- Check file size (very large files may have issues)

### Missing Data in Export

- Verify data exists in My Packet
- Check export settings/filters
- Try exporting again
