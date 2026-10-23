import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TvPlayerControls } from '../src/components/player/TvPlayerControls';
import type { AudioOption } from '../src/core/audio/audioSelectionManager';
import type { SubtitleTrack } from '../src/core/subtitles/subtitleService';
import type { SubtitleStyle } from '../src/core/subtitles/subtitleStyleService';
import fs from 'node:fs';
import path from 'node:path';

console.log('========================================================================');
console.log('--- TESTE: REDESIGN DOS MENUS LATERAIS DO PLAYER DA TV (ZAPITV) ---');
console.log('========================================================================\n');

const mockAudioOptions: AudioOption[] = [
  { id: 'audio-pt', langCode: 'pt-BR', label: 'Português (Brasil)', flag: '🇧🇷', badge: 'Dublado', kind: 'embedded-track', isCurrent: true, confidence: 1 },
  { id: 'audio-ja', langCode: 'ja', label: 'Japonês', flag: '🇯🇵', badge: 'Original', kind: 'embedded-track', isCurrent: false, confidence: 1 },
  { id: 'audio-en', langCode: 'en', label: 'Inglês', flag: '🇺🇸', badge: 'Dublado', kind: 'embedded-track', isCurrent: false, confidence: 1 }
];

const mockSubtitleOptions: SubtitleTrack[] = [
  { id: 'sub-pt', lang: 'pt-BR', label: 'Português (Brasil)', languageName: 'Português (Brasil)', flag: '🇧🇷', url: 'https://subs.zapitv/pt.vtt', order: 1, isPtBr: true, autoSyncBadge: true },
  { id: 'sub-en', lang: 'en', label: 'Inglês', languageName: 'Inglês', flag: '🇺🇸', url: 'https://subs.zapitv/en.vtt', order: 2 }
];

const mockSubtitleStyle: SubtitleStyle = {
  fontSize: 'md',
  verticalPosition: 10,
  color: '#FFFFFF',
  bgColor: 'semi',
  outline: 'thin',
  shadow: 'strong',
  lineSpacing: 'normal'
};

const mockEpisodes = [
  {
    id: 'ep-1-1',
    number: 1,
    season: 1,
    title: 'Eu Sou Aquele Que Caça',
    description: 'Sung Jinwoo enfrenta a temível dungeon dupla com seus companheiros caçadores.',
    image: 'https://images.zapitv/solo-leveling-ep1.jpg'
  },
  {
    id: 'ep-1-2',
    number: 2,
    season: 1,
    title: 'Se Eu Tiver Outra Chance',
    description: 'Após o sacrifício na sala do templo, uma janela misteriosa de missões surge.',
    image: 'https://images.zapitv/solo-leveling-ep2.jpg'
  },
  {
    id: 'ep-2-1',
    number: 1,
    season: 2,
    title: 'Ergam-se das Sombras',
    description: 'O monarca das sombras desperta seu exército no portão vermelho.',
    image: 'https://images.zapitv/solo-leveling-s2-ep1.jpg'
  }
];

// -----------------------------------------------------------------------------
// Teste 1: Análise Estática do Código Fonte
// -----------------------------------------------------------------------------
console.log('[Teste 1] Análise estática do código fonte em TvPlayerControls.tsx...');
const controlsSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/player/TvPlayerControls.tsx'),
  'utf-8'
);

// Verifica existência dos novos componentes modulares e elegantes
assert.ok(controlsSource.includes('DrawerIconButton'), 'Deve conter DrawerIconButton');
assert.ok(controlsSource.includes('DrawerHeaderButton'), 'Deve conter DrawerHeaderButton');
assert.ok(controlsSource.includes('DrawerSectionHeader'), 'Deve conter DrawerSectionHeader');
assert.ok(controlsSource.includes('DrawerPillChip'), 'Deve conter DrawerPillChip');
assert.ok(controlsSource.includes('DrawerColorChip'), 'Deve conter DrawerColorChip');
assert.ok(controlsSource.includes('DrawerToggleRow'), 'Deve conter DrawerToggleRow');
assert.ok(controlsSource.includes('DrawerEpisodeCard'), 'Deve conter DrawerEpisodeCard');
assert.ok(controlsSource.includes('DrawerActionCard'), 'Deve conter DrawerActionCard');
assert.ok(controlsSource.includes('DrawerStepper'), 'Deve conter DrawerStepper');
assert.ok(controlsSource.includes('SubtitlePreviewBox'), 'Deve conter SubtitlePreviewBox');

