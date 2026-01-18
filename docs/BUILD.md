# Building and Serving the Documentation

This documentation is built with MkDocs and the Material theme.

## Prerequisites

- Python 3.8+
- pip (Python package manager)

## Installation

1. Navigate to the docs directory:
   ```bash
   cd docs
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Development Server

Run the local development server:

```bash
mkdocs serve
```

Then open http://127.0.0.1:8000 in your browser.

## Building Static Site

Generate the static HTML:

```bash
mkdocs build
```

Output will be in the `site/` directory.

## Generating PDF

To generate the PDF version:

```bash
# Set environment variable to enable PDF export
set ENABLE_PDF_EXPORT=1   # Windows
export ENABLE_PDF_EXPORT=1  # Mac/Linux

# Build with PDF
mkdocs build
```

The PDF will be generated at `Vet-Rate-User-Manual.pdf`.

Note: PDF generation requires a headless Chrome/Chromium installation.

## Logo Assets

Place logo images in `assets/images/`:
- `logo.png` - Main logo (recommended: 256x256 or larger)
- `favicon.png` - Browser favicon (recommended: 32x32)

## Structure

```
docs/
├── mkdocs.yml           # Configuration
├── requirements.txt     # Python dependencies
├── index.md            # Home page
├── assets/
│   └── images/         # Logo and images
├── stylesheets/
│   ├── extra.css       # Custom styling
│   └── pdf.css         # PDF-specific styling
├── overrides/          # Theme overrides (if needed)
└── [sections]/         # Documentation sections
```
