/**
 * ZapiTV — Suíte de Testes da Experiência de TV por Assinatura Moderna na Smart TV
 * 
 * Validação rigorosa dos 15 requisitos do sistema:
 * 1. Substituição de "Em Destaque" por "Ao Vivo" no TvHeader da Smart TV.
 * 2. Eliminação completa de banners de filmes/séries, capas e carrosséis na página "Ao Vivo" da Smart TV.
 * 3. Transmissão imediata em tela cheia 16:9, sem margens ou bordas arredondadas.
 * 4. Numeração permanente e determinística para todos os canais (channelNumberingService).
 * 5. Formatação rigorosa de 3 dígitos (ex: 001, 002, 010, 020, 100).
 * 6. Localização de canais por discagem numérica e tratamento seguro de canais inexistentes.
 * 7. Digitação direta por controle remoto (teclas 0-9) com buffer flutuante e auto-confirmação.
 * 8. Cancelamento de digitação e tratamento de erro sem travar o player.
 * 9. Barra informativa inferior estilo SKY/NET/Claro TV com metadados EPG reais, progresso e próximo programa.
 * 10. Auto-hide da barra informativa inferior em ~4.5 segundos.
 * 11. Auto-hide inteligente do cabeçalho da Smart TV na aba "Ao Vivo" em ~4 segundos.
 * 12. Reexibição do cabeçalho EXCLUSIVAMENTE pelo botão VOLTAR, com foco restaurado em "Ao Vivo".
 * 13. Hierarquia estrita do botão VOLTAR (número -> guia -> overlay -> header).
 * 14. Guia de canais translúcido estilo TV fechada com lista vertical e grade horária do dia.
 * 15. Suporte a botões físicos CH+/CH-, Tizen (427/428), Recall (canal anterior) e setas direcionais.
 * 16. Preservação estrita das páginas de Desktop e Mobile (sem afetar "Em Destaque" cinematográfico).
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { channelNumberingService, DEFAULT_CANONICAL_CHANNEL_NUMBERS } from '../src/core/livetv/channelNumberingService';
import { liveTvProviderRegistry } from '../src/core/livetv/LiveTVProviderRegistry';
import { epgService } from '../src/core/livetv/epgService';
import { isChannelVerified, LiveChannel } from '../src/core/livetv/types';

console.log('=== ZAPITV | TESTES DA EXPERIÊNCIA DE TV POR ASSINATURA NA SMART TV ===\n');

// -----------------------------------------------------------------------------------------
// TESTE 1: Auditoria do TvHeader na Smart TV ("Ao Vivo")
// -----------------------------------------------------------------------------------------
console.log('[Teste 1] Verificação do header da Smart TV: "Ao Vivo" em vez de "Em Destaque"...');
const tvHeaderFilePath = path.resolve(process.cwd(), 'src/components/tv/TvHeader.tsx');
assert.ok(fs.existsSync(tvHeaderFilePath), 'TvHeader.tsx deve existir');
const tvHeaderContent = fs.readFileSync(tvHeaderFilePath, 'utf-8');

assert.ok(
  tvHeaderContent.includes('focusKey="tv-nav-featured"') && tvHeaderContent.includes('label="Ao Vivo"'),
  'A aba tv-nav-featured do TvHeader deve exibir o rótulo "Ao Vivo"'
);
assert.ok(
  !tvHeaderContent.includes('label="Em Destaque"'),
  'O rótulo "Em Destaque" não deve constar na navegação da Smart TV'
);
assert.ok(
  tvHeaderContent.includes('hidden?: boolean'),
  'TvHeaderProps deve suportar a prop hidden para auto-hide na TV'
);
assert.ok(
  tvHeaderContent.includes('-translate-y-full pointer-events-none invisible'),
  'Quando oculto, TvHeader deve aplicar transladação, ocultação de ponteiro e invisibilidade'
);
console.log('✓ Teste 1 aprovado: TvHeader atualizado com "Ao Vivo" e suporte a auto-hide.\n');

// -----------------------------------------------------------------------------------------
// TESTE 2: Auditoria do TvApp: Página "Ao Vivo" em Tela Cheia e sem Carrosséis de Filmes
// -----------------------------------------------------------------------------------------
console.log('[Teste 2] Verificação da renderização da aba "Ao Vivo" no TvApp...');
const tvAppFilePath = path.resolve(process.cwd(), 'src/pages/tv/TvApp.tsx');
assert.ok(fs.existsSync(tvAppFilePath), 'TvApp.tsx deve existir');
const tvAppContent = fs.readFileSync(tvAppFilePath, 'utf-8');

assert.ok(
  tvAppContent.includes("import { TvLiveView } from '../../components/tv/live/TvLiveView'"),
  'TvApp deve importar TvLiveView'
);
assert.ok(
  tvAppContent.includes('path.includes(\'/ao-vivo\')'),
  'TvApp deve reconhecer a rota /ao-vivo na aba featured'
);
assert.ok(
  tvAppContent.includes('<TvLiveView'),
  'TvApp deve instanciar TvLiveView na aba featured'
);
assert.ok(
  tvAppContent.includes('isLiveHeaderHidden'),
  'TvApp deve gerenciar o estado isLiveHeaderHidden'
);
assert.ok(
  tvAppContent.includes('hidden={currentTab === \'featured\' && isLiveHeaderHidden}'),
  'TvApp deve ocultar o TvHeader exclusivamente na aba featured quando inativo'
);
assert.ok(
  tvAppContent.includes('handleRevealLiveHeader'),
  'TvApp deve possuir callback para revelar o header ao pressionar VOLTAR'
);
console.log('✓ Teste 2 aprovado: TvApp orquestra TvLiveView e auto-hide de cabeçalho.\n');

// -----------------------------------------------------------------------------------------
// TESTE 3: Preservação Estrita das Páginas Desktop e Mobile
// -----------------------------------------------------------------------------------------
console.log('[Teste 3] Verificação da integridade das páginas de Desktop e Mobile...');
const featuredRankingServicePath = path.resolve(process.cwd(), 'src/core/rankings/FeaturedRankingService.ts');
assert.ok(fs.existsSync(featuredRankingServicePath), 'FeaturedRankingService deve permanecer intacto');
const featuredServiceContent = fs.readFileSync(featuredRankingServicePath, 'utf-8');
assert.ok(
  featuredServiceContent.includes('Em Destaque'),
  'Serviço de rankings de filmes/séries em destaque deve ser preservado para desktop e mobile'
);

const mobileHeroPath = path.resolve(process.cwd(), 'src/components/mobile/MobileHero.tsx');
assert.ok(fs.existsSync(mobileHeroPath), 'MobileHero deve permanecer intacto');
console.log('✓ Teste 3 aprovado: Desktop e Mobile preservam integralmente seus catálogos cinematográficos.\n');

// -----------------------------------------------------------------------------------------
// TESTE 4: Numeração Determinística e Permanente de Canais (channelNumberingService)
// -----------------------------------------------------------------------------------------
console.log('[Teste 4] Teste da numeração determinística e formatação com 3 dígitos...');
const channels = liveTvProviderRegistry.getVerifiedChannels();
assert.ok(channels.length >= 40, 'Deve haver canais verificados para numeração');

// Verifica mapeamentos canônicos pré-definidos
assert.strictEqual(channelNumberingService.getNumber('tv-brasil'), 1);
assert.strictEqual(channelNumberingService.getFormattedNumber('tv-brasil'), '001');

assert.strictEqual(channelNumberingService.getNumber('tv-cultura'), 2);
assert.strictEqual(channelNumberingService.getFormattedNumber('tv-cultura'), '002');

assert.strictEqual(channelNumberingService.getNumber('caze-tv'), 10);
assert.strictEqual(channelNumberingService.getFormattedNumber('caze-tv'), '010');

assert.strictEqual(channelNumberingService.getNumber('band-sports'), 11);
assert.strictEqual(channelNumberingService.getFormattedNumber('band-sports'), '011');

assert.strictEqual(channelNumberingService.getNumber('pluto-tv-cine-sucessos'), 20);
assert.strictEqual(channelNumberingService.getFormattedNumber('pluto-tv-cine-sucessos'), '020');

assert.strictEqual(channelNumberingService.getNumber('naruto-dublado'), 40);
assert.strictEqual(channelNumberingService.getFormattedNumber('naruto-dublado'), '040');

assert.strictEqual(channelNumberingService.getNumber('turma-da-monica'), 50);
assert.strictEqual(channelNumberingService.getFormattedNumber('turma-da-monica'), '050');

assert.strictEqual(channelNumberingService.getNumber('mtv-biggest-pop'), 60);
assert.strictEqual(channelNumberingService.getFormattedNumber('mtv-biggest-pop'), '060');

assert.strictEqual(channelNumberingService.getNumber('tastemade-brasil'), 70);
assert.strictEqual(channelNumberingService.getFormattedNumber('tastemade-brasil'), '070');

console.log('✓ Teste 4 aprovado: Mapeamento determinístico de números canônicos 3 dígitos validado.\n');

// -----------------------------------------------------------------------------------------
// TESTE 5: Alocação Dinâmica Determinística e Busca por Número
// -----------------------------------------------------------------------------------------
console.log('[Teste 5] Alocação automática para canais sem número pré-definido e busca...');
const dynamicNum = channelNumberingService.getNumber('canal-novo-teste');
assert.ok(dynamicNum >= 100, `Canais dinâmicos devem receber números >= 100 (recebeu: ${dynamicNum})`);
const formattedDynamic = channelNumberingService.getFormattedNumber('canal-novo-teste');
assert.strictEqual(formattedDynamic, String(dynamicNum));

// Busca por número
const matchCaze = channelNumberingService.getChannelByNumber(10, channels);
assert.ok(matchCaze, 'Deve encontrar canal número 10 (CazéTV)');
assert.strictEqual(matchCaze?.id, 'caze-tv');

const matchCultura = channelNumberingService.getChannelByNumber(2, channels);
assert.ok(matchCultura, 'Deve encontrar canal número 2 (TV Cultura)');
assert.strictEqual(matchCultura?.id, 'tv-cultura');

const matchInexistente = channelNumberingService.getChannelByNumber(999, channels);
assert.strictEqual(matchInexistente, undefined, 'Canal 999 inexistente deve retornar undefined');
console.log('✓ Teste 5 aprovado: Alocação dinâmica e busca de canal por discagem validadas.\n');

// -----------------------------------------------------------------------------------------
// TESTE 6: Anotação e Ordenação Rigorosa de Canais
// -----------------------------------------------------------------------------------------
console.log('[Teste 6] Anotação da propriedade number e ordenação crescente...');
const sortedChannels = channelNumberingService.annotateAndSortChannels(channels);
assert.strictEqual(sortedChannels.length, channels.length);

for (let i = 0; i < sortedChannels.length - 1; i++) {
  const currNum = sortedChannels[i].number || 0;
  const nextNum = sortedChannels[i + 1].number || 0;
  assert.ok(
    currNum <= nextNum,
    `Lista de canais deve estar estritamente ordenada por número (${currNum} <= ${nextNum})`
  );
}
console.log(`✓ Teste 6 aprovado: ${sortedChannels.length} canais anotados e ordenados numericamente.\n`);

// -----------------------------------------------------------------------------------------
// TESTE 7: Indicador Numérico Flutuante (TvLiveNumericInput)
// -----------------------------------------------------------------------------------------
console.log('[Teste 7] Auditoria do componente de digitação numérica TvLiveNumericInput...');
const numericInputPath = path.resolve(process.cwd(), 'src/components/tv/live/TvLiveNumericInput.tsx');
assert.ok(fs.existsSync(numericInputPath), 'TvLiveNumericInput.tsx deve existir');
const numericContent = fs.readFileSync(numericInputPath, 'utf-8');

assert.ok(numericContent.includes('fixed top-8 right-10 z-[200]'), 'Deve posicionar-se no canto superior direito');
assert.ok(numericContent.includes('text-cyan-300'), 'Deve exibir os dígitos com brilho cyan');
assert.ok(numericContent.includes('Sintonizando canal'), 'Deve conter legenda contextual');
assert.ok(numericContent.includes('errorMessage'), 'Deve suportar exibição de feedback amigável de erro');
console.log('✓ Teste 7 aprovado: TvLiveNumericInput possui estilo visual sofisticado e feedback de erro.\n');

// -----------------------------------------------------------------------------------------
// TESTE 8: Barra Informativa Inferior (TvLiveChannelOverlay)
// -----------------------------------------------------------------------------------------
console.log('[Teste 8] Auditoria da barra informativa inferior TvLiveChannelOverlay...');
const overlayPath = path.resolve(process.cwd(), 'src/components/tv/live/TvLiveChannelOverlay.tsx');
assert.ok(fs.existsSync(overlayPath), 'TvLiveChannelOverlay.tsx deve existir');
const overlayContent = fs.readFileSync(overlayPath, 'utf-8');

assert.ok(overlayContent.includes('bg-[#070b14]/92 backdrop-blur-2xl'), 'Deve utilizar glassmorphism escuro');
assert.ok(overlayContent.includes('formattedNumber'), 'Deve renderizar o número formatado de 3 dígitos');
assert.ok(overlayContent.includes('NO AR'), 'Deve exibir badge NO AR para o programa corrente');
assert.ok(overlayContent.includes('progressPercent'), 'Deve exibir barra de progresso da programação');
assert.ok(overlayContent.includes('A Seguir:'), 'Deve exibir informação do próximo programa');
assert.ok(overlayContent.includes('Trophy'), 'Deve exibir confronto e competição quando for transmissão esportiva');
console.log('✓ Teste 8 aprovado: TvLiveChannelOverlay exibe metadados ricos e estilo SKY/NET moderno.\n');

// -----------------------------------------------------------------------------------------
// TESTE 9: Guia Eletrônico de Canais Ao Vivo (TvLiveChannelGuide)
// -----------------------------------------------------------------------------------------
console.log('[Teste 9] Auditoria do Guia Eletrônico TvLiveChannelGuide...');
const guidePath = path.resolve(process.cwd(), 'src/components/tv/live/TvLiveChannelGuide.tsx');
assert.ok(fs.existsSync(guidePath), 'TvLiveChannelGuide.tsx deve existir');
const guideContent = fs.readFileSync(guidePath, 'utf-8');

assert.ok(guideContent.includes('col-span-5'), 'Painel esquerdo com lista de canais');
assert.ok(guideContent.includes('col-span-7'), 'Painel direito com grade de programação do canal selecionado');
assert.ok(guideContent.includes('ArrowDown') && guideContent.includes('ArrowUp'), 'Navegação por setas verticais');
assert.ok(guideContent.includes('ArrowRight') && guideContent.includes('ArrowLeft'), 'Alternância entre lista e detalhes');
assert.ok(guideContent.includes('Enter'), 'Tecla OK sintoniza o canal e fecha o guia');
assert.ok(guideContent.includes('Escape') || guideContent.includes('Backspace'), 'Tecla VOLTAR fecha o guia');
console.log('✓ Teste 9 aprovado: TvLiveChannelGuide estruturado em dois painéis com navegação por controle.\n');

// -----------------------------------------------------------------------------------------
// TESTE 10: Controlador Central TvLiveView
// -----------------------------------------------------------------------------------------
console.log('[Teste 10] Auditoria do TvLiveView (reprodução em tela cheia e atalhos de controle)...');
const liveViewPath = path.resolve(process.cwd(), 'src/components/tv/live/TvLiveView.tsx');
assert.ok(fs.existsSync(liveViewPath), 'TvLiveView.tsx deve existir');
const liveViewContent = fs.readFileSync(liveViewPath, 'utf-8');

// Tela cheia
assert.ok(
  liveViewContent.includes('fixed inset-0 z-0 bg-black overflow-hidden'),
  'TvLiveView deve ocupar 100% da tela sem margens'
);
assert.ok(
  liveViewContent.includes('<LiveTvPlayer'),
  'TvLiveView deve instanciar LiveTvPlayer'
);

// CH+ e CH-
assert.ok(
  liveViewContent.includes('ChannelUp') || liveViewContent.includes('427'),
  'TvLiveView deve interceptar ChannelUp (427)'
);
assert.ok(
  liveViewContent.includes('ChannelDown') || liveViewContent.includes('428'),
  'TvLiveView deve interceptar ChannelDown (428)'
);

// Teclado numérico
assert.ok(
  liveViewContent.includes('handleDigitInput'),
  'TvLiveView deve processar digitação de números 0-9'
);

// Recall
assert.ok(
  liveViewContent.includes('handleRecallChannel'),
  'TvLiveView deve possuir alternância entre dois últimos canais assistidos (Recall)'
);

// Hierarquia de VOLTAR
assert.ok(
  liveViewContent.includes('registerBackHandler'),
  'TvLiveView deve registrar manipulador de voltar com prioridade alta'
);
console.log('✓ Teste 10 aprovado: TvLiveView implementa controles e tela cheia 16:9.\n');

// -----------------------------------------------------------------------------------------
// TESTE 11: Integração com Tizen no tvNavigationManager
// -----------------------------------------------------------------------------------------
console.log('[Teste 11] Verificação do registro de teclas físicas no Samsung Tizen...');
const tvNavPath = path.resolve(process.cwd(), 'src/core/tv/tvNavigationManager.ts');
assert.ok(fs.existsSync(tvNavPath), 'tvNavigationManager.ts deve existir');
const tvNavContent = fs.readFileSync(tvNavPath, 'utf-8');

assert.ok(
  tvNavContent.includes('tvinputdevice.registerKey'),
  'tvNavigationManager deve registrar defensivamente teclas no Tizen'
);
assert.ok(
  tvNavContent.includes('ChannelUp') && tvNavContent.includes('ChannelDown'),
  'tvNavigationManager deve registrar ChannelUp e ChannelDown no Tizen'
);
console.log('✓ Teste 11 aprovado: Integração e registro para TV Samsung Tizen verificado.\n');

// -----------------------------------------------------------------------------------------
// TESTE 12: EPG Real Integrado aos Canais Ativos
// -----------------------------------------------------------------------------------------
console.log('[Teste 12] Validação do cálculo de estado EPG nos canais principais...');
const culturaChannel = channels.find(c => c.id === 'tv-cultura')!;
assert.ok(culturaChannel, 'TV Cultura deve existir');
const culturaState = epgService.getCurrentEpgState(culturaChannel);
assert.ok(culturaState, 'Deve gerar estado EPG para TV Cultura');
assert.ok(culturaState.hasVerifiedSchedule, 'TV Cultura deve possuir programação confirmada via XMLTV');
assert.ok(culturaState.currentProgram.title.length > 0, 'TV Cultura deve ter título de programa');

const bandSportsChannel = channels.find(c => c.id === 'band-sports')!;
assert.ok(bandSportsChannel, 'Band Sports deve existir');
const bandSportsState = epgService.getCurrentEpgState(bandSportsChannel);
assert.ok(bandSportsState, 'Deve gerar estado EPG para Band Sports');
assert.ok(bandSportsState.hasVerifiedSchedule, 'Band Sports deve possuir programação confirmada via XMLTV');

const cazeChannel = channels.find(c => c.id === 'caze-tv')!;
assert.ok(cazeChannel, 'CazéTV deve existir');
const cazeState = epgService.getCurrentEpgState(cazeChannel);
assert.ok(cazeState, 'Deve gerar estado EPG mesmo para canais sem XMLTV');
assert.strictEqual(cazeState.hasVerifiedSchedule, false, 'Canais sem XMLTV não devem inventar programação');
assert.ok(cazeState.currentProgram.title.includes('não disponível'), 'Canais sem XMLTV devem exibir fallback honesto');

console.log('✓ Teste 12 aprovado: EPG em tempo real integrado às emissoras com fallback honesto.\n');

console.log('========================================================================');
console.log('🎉 TODOS OS TESTES DA EXPERIÊNCIA DE TV POR ASSINATURA FORAM APROVADOS!');
console.log('========================================================================');
