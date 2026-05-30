const fs = require('fs');
const path = require('path');
const pdfjsLib = require('pdfjs-dist');

// Disable worker for simple node execution
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

async function testExtract(filePath, password) {
  console.log(`\n=== Testing file: ${path.basename(filePath)} ===`);
  try {
    const data = new Uint8Array(fs.readFileSync(filePath));
    const loadingTask = pdfjsLib.getDocument({ data, password });
    const pdf = await loadingTask.promise;
    console.log(`PDF Loaded successfully. Pages: ${pdf.numPages}`);
    
    let extractedText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join('  ');
      console.log(`Page ${i} text length: ${pageText.length}`);
      if (pageText.trim()) {
        console.log(`Sample text from page ${i}: ${pageText.substring(0, 300)}...`);
      } else {
        console.log(`Page ${i} is empty (no text items).`);
      }
      extractedText += pageText + '\n';
    }
    
    console.log(`Total Extracted Text Length: ${extractedText.trim().length}`);
  } catch (error) {
    console.error(`Error loading/decrypting PDF:`, error.message || error);
  }
}

async function run() {
  const archiveDir = 'C:\\Users\\tharunj\\Downloads\\ClaudeCoWork\\Personal Projects\\TrackSpendZ\\Archive';
  await testExtract(path.join(archiveDir, 'Testfile2_Password_170719929736.pdf'), '170719929736');
  await testExtract(path.join(archiveDir, 'Testfile3_Password_THAR1707.pdf'), 'THAR1707');
}

run().catch(console.error);
