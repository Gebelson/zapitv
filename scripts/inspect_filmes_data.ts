import { filmesData } from '../constants.tsx';

console.log('=== FIRST 30 FILMS IN FILMESDATA ===');
filmesData.slice(0, 30).forEach((f, idx) => {
  console.log(`${idx + 1}. ${f.title} (${f.year}) | IMDb: ${f.imdbId} | videoUrl: ${f.videoUrl}`);
});
