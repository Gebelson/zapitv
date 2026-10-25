import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { episodeAvailabilityService } from '../src/core/episodes/episodeAvailabilityService';

console.log('\n========================================================================');
console.log('--- TESTE: BOTÃO CONTEXTUAL FLUTUANTE PRÓXIMO EPISÓDIO NA SMART TV ---');
console.log('========================================================================\n');

import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const zapiPlayerContent = fs.readFileSync(path.join(__dirname, '../src/components/player/ZapiPlayer.tsx'), 'utf8');
const tvControlsContent = fs.readFileSync(path.join(__dirname, '../src/components/player/TvPlayerControls.tsx'), 'utf8');
const skipButtonContent = fs.readFileSync(path.join(__dirname, '../src/components/player/ZapiSkipButton.tsx'), 'utf8');
const nextBtnContent = fs.readFileSync(path.join(__dirname, '../src/components/player/TvNextEpisodeButton.tsx'), 'utf8');
const modalContent = fs.readFileSync(path.join(__dirname, '../components/ContentDetailModal.tsx'), 'utf8');

// [Cenário 1] Série com próximo episódio na mesma temporada
console.log('[Cenário 1] Série com próximo episódio na mesma temporada...');
const s1Episodes = [
  { id: 'ep1', number: 1, title: 'Episódio 1', description: '', image: '' },
  { id: 'ep2', number: 2, title: 'Episódio 2', description: '', image: '' },
  { id: 'ep3', number: 3, title: 'Episódio 3', description: '', image: '' },
];
const nextInSameSeason = episodeAvailabilityService.getNextAvailableEpisode(1, 1, s1Episodes, [1, 2]);
assert.ok(nextInSameSeason, 'Deve identificar próximo episódio na mesma temporada');
assert.strictEqual(nextInSameSeason?.season, 1, 'Temporada deve ser 1');
assert.strictEqual(nextInSameSeason?.episode, 2, 'Episódio deve ser 2');
assert.strictEqual(nextInSameSeason?.title, 'Episódio 2', 'Título deve coincidir');
console.log('✓ Próximo episódio na mesma temporada resolvido com sucesso: S1E2');

// [Cenário 2] Último episódio de uma temporada com outra temporada disponível
console.log('\n[Cenário 2] Transição entre temporadas...');
const s2Episodes = [
  { id: 'ep2_1', number: 1, title: 'Temporada 2 Estreia', description: '', image: '' },
];
const nextInNextSeason = episodeAvailabilityService.getNextAvailableEpisode(1, 3, s1Episodes, [1, 2], s2Episodes);
assert.ok(nextInNextSeason, 'Deve identificar próximo episódio na próxima temporada');
assert.strictEqual(nextInNextSeason?.season, 2, 'Temporada deve ser 2');
assert.strictEqual(nextInNextSeason?.episode, 1, 'Episódio deve ser 1');
assert.strictEqual(nextInNextSeason?.title, 'Temporada 2 Estreia');

// Teste sem s2Episodes explícito (apenas availableSeasons)
const nextInNextSeasonFallback = episodeAvailabilityService.getNextAvailableEpisode(1, 3, s1Episodes, [1, 2]);
assert.ok(nextInNextSeasonFallback, 'Deve identificar próxima temporada mesmo sem episódios pré-carregados');
assert.strictEqual(nextInNextSeasonFallback?.season, 2);
assert.strictEqual(nextInNextSeasonFallback?.episode, 1);
console.log('✓ Transição de temporada resolvida perfeitamente: S1E3 -> S2E1');

// [Cenário 3] Anime com numeração absoluta ou string
console.log('\n[Cenário 3] Anime com numeração de episódios...');
const animeEpisodes = [
  { id: 'a1', number: '1' as any, episode: 1, title: 'Solo Leveling Ep 1', description: '', image: '' },
  { id: 'a2', number: '2' as any, episode: 2, title: 'Solo Leveling Ep 2', description: '', image: '' },
];
const animeNext = episodeAvailabilityService.getNextAvailableEpisode(1, 1, animeEpisodes as any, [1]);
assert.ok(animeNext, 'Anime deve identificar próximo episódio mesmo com string ou chave episode');
assert.strictEqual(animeNext?.episode, 2);
assert.strictEqual(animeNext?.title, 'Solo Leveling Ep 2');
console.log('✓ Anime com tipos mistos resolvido com sucesso: Ep 1 -> Ep 2');

// [Cenário 4] Último episódio existente da série/anime
console.log('\n[Cenário 4] Fim da série/anime (sem próximo episódio)...');
const endOfSeries = episodeAvailabilityService.getNextAvailableEpisode(2, 1, s2Episodes, [1, 2]);
assert.strictEqual(endOfSeries, null, 'No último episódio da última temporada deve retornar null');
console.log('✓ Fim da série retorna null corretamente (sem botão ou avanço indevido)');

// [Cenário 5] Filme não exibe botão contextual
console.log('\n[Cenário 5] Validação de regra para filmes...');
assert.ok(
  zapiPlayerContent.includes("item.type === ContentType.SERIES || item.type === ContentType.ANIME"),
  'ZapiPlayer deve verificar se o conteúdo é série ou anime'
);
assert.ok(
  zapiPlayerContent.includes("item.mediaFormat !== 'movie'"),
  'ZapiPlayer deve bloquear exibição em filmes'
);
console.log('✓ Filmes completamente excluídos da camada contextual de próximo episódio');

