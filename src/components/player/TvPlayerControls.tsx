import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FocusContext, getCurrentFocusKey, setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  FastForward,
  Languages,
  ListVideo,
  Monitor,
  MoveVertical,
  Palette,
  Pause,
  Play,
  Rewind,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  SkipForward,
  Sparkles,
  Subtitles,
  Type,
  Volume2,
  X
} from 'lucide-react';
import { useTvFocusable } from '../../core/tv/useTvFocusable';
import { tvNavigationManager } from '../../core/tv/tvNavigationManager';
import { uiSoundService } from '../../core/audio/uiSoundService';
import { smartAudioService, SmartAudioDiagnostics } from '../../core/audio/smartAudioService';
import type { AudioOption } from '../../core/audio/audioSelectionManager';
import type { SubtitleTrack } from '../../core/subtitles/subtitleService';
import type { SubtitleStyle } from '../../core/subtitles/subtitleStyleService';

export type TvMenuType = 'audio_subtitles' | 'episodes' | 'options' | 'subtitle_styles' | null;

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

/** Botão circular de ação para o cabeçalho do Drawer */
const DrawerIconButton: React.FC<{
  focusKey: string;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ focusKey, label, onClick, children }) => {
  const { ref, focused } = useTvFocusable({
    focusKey,
    onEnterPress: onClick,
    soundType: 'hover',
    enterSound: 'close',
    isPlayerControl: true
  });
  return (
    <button
      ref={ref}
      type="button"
      data-focus-key={focusKey}
      data-tv-focused={focused ? 'true' : undefined}
      onClick={onClick}
      aria-label={label}
      className={`w-8 h-8 rounded-full flex items-center justify-center outline-none transition-all duration-150 select-none cursor-pointer ${
        focused
          ? 'bg-cyan-400 text-black ring-2 ring-cyan-300 scale-105 shadow-[0_0_12px_rgba(0,229,255,0.4)] font-bold'
          : 'bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
};

/** Botão compacto para cabeçalhos de seção (ex: Estilos em Legendas) */
const DrawerHeaderButton: React.FC<{
  focusKey: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}> = ({ focusKey, label, icon, onClick }) => {
  const { ref, focused } = useTvFocusable({
    focusKey,
    onEnterPress: onClick,
    soundType: 'hover',
    enterSound: 'confirm',
    isPlayerControl: true
  });
  return (
    <button
      ref={ref}
      type="button"
      data-focus-key={focusKey}
      data-tv-focused={focused ? 'true' : undefined}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold outline-none transition-all cursor-pointer ${
        focused
          ? 'bg-cyan-400 text-black ring-2 ring-cyan-300 font-bold shadow-[0_0_12px_rgba(0,229,255,0.4)] scale-105'
          : 'bg-white/10 border border-white/15 text-gray-300 hover:bg-white/20 hover:text-white'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
};

/** Cabeçalho de seção dentro dos Drawers */
const DrawerSectionHeader: React.FC<{
  icon?: React.ReactNode;
  title: string;
  action?: React.ReactNode;
}> = ({ icon, title, action }) => (
  <div className="mb-3">
    <div className="flex items-center justify-between gap-2 mb-1.5">
      <div className="flex items-center gap-2">
        {icon && <span className="text-gray-400 shrink-0">{icon}</span>}
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300">{title}</h4>
      </div>
      {action}
    </div>
    <div className="h-px w-full bg-white/15" />
  </div>
);

/** Chip / Pill elegante para seleção de opções (áudio, legendas, qualidades, estilos) */
const DrawerPillChip: React.FC<{
  focusKey: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
  badge?: string;
  icon?: React.ReactNode;
  colorSwatch?: string;
  onClick: () => void;
}> = ({ focusKey, label, active, disabled, badge, icon, colorSwatch, onClick }) => {
  const { ref, focused } = useTvFocusable({
    focusKey,
    focusable: !disabled,
    onEnterPress: () => { if (!disabled) onClick(); },
    soundType: 'hover',
    enterSound: 'toggle',
    isPlayerControl: true
  });

  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      data-focus-key={focusKey}
      data-tv-focused={focused ? 'true' : undefined}
      onClick={() => { if (!disabled) onClick(); }}
      className={`relative inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-semibold text-xs sm:text-sm outline-none transition-all duration-150 select-none cursor-pointer ${
        focused
          ? 'bg-cyan-400 text-black ring-2 ring-cyan-300 shadow-[0_0_15px_rgba(0,229,255,0.5)] scale-105 z-10 font-bold'
          : active
          ? 'bg-sky-500 text-white shadow-sm font-bold'
          : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white'
      }`}
    >
      {colorSwatch && (
        <span
          className="w-3.5 h-3.5 rounded-full border border-black/40 shadow-sm shrink-0"
          style={{ backgroundColor: colorSwatch }}
        />
      )}
      {icon}
      <span className="truncate">{label}</span>
      {badge && (
        <span
          className={`px-1.5 py-0.2 rounded text-[10px] font-black uppercase tracking-wider ${
            focused
              ? 'bg-black text-cyan-300'
              : active
              ? 'bg-black/30 text-white'
              : 'bg-white/15 text-gray-300'
          }`}
        >
          {badge}
        </span>
      )}
      {active && (
        <Check className={`w-3.5 h-3.5 shrink-0 ml-0.5 ${focused ? 'text-black' : 'text-white'}`} />
      )}
    </button>
  );
};

/** Chip circular elegante para paleta de cores das legendas (Branco, Amarelo, Ciano, Verde) */
const DrawerColorChip: React.FC<{
  focusKey: string;
  color: string;
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ focusKey, color, label, active, onClick }) => {
  const { ref, focused } = useTvFocusable({
    focusKey,
    onEnterPress: onClick,
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
      onClick={onClick}
      aria-label={label}
      className={`w-7 h-7 rounded-full outline-none transition-all duration-150 select-none cursor-pointer flex items-center justify-center ${
        focused
          ? 'ring-2 ring-cyan-300 ring-offset-2 ring-offset-black scale-110 shadow-[0_0_12px_rgba(0,229,255,0.6)]'
          : active
          ? 'ring-2 ring-white ring-offset-2 ring-offset-black/60 scale-105'
          : 'opacity-80 hover:opacity-100 hover:scale-105'
      }`}
      style={{ backgroundColor: color }}
    >
      {active && (
        <Check
          className={`w-3.5 h-3.5 ${
            color === '#FFFFFF' || color === '#FFE66D' ? 'text-black' : 'text-white'
          }`}
        />
      )}
    </button>
  );
};

/** Linha com switch toggle moderno para configurações (Autoplay, Autoskip) */
const DrawerToggleRow: React.FC<{
  focusKey: string;
  title: string;
  description?: string;
  enabled: boolean;
  onToggle: () => void;
}> = ({ focusKey, title, description, enabled, onToggle }) => {
  const { ref, focused } = useTvFocusable({
    focusKey,
    onEnterPress: onToggle,
    soundType: 'hover',
    enterSound: 'toggle',
    isPlayerControl: true
  });

  return (
    <div
      ref={ref}
      role="switch"
      aria-checked={enabled}
      data-focus-key={focusKey}
      data-tv-focused={focused ? 'true' : undefined}
      onClick={onToggle}
      className={`w-full py-2.5 px-3 rounded-xl flex items-center justify-between gap-4 outline-none transition-all duration-150 select-none cursor-pointer ${
        focused
          ? 'bg-white/10 ring-2 ring-cyan-400 shadow-[0_0_15px_rgba(0,229,255,0.25)]'
          : 'bg-transparent hover:bg-white/5'
      }`}
    >
      <div className="flex-1 min-w-0 pr-2">
        <h4 className={`text-sm font-semibold tracking-tight ${focused ? 'text-white' : 'text-gray-200'}`}>
          {title}
        </h4>
        {description && (
          <p className="text-[11px] text-gray-400 mt-0.5 leading-snug truncate">
            {description}
          </p>
        )}
      </div>
      {/* Switch estilo referência da TV */}
      <div
        className={`w-11 h-6 rounded-full p-0.5 flex items-center transition-colors duration-200 shrink-0 ${
          enabled ? 'bg-sky-500 justify-end' : 'bg-white/20 justify-start'
        }`}
      >
        <span
          className={`w-5 h-5 rounded-full shadow-md transition-all duration-200 ${
            enabled ? 'bg-white' : 'bg-gray-300'
          }`}
        />
      </div>
    </div>
  );
};

/** Card horizontal refinado para episódios com miniatura 16:9 e metadados concisos */
const DrawerEpisodeCard: React.FC<{
  focusKey: string;
  episode: TvPlayerEpisode;
  isCurrent: boolean;
  onSelect: () => void;
}> = ({ focusKey, episode, isCurrent, onSelect }) => {
  const [imgError, setImgError] = useState(false);
  const { ref, focused } = useTvFocusable({
    focusKey,
    onEnterPress: onSelect,
    soundType: 'hover',
    enterSound: 'confirm',
    isPlayerControl: true
  });

  return (
    <div
      ref={ref}
      role="button"
      data-focus-key={focusKey}
      data-tv-focused={focused ? 'true' : undefined}
      onClick={onSelect}
      className={`group w-full p-2 rounded-xl flex items-start gap-3 outline-none transition-all duration-150 select-none cursor-pointer ${
        focused
          ? 'bg-white/10 ring-1 ring-cyan-400/80 shadow-[0_0_20px_rgba(0,229,255,0.2)]'
          : isCurrent
          ? 'bg-white/5'
          : 'bg-transparent hover:bg-white/5'
      }`}
    >
      {/* Miniatura 16:9 */}
      <div
        className={`relative w-32 sm:w-36 aspect-video rounded-md overflow-hidden bg-black/50 shrink-0 border transition-all duration-150 ${
          focused
            ? 'border-transparent ring-2 ring-cyan-400 shadow-[0_0_12px_rgba(0,229,255,0.4)]'
            : isCurrent
            ? 'border-cyan-400/50'
            : 'border-white/10'
        }`}
      >
        {episode.image && !imgError ? (
          <img
            src={episode.image}
            alt={episode.title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/10 to-transparent">
            <Play className="w-6 h-6 text-white/40 fill-current ml-0.5" />
          </div>
        )}
        {/* Overlay do número do episódio */}
        <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-black tracking-wider bg-black/80 text-cyan-300 border border-cyan-400/30 shadow">
          EP {episode.number}
        </span>
        {isCurrent && (
          <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-cyan-400 text-black shadow-md">
            Atual
          </span>
        )}
      </div>

      {/* Textos à direita */}
      <div className="flex-1 min-w-0 flex flex-col justify-center py-0.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium tracking-wide text-gray-400">
            Episódio {episode.number}
          </span>
          {isCurrent && (
            <span className="text-[9px] font-bold text-cyan-300 bg-cyan-500/20 px-1.5 py-0.2 rounded border border-cyan-400/30">
              Reproduzindo
            </span>
          )}
        </div>
        <h4 className="text-sm font-semibold text-white tracking-tight truncate mt-0.5 leading-snug">
          {episode.title}
        </h4>
        {episode.description ? (
          <p className="text-[11px] text-gray-400 line-clamp-2 mt-1 leading-snug">
            {episode.description}
          </p>
        ) : (
          <p className="text-[11px] text-gray-500 italic mt-1">
            Episódio da série ZapiTV
          </p>
        )}
      </div>
    </div>
  );
};

/** Linha de ação navegável para submenus ou links diretos */
const DrawerActionCard: React.FC<{
  focusKey: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: string;
  onClick: () => void;
}> = ({ focusKey, title, description, icon, badge, onClick }) => {
  const { ref, focused } = useTvFocusable({
    focusKey,
    onEnterPress: onClick,
    soundType: 'hover',
    enterSound: 'confirm',
    isPlayerControl: true
  });

  return (
    <div
      ref={ref}
      role="button"
      data-focus-key={focusKey}
      data-tv-focused={focused ? 'true' : undefined}
      onClick={onClick}
      className={`w-full py-2.5 px-3 rounded-xl flex items-center justify-between gap-3 outline-none transition-all duration-150 select-none cursor-pointer ${
        focused
          ? 'bg-white/10 ring-2 ring-cyan-400 shadow-[0_0_15px_rgba(0,229,255,0.25)]'
          : 'bg-transparent hover:bg-white/5'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-cyan-300 shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-gray-200 tracking-tight truncate">
              {title}
            </h4>
            {badge && (
              <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                {badge}
              </span>
            )}
          </div>
          {description && (
            <p className="text-[11px] text-gray-400 mt-0.5 leading-snug truncate">
              {description}
            </p>
          )}
        </div>
      </div>
      <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />
    </div>
  );
};

/** Botão individual de controle de stepper */
const DrawerStepperButton: React.FC<{
  focusKey: string;
  label: string;
  onClick: () => void;
  isSecondary?: boolean;
  children: React.ReactNode;
}> = ({ focusKey, label, onClick, isSecondary, children }) => {
  const { ref, focused } = useTvFocusable({
    focusKey,
    onEnterPress: onClick,
    soundType: 'hover',
    enterSound: 'click',
    isPlayerControl: true
  });

  return (
    <button
      ref={ref}
      type="button"
      data-focus-key={focusKey}
      data-tv-focused={focused ? 'true' : undefined}
      onClick={onClick}
      aria-label={label}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold outline-none transition-all duration-150 select-none cursor-pointer ${
        focused
          ? 'bg-cyan-400 text-black ring-2 ring-cyan-300 scale-105 shadow-[0_0_12px_rgba(0,229,255,0.5)] font-bold'
          : isSecondary
          ? 'bg-white/10 text-cyan-300 border border-cyan-400/30 hover:bg-white/15'
          : 'bg-white/10 text-gray-200 hover:bg-white/15'
      }`}
    >
      {children}
    </button>
  );
};

/** Stepper horizontal moderno para ajustes numéricos (Sincronia e Posição) */
const DrawerStepper: React.FC<{
  label: string;
  description?: string;
  valueDisplay: string;
  downFocusKey: string;
  upFocusKey: string;
  resetFocusKey?: string;
  onDown: () => void;
  onUp: () => void;
  onReset?: () => void;
  canReset?: boolean;
}> = ({
  label,
  description,
  valueDisplay,
  downFocusKey,
  upFocusKey,
  resetFocusKey,
  onDown,
  onUp,
  onReset,
  canReset
}) => {
  return (
    <div className="py-2.5 px-3 rounded-xl bg-transparent space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-200 tracking-tight">{label}</h4>
          {description && <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{description}</p>}
        </div>
        <span className="text-xs font-bold text-sky-400 bg-sky-500/10 px-2.5 py-0.5 rounded border border-sky-400/30">
          {valueDisplay}
        </span>
      </div>
      <div className="flex items-center gap-2 pt-0.5">
        <DrawerStepperButton focusKey={downFocusKey} label="Diminuir" onClick={onDown}>
          -1s
        </DrawerStepperButton>
        <DrawerStepperButton focusKey={upFocusKey} label="Aumentar" onClick={onUp}>
          +1s
        </DrawerStepperButton>
        {canReset && onReset && resetFocusKey && (
          <DrawerStepperButton focusKey={resetFocusKey} label="Restaurar Padrão" onClick={onReset} isSecondary>
            Restaurar
          </DrawerStepperButton>
        )}
      </div>
    </div>
  );
};

/** Caixa de pré-visualização ao vivo das legendas */
const SubtitlePreviewBox: React.FC<{
  size: 'sm' | 'md' | 'lg' | 'xl';
  style: SubtitleStyle;
}> = ({ size, style }) => {
  const fontSizes = {
    sm: 'text-sm sm:text-base',
    md: 'text-base sm:text-lg',
    lg: 'text-lg sm:text-xl',
    xl: 'text-xl sm:text-2xl'
  };

  const textShadows = {
    none: 'none',
    soft: '0 1px 3px rgba(0,0,0,0.8)',
    strong: '0 2px 8px rgba(0,0,0,0.95), 0 0 2px #000000',
    drop: '2px 2px 0 #000000, -1px -1px 0 #000000'
  };

  const textOutlines = {
    none: 'none',
    thin: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
    medium: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000',
    thick: '3px 3px 0 #000, -3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000'
  };

  const lineSpacings = {
    compact: 'leading-tight',
    normal: 'leading-normal',
    relaxed: 'leading-relaxed',
    spacious: 'leading-loose'
  };

  const bgStyles = {
    none: 'transparent',
    semi: 'rgba(0,0,0,0.6)',
    solid: '#000000'
  };

  const combinedShadow = [
    textOutlines[style.outline || 'thin'] !== 'none' ? textOutlines[style.outline || 'thin'] : '',
    textShadows[style.shadow || 'strong'] !== 'none' ? textShadows[style.shadow || 'strong'] : ''
  ].filter(Boolean).join(', ') || 'none';

  return (
    <div className="w-full h-24 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center p-3 overflow-hidden shadow-inner mb-4">
      <div
        className={`text-center font-bold tracking-tight select-none transition-all duration-150 ${fontSizes[size]} ${lineSpacings[style.lineSpacing || 'normal']}`}
        style={{
          color: style.color || '#FFFFFF',
          textShadow: combinedShadow,
          backgroundColor: bgStyles[style.bgColor || 'none'],
          padding: style.bgColor && style.bgColor !== 'none' ? '4px 12px' : '0',
          borderRadius: '6px'
        }}
      >
        <div>Primeira linha de legenda</div>
        <div className="opacity-95">Segunda linha com espaçamento</div>
      </div>
    </div>
  );
};

const SUBTITLE_SIZES: { label: string; value: 'sm' | 'md' | 'lg' | 'xl' }[] = [
  { label: 'SM', value: 'sm' },
  { label: 'MD', value: 'md' },
  { label: 'LG', value: 'lg' },
  { label: 'XL', value: 'xl' }
];

const SUBTITLE_OUTLINES: { label: string; value: 'none' | 'thin' | 'medium' | 'thick' }[] = [
  { label: 'Nenhum', value: 'none' },
  { label: 'Fino', value: 'thin' },
  { label: 'Médio', value: 'medium' },
  { label: 'Forte', value: 'thick' }
];

const SUBTITLE_SHADOWS: { label: string; value: 'none' | 'soft' | 'strong' | 'drop' }[] = [
  { label: 'Nenhuma', value: 'none' },
  { label: 'Suave', value: 'soft' },
  { label: 'Forte', value: 'strong' },
  { label: 'Projetada', value: 'drop' }
];

const SUBTITLE_SPACINGS: { label: string; value: 'compact' | 'normal' | 'relaxed' | 'spacious' }[] = [
  { label: 'Compacto', value: 'compact' },
  { label: 'Normal', value: 'normal' },
  { label: 'Espaçado', value: 'relaxed' },
  { label: 'Amplo', value: 'spacious' }
];

const SUBTITLE_COLORS = [
  { label: 'Branco', value: '#FFFFFF' },
  { label: 'Amarelo', value: '#FFE66D' },
  { label: 'Ciano', value: '#00E5FF' },
  { label: 'Verde', value: '#4ADE80' }
];

const SUBTITLE_BG_COLORS: { label: string; value: 'none' | 'semi' | 'solid' }[] = [
  { label: 'Nenhum', value: 'none' },
  { label: 'Translúcido', value: 'semi' },
  { label: 'Sólido', value: 'solid' }
];

export const TvPlayerControls: React.FC<TvPlayerControlsProps> = (props) => {
  const { ref, focusKey } = useFocusable({ focusKey: 'tv-player-controls-root', trackChildren: true });
  const [menu, setMenu] = useState<TvMenuType>(null);
  const [previousMenu, setPreviousMenu] = useState<'audio_subtitles' | 'options'>('audio_subtitles');
  const [selectedSeason, setSelectedSeason] = useState<number>(() => props.season ?? 1);
  const [preview, setPreview] = useState<number | null>(null);
  const [menuOrigin, setMenuOrigin] = useState('tv-player-play');
  const [smartAudioDiag, setSmartAudioDiag] = useState<SmartAudioDiagnostics>(() => smartAudioService.getDiagnostics());

  useEffect(() => {
    return smartAudioService.subscribe(setSmartAudioDiag);
  }, []);
  const [activeLabel, setActiveLabel] = useState<string>('Reproduzir / Pausar');

  // Refs para controle contextual refinado de foco na TV (evita Play/Pause universal)
  const pendingFocusRef = useRef<string | null>(null);
  const wasVisibleRef = useRef<boolean>(props.visible);
  const isClosingMenuRef = useRef<boolean>(false);

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
    const dir = session.direction;
    pendingFocusRef.current = dir === 'forward' ? 'tv-player-forward' : 'tv-player-rewind';
    scrubSessionRef.current = null;

    uiSoundService.play('confirm', { playerControl: true });
    props.onSeek(finalTarget);

    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => {
      setSeekFeedback(prev => (prev ? { ...prev, visible: false } : null));
      feedbackTimerRef.current = setTimeout(() => {
        setSeekFeedback(null);
        if (pendingFocusRef.current === 'tv-player-forward' || pendingFocusRef.current === 'tv-player-rewind') {
          pendingFocusRef.current = null;
        }
      }, 300);
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
    pendingFocusRef.current = origin;
    setMenu(next);
    props.onInteraction();
    requestAnimationFrame(() => {
      if (next === 'audio_subtitles') {
        if (props.audioOptions.length > 0) {
          setFocus('tv-player-drawer-audio-0');
        } else {
          setFocus('tv-player-drawer-sub-off');
        }
      } else if (next === 'episodes') {
        const curIdx = seasonEpisodes.findIndex(
          ep => (ep.season ?? 1) === (props.season ?? 1) && ep.number === props.episode
        );
        if (curIdx >= 0) {
          setFocus(`tv-player-drawer-episodes-${curIdx}`);
        } else {
          setFocus('tv-player-drawer-episodes-0');
        }
      } else if (next === 'options') {
        if (props.qualities.length > 0) {
          setFocus('tv-player-drawer-quality-0');
        } else {
          setFocus('tv-player-drawer-toggle-autoplay');
        }
      } else if (next === 'subtitle_styles') {
        setFocus('tv-player-drawer-substyle-size-0');
      }
    });
  }, [props.onInteraction, props.audioOptions.length, props.qualities.length, seasonEpisodes, props.season, props.episode]);

  const openSubtitleStyles = useCallback((from: 'audio_subtitles' | 'options') => {
    uiSoundService.play('toggle', { playerControl: true });
    setPreviousMenu(from);
    setMenu('subtitle_styles');
    props.onInteraction();
    requestAnimationFrame(() => setFocus('tv-player-drawer-substyle-size-0'));
  }, [props.onInteraction]);

  const returnFromSubtitleStyles = useCallback(() => {
    uiSoundService.play('toggle', { playerControl: true });
    setMenu(previousMenu);
    requestAnimationFrame(() => {
      if (previousMenu === 'options') {
        setFocus('tv-player-drawer-options-substyle-btn');
      } else {
        setFocus('tv-drawer-sub-styles-btn');
      }
    });
  }, [previousMenu]);

  const closeMenu = useCallback((silent = false) => {
    if (!menu) return;
    if (!silent) {
      uiSoundService.play('close', { playerControl: true });
    }
    const origin = menuOrigin || 'tv-player-play';
    isClosingMenuRef.current = true;
    pendingFocusRef.current = origin;
    setMenu(null);
    requestAnimationFrame(() => {
      try {
        const targetEl = document.querySelector<HTMLElement>(`[data-focus-key="${origin}"]`);
        if (targetEl && !targetEl.hasAttribute('disabled')) {
          setFocus(origin);
        } else {
          setFocus('tv-player-play');
        }
      } catch {
        setFocus('tv-player-play');
      }
      requestAnimationFrame(() => {
        isClosingMenuRef.current = false;
        if (pendingFocusRef.current === origin) {
          pendingFocusRef.current = null;
        }
      });
    });
  }, [menu, menuOrigin]);

  // Registro prioritário do comando Voltar (Hierarquia Apple TV)
  useEffect(() => tvNavigationManager.registerBackHandler('tv-player-controls', 250, () => {
    if (props.suspended) return false;
    // 0. Submenu de estilos de legendas: retorna ao menu anterior (áudio e legendas ou opções)
    if (menu === 'subtitle_styles') {
      returnFromSubtitleStyles();
      return true;
    }
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
  }), [props.suspended, menu, returnFromSubtitleStyles, preview, props.visible, props.onHide, closeMenu, cancelScrubSession]);

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
        pendingFocusRef.current = 'tv-player-play';
        props.onShow();
        requestAnimationFrame(() => setFocus('tv-player-play'));
        return true;
      }

      // OK/Enter: alternar reprodução e pausa
      if (isSelectKey) {
        if (event.repeat) return true;

        // Se o botão de pular estiver focado, aciona exclusivamente o pulo sem alternar Play/Pause
        const current = getCurrentFocusKey();
        const isSkipFocused =
          current === 'tv-skip-button' ||
          document.activeElement?.getAttribute('data-focus-key') === 'tv-skip-button' ||
          document.activeElement?.id === 'zapi-skip-button' ||
          document.querySelector('[data-focus-key="tv-skip-button"][data-tv-focused="true"]') !== null;
        if (isSkipFocused) {
          const skipBtn = document.querySelector<HTMLElement>('[data-focus-key="tv-skip-button"]');
          if (skipBtn) {
            skipBtn.click();
            return true;
          }
        }

        // Se o botão contextual de próximo episódio estiver focado, aciona o próximo episódio
        const isNextContextualFocused =
          current === 'tv-player-next-contextual' ||
          document.activeElement?.getAttribute('data-focus-key') === 'tv-player-next-contextual' ||
          document.activeElement?.id === 'zapi-tv-next-episode-button' ||
          document.querySelector('[data-focus-key="tv-player-next-contextual"][data-tv-focused="true"]') !== null;
        if (isNextContextualFocused) {
          const nextBtn = document.querySelector<HTMLElement>('[data-focus-key="tv-player-next-contextual"]');
          if (nextBtn) {
            nextBtn.click();
            return true;
          }
        }

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
          pendingFocusRef.current = 'tv-player-play';
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
        const targetBtn = dir === 'forward' ? 'tv-player-forward' : 'tv-player-rewind';
        pendingFocusRef.current = targetBtn;

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
            if (pendingFocusRef.current === 'tv-player-forward' || pendingFocusRef.current === 'tv-player-rewind') {
              pendingFocusRef.current = null;
            }
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

      // Se o botão de pular estiver focado, aciona exclusivamente o pulo sem alternar Play/Pause nem roubar foco
      const isSkipFocused =
        current === 'tv-skip-button' ||
        document.activeElement?.getAttribute('data-focus-key') === 'tv-skip-button' ||
        document.activeElement?.id === 'zapi-skip-button' ||
        document.querySelector('[data-focus-key="tv-skip-button"][data-tv-focused="true"]') !== null;
      if (isSkipFocused) {
        const skipBtn = document.querySelector<HTMLElement>('[data-focus-key="tv-skip-button"]');
        if (skipBtn) {
          skipBtn.click();
          props.onInteraction();
          return true;
        }
      }

      // Se o botão contextual de próximo episódio estiver focado, aciona o próximo episódio
      const isNextContextualFocused =
        current === 'tv-player-next-contextual' ||
        document.activeElement?.getAttribute('data-focus-key') === 'tv-player-next-contextual' ||
        document.activeElement?.id === 'zapi-tv-next-episode-button' ||
        document.querySelector('[data-focus-key="tv-player-next-contextual"][data-tv-focused="true"]') !== null;
      if (isNextContextualFocused) {
        const nextBtn = document.querySelector<HTMLElement>('[data-focus-key="tv-player-next-contextual"]');
        if (nextBtn) {
          nextBtn.click();
          props.onInteraction();
          return true;
        }
      }

      const element = Array.from(document.querySelectorAll<HTMLElement>('[data-focus-key]')).find(
        el => el.dataset.focusKey === current
      );
      if (element) {
        element.click();
      } else {
        // Fallback: se o elemento focado não existir (ex: foi desmontado após ação), recupera foco no play
        setFocus('tv-player-play');
      }
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
    const wasVisible = wasVisibleRef.current;
    wasVisibleRef.current = props.visible;

    // Se os controles não estão visíveis, estão suspensos ou há menu aberto, não atua
    if (!props.visible || props.suspended || menu !== null) return;

    // Se um menu acabou de ser fechado, closeMenu() já restaurou o foco no botão de origem
    if (isClosingMenuRef.current) return;

    // Se há um destino de foco pré-definido (ex: avanço/retrocesso de 10s ou restauração de menu)
    if (pendingFocusRef.current) {
      const target = pendingFocusRef.current;
      pendingFocusRef.current = null;
      const id = requestAnimationFrame(() => {
        try {
          const el = document.querySelector<HTMLElement>(`[data-focus-key="${target}"]`);
          if (el && !el.hasAttribute('disabled')) {
            setFocus(target);
          } else {
            setFocus('tv-player-play');
          }
        } catch {
          setFocus('tv-player-play');
        }
      });
      return () => cancelAnimationFrame(id);
    }

    // Se os controles já estavam visíveis e continuam visíveis, não sobrescreve o foco atual do usuário
    if (wasVisible) return;

    // Abertura inicial dos controles a partir do estado oculto (!wasVisible && props.visible):
    const current = getCurrentFocusKey();

    // Se o botão de pular abertura/créditos já estiver focado, preserva rigorosamente
    if (current === 'tv-skip-button') return;

    // Se o foco atual já for um controle válido ativo da barra da TV, não sobrescreve
    const validTvControls = [
      'tv-player-play',
      'tv-player-forward',
      'tv-player-rewind',
      'tv-player-next',
      'tv-player-timeline',
      'tv-player-episodes',
      'tv-player-audio',
      'tv-player-settings',
      'tv-player-back'
    ];
    if (current && validTvControls.includes(current)) return;

    // Primeira abertura geral sem foco definido: define foco inicial em Play/Pause
    const id = requestAnimationFrame(() => {
      if (getCurrentFocusKey() === 'tv-skip-button' || getCurrentFocusKey() === 'tv-player-next-contextual') return;
      if (isClosingMenuRef.current) return;
      setFocus('tv-player-play');
    });
    return () => cancelAnimationFrame(id);
  }, [props.visible, props.suspended]);



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
        </div>

        {/* DRAWER LATERAL PREMIUM: Episódios, Áudio & Legendas, Configurações ou Estilos */}
        {menu && (
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-end pointer-events-auto animate-in fade-in duration-200"
            onClick={() => closeMenu()}
          >
            <div
              className="h-full w-[min(480px,38vw)] bg-gradient-to-l from-black/95 via-black/90 to-black/80 backdrop-blur-xl border-l border-white/10 px-6 sm:px-7 py-6 flex flex-col justify-between shadow-[0_0_90px_rgba(0,0,0,0.95)] animate-in slide-in-from-right duration-250 select-none overflow-hidden"
              onClick={event => event.stopPropagation()}
            >
              {/* CABEÇALHO DO DRAWER */}
              <div className="pb-3 border-b border-white/15 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {menu === 'subtitle_styles' && (
                      <DrawerIconButton
                        focusKey="tv-drawer-back-btn"
                        label="Voltar"
                        onClick={returnFromSubtitleStyles}
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </DrawerIconButton>
                    )}
                    <h3 className="text-xl font-bold text-white tracking-wide">
                      {menu === 'audio_subtitles'
                        ? 'Áudio e Legendas'
                        : menu === 'episodes'
                        ? 'Episódios'
                        : menu === 'options'
                        ? 'Configurações'
                        : 'Estilo das Legendas'}
                    </h3>
                  </div>
                  <DrawerIconButton
                    focusKey="tv-drawer-close-btn"
                    label="Fechar painel"
                    onClick={() => closeMenu()}
                  >
                    <X className="w-5 h-5" />
                  </DrawerIconButton>
                </div>
              </div>

              {/* CORPO DO DRAWER COM ROLAGEM SUAVE */}
              <div className="flex-1 my-4 overflow-y-auto no-scrollbar pr-1">
                {/* 1. MENU DE EPISÓDIOS */}
                {menu === 'episodes' && (
                  <div className="space-y-4">
                    {/* Seletor de Temporadas em Pills */}
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                      {availableSeasons.map(s => (
                        <DrawerPillChip
                          key={`season-pill-${s}`}
                          focusKey={`tv-player-drawer-season-${s}`}
                          label={`temporada ${s}`}
                          icon={<span className="text-[10px]">▶</span>}
                          active={selectedSeason === s}
                          onClick={() => {
                            uiSoundService.play('toggle', { playerControl: true });
                            setSelectedSeason(s);
                          }}
                        />
                      ))}
                    </div>

                    {/* Lista de Episódios 16:9 */}
                    {seasonEpisodes.length > 0 ? (
                      <div className="space-y-2">
                        {seasonEpisodes.map((ep, index) => {
                          const isCurrent =
                            (ep.season ?? 1) === (props.season ?? 1) && ep.number === props.episode;
                          return (
                            <DrawerEpisodeCard
                              key={`ep-${ep.id || ep.number}`}
                              focusKey={`tv-player-drawer-episodes-${index}`}
                              episode={ep}
                              isCurrent={isCurrent}
                              onSelect={() => {
                                uiSoundService.play('watch', { playerControl: true });
                                props.onSelectEpisode?.(selectedSeason, ep.number);
                                closeMenu(true);
                              }}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-gray-400 py-6 text-center text-sm">
                        Nenhum episódio encontrado para esta temporada.
                      </p>
                    )}
                  </div>
                )}

                {/* 2. MENU DE ÁUDIO E LEGENDAS */}
                {menu === 'audio_subtitles' && (
                  <div className="space-y-5">
                    {/* Seção Áudio */}
                    <div>
                      <DrawerSectionHeader title="Áudio" />
                      {props.audioOptions.length > 0 ? (
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                          {props.audioOptions.map((audio, index) => (
                            <DrawerPillChip
                              key={`audio-${audio.id}`}
                              focusKey={`tv-player-drawer-audio-${index}`}
                              label={`${audio.flag ? `${audio.flag} ` : ''}${audio.label}`}
                              badge={audio.badge || undefined}
                              active={audio.isCurrent}
                              onClick={() => {
                                uiSoundService.play('toggle', { playerControl: true });
                                props.onAudio(audio);
                                closeMenu(true);
                              }}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-400 text-xs py-1">Áudio padrão do título</p>
                      )}
                    </div>

                    {/* Seção Legendas */}
                    <div>
                      <DrawerSectionHeader
                        title="Legendas"
                        action={
                          <DrawerHeaderButton
                            focusKey="tv-drawer-sub-styles-btn"
                            label="Estilos"
                            icon={<SlidersHorizontal className="w-3.5 h-3.5" />}
                            onClick={() => openSubtitleStyles('audio_subtitles')}
                          />
                        }
                      />
                      <div className="flex flex-col gap-2">
                        <DrawerPillChip
                          focusKey="tv-player-drawer-sub-off"
                          label="Desativada"
                          active={props.selectedSubtitleId === 'off'}
                          onClick={() => {
                            uiSoundService.play('toggle', { playerControl: true });
                            props.onSubtitle('off');
                            closeMenu(true);
                          }}
                        />
                        {props.subtitleOptions.map((sub, index) => (
                          <DrawerPillChip
                            key={`sub-${sub.id}`}
                            focusKey={`tv-player-drawer-sub-${index}`}
                            label={`${sub.flag ? `${sub.flag} ` : ''}${sub.languageName}`}
                            badge={sub.isAutoTranslated ? 'Auto' : sub.autoSyncBadge ? 'Sinc' : undefined}
                            active={props.selectedSubtitleId === sub.id}
                            onClick={() => {
                              uiSoundService.play('toggle', { playerControl: true });
                              props.onSubtitle(sub.id);
                              closeMenu(true);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. MENU DE CONFIGURAÇÕES (OPÇÕES) */}
                {menu === 'options' && (
                  <div className="space-y-4">
                    {/* Qualidade de Vídeo */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-200 tracking-tight mb-2">Qualidade de vídeo</h4>
                      <div className="flex flex-wrap gap-2">
                        {props.qualities.map((q, index) => (
                          <DrawerPillChip
                            key={`quality-${q}`}
                            focusKey={`tv-player-drawer-quality-${index}`}
                            label={q === 'auto' ? 'AUTO' : q.toUpperCase()}
                            active={props.selectedQuality === q}
                            onClick={() => {
                              uiSoundService.play('toggle', { playerControl: true });
                              props.onQuality(q);
                              closeMenu(true);
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="h-px w-full bg-white/10" />

                    {/* Melhoria Automática de Som */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-200 tracking-tight">Melhoria de som (Smart Audio)</h4>
                          <p className="text-xs text-gray-400">Nivelamento dinâmico e clareza de diálogos</p>
                        </div>
                        {smartAudioDiag.status === 'unavailable' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Indisponível nesta fonte
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(['balanced', 'night', 'off'] as const).map(mode => (
                          <DrawerPillChip
                            key={`smart-audio-${mode}`}
                            focusKey={`tv-player-drawer-smart-audio-${mode}`}
                            label={mode === 'balanced' ? 'EQUILIBRADO' : mode === 'night' ? 'NOTURNO' : 'DESATIVADO'}
                            active={smartAudioDiag.enabled && smartAudioDiag.mode === mode && smartAudioDiag.status !== 'unavailable'}
                            disabled={smartAudioDiag.status === 'unavailable'}
                            onClick={() => {
                              uiSoundService.play('toggle', { playerControl: true });
                              smartAudioService.setMode(mode);
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="h-px w-full bg-white/10" />

                    {/* Switches de Reprodução */}
                    <div className="space-y-1">
                      <DrawerToggleRow
                        focusKey="tv-player-drawer-toggle-autoplay"
                        title="Reprodução automática"
                        description="Inicia o episódio seguinte ao término"
                        enabled={props.autoPlayEnabled}
                        onToggle={() => {
                          uiSoundService.play('toggle', { playerControl: true });
                          props.onToggleAutoPlay();
                        }}
                      />
                      <DrawerToggleRow
                        focusKey="tv-player-drawer-toggle-autoskip"
                        title="Pular Cenas"
                        description="Salta aberturas e créditos automaticamente"
                        enabled={props.autoSkipEnabled}
                        onToggle={() => {
                          uiSoundService.play('toggle', { playerControl: true });
                          props.onToggleAutoSkip();
                        }}
                      />
                    </div>

                    <div className="h-px w-full bg-white/10" />

                    {/* Sincronia do Pulo */}
                    <div>
                      <DrawerStepper
                        label="Sincronia do Pulo"
                        description="Ajuste fino do momento de saltar a abertura"
                        valueDisplay={
                          props.skipOffset === 0
                            ? '0s'
                            : `${props.skipOffset > 0 ? '+' : ''}${props.skipOffset}s`
                        }
                        downFocusKey="tv-player-drawer-skip-down"
                        upFocusKey="tv-player-drawer-skip-up"
                        resetFocusKey="tv-player-drawer-skip-reset"
                        onDown={() => {
                          uiSoundService.play('click', { playerControl: true });
                          props.onAdjustSkipOffset(-1);
                        }}
                        onUp={() => {
                          uiSoundService.play('click', { playerControl: true });
                          props.onAdjustSkipOffset(1);
                        }}
                        onReset={() => {
                          uiSoundService.play('toggle', { playerControl: true });
                          props.onResetSkipOffset();
                        }}
                        canReset={props.skipOffset !== 0}
                      />
                    </div>

                    <div className="h-px w-full bg-white/10" />

                    {/* Atalhos para Estilo das Legendas e Reporte */}
                    <div className="space-y-1">
                      <DrawerActionCard
                        focusKey="tv-player-drawer-options-substyle-btn"
                        title="Estilo das Legendas"
                        description="Tamanho da fonte, cores e posição vertical na tela"
                        icon={<SlidersHorizontal className="w-4 h-4" />}
                        onClick={() => openSubtitleStyles('options')}
                      />

                      <DrawerActionCard
                        focusKey="tv-player-drawer-report"
                        title="Reportar Problema Neste Título"
                        description="Notifique a equipe se houver problemas de áudio ou vídeo"
                        icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
                        onClick={() => {
                          uiSoundService.play('toggle', { playerControl: true });
                          props.onReport();
                          closeMenu(true);
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* 4. SUBMENU DE ESTILO DAS LEGENDAS */}
                {menu === 'subtitle_styles' && (
                  <div className="space-y-4">
                    {/* Prévia ao Vivo das duas linhas */}
                    <SubtitlePreviewBox size={props.subtitleSize} style={props.subtitleStyle} />

                    {/* CONTORNO */}
                    <div>
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                        Contorno
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {SUBTITLE_OUTLINES.map((opt, index) => (
                          <DrawerPillChip
                            key={`sub-outline-${opt.value}`}
                            focusKey={`tv-player-drawer-substyle-outline-${index}`}
                            label={opt.label}
                            active={(props.subtitleStyle.outline || 'thin') === opt.value}
                            onClick={() => {
                              uiSoundService.play('toggle', { playerControl: true });
                              props.onSubtitleStyle({ outline: opt.value });
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* SOMBRA */}
                    <div>
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                        Sombra
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {SUBTITLE_SHADOWS.map((shadowOpt, index) => (
                          <DrawerPillChip
                            key={`sub-shadow-${shadowOpt.value}`}
                            focusKey={`tv-player-drawer-substyle-shadow-${index}`}
                            label={shadowOpt.label}
                            active={(props.subtitleStyle.shadow || 'strong') === shadowOpt.value}
                            onClick={() => {
                              uiSoundService.play('toggle', { playerControl: true });
                              props.onSubtitleStyle({ shadow: shadowOpt.value });
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* TAMANHO DA FONTE */}
                    <div>
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                        Tamanho da Fonte
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {SUBTITLE_SIZES.map((sizeOpt, index) => (
                          <DrawerPillChip
                            key={`sub-size-${sizeOpt.value}`}
                            focusKey={`tv-player-drawer-substyle-size-${index}`}
                            label={sizeOpt.label}
                            active={props.subtitleSize === sizeOpt.value}
                            onClick={() => {
                              uiSoundService.play('toggle', { playerControl: true });
                              props.onSubtitleSize(sizeOpt.value);
                              props.onSubtitleStyle({ fontSize: sizeOpt.value });
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* ESPAÇAMENTO VERTICAL (2 LINHAS) */}
                    <div>
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                        Espaçamento Vertical (2 Linhas)
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {SUBTITLE_SPACINGS.map((spOpt, index) => (
                          <DrawerPillChip
                            key={`sub-spacing-${spOpt.value}`}
                            focusKey={`tv-player-drawer-substyle-spacing-${index}`}
                            label={spOpt.label}
                            active={(props.subtitleStyle.lineSpacing || 'normal') === spOpt.value}
                            onClick={() => {
                              uiSoundService.play('toggle', { playerControl: true });
                              props.onSubtitleStyle({ lineSpacing: spOpt.value });
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* POSIÇÃO VERTICAL */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                          Posição Vertical
                        </span>
                        <span className="text-xs font-bold text-sky-400">
                          {props.subtitlePosition}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DrawerStepperButton
                          focusKey="tv-player-drawer-substyle-pos-down"
                          label="Descer Legenda"
                          onClick={() => {
                            uiSoundService.play('click', { playerControl: true });
                            props.onSubtitlePosition(Math.max(4, props.subtitlePosition - 5));
                          }}
                        >
                          Descer (-5%)
                        </DrawerStepperButton>
                        <DrawerStepperButton
                          focusKey="tv-player-drawer-substyle-pos-up"
                          label="Subir Legenda"
                          onClick={() => {
                            uiSoundService.play('click', { playerControl: true });
                            props.onSubtitlePosition(Math.min(35, props.subtitlePosition + 5));
                          }}
                        >
                          Subir (+5%)
                        </DrawerStepperButton>
                        <DrawerStepperButton
                          focusKey="tv-player-drawer-substyle-pos-reset"
                          label="Restaurar"
                          onClick={() => {
                            uiSoundService.play('toggle', { playerControl: true });
                            props.onSubtitlePosition(10);
                          }}
                          isSecondary
                        >
                          Restaurar
                        </DrawerStepperButton>
                      </div>
                    </div>

                    {/* COR DO TEXTO */}
                    <div>
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                        Cor do Texto
                      </span>
                      <div className="flex items-center gap-3">
                        {SUBTITLE_COLORS.map((col, index) => (
                          <DrawerColorChip
                            key={`sub-color-${col.value}`}
                            focusKey={`tv-player-drawer-substyle-color-${index}`}
                            color={col.value}
                            label={col.label}
                            active={(props.subtitleStyle.color || '#FFFFFF').toUpperCase() === col.value.toUpperCase()}
                            onClick={() => {
                              uiSoundService.play('toggle', { playerControl: true });
                              props.onSubtitleStyle({ color: col.value });
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* FUNDO */}
                    <div>
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                        Fundo
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {SUBTITLE_BG_COLORS.map((bgOpt, index) => (
                          <DrawerPillChip
                            key={`sub-bg-${bgOpt.value}`}
                            focusKey={`tv-player-drawer-substyle-bg-${index}`}
                            label={bgOpt.label}
                            active={(props.subtitleStyle.bgColor || 'semi') === bgOpt.value}
                            onClick={() => {
                              uiSoundService.play('toggle', { playerControl: true });
                              props.onSubtitleStyle({ bgColor: bgOpt.value });
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* RODAPÉ DO DRAWER */}
              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-gray-400 shrink-0">
                <span className="font-semibold text-gray-300">ZapiTV Cinema</span>
                <span>OK confirma · Voltar retorna</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </FocusContext.Provider>
  );
};