// Verifica largura calibrada e degradê suave do overlay lateral conforme referências visuais
assert.ok(controlsSource.includes('w-[min(480px,38vw)]'), 'Largura do drawer deve ser calibrada em w-[min(480px,38vw)] para manter vídeo dominante');
assert.ok(controlsSource.includes('bg-gradient-to-l from-black/95'), 'Drawer deve usar degradê suave da direita para a esquerda');

// Verifica suporte aos 4 menus laterais
assert.ok(controlsSource.includes("'audio_subtitles' | 'episodes' | 'options' | 'subtitle_styles'"), 'TvMenuType deve incluir subtitle_styles');
assert.ok(controlsSource.includes('openSubtitleStyles'), 'Deve conter helper openSubtitleStyles');
assert.ok(controlsSource.includes('returnFromSubtitleStyles'), 'Deve conter helper returnFromSubtitleStyles');
console.log('✓ Componentes modulares, submenu de estilos e helpers implementados com sucesso.');

// -----------------------------------------------------------------------------
// Teste 2: Hierarquia do Botão Voltar para Submenu e Menus Laterais
// -----------------------------------------------------------------------------
console.log('\n[Teste 2] Verificação da hierarquia do botão Voltar (Submenu -> Menu Anterior -> Controles)...');
assert.ok(
  controlsSource.includes("if (menu === 'subtitle_styles') {\n      returnFromSubtitleStyles();\n      return true;\n    }"),
  'Ao pressionar Voltar em subtitle_styles deve retornar ao menu anterior'
);
assert.ok(
  controlsSource.includes("if (menu) {\n      closeMenu();\n      return true;\n    }"),
  'Ao pressionar Voltar em qualquer menu lateral aberto deve fechar o menu e restaurar foco'
);
console.log('✓ Hierarquia do botão Voltar respeita navegação multinível da TV.');

// -----------------------------------------------------------------------------
// Teste 3: Estrutura do Drawer de Episódios (16:9, Temporadas em Pills, Atual, Sinopse)
// -----------------------------------------------------------------------------
console.log('\n[Teste 3] Verificação da estrutura do menu de Episódios...');
assert.ok(controlsSource.includes('aspect-video'), 'Miniatura deve utilizar proporção 16:9 (aspect-video)');
assert.ok(controlsSource.includes('tv-player-drawer-season-'), 'Seletor de temporadas deve registrar focus keys nos pills');
assert.ok(controlsSource.includes('tv-player-drawer-episodes-'), 'Cards de episódios devem registrar focus keys');
assert.ok(controlsSource.includes('line-clamp-2'), 'Sinopse dos episódios deve ser controlada em 2 linhas');
assert.ok(controlsSource.includes('EP {episode.number}'), 'Miniatura deve exibir tag com o número do episódio');
assert.ok(controlsSource.includes('Atual'), 'Episódio em reprodução deve exibir badge "Atual"');
console.log('✓ Menu de episódios clean com cards 16:9, badges e sinopses compactas.');

// -----------------------------------------------------------------------------
// Teste 4: Estrutura do Drawer de Áudio e Legendas (Seções Claras, Pills, Estilos)
// -----------------------------------------------------------------------------
console.log('\n[Teste 4] Verificação da estrutura de Áudio e Legendas...');
assert.ok(controlsSource.includes('tv-player-drawer-audio-'), 'Opções de áudio devem registrar focus keys em pills');
assert.ok(controlsSource.includes('tv-player-drawer-sub-off'), 'Opção de legenda desativada deve existir');
assert.ok(controlsSource.includes('tv-player-drawer-sub-'), 'Opções de legenda devem registrar focus keys em pills');
assert.ok(controlsSource.includes('tv-drawer-sub-styles-btn'), 'Deve conter botão com focus key tv-drawer-sub-styles-btn para acessar estilos');
console.log('✓ Áudio e Legendas separados em duas seções limpas com chips horizontais e link para estilos.');

// -----------------------------------------------------------------------------
// Teste 5: Estrutura do Drawer de Configurações (Qualidade, Switches, Stepper, Reporte)
// -----------------------------------------------------------------------------
console.log('\n[Teste 5] Verificação da estrutura de Configurações...');
assert.ok(controlsSource.includes('tv-player-drawer-quality-'), 'Qualidades devem ser exibidas em pills');
assert.ok(controlsSource.includes('tv-player-drawer-toggle-autoplay'), 'Autoplay deve possuir toggle switch');
assert.ok(controlsSource.includes('tv-player-drawer-toggle-autoskip'), 'Autoskip deve possuir toggle switch');
assert.ok(controlsSource.includes('tv-player-drawer-skip-down') && controlsSource.includes('tv-player-drawer-skip-up'), 'Ajuste fino de abertura deve possuir stepper');
assert.ok(controlsSource.includes('tv-player-drawer-report'), 'Deve conter botão de reporte de problemas');
console.log('✓ Configurações organizadas com switches modernos, chips de qualidade e stepper de sincronia.');

