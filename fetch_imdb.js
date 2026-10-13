import fs from 'fs';

async function fetchImdb(imdbId) {
  try {
    const res = await fetch(`https://www.imdb.com/title/${imdbId}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });
    console.log("Status:", res.status);
    const html = await res.text();
    console.log(html.substring(0, 500));
  } catch (e) {
    console.error(e);
  }
}

fetchImdb('tt15340724');
