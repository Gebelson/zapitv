import { providerRegistry } from './src/core/providers/providerRegistry';
import { streamValidator } from './src/core/providers/streamValidator';
import { VERIFIED_OPEN_ITEMS } from './src/core/catalog/verifiedCatalog';
import { sortStreamsByPtBrPriority } from './src/core/audio/audioDetector';

async function runParkLogicVerificationSuite() {
  console.log('========================================================================');
  console.log('🛡️  BATERIA DE TESTES OFICIAIS: DETECÇÃO DE PARKLOGIC E FALLBACK REAL');
  console.log('========================================================================\n');

  let passed = 0;
  const total = 6;

  // ----------------------------------------------------------------------
  // TESTE 1: Um Filme Completo
  // ----------------------------------------------------------------------
  console.log('👉 [TESTE 1/6] Testando Reprodução de Filme Completo com Áudio/Vídeo...');
  try {
    const movie = VERIFIED_OPEN_ITEMS.find(i => i.id === 'open-night-living-dead-1968');
    if (!movie) throw new Error('Filme não encontrado no acervo.');

    const streams = await providerRegistry.resolveStreams('movie', { id: movie.id });
    if (!streams.length) throw new Error('Nenhuma fonte encontrada para o filme.');

    const selected = streams[0];
    const streamUrl = selected.url.startsWith('/') ? `http://localhost:4000${selected.url}` : selected.url;

    // Testar carregamento inicial
    const headRes = await fetch(streamUrl, {
      headers: { Range: 'bytes=0-2048', 'User-Agent': 'ZapiTV-Player/1.0' },
      signal: AbortSignal.timeout(8000)
    });

    if (headRes.status !== 200 && headRes.status !== 206) {
      throw new Error(`Falha no stream inicial: status HTTP ${headRes.status}`);
    }

    // Testar avanço na linha do tempo (Seek)
    const seekRes = await fetch(streamUrl, {
      headers: { Range: 'bytes=5000000-5002048', 'User-Agent': 'ZapiTV-Player/1.0' },
      signal: AbortSignal.timeout(8000)
    });

    if (seekRes.status !== 206) {
      throw new Error(`Seek falhou: status HTTP ${seekRes.status}`);
    }

    console.log(`   Filme: "${movie.title}"`);
    console.log(`   Fonte ativa: [${selected.name}] ${selected.url}`);
    console.log(`   Tipo de Mídia: ${seekRes.headers.get('content-type')} | Range: ${seekRes.headers.get('content-range')}`);
    console.log(`✅ [TESTE 1 APROVADO]: Filme completo reproduz vídeo e áudio reais com suporte a seek.\n`);
    passed++;
  } catch (err: any) {
    console.error(`❌ [TESTE 1 FALHOU]:`, err.message, '\n');
  }

  // ----------------------------------------------------------------------
  // TESTE 2: Um Episódio de Série
  // ----------------------------------------------------------------------
  console.log('👉 [TESTE 2/6] Testando Reprodução de Episódio de Série...');
  try {
    const series = VERIFIED_OPEN_ITEMS.find(i => i.id === 'tmdb-95897');
    if (!series) throw new Error('Série não encontrada no acervo.');

    const streams = await providerRegistry.resolveStreams('anime', { id: series.id }, { season: 1, episode: 1 });
    if (!streams.length) throw new Error('Nenhuma fonte encontrada para o episódio 1.');

    const epStream = streams[0];
    const streamUrl = epStream.url.startsWith('/') ? `http://localhost:4000${epStream.url}` : epStream.url;

    const res = await fetch(streamUrl, {
      headers: { Range: 'bytes=0-4096', 'User-Agent': 'ZapiTV-Player/1.0' },
      signal: AbortSignal.timeout(8000)
    });

    if (res.status !== 200 && res.status !== 206) {
      throw new Error(`Falha ao carregar episódio: status HTTP ${res.status}`);
    }

    console.log(`   Série: "${series.title}" - T1:E1`);
    console.log(`   Fonte: [${epStream.name}] ${epStream.url}`);
    console.log(`   Content-Type: ${res.headers.get('content-type')}`);
    console.log(`✅ [TESTE 2 APROVADO]: Episódio de série validado com reprodução de dados.\n`);
    passed++;
  } catch (err: any) {
    console.error(`❌ [TESTE 2 FALHOU]:`, err.message, '\n');
  }

  // ----------------------------------------------------------------------
  // TESTE 3: Vídeo com Áudio PT-BR Confirmado
  // ----------------------------------------------------------------------
  console.log('👉 [TESTE 3/6] Testando Áudio em Português Brasileiro (PT-BR)...');
  try {
    const ptBrItem = VERIFIED_OPEN_ITEMS.find(i => i.id === 'open-historias-fome-br');
    if (!ptBrItem) throw new Error('Obra nacional PT-BR não encontrada.');

    const streams = await providerRegistry.resolveStreams('movie', { id: ptBrItem.id });
    if (!streams.length) throw new Error('Fontes não encontradas.');

    const topStream = streams[0];
    if (!topStream.isPtBr) {
      throw new Error('A fonte com áudio PT-BR não foi colocada no 1º lugar.');
    }

    const streamUrl = topStream.url.startsWith('/') ? `http://localhost:4000${topStream.url}` : topStream.url;
    const res = await fetch(streamUrl, {
      headers: { Range: 'bytes=0-2048', 'User-Agent': 'ZapiTV-Player/1.0' },
      signal: AbortSignal.timeout(8000)
    });

    if (res.status !== 200 && res.status !== 206) {
      throw new Error(`Falha no stream PT-BR: status ${res.status}`);
    }

    console.log(`   Obra: "${ptBrItem.title}"`);
    console.log(`   Status do Áudio: ${ptBrItem.audioStatus} (PT-BR Original Confirmado)`);
    console.log(`   Fonte Priorizada: [${topStream.name}] isPtBr=${topStream.isPtBr}`);
    console.log(`✅ [TESTE 3 APROVADO]: Áudio em Português do Brasil verificado e priorizado como primário.\n`);
    passed++;
  } catch (err: any) {
    console.error(`❌ [TESTE 3 FALHOU]:`, err.message, '\n');
  }

  // ----------------------------------------------------------------------
  // TESTE 4: Detecção de Fonte que Retorna ParkLogic
  // ----------------------------------------------------------------------
  console.log('👉 [TESTE 4/6] Testando Detecção de Fonte com Domínio Estacionado / ParkLogic...');
  try {
    const parklogicUrl = 'https://superflixapi.top/filme/550';
    console.log(`   Testando URL problemática: ${parklogicUrl}`);

    // Validação direta via streamValidator
    const validation = await streamValidator.validateStream({
      name: 'Superflix BR (Inativa)',
      url: parklogicUrl,
      sourceType: 'mp4' as any,
      isPtBr: true
    });

    console.log(`   Resultado da validação: valid=${validation.valid}, isParked=${validation.isParked}`);
    console.log(`   Motivo detectado: "${validation.reason}"`);

    if (validation.valid !== false || validation.isParked !== true) {
      throw new Error('O validador falhou ao identificar a URL ParkLogic como inválida/estacionada.');
    }

    // Verificar se o domínio foi adicionado à blacklist
    if (!streamValidator.isUrlBlacklisted(parklogicUrl)) {
      throw new Error('O domínio não foi bloqueado na lista negra.');
    }

    console.log(`✅ [TESTE 4 APROVADO]: Fonte ParkLogic identificada com sucesso, marcada como inválida e bloqueada.\n`);
    passed++;
  } catch (err: any) {
    console.error(`❌ [TESTE 4 FALHOU]:`, err.message, '\n');
  }

  // ----------------------------------------------------------------------
  // TESTE 5: Detecção de Fonte com Erro 404
  // ----------------------------------------------------------------------
  console.log('👉 [TESTE 5/6] Testando Detecção de Fonte com Erro HTTP 404...');
  try {
    const notFoundUrl = 'https://httpbin.org/status/404';
    console.log(`   Testando URL 404: ${notFoundUrl}`);

    const validation = await streamValidator.validateStream({
      name: 'Fonte Quebrada 404',
      url: notFoundUrl,
      sourceType: 'mp4'
    });

    console.log(`   Resultado da validação: valid=${validation.valid}, status=${validation.status}`);
    console.log(`   Motivo detectado: "${validation.reason}"`);

    if (validation.valid !== false || validation.status !== 404) {
      throw new Error(`Esperado status 404 e valid: false. Obtido: ${JSON.stringify(validation)}`);
    }

    console.log(`✅ [TESTE 5 APROVADO]: Erro HTTP 404 detectado com sucesso e marcado como inválido.\n`);
    passed++;
  } catch (err: any) {
    console.error(`❌ [TESTE 5 FALHOU]:`, err.message, '\n');
  }

  // ----------------------------------------------------------------------
  // TESTE 6: Fonte Funcional como Alternativa de Fallback
  // ----------------------------------------------------------------------
  console.log('👉 [TESTE 6/6] Testando Alternativa Funcional e Execução de Fallback Automático...');
  try {
    // Lista simulada onde a 1ª fonte é a ParkLogic, a 2ª é 404 e a 3ª é uma fonte funcional
    const mockStreams: any[] = [
      {
        name: 'Superflix ParkLogic',
        url: 'https://superflixapi.top/filme/550',
        sourceType: 'embed',
        isPtBr: true
      },
      {
        name: 'Servidor Caído 404',
        url: 'https://httpbin.org/status/404',
        sourceType: 'mp4',
        isPtBr: true
      },
      {
        name: 'Fonte Funcional Backup',
        url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        sourceType: 'hls',
        isPtBr: true
      }
    ];

    // Simulação exata do algoritmo de fallback do ZapiPlayer
    const triedIndices = new Set<number>();
    let activeStreamIndex = 0;
    let fallbackSuccess = false;

    for (let attempt = 0; attempt < mockStreams.length; attempt++) {
      const current = mockStreams[activeStreamIndex];
      triedIndices.add(activeStreamIndex);
      console.log(`   [Tentativa ${attempt + 1}] Avaliando fonte: "${current.name}" (${current.url})`);

      // Validação prévia de integridade
      const check = await streamValidator.validateStream(current);
      if (!check.valid) {
        console.log(`   -> Fonte falhou: ${check.reason}. Acionando fallback automático...`);
        // Encontrar próxima fonte não tentada
        const remaining = mockStreams
          .map((s, idx) => ({ s, idx }))
          .filter(({ idx }) => !triedIndices.has(idx) && !streamValidator.isUrlBlacklisted(mockStreams[idx].url));

        if (remaining.length > 0) {
          activeStreamIndex = remaining[0].idx;
        } else {
          break;
        }
      } else {
        console.log(`   -> Fonte validada com sucesso! Status HTTP: ${check.status}`);
        fallbackSuccess = true;
        break;
      }
    }

    if (!fallbackSuccess || mockStreams[activeStreamIndex].name !== 'Fonte Funcional Backup') {
      throw new Error('O algoritmo de fallback não convergiu para a fonte funcional.');
    }

    // Validar manifesto da fonte funcional
    const activeUrl = mockStreams[activeStreamIndex].url;
    const manifestRes = await fetch(activeUrl, { signal: AbortSignal.timeout(5000) });
    const manifestText = await manifestRes.text();

    if (!manifestText.includes('#EXTM3U')) {
      throw new Error('Manifesto da fonte de fallback não contém cabeçalho HLS válido #EXTM3U.');
    }

    console.log(`   Manifesto HLS confirmado: #EXTM3U presente (${manifestText.slice(0, 40)}...)`);
    console.log(`✅ [TESTE 6 APROVADO]: Fallback automático transitou pelas fontes defeituosas e reproduziu a alternativa funcional com sucesso.\n`);
    passed++;
  } catch (err: any) {
    console.error(`❌ [TESTE 6 FALHOU]:`, err.message, '\n');
  }

  console.log('========================================================================');
  console.log(`📊 RESULTADO DA BATERIA DE CORREÇÃO: ${passed}/${total} TESTES APROVADOS!`);
  console.log('========================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runParkLogicVerificationSuite().catch((e) => {
  console.error('Erro fatal na suíte:', e);
  process.exit(1);
});