// -----------------------------------------------------------------------------
// Teste 6: Estrutura do Submenu de Estilos de Legenda (Preview, Tamanho, Cores, Fundo)
// -----------------------------------------------------------------------------
console.log('\n[Teste 6] Verificação do Submenu de Estilo das Legendas...');
assert.ok(controlsSource.includes('SubtitlePreviewBox'), 'Deve renderizar caixa de pré-visualização ao vivo');
assert.ok(controlsSource.includes('Primeira linha de legenda'), 'Pré-visualização deve conter primeira linha de exemplo');
assert.ok(controlsSource.includes('Segunda linha com espaçamento'), 'Pré-visualização deve conter segunda linha de exemplo');
assert.ok(controlsSource.includes('tv-player-drawer-substyle-outline-'), 'Contorno da legenda em pills');
assert.ok(controlsSource.includes('tv-player-drawer-substyle-shadow-'), 'Sombras da legenda em pills');
assert.ok(controlsSource.includes('tv-player-drawer-substyle-size-'), 'Tamanho da legenda em pills');
assert.ok(controlsSource.includes('tv-player-drawer-substyle-spacing-'), 'Espaçamento vertical de linhas em pills');
assert.ok(controlsSource.includes('tv-player-drawer-substyle-color-'), 'Cores da legenda com swatches circulares');
assert.ok(controlsSource.includes('tv-player-drawer-substyle-bg-'), 'Fundo da legenda em pills');
assert.ok(controlsSource.includes('tv-player-drawer-substyle-pos-down') && controlsSource.includes('tv-player-drawer-substyle-pos-up'), 'Posição vertical em stepper');
assert.ok(controlsSource.includes('tv-player-drawer-substyle-pos-reset'), 'Posição vertical deve permitir restaurar padrão');
assert.ok(controlsSource.includes('tv-drawer-back-btn'), 'Cabeçalho do submenu deve conter botão voltar');
console.log('✓ Submenu de estilos de legenda com pré-visualização em tempo real e seletores elegantes.');

// -----------------------------------------------------------------------------
// Teste 7: Renderização dos Controles Principais
// -----------------------------------------------------------------------------
console.log('\n[Teste 7] Renderização estática com controles visíveis...');
const html = renderToStaticMarkup(
  React.createElement(TvPlayerControls, {
    title: 'Solo Leveling',
    season: 1,
    episode: 1,
    episodeTitle: 'Eu Sou Aquele Que Caça',
    episodes: mockEpisodes,
    visible: true,
    suspended: false,
    playing: true,
    intro: false,
    loading: false,
    currentTime: 300,
    duration: 1400,
    canPlayPause: true,
    canSeek: true,
    canNext: true,
    audioOptions: mockAudioOptions,
    subtitleOptions: mockSubtitleOptions,
    selectedSubtitleId: 'sub-pt',
    qualities: ['auto', '1080p', '720p'],
    selectedQuality: '1080p',
    autoPlayEnabled: true,
    autoSkipEnabled: true,
    subtitleSize: 'md',
    subtitlePosition: 10,
    subtitleStyle: mockSubtitleStyle,
    skipOffset: 0,
    onTogglePlay: () => {},
    onSeek: () => {},
    onSkip: () => {},
    onClose: () => {},
    onShow: () => {},
    onInteraction: () => {},
    onInteractionModeChange: () => {},
    onAudio: () => {},
    onSubtitle: () => {},
    onQuality: () => {},
    onToggleAutoPlay: () => {},
    onToggleAutoSkip: () => {},
    onSubtitleSize: () => {},
    onSubtitlePosition: () => {},
    onSubtitleStyle: () => {},
    onAdjustSkipOffset: () => {},
    onResetSkipOffset: () => {},
    onNext: () => {},
    onSelectEpisode: () => {},
    onReport: () => {}
  })
);

assert.ok(html.includes('tv-player-episodes'), 'Botão de episódios presente');
assert.ok(html.includes('tv-player-audio'), 'Botão de áudio presente');
assert.ok(html.includes('tv-player-settings'), 'Botão de opções presente');
console.log('✓ Controles principais intactos e prontos para acionamento dos novos menus.');

console.log('\n========================================================================');
console.log('TODOS OS 7 TESTES DO REDESIGN DOS MENUS LATERAIS DO PLAYER DA TV PASSARAM!');
console.log('========================================================================');