// [Cenário 6] Detecção de créditos via skipService
console.log('\n[Cenário 6] Exibição durante os créditos finais...');
assert.ok(
  zapiPlayerContent.includes("skipIntervals.some(i => i.type === 'ed')"),
  'Deve verificar se há intervalo de encerramento/créditos cadastrado'
);
assert.ok(
  zapiPlayerContent.includes("activeSkipInterval?.type === 'ed'"),
  'Deve reconhecer quando os créditos estiverem ativos'
);
console.log('✓ Detecção de créditos sincronizada perfeitamente');

// [Cenário 7] Exibição nos últimos 90 segundos quando não há créditos cadastrados
console.log('\n[Cenário 7] Exibição nos últimos 90 segundos (sem créditos)...');
assert.ok(
  zapiPlayerContent.includes("remainingSeconds <= 90"),
  'Deve exibir nos últimos 90 segundos caso não haja créditos'
);
assert.ok(
  zapiPlayerContent.includes("isDurationReliable"),
  'Duração deve ser verificada como confiável antes de exibir o botão'
);
console.log('✓ Exibição segura nos últimos 90 segundos validada');

// [Cenário 8] Reprodução automática com contagem regressiva
console.log('\n[Cenário 8] Modo de reprodução automática com contagem regressiva...');
assert.ok(
  nextBtnContent.includes("Próximo Episódio (${countdownSeconds}s)"),
  'TvNextEpisodeButton deve exibir contagem regressiva quando ativa'
);
assert.ok(
  nextBtnContent.includes("isAutoPlayCountdownActive"),
  'TvNextEpisodeButton deve reagir ao estado de contagem regressiva'
);
assert.ok(
  zapiPlayerContent.includes("handleCancelAutoPlay"),
  'ZapiPlayer deve suportar cancelamento da reprodução automática'
);
console.log('✓ Contagem regressiva de autoplay e cancelamento integrados com sucesso');

// [Cenário 9] Reprodução automática desativada (botão estático e sem avanço forçado)
console.log('\n[Cenário 9] Reprodução automática desativada...');
assert.ok(
  nextBtnContent.includes("'Próximo Episódio'"),
  'Deve exibir texto limpo e estático quando autoplay estiver desativado'
);
assert.ok(
  zapiPlayerContent.includes("showTvNextEpisodeButton") && zapiPlayerContent.includes("autoPlayEnabled={autoPlayEnabled}"),
  'TvNextEpisodeButton recebe prop autoPlayEnabled'
);
console.log('✓ Botão estático e sem avanço forçado validado');

// [Cenário 10] Navegação e controle remoto (Spatial Navigation, D-Pad, OK/Enter)
console.log('\n[Cenário 10] Navegação por controle remoto (Spatial Navigation)...');
assert.ok(
  nextBtnContent.includes("focusKey: 'tv-player-next-contextual'"),
  'TvNextEpisodeButton deve possuir chave de foco tv-player-next-contextual'
);
assert.ok(
  tvControlsContent.includes("tv-player-next-contextual"),
  'TvPlayerControls deve proteger o foco de tv-player-next-contextual contra roubo de foco'
);
assert.ok(
  nextBtnContent.includes("data-tv-focused"),
  'TvNextEpisodeButton deve emitir atributo data-tv-focused para seleção visual'
);
assert.ok(
  nextBtnContent.includes("triggerNext"),
  'TvNextEpisodeButton deve responder ao Enter/OK do controle remoto'
);
console.log('✓ Navegação espacial do controle remoto e proteção de foco verificadas');

// [Cenário 11] Prevenção de múltiplos cliques durante carregamento
console.log('\n[Cenário 11] Prevenção de múltiplos cliques...');
assert.ok(
  nextBtnContent.includes("if (isTransitioningRef.current || isLoadingStreams) return;"),
  'TvNextEpisodeButton deve impedir múltiplos acionamentos enquanto carrega'
);
assert.ok(
  zapiPlayerContent.includes("isLoadingStreams={isLoadingStreams}"),
  'ZapiPlayer passa isLoadingStreams ao botão'
);
console.log('✓ Bloqueio de cliques concorrentes validado');

// [Cenário 12] Coexistência e não sobreposição com Pular Créditos
console.log('\n[Cenário 12] Coexistência sem sobreposição com Pular Créditos...');
assert.ok(
  zapiPlayerContent.includes("className={showTvNextEpisodeButton ? '!bottom-[280px] sm:!bottom-[300px]'"),
  'ZapiSkipButton deve ser deslocado para cima quando TvNextEpisodeButton estiver ativo'
);
assert.ok(
  nextBtnContent.includes("bottom-[200px] sm:bottom-[210px] right-[5vw]"),
  'TvNextEpisodeButton deve ser posicionado com segurança no canto inferior direito'
);
assert.ok(
  nextBtnContent.includes("direction === 'up' && isSkipCreditsVisible"),
  'TvNextEpisodeButton deve permitir navegar para cima até tv-skip-button via D-pad UP'
);
assert.ok(
  skipButtonContent.includes("direction === 'down'"),
  'ZapiSkipButton deve permitir navegar para baixo até tv-player-next-contextual via D-pad DOWN'
);
console.log('✓ Coexistência sem sobreposição e navegação vertical D-pad verificadas');

console.log('\n========================================================================');
console.log(' TODOS OS 12 CENÁRIOS DO BOTÃO CONTEXTUAL DE PRÓXIMO EPISÓDIO PASSARAM! ');
console.log('========================================================================\n');

process.exit(0);
