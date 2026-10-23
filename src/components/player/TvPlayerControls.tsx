import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FocusContext, getCurrentFocusKey, setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import {
  ArrowLeft,
  Check,
  FastForward,
  Languages,
  ListVideo,
  Pause,
  Play,
  Rewind,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  SkipForward,
  X
} from 'lucide-react';
import { useTvFocusable } from '../../core/tv/useTvFocusable';
import { tvNavigationManager } from '../../core/tv/tvNavigationManager';
import { uiSoundService } from '../../core/audio/uiSoundService';
import type { AudioOption } from '../../core/audio/audioSelectionManager';
import type { SubtitleTrack } from '../../core/subtitles/subtitleService';
import type { SubtitleStyle } from '../../core/subtitles/subtitleStyleService';

export type TvMenuType = 'audio_subtitles' | 'episodes' | 'options' | null;

interface OptionItem {
  id: string;
  label: string;
  active?: boolean;
  action: () => void;
  badge?: string;
}

export interface TvPlayerEpisode {
  id: string;
  number: number;
  season?: number;
  title: string;
  description?: string;
  image?: string;
}

export interface TvPlayerControlsProps {
  title: string;
  season?: number;
  episode?: number;
  episodeTitle?: string;
  episodes?: TvPlayerEpisode[];
  visible: boolean;
  suspended: boolean;
  playing: boolean;
  intro: boolean;
  loading: boolean;
  currentTime: number;
  duration: number;
  canPlayPause: boolean;
  canSeek: boolean;
  canNext: boolean;
  audioOptions: AudioOption[];
  subtitleOptions: SubtitleTrack[];
  selectedSubtitleId: string;
  qualities: string[];
  selectedQuality: string;
  autoPlayEnabled: boolean;
  autoSkipEnabled: boolean;
  subtitleSize: 'sm' | 'md' | 'lg' | 'xl';
  subtitlePosition: number;
  subtitleStyle: SubtitleStyle;
  skipOffset: number;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onSkip: (seconds: number) => void;
  onClose: () => void;
  onHide?: () => void;
  onShow: () => void;
  onInteraction: () => void;
  onInteractionModeChange: (active: boolean) => void;
  onAudio: (option: AudioOption) => void;
  onSubtitle: (id: string) => void;
  onQuality: (quality: string) => void;
  onToggleAutoPlay: () => void;
  onToggleAutoSkip: () => void;
  onSubtitleSize: (size: 'sm' | 'md' | 'lg' | 'xl') => void;
  onSubtitlePosition: (position: number) => void;
  onSubtitleStyle: (updates: Partial<SubtitleStyle>) => void;
  onAdjustSkipOffset: (delta: number) => void;
  onResetSkipOffset: () => void;
  onNext?: () => void;
  onSelectEpisode?: (season: number, episode: number) => void;
  onReport: () => void;
}

const timeLabel = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

