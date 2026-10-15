import { mediaSourceValidationService, ValidatedSource } from './src/core/providers/mediaSourceValidationService';
import { mediaAvailabilityIndex } from './src/core/catalog/MediaAvailabilityIndex';
import { providerRegistry, VERIFIED_TEST_STREAMS } from './src/core/providers/providerRegistry';
import { theatricalFilterService } from './src/core/catalog/theatricalFilterService';
import { StremioStream } from './src/core/stremio/stremioTypes';
import { ContentType, ContentItem } from './types';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, desc: string) {
  totalTests++;
  if (condition) {
    console.log(`[PASS] ${desc}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${desc}`);
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('ZAPITV - SUÍTE COMPLETA DE VALIDAÇÃO, RESOLUÇÕES E ÁUDIO');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // TESTE 1: Fonte com vídeo e áudio válidos (1080p)
  // -------------------------------------------------------------
  console.log('--- GRUPO 1: Validação de Fontes e Resoluções Reais ---');
  const validStream: StremioStream = {
    name: 'ZapiTV FHD',
    title: '[DUBLADO PT-BR] Sintel - 1080p FHD HLS',
    url: 'https://bitmovin-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
    sourceType: 'hls',
    isPtBr: true,
    isDubbed: true,
    quality: '1080p',
    providerName: 'ZapiTV Stream Core'
  };

  const validated1 = await mediaSourceValidationService.validateSource(validStream, {
    mediaId: 'open-sintel',
    mediaTitle: 'Sintel',
    mediaType: 'movie'
  });

  assert(validated1.availability === 'ready', '1. Fonte válida é aprovada como ready');
  assert(validated1.availableResolutions.includes('1080p'), '2. Resolução 1080p extraída corretamente');
  assert(!validated1.availableResolutions.includes('4K'), '3. REGRA 3: Não inventa 4K para fonte 1080p');

  // -------------------------------------------------------------
  // TESTE 2: Fonte 4K Real (Tears of Steel)
  // -------------------------------------------------------------
  const stream4k: StremioStream = {
    name: 'Unified Streaming',
    title: '[ÁUDIO ORIGINAL] Tears of Steel - 4K UHD HLS',
    url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
    sourceType: 'hls',
    isPtBr: false,
    isDubbed: false,
    quality: '4K',
    providerName: 'Unified Streaming'
  };

  const validated4k = await mediaSourceValidationService.validateSource(stream4k, {
    mediaId: 'test-tears-4k',
    mediaTitle: 'Tears of Steel',
    mediaType: 'movie'
  });

  assert(validated4k.availableResolutions.includes('4K'), '4. Resolução 4K confirmada quando presente na fonte real');

  // -------------------------------------------------------------
  // TESTE 3: Resoluções por Idioma (PT-BR 1080p vs Inglês 4K)
  // -------------------------------------------------------------
  console.log('\n--- GRUPO 2: Resoluções Dependentes de Idioma (REGRA 3 & 4) ---');
  const ptResolutions = mediaSourceValidationService.getResolutionsForLanguage(validated1, 'pt-BR');
  assert(!ptResolutions.includes('4K'), '5. REGRA 3: Idioma PT-BR oferece apenas 1080p (SEM 4K)');

  const enResolutions = mediaSourceValidationService.getResolutionsForLanguage(validated4k, 'original');
  assert(enResolutions.includes('4K'), '6. Idioma Original 4K oferece 4K');

  // -------------------------------------------------------------
  // TESTE 4: Fonte com Erro de Servidor / HTML (Falsa URL ou 404)
  // -------------------------------------------------------------
  console.log('\n--- GRUPO 3: Rejeição de Fontes Inválidas ou Sem URL ---');
  const emptyStream: StremioStream = {
    name: 'Broken Stream',
    title: 'No URL Stream',
    url: '',
    providerName: 'Broken'
  };

  const validatedEmpty = await mediaSourceValidationService.validateSource(emptyStream, {
    mediaId: 'broken-item',
    mediaTitle: 'Broken Item',
    mediaType: 'movie'
  });
  assert(validatedEmpty.availability === 'rejected', '7. Fonte sem URL é imediatamente rejeitada');

  // -------------------------------------------------------------
  // TESTE 5: Fonte em Quarentena / Conteúdo Adulto Falso
  // -------------------------------------------------------------
  const adultFakeStream: StremioStream = {
    name: 'Scam Torrent',
    title: 'Mia Khalifa Hope O Primeiro Impacto Web-dl',
    url: 'http://example.com/scam.mp4',
    infoHash: '812efbe7d0a75fb31bf9426db566f299d10b3474'
  };

  const validatedFake = await mediaSourceValidationService.validateSource(adultFakeStream, {
    mediaId: 'hope-harbor',
    mediaTitle: 'Hope: O Primeiro Impacto',
    mediaType: 'movie'
  });
  assert(validatedFake.availability === 'rejected', '8. Fonte falsa/adulta é isolada e rejeitada');

  // -------------------------------------------------------------
  // TESTE 6: SEM FONTE, SEM CATÁLOGO (REGRA 1)
  // -------------------------------------------------------------
  console.log('\n--- GRUPO 4: Catálogo e Ocultação de Itens Sem Fontes (REGRA 1) ---');
  const nonExistentMediaId = 'tt999999999-ghost-title';
  mediaAvailabilityIndex.markUnavailableConfirmed(
    nonExistentMediaId,
    'movie',
    ['Torrentio', 'Cinema Aberto', 'Blender'],
    'Ghost Movie That Does Not Exist'
  );

  const isPlayable = mediaAvailabilityIndex.isPubliclyPlayable(nonExistentMediaId);
  assert(isPlayable === false, '9. REGRA 1: Item sem fontes confirmadas NÃO é publicly playable');

  // -------------------------------------------------------------
  // TESTE 7: Resolução de Fontes Verificadas do Acervo
  // -------------------------------------------------------------
  console.log('\n--- GRUPO 5: Resolução Real de Fontes Verificadas ---');
  const resolvedNight = await providerRegistry.resolveStreams('movie', {
    id: 'open-night-living-dead-1968',
    title: 'A Noite dos Mortos-Vivos (1968)'
  });
  assert(resolvedNight.length > 0, '10. Clássico em domínio público possui fontes válidas');
  assert(resolvedNight.some(s => s.url.includes('.webm') || s.url.includes('/api/proxy')), '11. Stream reproduzível com URL direta ou proxy');

  // -------------------------------------------------------------
  // TESTE 8: Filme Nacional com Áudio Original PT-BR
  // -------------------------------------------------------------
  console.log('\n--- GRUPO 6: Identificação de Idioma Real PT-BR ---');
  const resolvedHistorias = await providerRegistry.resolveStreams('movie', {
    id: 'open-historias-fome-br',
    title: 'Histórias da Fome no Brasil'
  });
  assert(resolvedHistorias.length > 0, '12. Obra nacional possui streams reproduzíveis');
  assert(resolvedHistorias.some(s => s.isPtBr === true), '13. Áudio PT-BR identificado com precisão');

  // -------------------------------------------------------------
  // TESTE 9: Rejeição de Filmes em Cartaz nos Cinemas
  // -------------------------------------------------------------
  console.log('\n--- GRUPO 7: Filtro Rigoroso de Filmes em Cartaz ---');
  const fakeTheatricalItem: ContentItem = {
    id: 'theatrical-hope-2026',
    title: 'Hope: O Primeiro Impacto',
    type: ContentType.MOVIE,
    year: 2026,
    genres: ['Ficção Científica', 'Suspense']
  };
  const isAllowedTheatrical = await theatricalFilterService.isMovieAllowed(fakeTheatricalItem);
  assert(isAllowedTheatrical === false, '14. Filme em cartaz nos cinemas é rigorosamente bloqueado');

  console.log('\n================================================================');
  console.log(`TOTAL DE ASSERÇÕES: ${totalTests} | APROVADAS: ${passedTests} | FALHAS: ${totalTests - passedTests}`);
  console.log('================================================================\n');

  if (totalTests === passedTests) {
    console.log('SUCESSO TOTAL! Todas as regras e critérios foram atendidos.');
    process.exit(0);
  } else {
    console.error('Houve falhas na suíte de testes.');
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Erro fatal na execução dos testes:', err);
  process.exit(1);
});
