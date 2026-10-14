import { audioSelectionManager } from '../src/core/audio/audioSelectionManager.ts';
import { ContentType } from '../types.ts';

async function runTestSuite() {
  console.log('=== SUÍTE DE TESTES AUTOMATIZADOS: ÁUDIO E DUBLAGEM ZAPITV ===\n');
  let passCount = 0;
  let totalCount = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    totalCount++;
    if (condition) {
      passCount++;
      console.log(`✅ [PASS] ${testName}`);
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (details) console.error(`   Detalhes: ${details}`);
    }
  }

  // TESTE A: HLS com múltiplas renditions no manifesto (Situação A)
  {
    const item = { title: 'Big Buck Bunny', type: ContentType.MOVIE };
    const hlsTracks = [
      { id: 0, name: 'Português (Brasil)', lang: 'por' },
      { id: 1, name: 'English', lang: 'eng' },
      { id: 2, name: 'Español', lang: 'spa' }
    ];
    const opts = audioSelectionManager.buildAudioOptions({
      item,
      streams: [],
      hlsTracks,
      currentStreamIndex: 0,
      activeAudioId: 'hls-0',
      selectedHlsTrackId: 0
    });

    assert(opts.length === 3, 'Teste A.1: Gera opções a partir das faixas HLS');
    assert(opts[0].kind === 'hls-rendition', 'Teste A.2: Tipo de opção é hls-rendition');
    assert(opts[0].isCurrent === true && opts[1].isCurrent === false, 'Teste A.3: Check azul estritamente na faixa ativa hls-0');
    assert(opts[0].langCode === 'pt-BR' && opts[0].flag === '🇧🇷', 'Teste A.4: Mapeamento de idioma PT-BR correto');
  }

  // TESTE B: Preposição "en" não pode ser detectada como Inglês
  {
    const langFromSpanishTitle = audioSelectionManager.normalizeLanguageCode('en español latino');
    assert(langFromSpanishTitle === 'es', 'Teste B.1: "en español latino" não vira inglês ("en"), vira "es"');

    const langFromRealEng = audioSelectionManager.normalizeLanguageCode('english audio');
    assert(langFromRealEng === 'en', 'Teste B.2: "english audio" vira "en"');
  }

  // TESTE C: Anime sem dublagem explícita mas sem falso Japonês se for Espanhol
  {
    const item = { title: 'Bleach', type: ContentType.ANIME };
    const streamLatino = {
      name: 'Magnetflix',
      title: 'Bleach S01E01 - Audio Latino HD',
      url: 'http://example.com/bleach_latino.mp4'
    };
    const detected = audioSelectionManager.inspectStreamAudioLanguage(streamLatino as any, 'ja');
    assert(detected === 'es', 'Teste C.1: Anime com stream "Audio Latino" é classificado como "es", NUNCA como "ja"');
  }

  // TESTE D: Eliminação de Torrents e opções fictícias no Seletor (Situação B)
  {
    const item = { title: 'Bleach', type: ContentType.ANIME };
    const streams = [
      {
        name: 'FenixBot',
        title: 'Bleach S01E01 Dublado PT-BR',
        url: 'https://fenixbot.squareweb.app/stream/1'
      },
      {
        name: 'NyaaSi',
        title: 'Bleach S01E01 [Dual-Audio] English',
        url: 'magnet:?xt=urn:btih:xyz',
        behaviorHints: { notWebReady: true }
      },
      {
        name: 'Magnetflix',
        title: 'Bleach S01E01 Latino',
        url: 'http://example.com/bleach_es.mp4'
      }
    ];

    const opts = audioSelectionManager.buildAudioOptions({
      item,
      streams: streams as any,
      hlsTracks: [],
      currentStreamIndex: 0,
      activeAudioId: 'stream-pt-BR'
    });

    // Torrent marcado como notWebReady deve ser ignorado para evitar seleção de stream não funcional
    const hasEnglishTorrent = opts.some(o => o.langCode === 'en');
    assert(!hasEnglishTorrent, 'Teste D.1: Torrent inacessível na web direta NÃO gera opção no seletor');
    assert(opts.some(o => o.langCode === 'pt-BR'), 'Teste D.2: Stream PT-BR web-ready está presente');
    assert(opts.some(o => o.langCode === 'es'), 'Teste D.3: Stream Espanhol web-ready está presente');
    assert(opts.find(o => o.langCode === 'pt-BR')?.isCurrent === true, 'Teste D.4: Check azul estritamente no áudio ativo');
  }

  // TESTE E: Regra de Ouro — Check azul apenas na faixa confirmada
  {
    const item = { title: 'Naruto', type: ContentType.ANIME };
    const streams = [
      { name: 'S1', title: 'Naruto Dublado PT-BR', url: 'http://example.com/dub.mp4' },
      { name: 'S2', title: 'Naruto Legendado Original', url: 'http://example.com/sub.mp4' }
    ];

    // Simula usuário clicou em Japonês mas activeAudioId ainda é PT-BR (durante transição)
    const optsPending = audioSelectionManager.buildAudioOptions({
      item,
      streams: streams as any,
      hlsTracks: [],
      currentStreamIndex: 0,
      activeAudioId: 'stream-pt-BR'
    });

    const ptOpt = optsPending.find(o => o.langCode === 'pt-BR');
    const jaOpt = optsPending.find(o => o.langCode === 'ja');

    assert(ptOpt?.isCurrent === true, 'Teste E.1: Check azul permanece na opção tocada até confirmação');
    assert(jaOpt?.isCurrent === false, 'Teste E.2: Opção de destino NÃO exibe check prematuramente');
  }

  // TESTE F: Título Nacional (Áudio Original PT-BR)
  {
    const item = { title: 'Auto da Compadecida', audioStatus: 'pt-br-original' };
    const detected = audioSelectionManager.detectOriginalLanguage(item as any);
    assert(detected === 'pt-BR', 'Teste F.1: Conteúdo nacional tem áudio original detectado como pt-BR');
  }

  // TESTE G: Idiomas suportados com bandeiras e badges corretos
  {
    const displayPt = audioSelectionManager.getLanguageDisplay('pt-BR');
    assert(displayPt.label === 'Português (Brasil)' && displayPt.flag === '🇧🇷', 'Teste G.1: Display PT-BR correto');

    const displayJa = audioSelectionManager.getLanguageDisplay('ja');
    assert(displayJa.label === 'Japonês' && displayJa.flag === '🇯🇵', 'Teste G.2: Display JA correto');

    const displayEn = audioSelectionManager.getLanguageDisplay('en');
    assert(displayEn.label === 'Inglês' && displayEn.flag === '🇺🇸', 'Teste G.3: Display EN correto');

    const displayEs = audioSelectionManager.getLanguageDisplay('es');
    assert(displayEs.label === 'Espanhol' && displayEs.flag === '🇪🇸', 'Teste G.4: Display ES correto');
  }

  console.log(`\n======================================================`);
  console.log(`RESULTADO FINAL: ${passCount}/${totalCount} TESTES PASSARAM COM SUCESSO!`);
  console.log(`======================================================\n`);
}

runTestSuite();
