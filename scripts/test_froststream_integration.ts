import { providerRegistry } from '../src/core/providers/providerRegistry';
import { StremioClient } from '../src/core/stremio/stremioClient';
import { sourceSelectionService } from '../src/core/selection/sourceSelectionService';
import { StremioStream } from '../src/core/stremio/stremioTypes';

async function runFrostStreamTests() {
  console.log('=== TESTE 1: Registro do FrostStream nos Provedores Padrão ===');
  const providers = providerRegistry.getProviders();
  const frostProvider = providers.find(p => p.id === 'froststream-http');
  
  if (!frostProvider) {
    throw new Error('FALHA: Provedor froststream-http não encontrado no registro!');
  }
  
  console.log('✓ Provedor registrado:', {
    id: frostProvider.id,
    name: frostProvider.name,
    url: frostProvider.url,
    enabled: frostProvider.enabled,
    priority: frostProvider.priority,
    isPtBr: frostProvider.isPtBr,
    status: frostProvider.status
  });

  if (frostProvider.priority !== 3) {
    throw new Error(`FALHA: Prioridade esperada 3, mas encontrada ${frostProvider.priority}`);
  }
  if (!frostProvider.isPtBr) {
    throw new Error('FALHA: isPtBr deveria ser true');
  }

  console.log('\n=== TESTE 2: Verificação de Resiliência de Health Check (Sem quebra com status 408/offline) ===');
  const healthResult = await providerRegistry.checkProviderHealth('froststream-http');
  console.log('✓ Health check executado com sucesso e sem unhandled error:', {
    id: healthResult.id,
    status: healthResult.status,
    latencyMs: healthResult.latencyMs,
    errorMessage: healthResult.errorMessage || 'Nenhum erro'
  });

  console.log('\n=== TESTE 3: Validação de streams diretos HLS/MP4 com palavra "embed" no domínio ===');
  // Simular streams típicos retornados pelo FrostStream (MegaEmbed, CloutUpload, IPTV, etc.)
  const mockFrostStreams: StremioStream[] = [
    {
      name: 'FrostStream\n1080p',
      title: 'A Odisseia (2026) [1080p] [Dublado PT-BR]',
      url: 'https://megaembed.me/stream/odisseia-2026/master.m3u8',
      sourceType: 'hls',
      quality: '1080p',
      providerId: 'froststream-http',
      providerName: 'FrostStream (HTTP Streams PT-BR)'
    },
    {
      name: 'FrostStream\n720p',
      title: 'A Odisseia (2026) [720p] [Dublado]',
      url: 'https://embedplayer2.xyz/video/master.m3u8',
      sourceType: 'hls',
      quality: '720p',
      providerId: 'froststream-http',
      providerName: 'FrostStream (HTTP Streams PT-BR)'
    },
    {
      name: 'FrostStream Iframe Invalido',
      title: 'Player Web Iframe Não-Reproduzível',
      url: 'https://megaembed.me/embed/watch?id=12345',
      sourceType: 'embed' as any,
      providerId: 'froststream-http',
      providerName: 'FrostStream (HTTP Streams PT-BR)'
    }
  ];

  // Testar filtro de streams
  const filteredStreams = mockFrostStreams.filter(s => {
    const sUrl = s.url || '';
    const isMediaFile = sUrl.includes('.m3u8') || sUrl.includes('.mp4') || sUrl.includes('.webm') || sUrl.includes('.ogv') || sUrl.includes('.mpd') || sUrl.includes('.mkv');
    if (!isMediaFile && (sUrl.includes('embed') || sUrl.includes('iframe') || s.sourceType === ('embed' as any))) return false;
    return true;
  });

  console.log(`✓ Filtro preservou os ${filteredStreams.length} streams HLS válidos e descartou a página web/iframe!`);
  if (filteredStreams.length !== 2) {
    throw new Error(`FALHA: Esperado 2 streams válidos, obtidos ${filteredStreams.length}`);
  }

  console.log('\n=== TESTE 4: Pontuação e Seleção Automática Invisível (PT-BR > Legenda > Outros) ===');
  const ranked = sourceSelectionService.rankStreams(filteredStreams, {
    hasExternalPtSub: true,
    identity: {
      id: 'tt33764258',
      title: 'A Odisseia',
      originalTitle: 'The Odyssey',
      year: 2026,
      type: 'movie' as any,
      primaryLanguage: 'en',
      knownAliases: ['a odisseia', 'the odyssey', 'odyssey']
    }
  });

  console.log('✓ Top 1 Selecionado automaticamente (Invisível ao usuário):');
  console.log('  Nome:', ranked[0].name);
  console.log('  Título:', ranked[0].title);
  console.log('  Score:', (ranked[0] as any)._smartScore);
  console.log('  Explicação:', (ranked[0] as any)._scoreExplanation);
  
  const priority = (ranked[0] as any)._smartPriority;
  if (priority !== 1 && priority !== 2) {
    throw new Error(`FALHA: Esperada Prioridade 1 ou 2 para Dublado PT-BR, mas obteve prioridade ${priority}`);
  }

  console.log('\n=== TESTE 5: Resolução Completa de Streams no ZapiTV (Verity e A Odisseia) ===');
  const verityStreams = await providerRegistry.resolveStreams('movie', {
    tmdbId: 1283515,
    imdbId: 'tt32261958',
    title: 'Verity',
    year: 2026
  });
  console.log(`✓ Verity (2026): ${verityStreams.length} streams agregados com sucesso`);
  if (verityStreams.length === 0) {
    throw new Error('FALHA: Verity não retornou streams!');
  }

  const odisseiaStreams = await providerRegistry.resolveStreams('movie', {
    tmdbId: 1368337,
    imdbId: 'tt33764258',
    title: 'A Odisseia',
    year: 2026
  });
  console.log(`✓ A Odisseia (2026): ${odisseiaStreams.length} streams agregados com sucesso`);
  if (odisseiaStreams.length === 0) {
    throw new Error('FALHA: A Odisseia não retornou streams!');
  }

  console.log('\n=== TESTE 6: Atualização de Prioridade Central com Persistência ===');
  providerRegistry.updateProvider('froststream-http', { priority: 2 });
  const updatedProviders = providerRegistry.getProviders();
  const updatedFrost = updatedProviders.find(p => p.id === 'froststream-http');
  console.log('✓ Nova prioridade configurada:', updatedFrost?.priority);
  if (updatedFrost?.priority !== 2) {
    throw new Error('FALHA: Falha ao atualizar prioridade');
  }

  // Restaurar prioridade padrão para 3
  providerRegistry.updateProvider('froststream-http', { priority: 3 });
  console.log('✓ Prioridade restaurada para 3');

  console.log('\n🎉 TODOS OS TESTES PASSARAM COM SUCESSO ABSOLUTO!');
}

runFrostStreamTests().catch(err => {
  console.error('\n❌ ERRO NO TESTE:', err);
  process.exit(1);
});
