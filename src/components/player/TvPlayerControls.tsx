import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FocusContext, getCurrentFocusKey, setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { ArrowLeft, Check, Languages, Pause, Play, RotateCcw, RotateCw, Settings, SkipForward, Subtitles, AlertCircle } from 'lucide-react';
import { useTvFocusable } from '../../core/tv/useTvFocusable';
import { tvNavigationManager } from '../../core/tv/tvNavigationManager';
import { uiSoundService } from '../../core/audio/uiSoundService';
import type { AudioOption } from '../../core/audio/audioSelectionManager';
import type { SubtitleTrack } from '../../core/subtitles/subtitleService';
import type { SubtitleStyle } from '../../core/subtitles/subtitleStyleService';

type Menu = 'audio' | 'subtitles' | 'quality' | 'settings' | null;
type Option = { id: string; label: string; active?: boolean; action: () => void };

interface Props {
  title: string;
  season?: number;
  episode?: number;
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
  onReport: () => void;
}

const timeLabel = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}` : `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const ControlButton: React.FC<{ focusKey: string; label: string; disabled?: boolean; active?: boolean; onPress: () => void; children: React.ReactNode }> = ({ focusKey, label, disabled, active, onPress, children }) => {
  const { ref, focused } = useTvFocusable({
    focusKey,
    focusable: !disabled,
    onEnterPress: onPress,
    onFocus: () => {},
    soundType: 'hover',
    enterSound: 'click',
    isPlayerControl: true
  });
  return <button ref={ref} type="button" disabled={disabled} data-focus-key={focusKey} data-tv-focused={focused ? 'true' : undefined}
    onClick={onPress} aria-label={label}
    className={`min-w-[76px] h-16 px-4 rounded-2xl border flex flex-col items-center justify-center gap-1 text-white text-xs font-bold outline-none transition-colors ${focused ? 'border-cyan-300 bg-cyan-500/25 shadow-[0_0_18px_rgba(0,229,255,.35)]' : active ? 'border-cyan-500/40 bg-cyan-500/15' : 'border-white/15 bg-white/10'} ${disabled ? 'opacity-40' : ''}`}>
    {children}<span>{label}</span>
  </button>;
};

const Timeline: React.FC<{ currentTime: number; duration: number; preview: number | null; disabled: boolean; onPreview: (time: number) => void; onConfirm: () => void; onFocus: () => void }> = ({ currentTime, duration, preview, disabled, onPreview, onConfirm, onFocus }) => {
  const { ref, focused } = useTvFocusable({
    focusKey: 'tv-player-timeline',
    focusable: !disabled,
    onEnterPress: onConfirm,
    onFocus,
    soundType: 'hover',
    enterSound: 'confirm',
    isPlayerControl: true,
    onArrowPress: direction => {
      if (direction !== 'left' && direction !== 'right') return true;
      const base = preview ?? currentTime;
      uiSoundService.play('click', { playerControl: true });
      onPreview(Math.max(0, Math.min(duration, base + (direction === 'right' ? 10 : -10))));
      return false;
    }
  });
  const marker = preview ?? currentTime;
  return <button ref={ref} type="button" disabled={disabled} data-focus-key="tv-player-timeline" data-tv-focused={focused ? 'true' : undefined}
    onClick={onConfirm} aria-label={`Linha do tempo, ${timeLabel(marker)} de ${timeLabel(duration)}`}
    className={`w-full rounded-xl px-3 py-4 text-left outline-none ${focused ? 'bg-white/15 ring-2 ring-cyan-300' : 'bg-white/5'} ${disabled ? 'opacity-40' : ''}`}>
    <div className="h-2 w-full rounded-full bg-white/30 relative">
      <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400" style={{ width: `${Math.min(100, duration > 0 ? marker / duration * 100 : 0)}%` }} />
      <span className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-lg" style={{ left: `${Math.min(100, duration > 0 ? marker / duration * 100 : 0)}%` }} />
    </div>
    <div className="mt-3 flex justify-between text-sm font-bold text-gray-200"><span>{preview !== null ? `Ir para ${timeLabel(preview)} · OK confirma` : timeLabel(currentTime)}</span><span>{timeLabel(duration)}</span></div>
  </button>;
};

