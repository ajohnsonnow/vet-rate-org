# Evidence Tools

Evidence Tools are the document-processing arsenal of Vet-Rate.org - the tools that turn a shoebox of paperwork (DD214s, medical records, decision letters, buddy statements) into organized, searchable evidence inside **My Packet**.

<div class="crisis-banner">
🆘 <strong>Veterans Crisis Line:</strong> Call 988, Press 1 | Text 838255 | Available 24/7
</div>

---

## Why Evidence Organization Matters

The VA rates disabilities based on what's **documented**, not what actually happened. A condition without a paper trail - an in-service event, a current diagnosis, and a medical nexus connecting the two - is much harder to win. These tools exist to help you find, extract, and organize that paper trail before you file.

Most of these tools run **entirely in your browser**. Documents you upload are never sent to a Vet-Rate.org server; only extracted text is optionally sent to an AI provider (local, on-device model or your own cloud API key) if you choose to load AI for deeper analysis.

---

## In This Section

<div class="feature-card">
<h3>📋 Muster Call</h3>
<p>The main document-ingestion pipeline. Drop your entire VA file - DD214s, medical records, decision letters - and let the wizard walk each one through extraction and review.</p>
<a href="muster-call/" class="doc-button">Learn More →</a>
</div>

<div class="feature-card">
<h3>🔬 C-File AI Analyzer</h3>
<p>Upload your full Claims File and mine it for in-service events, diagnoses, and nexus evidence across a Timeline, Potential Claims, and Semantic Search view.</p>
<a href="cfile-analyzer/" class="doc-button">Learn More →</a>
</div>

<div class="feature-card">
<h3>📋 Blue Button X-Ray</h3>
<p>Parse your VA Blue Button medical record export to surface diagnoses that never made it onto a claim.</p>
<a href="blue-button-xray/" class="doc-button">Learn More →</a>
</div>

<div class="feature-card">
<h3>👥 Witness Bench</h3>
<p>A guided interview wizard that helps a spouse, friend, or battle buddy write a powerful buddy statement (VA Form 21-10210).</p>
<a href="witness-bench/" class="doc-button">Learn More →</a>
</div>

<div class="feature-card">
<h3>🎖️ DD214 Analyzer &amp; Form Builder</h3>
<p>Extract service data from a digital DD214, or build one manually block-by-block if you don't have a clean copy.</p>
<a href="dd214-analyzer/" class="doc-button">Learn More →</a>
</div>

<div class="feature-card">
<h3>🗺️ Duty Stations</h3>
<p>Map everywhere you served for PACT Act eligibility and exposure tracking, right inside My Packet's Service tab.</p>
<a href="duty-stations/" class="doc-button">Learn More →</a>
</div>

<div class="feature-card">
<h3>📎 Claim Evidence Upload</h3>
<p>Attach a DBQ, nexus letter, or buddy statement directly to a specific claim in My Packet.</p>
<a href="claim-evidence-upload/" class="doc-button">Learn More →</a>
</div>

<div class="feature-card">
<h3>🔍 Record Search</h3>
<p>"The Needle in the Haystack" - instantly find every mention of a keyword across a 2,000+ page PDF.</p>
<a href="record-search/" class="doc-button">Learn More →</a>
</div>

<div class="feature-card">
<h3>👁️ Vision Simulator</h3>
<p>An automatic OCR + AI fallback screen that appears if a vision-capable local AI model can't load on your device.</p>
<a href="vision-simulator/" class="doc-button">Learn More →</a>
</div>

---

## How the Evidence Pipeline Works

<div class="step-container">
<div class="step">
<strong>Upload a document</strong> - Muster Call, C-File Analyzer, Blue Button X-Ray, DD214 Analyzer, and Record Search all accept PDFs (some also take Word, text, or RTF files)
</div>
<div class="step">
<strong>Text is extracted locally</strong> - Your browser reads the PDF's text layer, or runs on-device OCR/vision extraction on scanned pages
</div>
<div class="step">
<strong>Optional AI analysis</strong> - If you load a local or cloud AI model, it looks for in-service events, diagnoses, and nexus evidence in the extracted text
</div>
<div class="step">
<strong>Review and verify</strong> - Every extraction step includes a human-in-the-loop review screen before anything is saved
</div>
<div class="step">
<strong>Save to My Packet</strong> - Confirmed data becomes part of your claims, service history, or document library
</div>
</div>

---

## A Note on AI in Evidence Tools

Several of these tools (Muster Call, C-File Analyzer, Blue Button X-Ray, Witness Bench, DD214 Analyzer, Vision Simulator) can use a local AI model - loaded on-demand through the **AI Command Center** - to do deeper analysis than plain text extraction. Loading a local model downloads it to your browser once (it can be 200MB-2GB+ depending on the model) and all processing then happens on your device.

If you don't load AI, most of these tools still work using text extraction and pattern matching alone - you'll just get less interpretation and more raw data to review yourself. Witness Bench and Record Search, in particular, are fully useful with **no AI at all**.

---

## Important Disclaimer

!!! warning "No Guarantee of Outcome"
These tools help you organize evidence and paperwork, but **using them does not guarantee any particular outcome** on your VA claim - ratings and decisions are made solely by the VA. Always have a Veterans Service Officer (VSO) or VA-accredited attorney [review your evidence before filing](https://www.va.gov/ogc/apps/accreditation/).
