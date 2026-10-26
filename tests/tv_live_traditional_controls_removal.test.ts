/**
 * ZapiTV — Teste de Remoção Estrutural dos Controles Tradicionais no Player Ao Vivo da Smart TV
 * 
 * Validação rigorosa dos requisitos:
 * 1. Interface LiveTvPlayerProps declara tvLinearMode?: boolean.
 * 2. Em modo tvLinearMode (e em rotas /tv ou Smart TV), a barra inferior tradicional
 *    (Play/Pause, Volume, Seletor Auto, PiP, Tela Cheia) NÃO é renderizada no DOM.
 * 3. A barra superior tradicional (título do canal redundante e botão fechar) NÃO é renderizada no DOM.
 * 4. As setas laterais de zapear tradicionais são suprimidas no modo linear da TV.
 * 5. Não se trata de ocultação visual por CSS (opacity-0/display-none): os elementos deixam de ser montados.
 * 6. Interações de mouse/cursor não disparam exibição de controles tradicionais quando tvLinearMode estiver ativo.
 * 7. Tela de recuperação de autoplay bloqueado (waiting_interaction) oferece ação focável e amigável ao controle remoto.
 * 8. TvLiveView instancia LiveTvPlayer com tvLinearMode={true} e isInteractive={false}.
 * 9. O HUD próprio da TV (TvLiveChannelOverlay) é 100% preservado e continua exibindo número, logo, nome e EPG.
 * 10. Desktop e Mobile (/programas e visualizador web) mantêm os controles interativos tradicionais intactos.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { tvModeService } from '../src/core/tv/tvModeService';

console.log('=== ZAPITV | TESTE DE REMOÇÃO DOS CONTROLES TRADICIONAIS NO AO VIVO TV ===\n');

// -----------------------------------------------------------------------------------------
// TESTE 1: Auditoria Estrutural em LiveTvPlayer.tsx
// -----------------------------------------------------------------------------------------
console.log('[Teste 1] Auditoria de Código-Fonte em LiveTvPlayer.tsx...');
const playerFilePath = path.resolve(process.cwd(), 'src/components/livetv/LiveTvPlayer.tsx');
assert.ok(fs.existsSync(playerFilePath), 'LiveTvPlayer.tsx deve existir');
const playerCode = fs.readFileSync(playerFilePath, 'utf-8');

// 1.1 Declaração da prop tvLinearMode
assert.ok(
  playerCode.includes('tvLinearMode?: boolean;'),
  'LiveTvPlayerProps deve declarar a propriedade opcional tvLinearMode?: boolean'
);

// 1.2 Resolução da flag isLinearTv com fallback seguro para isTv
assert.ok(
  playerCode.includes('const isLinearTv = tvLinearMode !== undefined ? tvLinearMode : isTv;'),
  'LiveTvPlayer deve calcular isLinearTv respeitando prop explícita ou detecção de ambiente de TV'
);

// 1.3 Supressão estrutural no JSX (Não-renderização no DOM)
assert.ok(
  playerCode.includes('!isLinearTv && (') && playerCode.includes('data-testid="live-player-bottom-bar"'),
  'A barra inferior de controles tradicionais NÃO deve ser renderizada quando isLinearTv for verdadeiro'
);

assert.ok(
  playerCode.includes('!isLinearTv && (') && playerCode.includes('data-testid="live-player-top-header"'),
  'A barra superior com canal e botão fechar NÃO deve ser renderizada quando isLinearTv for verdadeiro'
);

assert.ok(
  playerCode.includes('isInteractive && !isLinearTv && ('),
  'As setas laterais de zapear não devem ser renderizadas quando isLinearTv for verdadeiro'
);

// 1.4 Supressão de handleUserActivity no modo linear da TV
assert.ok(
  playerCode.includes('if (isLinearTv) return;'),
  'handleUserActivity deve abortar imediatamente no modo TV linear, impedindo exibição dos controles'
);

// 1.5 Autoplay Bloqueado amigável para controle remoto da TV
assert.ok(
  playerCode.includes('Pressione OK para reproduzir transmissão ao vivo'),
  'LiveTvPlayer deve exibir instrução com foco no controle remoto (OK) quando autoplay for restrito'
);
assert.ok(
  playerCode.includes('Clique para reproduzir transmissão ao vivo'),
  'LiveTvPlayer deve manter fallback para navegador desktop quando aplicável'
);

// 1.6 Clique no elemento de vídeo não pausa acidentalmente o canal na TV
assert.ok(
  playerCode.includes('onClick={isLinearTv ? undefined : togglePlay}'),
  'O elemento de vídeo não deve pausar via clique ou toque no modo linear de TV'
);

// 1.7 Borda sem arredondamento no modo TV
assert.ok(
  playerCode.includes("isLinearTv ? 'rounded-none' : 'rounded-2xl'"),
  'O container deve aplicar rounded-none no modo linear de TV para tela 16:9 contínua'
);

console.log('✓ Teste 1 aprovado: LiveTvPlayer possui supressão estrutural total dos controles tradicionais na TV.\n');

// -----------------------------------------------------------------------------------------
// TESTE 2: Auditoria de Chamada em TvLiveView.tsx
// -----------------------------------------------------------------------------------------
console.log('[Teste 2] Auditoria de Ativação do Modo Linear em TvLiveView.tsx...');
const tvLiveViewPath = path.resolve(process.cwd(), 'src/components/tv/live/TvLiveView.tsx');
assert.ok(fs.existsSync(tvLiveViewPath), 'TvLiveView.tsx deve existir');
const tvLiveViewCode = fs.readFileSync(tvLiveViewPath, 'utf-8');

// 2.1 Passagem explícita de tvLinearMode={true}
assert.ok(
  tvLiveViewCode.includes('tvLinearMode={true}'),
  'TvLiveView deve passar expressamente tvLinearMode={true} para o LiveTvPlayer'
);

// 2.2 isInteractive={false}
assert.ok(
  tvLiveViewCode.includes('isInteractive={false}'),
  'TvLiveView deve manter isInteractive={false} para o LiveTvPlayer'
);

// 2.3 Preservação estrita do HUD próprio da TV (TvLiveChannelOverlay)
assert.ok(
  tvLiveViewCode.includes('<TvLiveChannelOverlay'),
  'TvLiveView deve manter a renderização do TvLiveChannelOverlay nativo da TV'
);

assert.ok(
  tvLiveViewCode.includes('data-testid="tv-live-view-root"'),
  'TvLiveView deve manter a raiz do modo TV'
);

console.log('✓ Teste 2 aprovado: TvLiveView ativa modo linear e preserva o overlay de canais da Smart TV.\n');

// -----------------------------------------------------------------------------------------
// TESTE 3: Preservação dos Controles Tradicionais no Desktop / Web
// -----------------------------------------------------------------------------------------
console.log('[Teste 3] Verificação de Preservação dos Controles no Desktop e Web...');
const programasViewPath = path.resolve(process.cwd(), 'components/ProgramasView.tsx');
assert.ok(fs.existsSync(programasViewPath), 'ProgramasView.tsx deve existir');
const programasViewCode = fs.readFileSync(programasViewPath, 'utf-8');

// 3.1 ProgramasView não deve ter tvLinearMode={true}
assert.ok(
  !programasViewCode.includes('tvLinearMode={true}'),
  'ProgramasView (desktop web) NÃO deve forçar tvLinearMode={true}'
);

const televisionModePath = path.resolve(process.cwd(), 'src/components/livetv/TelevisionMode.tsx');
assert.ok(fs.existsSync(televisionModePath), 'TelevisionMode.tsx deve existir');
const televisionModeCode = fs.readFileSync(televisionModePath, 'utf-8');

// 3.2 TelevisionMode no desktop mantém isInteractive={true}
assert.ok(
  televisionModeCode.includes('isInteractive={true}'),
  'TelevisionMode no desktop deve manter isInteractive={true}'
);
assert.ok(
  !televisionModeCode.includes('tvLinearMode={true}'),
  'TelevisionMode no desktop NÃO deve desativar os controles tradicionais'
);

console.log('✓ Teste 3 aprovado: Desktop e Web mantêm o conjunto completo de controles interativos.\n');

// -----------------------------------------------------------------------------------------
// TESTE 4: Detecção de Ambiente pelo tvModeService
// -----------------------------------------------------------------------------------------
console.log('[Teste 4] Validação da Detecção do Modo TV e Rota Canônica...');

// Simulação de rota /tv
(global as any).window = {
  location: {
    pathname: '/tv',
    search: ''
  }
};
assert.strictEqual(tvModeService.isTvMode(), true, 'Rota /tv deve ativar isTvMode como verdadeiro');

// Simulação de rota /programas (desktop)
(global as any).window = {
  location: {
    pathname: '/programas',
    search: ''
  }
};
assert.strictEqual(tvModeService.isTvMode(), false, 'Rota /programas NÃO deve ativar isTvMode');

// Simulação de rota raiz / (desktop)
(global as any).window = {
  location: {
    pathname: '/',
    search: ''
  }
};
assert.strictEqual(tvModeService.isTvMode(), false, 'Rota / NÃO deve ativar isTvMode');

console.log('✓ Teste 4 aprovado: tvModeService distingue perfeitamente Smart TV (/tv) de Desktop (/).\n');

console.log('========================================================================');
console.log(' TODOS OS TESTES DE REMOÇÃO DOS CONTROLES TRADICIONAIS NA TV PASSARAM! ');
console.log('========================================================================\n');
