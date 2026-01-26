/**
 * Analyze Real DD214 PDF
 * Extracts text from actual PDF to diagnose parsing issues
 */

const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const fs = require('fs');
const path = require('path');

// The actual PDF file path
const PDF_PATH = 'E:/VS_Studio/Johnson_C-FIle/Johnson Service Records DD214 ALL.pdf';

async function extractPDFText(pdfPath) {
  console.log(`📄 Loading PDF: ${pdfPath}`);
  
  try {
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    
    console.log(`📑 Total pages: ${pdf.numPages}`);
    
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      
      fullText += `\n\n--- PAGE ${i} ---\n${pageText}`;
      
      // Show first 500 chars of each page for debugging
      console.log(`\n📄 PAGE ${i} (first 500 chars):`);
      console.log('-'.repeat(60));
      console.log(pageText.substring(0, 500) || '(empty - needs OCR)');
    }
    
    // Save full text to file for analysis
    const outputPath = 'E:/VS_Studio/Johnson_C-FIle/extracted_text.txt';
    fs.writeFileSync(outputPath, fullText);
    console.log(`\n💾 Full text saved to: ${outputPath}`);
    
    // Check for sparse text (needs OCR)
    const avgCharsPerPage = fullText.length / pdf.numPages;
    console.log(`\n📊 Average chars per page: ${avgCharsPerPage.toFixed(0)}`);
    
    if (avgCharsPerPage < 100) {
      console.log('⚠️ SPARSE TEXT - This PDF likely needs OCR processing!');
      console.log('   The PDF appears to be scanned images, not text.');
    }
    
    return fullText;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return null;
  }
}

// Run analysis
console.log('\n🎖️ DD214 PDF TEXT EXTRACTION');
console.log('='.repeat(60));

extractPDFText(PDF_PATH).then(text => {
  if (text) {
    console.log('\n✅ Extraction complete');
    console.log(`   Total characters: ${text.length}`);
    
    // Check for key DD214 markers
    console.log('\n🔍 KEY MARKERS CHECK:');
    const markers = [
      'JOHNSON',
      'ANTHONY',
      'DD FORM 214',
      'CERTIFICATE OF RELEASE',
      'HONORABLE',
      '92Y',
      'ARMY'
    ];
    
    for (const marker of markers) {
      const found = text.toUpperCase().includes(marker.toUpperCase());
      console.log(`   ${found ? '✅' : '❌'} "${marker}": ${found ? 'Found' : 'NOT FOUND'}`);
    }
  }
});
