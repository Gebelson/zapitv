import React, { useEffect, useCallback } from 'react';
import { AlertCircle } from 'lucide-react';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useTvFocusable } from '../../core/tv/useTvFocusable';
import { tvNavigationManager } from '../../core/tv/tvNavigationManager';
import { tvModeService } from '../../core/tv/tvModeService';

export interface TvPlaybackErrorScreenProps {
  failureCategory?: 'PLAYBACK_FAILURE' | 'VERIFICATION_ERROR' | 'NO_SOURCES_FOUND' | string;
  verificationState?: string;
  hasStreams: boolean;
  errorMessage?: string | null;
  canRetry: boolean;
  isRetrying?: boolean;
  onRetry?: () => void;
  onReportError: () => void;
  onClose: () => void;
}

export const TvPlaybackErrorScreen: React.FC<TvPlaybackErrorScreenProps> = ({
  failureCategory,
  verificationState,
  hasStreams,
  errorMessage,
  canRetry,
  isRetrying = false,
  onRetry,
  onReportError,
  onClose
}) => {
  const isRetryEnabled = Boolean(canRetry && !isRetrying);

  // 1. Botão "Tentar novamente"
  const { ref: retryRef, focused: isRetryFocused } = useTvFocusable({
    focusKey: 'tv-player-error-retry',
    focusable: isRetryEnabled,
    onEnterPress: () => {
      if (isRetryEnabled && onRetry) {
        onRetry();
      }
    },
    onArrowPress: (direction: string) => {
      if (direction === 'up' || direction === 'down') {
        return false; // Trava o foco na horizontal, sem perder para o vazio
      }
      if (direction === 'right') {
        setFocus('tv-player-error-report');
        return false;
      }
      if (direction === 'left') {
        return false; // Extremidade esquerda
      }
      return true;
    },
    soundType: 'hover',
    enterSound: 'confirm',
    isPlayerControl: true
  });

  // 2. Botão "Reportar erro"
  const { ref: reportRef, focused: isReportFocused } = useTvFocusable({
    focusKey: 'tv-player-error-report',
    focusable: true,
    onEnterPress: onReportError,
    onArrowPress: (direction: string) => {
      if (direction === 'up' || direction === 'down') {
        return false; // Trava o foco na horizontal
      }
      if (direction === 'right') {
        setFocus('tv-player-error-back');
        return false;
      }
      if (direction === 'left') {
        if (isRetryEnabled) {
          setFocus('tv-player-error-retry');
        }
        return false;
      }
      return true;
    },
    soundType: 'hover',
    enterSound: 'confirm',
    isPlayerControl: true
  });

  // 3. Botão "Voltar aos detalhes"
  const { ref: backRef, focused: isBackFocused } = useTvFocusable({
    focusKey: 'tv-player-error-back',
    focusable: true,
    onEnterPress: onClose,
    onArrowPress: (direction: string) => {
      if (direction === 'up' || direction === 'down') {
        return false; // Trava o foco na horizontal
      }
      if (direction === 'left') {
        setFocus('tv-player-error-report');
        return false;
      }
      if (direction === 'right') {
        return false; // Extremidade direita
      }
      return true;
    },
    soundType: 'hover',
    enterSound: 'close',
    isPlayerControl: true
  });

  // Foco automático inicial no primeiro botão habilitado e unpause defensivo
  useEffect(() => {
    tvNavigationManager.resume();

    const targetKey = isRetryEnabled ? 'tv-player-error-retry' : 'tv-player-error-report';
    const timer = setTimeout(() => {
      setFocus(targetKey);
    }, 60);

    return () => clearTimeout(timer);
  }, [isRetryEnabled]);

  // Se o botão de retry for desabilitado enquanto focado, transfere o foco para o Reportar erro
  useEffect(() => {
    if (!isRetryEnabled && isRetryFocused) {
      setFocus('tv-player-error-report');
    }
  }, [isRetryEnabled, isRetryFocused]);

  // Registro de alta prioridade para o botão Voltar do controle remoto (Fire TV 4, Tizen 10009, webOS 461, Escape 27)
  useEffect(() => {
    const unregister = tvNavigationManager.registerBackHandler('tv-playback-error-screen', 350, () => {
      onClose();
      return true;
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      unregister();
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onClose]);

  // Título e descrição do erro
  const errorTitle = failureCategory === 'PLAYBACK_FAILURE' || (hasStreams && failureCategory !== 'NO_SOURCES_FOUND')
    ? 'Não foi possível reproduzir este conteúdo agora'
    : failureCategory === 'VERIFICATION_ERROR' || verificationState === 'INCONCLUSIVE'
      ? 'Não foi possível verificar a disponibilidade'
      : failureCategory === 'NO_SOURCES_FOUND' || !hasStreams
        ? 'Conteúdo indisponível no momento'
        : 'Conteúdo indisponível';

  const defaultErrorDesc = failureCategory === 'PLAYBACK_FAILURE'
    ? 'Não foi possível reproduzir este conteúdo agora. Tente novamente mais tarde.'
    : verificationState === 'INCONCLUSIVE'
      ? 'Não foi possível verificar a disponibilidade agora. Tente novamente.'
      : 'Conteúdo indisponível no momento. Não foi possível encontrar uma fonte verificada agora. Tente novamente.';

  const isTv = tvModeService.isTvMode() || (typeof window !== 'undefined' && window.location.pathname.startsWith('/tv'));

  return (
    <div
      key="player-all-sources-failed"
      data-testid="tv-playback-error-screen"
      className="absolute inset-0 z-[3600] bg-[#05070a] flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-200"
    >
      <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(239,68,68,0.2)]">
        <AlertCircle className="w-10 h-10 text-red-500" />
      </div>

      <h2 className="text-2xl md:text-3xl font-black text-white mb-2">
        {errorTitle}
      </h2>

      <p className="text-gray-300 text-sm max-w-lg mb-6 leading-relaxed">
        {errorMessage || defaultErrorDesc}
      </p>

      <div
        className="flex flex-wrap items-center justify-center gap-3"
        data-testid="tv-error-actions"
      >
        {/* 1. Tentar novamente */}
        <button
          ref={retryRef}
          type="button"
          data-focus-key="tv-player-error-retry"
          data-testid="tv-player-error-retry"
          onClick={() => {
            if (isRetryEnabled && onRetry) {
              onRetry();
            }
          }}
          disabled={!isRetryEnabled}
          className={`px-6 py-3 rounded-full font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
            !isRetryEnabled
              ? 'opacity-40 cursor-not-allowed pointer-events-none bg-white/5 text-white/50'
              : 'bg-white/10 hover:bg-white/20 active:scale-95 text-white'
          } ${
            isRetryFocused
              ? 'ring-2 ring-cyan-300 ring-offset-2 ring-offset-black scale-105 bg-white/25 shadow-[0_0_20px_rgba(34,211,238,0.4)]'
              : ''
          }`}
        >
          {isRetrying ? 'Tentando novamente...' : 'Tentar novamente'}
        </button>

        {/* 2. Reportar erro */}
        <button
          ref={reportRef}
          type="button"
          data-focus-key="tv-player-error-report"
          data-testid="tv-player-error-report"
          onClick={onReportError}
          className={`px-6 py-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 active:scale-95 rounded-full font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
            isReportFocused
              ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-black scale-105 bg-amber-500/40 text-amber-200 border-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.4)]'
              : ''
          }`}
        >
          <AlertCircle className="w-4 h-4" />
          <span>Reportar erro</span>
        </button>

        {/* 3. Voltar aos detalhes */}
        <button
          ref={backRef}
          type="button"
          data-focus-key="tv-player-error-back"
          data-testid="tv-player-error-back"
          onClick={onClose}
          className={`px-6 py-3 bg-[#007df7] hover:bg-[#0069d9] active:scale-95 text-white rounded-full font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-[#007df7]/30 cursor-pointer ${
            isBackFocused
              ? 'ring-2 ring-cyan-300 ring-offset-2 ring-offset-black scale-105 bg-[#0069d9] shadow-[0_0_25px_rgba(0,125,247,0.6)]'
              : ''
          }`}
        >
          Voltar aos detalhes
        </button>
      </div>
    </div>
  );
};
