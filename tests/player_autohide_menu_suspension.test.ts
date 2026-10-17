import { describe, it, expect } from 'vitest';
import playerSource from '../src/components/player/ZapiPlayer.tsx?raw';

describe('ZapiPlayer - Regras de Suspensão de Auto-Hide com Menus Abertos', () => {

  it('deve conter a definição centralizada de hasOpenMenu contemplando todos os menus e modais do player', () => {
    expect(playerSource).toContain('hasOpenMenu = Boolean(');
    expect(playerSource).toContain('showAudioMenu ||');
    expect(playerSource).toContain('showQualityMenu ||');
    expect(playerSource).toContain('showSubtitlesMenu ||');
    expect(playerSource).toContain('showStyleEditor ||');
    expect(playerSource).toContain('showManualSkipModal ||');
    expect(playerSource).toContain('showDevDiagnostics ||');
  });

  it('deve manter shouldKeepControlsVisible ativo sempre que houver menu aberto ou player pausado', () => {
    expect(playerSource).toContain('shouldKeepControlsVisible = Boolean(');
    expect(playerSource).toContain('hasOpenMenu ||');
    expect(playerSource).toContain('!isPlaying ||');
    expect(playerSource).toContain('isLoading ||');
  });

  it('deve suspender imediatamente o timer no handleUserActivity se shouldKeepControlsVisible for verdadeiro', () => {
    // Garante que o timer não é agendado quando houver menu aberto
    const activityRegex = /if \(shouldKeepControlsVisibleRef\.current\) \{\s*return;\s*\}/;
    expect(activityRegex.test(playerSource)).toBe(true);
  });

  it('não deve ocultar controles nem cursor no handleMouseLeave se shouldKeepControlsVisible for verdadeiro', () => {
    const leaveRegex = /handleMouseLeave = useCallback\(\(\) => \{\s*\/\/[^\n]*\s*if \(shouldKeepControlsVisibleRef\.current\) \{\s*return;\s*\}/;
    expect(leaveRegex.test(playerSource)).toBe(true);
  });

  it('deve cancelar timers e manter controles visíveis via useEffect reativo ao abrir menus', () => {
    expect(playerSource).toContain('useEffect(() => {');
    expect(playerSource).toContain('if (shouldKeepControlsVisible) {');
    expect(playerSource).toContain('clearTimeout(activityTimeoutRef.current);');
    expect(playerSource).toContain('setIsCursorVisible(true);');
    expect(playerSource).toContain('setShowControls(true);');
  });

  it('deve restaurar o timer gradual de 2 segundos (sem ocultar instantaneamente) ao fechar o menu com vídeo tocando', () => {
    expect(playerSource).toContain('if (isPlaying) {');
    expect(playerSource).toContain('handleUserActivity();');
  });

  it('deve conter referências aos botões e popovers para detecção de clique externo', () => {
    expect(playerSource).toContain('ref={audioButtonRef}');
    expect(playerSource).toContain('ref={audioMenuRef}');
    expect(playerSource).toContain('ref={subtitlesButtonRef}');
    expect(playerSource).toContain('ref={subtitlesMenuRef}');
    expect(playerSource).toContain('ref={qualityButtonRef}');
    expect(playerSource).toContain('ref={qualityMenuRef}');
  });

  it('deve conter stopPropagation nos cliques e toques dentro dos menus para não disparar clique no player', () => {
    const audioMenuStop = playerSource.includes('ref={audioMenuRef}') && playerSource.includes('onClick={(e) => e.stopPropagation()}');
    expect(audioMenuStop).toBe(true);
  });

  it('deve fechar menus ao clicar na área do vídeo sem pausar a reprodução acidentalmente', () => {
    expect(playerSource).toContain('if (hasOpenMenu) {');
    expect(playerSource).toContain('closeAllInteractiveMenus();');
    expect(playerSource).toContain('setShowDevDiagnostics(false);');
    expect(playerSource).toContain('setShowManualSkipModal(false);');
    expect(playerSource).toContain('return;');
    expect(playerSource).toContain('togglePlay();');
  });

  it('deve fechar primeiro os menus na tecla Escape antes de fechar o player ou sair do fullscreen', () => {
    expect(playerSource).toContain("case 'Escape':");
    expect(playerSource).toContain('if (showAudioMenu || showQualityMenu || showSubtitlesMenu || showStyleEditor || showDevDiagnostics || showManualSkipModal) {');
    expect(playerSource).toContain('setShowAudioMenu(false);');
    expect(playerSource).toContain('setShowQualityMenu(false);');
    expect(playerSource).toContain('setShowSubtitlesMenu(false);');
    expect(playerSource).toContain('return;');
  });

  it('deve manter as barras superior e inferior visíveis na classe CSS quando hasOpenMenu for verdadeiro', () => {
    // Top bar
    expect(playerSource).toContain('(showControls || !isPlaying || hasOpenMenu) && !showNonDubbedPrompt ? \'opacity-100\' : \'opacity-0 pointer-events-none\'');
    // Bottom bar
    expect(playerSource).toContain('(showControls || !isPlaying || hasOpenMenu) && !showNonDubbedPrompt ? \'opacity-100\' : \'opacity-0 pointer-events-none\'');
  });
});