const MenuOption: React.FC<{ focusKey: string; option: Option }> = ({ focusKey, option }) => {
  const { ref, focused } = useTvFocusable({
    focusKey,
    onEnterPress: option.action,
    soundType: 'hover',
    enterSound: 'toggle',
    isPlayerControl: true
  });
  return <button ref={ref} type="button" data-focus-key={focusKey} data-tv-focused={focused ? 'true' : undefined} onClick={option.action}
    className={`w-full min-h-14 px-5 py-3 rounded-xl text-left flex items-center justify-between text-lg font-bold outline-none ${focused ? 'bg-cyan-500/25 ring-2 ring-cyan-300 text-white' : option.active ? 'bg-blue-500/25 text-white' : 'text-gray-200 bg-white/5'}`}>
    <span>{option.label}</span>{option.active && <Check className="w-5 h-5 text-cyan-300" />}
  </button>;
};

export const TvPlayerControls: React.FC<Props> = (props) => {
  const { ref, focusKey } = useFocusable({ focusKey: 'tv-player-controls-root', trackChildren: true });
  const [menu, setMenu] = useState<Menu>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [menuOrigin, setMenuOrigin] = useState('tv-player-play');
  const interactive = menu !== null || preview !== null;

  useEffect(() => props.onInteractionModeChange(interactive), [interactive, props.onInteractionModeChange]);
  useEffect(() => () => props.onInteractionModeChange(false), [props.onInteractionModeChange]);

  const openMenu = useCallback((next: Exclude<Menu, null>, origin: string) => {
    uiSoundService.play('toggle', { playerControl: true });
    setMenuOrigin(origin);
    setMenu(next);
    props.onInteraction();
    requestAnimationFrame(() => setFocus(`tv-player-option-${next}-0`));
  }, [props.onInteraction]);

  const closeMenu = useCallback((silent = false) => {
    if (!menu) return;
    if (!silent) {
      uiSoundService.play('close', { playerControl: true });
    }
    setMenu(null);
    requestAnimationFrame(() => setFocus(menuOrigin));
  }, [menu, menuOrigin]);

  useEffect(() => tvNavigationManager.registerBackHandler('tv-player-controls', 250, () => {
    if (props.suspended) return false;
    if (menu) { closeMenu(); return true; }
    if (preview !== null) { setPreview(null); setFocus('tv-player-timeline'); return true; }
    return false;
  }), [props.suspended, menu, preview, closeMenu]);

  useEffect(() => tvNavigationManager.registerCommandHandler(event => {
    if (props.suspended || event.target instanceof HTMLInputElement) return false;
    const key = event.key;
    if (key === 'MediaPlayPause' || event.keyCode === 10252) {
      if (props.canPlayPause) {
        uiSoundService.play('toggle', { playerControl: true });
        props.onTogglePlay();
      }
      props.onShow();
      return true;
    }
    if (props.visible) {
      if (key === 'Enter' || key === 'Select' || event.keyCode === 13 || event.keyCode === 10) {
        const current = getCurrentFocusKey();
        const button = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-focus-key]')).find(element => element.dataset.focusKey === current);
        button?.click();
        props.onInteraction();
        return true;
      }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) props.onInteraction();
      return false;
    }
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      if (props.canSeek && !props.intro) {
        uiSoundService.play('click', { playerControl: true });
        props.onSkip(key === 'ArrowLeft' ? -10 : 10);
      }
      return true;
    }
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      props.onShow();
      requestAnimationFrame(() => setFocus('tv-player-play'));
      return true;
    }
    if (key === 'Enter' || key === 'Select' || event.keyCode === 13 || event.keyCode === 10) {
      if (props.canPlayPause) {
        uiSoundService.play('toggle', { playerControl: true });
        props.onTogglePlay();
      }
      props.onShow();
      requestAnimationFrame(() => setFocus('tv-player-play'));
      return true;
    }
    return false;
  }), [props.suspended, props.visible, props.canPlayPause, props.canSeek, props.intro, props.onTogglePlay, props.onShow, props.onSkip, props.onInteraction]);

  useEffect(() => {
    if (!props.visible || props.suspended) return;
    const id = requestAnimationFrame(() => setFocus('tv-player-play'));
    return () => cancelAnimationFrame(id);
  }, [props.visible, props.suspended]);

  const choose = (action: () => void) => () => {
    uiSoundService.play('toggle', { playerControl: true });
    action();
    closeMenu(true);
  };
  const options = useMemo<Option[]>(() => {
    if (menu === 'audio') return props.audioOptions.map(option => ({ id: option.id, label: `${option.flag} ${option.label}`, active: option.isCurrent, action: choose(() => props.onAudio(option)) }));
    if (menu === 'subtitles') return [
      { id: 'off', label: 'Sem legenda', active: props.selectedSubtitleId === 'off', action: choose(() => props.onSubtitle('off')) },
      ...props.subtitleOptions.map(option => ({ id: option.id, label: `${option.flag} ${option.languageName}`, active: props.selectedSubtitleId === option.id, action: choose(() => props.onSubtitle(option.id)) }))
    ];
    if (menu === 'quality') return props.qualities.map(q => ({ id: q, label: q === 'auto' ? 'Automática' : q.toUpperCase(), active: props.selectedQuality === q, action: choose(() => props.onQuality(q)) }));
    if (menu === 'settings') {
      const sizes = ['sm', 'md', 'lg', 'xl'] as const;
      const sizeIndex = sizes.indexOf(props.subtitleSize);
      const cycle = <T extends string>(values: readonly T[], current: T): T => values[(values.indexOf(current) + 1) % values.length];
      return [
      { id: 'auto-play', label: `Próximo episódio automático: ${props.autoPlayEnabled ? 'Sim' : 'Não'}`, action: props.onToggleAutoPlay },
      { id: 'auto-skip', label: `Pular abertura/créditos: ${props.autoSkipEnabled ? 'Sim' : 'Não'}`, action: props.onToggleAutoSkip },
      { id: 'subtitle-smaller', label: 'Diminuir tamanho da legenda', action: () => props.onSubtitleSize(sizes[Math.max(0, sizeIndex - 1)]) },
      { id: 'subtitle-larger', label: 'Aumentar tamanho da legenda', action: () => props.onSubtitleSize(sizes[Math.min(3, sizeIndex + 1)]) },
      { id: 'subtitle-up', label: 'Subir legenda', action: () => props.onSubtitlePosition(Math.min(35, props.subtitlePosition + 5)) },
      { id: 'subtitle-down', label: 'Descer legenda', action: () => props.onSubtitlePosition(Math.max(4, props.subtitlePosition - 5)) },
      { id: 'subtitle-color', label: `Cor da legenda: ${props.subtitleStyle.color}`, action: () => props.onSubtitleStyle({ color: cycle(['#FFFFFF', '#FFE66D', '#00E5FF'], props.subtitleStyle.color) }) },
      { id: 'subtitle-background', label: `Fundo da legenda: ${props.subtitleStyle.bgColor}`, action: () => props.onSubtitleStyle({ bgColor: cycle(['none', 'semi', 'solid'] as const, props.subtitleStyle.bgColor) }) },
      { id: 'subtitle-outline', label: `Contorno da legenda: ${props.subtitleStyle.outline}`, action: () => props.onSubtitleStyle({ outline: cycle(['none', 'thin', 'medium', 'thick'] as const, props.subtitleStyle.outline) }) },
      { id: 'subtitle-shadow', label: `Sombra da legenda: ${props.subtitleStyle.shadow}`, action: () => props.onSubtitleStyle({ shadow: cycle(['none', 'soft', 'strong', 'drop'] as const, props.subtitleStyle.shadow) }) },
      { id: 'subtitle-spacing', label: `Espaçamento da legenda: ${props.subtitleStyle.lineSpacing}`, action: () => props.onSubtitleStyle({ lineSpacing: cycle(['compact', 'normal', 'relaxed', 'spacious'] as const, props.subtitleStyle.lineSpacing), customLineSpacing: undefined }) },
      { id: 'skip-offset-down', label: `Abertura: ${props.skipOffset}s · atrasar 1s`, action: () => props.onAdjustSkipOffset(-1) },
      { id: 'skip-offset-up', label: `Abertura: ${props.skipOffset}s · adiantar 1s`, action: () => props.onAdjustSkipOffset(1) },
      { id: 'skip-offset-reset', label: 'Restaurar ajuste da abertura', action: props.onResetSkipOffset },
      { id: 'report', label: 'Reportar problema', action: choose(props.onReport) }
      ];
    }
    return [];
  }, [menu, props.audioOptions, props.subtitleOptions, props.selectedSubtitleId, props.qualities, props.selectedQuality, props.autoPlayEnabled, props.autoSkipEnabled, props.subtitleSize, props.subtitlePosition, props.subtitleStyle, props.skipOffset, props.onAudio, props.onSubtitle, props.onQuality, props.onToggleAutoPlay, props.onToggleAutoSkip, props.onSubtitleSize, props.onSubtitlePosition, props.onSubtitleStyle, props.onAdjustSkipOffset, props.onResetSkipOffset, props.onReport, closeMenu]);

  if (props.suspended) return null;
  return <FocusContext.Provider value={focusKey}>
    <div ref={ref} className={`absolute inset-0 z-[80] pointer-events-none transition-opacity duration-300 ${props.visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="absolute top-0 inset-x-0 px-[5vw] pt-[5vh] pb-16 bg-gradient-to-b from-black/90 via-black/50 to-transparent pointer-events-none">
        <h2 className="text-white text-2xl font-black">{props.title}</h2>
        {props.season && props.episode && <p className="mt-1 text-lg font-semibold text-cyan-300">Temporada {props.season} · Episódio {props.episode}</p>}
      </div>
      <div className={`absolute bottom-0 inset-x-0 px-[5vw] pt-24 pb-[6vh] bg-gradient-to-t from-black/95 via-black/80 to-transparent ${props.visible ? 'pointer-events-auto' : 'pointer-events-none'}`} onClick={event => event.stopPropagation()}>
        <Timeline currentTime={props.currentTime} duration={props.duration} preview={preview} disabled={!props.canSeek || props.intro || props.duration <= 0}
          onPreview={setPreview} onFocus={props.onInteraction} onConfirm={() => {
            if (preview !== null) {
              uiSoundService.play('confirm', { playerControl: true });
              props.onSeek(preview);
              setPreview(null);
            }
          }} />
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <ControlButton focusKey="tv-player-back" label="Voltar" onPress={() => { uiSoundService.play('close', { playerControl: true }); props.onClose(); }}><ArrowLeft className="w-6 h-6" /></ControlButton>
          <ControlButton focusKey="tv-player-rewind" label="-10 s" disabled={!props.canSeek || props.intro} onPress={() => { uiSoundService.play('click', { playerControl: true }); props.onSkip(-10); }}><RotateCcw className="w-6 h-6" /></ControlButton>
          <ControlButton focusKey="tv-player-play" label={props.playing ? 'Pausar' : 'Reproduzir'} disabled={!props.canPlayPause} onPress={() => { uiSoundService.play('toggle', { playerControl: true }); props.onTogglePlay(); }}>{props.playing ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}</ControlButton>
          <ControlButton focusKey="tv-player-forward" label="+10 s" disabled={!props.canSeek || props.intro} onPress={() => { uiSoundService.play('click', { playerControl: true }); props.onSkip(10); }}><RotateCw className="w-6 h-6" /></ControlButton>
          <ControlButton focusKey="tv-player-audio" label="Áudio" disabled={!props.audioOptions.length} onPress={() => openMenu('audio', 'tv-player-audio')}><Languages className="w-6 h-6" /></ControlButton>
          <ControlButton focusKey="tv-player-subtitles" label="Legendas" onPress={() => openMenu('subtitles', 'tv-player-subtitles')}><Subtitles className="w-6 h-6" /></ControlButton>
          <ControlButton focusKey="tv-player-quality" label="Qualidade" disabled={!props.qualities.length} onPress={() => openMenu('quality', 'tv-player-quality')}><Settings className="w-6 h-6" /></ControlButton>
          <ControlButton focusKey="tv-player-settings" label="Opções" onPress={() => openMenu('settings', 'tv-player-settings')}><Settings className="w-6 h-6" /></ControlButton>
          {props.onNext && <ControlButton focusKey="tv-player-next" label="Próximo" disabled={!props.canNext} onPress={() => { uiSoundService.play('watch', { playerControl: true }); props.onNext?.(); }}><SkipForward className="w-6 h-6" /></ControlButton>}
          <ControlButton focusKey="tv-player-report" label="Reportar" onPress={() => { uiSoundService.play('click', { playerControl: true }); props.onReport(); }}><AlertCircle className="w-6 h-6" /></ControlButton>
        </div>
        {props.loading && <p className="text-center text-sm text-gray-300 mt-3">Preparando reprodução...</p>}
      </div>
      {menu && <div className="absolute inset-0 z-20 bg-black/70 flex items-center justify-end pointer-events-auto" onClick={() => closeMenu()}>
        <div className="h-full w-[min(520px,48vw)] bg-[#0c121e] border-l border-white/15 px-8 py-10 overflow-y-auto" onClick={event => event.stopPropagation()}>
          <h3 className="text-2xl font-black text-white mb-6">{menu === 'audio' ? 'Áudio' : menu === 'subtitles' ? 'Legendas' : menu === 'quality' ? 'Qualidade' : 'Opções'}</h3>
          <div className="space-y-2">{options.length ? options.map((option, index) => <MenuOption key={`${menu}-${option.id}`} focusKey={`tv-player-option-${menu}-${index}`} option={option} />) : <p className="text-gray-400">Nenhuma opção disponível.</p>}</div>
        </div>
      </div>}
    </div>
  </FocusContext.Provider>;
};
