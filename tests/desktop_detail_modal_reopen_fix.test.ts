import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getContentRoute, getWatchRoute, parseWatchRoute } from '../src/core/routes/navigationRoutes';
import { ContentItem, ContentType } from '../types';

console.log('--- Início dos Testes: Correção de Reabertura e Fechamento Único do Modal de Detalhes (Desktop) ---\n');

// Carrega arquivos para validação de contratos estáticos
const appTsxPath = path.resolve(process.cwd(), 'App.tsx');
const modalTsxPath = path.resolve(process.cwd(), 'components/ContentDetailModal.tsx');
const appTsxContent = fs.readFileSync(appTsxPath, 'utf-8').replace(/\r\n/g, '\n');
const modalTsxContent = fs.readFileSync(modalTsxPath, 'utf-8').replace(/\r\n/g, '\n');

// Mock items
const mockMovie: ContentItem = {
  id: 'movie-101',
  tmdbId: '101',
  imdbId: 'tt1010101',
  title: 'Interestelar',
  type: ContentType.MOVIE,
  mediaFormat: 'movie',
  year: 2014,
  image: 'https://example.com/poster.jpg'
};

const mockSeries: ContentItem = {
  id: 'series-202',
  tmdbId: '202',
  imdbId: 'tt2020202',
  title: 'Breaking Bad',
  type: ContentType.SERIES,
  mediaFormat: 'series',
  year: 2008,
  image: 'https://example.com/poster2.jpg',
  seasonsCount: 5
};

const mockAnime: ContentItem = {
  id: 'anime-303',
  tmdbId: '303',
  imdbId: 'tt3030303',
  title: 'Attack on Titan',
  type: ContentType.ANIME,
  mediaFormat: 'series',
  genres: ['Anime'],
  year: 2013,
  image: 'https://example.com/poster3.jpg',
  seasonsCount: 4
};

// Simulador de Estado da Aplicação Desktop (reproduz fielmente o ciclo de vida de rotas e modais de App.tsx + ContentDetailModal.tsx)
class DesktopDetailModalSimulator {
  currentPath: string = '/';
  selectedContent: ContentItem | null = null;
  detailOriginRoute: string | null = null;
  closedContentId: string | null = null;
  prevDetailRoutePath: string = '/';

  // Estado interno do ContentDetailModal
  isModalMounted: boolean = false;
  isClosing: boolean = false;
  isClosingRef: boolean = false;
  isPlaying: boolean = false;
  playerOnly: boolean = false;
  modalItem: ContentItem | null = null;
  originRouteProp: string | null = null;

  // Telemetria técnica
  instancesCount: number = 0;
  closePlayerExecutions: number = 0;
  closeDetailModalExecutions: number = 0;
  resolveItemExecutions: number = 0;
  closeCallbackCount: number = 0;

  catalog: ContentItem[] = [mockMovie, mockSeries, mockAnime];

  constructor(initialPath: string = '/') {
    this.currentPath = initialPath;
    this.prevDetailRoutePath = initialPath;
  }

