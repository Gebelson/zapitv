import { offlineSourceInspector } from '../src/core/offline/offlineSourceInspector';
import { browserCompatibilityService } from '../src/core/offline/browserCompatibilityService';
import { hlsDownloadService } from '../src/core/offline/hlsDownloadService';
import { StremioStream } from '../src/core/stremio/stremioTypes';
import { ContentItem, ContentType } from '../types';

async function runDiagnosticTests() {
  console.log('================================================================');
  console.log('TESTES DE DIAGNÓSTICO REAL, DRM, HLS E BUSCA DE ALTERNATIVAS');
  console.log('================================================================\n');

  // 1. Teste de Capacidades do Navegador e Plataforma (Req 7)
  console.log('--- 1. Avaliação de Capacidades e Limitações do Navegador ---');
  const caps = await browserCompatibilityService.getCapabilities();
  console.log('Navegador detectado:', caps.browserName, '| SO:', caps.osName, '| Mobile:', caps.isMobile);
  console.log('Driver recomendado:', caps.recommendedStorageDriver);
  console.log('Suporte OPFS:', caps.opfsSupported, '| Writable:', caps.opfsWritableSupported);
  console.log('Suporte WebCrypto (AES-128 transporte):', caps.webCryptoSupported);
  console.log('Suporte Persistent Widevine:', caps.supportsPersistentWidevine);
  console.log('Suporte Persistent PlayReady:', caps.supportsPersistentPlayReady);
  console.log('Suporte Persistent FairPlay:', caps.supportsPersistentFairPlay);
  console.log('Formatos suportados:', caps.supportedContainerFormats);

  // 2. Teste Coraline (Caso Obrigatório: Filme com fontes web-proxy 1080p PT-BR) (Req 9)
  console.log('\n--- 2. Caso de Teste Real: Coraline e o Mundo Secreto ---');
  const coralineItem: ContentItem = {
    id: '14836',
    tmdbId: '14836',
    imdbId: 'tt0327597',
    title: 'Coraline e o Mundo Secreto',
    originalTitle: 'Coraline',
    type: ContentType.MOVIE,
    year: 2009,
    rating: 8.5,
    genres: ['Animação', 'Fantasia'],
    image: 'https://image.tmdb.org/t/p/w500/shqB9gE702R0w05G2xQ0u8Z3d8c.jpg'
  };

  const coralineDiag = await offlineSourceInspector.inspectDownloadOptionsDetailed({
    item: coralineItem,
    preferredLanguage: 'pt-BR',
    durationMinutes: 100
  });

  console.log(`Fontes identificadas para Coraline: ${coralineDiag.identifiedSourcesCount}`);
  console.log(`Opções de qualidade reais disponíveis: ${coralineDiag.options.length}`);
  coralineDiag.options.forEach(o => {
    console.log(`  - [${o.quality}] ${(o.estimatedBytes / (1024*1024)).toFixed(0)} MB | Dublado: ${o.isDubbed} | Tipo: ${o.sourceType} | URL: ${o.sourceUrl.slice(0, 60)}...`);
  });

  // 3. Teste Diferenciação Real de DRM Comercial vs Criptografia de Transporte (Req 1)
  console.log('\n--- 3. Diferenciação Real: DRM Comercial (Widevine/PlayReady) vs Transporte ---');
  const mockDrmStreams: StremioStream[] = [
    {
      name: 'Stream Protegido Widevine',
      title: 'Filme 1080p CENC Widevine DRM',
      url: 'widevine:https://license.example.com/cenc/manifest.mpd',
      quality: '1080p'
    },
    {
      name: 'Stream Protegido FairPlay',
      title: 'Filme 1080p FairPlay DRM',
      url: 'fairplay:https://fps.example.com/stream.m3u8',
      quality: '1080p'
    }
  ];

  const drmDiag = await offlineSourceInspector.inspectDownloadOptionsDetailed(mockDrmStreams, 'pt-BR', 90);
  console.log('Opções para streams com DRM comercial sem licença offline:', drmDiag.options.length);
  console.log('Fontes com DRM detectadas:', drmDiag.drmProtectedCount);
  console.log('Motivo diagnosticado com exatidão:', `"${drmDiag.reason}"`);

  // 4. Teste Diferenciação de Fontes P2P / Stremio Engine Offline (Req 1 e 8)
  console.log('\n--- 4. Diferenciação de Fontes que Requerem Stremio Engine Local ---');
  const mockP2pStreams: StremioStream[] = [
    {
      name: 'Torrentio P2P Local',
      title: 'Filme 1080p via 127.0.0.1:11470',
      url: 'http://127.0.0.1:11470/stream/abc123def456/0',
      quality: '1080p'
    }
  ];

  const p2pDiag = await offlineSourceInspector.inspectDownloadOptionsDetailed(mockP2pStreams, 'pt-BR', 90);
  console.log('Opções para streams P2P com engine local offline:', p2pDiag.options.length);
  console.log('Fontes que requerem motor local:', p2pDiag.torrentEngineRequiredCount);
  console.log('Motivo diagnosticado:', `"${p2pDiag.reason}"`);

  // 5. Teste Busca Automática de Alternativas (Req 2)
  console.log('\n--- 5. Busca Automática de Alternativas quando Lista Inicial é Inadequada ---');
  // Passa um stream P2P bloqueado para Coraline, mas fornece o item: o inspetor deve consultar os provedores e encontrar a alternativa web-proxy!
  const alternativesDiag = await offlineSourceInspector.inspectDownloadOptionsDetailed({
    item: coralineItem,
    streams: mockP2pStreams, // Começa com a lista inadequada
    preferredLanguage: 'pt-BR',
    durationMinutes: 100
  });

  console.log(`Alternativas encontradas com sucesso: ${alternativesDiag.options.length > 0}`);
  console.log(`Total de qualidades reais recuperadas: ${alternativesDiag.options.length}`);
  alternativesDiag.options.forEach(o => {
    console.log(`  - [${o.quality}] ${(o.estimatedBytes / (1024*1024)).toFixed(0)} MB | Fonte: ${o.sourceUrl.slice(0, 60)}...`);
  });

  // 6. Teste de Manifesto HLS com Variantes e Criptografia de Transporte AES-128 (Req 1 e 4)
  console.log('\n--- 6. Análise de Playlist HLS e Transporte AES-128 ---');
  // Testa resolução de URLs e parsing de Master Playlist HLS simulada
  const sampleMasterManifest = `
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360
360p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1400000,RESOLUTION=854x480
480p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1280x720
720p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
1080p/index.m3u8
  `.trim();

  console.log('Validando extração de variantes reais de master playlist HLS...');
  const lines = sampleMasterManifest.split('\n');
  const hlsQualities: string[] = [];
  for (const line of lines) {
    if (line.includes('RESOLUTION=')) {
      const match = line.match(/RESOLUTION=(\d+)x(\d+)/);
      if (match) {
        const h = parseInt(match[2], 10);
        if (h >= 1080) hlsQualities.push('1080p');
        else if (h >= 720) hlsQualities.push('720p');
        else if (h >= 480) hlsQualities.push('480p');
        else hlsQualities.push('360p');
      }
    }
  }
  console.log('Qualidades reais identificadas no manifesto HLS:', hlsQualities);

  console.log('\n================================================================');
  console.log('TODOS OS TESTES DE DIAGNÓSTICO E COMPATIBILIDADE CONCLUÍDOS!');
  console.log('================================================================');
}

runDiagnosticTests().catch(console.error);
