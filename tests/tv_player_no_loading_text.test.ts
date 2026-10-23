import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TvPlayerControls } from '../src/components/player/TvPlayerControls';

console.log('========================================================================');
console.log('--- TESTE: REMOÇÃO DE TEXTOS DE CARREGAMENTO ABAIXO DO PLAYER (TV) ---');
console.log('========================================================================\n');

const mockProps = {
  title: 'Interestelar',
  season: 1,
  episode: 1,
  episodeTitle: 'A Missão Começa',
  visible: true,
  suspended: false,
  playing: false,
  intro: false,
  loading: true,
  currentTime: 120,
  duration: 3600,
  canPlayPause: true,
  canSeek: true,
  canNext: true,
  audioOptions: [],
  subtitleOptions: [],
  selectedSubtitleId: 'off',
  qualities: ['1080p', '720p', 'auto'],
  selectedQuality: '1080p',
  autoPlayEnabled: true,
  autoSkipEnabled: true,
  subtitleSize: 'md' as const,
  subtitlePosition: 8,
  subtitleStyle: {
    fontSize: 'md' as const,
    verticalPosition: 8,
    color: '#FFFFFF',
    bgColor: 'none',
    outline: 'medium',
    shadow: 'strong' as const,
    lineSpacing: 'normal'
  },
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
  onReport: () => {}
};

// 1. Verificação Estática de Código em TvPlayerControls.tsx
console.log('--- Cenário 1: Inspeção de código em TvPlayerControls.tsx ---');
const controlsSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/player/TvPlayerControls.tsx'),
  'utf-8'
);

assert.ok(
  !controlsSource.includes('Preparando reprodução...'),
  'TvPlayerControls.tsx não deve conter o texto "Preparando reprodução..."'
);
assert.ok(
  !controlsSource.includes('Carregando...'),
  'TvPlayerControls.tsx não deve conter o texto "Carregando..."'
);
assert.ok(
  !controlsSource.includes('Buffering...'),
  'TvPlayerControls.tsx não deve conter o texto "Buffering..."'
);
console.log('✔ Cenário 1: Código-fonte de TvPlayerControls limpo de mensagens textuais de carregamento OK');

// 2. Verificação de Renderização com loading = true
console.log('\n--- Cenário 2: Renderização com loading=true ---');
const markupLoadingTrue = renderToStaticMarkup(
  React.createElement(TvPlayerControls, { ...mockProps, loading: true })
);

assert.ok(
  !markupLoadingTrue.includes('Preparando reprodução'),
  'Markup com loading=true não deve renderizar "Preparando reprodução"'
);
assert.ok(
  !markupLoadingTrue.includes('Carregando'),
  'Markup com loading=true não deve renderizar "Carregando"'
);
assert.ok(
  !markupLoadingTrue.includes('Buffering'),
  'Markup com loading=true não deve renderizar "Buffering"'
);
console.log('✔ Cenário 2: Renderização com loading=true 100% limpa de textos de status OK');

// 3. Verificação de Renderização com loading = false
console.log('\n--- Cenário 3: Renderização com loading=false ---');
const markupLoadingFalse = renderToStaticMarkup(
  React.createElement(TvPlayerControls, { ...mockProps, loading: false })
);

assert.ok(
  !markupLoadingFalse.includes('Preparando reprodução'),
  'Markup com loading=false não deve renderizar "Preparando reprodução"'
);
console.log('✔ Cenário 3: Renderização com loading=false limpa OK');

// 4. Preservação da Barra de Controles e Botões Principais
console.log('\n--- Cenário 4: Preservação dos botões e controles do player ---');
assert.ok(
  markupLoadingTrue.includes('tv-player-play'),
  'Botão Play/Pause deve estar presente'
);
assert.ok(
  markupLoadingTrue.includes('tv-player-rewind'),
  'Botão Rewind (-10s) deve estar presente'
);
assert.ok(
  markupLoadingTrue.includes('tv-player-forward'),
  'Botão Forward (+10s) deve estar presente'
);
assert.ok(
  markupLoadingTrue.includes('tv-player-timeline'),
  'Timeline deve estar presente'
);
console.log('✔ Cenário 4: Estrutura, botões e timeline preservados intactos OK');

// 5. Preservação de Telas de Erro e Decisões do Usuário em ZapiPlayer.tsx
console.log('\n--- Cenário 5: Preservação de erros e ações do usuário em ZapiPlayer.tsx ---');
const playerSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/player/ZapiPlayer.tsx'),
  'utf-8'
);

assert.ok(
  playerSource.includes('Fonte Indisponível'),
  'ZapiPlayer deve manter aviso de Fonte Indisponível para erros reais'
);
assert.ok(
  playerSource.includes('Tentar Novamente'),
  'ZapiPlayer deve manter ação de Tentar Novamente para o usuário'
);
assert.ok(
  playerSource.includes('<ZapiLoader size="lg" />'),
  'ZapiPlayer deve manter indicador visual de spinner gráfico'
);
console.log('✔ Cenário 5: Indicadores visuais e avisos de erro preservados OK');

console.log('\n========================================================================');
console.log('TODOS OS 5 CENÁRIOS DE REMOÇÃO DE TEXTOS DE CARREGAMENTO PASSARAM!');
console.log('========================================================================');