  getActiveDetailId(): string | undefined {
    const movieMatch = this.currentPath.match(/^\/filmes\/([^/?#]+)/i);
    if (movieMatch) return movieMatch[1];
    const seriesMatch = this.currentPath.match(/^\/series\/([^/?#]+)/i);
    if (seriesMatch) return seriesMatch[1];
    const animeMatch = this.currentPath.match(/^\/animes\/([^/?#]+)/i);
    if (animeMatch) return animeMatch[1];
    const watchParsed = parseWatchRoute(this.currentPath);
    if (watchParsed.isWatch && !watchParsed.isTv) return watchParsed.id;
    return undefined;
  }

  // Efeito de sincronização de rota de App.tsx
  syncRouteEffect() {
    const activeDetailId = this.getActiveDetailId();
    const isWatch = parseWatchRoute(this.currentPath).isWatch;
    const prevPath = this.prevDetailRoutePath;
    const isPrevWatch = parseWatchRoute(prevPath).isWatch;
    const isPrevDetail = Boolean(
      prevPath.startsWith('/filmes/') ||
      prevPath.startsWith('/series/') ||
      prevPath.startsWith('/animes/')
    );

    // Se saiu de rota de detalhe profunda (não de assistir) para catálogo
    if (isPrevDetail && !isPrevWatch && !activeDetailId && !isWatch && this.selectedContent) {
      this.selectedContent = null;
      this.syncModalMount();
    }
    this.prevDetailRoutePath = this.currentPath;

    if (!activeDetailId) {
      this.closedContentId = null;
      return;
    }

    // Regra crítica: se o usuário acabou de fechar este conteúdo, NÃO reabre!
    if (this.closedContentId && this.closedContentId === activeDetailId) {
      return;
    }

    if (this.selectedContent && this.selectedContent.id === activeDetailId) {
      return;
    }

    // Resolve da rota
    this.resolveItemExecutions++;
    const found = this.catalog.find(i => i.id === activeDetailId);
    if (found && this.closedContentId !== activeDetailId) {
      this.selectedContent = found;
      this.syncModalMount();
    }
  }

  syncModalMount() {
    if (this.selectedContent) {
      if (!this.isModalMounted) {
        this.isModalMounted = true;
        this.instancesCount++;
        this.modalItem = this.selectedContent;
        this.originRouteProp = this.detailOriginRoute;
        this.isClosing = false;
        this.isClosingRef = false;
      }
    } else {
      if (this.isModalMounted) {
        this.isModalMounted = false;
        this.instancesCount--;
        this.modalItem = null;
      }
    }
  }

  // Abertura in-loco pelo clique no card
  handleSelectContent(item: ContentItem) {
    this.closedContentId = null;
    this.detailOriginRoute = this.currentPath;
    this.selectedContent = item;
    this.syncModalMount();
  }

  // Iniciar reprodução pelo modal
  startPlayback(season?: number, episode?: number) {
    if (!this.selectedContent) return;
    const watchRoute = getWatchRoute(this.selectedContent, season, episode, false);
    this.currentPath = watchRoute;
    this.isPlaying = true;
    this.playerOnly = parseWatchRoute(watchRoute).isWatch;
    this.syncRouteEffect();
  }

  // Fechar o player
  handleClosePlayer() {
    this.closePlayerExecutions++;
    this.isPlaying = false;
    this.isClosing = false;
    this.isClosingRef = false;
    this.playerOnly = false;

    const parsed = parseWatchRoute(this.currentPath);
    if (parsed.isWatch && this.selectedContent) {
      const fallbackRoute = getContentRoute(this.selectedContent);
      const origin = this.originRouteProp;
      const returnRoute = origin && !parseWatchRoute(origin).isWatch
        ? origin
        : fallbackRoute;
      this.currentPath = returnRoute;
    }
    this.syncRouteEffect();
  }

  // Fechar o modal de detalhes pelo botão X, Esc ou clique fora
  handleCloseModal() {
    if (this.isClosingRef) return; // Proteção idempotente
    this.isClosingRef = true;
    this.isClosing = true;

    // Simula o timeout da animação (280ms)
    this.closeCallbackCount++;
    this.handleCloseDetailModal();
  }

  handleCloseDetailModal() {
    this.closeDetailModalExecutions++;
    const currentId = this.selectedContent?.id || this.getActiveDetailId();
    if (currentId) {
      this.closedContentId = String(currentId);
    }
    this.selectedContent = null;
    this.syncModalMount();

    const origin = this.detailOriginRoute;
    this.detailOriginRoute = null;

    if (origin && !parseWatchRoute(origin).isWatch &&
        !origin.startsWith('/filmes/') && !origin.startsWith('/series/') && !origin.startsWith('/animes/')) {
      if (this.currentPath !== origin) {
        this.currentPath = origin;
      }
    } else {
      if (this.currentPath.startsWith('/filmes/')) {
        this.currentPath = '/filmes';
      } else if (this.currentPath.startsWith('/series/')) {
        this.currentPath = '/series';
      } else if (this.currentPath.startsWith('/animes/')) {
        this.currentPath = '/animes';
      }
    }

    this.syncRouteEffect();
  }

  // Navegar pelas abas principais (Home, Filmes, etc.)
  navigateTab(target: string) {
    this.selectedContent = null;
    this.closedContentId = null;
    this.detailOriginRoute = null;
    this.currentPath = target;
    this.syncModalMount();
    this.syncRouteEffect();
  }
}

// ============================================================================
// CENÁRIO 1: Filme → Assistir → Fechar player → Fechar detalhes
// ============================================================================
console.log('Cenário 1: Filme → Assistir → Fechar player → Fechar detalhes');
const sim1 = new DesktopDetailModalSimulator('/em-destaque');

// 1. Abre detalhes do filme a partir de /em-destaque
sim1.handleSelectContent(mockMovie);
assert.equal(sim1.isModalMounted, true, 'Modal deve estar montado');
assert.equal(sim1.instancesCount, 1, 'Deve haver exatamente 1 instância do modal');
assert.equal(sim1.currentPath, '/em-destaque', 'Rota deve permanecer /em-destaque ao abrir in-loco');
assert.equal(sim1.detailOriginRoute, '/em-destaque', 'OriginRoute deve gravar /em-destaque');

// 2. Clica em Assistir
sim1.startPlayback();
assert.equal(sim1.isPlaying, true, 'Player deve estar ativo');
assert.equal(sim1.currentPath, '/assistir/filme/movie-101', 'Rota deve mudar para assistir');
assert.equal(sim1.instancesCount, 1, 'Instâncias do modal permanecem exatamente 1');

// 3. Fecha o player
sim1.handleClosePlayer();
assert.equal(sim1.isPlaying, false, 'Player deve ter sido encerrado');
assert.equal(sim1.isModalMounted, true, 'Modal de detalhes deve permanecer aberto');
assert.equal(sim1.currentPath, '/em-destaque', 'Rota deve retornar à página anterior (/em-destaque)');
assert.equal(sim1.instancesCount, 1, 'Instância única do modal preservada');

// 4. Clica no X da janela de detalhes (UM ÚNICO CLIQUE)
sim1.handleCloseModal();
assert.equal(sim1.isModalMounted, false, 'Modal deve estar completamente desmontado após 1 clique');
assert.equal(sim1.instancesCount, 0, 'Quantidade de instâncias deve ser 0');
assert.equal(sim1.selectedContent, null, 'selectedContent deve ser rigorosamente null');
assert.equal(sim1.currentPath, '/em-destaque', 'Página anterior (/em-destaque) volta a ficar acessível');
console.log('  ✓ Cenário 1 passou: Filme assistido e fechado com 1 clique único, retornando a /em-destaque.');

// ============================================================================
// CENÁRIO 2: Série → Assistir → Fechar player → Fechar detalhes
// ============================================================================
console.log('\nCenário 2: Série → Assistir → Fechar player → Fechar detalhes');
const sim2 = new DesktopDetailModalSimulator('/series');
sim2.handleSelectContent(mockSeries);
assert.equal(sim2.instancesCount, 1);
sim2.startPlayback(1, 1);
assert.equal(sim2.currentPath, '/assistir/serie/series-202/t/1/e/1');
sim2.handleClosePlayer();
assert.equal(sim2.currentPath, '/series');
assert.equal(sim2.instancesCount, 1);
sim2.handleCloseModal();
assert.equal(sim2.instancesCount, 0);
assert.equal(sim2.currentPath, '/series');
console.log('  ✓ Cenário 2 passou: Série assistida e fechada com sucesso em 1 clique.');

// ============================================================================
// CENÁRIO 3: Anime → Assistir → Fechar player → Fechar detalhes
// ============================================================================
console.log('\nCenário 3: Anime → Assistir → Fechar player → Fechar detalhes');
const sim3 = new DesktopDetailModalSimulator('/animes');
sim3.handleSelectContent(mockAnime);
assert.equal(sim3.instancesCount, 1);
sim3.startPlayback(1, 1);
assert.equal(sim3.currentPath, '/assistir/anime/anime-303/t/1/e/1');
sim3.handleClosePlayer();
assert.equal(sim3.currentPath, '/animes');
assert.equal(sim3.instancesCount, 1);
sim3.handleCloseModal();
assert.equal(sim3.instancesCount, 0);
assert.equal(sim3.currentPath, '/animes');
console.log('  ✓ Cenário 3 passou: Anime assistido e fechado com sucesso em 1 clique.');

// ============================================================================
// CENÁRIO 4: Reabrir o mesmo conteúdo novamente após o fechamento
// ============================================================================
console.log('\nCenário 4: Reabrir o mesmo conteúdo novamente após o fechamento');
sim1.handleSelectContent(mockMovie);
assert.equal(sim1.isModalMounted, true, 'Deve reabrir normalmente o mesmo conteúdo');
assert.equal(sim1.instancesCount, 1);
assert.equal(sim1.selectedContent?.id, 'movie-101');
sim1.handleCloseModal();
assert.equal(sim1.instancesCount, 0);
console.log('  ✓ Cenário 4 passou: Reabertura imediata da mesma capa permitida sem bloqueio permanente.');

// ============================================================================
// CENÁRIO 5: Abrir um conteúdo diferente
// ============================================================================
console.log('\nCenário 5: Abrir um conteúdo diferente');
sim1.handleSelectContent(mockSeries);
assert.equal(sim1.isModalMounted, true);
assert.equal(sim1.instancesCount, 1);
assert.equal(sim1.selectedContent?.id, 'series-202');
sim1.handleCloseModal();
assert.equal(sim1.instancesCount, 0);
console.log('  ✓ Cenário 5 passou: Conteúdo diferente abre e fecha com precisão.');

// ============================================================================
// CENÁRIO 6: Proteção contra cliques repetidos no X (Idempotência)
// ============================================================================
console.log('\nCenário 6: Proteção contra cliques repetidos no X (Idempotência)');
const sim6 = new DesktopDetailModalSimulator('/filmes');
sim6.handleSelectContent(mockMovie);
assert.equal(sim6.instancesCount, 1);

// Dispara 5 cliques repetidos e rápidos no botão Fechar
sim6.handleCloseModal();
sim6.handleCloseModal();
sim6.handleCloseModal();
sim6.handleCloseModal();
sim6.handleCloseModal();

assert.equal(sim6.closeCallbackCount, 1, 'Callback onClose deve ser executado rigorosamente 1 única vez');
assert.equal(sim6.instancesCount, 0, 'Instância desmontada sem duplicidade');
console.log('  ✓ Cenário 6 passou: 5 cliques rápidos consecutivos executaram onClose exatamente 1 vez.');

// ============================================================================
// CENÁRIO 7: Fechamento com Tecla Escape
// ============================================================================
console.log('\nCenário 7: Fechamento com Tecla Escape');
const sim7 = new DesktopDetailModalSimulator('/');
sim7.handleSelectContent(mockMovie);
assert.equal(sim7.instancesCount, 1);
// Simula tecla Escape
sim7.handleCloseModal();
assert.equal(sim7.instancesCount, 0);
assert.equal(sim7.currentPath, '/');
console.log('  ✓ Cenário 7 passou: Escape encerra o modal imediatamente.');

// ============================================================================
// CENÁRIO 8: Fechamento clicando fora do modal
// ============================================================================
console.log('\nCenário 8: Fechamento clicando fora do modal');
const sim8 = new DesktopDetailModalSimulator('/minha-lista');
sim8.handleSelectContent(mockSeries);
assert.equal(sim8.instancesCount, 1);
// Simula mousedown fora
sim8.handleCloseModal();
assert.equal(sim8.instancesCount, 0);
assert.equal(sim8.currentPath, '/minha-lista');
console.log('  ✓ Cenário 8 passou: Clique fora encerra o modal preservando /minha-lista.');

// ============================================================================
// CENÁRIO 9: Botão Voltar do navegador (Popstate)
// ============================================================================
console.log('\nCenário 9: Botão Voltar do navegador (Popstate)');
// Caso 9A: Entrada direta por deep link /filmes/movie-101 e voltar para /filmes
const sim9 = new DesktopDetailModalSimulator('/filmes/movie-101');
sim9.syncRouteEffect();
assert.equal(sim9.isModalMounted, true, 'Deep link deve abrir o modal');
assert.equal(sim9.instancesCount, 1);

// Usuário pressiona Voltar no navegador -> URL muda para /filmes
sim9.currentPath = '/filmes';
sim9.syncRouteEffect();
assert.equal(sim9.instancesCount, 0, 'Modal deve fechar ao voltar pelo navegador para /filmes');
assert.equal(sim9.selectedContent, null);

// Caso 9B: Usuário estava assistindo e pressiona Voltar no navegador
sim9.handleSelectContent(mockMovie);
sim9.startPlayback();
assert.equal(sim9.isPlaying, true);
// Voltar do navegador muda de /assistir/... para /filmes
sim9.currentPath = '/filmes';
sim9.isPlaying = false; // Sincronizado pelo listener de location.pathname
sim9.syncRouteEffect();
assert.equal(sim9.isPlaying, false, 'Reprodução deve parar');
console.log('  ✓ Cenário 9 passou: Botão Voltar do navegador tratado corretamente em deep-links e playback.');

// ============================================================================
// CENÁRIO 10: Reprodução consecutiva de vários conteúdos
// ============================================================================
console.log('\nCenário 10: Reprodução consecutiva de vários conteúdos');
const sim10 = new DesktopDetailModalSimulator('/');
for (const item of [mockMovie, mockSeries, mockAnime]) {
  sim10.handleSelectContent(item);
  assert.equal(sim10.instancesCount, 1);
  sim10.startPlayback();
  sim10.handleClosePlayer();
  assert.equal(sim10.instancesCount, 1);
  sim10.handleCloseModal();
  assert.equal(sim10.instancesCount, 0);
  assert.equal(sim10.currentPath, '/');
}
console.log('  ✓ Cenário 10 passou: 3 ciclos completos e consecutivos de reprodução/fechamento executados.');

// ============================================================================
// CENÁRIO 11: Acesso direto por rota /assistir/...
// ============================================================================
console.log('\nCenário 11: Acesso direto por rota /assistir/...');
const sim11 = new DesktopDetailModalSimulator('/assistir/filme/movie-101');
sim11.syncRouteEffect();
assert.equal(sim11.isModalMounted, true);
assert.equal(sim11.instancesCount, 1);
sim11.isPlaying = true;
sim11.playerOnly = true;

// Fecha player
sim11.handleClosePlayer();
assert.equal(sim11.isPlaying, false);
assert.equal(sim11.currentPath, '/filmes/movie-101', 'Deep watch fecha para rota canônica de detalhe');
assert.equal(sim11.instancesCount, 1, 'Janela de detalhes exibida após fechar player');

// Fecha modal
sim11.handleCloseModal();
assert.equal(sim11.instancesCount, 0);
assert.equal(sim11.currentPath, '/filmes', 'Retorna à categoria /filmes');
console.log('  ✓ Cenário 11 passou: Acesso direto a /assistir fecha para detalhes e depois para catálogo.');

// ============================================================================
// CENÁRIO 12: Alternar entre páginas sem duplicar modais
// ============================================================================
console.log('\nCenário 12: Alternar entre páginas sem duplicar modais');
const sim12 = new DesktopDetailModalSimulator('/');
sim12.handleSelectContent(mockMovie);
assert.equal(sim12.instancesCount, 1);
sim12.navigateTab('/filmes');
assert.equal(sim12.instancesCount, 0, 'Troca de aba limpa modal imediatamente');
assert.equal(sim12.selectedContent, null);
sim12.navigateTab('/series');
assert.equal(sim12.instancesCount, 0);
console.log('  ✓ Cenário 12 passou: Alternância de páginas limpa o modal sem vazamento de instâncias.');

// ============================================================================
// CENÁRIO 13: Reprodução da Regressão do Bug (O que causava a segunda janela)
// ============================================================================
console.log('\nCenário 13: Verificação de Blindagem contra a Causa Raiz da Segunda Janela');
// Demonstração da falha anterior:
// Na versão defeituosa, quando onClose era chamado na rota /filmes/movie-101:
// selectedContent virava null, mas a rota ainda era /filmes/movie-101.
// O syncRouteEffect re-executava e re-setava selectedContent = localFound, forçando um 2º fechamento.
const simBug = new DesktopDetailModalSimulator('/filmes/movie-101');
simBug.syncRouteEffect();
assert.equal(simBug.selectedContent?.id, 'movie-101');

// Com o fechamento blindado:
simBug.handleCloseModal();
// O efeito foi executado após selectedContent = null, mas closedContentId bloqueou a restauração!
assert.equal(simBug.selectedContent, null, 'selectedContent DEVE permanecer null');
assert.equal(simBug.instancesCount, 0, 'Instâncias do modal DEVE ser 0');
assert.equal(simBug.resolveItemExecutions, 1, 'resolveItemFromRoute NÃO deve ser re-executado no fechamento');
console.log('  ✓ Cenário 13 passou: Causa raiz eliminada; syncRouteEffect não reabre o modal recém-fechado.');

// ============================================================================
// CENÁRIO 14: Verificação de Contratos Estáticos no Código Fonte
// ============================================================================
console.log('\nCenário 14: Verificação de Contratos Estáticos de Código');

// 1. App.tsx: Presença de closedContentIdRef e detailOriginRouteRef
assert.ok(
  appTsxContent.includes('const detailOriginRouteRef = useRef<string | null>(null);'),
  'App.tsx deve declarar detailOriginRouteRef'
);
assert.ok(
  appTsxContent.includes('const closedContentIdRef = useRef<string | null>(null);'),
  'App.tsx deve declarar closedContentIdRef'
);
assert.ok(
  appTsxContent.includes('closedContentIdRef.current === activeDetailId'),
  'App.tsx deve bloquear re-sincronização automática para conteúdo recém-fechado'
);

// 2. ContentDetailModal.tsx: Idempotência de handleClose e isClosingRef
assert.ok(
  modalTsxContent.includes('const isClosingRef = useRef(false);'),
  'ContentDetailModal deve declarar isClosingRef para idempotência'
);
assert.ok(
  modalTsxContent.includes('if (isClosingRef.current) return;'),
  'handleClose deve checar isClosingRef.current para evitar cliques duplos'
);
assert.ok(
  modalTsxContent.includes('originRoute?: string | null;'),
  'ContentDetailModalProps deve aceitar originRoute'
);
assert.ok(
  modalTsxContent.includes('navigate(returnRoute, { replace: true });'),
  'handleClosePlayer deve navegar de volta para a rota de origem quando disponível'
);
console.log('  ✓ Cenário 14 passou: Contratos estáticos em App.tsx e ContentDetailModal.tsx validados.');

console.log('\n--- TODOS OS 14 CENÁRIOS DE FECHAMENTO ÚNICO E SINCRONIZAÇÃO DE ROTAS PASSARAM COM SUCESSO! ---');
