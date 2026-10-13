import * as fs from 'fs';

let updateMoviesContent = fs.readFileSync('updateMovies.ts', 'utf8');
let match = updateMoviesContent.match(/const enrichedMovies = (\[[\s\S]*?\]);\n/);
if (match) {
  let enrichedMovies = eval(match[1]);
  
  let constantsContent = fs.readFileSync('constants.tsx', 'utf8');
  let lines = constantsContent.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('imdbId:')) {
      let imdbIdMatch = lines[i].match(/imdbId:\s*'([^']+)'/);
      if (imdbIdMatch) {
        let imdbId = imdbIdMatch[1];
        let movie = enrichedMovies.find(m => m.imdbId === imdbId);
        if (movie && movie.image) {
          // Find image and backdrop lines
          for (let j = i - 5; j <= i + 5; j++) {
            if (lines[j] && lines[j].includes('image:')) {
              lines[j] = lines[j].replace(/image:\s*'[^']+'/, `image: '${movie.image}'`);
            }
            if (lines[j] && lines[j].includes('backdrop:')) {
              lines[j] = lines[j].replace(/backdrop:\s*'[^']+'/, `backdrop: '${movie.image}'`);
            }
          }
        }
      }
    }
  }
  
  fs.writeFileSync('constants.tsx', lines.join('\n'));
  console.log('Updated constants.tsx with images from updateMovies.ts');
}
