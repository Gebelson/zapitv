import fs from 'fs';

function findDuplicateTitles() {
  const constantsPath = 'constants.tsx';
  let constantsContent = fs.readFileSync(constantsPath, 'utf8');
  
  const titleRegex = /(?:\"title\"|title):\s*[\'\"]([^\'\"]+)[\'\"]/g;
  let match;
  const seenTitles = new Set();
  const duplicateTitles = new Set();
  
  while ((match = titleRegex.exec(constantsContent)) !== null) {
    if (seenTitles.has(match[1])) {
      duplicateTitles.add(match[1]);
    }
    seenTitles.add(match[1]);
  }
  
  console.log("Duplicate Titles:", Array.from(duplicateTitles));
}

findDuplicateTitles();
