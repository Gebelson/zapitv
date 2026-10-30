import assert from 'node:assert/strict';

// Setup Mock Browser Storage and Window Environment
const storageData = new Map<string, string>();
const storage = {
  getItem: (key: string) => storageData.get(key) ?? null,
  setItem: (key: string, value: string) => { storageData.set(key, String(value)); },
  removeItem: (key: string) => { storageData.delete(key); },
  clear: () => storageData.clear(),
  key: (n: number) => [...storageData.keys()][n] ?? null,
  get length() { return storageData.size; }
};

const listeners = new Map<string, Set<Function>>();

const mockWindow = {
  localStorage: storage,
  location: { origin: 'https://zapitv.test' },
  addEventListener: (event: string, handler: Function) => {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(handler);
  },
  removeEventListener: (event: string, handler: Function) => {
    listeners.get(event)?.delete(handler);
  },
  dispatchEvent: (event: any) => {
    const set = listeners.get(event.type);
    if (set) {
      for (const fn of set) {
        try { fn(event); } catch (e) { console.error(e); }
      }
    }
    return true;
  }
};

(globalThis as any).localStorage = storage;
(globalThis as any).window = mockWindow;
(globalThis as any).CustomEvent = class CustomEvent {
  type: string;
  detail: any;
  constructor(type: string, options: any = {}) {
    this.type = type;
    this.detail = options.detail;
  }
};
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });

async function runTests() {
  console.log('=== ZapiTV | Teste Definitivo de Continuar Assistindo & Sincronização Cross-Device ===\n');

  const { storageService } = await import('../src/core/storage/storageService');
  const { syncClient } = await import('../src/core/sync/syncClient');
  const { syncQueue } = await import('../src/core/sync/syncQueue');
  const { ContentType } = await import('../types');

  // Helper de mock do syncClient.pull
  let mockPullData: any = {
    profileId: '',
    serverTime: Date.now(),
    progress: [],
    history: [],
    myList: [],
    favorites: []
  };

  const originalPull = syncClient.pull;
  syncClient.pull = async (profileId: string) => {
    return { ...mockPullData, profileId };
  };

  // Helper de mock de fetch para mutations
  (globalThis as any).fetch = async () => {
    return new Response(JSON.stringify({ success: true, processed: 1, results: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  // =========================================================================
  // CENÁRIO A: Isolamento total de sessões anônimas / pré-autenticação
  // =========================================================================
  console.log('--- Cenário A: Isolamento estrito de dados pré-autenticação ---');
  storage.clear();

  // 1. Simula sessão anônima assistindo a um filme legado antes de criar conta
  await storageService.setScope(null);
  await storageService.saveProgress({
    contentId: 'filme-anonimo-1',
    item: {
      id: 'filme-anonimo-1',
      title: 'Filme Anônimo Legado',
      type: ContentType.MOVIE,
      mediaFormat: 'movie',
      rating: 8.0,
      year: 2024,
      image: 'https://test.com/anon.jpg'
    },
    currentTime: 600,
    duration: 7200,
    percentage: 8,
    updatedAt: new Date(Date.now() - 100000).toISOString()
  });

  const anonProgress = await storageService.getContinueWatching();
  assert.equal(anonProgress.length, 1, 'Progresso anônimo salvo na chave global');

  // 2. Usuário cria conta e faz login com Perfil 1
  await storageService.setScope({ userId: 'user-alpha', profileId: 'profile-alpha-1' });

  // O Continuar Assistindo do Perfil 1 DEVE ser rigorosamente vazio (sem vazamento da sessão anônima)
  const profileAlphaCw = await storageService.getContinueWatching();
  assert.equal(
    profileAlphaCw.length,
    0,
    'Cenário A FALHOU: Perfil autenticado herdou indevidamente progresso de sessão anônima!'
  );
  console.log('✓ Cenário A aprovado: Nenhum conteúdo anônimo/legado vazou para a conta autenticada.');

  // =========================================================================
  // CENÁRIO B: Isolamento estrito entre múltiplos perfis da mesma conta
  // =========================================================================
  console.log('\n--- Cenário B: Isolamento entre múltiplos perfis da mesma conta ---');
  
  // Perfil 1 assiste "One Piece" Episódio 1
  await storageService.saveProgress({
    contentId: 'anime-one-piece',
    item: {
      id: 'anime-one-piece',
      canonicalId: 'canonical-anime-one-piece',
      title: 'One Piece (1999)',
      type: ContentType.ANIME,
      mediaFormat: 'series',
      rating: 9.0,
      year: 1999,
      image: 'https://test.com/op.jpg'
    },
    season: 1,
    episode: 1,
    currentTime: 450,
    duration: 1440,
    percentage: 31,
    updatedAt: new Date().toISOString()
  });

  const p1Items = await storageService.getContinueWatching();
  assert.equal(p1Items.length, 1, 'Perfil 1 possui 1 item em andamento');
  assert.equal(p1Items[0].contentId, 'anime-one-piece');

  // Alterna para Perfil 2 da mesma conta
  await storageService.setScope({ userId: 'user-alpha', profileId: 'profile-alpha-2' });

  // Perfil 2 não deve enxergar o item do Perfil 1
  const p2ItemsInitial = await storageService.getContinueWatching();
  assert.equal(p2ItemsInitial.length, 0, 'Cenário B FALHOU: Perfil 2 enxergou progresso do Perfil 1');

  // Perfil 2 assiste a um filme diferente ("O Poderoso Chefão")
  await storageService.saveProgress({
    contentId: 'movie-godfather',
    item: {
      id: 'movie-godfather',
      canonicalId: 'canonical-movie-godfather',
      title: 'O Poderoso Chefão',
      type: ContentType.MOVIE,
      mediaFormat: 'movie',
      rating: 9.2,
      year: 1972,
      image: 'https://test.com/godfather.jpg'
    },
    currentTime: 1800,
    duration: 10500,
    percentage: 17,
    updatedAt: new Date().toISOString()
  });

  const p2Items = await storageService.getContinueWatching();
  assert.equal(p2Items.length, 1);
  assert.equal(p2Items[0].contentId, 'movie-godfather');

  // Volta para o Perfil 1
  await storageService.setScope({ userId: 'user-alpha', profileId: 'profile-alpha-1' });
  const p1ItemsRestored = await storageService.getContinueWatching();
  assert.equal(p1ItemsRestored.length, 1);
  assert.equal(p1ItemsRestored[0].contentId, 'anime-one-piece');
  assert.equal(p1ItemsRestored[0].percentage, 31);
  console.log('✓ Cenário B aprovado: Perfis da mesma conta possuem históricos 100% independentes.');

  // =========================================================================
  // CENÁRIO C & D: Sincronização Cross-Device (PC -> TV e Mobile) com Turso
  // =========================================================================
  console.log('\n--- Cenário C & D: Sincronização Cross-Device com Turso (PC -> TV / Mobile) ---');

  // Simula que no PC o usuário assistiu "One Piece" até 720s (50%)
  const now = Date.now();
  mockPullData = {
    profileId: 'profile-alpha-1',
    serverTime: now,
    progress: [
      {
        id: 'remote-prog-1',
        profileId: 'profile-alpha-1',
        canonicalId: 'canonical-anime-one-piece',
        contentType: 'anime',
        season: 1,
        episode: 1,
        positionSec: 720,
        durationSec: 1440,
        progressPercent: 50,
        isCompleted: 0,
        version: 2,
        updatedAt: now + 5000 // Mais recente que o local
      }
    ],
    history: [
      {
        id: 'remote-hist-1',
        profileId: 'profile-alpha-1',
        canonicalId: 'canonical-anime-one-piece',
        contentType: 'anime',
        season: 1,
        episode: 1,
        title: 'One Piece (1999)',
        posterUrl: 'https://images.zapitv.stream/one-piece-poster.jpg',
        year: 1999,
        watchedAt: now + 5000,
        updatedAt: now + 5000,
        version: 2
      }
    ],
    myList: [],
    favorites: []
  };

  // Na Smart TV / Mobile, a hidratação remota é executada
  let progressEventFired = false;
  let receivedDetail: any = null;

  const onProgressUpdated = (event: any) => {
    progressEventFired = true;
    receivedDetail = event.detail;
  };
  mockWindow.addEventListener('zapitv_progress_updated', onProgressUpdated);

  await storageService.hydrateRemoteProfile('profile-alpha-1');

  // 1. Verifica se o evento reativo foi disparado para atualizar a interface sem F5
  assert.equal(
    progressEventFired,
    true,
    'Cenário F/C FALHOU: hydrateRemoteProfile não disparou o evento reativo zapitv_progress_updated!'
  );
  assert.equal(receivedDetail?.profileId, 'profile-alpha-1');

  // 2. Verifica se o progresso remoto atualizou o registro local
  const continuity = storageService.getPlaybackContinuity('canonical-anime-one-piece');
  assert.equal(continuity.hasStarted, true);
  assert.equal(continuity.season, 1);
  assert.equal(continuity.episode, 1);
  assert.equal(continuity.currentTime, 720, 'Tempo deve ser exatamente 720s');
  assert.equal(continuity.percentage, 50, 'Porcentagem deve ser 50%');

  // 3. Reconstrução Canônica de Metadados: o item DEVE conter título e pôster oficiais, não raw IDs
  const cwList = await storageService.getContinueWatching();
  const opItem = cwList.find(p => p.contentId === 'canonical-anime-one-piece' || p.item.canonicalId === 'canonical-anime-one-piece');
  assert.ok(opItem, 'Item deve constar em Continuar Assistindo');
  assert.equal(opItem.item.title, 'One Piece (1999)', 'Título canônico reconstruído a partir do histórico/catálogo');
  assert.equal(opItem.item.image, 'https://images.zapitv.stream/one-piece-poster.jpg', 'Pôster oficial reconstruído');
  console.log('✓ Cenário C & D aprovado: Sincronização PC -> TV/Mobile com restauração precisa e metadados canônicos.');

  // =========================================================================
  // CENÁRIO E: Logout e Alternância de Contas
  // =========================================================================
  console.log('\n--- Cenário E: Logout e Alternância de Contas ---');

  // Logout do usuário
  await storageService.setScope(null);
  const postLogoutCw = await storageService.getContinueWatching();
  // Quando deslogado, nenhum progresso do Perfil 1 deve estar na memória ativa
  const hasUserAlphaLeak = postLogoutCw.some(p => p.contentId === 'canonical-anime-one-piece');
  assert.equal(hasUserAlphaLeak, false, 'Cenário E FALHOU: Dados da conta deslogada permaneceram acessíveis');

  // Nova conta (Usuário Beta) faz login
  mockPullData = {
    profileId: 'profile-beta-1',
    serverTime: Date.now(),
    progress: [],
    history: [],
    myList: [],
    favorites: []
  };
  await storageService.setScope({ userId: 'user-beta', profileId: 'profile-beta-1' });
  const userBetaCw = await storageService.getContinueWatching();
  assert.equal(userBetaCw.length, 0, 'Cenário E FALHOU: Usuário Beta iniciou com itens de outro usuário');
  console.log('✓ Cenário E aprovado: Logout purga caches em memória e isola novas contas.');

  // =========================================================================
  // CENÁRIO G: Resolução de Conflitos e Fila Offline (LWW - Last-Write-Wins)
  // =========================================================================
  console.log('\n--- Cenário G: Resolução de Conflitos (Last-Write-Wins) ---');
  
  // Salva progresso local com timestamp T_antigo
  const tLocal = new Date('2026-10-29T10:00:00Z').toISOString();
  await storageService.saveProgress({
    contentId: 'filme-conflito',
    item: {
      id: 'filme-conflito',
      title: 'Filme Conflito',
      type: ContentType.MOVIE,
      mediaFormat: 'movie',
      rating: 8.0,
      year: 2024,
      image: 'https://test.com/conf.jpg'
    },
    currentTime: 1000,
    duration: 6000,
    percentage: 17,
    updatedAt: tLocal
  });

  // Chega do Turso um registro com timestamp T_recente (remoto mais novo ganha)
  const tRemoteNew = Date.parse('2026-10-29T11:00:00Z');
  mockPullData = {
    profileId: 'profile-beta-1',
    serverTime: Date.now(),
    progress: [
      {
        id: 'remote-prog-conf',
        profileId: 'profile-beta-1',
        canonicalId: 'filme-conflito',
        contentType: 'movie',
        season: 0,
        episode: 0,
        positionSec: 3000,
        durationSec: 6000,
        progressPercent: 50,
        isCompleted: 0,
        version: 3,
        updatedAt: tRemoteNew
      }
    ],
    history: [],
    myList: [],
    favorites: []
  };

  await storageService.hydrateRemoteProfile('profile-beta-1');
  const progAfterRemoteWins = storageService.resolveWatchProgress('filme-conflito');
  assert.equal(progAfterRemoteWins?.currentTime, 3000, 'Remoto mais recente deve prevalecer');
  assert.equal(progAfterRemoteWins?.percentage, 50);

  // Agora simula que local tem timestamp ainda mais recente (T_local_super > T_remote)
  const tLocalSuper = new Date('2026-10-29T12:00:00Z').toISOString();
  await storageService.saveProgress({
    contentId: 'filme-conflito',
    item: {
      id: 'filme-conflito',
      title: 'Filme Conflito',
      type: ContentType.MOVIE,
      mediaFormat: 'movie',
      rating: 8.0,
      year: 2024,
      image: 'https://test.com/conf.jpg'
    },
    currentTime: 4500,
    duration: 6000,
    percentage: 75,
    updatedAt: tLocalSuper
  });

  // Novo pull do Turso com o dado antigo de 11:00 não deve sobrescrever o local de 12:00
  await storageService.hydrateRemoteProfile('profile-beta-1');
  const progAfterLocalWins = storageService.resolveWatchProgress('filme-conflito');
  assert.equal(progAfterLocalWins?.currentTime, 4500, 'Local mais recente deve ser preservado contra dados remotos defasados');
  console.log('✓ Cenário G aprovado: Resolução determinística Last-Write-Wins respeita o timestamp mais recente.');

  // =========================================================================
  // CENÁRIO H: Conclusão de Episódio e Progressão Automática
  // =========================================================================
  console.log('\n--- Cenário H: Conclusão de Episódio (>= 92%) e Próximo Episódio ---');

  // Assiste episódio 1 até 96%
  await storageService.saveProgress({
    contentId: 'serie-progredida',
    item: {
      id: 'serie-progredida',
      canonicalId: 'canonical-serie-progredida',
      title: 'Série Progredida',
      type: ContentType.SERIES,
      mediaFormat: 'series',
      rating: 8.5,
      year: 2023,
      image: 'https://test.com/serie.jpg',
      seasonsCount: 2
    },
    season: 1,
    episode: 1,
    currentTime: 2900,
    duration: 3000,
    percentage: 97,
    updatedAt: new Date().toISOString()
  });

  // Continuidade deve sugerir Temporada 1 • Episódio 2
  const contNext = storageService.getPlaybackContinuity('canonical-serie-progredida', 2, 10);
  assert.equal(contNext.hasStarted, true);
  assert.equal(contNext.isCompleted, false);
  assert.equal(contNext.isNextEpisode, true, 'Deve indicar avanço automático para o próximo episódio');
  assert.equal(contNext.season, 1);
  assert.equal(contNext.episode, 2);
  assert.equal(contNext.currentTime, 0);
  assert.equal(contNext.actionText, 'Continuar assistindo');
  console.log('✓ Cenário H aprovado: Transição para próximo episódio precisa após conclusão do anterior.');

  mockWindow.removeEventListener('zapitv_progress_updated', onProgressUpdated);
  syncClient.pull = originalPull;

  console.log('\n========================================================================');
  console.log('🎉 TODOS OS CENÁRIOS (A, B, C, D, E, F, G, H) EXECUTADOS COM SUCESSO!');
  console.log('========================================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ ERRO NO TESTE DE CONTINUAR ASSISTINDO & SINCRONIZAÇÃO:', err);
  process.exit(1);
});
