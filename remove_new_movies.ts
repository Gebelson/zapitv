import fs from 'fs';

function removeNewMovies() {
  const constantsPath = 'constants.tsx';
  let constantsContent = fs.readFileSync(constantsPath, 'utf8');
  
  const newMoviesRaw = fs.readFileSync('new_movies.json', 'utf8');
  const newMoviesData = JSON.parse(newMoviesRaw);
  
  const idsToRemove = newMoviesData.map(m => m.id);
  
  // We can parse the file using a regex or just find the objects and remove them.
  // Since we prepended them, they are right after `export const filmesData: ContentItem[] = [`
  // Let's just remove everything between `export const filmesData: ContentItem[] = [` and the first original movie.
  // The first original movie is `id: 'movie-17492148'`
  
  const startMarker = 'export const filmesData: ContentItem[] = [';
  const endMarker = "id: 'movie-17492148'";
  
  const startIndex = constantsContent.indexOf(startMarker);
  const endIndex = constantsContent.indexOf(endMarker);
  
  if (startIndex !== -1 && endIndex !== -1) {
    // We need to keep the startMarker and the `{` before `id: 'movie-17492148'`
    // Let's find the `{` right before `id: 'movie-17492148'`
    const beforeEnd = constantsContent.lastIndexOf('{', endIndex);
    
    const updatedContent = constantsContent.slice(0, startIndex + startMarker.length) + '\n  ' + constantsContent.slice(beforeEnd);
    fs.writeFileSync(constantsPath, updatedContent);
    console.log("Successfully removed new movies.");
  } else {
    console.log("Could not find markers.");
  }
}

removeNewMovies();
