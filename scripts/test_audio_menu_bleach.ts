import { providerRegistry } from '../src/core/providers/providerRegistry.ts';
import { ContentType } from '../types.ts';

async function testAudioMenuBleach() {
  const item = {
    id: 'bleach',
    title: 'Bleach',
    type: ContentType.ANIME,
    genres: ['Anime', 'Ação'],
    audioStatus: 'other' as any
  };

  const streams = await providerRegistry.resolveStreams(
    'anime',
    { imdbId: 'tt0434665', id: 'bleach', title: 'Bleach' },
    { season: 1, episode: 1 }
  );

  console.log('Total streams:', streams.length);

  const isAnime = item.type === ContentType.ANIME || (item.genres && item.genres.includes('Anime'));
  const isNational = item.audioStatus === 'pt-br-original';

  const optionsMap = new Map();
  let selectedStreamIndex = 0;

  streams.forEach((stream, index) => {
    const combined = `${stream.name || ''} ${stream.title || ''} ${stream.description || ''}`.toLowerCase();
    const isDubbedPt = stream.isDubbed || /dublado|brazuca|\bpt[-_]?br\b/i.test(combined);

    if (isDubbedPt || (isNational && !combined.includes('legendado'))) {
      if (!optionsMap.has('stream-pt-br')) {
        optionsMap.set('stream-pt-br', {
          id: 'stream-pt-br',
          langCode: 'pt-BR',
          label: 'Português (Brasil)',
          flag: '🇧🇷',
          badge: 'Dublado',
          isCurrent: selectedStreamIndex === index,
          streamIndex: index,
          matchedTitle: stream.title?.replace(/\n/g, ' ')
        });
      }
    }

    if (/jap|ja\b|jpn|japanese|japon[eê]s/i.test(combined) || (isAnime && !isDubbedPt)) {
      if (!optionsMap.has('stream-ja')) {
        optionsMap.set('stream-ja', {
          id: 'stream-ja',
          langCode: 'ja',
          label: 'Japonês',
          flag: '🇯🇵',
          badge: 'Original',
          isCurrent: selectedStreamIndex === index,
          streamIndex: index,
          matchedTitle: stream.title?.replace(/\n/g, ' ')
        });
      }
    }

    if (/eng|en\b|english|ingl[eê]s/i.test(combined) || (!isAnime && !isNational && !isDubbedPt && !combined.includes('espanhol'))) {
      if (!optionsMap.has('stream-en')) {
        optionsMap.set('stream-en', {
          id: 'stream-en',
          langCode: 'en',
          label: 'Inglês',
          flag: '🇺🇸',
          badge: 'Dublado',
          isCurrent: selectedStreamIndex === index,
          streamIndex: index,
          matchedTitle: stream.title?.replace(/\n/g, ' ')
        });
      }
    }

    if (/esp|es\b|spanish|espanhol|castellano/i.test(combined)) {
      if (!optionsMap.has('stream-es')) {
        optionsMap.set('stream-es', {
          id: 'stream-es',
          langCode: 'es',
          label: 'Espanhol',
          flag: '🇪🇸',
          badge: 'Dublado',
          isCurrent: selectedStreamIndex === index,
          streamIndex: index,
          matchedTitle: stream.title?.replace(/\n/g, ' ')
        });
      }
    }
  });

  console.log('--- OPÇÕES GERADAS NO SELETOR ---');
  for (const opt of optionsMap.values()) {
    console.log(`${opt.label} (${opt.langCode}) -> streamIndex: ${opt.streamIndex}, isCurrent: ${opt.isCurrent}, matchedTitle: ${opt.matchedTitle}`);
  }
}
testAudioMenuBleach();
