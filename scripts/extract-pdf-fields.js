/**
 * Script to extract form field names from VA PDF forms
 * Run with: node scripts/extract-pdf-fields.js
 */

import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

const FORMS_DIR = './public/forms';

async function extractFieldsFromPdf(filePath) {
  try {
    const pdfBytes = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    
    return fields.map(field => ({
      name: field.getName(),
      type: field.constructor.name,
    }));
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return [];
  }
}

async function main() {
  const files = fs.readdirSync(FORMS_DIR).filter(f => f.endsWith('.pdf'));
  
  console.log('='.repeat(80));
  console.log('VA PDF FORM FIELD EXTRACTION');
  console.log('='.repeat(80));
  
  const results = {};
  
  for (const file of files) {
    const filePath = path.join(FORMS_DIR, file);
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📄 ${file}`);
    console.log(`${'─'.repeat(60)}`);
    
    const fields = await extractFieldsFromPdf(filePath);
    results[file] = fields;
    
    if (fields.length === 0) {
      console.log('  ⚠️  No fillable fields found (may be a flat PDF)');
    } else {
      console.log(`  Found ${fields.length} fillable fields:\n`);
      fields.forEach((field, i) => {
        console.log(`  ${(i+1).toString().padStart(2)}. [${field.type.replace('PDF', '').padEnd(12)}] "${field.name}"`);
      });
    }
  }
  
  // Save results to JSON for reference
  const outputPath = './scripts/pdf-field-mappings.json';
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n\n✅ Field mappings saved to: ${outputPath}`);
}

main().catch(console.error);
