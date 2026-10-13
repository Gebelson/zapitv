import fs from 'fs';

function removeDuplicates() {
  const constantsPath = 'constants.tsx';
  let constantsContent = fs.readFileSync(constantsPath, 'utf8');
  
  // We can't easily parse the whole file as JSON because it's TypeScript.
  // But we can find duplicate ids.
  // Actually, let's just use a regex to find all "id": "movie-..." or id: 'movie-...'
  const idRegex = /(?:\"id\"|id):\s*[\'\"](movie-[^\'\"]+)[\'\"]/g;
  let match;
  const seenIds = new Set();
  const duplicateIds = new Set();
  
  while ((match = idRegex.exec(constantsContent)) !== null) {
    if (seenIds.has(match[1])) {
      duplicateIds.add(match[1]);
    }
    seenIds.add(match[1]);
  }
  
  console.log("Duplicate IDs:", Array.from(duplicateIds));
}

removeDuplicates();
