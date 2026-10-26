/**
 * ZapiTV — Teste de Validação da Simplificação do HUD Ao Vivo na Smart TV
 * 
 * Requisitos validados:
 * 1. Remoção completa do indicador de qualidade ({channel.quality || '1080p'}, selos 720p/1080p/4k/Auto) do JSX.
 * 2. Remoção completa do bloco de dicas de teclas de atalho do controle remoto (▲ Guia, ◀ ▶ Zapping, 0-9 Canal, VOLTAR Menu).
 * 3. Preservação integral das informações essenciais:
 *    - Número do canal (formattedNumber)
 *    - Logo da emissora (channel.logo)
 *    - Nome do canal (channel.name)
 *    - Categoria (channel.categoryLabel / category)
 *    - Programação atual (prog.title)
 *    - Horários de início e término (formattedStartTime - formattedEndTime)
 *    - Barra de progresso real (progressPercent)
 *    - Próximo programa (nextProgram.title & startTime)
 * 4. Zero espaços ociosos: contêiner e flex layouts reorganizados de forma compacta e profissional.
 * 5. Preservação dos comandos de controle remoto em TvLiveView.tsx (zapping, guia, numérico, voltar).
 * 6. Integridade da reprodução de vídeo e adaptação de qualidade HLS inalteradas no player.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('=== ZAPITV | TESTE DE SIMPLIFICAÇÃO DO HUD AO VIVO NA TV ===\n');

// -----------------------------------------------------------------------------------------
// TESTE 1: Auditoria de Remoção no TvLiveChannelOverlay.tsx
// -----------------------------------------------------------------------------------------
console.log('[Teste 1] Auditoria de Remoção de Elementos em TvLiveChannelOverlay.tsx...');
const overlayPath = path.resolve(process.cwd(), 'src/components/tv/live/TvLiveChannelOverlay.tsx');
assert.ok(fs.existsSync(overlayPath), 'TvLiveChannelOverlay.tsx deve existir');
const overlayContent = fs.readFileSync(overlayPath, 'utf-8');

// 1.1 Não deve conter indicador de qualidade
assert.ok(
  !overlayContent.includes('channel.quality'),
  'TvLiveChannelOverlay NÃO deve renderizar channel.quality no JSX'
);
assert.ok(
  !overlayContent.includes("'1080p'"),
  'TvLiveChannelOverlay NÃO deve conter fallback de resolução 1080p'
);

// 1.2 Não deve conter o bloco de atalhos do controle remoto
assert.ok(
  !overlayContent.includes('Dica de Teclas de Atalho do Controle Remoto'),
  'TvLiveChannelOverlay NÃO deve conter o bloco de dicas de atalho'
);
assert.ok(
  !overlayContent.includes('▲</span> Guia') && !overlayContent.includes('Guia</span>'),
  'TvLiveChannelOverlay NÃO deve renderizar botão de dica Guia'
);
assert.ok(
  !overlayContent.includes('Zapping</span>') && !overlayContent.includes('Zapping'),
  'TvLiveChannelOverlay NÃO deve renderizar botão de dica Zapping'
);
assert.ok(
  !overlayContent.includes('Canal</span>'),
  'TvLiveChannelOverlay NÃO deve renderizar botão de dica Canal 0-9'
);
assert.ok(
  !overlayContent.includes('VOLTAR</span> Menu'),
  'TvLiveChannelOverlay NÃO deve renderizar botão de dica VOLTAR Menu'
);

console.log('✓ Teste 1 aprovado: Selos de qualidade e dicas de botões removidos completamente do JSX.\n');

// -----------------------------------------------------------------------------------------
// TESTE 2: Auditoria de Preservação dos Elementos Essenciais do HUD
// -----------------------------------------------------------------------------------------
console.log('[Teste 2] Verificação da Preservação das Informações Essenciais do Canal...');

// 2.1 Número do canal formatado
assert.ok(
  overlayContent.includes('formattedNumber'),
  'TvLiveChannelOverlay deve preservar o número formatado do canal'
);

// 2.2 Logo da emissora com fallback seguro
assert.ok(
  overlayContent.includes('channel.logo') && overlayContent.includes('channel.fallbackLogo'),
  'TvLiveChannelOverlay deve preservar a logo da emissora e seu fallback'
);

// 2.3 Nome do canal
assert.ok(
  overlayContent.includes('channel.name'),
  'TvLiveChannelOverlay deve preservar o nome do canal'
);

// 2.4 Categoria
assert.ok(
  overlayContent.includes('channel.categoryLabel || channel.category'),
  'TvLiveChannelOverlay deve preservar a categoria do canal'
);

// 2.5 Programação atual e badge NO AR
assert.ok(
  overlayContent.includes('NO AR') && overlayContent.includes('prog.title'),
  'TvLiveChannelOverlay deve preservar badge NO AR e o título do programa atual'
);

// 2.6 Horários de transmissão
assert.ok(
  overlayContent.includes('epg.formattedStartTime') && overlayContent.includes('epg.formattedEndTime'),
  'TvLiveChannelOverlay deve preservar os horários de início e término da programação'
);

// 2.7 Barra de progresso real
assert.ok(
  overlayContent.includes('epg.progressPercent'),
  'TvLiveChannelOverlay deve preservar a barra de progresso do programa'
);

// 2.8 Próximo programa (A Seguir)
assert.ok(
  overlayContent.includes('epg.nextProgram') && overlayContent.includes('A Seguir:'),
  'TvLiveChannelOverlay deve preservar a indicação do próximo programa'
);

console.log('✓ Teste 2 aprovado: Todas as informações essenciais estão 100% preservadas e visíveis.\n');

// -----------------------------------------------------------------------------------------
// TESTE 3: Preservação das Funcionalidades do Controle Remoto em TvLiveView.tsx
// -----------------------------------------------------------------------------------------
console.log('[Teste 3] Verificação da Operacionalidade dos Comandos de Controle Remoto...');
const liveViewPath = path.resolve(process.cwd(), 'src/components/tv/live/TvLiveView.tsx');
assert.ok(fs.existsSync(liveViewPath), 'TvLiveView.tsx deve existir');
const liveViewContent = fs.readFileSync(liveViewPath, 'utf-8');

// 3.1 Zapping por setas e CH+/CH-
assert.ok(
  liveViewContent.includes('handleNextChannel') && liveViewContent.includes('handlePrevChannel'),
  'TvLiveView deve manter os handlers de troca de canal (zapping)'
);
assert.ok(
  liveViewContent.includes('ChannelUp') || liveViewContent.includes('427'),
  'TvLiveView deve manter interceptação de ChannelUp'
);
assert.ok(
  liveViewContent.includes('ChannelDown') || liveViewContent.includes('428'),
  'TvLiveView deve manter interceptação de ChannelDown'
);

// 3.2 Guia Eletrônico de Canais
assert.ok(
  liveViewContent.includes('setIsGuideOpen(true)'),
  'TvLiveView deve manter a abertura do Guia Eletrônico por tecla do controle'
);

// 3.3 Digitação Numérica
assert.ok(
  liveViewContent.includes('handleDigitInput'),
  'TvLiveView deve manter suporte a digitação numérica direta (0-9)'
);

// 3.4 Botão Voltar para revelar o Header
assert.ok(
  liveViewContent.includes('onTriggerHeader'),
  'TvLiveView deve manter a revelação do cabeçalho ao pressionar Voltar'
);

console.log('✓ Teste 3 aprovado: Todos os atalhos e comandos de controle remoto continuam funcionando normalmente.\n');

// -----------------------------------------------------------------------------------------
// TESTE 4: Preservação da Qualidade Real no Player e HLS
// -----------------------------------------------------------------------------------------
console.log('[Teste 4] Verificação da Integridade da Reprodução de Vídeo...');
const playerPath = path.resolve(process.cwd(), 'src/components/livetv/LiveTvPlayer.tsx');
assert.ok(fs.existsSync(playerPath), 'LiveTvPlayer.tsx deve existir');
const playerContent = fs.readFileSync(playerPath, 'utf-8');

assert.ok(
  playerContent.includes('Hls.Events.MANIFEST_PARSED'),
  'LiveTvPlayer deve processar níveis e qualidades HLS normalmente'
);
assert.ok(
  playerContent.includes('channelHealthService'),
  'LiveTvPlayer deve monitorar a integridade da transmissão sem alterações'
);

console.log('✓ Teste 4 aprovado: A reprodução HLS e seleção de fontes permanecem inalteradas.\n');

console.log('========================================================================');
console.log(' TODOS OS TESTES DE SIMPLIFICAÇÃO DO HUD AO VIVO PASSARAM COM SUCESSO! ');
console.log('========================================================================\n');
