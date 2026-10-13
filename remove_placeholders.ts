import fs from 'fs';

function removePlaceholders() {
  const constantsPath = 'constants.tsx';
  let constantsContent = fs.readFileSync(constantsPath, 'utf8');
  
  // Find the index of the first placeholder movie
  const startMarker = "id: 'movie-17492148'";
  const startIndex = constantsContent.indexOf(startMarker);
  
  if (startIndex !== -1) {
    // Find the `{` before the startMarker
    const beforeEnd = constantsContent.lastIndexOf('{', startIndex);
    
    // Find the end of the array `];`
    const endOfArray = constantsContent.lastIndexOf('];');
    
    if (beforeEnd !== -1 && endOfArray !== -1) {
      const updatedContent = constantsContent.slice(0, beforeEnd).trim().replace(/,$/, '') + '\n];';
      fs.writeFileSync(constantsPath, updatedContent);
      console.log("Successfully removed placeholder movies.");
    }
  } else {
    console.log("Could not find start marker.");
  }
}

removePlaceholders();
