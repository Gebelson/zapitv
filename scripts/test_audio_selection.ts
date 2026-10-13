import { classifyStream } from '../src/core/audio/audioDetector';
import { StremioStream } from '../src/core/stremio/stremioTypes';
import { ContentType, ContentItem } from '../types';

interface AudioLanguageOption {
  id: string;
  langCode: string;
  label: string;
  flag: string;
  badge: string;
  isCurrent: boolean;
  type: 'hls' | 'stream' | 'virtual';
  hlsTrackIndex?: number;
  streamIndex?: number;
}

function extractAudioOptions(
  hlsAudioTracks: Array<{ id: number; name: string; lang: string }>,
  selectedHlsAudioTrack: number,
  streams: StremioStream[],
  selectedStreamIndex: number,
  item: { type: ContentType; genres?: string[]; audioStatus?: string; description?: string },
  preferredAudioLang = 'pt-BR'
): AudioLanguageOption[] {
  const isAnime = item.type === ContentType.ANIME || (item.genres && item.genres.includes('Anime'));
  const isNational = item.audioStatus === 'pt-br-original' || (item.genres && item.genres.includes('Nacional'));
  const isKorean = Boolean(item.genres && (item.genres.includes('Dorama') || item.genres.includes('K-Drama')));

  let originalLangCode = 'en';
  let originalLangLabel = 'Inglês';
  let originalFlag = '🇺🇸';

  if (isNational) {
    originalLangCode = 'pt-BR';
    originalLangLabel = 'Português (Brasil)';
    originalFlag = '🇧🇷';
  } else if (isAnime) {
    originalLangCode = 'ja';
    originalLangLabel = 'Japonês';
    originalFlag = '🇯🇵';
  } else if (isKorean) {
    originalLangCode = 'ko';
    originalLangLabel = 'Coreano';
    originalFlag = '🇰🇷';
  } else if (/espanh|spanish/i.test(item.description || '') || item.genres?.includes('Espanhol')) {
    originalLangCode = 'es';
    originalLangLabel = 'Espanhol';
    originalFlag = '🇪🇸';
  }

  const optionsMap = new Map<string, AudioLanguageOption>();

  // 1. Extrair Faixas HLS Nativas
  if (hlsAudioTracks.length > 1) {
    hlsAudioTracks.forEach(track => {
      const lowerName = (track.name || '').toLowerCase();
      const lowerLang = (track.lang || '').toLowerCase();
      let langCode = 'other';
      let flag = '🌐';
      let badge = 'Dublado';
      let label = track.name || `Faixa ${track.id + 1}`;

      if (/por|pt|brazil|brasil|dublado/i.test(lowerName) || /por|pt|pob/i.test(lowerLang)) {
        langCode = 'pt-BR';
        flag = '🇧🇷';
        badge = isNational ? 'Original' : 'Dublado';
        label = 'Português (Brasil)';
      } else if (/jap|ja|jpn/i.test(lowerName) || /ja|jpn/i.test(lowerLang)) {
        langCode = 'ja';
        flag = '🇯🇵';
        badge = isAnime ? 'Original' : 'Dublado';
        label = 'Japonês';
      } else if (/eng|en|ingl/i.test(lowerName) || /en|eng/i.test(lowerLang)) {
        langCode = 'en';
        flag = '🇺🇸';
        badge = (!isAnime && !isNational && !isKorean) ? 'Original' : 'Dublado';
        label = 'Inglês';
      } else if (/spa|es|espanhol|castellano/i.test(lowerName) || /es|spa/i.test(lowerLang)) {
        langCode = 'es';
        flag = '🇪🇸';
        badge = (originalLangCode === 'es') ? 'Original' : 'Dublado';
        label = 'Espanhol';
      }

      const isCurrent = selectedHlsAudioTrack === track.id;
      optionsMap.set(langCode, {
        id: `hls-${track.id}`,
        langCode,
        label,
        flag,
        badge,
        isCurrent,
        type: 'hls',
        hlsTrackIndex: track.id
      });
    });
  }

  // 2. Mapear streams disponíveis
  const streamByLang = new Map<string, number>();
  if (streams && streams.length > 0) {
    streams.forEach((stream, index) => {
      const combined = `${stream.name || ''} ${stream.title || ''} ${stream.description || ''}`.toLowerCase();
      const isDual = /dual[-_]?audio|dual\b/i.test(combined);
      const isDubbedPt = stream.isDubbed || /dublado|brazuca|\bpt[-_]?br\b/i.test(combined);

      if ((isDubbedPt || isDual) && !streamByLang.has('pt-BR')) {
        streamByLang.set('pt-BR', index);
      }

      if (/jap|ja\b|jpn|japanese|japon[eê]s/i.test(combined) || (isAnime && !isDubbedPt)) {
        if (!streamByLang.has('ja')) streamByLang.set('ja', index);
      } else if (/eng|en\b|english|ingl[eê]s/i.test(combined) || (!isAnime && !isNational && !isDubbedPt)) {
        if (!streamByLang.has('en')) streamByLang.set('en', index);
      } else if (/esp|es\b|spanish|espanhol/i.test(combined)) {
        if (!streamByLang.has('es')) streamByLang.set('es', index);
      }

      if (isDual) {
        if (isAnime && !streamByLang.has('ja')) streamByLang.set('ja', index);
        if (!isAnime && !isNational && !streamByLang.has('en')) streamByLang.set('en', index);
      }
    });
  }

  // 3. Adicionar opções estruturadas garantindo múltiplos idiomas:
  // A) Português (Brasil)
  if (!optionsMap.has('pt-BR')) {
    const ptStreamIdx = streamByLang.get('pt-BR');
    const isCurrentPt = preferredAudioLang === 'pt-BR' || (ptStreamIdx !== undefined && selectedStreamIndex === ptStreamIdx);
    optionsMap.set('pt-BR', {
      id: 'opt-pt-br',
      langCode: 'pt-BR',
      label: 'Português (Brasil)',
      flag: '🇧🇷',
      badge: isNational ? 'Original' : 'Dublado',
      isCurrent: isCurrentPt,
      type: ptStreamIdx !== undefined ? 'stream' : 'virtual',
      streamIndex: ptStreamIdx
    });
  }

  // B) Áudio Original
  if (!isNational && !optionsMap.has(originalLangCode)) {
    const origStreamIdx = streamByLang.get(originalLangCode) ?? streamByLang.get('original');
    const isCurrentOrig = preferredAudioLang === originalLangCode || (!optionsMap.get('pt-BR')?.isCurrent && origStreamIdx !== undefined && selectedStreamIndex === origStreamIdx);
    optionsMap.set(originalLangCode, {
      id: `opt-${originalLangCode}`,
      langCode: originalLangCode,
      label: originalLangLabel,
      flag: originalFlag,
      badge: 'Original',
      isCurrent: isCurrentOrig,
      type: origStreamIdx !== undefined ? 'stream' : 'virtual',
      streamIndex: origStreamIdx
    });
  }

  // C) Inglês para Anime (Dublado em Inglês)
  if (isAnime && !optionsMap.has('en')) {
    const enStreamIdx = streamByLang.get('en');
    const isCurrentEn = preferredAudioLang === 'en' || (enStreamIdx !== undefined && selectedStreamIndex === enStreamIdx);
    optionsMap.set('en', {
      id: 'opt-en',
      langCode: 'en',
      label: 'Inglês',
      flag: '🇺🇸',
      badge: 'Dublado',
      isCurrent: isCurrentEn,
      type: enStreamIdx !== undefined ? 'stream' : 'virtual',
      streamIndex: enStreamIdx
    });
  }

  // D) Espanhol
  if (!optionsMap.has('es') && (streamByLang.has('es') || !isNational)) {
    const esStreamIdx = streamByLang.get('es');
    const isCurrentEs = preferredAudioLang === 'es' || (esStreamIdx !== undefined && selectedStreamIndex === esStreamIdx);
    optionsMap.set('es', {
      id: 'opt-es',
      langCode: 'es',
      label: 'Espanhol',
      flag: '🇪🇸',
      badge: originalLangCode === 'es' ? 'Original' : 'Dublado',
      isCurrent: isCurrentEs,
      type: esStreamIdx !== undefined ? 'stream' : 'virtual',
      streamIndex: esStreamIdx
    });
  }

  // 4. Desempatar isCurrent
  const list = Array.from(optionsMap.values());
  const currentCount = list.filter(o => o.isCurrent).length;
  if (currentCount === 0 && list.length > 0) {
    const ptOpt = list.find(o => o.langCode === 'pt-BR');
    if (ptOpt) ptOpt.isCurrent = true;
    else list[0].isCurrent = true;
  } else if (currentCount > 1) {
    let resolved = false;
    list.forEach(o => {
      if (!resolved && o.langCode === preferredAudioLang) {
        o.isCurrent = true;
        resolved = true;
      } else if (resolved || o.langCode !== preferredAudioLang) {
        o.isCurrent = false;
      }
    });
    if (!resolved && list.length > 0) {
      list[0].isCurrent = true;
    }
  }

  return list;
}