/** Botão de controle minimalista e simétrico com foco em anel cyan */
const ControlButton: React.FC<{
  focusKey: string;
  label: string;
  disabled?: boolean;
  isPrimary?: boolean;
  onPress: () => void;
  onFocusChange?: (label: string) => void;
  children: React.ReactNode;
}> = ({ focusKey, label, disabled, isPrimary, onPress, onFocusChange, children }) => {
  const { ref, focused } = useTvFocusable({
    focusKey,
    focusable: !disabled,
    onEnterPress: onPress,
    onFocus: () => onFocusChange?.(label),
    soundType: 'hover',
    enterSound: isPrimary ? 'confirm' : 'click',
    isPlayerControl: true
  });

  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      data-focus-key={focusKey}
      data-tv-focused={focused ? 'true' : undefined}
      onClick={onPress}
      aria-label={label}
      className={`relative flex items-center justify-center rounded-full outline-none select-none transition-all duration-150 ${
        isPrimary
          ? `w-14 h-14 md:w-16 md:h-16 ${
              focused
                ? 'bg-cyan-400 text-black ring-4 ring-cyan-300/40 shadow-[0_0_24px_rgba(0,229,255,0.7)] scale-105'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`
          : `w-12 h-12 md:w-13 md:h-13 ${
              focused
                ? 'bg-cyan-500/25 text-white ring-2 ring-cyan-300 shadow-[0_0_16px_rgba(0,229,255,0.4)] scale-105'
                : 'bg-white/10 text-white/85 hover:bg-white/20'
            }`
      } ${disabled ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
    >
      {children}
    </button>
  );
};

/** Timeline elegante com barra fina, progresso cyan e indicador discreto */
const Timeline: React.FC<{
  currentTime: number;
  duration: number;
  preview: number | null;
  disabled: boolean;
  onPreview: (time: number) => void;
  onConfirm: () => void;
  onFocus: () => void;
  onFocusChange?: (label: string) => void;
}> = ({ currentTime, duration, preview, disabled, onPreview, onConfirm, onFocus, onFocusChange }) => {
  const streakRef = useRef<{ count: number; lastTime: number; direction: string }>({
    count: 0,
    lastTime: 0,
    direction: ''
  });

  const { ref, focused } = useTvFocusable({
    focusKey: 'tv-player-timeline',
    focusable: !disabled,
    onEnterPress: onConfirm,
    onFocus: () => {
      onFocus();
      onFocusChange?.('Linha do Tempo (Navegue com Esquerda / Direita)');
    },
    soundType: 'hover',
    enterSound: 'confirm',
    isPlayerControl: true,
    onArrowPress: direction => {
      if (direction !== 'left' && direction !== 'right') return true;
      const now = Date.now();
      const streak = streakRef.current;
      if (streak.direction === direction && now - streak.lastTime < 400) {
        streak.count += 1;
      } else {
        streak.count = 1;
        streak.direction = direction;
      }
      streak.lastTime = now;

      // Aceleração progressiva no scrubbing da timeline (Padrão Apple TV)
      let step = 10;
      if (streak.count > 12) step = 120; // 2 minutos
      else if (streak.count > 7) step = 60; // 1 minuto
      else if (streak.count > 3) step = 30; // 30 segundos

      const delta = direction === 'right' ? step : -step;
      const base = preview ?? currentTime;
      uiSoundService.play('click', { playerControl: true });
      onPreview(Math.max(0, Math.min(duration, base + delta)));
      return false;
    }
  });

  const marker = preview ?? currentTime;
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (marker / duration) * 100)) : 0;

  return (
    <div
      ref={ref}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuenow={marker}
      aria-label={`Linha do tempo, ${timeLabel(marker)} de ${timeLabel(duration)}`}
      data-focus-key="tv-player-timeline"
      data-tv-focused={focused ? 'true' : undefined}
      onClick={onConfirm}
      className={`group w-full py-2.5 outline-none select-none transition-all cursor-pointer ${
        disabled ? 'opacity-35 pointer-events-none' : ''
      }`}
    >
      {/* Barra fina horizontal */}
      <div
        className={`w-full rounded-full relative transition-all duration-150 ${
          focused ? 'h-2 bg-white/35 ring-1 ring-cyan-300/40 shadow-[0_0_12px_rgba(0,229,255,0.3)]' : 'h-1.5 bg-white/20'
        }`}
      >
        {/* Preenchimento em Cyan ZapiTV */}
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-300 transition-all duration-75"
          style={{ width: `${progressPercent}%` }}
        />
        {/* Indicador circular moderno */}
        <span
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-white transition-all duration-100 ${
            focused
              ? 'w-4 h-4 ring-2 ring-cyan-300 shadow-[0_0_10px_rgba(0,229,255,0.8)] scale-110'
              : 'w-3 h-3 shadow-md'
          }`}
          style={{ left: `${progressPercent}%` }}
        />
      </div>

      {/* Indicadores de tempo elegantes e discretos */}
      <div className="mt-2 flex items-center justify-between text-[17px] font-medium text-gray-300 select-none">
        <span className={preview !== null ? 'text-cyan-300 font-bold' : ''}>
          {preview !== null ? `Ir para ${timeLabel(preview)} · OK confirma · Voltar cancela` : timeLabel(currentTime)}
        </span>
        <span>{timeLabel(duration)}</span>
      </div>
    </div>
  );
};

/** Opção dentro dos painéis secundários */
const DrawerOption: React.FC<{
  focusKey: string;
  option: OptionItem;
}> = ({ focusKey, option }) => {
  const { ref, focused } = useTvFocusable({
    focusKey,
    onEnterPress: option.action,
    soundType: 'hover',
    enterSound: 'toggle',
    isPlayerControl: true
  });

  return (
    <button
      ref={ref}
      type="button"
      data-focus-key={focusKey}
      data-tv-focused={focused ? 'true' : undefined}
      onClick={option.action}
      className={`w-full min-h-[56px] px-5 py-3.5 rounded-xl text-left flex items-center justify-between text-[18px] font-medium outline-none transition-all duration-150 select-none ${
        focused
          ? 'bg-cyan-500/25 ring-2 ring-cyan-300 text-white shadow-[0_0_14px_rgba(0,229,255,0.35)]'
          : option.active
          ? 'bg-white/10 text-cyan-300 font-semibold'
          : 'text-gray-200 bg-white/5 hover:bg-white/10'
      }`}
    >
      <div className="flex items-center gap-3 truncate">
        {option.badge && (
          <span className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-white/10 text-gray-300">
            {option.badge}
          </span>
        )}
        <span className="truncate">{option.label}</span>
      </div>
      {option.active && <Check className="w-5 h-5 text-cyan-300 shrink-0 ml-2" />}
    </button>
  );
};

