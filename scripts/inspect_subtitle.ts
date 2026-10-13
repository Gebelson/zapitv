import { subtitleService } from '../src/core/subtitles/subtitleService';
import { ContentType } from '../types';

async function inspect() {
  const item = {
    id: 'tt1375666',
    title: 'A Origem',
    type: ContentType.MOVIE,
    imdbId: 'tt1375666'
  };

  const list = await subtitleService.fetchSubtitles(item);
  console.log('Total subtitles:', list.length);
  const ptSubs = list.filter(s => s.isPtBr || s.lang === 'pob' || s.lang === 'por');
  console.log('PT subs count:', ptSubs.length);

  for (let i = 0; i < Math.min(3, ptSubs.length); i++) {
    const sub = ptSubs[i];
    console.log(`\nSub ${i + 1}: ${sub.label} (${sub.url})`);
    const text = await subtitleService.fetchAndDecodeSRT(sub.url);
    const snippet = text.slice(0, 500);
    console.log('Snippet:\n', snippet);
  }
}

inspect().catch(console.error);