async function runTests() {
  console.log('=== TESTE DO SELETOR DE IDIOMA DE DUBLAGEM & ÁUDIO ===\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, desc: string) {
    total++;
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
    }
  }

  // 1. Streams mistos: Dublado PT-BR e Original Japonês para Anime
  const streamsAnime: StremioStream[] = [
    {
      name: 'FenixFlix',
      title: '[DUBLADO PT-BR] Attack on Titan - Ep 1 - 1080p',
      url: 'https://cdn.example.com/aot_ptbr.mp4',
      isDubbed: true,
      isPtBr: true,
      quality: '1080p'
    },
    {
      name: 'Torrent',
      title: '[LEG] Shingeki no Kyojin - Ep 1 - 1080p (Japanese Audio)',
      url: 'https://cdn.example.com/aot_jp.mp4',
      isDubbed: false,
      isPtBr: false,
      quality: '1080p'
    }
  ];

  const animeItem = { type: ContentType.ANIME, genres: ['Anime', 'Ação'] };
  const animeOptions = extractAudioOptions([], 0, streamsAnime, 0, animeItem, 'pt-BR');
  assert(animeOptions.some(o => o.flag === '🇧🇷' && o.label === 'Português (Brasil)'), 'Identifica Português (Brasil)');
  assert(animeOptions.some(o => o.flag === '🇯🇵' && o.label === 'Japonês'), 'Identifica Japonês (Original)');
  assert(animeOptions.find(o => o.langCode === 'pt-BR')?.isCurrent === true, 'Opção PT-BR está marcada como ativa por padrão');
  assert(animeOptions.find(o => o.langCode === 'ja')?.isCurrent === false, 'Opção Japonês está disponível para seleção');

  // 2. Mudança de seleção de idioma para Japonês
  const animeOptionsSwitched = extractAudioOptions([], 0, streamsAnime, 1, animeItem, 'ja');
  assert(animeOptionsSwitched.find(o => o.langCode === 'pt-BR')?.isCurrent === false, 'Após alternar para japonês, PT-BR não é mais o corrente');
  assert(animeOptionsSwitched.find(o => o.langCode === 'ja')?.isCurrent === true, 'Após alternar para japonês, Japonês passa a ser o corrente');

  // 3. Multi-audio nativo em HLS (embedded tracks)
  const hlsTracks = [
    { id: 0, name: 'Português', lang: 'por' },
    { id: 1, name: 'English', lang: 'eng' },
    { id: 2, name: 'Japanese', lang: 'jpn' }
  ];
  const hlsOptions = extractAudioOptions(hlsTracks, 0, streamsAnime, 0, animeItem);
  assert(hlsOptions.length >= 3, 'Extrai faixas de áudio embutidas no HLS');
  assert(hlsOptions.some(o => o.flag === '🇧🇷'), 'Faixa PT-BR presente no HLS');
  assert(hlsOptions.some(o => o.flag === '🇺🇸'), 'Faixa Inglês presente no HLS');
  assert(hlsOptions.some(o => o.flag === '🇯🇵'), 'Faixa Japonês presente no HLS');

  // 4. Filme internacional ocidental (Garante Inglês Original e Espanhol além de Português)
  const movieItem = { type: ContentType.MOVIE, genres: ['Ficção Científica', 'Ação'] };
  const movieStreams: StremioStream[] = [
    {
      name: 'Stream 4K',
      title: '[DUBLADO PT-BR] Oppenheimer 4K',
      url: 'https://cdn.example.com/opp_4k.mp4',
      isDubbed: true,
      isPtBr: true,
      quality: '4K'
    },
    {
      name: 'Stream 1080p',
      title: '[DUBLADO PT-BR] Oppenheimer 1080p',
      url: 'https://cdn.example.com/opp_1080p.mp4',
      isDubbed: true,
      isPtBr: true,
      quality: '1080p'
    }
  ];

  const movieOptions = extractAudioOptions([], 0, movieStreams, 0, movieItem, 'pt-BR');
  assert(movieOptions.some(o => o.flag === '🇧🇷' && o.label === 'Português (Brasil)'), 'Filme possui Português (Brasil)');
  assert(movieOptions.some(o => o.flag === '🇺🇸' && o.label === 'Inglês' && o.badge === 'Original'), 'Filme possui Inglês (Original) além do dublado brasileiro');
  assert(movieOptions.some(o => o.flag === '🇪🇸' && o.label === 'Espanhol'), 'Filme possui Espanhol como idioma adicional');
  assert(movieOptions.filter(o => o.langCode === 'pt-BR').length === 1, 'Não duplica opções de Português (Brasil) mesmo com múltiplos streams dublados');

  console.log(`\nResultado: ${passed}/${total} testes passaram.`);
  if (passed !== total) process.exit(1);
}

runTests();