export const TvPlayerControls: React.FC<TvPlayerControlsProps> = (props) => {
  const { ref, focusKey } = useFocusable({ focusKey: 'tv-player-controls-root', trackChildren: true });
  const [menu, setMenu] = useState<TvMenuType>(null);
  const [selectedSeason, setSelectedSeason] = useState<number>(() => props.season ?? 1);
  const [preview, setPreview] = useState<number | null>(null);
  const [menuOrigin, setMenuOrigin] = useState('tv-player-play');
  const [activeLabel, setActiveLabel] = useState<string>('Reproduzir / Pausar');
  const [seekFeedback, setSeekFeedback] = useState<{
    direction: 'forward' | 'rewind';
    accumulatedSeconds: number;
    speed?: 2 | 3 | 4;
    targetTime?: number;
    visible: boolean;
  } | null>(null);

  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const singleTapAccumRef = useRef<{ direction: 'forward' | 'rewind'; total: number; lastTime: number }>({
    direction: 'forward',
    total: 0,
    lastTime: 0
  });

  const scrubSessionRef = useRef<{
    active: boolean;
    direction: 'forward' | 'rewind';
    startTime: number;
    ticks: number;
    targetTime: number;
    commitTimer: NodeJS.Timeout | null;
  } | null>(null);

  const commitScrubSession = useCallback(() => {
    const session = scrubSessionRef.current;
    if (!session || !session.active) return;
    if (session.commitTimer) {
      clearTimeout(session.commitTimer);
    }
    const finalTarget = session.targetTime;
    scrubSessionRef.current = null;

    uiSoundService.play('confirm', { playerControl: true });
    props.onSeek(finalTarget);

    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => {
      setSeekFeedback(prev => (prev ? { ...prev, visible: false } : null));
      feedbackTimerRef.current = setTimeout(() => setSeekFeedback(null), 300);
    }, 600);
  }, [props.onSeek]);

  const cancelScrubSession = useCallback(() => {
    const session = scrubSessionRef.current;
    if (!session) return;
    if (session.commitTimer) clearTimeout(session.commitTimer);
    scrubSessionRef.current = null;
    setSeekFeedback(null);
  }, []);

  // Finalização de avanço/retrocesso acelerado no keyup físico (quando suportado)
  useEffect(() => {
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.keyCode === 37 || e.keyCode === 39) {
        if (scrubSessionRef.current?.active) {
          commitScrubSession();
        }
      }
    };
    window.addEventListener('keyup', handleKeyUp);
    return () => window.removeEventListener('keyup', handleKeyUp);
  }, [commitScrubSession]);

  // Limpeza de timers ao desmontar
  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      if (scrubSessionRef.current?.commitTimer) clearTimeout(scrubSessionRef.current.commitTimer);
    };
  }, []);

  const interactive = menu !== null || preview !== null;

  useEffect(() => props.onInteractionModeChange(interactive), [interactive, props.onInteractionModeChange]);
  useEffect(() => () => props.onInteractionModeChange(false), [props.onInteractionModeChange]);

  // Sincroniza temporada selecionada com o episódio atual
  useEffect(() => {
    if (props.season) setSelectedSeason(props.season);
  }, [props.season]);

  const openMenu = useCallback((next: Exclude<TvMenuType, null>, origin: string) => {
    uiSoundService.play('toggle', { playerControl: true });
    setMenuOrigin(origin);
    setMenu(next);
    props.onInteraction();
    requestAnimationFrame(() => setFocus(`tv-player-drawer-${next}-0`));
  }, [props.onInteraction]);

  const closeMenu = useCallback((silent = false) => {
    if (!menu) return;
    if (!silent) {
      uiSoundService.play('close', { playerControl: true });
    }
    setMenu(null);
    requestAnimationFrame(() => setFocus(menuOrigin));
  }, [menu, menuOrigin]);

  // Registro prioritário do comando Voltar (Hierarquia Apple TV)
  useEffect(() => tvNavigationManager.registerBackHandler('tv-player-controls', 250, () => {
    if (props.suspended) return false;
    // 1. Menu/Drawer aberto: fecha apenas o menu e restaura o foco no botão de origem
    if (menu) {
      closeMenu();
      return true;
    }
    // 2. Prévia de seek na timeline ativa: cancela e restaura a posição original sem salto
    if (preview !== null) {
      setPreview(null);
      setFocus('tv-player-timeline');
      return true;
    }
    // 3. Sessão de avanço/retrocesso acelerado ativa: cancela sem aplicar seek
    if (scrubSessionRef.current?.active) {
      cancelScrubSession();
      return true;
    }
    // 4. Controles visíveis: oculta os controles
    if (props.visible) {
      if (props.onHide) {
        props.onHide();
        return true;
      }
    }
    // 5. Controles ocultos: cai para o handler do zapi-player (prioridade 200) que retorna à página de detalhes
    return false;
  }), [props.suspended, menu, preview, props.visible, props.onHide, closeMenu, cancelScrubSession]);

  // Tratamento de atalhos e comandos do controle remoto (Padrão Apple TV)
  useEffect(() => tvNavigationManager.registerCommandHandler(event => {
    if (props.suspended || event.target instanceof HTMLInputElement) return false;
    const key = event.key;
    const keyCode = event.keyCode;

    // Tecla multimídia física do controle remoto (Play/Pause dedicado: 10252 no Tizen)
    if (key === 'MediaPlayPause' || keyCode === 10252) {
      if (props.canPlayPause) {
        uiSoundService.play('toggle', { playerControl: true });
        props.onTogglePlay();
      }
      props.onShow();
      return true;
    }

    const isDirectionKey =
      key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown' ||
      keyCode === 37 || keyCode === 38 || keyCode === 39 || keyCode === 40;

    const isSelectKey =
      key === 'Enter' || key === 'Select' || keyCode === 13 || keyCode === 10 || keyCode === 65385;

    // ESTADO 1: CONTROLES OCULTOS (!props.visible)
    if (!props.visible) {
      // Cima ou Baixo: revela a interface com foco no Play/Pause, sem pausar e sem alterar o tempo
      if (key === 'ArrowUp' || key === 'ArrowDown' || keyCode === 38 || keyCode === 40) {
        if (event.repeat) return true;
        props.onShow();
        requestAnimationFrame(() => setFocus('tv-player-play'));
        return true;
      }

      // OK/Enter: alternar reprodução e pausa
      if (isSelectKey) {
        if (event.repeat) return true;
        if (scrubSessionRef.current?.active) {
          commitScrubSession();
          return true;
        }
        const wasPlaying = props.playing;
        if (props.canPlayPause) {
          uiSoundService.play('toggle', { playerControl: true });
          props.onTogglePlay();
        }
        if (wasPlaying) {
          // Ao pausar, exibe os controles com foco no Play
          props.onShow();
          requestAnimationFrame(() => setFocus('tv-player-play'));
        } else {
          // Ao retomar, permite auto-ocultamento após inatividade
          props.onInteraction();
        }
        return true;
      }

      // Esquerda ou Direita: atalhos diretos de reprodução (Padrão Apple TV)
      const isFwd = key === 'ArrowRight' || keyCode === 39;
      const isRew = key === 'ArrowLeft' || keyCode === 37;
      if (isFwd || isRew) {
        if (!props.canSeek || props.intro || props.duration <= 0) return true;
        const dir: 'forward' | 'rewind' = isFwd ? 'forward' : 'rewind';

        // Pressionamento prolongado (long press / repetição de tecla contínua)
        if (event.repeat || (scrubSessionRef.current?.active && scrubSessionRef.current.direction === dir)) {
          let session = scrubSessionRef.current;
          if (!session || !session.active) {
            session = {
              active: true,
              direction: dir,
              startTime: Date.now(),
              ticks: 1,
              targetTime: Math.max(0, Math.min(props.duration, props.currentTime + (dir === 'forward' ? 10 : -10))),
              commitTimer: null
            };
            scrubSessionRef.current = session;
          } else {
            session.ticks += 1;
          }

          if (session.commitTimer) clearTimeout(session.commitTimer);

          // Velocidades progressivas Apple TV: 2x, 3x, 4x
          let speed: 2 | 3 | 4 = 2;
          let step = 20;
          if (session.ticks > 12) {
            speed = 4;
            step = 80;
          } else if (session.ticks > 6) {
            speed = 3;
            step = 40;
          }

          const nextTarget = Math.max(
            0,
            Math.min(props.duration, session.targetTime + (dir === 'forward' ? step : -step))
          );
          session.targetTime = nextTarget;

          setSeekFeedback({
            direction: dir,
            accumulatedSeconds: nextTarget - props.currentTime,
            speed,
            targetTime: nextTarget,
            visible: true
          });

          // Debounce de 450ms para comitar ao soltar a tecla
          session.commitTimer = setTimeout(() => {
            commitScrubSession();
          }, 450);

          return true;
        }

        // Toque individual curto (Single Tap: +10s / -10s)
        if (scrubSessionRef.current?.active) {
          commitScrubSession();
        }

        uiSoundService.play('click', { playerControl: true });
        props.onSkip(dir === 'forward' ? 10 : -10);

        const now = Date.now();
        const tap = singleTapAccumRef.current;
        let newTotal = dir === 'forward' ? 10 : -10;
        if (tap.direction === dir && now - tap.lastTime < 1400) {
          newTotal = tap.total + (dir === 'forward' ? 10 : -10);
        }
        tap.direction = dir;
        tap.total = newTotal;
        tap.lastTime = now;

        const targetEst = Math.max(0, Math.min(props.duration, props.currentTime + newTotal));

        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        setSeekFeedback({
          direction: dir,
          accumulatedSeconds: newTotal,
          targetTime: targetEst,
          visible: true
        });

        feedbackTimerRef.current = setTimeout(() => {
          setSeekFeedback(prev => (prev ? { ...prev, visible: false } : null));
          feedbackTimerRef.current = setTimeout(() => {
            setSeekFeedback(null);
            singleTapAccumRef.current.total = 0;
          }, 300);
        }, 1200);

        return true;
      }

      return false;
    }

    // ESTADO 2: CONTROLES VISÍVEIS (props.visible === true)
    if (isSelectKey) {
      if (event.repeat) return true;
      const current = getCurrentFocusKey();
      const element = Array.from(document.querySelectorAll<HTMLElement>('[data-focus-key]')).find(
        el => el.dataset.focusKey === current
      );
      element?.click();
      props.onInteraction();
      return true;
    }

    // Com os controles visíveis, setas direcionais navegam botões e timeline via Norigin
    if (isDirectionKey) {
      props.onInteraction();
      return false;
    }

    return false;
  }), [
    props.suspended,
    props.visible,
    props.playing,
    props.canPlayPause,
    props.canSeek,
    props.intro,
    props.duration,
    props.currentTime,
    props.onTogglePlay,
    props.onShow,
    props.onSkip,
    props.onSeek,
    props.onInteraction,
    commitScrubSession
  ]);

  // Foco inicial automático no botão de Play/Pause ao abrir os controles
  useEffect(() => {
    if (!props.visible || props.suspended || menu !== null) return;
    const id = requestAnimationFrame(() => setFocus('tv-player-play'));
    return () => cancelAnimationFrame(id);
  }, [props.visible, props.suspended, menu]);

  const choose = (action: () => void) => () => {
    uiSoundService.play('toggle', { playerControl: true });
    action();
    closeMenu(true);
  };

  // Temporadas disponíveis para animes/séries
  const availableSeasons = useMemo<number[]>(() => {
    if (!props.episodes || props.episodes.length === 0) return [1];
    const seasons = Array.from(new Set(props.episodes.map(e => e.season ?? 1)));
    return seasons.sort((a, b) => a - b);
  }, [props.episodes]);

  // Episódios da temporada atualmente selecionada no drawer
  const seasonEpisodes = useMemo<TvPlayerEpisode[]>(() => {
    if (props.episodes && props.episodes.length > 0) {
      const filtered = props.episodes.filter(e => (e.season ?? 1) === selectedSeason);
      if (filtered.length > 0) return filtered;
    }
    // Fallback gracioso quando a obra é série/anime com episódios conhecidos
    if (props.season && props.episode) {
      const count = Math.max(props.episode, 10);
      return Array.from({ length: count }, (_, i) => ({
        id: `ep-${selectedSeason}-${i + 1}`,
        number: i + 1,
        season: selectedSeason,
        title: props.episode === (i + 1) && props.episodeTitle ? props.episodeTitle : `Episódio ${i + 1}`
      }));
    }
    return [];
  }, [props.episodes, selectedSeason, props.season, props.episode, props.episodeTitle]);

  // Lista de opções para Áudio e Legendas (organizada em duas seções verticais)
  const audioSubOptions = useMemo<OptionItem[]>(() => {
    const items: OptionItem[] = [];

    // Seção de Áudio
    props.audioOptions.forEach(audio => {
      items.push({
        id: `audio-${audio.id}`,
        label: `${audio.flag} ${audio.label}`,
        badge: 'Áudio',
        active: audio.isCurrent,
        action: choose(() => props.onAudio(audio))
      });
    });

    // Seção de Legendas
    items.push({
      id: 'sub-off',
      label: 'Desativada (Sem Legenda)',
      badge: 'Legenda',
      active: props.selectedSubtitleId === 'off',
      action: choose(() => props.onSubtitle('off'))
    });

    props.subtitleOptions.forEach(sub => {
      items.push({
        id: `sub-${sub.id}`,
        label: `${sub.flag} ${sub.languageName}`,
        badge: 'Legenda',
        active: props.selectedSubtitleId === sub.id,
        action: choose(() => props.onSubtitle(sub.id))
      });
    });

    return items;
  }, [props.audioOptions, props.subtitleOptions, props.selectedSubtitleId, props.onAudio, props.onSubtitle, closeMenu]);

  // Lista de opções para "Mais Opções" (Qualidade, Autoplay, Autoskip, Legendas, Reporte)
  const generalOptions = useMemo<OptionItem[]>(() => {
    const sizes = ['sm', 'md', 'lg', 'xl'] as const;
    const sizeIndex = sizes.indexOf(props.subtitleSize);
    const cycle = <T extends string>(values: readonly T[], current: T): T =>
      values[(values.indexOf(current) + 1) % values.length];

    const items: OptionItem[] = [];

    // Qualidades de vídeo
    props.qualities.forEach(q => {
      items.push({
        id: `quality-${q}`,
        label: `Qualidade: ${q === 'auto' ? 'Automática' : q.toUpperCase()}`,
        badge: 'Vídeo',
        active: props.selectedQuality === q,
        action: choose(() => props.onQuality(q))
      });
    });

    // Configurações de Reprodução
    items.push(
      {
        id: 'auto-play',
        label: `Próximo episódio automático: ${props.autoPlayEnabled ? 'Sim' : 'Não'}`,
        badge: 'Reprodução',
        action: props.onToggleAutoPlay
      },
      {
        id: 'auto-skip',
        label: `Pular abertura e encerramento: ${props.autoSkipEnabled ? 'Sim' : 'Não'}`,
        badge: 'Reprodução',
        action: props.onToggleAutoSkip
      },
      {
        id: 'sub-size',
        label: `Tamanho da legenda: ${
          props.subtitleSize === 'sm'
            ? 'Pequena'
            : props.subtitleSize === 'md'
            ? 'Média'
            : props.subtitleSize === 'lg'
            ? 'Grande'
            : 'Extra Grande'
        }`,
        badge: 'Legendas',
        action: () => props.onSubtitleSize(sizes[(sizeIndex + 1) % sizes.length])
      },
      {
        id: 'sub-position-up',
        label: 'Subir posição da legenda',
        badge: 'Legendas',
        action: () => props.onSubtitlePosition(Math.min(35, props.subtitlePosition + 5))
      },
      {
        id: 'sub-position-down',
        label: 'Descer posição da legenda',
        badge: 'Legendas',
        action: () => props.onSubtitlePosition(Math.max(4, props.subtitlePosition - 5))
      },
      {
        id: 'sub-color',
        label: `Cor da legenda: ${props.subtitleStyle.color === '#00E5FF' ? 'Ciano' : props.subtitleStyle.color === '#FFE66D' ? 'Amarelo' : 'Branco'}`,
        badge: 'Legendas',
        action: () => props.onSubtitleStyle({ color: cycle(['#FFFFFF', '#FFE66D', '#00E5FF'], props.subtitleStyle.color) })
      },
      {
        id: 'sub-shadow',
        label: `Sombra da legenda: ${props.subtitleStyle.shadow}`,
        badge: 'Legendas',
        action: () => props.onSubtitleStyle({ shadow: cycle(['none', 'soft', 'strong', 'drop'] as const, props.subtitleStyle.shadow) })
      },
      {
        id: 'skip-offset-down',
        label: `Abertura: ${props.skipOffset}s · atrasar 1s`,
        badge: 'Sincronia',
        action: () => props.onAdjustSkipOffset(-1)
      },
      {
        id: 'skip-offset-up',
        label: `Abertura: ${props.skipOffset}s · adiantar 1s`,
        badge: 'Sincronia',
        action: () => props.onAdjustSkipOffset(1)
      },
      {
        id: 'skip-offset-reset',
        label: 'Restaurar ajuste de abertura',
        badge: 'Sincronia',
        action: props.onResetSkipOffset
      },
      {
        id: 'report-issue',
        label: 'Reportar problema neste título',
        badge: 'Suporte',
        action: choose(props.onReport)
      }
    );

    return items;
  }, [
    props.qualities,
    props.selectedQuality,
    props.autoPlayEnabled,
    props.autoSkipEnabled,
    props.subtitleSize,
    props.subtitlePosition,
    props.subtitleStyle,
    props.skipOffset,
    props.onQuality,
    props.onToggleAutoPlay,
    props.onToggleAutoSkip,
    props.onSubtitleSize,
    props.onSubtitlePosition,
    props.onSubtitleStyle,
    props.onAdjustSkipOffset,
    props.onResetSkipOffset,
    props.onReport,
    closeMenu
  ]);

  if (props.suspended) return null;

  const hasEpisodes = Boolean((props.episodes && props.episodes.length > 0) || (props.season && props.episode));

  return (
    <FocusContext.Provider value={focusKey}>
      {/* Indicador Discreto de Reprodução Acelerada / Salto Temporal (Padrão Apple TV) */}
      {seekFeedback && (
        <div
          role="status"
          aria-live="polite"
          data-testid="tv-player-seek-feedback"
          className={`fixed top-8 right-8 z-[95] pointer-events-none transition-all duration-300 transform ${
            seekFeedback.visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2'
          }`}
        >
          <div className="flex items-center gap-3 px-5 py-2.5 rounded-full bg-black/85 backdrop-blur-md border border-cyan-400/40 shadow-[0_4px_24px_rgba(0,229,255,0.3)] text-white select-none">
            {seekFeedback.direction === 'forward' ? (
              seekFeedback.speed ? (
                <FastForward className="w-5 h-5 text-cyan-300 animate-pulse" />
              ) : (
                <RotateCw className="w-5 h-5 text-cyan-300" />
              )
            ) : (
              seekFeedback.speed ? (
                <Rewind className="w-5 h-5 text-cyan-300 animate-pulse" />
              ) : (
                <RotateCcw className="w-5 h-5 text-cyan-300" />
              )
            )}
            <div className="flex items-center gap-2">
              <span className="text-[18px] font-black tracking-tight text-white drop-shadow">
                {seekFeedback.speed
                  ? `${seekFeedback.direction === 'forward' ? '>>' : '<<'} ${seekFeedback.speed}x`
                  : `${seekFeedback.accumulatedSeconds > 0 ? `+${seekFeedback.accumulatedSeconds}` : seekFeedback.accumulatedSeconds}s`}
              </span>
              {seekFeedback.targetTime !== undefined && (
                <span className="text-[14px] font-semibold text-cyan-200/90 pl-2 border-l border-white/20">
                  {timeLabel(seekFeedback.targetTime)}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <div
        ref={ref}
        data-focus-key={focusKey}
        className={`fixed inset-0 z-[80] pointer-events-none select-none overflow-hidden transition-opacity duration-200 ease-out ${
          props.visible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* TOPO: Botão voltar sutil e discreto no canto superior esquerdo */}
        <div className="absolute top-0 inset-x-0 px-[5vw] pt-[4vh] flex items-center justify-between pointer-events-none">
          <div className="pointer-events-auto">
            <ControlButton
              focusKey="tv-player-back"
              label="Voltar"
              onFocusChange={setActiveLabel}
              onPress={() => {
                uiSoundService.play('close', { playerControl: true });
                props.onClose();
              }}
            >
              <ArrowLeft className="w-6 h-6" />
            </ControlButton>
          </div>
        </div>

        {/* BASE: Degradê cinematográfico e controles organizados */}
        <div
          className={`absolute bottom-0 inset-x-0 px-[5vw] pb-[5vh] pt-36 bg-gradient-to-t from-black/95 via-black/55 to-transparent ${
            props.visible ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
          onClick={event => event.stopPropagation()}
        >
          {/* REGIÃO 1: Informações do conteúdo (Acima da timeline, sem caixas) */}
          <div className="mb-4 max-w-[70vw]">
            <h1 className="text-white text-[28px] sm:text-[32px] md:text-[36px] font-extrabold tracking-tight drop-shadow-md truncate">
              {props.title}
            </h1>
            {(props.season || props.episode || props.episodeTitle) && (
              <div className="mt-1 flex items-center gap-2 text-[18px] sm:text-[20px] font-medium text-cyan-300/90 drop-shadow">
                {props.season && props.episode && (
                  <span>Temporada {props.season} · Episódio {props.episode}</span>
                )}
                {props.episodeTitle && (
                  <>
                    <span className="text-gray-400">·</span>
                    <span className="text-gray-200 truncate">{props.episodeTitle}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* REGIÃO 2: Timeline horizontal fina com progresso cyan */}
          <Timeline
            currentTime={props.currentTime}
            duration={props.duration}
            preview={preview}
            disabled={!props.canSeek || props.intro || props.duration <= 0}
            onPreview={setPreview}
            onFocus={props.onInteraction}
            onFocusChange={setActiveLabel}
            onConfirm={() => {
              if (preview !== null) {
                uiSoundService.play('confirm', { playerControl: true });
                props.onSeek(preview);
                setPreview(null);
              }
            }}
          />

          {/* REGIÃO 3: Barra de controles unificada em grupos coerentes */}
          <div className="mt-3 sm:mt-4 flex items-center justify-between w-full">
            {/* Grupo Principal (Reprodução e Navegação Temporal) */}
            <div className="flex items-center gap-3">
              <ControlButton
                focusKey="tv-player-rewind"
                label="Voltar 10s"
                disabled={!props.canSeek || props.intro}
                onFocusChange={setActiveLabel}
                onPress={() => {
                  uiSoundService.play('click', { playerControl: true });
                  props.onSkip(-10);
                }}
              >
                <RotateCcw className="w-5 h-5" />
              </ControlButton>

              <ControlButton
                focusKey="tv-player-play"
                label={props.playing ? 'Pausar' : 'Reproduzir'}
                disabled={!props.canPlayPause}
                isPrimary={true}
                onFocusChange={setActiveLabel}
                onPress={() => {
                  uiSoundService.play('toggle', { playerControl: true });
                  props.onTogglePlay();
                }}
              >
                {props.playing ? (
                  <Pause className="w-7 h-7" />
                ) : (
                  <Play className="w-7 h-7 ml-0.5 fill-current" />
                )}
              </ControlButton>

              <ControlButton
                focusKey="tv-player-forward"
                label="Avançar 10s"
                disabled={!props.canSeek || props.intro}
                onFocusChange={setActiveLabel}
                onPress={() => {
                  uiSoundService.play('click', { playerControl: true });
                  props.onSkip(10);
                }}
              >
                <RotateCw className="w-5 h-5" />
              </ControlButton>

              {props.onNext && props.canNext && (
                <ControlButton
                  focusKey="tv-player-next"
                  label="Próximo Episódio"
                  disabled={!props.canNext}
                  onFocusChange={setActiveLabel}
                  onPress={() => {
                    uiSoundService.play('watch', { playerControl: true });
                    props.onNext?.();
                  }}
                >
                  <SkipForward className="w-5 h-5" />
                </ControlButton>
              )}
            </div>

            {/* Indicação Contextual Central (Zero Layout Shift) */}
            <div className="flex-1 px-4 text-center hidden sm:block">
              <span className="text-[17px] font-semibold text-gray-300 drop-shadow-md tracking-wide transition-opacity duration-150 inline-block">
                {activeLabel}
              </span>
            </div>

            {/* Grupo Secundário (Episódios, Áudio & Legendas, Mais Opções) */}
            <div className="flex items-center gap-3">
              {hasEpisodes && (
                <ControlButton
                  focusKey="tv-player-episodes"
                  label="Episódios"
                  onFocusChange={setActiveLabel}
                  onPress={() => openMenu('episodes', 'tv-player-episodes')}
                >
                  <ListVideo className="w-5 h-5" />
                </ControlButton>
              )}

              <ControlButton
                focusKey="tv-player-audio"
                label="Áudio e Legendas"
                disabled={!props.audioOptions.length && !props.subtitleOptions.length}
                onFocusChange={setActiveLabel}
                onPress={() => openMenu('audio_subtitles', 'tv-player-audio')}
              >
                <Languages className="w-5 h-5" />
              </ControlButton>

              <ControlButton
                focusKey="tv-player-settings"
                label="Mais Opções"
                onFocusChange={setActiveLabel}
                onPress={() => openMenu('options', 'tv-player-settings')}
              >
                <SlidersHorizontal className="w-5 h-5" />
              </ControlButton>
            </div>
          </div>

          {props.loading && (
            <p className="text-center text-sm text-cyan-300 mt-2 font-medium">Preparando reprodução...</p>
          )}
        </div>

        {/* DRAWER SECUNDÁRIO: Áudio e Legendas, Episódios ou Opções */}
        {menu && (
          <div
            className="absolute inset-0 z-30 bg-black/65 backdrop-blur-sm flex items-center justify-end pointer-events-auto animate-in fade-in duration-200"
            onClick={() => closeMenu()}
          >
            <div
              className="h-full w-[min(540px,85vw)] bg-[#0b1019]/95 border-l border-white/10 px-8 py-10 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-250"
              onClick={event => event.stopPropagation()}
            >
              {/* Cabeçalho do Drawer */}
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <h3 className="text-2xl font-black text-white tracking-tight">
                    {menu === 'audio_subtitles'
                      ? 'Áudio e Legendas'
                      : menu === 'episodes'
                      ? 'Episódios'
                      : 'Opções'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => closeMenu()}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label="Fechar painel"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">Pressione Voltar no controle para fechar</p>

                {/* Seletor de Temporadas (quando aplicável no menu de episódios) */}
                {menu === 'episodes' && availableSeasons.length > 1 && (
                  <div className="flex items-center gap-2 mt-4 pb-2 overflow-x-auto no-scrollbar">
                    {availableSeasons.map(s => (
                      <button
                        key={`season-btn-${s}`}
                        type="button"
                        onClick={() => {
                          uiSoundService.play('toggle', { playerControl: true });
                          setSelectedSeason(s);
                        }}
                        className={`px-3.5 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                          selectedSeason === s
                            ? 'bg-cyan-500 text-black'
                            : 'bg-white/10 text-gray-300 hover:bg-white/20'
                        }`}
                      >
                        Temporada {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Lista com rolagem vertical suave */}
              <div className="flex-1 my-6 overflow-y-auto no-scrollbar space-y-2 pr-1">
                {menu === 'audio_subtitles' ? (
                  audioSubOptions.length > 0 ? (
                    audioSubOptions.map((option, index) => (
                      <DrawerOption
                        key={`audio-sub-${option.id}`}
                        focusKey={`tv-player-drawer-audio_subtitles-${index}`}
                        option={option}
                      />
                    ))
                  ) : (
                    <p className="text-gray-400 py-4">Nenhuma opção de áudio ou legenda disponível.</p>
                  )
                ) : menu === 'episodes' ? (
                  seasonEpisodes.length > 0 ? (
                    seasonEpisodes.map((ep, index) => {
                      const isCurrent =
                        (ep.season ?? 1) === (props.season ?? 1) && ep.number === props.episode;
                      const hasDistinctTitle =
                        ep.title &&
                        ep.title !== `Episódio ${ep.number}` &&
                        ep.title !== `Episode ${ep.number}`;
                      const label = hasDistinctTitle
                        ? `Episódio ${ep.number} · ${ep.title}`
                        : `Episódio ${ep.number}`;
                      return (
                        <DrawerOption
                          key={`ep-${ep.id || ep.number}`}
                          focusKey={`tv-player-drawer-episodes-${index}`}
                          option={{
                            id: `ep-${ep.number}`,
                            label,
                            badge: isCurrent ? 'Atual' : undefined,
                            active: isCurrent,
                            action: choose(() => {
                              props.onSelectEpisode?.(selectedSeason, ep.number);
                            })
                          }}
                        />
                      );
                    })
                  ) : (
                    <p className="text-gray-400 py-4">Nenhum episódio encontrado para esta temporada.</p>
                  )
                ) : generalOptions.length > 0 ? (
                  generalOptions.map((option, index) => (
                    <DrawerOption
                      key={`options-${option.id}`}
                      focusKey={`tv-player-drawer-options-${index}`}
                      option={option}
                    />
                  ))
                ) : (
                  <p className="text-gray-400 py-4">Nenhuma opção disponível.</p>
                )}
              </div>

              {/* Rodapé informativo discreto */}
              <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-gray-400">
                <span>ZapiTV Cinema Engine</span>
                <span>OK confirma seleção</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </FocusContext.Provider>
  );
};
