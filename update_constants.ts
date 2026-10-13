import fs from 'fs';

function updateConstants() {
  const constantsPath = 'constants.tsx';
  let constantsContent = fs.readFileSync(constantsPath, 'utf8');
  
  const newMoviesRaw = fs.readFileSync('new_movies.json', 'utf8');
  const newMoviesData = JSON.parse(newMoviesRaw);
  
  // Format the new movies as a TypeScript array string without the enclosing brackets
  let newMoviesStr = newMoviesData.map(movie => {
    let str = JSON.stringify(movie, null, 2);
    // Replace "ContentType.MOVIE" with ContentType.MOVIE
    str = str.replace(/"ContentType\.MOVIE"/g, 'ContentType.MOVIE');
    return str;
  }).join(',\n  ') + ',\n  ';

  // Find the insertion point
  const insertionMarker = 'export const filmesData: ContentItem[] = [';
  const insertionIndex = constantsContent.indexOf(insertionMarker);
  
  if (insertionIndex === -1) {
    console.error("Could not find filmesData array in constants.tsx");
    return;
  }
  
  const insertPos = insertionIndex + insertionMarker.length;
  
  const updatedContent = 
    constantsContent.slice(0, insertPos) + '\n  ' + 
    newMoviesStr + 
    constantsContent.slice(insertPos);
    
  fs.writeFileSync(constantsPath, updatedContent);
  console.log("Successfully updated constants.tsx");
}

updateConstants();
