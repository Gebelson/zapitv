import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('ZapiTV — Player Completo Visível Durante a Intro Institucional', () => {
  const zapiPlayerPath = path.join(process.cwd(), 'src/components/player/ZapiPlayer.tsx');
  const zapiPlayerContent = fs.readFileSync(zapiPlayerPath, 'utf-8');

  it('Requisito 1 & 2: A vinheta oficial é reproduzida dentro de player-video-stage e não como overlay z-[3000] global', () => {
    // Verifica que não existe mais overlay global z-[3000] cobrindo todo o player
    expect(zapiPlayerContent).not.toMatch(/z-\[3000\]\s+bg-black/);
    
    // Verifica que a intro está dentro do palco de vídeo com z-20
    expect(zapiPlayerContent).toContain('{/* Vinheta Oficial ZapiTV (Intro Video no Palco do Player com Fade Suave) */}');
    expect(zapiPlayerContent).toMatch(/isPlayingIntro\s*&&\s*\(\s*<div\s+className={`absolute inset-0 z-20 bg-black/);
    expect(zapiPlayerContent).toContain('src="/intro.mp4"');
  });

  it('Requisito 3: A barra de cabeçalho (z-50) e a barra de controles (z-40) ficam sobrepostas à vinheta e visíveis', () => {
    // Header Bar z-50
    expect(zapiPlayerContent).toMatch(/Top Header Bar[\s\S]*?z-50[\s\S]*?showControls/);
    
    // Bottom Controls Bar z-40
    expect(zapiPlayerContent).toMatch(/Bottom Controls Bar[\s\S]*?z-40[\s\S]*?showControls/);
  });

  it('Requisito 3 & 7: Scrubber de tempo e linha de progresso permanecem travados em 00:00 durante a intro', () => {
    // Linha azul de progresso travada em 00:00 durante intro
    expect(zapiPlayerContent).toContain("style={{ width: `${((isPlayingIntro ? 0 : currentTime) / (duration || 1)) * 100}%` }}");
    
    // Scrubber input travado e desabilitado durante isPlayingIntro
    expect(zapiPlayerContent).toContain('value={isPlayingIntro ? 0 : currentTime}');
    expect(zapiPlayerContent).toContain('disabled={isPlayingIntro}');
    expect(zapiPlayerContent).toContain('if (isPlayingIntro) return;');

    // Exibição textual de tempo inicia em 00:00 sem computar duração da intro
    expect(zapiPlayerContent).toContain('{formatTime(isPlayingIntro ? 0 : currentTime)} / {formatTime(duration)}');
  });

  it('Requisito 3: Controles de avanço (-10s / +10s) e troca de episódio são bloqueados durante a intro', () => {
    // Botões de -10s e +10s desabilitados
    expect(zapiPlayerContent).toMatch(/onClick=\{\(\) => skipTime\(-10\)\}[\s\S]*?disabled=\{isPlayingIntro\}/);
    expect(zapiPlayerContent).toMatch(/onClick=\{\(\) => skipTime\(10\)\}[\s\S]*?disabled=\{isPlayingIntro\}/);
    
    // Função skipTime bloqueia seek se isPlayingIntroRef for true
    expect(zapiPlayerContent).toMatch(/const skipTime = useCallback\(\(seconds: number\) => \{\s*if \(isPlayingIntroRef\.current\) return;/);

    // Botão de Próximo Episódio desabilitado durante intro
    expect(zapiPlayerContent).toMatch(/disabled=\{isLoadingStreams \|\| isPlayingIntro\}/);
  });

  it('Requisito 3: Teclas de atalho de seek e próximo episódio são bloqueadas e barra de espaço pausa/reproduz a intro', () => {
    // ArrowRight / ArrowLeft bloqueados
    expect(zapiPlayerContent).toMatch(/case 'ArrowRight':[\s\S]*?if \(!isPlayingIntroRef\.current\) \{\s*skipTime\(10\);/);
    expect(zapiPlayerContent).toMatch(/case 'ArrowLeft':[\s\S]*?if \(!isPlayingIntroRef\.current\) \{\s*skipTime\(-10\);/);
    
    // Tecla 's' pula a intro durante isPlayingIntro
    expect(zapiPlayerContent).toMatch(/case 's':[\s\S]*?case 'S':[\s\S]*?if \(isPlayingIntroRef\.current\) \{\s*e\.preventDefault\(\);\s*handleSkipIntro\(\);/);

    // Tecla 'n' bloqueada durante intro
    expect(zapiPlayerContent).toMatch(/case 'n':[\s\S]*?case 'N':[\s\S]*?if \(onNextEpisode && !isLoadingStreams && !isPlayingIntroRef\.current\)/);
  });

  it('Requisito 4 & 8: O vídeo principal é preparado e pré-bufferizado com muted e sem vazamento de som', () => {
    // Vídeo principal silenciado durante a intro
    expect(zapiPlayerContent).toContain('muted={isPlayingIntro || isMuted}');
    
    // startIntroIfReady pausa e muta o vídeo principal
    expect(zapiPlayerContent).toMatch(/video\.pause\(\);\s*video\.muted = true;/);

    // Isolamento estrito de áudio via useEffect
    expect(zapiPlayerContent).toMatch(/if \(isPlayingIntro\) \{\s*video\.muted = true;\s*\} else \{\s*video\.muted = isMuted;/);
  });

  it('Requisito 5 & 6: Fade suave (700ms) substitui a intro pelo filme sem piscar, fechar ou reabrir o player', () => {
    // Fade out suave de 700ms
    expect(zapiPlayerContent).toContain('transition-opacity duration-700 ease-in-out');
    expect(zapiPlayerContent).toContain("isIntroFading ? 'opacity-0 pointer-events-none' : 'opacity-100'");

    // Transição suave inicia playback do filme na mesma instância
    expect(zapiPlayerContent).toMatch(/video\.muted = isMuted;\s*video\.volume = volume;\s*video\.play\(\)/);
    expect(zapiPlayerContent).toContain('setIsIntroFading(true)');
  });

  it('Requisito 9: Volume e Mute sincronizam a intro e preservam preferências para o conteúdo principal', () => {
    // changeVolume altera tanto o vídeo principal quanto a intro
    expect(zapiPlayerContent).toMatch(/if \(intro && isPlayingIntroRef\.current\) \{\s*intro\.volume = val;\s*intro\.muted = val === 0;\s*\}/);

    // toggleMute altera tanto o vídeo principal quanto a intro
    expect(zapiPlayerContent).toMatch(/if \(intro && isPlayingIntroRef\.current\) \{\s*intro\.muted = false;\s*intro\.volume = targetVol;\s*\}/);

    // Effect de sincronização em tempo real de áudio
    expect(zapiPlayerContent).toMatch(/intro\.muted = isMuted;\s*intro\.volume = volume;/);
  });

  it('Requisito 10: Intro reproduzida apenas uma vez por sessão manual', () => {
    expect(zapiPlayerContent).toMatch(/if \(navigationType === 'continuous_playback' \|\| navigationType === 'retry_playback'\) \{\s*return false;\s*\}/);
    expect(zapiPlayerContent).toContain('playbackSessionService.markIntroPlayed');
  });

  it('Botão Pular Intro é posicionado em z-50 acima da barra de controles no canto inferior direito', () => {
    expect(zapiPlayerContent).toMatch(/isPlayingIntro && \(!isIntroEnded \|\| !isMediaReady\) && !showNonDubbedPrompt[\s\S]*?bottom-24 sm:bottom-28 right-4 sm:right-8 z-50/);
    expect(zapiPlayerContent).toContain('Pular Intro');
  });
});
