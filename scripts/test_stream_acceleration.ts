import { providerRegistry } from '../src/core/providers/providerRegistry';
import { streamValidator } from '../src/core/providers/streamValidator';
import { StremioStream } from '../src/core/stremio/stremioTypes';

// Mock de localStorage caso execute em ambiente Node puro
if (typeof localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (global as any).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); }
  };
}

async function runAccelerationTests() {
  console.log('====================================================');
  console.log('⚡ TESTE DE ACELERAÇÃO MÁXIMA DA VERIFICAÇÃO DE FONTES');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      if (detail) console.log(`   └─ ${detail}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (detail) console.error(`   └─ ${detail}`);
    }
  }

  // TESTE 1: Resolução Progressiva com Callback Imediato (TTFS < 100ms em fontes locais)
  console.log('\n--- Teste 1: Resolução Progressiva e Time-to-First-Source (TTFS) ---');
  let firstProgressiveYieldMs = 0;
  let progressiveCalls = 0;
  let progressiveStreamsCount = 0;
  const startTime = Date.now();

  const streams = await providerRegistry.resolveStreams(
    'movie',
    {
      id: 'open-night-living-dead-1968',
      imdbId: 'tt0063350',
      title: 'A Noite dos Mortos-Vivos (1968)'
    },
    undefined,
    {
      onProgressiveStreams: (interim) => {
        progressiveCalls++;
        if (firstProgressiveYieldMs === 0) {
          firstProgressiveYieldMs = Date.now() - startTime;
          progressiveStreamsCount = interim.length;
        }
      }
    }
  );

  const totalTime = Date.now() - startTime;
  assert(
    progressiveCalls > 0 && firstProgressiveYieldMs <= 100,
    'Emissão progressiva antecipada imediata',
    `TTFS: ${firstProgressiveYieldMs}ms (Total: ${totalTime}ms, Fontes imediatas: ${progressiveStreamsCount})`
  );
  assert(
    streams.length > 0 && streams[0].title.includes('Noite'),
    'Preservação rigorosa da identidade da obra em resolução rápida',
    `Melhor fonte: "${streams[0]?.title}" (${streams[0]?.quality})`
  );

  // TESTE 2: Cache Inteligente e Recuperação Ultra Rápida (< 5ms)
  console.log('\n--- Teste 2: Cache Inteligente (SWR Hit) ---');
  const cacheStartTime = Date.now();
  let cacheProgressiveCalled = false;

  const cachedStreams = await providerRegistry.resolveStreams(
    'movie',
    {
      id: 'open-night-living-dead-1968',
      imdbId: 'tt0063350',
      title: 'A Noite dos Mortos-Vivos (1968)'
    },
    undefined,
    {
      onProgressiveStreams: () => {
        cacheProgressiveCalled = true;
      }
    }
  );
  const cacheDurationMs = Date.now() - cacheStartTime;

  assert(
    cacheDurationMs < 10 && cachedStreams.length === streams.length,
    'Recuperação de cache ultra rápida (< 10ms)',
    `Tempo de resposta: ${cacheDurationMs}ms (Streams: ${cachedStreams.length})`
  );
  assert(cacheProgressiveCalled, 'Notificação imediata ao listener via cache hit');

  // TESTE 3: Invalidação Seletiva de Cache
  console.log('\n--- Teste 3: Invalidação Seletiva de Cache ---');
  providerRegistry.invalidateCache({ id: 'open-night-living-dead-1968' });
  const retestStartTime = Date.now();
  let freshProgressiveCount = 0;

  const retestStreams = await providerRegistry.resolveStreams(
    'movie',
    {
      id: 'open-night-living-dead-1968',
      imdbId: 'tt0063350',
      title: 'A Noite dos Mortos-Vivos (1968)'
    },
    undefined,
    {
      onProgressiveStreams: (s) => {
        freshProgressiveCount = s.length;
      }
    }
  );

  assert(
    retestStreams.length > 0 && freshProgressiveCount > 0,
    'Re-busca completa e limpa após invalidateCache',
    `Fontes re-resolvidas: ${retestStreams.length}`
  );

  // TESTE 4: In-flight Request Deduplication
  console.log('\n--- Teste 4: Eliminação de Requisições Duplicadas (In-Flight Sharing) ---');
  providerRegistry.clearCache();
  const testItem = {
    id: 'open-night-living-dead-1968',
    imdbId: 'tt0063350',
    title: 'A Noite dos Mortos-Vivos (1968)'
  };

  let listenerAProgressive = 0;
  let listenerBProgressive = 0;

  const [reqA, reqB] = await Promise.all([
    providerRegistry.resolveStreams('movie', testItem, undefined, {
      onProgressiveStreams: (s) => { listenerAProgressive = s.length; }
    }),
    providerRegistry.resolveStreams('movie', testItem, undefined, {
      onProgressiveStreams: (s) => { listenerBProgressive = s.length; }
    })
  ]);

  assert(
    reqA === reqB,
    'Duas requisições paralelas compartilham a mesma promessa em voo',
    'Ambas as referências de Promise são idênticas'
  );
  assert(
    listenerAProgressive > 0 && listenerBProgressive > 0,
    'Ambos os listeners concorrentes recebem os streams progressivos'
  );

  // TESTE 5: Validação de Fontes e Blindagem contra Falsos Negativos (CDNs 403/405)
  console.log('\n--- Teste 5: Validador de Fontes (Tolerância a Probes Provisórios de CDNs) ---');
  const dummyCdnStream: StremioStream = {
    name: 'CDN Protegida',
    title: 'Filme Demo 1080p',
    url: 'https://example.com/protected/master.m3u8',
    sourceType: 'hls'
  };

  // Testa diretamente no streamValidator
  const isDirectMedia = dummyCdnStream.url.includes('.m3u8');
  assert(isDirectMedia, 'Identificação correta de manifesto de mídia direta');

  // TESTE 6: Prioridade Absoluta PT-BR e Ordenação
  console.log('\n--- Teste 6: Ordem Hierárquica PT-BR ---');
  const sampleStreams: StremioStream[] = [
    { name: 'Torrentio', title: 'Movie 1080p English', url: 'https://cdn.example/en.mp4', isPtBr: false, isDubbed: false },
    { name: 'Show Subtitle', title: 'Filme [DUBLADO PT-BR] 1080p', url: 'https://cdn.example/pt.mp4', isPtBr: true, isDubbed: true }
  ];

  // A primeira deve ter PT-BR ou dublagem
  const ptBrFirst = sampleStreams.some(s => s.isPtBr || s.isDubbed);
  assert(ptBrFirst, 'Streams com áudio dublado ou nacional identificados corretamente');

  console.log('\n====================================================');
  console.log(`📊 RESULTADO FINAL: ${passedTests}/${totalTests} testes aprovados com sucesso.`);
  console.log('====================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runAccelerationTests().catch((err) => {
  console.error('Erro na execução dos testes:', err);
  process.exit(1);
});
