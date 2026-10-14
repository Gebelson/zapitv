import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ArrowLeft, Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX,
  Maximize, Minimize, Settings, SkipForward, AlertCircle, RefreshCw,
  Subtitles, Check, Sliders, Search, Globe, Languages, FastForward,
  Sparkles, X, PictureInPicture2, ShieldAlert, Columns2
} from 'lucide-react';
import Hls from 'hls.js';
import { StremioStream } from '../../core/stremio/stremioTypes';
import { storageService } from '../../core/storage/storageService';
import { ContentItem, ContentType } from '../../../types';
import { streamValidator } from '../../core/providers/streamValidator';
import { SubtitleTrack, subtitleService, sanitizeSubtitleText } from '../../core/subtitles/subtitleService';
import { validateSubtitleContentMatch } from '../../core/subtitles/subtitleLanguageDetector';
import { subtitleAutoSyncService } from '../../core/subtitles/subtitleAutoSyncService';
import { classifyStream } from '../../core/audio/audioDetector';
import { skipService, SkipInterval, SkipType } from '../../core/skip/skipService';
import { videoAdBlocker } from '../../core/security/videoAdBlocker';
import { streamQuarantineService } from '../../core/security/streamQuarantineService';
import { ZapiLoader } from '../common/ZapiLoader';
import { aiEnhancerService } from '../../core/enhancement/aiEnhancerService';
import { audioEnhancer } from '../../core/enhancement/audioEnhancer';
import { ZapiSkipButton } from './ZapiSkipButton';
import { ZapiStreamDiagnosticsModal } from '../dev/ZapiStreamDiagnosticsModal';
import { playbackSessionService, NavigationType } from '../../core/session/playbackSessionService';
import { autoPlayService } from '../../core/playback/autoPlayService';
import {
  subtitleStyleService,
  SubtitleStyle,
  DEFAULT_SUBTITLE_STYLE,
  DEFAULT_VERTICAL_POSITION,
  normalizeVerticalPosition
} from '../../core/subtitles/subtitleStyleService';
import { analyzeStreamSubtitleFormat } from '../../core/subtitles/streamSubtitleDetector';
import { pipService } from '../../core/pip/pipService';
import { mediaLoadingTracker } from '../../core/tracking/mediaLoadingTracker';
import { mediaSourceValidationService } from '../../core/providers/mediaSourceValidationService';
import { audioSelectionManager, AudioOption } from '../../core/audio/audioSelectionManager';

export interface NextEpisodeInfo {
  season: number;
  episode: number;
  title: string;
}

interface ZapiPlayerProps {
  item: ContentItem;
  streams: StremioStream[];
  isLoadingStreams?: boolean;
  streamResolutionError?: string | null;
  onRetrySources?: () => void;
  initialSeason?: number;
  initialEpisode?: number;
  nextEpisodeInfo?: NextEpisodeInfo | null;
  playbackSessionId?: string;
  navigationType?: NavigationType;
  initialPlayIntro?: boolean;
  onIntroCompleted?: () => void;
  onClose: () => void;
  onNextEpisode?: () => void;
}

export type PlaybackPhase = 
  | 'idle' 
  | 'resolving-source' 
  | 'intro' 
  | 'loading-content' 
  | 'playing-content' 
  | 'recovering' 
  | 'error' 
  | 'closed';

function parseTimeString(t: string): number {
  if (!t) return 0;
  const [hms, ms] = t.split(/[,.]/);
  const parts = hms.split(':').map(Number);
  const hours = parts.length === 3 ? parts[0] : 0;
  const minutes = parts.length === 3 ? parts[1] : parts[0];
  const seconds = parts.length === 3 ? parts[2] : parts[1];
  const millis = Number(ms || 0) / 1000;
  return (hours || 0) * 3600 + (minutes || 0) * 60 + (seconds || 0) + millis;
}

function parseSRT(data: string): Array<{ start: number; end: number; text: string }> {
  const cues: Array<{ start: number; end: number; text: string }> = [];
  const cleanedData = sanitizeSubtitleText(data);
  const blocks = cleanedData.replace(/\r\n/g, '\n').split('\n\n');
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length >= 2) {
      const timeLine = lines.find(l => l.includes('-->'));
      if (timeLine) {
        const [startStr, endStr] = timeLine.split('-->').map(s => s.trim());
        const start = parseTimeString(startStr);
        const end = parseTimeString(endStr);
        const timeIndex = lines.indexOf(timeLine);
        let text = lines.slice(timeIndex + 1).join('\n')
          .replace(/<[^>]+>/g, '')
          .replace(/\{[^}]+\}/g, '')
          .trim();
        text = sanitizeSubtitleText(text);
        // Filtro estrito: Nunca exibir mensagens institucionais/banners/placeholders como falas de legenda
        const isPlaceholder = /suporte a legendas|legenda em portugu[eê]s|\[zapitv|zapitv oficial|zapitv pt-br/i.test(text);
        if (text && !isPlaceholder && !isNaN(start) && !isNaN(end)) {
          cues.push({ start, end, text });
        }
      }
    }
  }
  return cues;
}

export const ZapiPlayer: React.FC<ZapiPlayerProps> = ({
  item,
  streams,
  isLoadingStreams = false,
  streamResolutionError,
  onRetrySources,
  initialSeason,
  initialEpisode,
  nextEpisodeInfo,
  playbackSessionId,
  navigationType,
  initialPlayIntro,
  onIntroCompleted,
  onClose,
  onNextEpisode
}) => {
  const [selectedStreamIndex, setSelectedStreamIndex] = useState(0);
  const currentStream = streams[selectedStreamIndex] || streams[0];

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Reprodução Automática de Episódios
  const [autoPlayEnabled, setAutoPlayEnabled] = useState<boolean>(() => autoPlayService.isAutoPlayEnabled());
  const [showAutoPlayCountdown, setShowAutoPlayCountdown] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(10);
  const [isAutoPlayCancelled, setIsAutoPlayCancelled] = useState(false);
  const autoPlayTimerRef = useRef<any>(null);
  const hasAutoAdvancedRef = useRef(false);

  // Sincroniza o switch com as configurações gerais em tempo real
  useEffect(() => {
    const unsub = autoPlayService.subscribe(setAutoPlayEnabled);
    return unsub;
  }, []);

  // Reinicia estados de autoplay ao trocar de episódio
  useEffect(() => {
    setIsAutoPlayCancelled(false);
    setShowAutoPlayCountdown(false);
    setCountdownSeconds(10);
    hasAutoAdvancedRef.current = false;
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
  }, [item.id, initialSeason, initialEpisode]);

  // Se o usuário desativar autoplay pelo switch durante o countdown, fecha o countdown imediatamente
  useEffect(() => {
    if (!autoPlayEnabled && showAutoPlayCountdown) {
      setShowAutoPlayCountdown(false);
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
    }
  }, [autoPlayEnabled, showAutoPlayCountdown]);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Picture-in-Picture State & Auto PiP
  const [isPipActive, setIsPipActive] = useState(false);
  const [isPipSupported, setIsPipSupported] = useState(() => pipService.isPipSupported());
  const [autoPipOnBlur, setAutoPipOnBlur] = useState(() => pipService.isAutoPipOnBlurEnabled());

  // Continuidade de reprodução entre trocas de stream, qualidade, áudio e recarga de página
  const targetResumeTimeRef = useRef<number>(0);
  const isInitialTimeAppliedRef = useRef<boolean>(false);

  // Determina se deve iniciar com a vinheta oficial da sessão
  const shouldStartWithIntro = useMemo(() => {
    if (navigationType === 'continuous_playback') {
      return false;
    }
    if (playbackSessionId) {
      return playbackSessionService.shouldPlayIntro(playbackSessionId);
    }
    if (typeof initialPlayIntro === 'boolean') {
      return initialPlayIntro;
    }
    return !playbackSessionService.isIntroPlayed();
  }, [navigationType, playbackSessionId, initialPlayIntro]);

  // ZapiTV Intro state & Smooth Media Transition
  const [isPlayingIntro, setIsPlayingIntro] = useState(() => shouldStartWithIntro);
  const [isIntroEnded, setIsIntroEnded] = useState(() => !shouldStartWithIntro);
  const [isIntroFading, setIsIntroFading] = useState(false);
  const [isMediaReady, setIsMediaReady] = useState(false);
  const [userSkippedIntro, setUserSkippedIntro] = useState(false);

  const introVideoRef = useRef<HTMLVideoElement | null>(null);
  const isMediaReadyRef = useRef(false);
  const isPlayingIntroRef = useRef(shouldStartWithIntro);
  const showNonDubbedPromptRef = useRef(false);
  const isIntroTransitioningRef = useRef(false);

  // Subtitles state
  const [subtitlesList, setSubtitlesList] = useState<SubtitleTrack[]>([]);
  const [isLoadingSubtitles, setIsLoadingSubtitles] = useState<boolean>(true);
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<string>('off');
  const [appliedSubtitleId, setAppliedSubtitleId] = useState<string>('off');
  const [subtitleStatus, setSubtitleStatus] = useState<'idle' | 'loading' | 'applied' | 'error' | 'unavailable'>('idle');
  const [subtitleErrorToast, setSubtitleErrorToast] = useState<string | null>(null);
  const [subtitleSearch, setSubtitleSearch] = useState('');
  const [cues, setCues] = useState<Array<{ start: number; end: number; text: string }>>([]);
  const [subDelay, setSubDelay] = useState(0);
  const [autoSyncToast, setAutoSyncToast] = useState<string | null>(null);

  // Confirmação para conteúdos sem dublagem brasileira
  const [hasUserConfirmedNonDubbed, setHasUserConfirmedNonDubbed] = useState<boolean>(() => {
    if (playbackSessionId && playbackSessionService.isNonDubbedConfirmed(playbackSessionId)) {
      return true;
    }
    return false;
  });

  // Skip Times state (AniSkip & IntroDB)
  const [skipIntervals, setSkipIntervals] = useState<SkipInterval[]>([]);
  const [autoSkipEnabled, setAutoSkipEnabled] = useState<boolean>(() => skipService.isAutoSkipEnabled());
  const [skipOffset, setSkipOffset] = useState<number>(() => skipService.getSkipOffset(item.id));
  const [showManualSkipModal, setShowManualSkipModal] = useState(false);
  const [manualStartInput, setManualStartInput] = useState('');
  const [manualEndInput, setManualEndInput] = useState('');
  const [manualTypeInput, setManualTypeInput] = useState<SkipType>('op');
  const hasAutoSkippedRef = useRef<Set<string>>(new Set());

  // Atualiza intervalos de skip quando o item, episódio ou duração mudarem
  useEffect(() => {
    let isMounted = true;
    hasAutoSkippedRef.current.clear();

    const loadSkipIntervals = async () => {
      try {
        const intervals = await skipService.getSkipTimes(
          item,
          initialSeason || 1,
          initialEpisode || 1,
          duration
        );
        if (isMounted) {
          setSkipIntervals(intervals);
        }
      } catch (err) {
        if (isMounted) setSkipIntervals([]);
      }
    };

    loadSkipIntervals();

    return () => {
      isMounted = false;
    };
  }, [item.id, initialSeason, initialEpisode, duration]);

  // Intervalo de skip ativo no momento
  const activeSkipInterval = useMemo(() => {
    if (!skipIntervals || skipIntervals.length === 0) return null;
    return skipIntervals.find(i => currentTime >= i.startTime && currentTime < (i.endTime - 0.5));
  }, [skipIntervals, currentTime]);

  // Executa o avanço até o término do intervalo (usando API de seek existente)
  const handleExecuteSkip = useCallback((interval: SkipInterval) => {
    const video = videoRef.current;
    if (!video) return;

    // Requisito 14: Não tenta avançar vídeos cuja fonte não permita seek
    if (!video.seekable || video.seekable.length === 0) {
      console.warn('[ZapiSkip] Fonte de vídeo não suporta busca/seek');
      return;
    }

    const targetTime = interval.endTime;
    let canSeek = false;
    for (let i = 0; i < video.seekable.length; i++) {
      if (targetTime >= video.seekable.start(i) && targetTime <= video.seekable.end(i) + 2) {
        canSeek = true;
        break;
      }
    }

    if (!canSeek && duration > 0 && targetTime > duration) {
      console.warn('[ZapiSkip] Tempo de destino excede a duração do vídeo');
      return;
    }

    try {
      video.currentTime = targetTime;
    } catch (err) {
      console.error('[ZapiSkip] Falha ao avançar vídeo:', err);
    }
  }, [duration]);

  useEffect(() => {
    if (playbackSessionId && playbackSessionService.isNonDubbedConfirmed(playbackSessionId)) {
      setHasUserConfirmedNonDubbed(true);
    } else {
      setHasUserConfirmedNonDubbed(false);
    }
  }, [item.id, initialSeason, initialEpisode, playbackSessionId]);

  // Verifica se existe dublagem em Português Brasileiro confirmada nas fontes
  const hasPtBrDubbingAvailable = useMemo(() => {
    if (item.audioStatus === 'pt-br-original') return true;
    if (!streams || streams.length === 0) return false;
    return streams.some(s => {
      if (s.isDubbed === true) return true;
      if (s.isPtBr === true && !s.isSubtitled) return true;
      const cls = classifyStream(s);
      return cls.isDubbed || (cls.isPtBr && !cls.isSubtitled) || cls.badge.includes('🔊');
    });
  }, [streams, item.audioStatus]);

  // Verifica se há legendas em português ou hardsub compatível
  const hasPtBrSubtitlesAvailable = useMemo(() => {
    if (currentStream) {
      const formatAnalysis = analyzeStreamSubtitleFormat(currentStream);
      if (formatAnalysis.isHardsub) return true;
    }
    if (subtitlesList.length > 0) {
      return subtitlesList.some(s => s.isPtBr || /^(pob|pt-br|bra|por-br|por|pt|pt-pt)$/i.test(s.lang));
    }
    return false;
  }, [currentStream, subtitlesList]);

  // Verifica se há fonte com áudio original disponível
  const hasOriginalAudioAvailable = useMemo(() => {
    return Boolean(streams && streams.length > 0);
  }, [streams]);

  // Modal para perguntar se o usuário deseja assistir sem dublagem brasileira
  const showNonDubbedPrompt = useMemo(() => {
    return !isLoadingStreams && streams.length > 0 && !hasPtBrDubbingAvailable && !hasUserConfirmedNonDubbed;
  }, [isLoadingStreams, streams.length, hasPtBrDubbingAvailable, hasUserConfirmedNonDubbed]);

  // Salto automático se habilitado nas configurações (Requisito 9)
  useEffect(() => {
    if (!autoSkipEnabled || !activeSkipInterval || isPlayingIntro || showNonDubbedPrompt) return;
    const intervalKey = `${activeSkipInterval.type}_${activeSkipInterval.rawStartTime}`;
    if (!hasAutoSkippedRef.current.has(intervalKey)) {
      hasAutoSkippedRef.current.add(intervalKey);
      handleExecuteSkip(activeSkipInterval);
    }
  }, [autoSkipEnabled, activeSkipInterval, isPlayingIntro, showNonDubbedPrompt, handleExecuteSkip]);

  // Ajuste manual de offset de sincronização
  const handleAdjustOffset = (delta: number) => {
    const newOffset = Number((skipOffset + delta).toFixed(1));
    setSkipOffset(newOffset);
    skipService.setSkipOffset(item.id, newOffset);
    skipService.getSkipTimes(item, initialSeason || 1, initialEpisode || 1, duration).then(setSkipIntervals);
  };

  const handleResetOffset = () => {
    setSkipOffset(0);
    skipService.setSkipOffset(item.id, 0);
    skipService.getSkipTimes(item, initialSeason || 1, initialEpisode || 1, duration).then(setSkipIntervals);
  };

  const handleToggleAutoSkip = () => {
    const nextVal = !autoSkipEnabled;
    setAutoSkipEnabled(nextVal);
    skipService.setAutoSkipEnabled(nextVal);
  };

  const handleSaveManualSkip = () => {
    const start = parseFloat(manualStartInput);
    const end = parseFloat(manualEndInput);
    if (isNaN(start) || isNaN(end) || end <= start) return;

    skipService.saveManualInterval(item.id, initialSeason || 1, initialEpisode || 1, {
      startTime: start,
      endTime: end,
      type: manualTypeInput
    });
    setShowManualSkipModal(false);
    skipService.getSkipTimes(item, initialSeason || 1, initialEpisode || 1, duration).then(setSkipIntervals);
  };

  const handleClearManualSkip = () => {
    skipService.clearManualInterval(item.id, initialSeason || 1, initialEpisode || 1);
    setShowManualSkipModal(false);
    skipService.getSkipTimes(item, initialSeason || 1, initialEpisode || 1, duration).then(setSkipIntervals);
  };
  // Dispara a contagem regressiva de 10s próxima ao final do episódio (últimos 12s)
  useEffect(() => {
    if (!autoPlayEnabled || isAutoPlayCancelled || !nextEpisodeInfo || !onNextEpisode) return;
    if (isPlayingIntro || showNonDubbedPrompt || showAutoPlayCountdown || hasAutoAdvancedRef.current) return;
    if (duration <= 15) return;

    const remainingTime = duration - currentTime;
    if (remainingTime <= 12 && currentTime > 10) {
      setShowAutoPlayCountdown(true);
      setCountdownSeconds(10);
    }
  }, [currentTime, duration, autoPlayEnabled, isAutoPlayCancelled, nextEpisodeInfo, onNextEpisode, isPlayingIntro, showNonDubbedPrompt, showAutoPlayCountdown]);

  // Tique da contagem regressiva de 10 segundos
  useEffect(() => {
    if (!showAutoPlayCountdown) {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
      return;
    }

    autoPlayTimerRef.current = setInterval(() => {
      setCountdownSeconds(prev => {
        if (prev <= 1) {
          if (autoPlayTimerRef.current) {
            clearInterval(autoPlayTimerRef.current);
            autoPlayTimerRef.current = null;
          }
          setShowAutoPlayCountdown(false);
          if (!hasAutoAdvancedRef.current && onNextEpisode && !isLoadingStreams) {
            hasAutoAdvancedRef.current = true;
            onNextEpisode();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
    };
  }, [showAutoPlayCountdown, onNextEpisode, isLoadingStreams]);

  const handleWatchNextNow = useCallback(() => {
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    setShowAutoPlayCountdown(false);
    if (!hasAutoAdvancedRef.current && onNextEpisode && !isLoadingStreams) {
      hasAutoAdvancedRef.current = true;
      onNextEpisode();
    }
  }, [onNextEpisode, isLoadingStreams]);

  const handleCancelAutoPlay = useCallback(() => {
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    setShowAutoPlayCountdown(false);
    setIsAutoPlayCancelled(true);
  }, []);

  const handleToggleAutoPlay = useCallback(() => {
    const nextVal = !autoPlayEnabled;
    setAutoPlayEnabled(nextVal);
    autoPlayService.setAutoPlayEnabled(nextVal);
  }, [autoPlayEnabled]);

  useEffect(() => {
    isPlayingIntroRef.current = isPlayingIntro;
  }, [isPlayingIntro]);

  useEffect(() => {
    if (navigationType === 'continuous_playback' || (playbackSessionId && !playbackSessionService.shouldPlayIntro(playbackSessionId))) {
      setIsPlayingIntro(false);
      setIsIntroEnded(true);
      isPlayingIntroRef.current = false;
    }
  }, [navigationType, playbackSessionId]);

  useEffect(() => {
    showNonDubbedPromptRef.current = showNonDubbedPrompt;
  }, [showNonDubbedPrompt]);

  // Transição cinematográfica com fade suave da intro para o conteúdo
  const transitionFromIntroToMedia = useCallback(() => {
    if (isIntroTransitioningRef.current || !isPlayingIntroRef.current) return;
    if (showNonDubbedPromptRef.current) return;

    const video = videoRef.current;
    if (!video) return;

    isIntroTransitioningRef.current = true;

    // Registra que a intro desta sessão foi concluída
    if (playbackSessionId) {
      playbackSessionService.markIntroPlayed(playbackSessionId);
    } else {
      playbackSessionService.markIntroPlayed();
    }
    onIntroCompleted?.();

    // 1. Inicia a reprodução do vídeo principal sob a camada da intro
    video.play()
      .then(() => {
        setIsPlaying(true);
        applyTargetResumeTime();
      })
      .catch(() => setIsPlaying(false));

    // 2. Dispara o fade out suave (700ms)
    setIsIntroFading(true);

    // 3. Após o fade suave de 700ms, desativa a camada da intro
    setTimeout(() => {
      setIsPlayingIntro(false);
      setIsIntroFading(false);
      isIntroTransitioningRef.current = false;
      if (introVideoRef.current) {
        try {
          introVideoRef.current.pause();
        } catch {}
      }
    }, 700);
  }, [playbackSessionId, onIntroCompleted]);

  // Quando o vídeo da intro chega ao final
  const handleIntroEnded = useCallback(() => {
    setIsIntroEnded(true);

    // Pausa exatamente no último frame da intro
    if (introVideoRef.current) {
      try {
        introVideoRef.current.pause();
      } catch {}
    }

    // Se a mídia já estiver carregada e pronta para tocar, inicia a transição suave imediatamente!
    if (isMediaReadyRef.current && !showNonDubbedPromptRef.current) {
      transitionFromIntroToMedia();
    }
    // Caso a mídia NÃO tenha carregado ainda:
    // Permanece pausado no último frame da intro até que a mídia fique pronta!
  }, [transitionFromIntroToMedia]);

  // Quando o usuário clica em "Pular Intro"
  const handleSkipIntro = useCallback(() => {
    if (showNonDubbedPromptRef.current) return;
    setUserSkippedIntro(true);

    if (introVideoRef.current) {
      try {
        introVideoRef.current.pause();
      } catch {}
    }

    // Se a mídia já está pronta, transiciona suavemente agora
    if (isMediaReadyRef.current) {
      transitionFromIntroToMedia();
    }
    // Se ainda não estiver pronta, congela a imagem no frame atual e transiciona assim que a mídia carregar
  }, [transitionFromIntroToMedia]);

  // Notifica que o stream principal foi carregado e está pronto para tocar
  const markMediaAsReady = useCallback(() => {
    setIsLoading(false);
    setIsMediaReady(true);
    isMediaReadyRef.current = true;

    // Se a intro não estiver ativa (reprodução contínua ou intro finalizada), inicia o vídeo principal
    if (!isPlayingIntroRef.current && !showNonDubbedPromptRef.current) {
      const video = videoRef.current;
      if (video && video.paused) {
        video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      }
    } else if ((isIntroEnded || userSkippedIntro) && isPlayingIntroRef.current && !isIntroTransitioningRef.current && !showNonDubbedPromptRef.current) {
      // Se a intro já tiver chegado ao fim (ou o usuário clicou em pular) e ainda está na intro:
      transitionFromIntroToMedia();
    }
  }, [isIntroEnded, userSkippedIntro, transitionFromIntroToMedia]);

  // Reação automática: assim que a mídia estiver pronta, se a intro já terminou ou foi pulada, transiciona!
  useEffect(() => {
    if (isMediaReady && (isIntroEnded || userSkippedIntro) && isPlayingIntro && !isIntroTransitioningRef.current && !showNonDubbedPrompt) {
      transitionFromIntroToMedia();
    }
  }, [isMediaReady, isIntroEnded, userSkippedIntro, isPlayingIntro, showNonDubbedPrompt, transitionFromIntroToMedia]);

  // Fallback de segurança (15 segundos) caso o navegador trave a decodificação da vinheta
  useEffect(() => {
    if (!isPlayingIntro || showNonDubbedPrompt) return;
    const timer = setTimeout(() => {
      handleIntroEnded();
    }, 15000);
    return () => clearTimeout(timer);
  }, [isPlayingIntro, handleIntroEnded, showNonDubbedPrompt]);

  // Pausa reproduções enquanto o aviso de falta de dublagem estiver visível
  useEffect(() => {
    if (showNonDubbedPrompt) {
      if (introVideoRef.current && !introVideoRef.current.paused) {
        introVideoRef.current.pause();
      }
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    }
  }, [showNonDubbedPrompt]);
  
  // Instant Fallback & Failure Tracking
  const [allSourcesFailed, setAllSourcesFailed] = useState(false);
  const triedIndicesRef = useRef<Set<number>>(new Set());
  const isSwitchingStreamRef = useRef(false);

  // Máquina de estados explícita do ciclo de vida da reprodução
  const playbackPhase: PlaybackPhase = useMemo(() => {
    if (allSourcesFailed) return 'error';
    if (isPlayingIntro) return 'intro';
    if (isLoadingStreams) return 'resolving-source';
    if (isSwitchingStreamRef.current) return 'recovering';
    if (isLoading || !isMediaReady) return 'loading-content';
    if (isPlaying) return 'playing-content';
    return 'idle';
  }, [allSourcesFailed, isPlayingIntro, isLoadingStreams, isLoading, isMediaReady, isPlaying]);

  // UI states
  const [showControls, setShowControls] = useState(true);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showSubtitlesMenu, setShowSubtitlesMenu] = useState(false);
  const [showStyleEditor, setShowStyleEditor] = useState(false);
  const [showDevDiagnostics, setShowDevDiagnostics] = useState(false);
  const [availableQualities, setAvailableQualities] = useState<string[]>([]);
  const [selectedQuality, setSelectedQuality] = useState('auto');

  // AI Enhancer state & canvas
  const aiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [aiSettings, setAiSettings] = useState(() => aiEnhancerService.getSettings());
  const [enhancerStatus, setEnhancerStatus] = useState<'off' | 'initializing' | 'active' | 'unavailable'>(() => aiEnhancerService.getStatus());
  const [isEnhancerRendering, setIsEnhancerRendering] = useState(() => aiEnhancerService.isRendering());
  const [isHoldingOriginal, setIsHoldingOriginal] = useState(false);
  const [showActivatedToast, setShowActivatedToast] = useState(false);
  const [showUnavailableToast, setShowUnavailableToast] = useState(false);
  const holdTimerRef = useRef<any>(null);
  const isHeldLongRef = useRef(false);

  // Split-Screen Image Comparison State (Tela Dividida)
  const [isSplitComparing, setIsSplitComparing] = useState(false);
  const [splitPosition, setSplitPosition] = useState(50);
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);

  // Status de ativação real da IA (pipeline processando e renderizando)
  const isAiActive = Boolean(
    aiSettings.enabled && 
    aiSettings.videoEnabled && 
    enhancerStatus === 'active' && 
    isEnhancerRendering
  );

  // Regras obrigatórias:
  // 1. Quando IA estiver desativada ou processamento falhar, encerra comparação em tela dividida
  useEffect(() => {
    if (isSplitComparing && !isAiActive) {
      setIsSplitComparing(false);
      aiEnhancerService.setComparisonMode('off');
    }
  }, [isAiActive, isSplitComparing]);

  const handleToggleSplit = useCallback(() => {
    if (!isAiActive) {
      setShowUnavailableToast(true);
      setTimeout(() => setShowUnavailableToast(false), 2500);
      return;
    }

    setIsSplitComparing(prev => {
      const next = !prev;
      aiEnhancerService.setComparisonMode(next ? 'split' : 'off');
      return next;
    });
  }, [isAiActive]);

  const handleToggleAiEnhancer = useCallback(() => {
    if (enhancerStatus === 'unavailable') {
      setShowUnavailableToast(true);
      setTimeout(() => setShowUnavailableToast(false), 2500);
      return;
    }

    const nextState = aiEnhancerService.toggleEnabled();
    if (!nextState) {
      setIsSplitComparing(false);
      aiEnhancerService.setComparisonMode('off');
    } else {
      setShowActivatedToast(true);
      setTimeout(() => setShowActivatedToast(false), 2500);
    }
  }, [enhancerStatus]);

  const updateSplitPosition = useCallback((clientX: number) => {
    const container = splitContainerRef.current || containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) return;
    const rawPos = ((clientX - rect.left) / rect.width) * 100;
    const clamped = Math.max(5, Math.min(95, Math.round(rawPos)));
    setSplitPosition(clamped);
    aiEnhancerService.setSplitPosition(clamped);
  }, []);

  useEffect(() => {
    if (!isDraggingDivider) return;

    const handlePointerMove = (e: PointerEvent) => {
      updateSplitPosition(e.clientX);
    };

    const handlePointerUp = () => {
      setIsDraggingDivider(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDraggingDivider, updateSplitPosition]);

  useEffect(() => {
    const unsub = aiEnhancerService.subscribe(setAiSettings);
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = aiEnhancerService.onStatusChange(setEnhancerStatus);
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = aiEnhancerService.onRenderingChange(setIsEnhancerRendering);
    return unsub;
  }, []);

  const syncCanvasDimensions = useCallback(() => {
    const video = videoRef.current;
    const canvas = aiCanvasRef.current;
    if (video && canvas && video.videoWidth > 0 && video.videoHeight > 0) {
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = aiCanvasRef.current;
    if (!video || !canvas) return;

    const isAnime = item.type === ContentType.ANIME || Boolean(item.genres?.some(g => /anime|animação/i.test(g))) || Boolean(item.title && /anime/i.test(item.title));
    aiEnhancerService.setContentCategory(isAnime ? 'anime' : 'live-action');
    aiEnhancerService.attachPlayer(video, canvas);

    return () => {
      aiEnhancerService.detachPlayer();
    };
  }, [item, selectedStreamIndex, initialSeason, initialEpisode]);

  const handleEnhancerPointerDown = (e: React.PointerEvent) => {
    if (enhancerStatus === 'unavailable') return;
    if (!aiSettings.enabled) {
      return;
    }
    // Quando a melhoria estiver ativa, segurar pressionado ativa comparação com vídeo original
    isHeldLongRef.current = false;
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      isHeldLongRef.current = true;
      setIsHoldingOriginal(true);
      aiEnhancerService.setHoldComparison(true);
    }, 150);
  };

  const handleEnhancerPointerUp = (e: React.PointerEvent) => {
    if (enhancerStatus === 'unavailable') {
      setShowUnavailableToast(true);
      setTimeout(() => setShowUnavailableToast(false), 2500);
      return;
    }
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (isHeldLongRef.current) {
      // Estava segurando: ao soltar o botão, volta instantaneamente para a versão melhorada
      isHeldLongRef.current = false;
      setIsHoldingOriginal(false);
      aiEnhancerService.setHoldComparison(false);
    } else {
      // Clique rápido (<150ms): liga ou desliga normalmente
      const nextState = aiEnhancerService.toggleEnabled();
      if (nextState) {
        setShowActivatedToast(true);
        setTimeout(() => setShowActivatedToast(false), 2500);
      }
    }
  };

  const handleEnhancerPointerLeave = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (isHeldLongRef.current) {
      isHeldLongRef.current = false;
      setIsHoldingOriginal(false);
      aiEnhancerService.setHoldComparison(false);
    }
  };
  
  // Cursor & Controls Auto-Hide State (Oculta cursor e controles após 2 segundos parado)
  const [isCursorVisible, setIsCursorVisible] = useState(true);
  const activityTimeoutRef = useRef<any>(null);

  // Audio / Dubbing Tracks state
  const [hlsAudioTracks, setHlsAudioTracks] = useState<Array<{ id: number; name: string; lang: string }>>([]);
  const [selectedHlsAudioTrack, setSelectedHlsAudioTrack] = useState<number>(0);
  const [preferredAudioLang, setPreferredAudioLang] = useState<string>('pt-BR');
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  const [isSwitchingAudio, setIsSwitchingAudio] = useState<boolean>(false);
  const previousStreamIndexRef = useRef<number>(selectedStreamIndex);
  const previousActiveAudioIdRef = useRef<string | null>(null);

  useEffect(() => {
    setHlsAudioTracks([]);
    setSelectedHlsAudioTrack(0);
  }, [selectedStreamIndex]);


  useEffect(() => {
    if (autoSyncToast) {
      const timer = setTimeout(() => {
        setAutoSyncToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [autoSyncToast]);

  useEffect(() => {
    if (subtitleErrorToast) {
      const timer = setTimeout(() => {
        setSubtitleErrorToast(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [subtitleErrorToast]);

  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>(() => {
    return subtitleStyleService.getSubtitleStyle();
  });

  useEffect(() => {
    const unsub = subtitleStyleService.subscribe(setSubtitleStyle);
    return unsub;
  }, []);

  const updateSubtitleStyle = (updates: Partial<SubtitleStyle>) => {
    const next = subtitleStyleService.updateSubtitleStyle(updates);
    setSubtitleStyle(next);
  };

  // Filtered subtitles for search (mantém variantes de release como alternativo)
  const filteredSubtitles = useMemo(() => {
    let list = subtitlesList;
    if (subtitleSearch.trim()) {
      const q = subtitleSearch.toLowerCase().trim();
      list = subtitlesList.filter(s =>
        s.languageName.toLowerCase().includes(q) ||
        s.label.toLowerCase().includes(q) ||
        s.lang.toLowerCase().includes(q)
      );
    }
    const unique = new Map<string, SubtitleTrack>();
    list.forEach(s => {
      const key = s.id;
      if (!unique.has(key)) {
        unique.set(key, s);
      }
    });
    return Array.from(unique.values());
  }, [subtitlesList, subtitleSearch]);

  // Activity timer to hide cursor and controls after 2 seconds (2000ms) of inactivity
  const handleUserActivity = useCallback(() => {
    setIsCursorVisible(true);
    setShowControls(true);

    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }

    activityTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setIsCursorVisible(false);
        setShowControls(false);
        setShowAudioMenu(false);
        setShowQualityMenu(false);
        setShowSubtitlesMenu(false);
        setShowStyleEditor(false);
      }
    }, 2000);
  }, [isPlaying]);

  const handleMouseLeave = useCallback(() => {
    if (isPlaying) {
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
      setIsCursorVisible(false);
      setShowControls(false);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying) {
      handleUserActivity();
    } else {
      setIsCursorVisible(true);
      setShowControls(true);
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
    }
  }, [isPlaying, handleUserActivity]);

  useEffect(() => {
    return () => {
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
    };
  }, []);

  // Carrega e restaura a posição salva (específica do episódio ou filme)
  useEffect(() => {
    isInitialTimeAppliedRef.current = false;
    let savedTime = 0;
    let dur = 0;
    if (initialSeason !== undefined && initialEpisode !== undefined) {
      const epProgress = storageService.resolveEpisodeWatchProgress(item, initialSeason, initialEpisode);
      if (epProgress) {
        savedTime = epProgress.currentTime;
        dur = epProgress.duration;
      }
    } else {
      const itemProg = storageService.resolveWatchProgress(item);
      if (itemProg) {
        savedTime = itemProg.currentTime;
        dur = itemProg.duration;
      }
    }

    if (savedTime > 2 && (dur <= 0 || savedTime < dur - 15)) {
      targetResumeTimeRef.current = savedTime;
      // Se o elemento de vídeo já possuir metadados carregados, aplica imediatamente
      if (videoRef.current && videoRef.current.readyState >= 1) {
        try {
          videoRef.current.currentTime = savedTime;
          isInitialTimeAppliedRef.current = true;
        } catch {
          // ignore
        }
      }
    } else {
      targetResumeTimeRef.current = 0;
    }
  }, [item, initialSeason, initialEpisode]);

  // Aplica com precisão a posição salva quando o player carrega ou troca de fonte/qualidade/áudio
  const applyTargetResumeTime = useCallback(() => {
    const target = targetResumeTimeRef.current;
    const video = videoRef.current;
    if (target > 0 && video && video.readyState >= 1) {
      try {
        if (Math.abs(video.currentTime - target) > 0.8) {
          video.currentTime = target;
        }
        isInitialTimeAppliedRef.current = true;
      } catch (e) {
        console.warn('Erro ao restaurar posição do vídeo:', e);
      }
    }
  }, []);

  // Keep latest progress in ref for instant flushing on unmount / pause
  const latestProgressRef = useRef({
    currentTime: 0,
    duration: 0
  });

  useEffect(() => {
    latestProgressRef.current = { currentTime, duration };
  }, [currentTime, duration]);

  const flushProgress = useCallback(() => {
    // Protege contra sobrescrever o progresso do usuário caso o seek inicial ainda não tenha sido aplicado
    if (!isInitialTimeAppliedRef.current && targetResumeTimeRef.current > 0) {
      return;
    }

    const video = videoRef.current;
    const cur = (video && video.currentTime > 0) 
      ? video.currentTime 
      : (targetResumeTimeRef.current > 0 ? targetResumeTimeRef.current : latestProgressRef.current.currentTime);
    const dur = (video && video.duration && !isNaN(video.duration) && video.duration > 0) 
      ? video.duration 
      : latestProgressRef.current.duration;

    // Se o vídeo estiver nos primeiros 2s mas o targetResumeTime era > 5s e o seek ainda não concluiu, não salva 0s
    if (cur < 2 && targetResumeTimeRef.current > 5 && !isInitialTimeAppliedRef.current) {
      return;
    }

    if (cur > 0 && dur > 0 && !isNaN(dur)) {
      storageService.saveProgress({
        contentId: item.id,
        item,
        season: initialSeason,
        episode: initialEpisode,
        currentTime: cur,
        duration: dur,
        percentage: Math.round((cur / dur) * 100),
        updatedAt: new Date().toISOString()
      });
    }
  }, [item, initialSeason, initialEpisode]);

  // Picture-in-Picture event listeners e sincronização de legendas nativas
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onEnterPip = () => {
      setIsPipActive(true);
      pipService.syncSubtitlesToNativeTrack(video, cues, true);
    };

    const onLeavePip = () => {
      setIsPipActive(false);
      pipService.syncSubtitlesToNativeTrack(video, cues, false);
    };

    video.addEventListener('enterpictureinpicture', onEnterPip);
    video.addEventListener('leavepictureinpicture', onLeavePip);

    return () => {
      video.removeEventListener('enterpictureinpicture', onEnterPip);
      video.removeEventListener('leavepictureinpicture', onLeavePip);
    };
  }, [cues]);

  // Atualiza legendas no PiP quando a lista de cues ou o atraso mudar
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      pipService.syncSubtitlesToNativeTrack(video, cues, isPipActive, subDelay);
    }
  }, [cues, isPipActive, subDelay]);

  // Alterna Picture-in-Picture de forma segura
  const handleTogglePip = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      await pipService.togglePictureInPicture(video);
    } catch (err: any) {
      console.warn('Erro ao alternar Picture-in-Picture:', err);
    }
  }, []);

  // PiP automático ao trocar de aba (quando ativado nas configurações)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!autoPipOnBlur) return;
      const video = videoRef.current;
      if (
        document.visibilityState === 'hidden' &&
        isPlaying &&
        video &&
        !video.paused &&
        !document.pictureInPictureElement
      ) {
        pipService.requestPictureInPicture(video).catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [autoPipOnBlur, isPlaying]);

  // Media Session API para controles nativos no PiP e Windows Media Flyout
  useEffect(() => {
    const video = videoRef.current;
    pipService.updateMediaSession({
      title: item.title,
      artist: 'ZapiTV',
      album: initialSeason && initialEpisode ? `Temporada ${initialSeason} · Ep. ${initialEpisode}` : (item.type || 'Filme'),
      artworkUrl: item.backdrop || item.image,
      duration,
      currentTime,
      isPlaying,
      onPlay: () => video?.play(),
      onPause: () => video?.pause(),
      onSeek: (seekTime) => {
        if (video) video.currentTime = seekTime;
      },
      onNextEpisode: (nextEpisodeInfo && onNextEpisode) ? onNextEpisode : undefined
    });
  }, [item, initialSeason, initialEpisode, duration, currentTime, isPlaying, nextEpisodeInfo, onNextEpisode]);

  // Periodic save of watch progress (every 4 seconds) & flush on unmount
  useEffect(() => {
    if (!duration || duration <= 0 || isNaN(duration)) return;
    const interval = setInterval(() => {
      flushProgress();
    }, 4000);
    return () => {
      clearInterval(interval);
      flushProgress();
    };
  }, [duration, flushProgress]);

  const handlePlayerClose = useCallback(() => {
    flushProgress();
    if (playbackSessionId) {
      playbackSessionService.endSession(playbackSessionId);
    } else {
      playbackSessionService.endSession();
    }
    onClose();
  }, [flushProgress, playbackSessionId, onClose]);

  const handleConfirmNonDubbedSubtitled = useCallback(() => {
    setHasUserConfirmedNonDubbed(true);
    if (playbackSessionId) {
      playbackSessionService.markNonDubbedConfirmed(playbackSessionId);
    }
    if (subtitlesList.length > 0) {
      const ptSub = subtitlesList.find(s => s.isPtBr) ||
                    subtitlesList.find(s => /^(pob|pt-br|bra|por-br)$/i.test(s.lang)) ||
                    subtitlesList.find(s => /^(por|pt|pt-pt)$/i.test(s.lang));
      if (ptSub) {
        setSelectedSubtitleId(ptSub.id);
      } else if (subtitlesList[0]) {
        setSelectedSubtitleId(subtitlesList[0].id);
      }
    }
    if (isPlayingIntro) {
      if (isIntroEnded) {
        if (isMediaReadyRef.current) {
          transitionFromIntroToMedia();
        }
      } else if (introVideoRef.current) {
        introVideoRef.current.play().catch(() => handleIntroEnded());
      }
    } else {
      if (videoRef.current) {
        videoRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      }
    }
  }, [isPlayingIntro, isIntroEnded, handleIntroEnded, transitionFromIntroToMedia, subtitlesList, playbackSessionId]);

  const handleConfirmNonDubbedOriginal = useCallback(() => {
    setHasUserConfirmedNonDubbed(true);
    if (playbackSessionId) {
      playbackSessionService.markNonDubbedConfirmed(playbackSessionId);
    }
    userManuallyChangedSubRef.current = true;
    setSelectedSubtitleId('off');
    if (isPlayingIntro) {
      if (isIntroEnded) {
        if (isMediaReadyRef.current) {
          transitionFromIntroToMedia();
        }
      } else if (introVideoRef.current) {
        introVideoRef.current.play().catch(() => handleIntroEnded());
      }
    } else {
      if (videoRef.current) {
        videoRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      }
    }
  }, [isPlayingIntro, isIntroEnded, handleIntroEnded, transitionFromIntroToMedia, playbackSessionId]);

  const handleRejectNonDubbed = useCallback(() => {
    handlePlayerClose();
  }, [handlePlayerClose]);

  // Flag para rastrear se o usuário alterou/desativou legendas manualmente na sessão
  const userManuallyChangedSubRef = useRef(false);

  // Determina se o conteúdo atual possui áudio dublado ou original em Português Brasileiro
  const hasBrazilianAudio = useMemo(() => {
    // 1. Verifica classificação do stream em reprodução
    if (currentStream) {
      if (currentStream.isDubbed === true || currentStream.isPtBr === true) return true;
      const classification = classifyStream(currentStream);
      if (classification.isDubbed || classification.isPtBr || classification.badge.includes('🔊')) return true;
    }
    // 2. Verifica audioStatus do metadado do item
    if (item.audioStatus === 'pt-br-original') return true;
    if (item.audioStatus === 'pt-br-dubbed') {
      if (currentStream) {
        const cls = classifyStream(currentStream);
        if (cls.isSubtitled && !cls.isDubbed) return false;
      }
      return true;
    }
    return false;
  }, [currentStream, item.audioStatus]);

  // Fetch subtitles via subtitleService (automatic IMDb resolution, flags, PT-BR top priority, stream-aware)
  useEffect(() => {
    let active = true;
    userManuallyChangedSubRef.current = false;
    setIsLoadingSubtitles(true);

    const fetchSubs = async () => {
      try {
        const list = await subtitleService.fetchSubtitles(item, initialSeason, initialEpisode, currentStream);
        if (active) {
          setSubtitlesList(list);
        }
      } catch (err) {
        console.warn('Erro ao carregar legendas:', err);
      } finally {
        if (active) {
          setIsLoadingSubtitles(false);
        }
      }
    };
    fetchSubs();
    return () => { active = false; };
  }, [item, initialSeason, initialEpisode, currentStream]);

  // Ativa automaticamente legenda em português para todo conteúdo sem dublagem brasileira,
  // evitando rigorosamente legendas duplicadas em fontes que já possuam Hardsub (gravadas na imagem)
  useEffect(() => {
    if (userManuallyChangedSubRef.current) return;
    if (subtitlesList.length === 0) return;

    // Se a fonte atual for Hardsub (legendas gravadas na imagem), NÃO ativa legendas externas
    if (currentStream) {
      const formatAnalysis = analyzeStreamSubtitleFormat(currentStream);
      if (formatAnalysis.isHardsub) {
        if (selectedSubtitleId !== 'off') {
          setSelectedSubtitleId('off');
        }
        return;
      }
    }

    if (!hasBrazilianAudio) {
      const ptSub = subtitlesList.find(s => s.isPtBr) ||
                    subtitlesList.find(s => /^(pob|pt-br|bra|por-br)$/i.test(s.lang)) ||
                    subtitlesList.find(s => /^(por|pt|pt-pt)$/i.test(s.lang));
      if (ptSub && selectedSubtitleId !== ptSub.id) {
        setSelectedSubtitleId(ptSub.id);
      }
    }
  }, [subtitlesList, hasBrazilianAudio, selectedSubtitleId, currentStream]);

  // Desativa faixas de legenda internas nativas do vídeo (softsub) para priorizar o player do ZapiTV
  const disableNativeTextTracks = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.textTracks) return;
    for (let i = 0; i < video.textTracks.length; i++) {
      const track = video.textTracks[i];
      if (track.label === 'ZapiTV PiP Subtitles' && isPipActive) {
        continue;
      }
      try {
        if (track.mode !== 'disabled') {
          track.mode = 'disabled';
        }
      } catch {}
    }
  }, [isPipActive]);

  useEffect(() => {
    disableNativeTextTracks();
    const video = videoRef.current;
    if (!video || !video.textTracks) return;

    const onAddTrack = () => {
      disableNativeTextTracks();
    };

    video.textTracks.addEventListener('addtrack', onAddTrack);
    video.textTracks.addEventListener('change', onAddTrack);
    video.addEventListener('loadedmetadata', onAddTrack);
    video.addEventListener('loadeddata', onAddTrack);

    return () => {
      video.textTracks.removeEventListener('addtrack', onAddTrack);
      video.textTracks.removeEventListener('change', onAddTrack);
      video.removeEventListener('loadedmetadata', onAddTrack);
      video.removeEventListener('loadeddata', onAddTrack);
    };
  }, [disableNativeTextTracks, currentStream]);

  // Download, validação linguística & aplicação rigorosa da legenda selecionada
  useEffect(() => {
    if (selectedSubtitleId === 'off') {
      setCues([]);
      setAppliedSubtitleId('off');
      setSubtitleStatus('idle');
      return;
    }

    const track = subtitlesList.find(s => s.id === selectedSubtitleId);
    if (!track?.url) {
      setCues([]);
      setAppliedSubtitleId('off');
      setSubtitleStatus('unavailable');
      return;
    }

    let active = true;
    setSubtitleStatus('loading');
    const cacheKey = `${item.id}_${initialSeason || 0}_${initialEpisode || 0}_${track.id}_${track.lang}`;

    subtitleService.fetchAndDecodeSRT(track.url, track.lang, cacheKey)
      .then(text => {
        if (!active) return;
        const parsed = parseSRT(text);
        if (parsed.length === 0) {
          throw new Error('Nenhuma fala legível identificada no arquivo de legenda');
        }

        // Validação estrita do idioma textual
        if (track.isPtBr || /^(pob|pt-br|bra|por-br)$/i.test(track.lang)) {
          const val = validateSubtitleContentMatch(parsed, 'pob');
          if (!val.isValid || !val.isConsistent) {
            throw new Error(val.reason || 'O texto não é em português brasileiro');
          }
        }

        setCues(parsed);
        setAppliedSubtitleId(track.id);
        setSubtitleStatus('applied');

        // Calibração automática de sincronia para eliminar qualquer atraso sem ação manual do usuário
        const autoSync = subtitleAutoSyncService.calculateAutoOffset({
          contentId: item.id,
          video: videoRef.current,
          cues: parsed,
          stream: currentStream,
          track,
          skipInterval: activeSkipInterval
        });

        setSubDelay(autoSync.offset);
        if (autoSync.offset !== 0) {
          setAutoSyncToast(autoSync.explanation);
        }
      })
      .catch((err) => {
        if (!active) return;
        console.warn('[ZapiPlayer] Falha ao validar/aplicar legenda:', err?.message || err);
        setCues([]);
        setAppliedSubtitleId('off');
        setSubtitleStatus('error');
        setSubtitleErrorToast('Legenda em Português (Brasil) indisponível para este vídeo.');
      });

    return () => { active = false; };
  }, [selectedSubtitleId, subtitlesList, currentStream, item.id, initialSeason, initialEpisode, activeSkipInterval]);

  // Extract available qualities STRICTLY from currentStream and verified resolutions (REGRA 3 e REGRA 6)
  useEffect(() => {
    if (!currentStream) {
      setAvailableQualities(['auto']);
      return;
    }

    // Se for HLS e o player já possuir níveis no manifesto:
    if (currentStream.url?.includes('.m3u8') && hlsRef.current && hlsRef.current.levels.length > 0) {
      const levels = hlsRef.current.levels.map(l => (l.height >= 2160 ? '4K' : `${l.height}p`));
      const unique = Array.from(new Set(levels));
      setAvailableQualities(['auto', ...unique]);
      return;
    }

    // Para streams MP4 / WebM: utiliza resoluções verificadas da fonte atual
    const streamQualities = mediaSourceValidationService.extractStreamResolutions(currentStream);
    setAvailableQualities(['auto', ...streamQualities]);
  }, [currentStream, selectedStreamIndex]);

  // Se a qualidade selecionada não existir mais após troca de fonte/idioma, redefine para 'auto'
  useEffect(() => {
    if (selectedQuality !== 'auto' && availableQualities.length > 0 && !availableQualities.includes(selectedQuality)) {
      setSelectedQuality('auto');
      if (hlsRef.current) {
        hlsRef.current.currentLevel = -1;
      }
    }
  }, [availableQualities, selectedQuality]);

  // Instant Fallback Algorithm (<50ms)
  const handleStreamFallback = useCallback((reason: string) => {
    if (isLoadingStreams) return;
    if (isSwitchingStreamRef.current) return;
    isSwitchingStreamRef.current = true;
    triedIndicesRef.current.add(selectedStreamIndex);

    // Invalida a fonte com falha no serviço centralizado de validação
    if (currentStream?.url) {
      mediaSourceValidationService.invalidateSource(item.id, currentStream.url, reason);
    }

    const remaining = streams
      .map((s, idx) => ({ s, idx }))
      .filter(({ idx }) => !triedIndicesRef.current.has(idx));

    if (remaining.length > 0) {
      const nextCandidate = remaining[0];
      setHasError(false);
      setIsLoading(true);

      const lastTime = (videoRef.current && videoRef.current.currentTime > 0)
        ? videoRef.current.currentTime
        : (latestProgressRef.current.currentTime || currentTime);
      if (lastTime > 0) {
        targetResumeTimeRef.current = lastTime;
      }

      // Se a fonte falhar durante uma tentativa de troca de áudio, reverte o áudio ativo
      if (previousActiveAudioIdRef.current) {
        setActiveAudioId(previousActiveAudioIdRef.current);
        previousActiveAudioIdRef.current = null;
      }
      setIsSwitchingAudio(false);

      // Troca instantânea para a próxima fonte válida sem travas
      setTimeout(() => {
        setSelectedStreamIndex(nextCandidate.idx);
        isSwitchingStreamRef.current = false;
      }, 50);
    } else {
      setAllSourcesFailed(true);
      setHasError(true);
      setIsLoading(false);
      setErrorMessage('As fontes testadas falharam agora. Tente buscar novamente.');
      isSwitchingStreamRef.current = false;
      setIsPlayingIntro(false);
      setIsIntroEnded(true);
      if (introVideoRef.current) {
        try {
          introVideoRef.current.pause();
        } catch {}
      }

    }
  }, [selectedStreamIndex, streams, isLoadingStreams, currentStream, item]);

  // Monitor loading of streams from parent modal
  useEffect(() => {
    if (isLoadingStreams) {
      setIsLoading(true);
      setAllSourcesFailed(false);
      setHasError(false);
      setSelectedStreamIndex(0);
      triedIndicesRef.current.clear();
      isSwitchingStreamRef.current = false;
      return;
    }

    if (streams.length === 0) {
      setAllSourcesFailed(true);
      setHasError(true);
      setErrorMessage(streamResolutionError || 'Não foi possível encontrar uma fonte verificada agora. Tente novamente.');
      setIsLoading(false);
      setIsPlayingIntro(false);
      setIsIntroEnded(true);
      if (introVideoRef.current) {
        try {
          introVideoRef.current.pause();
        } catch {}
      }
    } else {
      setAllSourcesFailed(false);
      setHasError(false);
    }
  }, [isLoadingStreams, streams.length, streamResolutionError]);

  // Pre-flight instant probe of candidate stream
  useEffect(() => {
    if (isLoadingStreams || !currentStream?.url) return;
    triedIndicesRef.current.add(selectedStreamIndex);

    // 0. Quarentena de integridade de conteúdo e termos adultos
    const quarantine = streamQuarantineService.evaluateQuarantine(currentStream, item?.title);
    if (quarantine.isQuarantined) {
      handleStreamFallback(`Fonte isolada por segurança (${quarantine.reason}).`);
      return;
    }

    // 1. Domínio na lista de bloqueio/estacionamento
    if (streamValidator.isUrlBlacklisted(currentStream.url)) {
      handleStreamFallback('Domínio na lista de bloqueio/estacionamento.');
      return;
    }

    // 2. Bloqueio prévio por propaganda/apostas embutidas (1xBet / Casas de Aposta)
    if (videoAdBlocker.isStreamBlocked(currentStream.url)) {
      handleStreamFallback('Fonte bloqueada por propaganda embutida no vídeo (1xBet / Apostas).');
      return;
    }

    const adEval = videoAdBlocker.evaluateStream(currentStream, item?.title, initialSeason, initialEpisode);
    if (adEval.status === 'bloqueado por propaganda embutida') {
      handleStreamFallback(`Fonte rejeitada por propaganda embutida (${adEval.reason}).`);
      return;
    }

    let isMounted = true;
    streamValidator.validateStream(currentStream, 6000).then((res) => {
      if (!isMounted) return;
      // Só descarta se comprovadamente for domínio de estacionamento/ParkLogic
      if (!res.valid && res.isParked) {
        handleStreamFallback('Domínio na lista de estacionamento/ParkLogic.');
      }
    }).catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [selectedStreamIndex, currentStream, handleStreamFallback, isLoadingStreams, item?.title, initialSeason, initialEpisode]);

  const markMediaAsReadyRef = useRef(markMediaAsReady);
  useEffect(() => {
    markMediaAsReadyRef.current = markMediaAsReady;
  }, [markMediaAsReady]);

  const handleStreamFallbackRef = useRef(handleStreamFallback);
  useEffect(() => {
    handleStreamFallbackRef.current = handleStreamFallback;
  }, [handleStreamFallback]);

  // Initialize Video Playback (HLS or Native MP4) — Re-executa APENAS quando a URL da fonte mudar
  useEffect(() => {
    if (isLoadingStreams) return;
    if (!currentStream?.url) return;
    setHasError(false);
    setIsLoading(true);
    setIsMediaReady(false);
    isMediaReadyRef.current = false;

    const video = videoRef.current;
    if (!video) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const videoUrl = currentStream.url;

    if (videoUrl.includes('.m3u8') && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90
      });

      hlsRef.current = hls;
      hls.loadSource(videoUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        markMediaAsReadyRef.current();
        applyTargetResumeTime();
        const levels = data.levels.map(l => (l.height >= 2160 ? '4K' : `${l.height}p`));
        const unique = Array.from(new Set(levels));
        setAvailableQualities(['auto', ...unique]);
        if (hls.audioTracks && hls.audioTracks.length > 0) {
          const tracks = hls.audioTracks.map((t: any) => ({
            id: t.id,
            name: t.name || t.lang || `Faixa ${t.id + 1}`,
            lang: t.lang || ''
          }));
          setHlsAudioTracks(tracks);

          // Auto-selecionar faixa PT-BR em stream Dual/Multi-áudio se o usuário preferir PT-BR
          if (preferredAudioLang === 'pt-BR') {
            const ptTrack = tracks.find((t: any) => 
              /^(por|pt|pob|bra)$/i.test(t.lang) || 
              /portugu[eê]s|dublado|brazil|brasil/i.test(t.name)
            );
            if (ptTrack && hls.audioTrack !== ptTrack.id) {
              hls.audioTrack = ptTrack.id;
              setSelectedHlsAudioTrack(ptTrack.id);
              setActiveAudioId(`hls-${ptTrack.id}`);
            } else {
              setSelectedHlsAudioTrack(hls.audioTrack);
              setActiveAudioId(`hls-${hls.audioTrack}`);
            }
          } else {
            setSelectedHlsAudioTrack(hls.audioTrack);
            setActiveAudioId(`hls-${hls.audioTrack}`);
          }
        }
        if (!isPlayingIntroRef.current && !showNonDubbedPromptRef.current) {
          video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
        }
      });

      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        markMediaAsReadyRef.current();
      });

      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_, data) => {
        if (data.audioTracks && data.audioTracks.length > 0) {
          const tracks = data.audioTracks.map((t: any) => ({
            id: t.id,
            name: t.name || t.lang || `Faixa ${t.id + 1}`,
            lang: t.lang || ''
          }));
          setHlsAudioTracks(tracks);

          if (preferredAudioLang === 'pt-BR') {
            const ptTrack = tracks.find((t: any) => 
              /^(por|pt|pob|bra)$/i.test(t.lang) || 
              /portugu[eê]s|dublado|brazil|brasil/i.test(t.name)
            );
            if (ptTrack && hls.audioTrack !== ptTrack.id) {
              hls.audioTrack = ptTrack.id;
              setSelectedHlsAudioTrack(ptTrack.id);
              setActiveAudioId(`hls-${ptTrack.id}`);
            } else {
              setSelectedHlsAudioTrack(hls.audioTrack);
              setActiveAudioId(`hls-${hls.audioTrack}`);
            }
          } else {
            setSelectedHlsAudioTrack(hls.audioTrack);
            setActiveAudioId(`hls-${hls.audioTrack}`);
          }
        }
      });

      hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_, data) => {
        setSelectedHlsAudioTrack(data.id);
        setActiveAudioId(`hls-${data.id}`);
        setIsSwitchingAudio(false);
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              handleStreamFallbackRef.current('Erro fatal no stream HLS.');
              break;
          }
        }
      });
    } else {
      // Native MP4 / WebM — Carrega e armazena em buffer antecipadamente
      video.preload = 'auto';
      video.src = videoUrl;
      video.load();
      video.onloadeddata = () => {
        markMediaAsReadyRef.current();
        applyTargetResumeTime();
        // Confirma que a nova fonte carregou e desliga transição de áudio
        setIsSwitchingAudio(false);
        previousStreamIndexRef.current = selectedStreamIndex;
        // Inspeciona resolução real a partir dos pixels do contêiner de vídeo
        if (video.videoHeight > 0) {
          const actualQ = video.videoHeight >= 2160 ? '4K' : (video.videoHeight >= 1080 ? '1080p' : (video.videoHeight >= 720 ? '720p' : `${video.videoHeight}p`));
          setAvailableQualities(['auto', actualQ]);
        }
        if (!isPlayingIntroRef.current && !showNonDubbedPromptRef.current) {
          video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
        }
      };
      video.oncanplay = () => {
        markMediaAsReadyRef.current();
        applyTargetResumeTime();
        setIsSwitchingAudio(false);
      };
      video.onerror = () => {
        setIsSwitchingAudio(false);
        handleStreamFallbackRef.current('Falha ao carregar arquivo de vídeo.');
      };
    }

    // Watchdog de segurança (15 segundos): se a fonte não disparar nenhum evento de reprodução, tenta a próxima fonte
    const watchdogTimer = setTimeout(() => {
      if (!isMediaReadyRef.current && !allSourcesFailed) {
        console.warn(`[ZapiPlayer] Watchdog disparado (15s sem resposta da fonte: ${currentStream?.title})`);
        mediaLoadingTracker.transition(item.id, 'TIMEOUT', {
          reason: 'Tempo limite de inicialização do stream esgotado (15s)'
        });
        handleStreamFallbackRef.current('Tempo limite de resposta do stream esgotado (15s).');
      }
    }, 15000);

    return () => {
      clearTimeout(watchdogTimer);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [currentStream?.url, isLoadingStreams]);

  // REGRA 2 — ÁUDIO OBRIGATÓRIO: Monitor contínuo de áudio funcional (bloqueia vídeos sem som)
  const audioCheckTicksRef = useRef<number>(0);
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isPlaying || isMuted || volume <= 0) return;

    audioCheckTicksRef.current = 0;
    const interval = setInterval(() => {
      if (video.paused || video.ended || video.currentTime < 3) return;

      // 1. mozHasAudio (Firefox)
      const mozHasAudio = (video as any).mozHasAudio;
      if (typeof mozHasAudio === 'boolean' && !mozHasAudio) {
        console.warn('[ZapiPlayer] Fonte sem faixa de áudio funcional (mozHasAudio = false).');
        handleStreamFallbackRef.current('Fonte sem faixa de áudio funcional.');
        return;
      }

      // 2. audioTracks (HTML5 padrão)
      const audioTracks = (video as any).audioTracks;
      if (audioTracks && typeof audioTracks.length === 'number' && audioTracks.length === 0) {
        console.warn('[ZapiPlayer] Fonte sem trilhas de áudio associadas.');
        handleStreamFallbackRef.current('Fonte sem faixa de áudio funcional.');
        return;
      }

      // 3. webkitAudioDecodedByteCount (Chrome, Edge, Safari)
      const decodedBytes = (video as any).webkitAudioDecodedByteCount;
      if (typeof decodedBytes === 'number' && video.currentTime > 6) {
        if (decodedBytes === 0) {
          audioCheckTicksRef.current += 1;
          if (audioCheckTicksRef.current >= 4) { // 4 verificações consecutivas com 0 bytes após 6s
            console.warn('[ZapiPlayer] Fonte sem sinal de áudio decodificado (0 bytes após 6s).');
            handleStreamFallbackRef.current('Fonte sem áudio funcional.');
          }
        } else {
          audioCheckTicksRef.current = 0;
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, isMuted, volume]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      if (showNonDubbedPrompt) {
        if (e.key === 'Escape') {
          e.preventDefault();
          handleRejectNonDubbed();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (hasPtBrSubtitlesAvailable) {
            handleConfirmNonDubbedSubtitled();
          } else if (hasOriginalAudioAvailable) {
            handleConfirmNonDubbedOriginal();
          }
        }
        return;
      }

      handleUserActivity();

      if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        setShowDevDiagnostics(prev => !prev);
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          e.preventDefault();
          skipTime(10);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skipTime(-10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          changeVolume(Math.min(1, volume + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          changeVolume(Math.max(0, volume - 0.1));
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          break;
        case 's':
        case 'S':
          if (activeSkipInterval) {
            e.preventDefault();
            handleExecuteSkip(activeSkipInterval);
          }
          break;
        case 'n':
        case 'N':
          if (onNextEpisode && !isLoadingStreams) {
            e.preventDefault();
            onNextEpisode();
          }
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          handleTogglePip();
          break;
        case 'Escape':
          if (!isFullscreen) handlePlayerClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [volume, isPlaying, isFullscreen, showNonDubbedPrompt, handleConfirmNonDubbedSubtitled, handleRejectNonDubbed, activeSkipInterval, handleExecuteSkip, onNextEpisode, isLoadingStreams, handleTogglePip]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      audioEnhancer.resumeAudioContext();
      video.play().then(() => setIsPlaying(true)).catch(console.error);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const skipTime = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + seconds));
  };

  const changeVolume = (val: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = val;
    setVolume(val);
    setIsMuted(val === 0);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isMuted) {
      video.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      video.volume = 0;
      setIsMuted(true);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(console.error);
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(console.error);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSelectQuality = (q: string) => {
    setSelectedQuality(q);
    setShowQualityMenu(false);
    if (hlsRef.current) {
      if (q === 'auto') {
        hlsRef.current.currentLevel = -1;
      } else {
        const levelIndex = hlsRef.current.levels.findIndex(l => {
          const lLabel = l.height >= 2160 ? '4K' : `${l.height}p`;
          return lLabel.toLowerCase() === q.toLowerCase() || `${l.height}p`.toLowerCase() === q.toLowerCase();
        });
        if (levelIndex !== -1) hlsRef.current.currentLevel = levelIndex;
      }
    }
  };

  // Opções de idioma de áudio e dublagem disponíveis gerenciadas pelo AudioSelectionManager
  const availableAudioOptions = useMemo<AudioOption[]>(() => {
    return audioSelectionManager.buildAudioOptions({
      item,
      streams,
      hlsTracks: hlsAudioTracks,
      currentStreamIndex: selectedStreamIndex,
      activeAudioId,
      selectedHlsTrackId: selectedHlsAudioTrack
    });
  }, [item, streams, hlsAudioTracks, selectedStreamIndex, activeAudioId, selectedHlsAudioTrack]);

  const handleSelectAudio = (opt: AudioOption) => {
    setShowAudioMenu(false);
    if (opt.langCode) {
      setPreferredAudioLang(opt.langCode);
    }

    // SITUAÇÃO A: Troca de faixa embutida no manifesto HLS (sem trocar de arquivo)
    if (opt.kind === 'hls-rendition' && opt.hlsTrackIndex !== undefined && hlsRef.current) {
      setIsSwitchingAudio(true);
      hlsRef.current.audioTrack = opt.hlsTrackIndex;
      setSelectedHlsAudioTrack(opt.hlsTrackIndex);
      setActiveAudioId(opt.id);
      setIsSwitchingAudio(false);
      return;
    }

    // SITUAÇÃO B: Troca de fonte separada (arquivo de vídeo diferente)
    if (opt.kind === 'separate-source' && opt.streamIndex !== undefined && opt.streamIndex !== selectedStreamIndex) {
      setIsSwitchingAudio(true);
      previousStreamIndexRef.current = selectedStreamIndex;
      previousActiveAudioIdRef.current = activeAudioId;

      // 1. Salvar progresso narrativo atual com máxima precisão
      const lastTime = (videoRef.current && videoRef.current.currentTime > 0)
        ? videoRef.current.currentTime
        : (latestProgressRef.current.currentTime || currentTime);

      if (lastTime > 0) {
        targetResumeTimeRef.current = lastTime;
      }

      // 2. Comutar stream index e definir o ID da opção solicitada
      setActiveAudioId(opt.id);
      setSelectedStreamIndex(opt.streamIndex);
      return;
    }

    // Se o usuário selecionou um idioma original (não dublado), garante legendas em português ativas
    if (opt.langCode && opt.langCode !== 'pt-BR') {
      if (selectedSubtitleId === 'off' && subtitlesList.length > 0) {
        const ptSub = subtitlesList.find(s => s.lang === 'pt' || s.lang === 'pt-BR' || s.lang === 'pob' || s.label.toLowerCase().includes('portugu'));
        if (ptSub) {
          setSelectedSubtitleId(ptSub.id);
        } else if (subtitlesList.length > 0) {
          setSelectedSubtitleId(subtitlesList[0].id);
        }
      }
    }
  };

  const activeCue = cues.find(c => (currentTime + subDelay) >= c.start && (currentTime + subDelay) <= c.end);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleUserActivity}
      onMouseDown={handleUserActivity}
      onClick={handleUserActivity}
      onMouseLeave={handleMouseLeave}
      className={`fixed inset-0 z-[2000] bg-black flex items-center justify-center select-none overflow-hidden font-sans transition-all duration-150 ${
        !isCursorVisible ? 'cursor-none hide-cursor [&_*]:!cursor-none' : 'cursor-default'
      }`}
    >
      {/* Vinheta Oficial ZapiTV (Intro Video com Preenchimento Total e Fade Suave) */}
      {isPlayingIntro && (
        <div
          className={`absolute inset-0 z-[3000] bg-black flex items-center justify-center select-none transition-opacity duration-700 ease-in-out ${
            isIntroFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <video
            ref={introVideoRef}
            src="/intro.mp4"
            autoPlay
            playsInline
            onEnded={handleIntroEnded}
            onError={handleIntroEnded}
            className="w-full h-full object-cover bg-black"
          />

          {/* Indicador discreto caso a intro termine e ainda esteja aguardando o carregamento da mídia */}
          {(isIntroEnded || userSkippedIntro) && !isMediaReady && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center z-[3005] animate-in fade-in duration-300 pointer-events-none select-none">
              <ZapiLoader size="lg" />
            </div>
          )}

          {/* Botão Pular Intro */}
          {(!isIntroEnded || !isMediaReady) && (
            <button
              onClick={handleSkipIntro}
              className="absolute bottom-8 right-8 z-[3010] flex items-center gap-2 px-5 py-2.5 bg-black/70 hover:bg-black/90 text-white rounded-full border border-white/20 backdrop-blur-md text-xs font-bold uppercase tracking-wider transition-all hover:scale-105 shadow-2xl cursor-pointer"
            >
              Pular Intro <SkipForward className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Modal de Confirmação: Conteúdo indisponível no seu idioma (REGRA 5 e Seção 10) */}
      {showNonDubbedPrompt && (
        <div className="absolute inset-0 z-[3500] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 select-none animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-[#0f121a]/95 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center backdrop-blur-2xl">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-5 text-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
              <Globe className="w-8 h-8 sm:w-10 sm:h-10" />
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-white mb-2 leading-tight">
              Conteúdo indisponível no seu idioma
            </h3>

            <p className="text-gray-300 text-xs sm:text-sm leading-relaxed mb-6 sm:mb-8 max-w-sm">
              Não encontramos uma versão com áudio em português brasileiro para este conteúdo. Você pode assistir em outro idioma disponível.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3 w-full">
              <button
                type="button"
                onClick={handleRejectNonDubbed}
                className="w-full sm:flex-1 py-3 px-3 bg-white/10 hover:bg-white/20 active:scale-95 text-gray-300 hover:text-white rounded-xl font-bold text-xs uppercase tracking-wider border border-white/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                Cancelar
              </button>
              {hasOriginalAudioAvailable && (
                <button
                  type="button"
                  onClick={handleConfirmNonDubbedOriginal}
                  className="w-full sm:flex-1 py-3 px-3 bg-white/15 hover:bg-white/25 active:scale-95 text-white rounded-xl font-bold text-xs uppercase tracking-wider border border-white/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  Assistir no idioma original
                </button>
              )}
              {hasPtBrSubtitlesAvailable && (
                <button
                  type="button"
                  onClick={handleConfirmNonDubbedSubtitled}
                  className="w-full sm:flex-1 py-3 px-3 bg-[#007df7] hover:bg-[#0069d9] active:scale-95 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-[#007df7]/30 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  Assistir legendado
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Configuração / Correção Manual de Abertura */}
      {showManualSkipModal && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 z-[3600] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200"
        >
          <div className="relative w-full max-w-sm bg-[#0f121a]/95 border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col backdrop-blur-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h4 className="text-base font-black text-white flex items-center gap-2">
                <FastForward className="w-4 h-4 text-[#007df7]" /> Ajustar Marcação
              </h4>
              <button
                type="button"
                onClick={() => setShowManualSkipModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-left">
              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1.5">Tipo de Cena</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'op', label: 'Abertura' },
                    { id: 'recap', label: 'Recap' },
                    { id: 'ed', label: 'Encerramento' }
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setManualTypeInput(t.id as SkipType)}
                      className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                        manualTypeInput === t.id ? 'bg-[#007df7] text-white shadow-md shadow-[#007df7]/20' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-gray-300">Início (segundos)</label>
                  <button
                    type="button"
                    onClick={() => setManualStartInput(Math.floor(currentTime).toString())}
                    className="text-[10px] text-[#007df7] hover:underline font-bold cursor-pointer"
                  >
                    Usar atual ({formatTime(currentTime)})
                  </button>
                </div>
                <input
                  type="number"
                  value={manualStartInput}
                  onChange={(e) => setManualStartInput(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#007df7]"
                  placeholder="Ex: 85"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-gray-300">Término (segundos)</label>
                  <button
                    type="button"
                    onClick={() => setManualEndInput(Math.floor(currentTime).toString())}
                    className="text-[10px] text-[#007df7] hover:underline font-bold cursor-pointer"
                  >
                    Usar atual ({formatTime(currentTime)})
                  </button>
                </div>
                <input
                  type="number"
                  value={manualEndInput}
                  onChange={(e) => setManualEndInput(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#007df7]"
                  placeholder="Ex: 175"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={handleClearManualSkip}
                  className="py-2.5 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold cursor-pointer transition-all"
                >
                  Remover
                </button>
                <button
                  type="button"
                  onClick={handleSaveManualSkip}
                  className="flex-1 py-2.5 bg-[#007df7] hover:bg-[#0069d9] text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-md shadow-[#007df7]/20"
                >
                  Salvar Marcação
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Header Bar */}
      <div className={`absolute top-0 inset-x-0 p-4 md:p-6 bg-gradient-to-b from-black/90 via-black/40 to-transparent z-50 flex items-center justify-between transition-opacity duration-300 ${(showControls || !isPlaying || isSplitComparing || isDraggingDivider) && !showNonDubbedPrompt ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="flex items-center gap-3 md:gap-4 max-w-[65%] sm:max-w-[70%]">
          <button
            onClick={handlePlayerClose}
            className="flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md border border-white/10 transition-all font-bold text-xs uppercase tracking-wider shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Voltar</span>
          </button>
          <div className="flex flex-col min-w-0">
            <h2 className="text-white text-sm sm:text-base md:text-xl font-black drop-shadow truncate">
              {item.title}
            </h2>
            {initialSeason && initialEpisode && (
              <span className="text-[10px] sm:text-xs text-orange-400 font-bold tracking-wide truncate">
                Temporada {initialSeason} • Episódio {initialEpisode}
              </span>
            )}
          </div>
        </div>

        {/* Canto Superior Direito: [ Ícone Tela Dividida ] [ Melhoria por IA ] */}
        <div className="flex items-center gap-2 pointer-events-auto shrink-0">
          {/* Botão Tela Dividida (Comparar imagem - apenas ícone) */}
          <button
            type="button"
            onClick={handleToggleSplit}
            disabled={!isAiActive}
            className={`w-9 h-9 md:w-10 md:h-10 rounded-xl backdrop-blur-md border transition-all duration-200 flex items-center justify-center select-none ${
              !isAiActive
                ? 'opacity-40 cursor-not-allowed bg-white/5 border-white/5 text-gray-500'
                : isSplitComparing
                ? 'bg-[#007df7] border-[#007df7] text-white shadow-lg shadow-[#007df7]/30 hover:bg-[#006ee0] active:scale-95 cursor-pointer'
                : 'bg-black/60 hover:bg-white/20 text-white/80 hover:text-white border-white/10 active:scale-95 cursor-pointer'
            }`}
            title={
              !isAiActive
                ? 'Ative a Melhoria por IA para comparar a imagem'
                : isSplitComparing
                ? 'Encerrar comparação de imagem'
                : 'Comparar imagem'
            }
            aria-label="Comparar imagem"
          >
            <Columns2 className="w-4 h-4 md:w-5 md:h-5" />
          </button>

          {/* Botão Melhoria por IA */}
          <button
            type="button"
            onClick={handleToggleAiEnhancer}
            disabled={enhancerStatus === 'unavailable'}
            className={`h-9 md:h-10 px-3 md:px-4 rounded-xl backdrop-blur-md border transition-all duration-200 flex items-center gap-1.5 md:gap-2 select-none ${
              enhancerStatus === 'unavailable'
                ? 'opacity-40 cursor-not-allowed bg-white/5 border-white/5 text-gray-500'
                : isAiActive
                ? 'bg-[#007df7] border-[#007df7] text-white shadow-lg shadow-[#007df7]/30 hover:bg-[#006ee0] active:scale-95 cursor-pointer'
                : enhancerStatus === 'initializing'
                ? 'cursor-wait bg-[#007df7]/20 border-[#007df7]/40 text-[#38bdf8]'
                : 'bg-black/60 hover:bg-white/20 text-white/80 hover:text-white border-white/10 active:scale-95 cursor-pointer'
            }`}
            title={
              enhancerStatus === 'unavailable'
                ? 'Melhoria indisponível para este vídeo'
                : isAiActive
                ? 'Melhoria por IA Ativa (Clique para desativar)'
                : enhancerStatus === 'initializing'
                ? 'Melhorando imagem...'
                : 'Ativar Melhoria por IA'
            }
            aria-label="Melhoria por IA"
          >
            {enhancerStatus === 'initializing' ? (
              <RefreshCw className="w-4 h-4 animate-spin text-[#38bdf8]" />
            ) : (
              <Sparkles
                className={`w-4 h-4 ${
                  isAiActive ? 'fill-current text-white animate-pulse' : 'text-gray-300'
                }`}
              />
            )}
            <span className="text-xs md:text-sm font-bold whitespace-nowrap">
              {enhancerStatus === 'initializing'
                ? 'Processando...'
                : 'Melhoria por IA'}
            </span>
          </button>
        </div>
      </div>

      {/* Screen when all sources have failed */}
      {allSourcesFailed ? (
        <div className="absolute inset-0 z-[3600] bg-[#05070a] flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-200">
          <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(239,68,68,0.2)]">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-white mb-2">Não foi possível reproduzir este conteúdo.</h2>
          <p className="text-gray-300 text-sm max-w-lg mb-6 leading-relaxed">
            {errorMessage || 'Nenhum provedor retornou uma fonte verificada e reproduzível no momento. Você pode tentar novamente ou voltar aos detalhes do título.'}
          </p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => onRetrySources?.()}
              disabled={!onRetrySources}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-full font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
            >
              Tentar novamente
            </button>
            <button
              onClick={handlePlayerClose}
              className="px-6 py-3 bg-[#007df7] hover:bg-[#0069d9] active:scale-95 text-white rounded-full font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-[#007df7]/30 cursor-pointer"
            >
              Voltar aos detalhes
            </button>
          </div>
        </div>
      ) : (
        <div className="relative w-full h-full flex items-center justify-center" onClick={togglePlay}>
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            playsInline
            crossOrigin="anonymous"
            onLoadedMetadata={() => {
              markMediaAsReadyRef.current();
              applyTargetResumeTime();
              syncCanvasDimensions();
            }}
            onCanPlay={() => {
              markMediaAsReadyRef.current();
              applyTargetResumeTime();
              syncCanvasDimensions();
            }}
            onLoadedData={() => {
              markMediaAsReadyRef.current();
              applyTargetResumeTime();
            }}
            onTimeUpdate={() => {
              if (videoRef.current) {
                const cur = videoRef.current.currentTime;
                setCurrentTime(cur);
                if (targetResumeTimeRef.current > 0 && Math.abs(cur - targetResumeTimeRef.current) <= 2) {
                  targetResumeTimeRef.current = 0;
                }
              }
            }}
            onDurationChange={() => {
              if (videoRef.current) setDuration(videoRef.current.duration);
            }}
            onWaiting={() => setIsLoading(true)}
            onPlaying={() => {
              setIsLoading(false);
              setIsPlaying(true);
              syncCanvasDimensions();
              mediaLoadingTracker.transition(item.id, 'PLAYING', {
                streamTitle: currentStream?.title,
                quality: currentStream?.quality
              });
            }}
            onStalled={() => {
              // Não confunde buffering com erro imediato, mas avisa se persistir
              console.warn('[ZapiPlayer] Transferência do vídeo estagnada (stalled)');
            }}
            onError={(e) => {
              console.warn('[ZapiPlayer] Erro disparado pelo elemento de vídeo nativo:', e);
              handleStreamFallbackRef.current('Erro ao decodificar fluxo de vídeo.');
            }}
            onPause={() => setIsPlaying(false)}
            onEnded={() => {
              setIsPlaying(false);
              if (autoPlayEnabled && !isAutoPlayCancelled && nextEpisodeInfo && onNextEpisode && !isLoadingStreams) {
                if (!hasAutoAdvancedRef.current) {
                  hasAutoAdvancedRef.current = true;
                  setShowAutoPlayCountdown(false);
                  if (autoPlayTimerRef.current) {
                    clearInterval(autoPlayTimerRef.current);
                    autoPlayTimerRef.current = null;
                  }
                  onNextEpisode();
                }
              } else {
                setShowControls(true);
              }
            }}
          />

          {/* Canvas de Aceleração por Shaders WebGPU / WebGL / Anime4K */}
          <canvas
            ref={aiCanvasRef}
            className="absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity duration-150"
            style={{
              opacity: (aiSettings.enabled && aiSettings.videoEnabled && !isHoldingOriginal && isEnhancerRendering) ? 1 : 0,
              display: (aiSettings.enabled && aiSettings.videoEnabled && !isHoldingOriginal && isEnhancerRendering) ? 'block' : 'none',
              clipPath: (isSplitComparing && isAiActive)
                ? `polygon(${splitPosition}% 0%, 100% 0%, 100% 100%, ${splitPosition}% 100%)`
                : undefined,
              WebkitClipPath: (isSplitComparing && isAiActive)
                ? `polygon(${splitPosition}% 0%, 100% 0%, 100% 100%, ${splitPosition}% 100%)`
                : undefined
            }}
          />

          {/* Divisor de Comparação em Tela Dividida (Arraste Interativo) */}
          {isSplitComparing && isAiActive && (
            <div
              ref={splitContainerRef}
              className="absolute inset-0 pointer-events-auto select-none overflow-hidden z-25"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Linha Divisória Vertical com Handle */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white/90 shadow-[0_0_12px_rgba(0,125,247,0.8)] flex items-center justify-center -translate-x-1/2 cursor-ew-resize group"
                style={{ left: `${splitPosition}%` }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setIsDraggingDivider(true);
                  updateSplitPosition(e.clientX);
                }}
              >
                {/* Handle central com ícone Columns2 */}
                <div 
                  className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-[#0f121a]/95 border border-white/40 text-white shadow-2xl backdrop-blur-md flex items-center justify-center cursor-ew-resize hover:scale-110 active:scale-95 transition-transform hover:border-[#007df7] group-hover:border-[#007df7]"
                  title="Arraste para comparar"
                >
                  <Columns2 className="w-4 h-4 text-white pointer-events-none" />
                </div>
              </div>

              {/* Badges sutis de identificação */}
              <div className="absolute top-20 left-4 md:left-8 pointer-events-none animate-in fade-in duration-300">
                <span className="px-3 py-1 rounded-full text-[10px] md:text-xs font-black uppercase tracking-wider bg-black/75 border border-white/20 text-gray-300 shadow-xl backdrop-blur-md">
                  Original
                </span>
              </div>
              <div className="absolute top-20 right-4 md:right-8 pointer-events-none animate-in fade-in duration-300">
                <span className="px-3 py-1 rounded-full text-[10px] md:text-xs font-black uppercase tracking-wider bg-[#007df7]/85 border border-[#007df7] text-white shadow-xl backdrop-blur-md flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 fill-current" />
                  Melhoria por IA
                </span>
              </div>
            </div>
          )}

          {/* Badge Visual: Original (Segurando) */}
          {isHoldingOriginal && (
            <div className="absolute top-16 inset-x-0 flex justify-center pointer-events-none z-50 animate-in fade-in duration-100">
              <div className="bg-black/90 border border-amber-400 text-white px-5 py-2 rounded-full text-xs font-black tracking-widest uppercase shadow-2xl backdrop-blur-md flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                <span>Original (Segurando)</span>
              </div>
            </div>
          )}

          {/* Notificação Discreta: Melhoria por IA Indisponível */}
          {showUnavailableToast && (
            <div className="absolute top-16 inset-x-0 flex justify-center pointer-events-none z-50 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="bg-[#0f121a]/95 border border-amber-500/40 text-amber-300 px-5 py-2 rounded-full text-xs font-bold shadow-2xl backdrop-blur-md flex items-center gap-2.5 shadow-amber-500/10">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Melhoria de imagem indisponível para este vídeo.</span>
              </div>
            </div>
          )}

          {/* Notificação Discreta: Melhoria por IA Ativada */}
          {showActivatedToast && (
            <div className="absolute top-16 inset-x-0 flex justify-center pointer-events-none z-50 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="bg-[#0f121a]/95 border border-[#007df7] text-white px-5 py-2 rounded-full text-xs font-bold shadow-2xl backdrop-blur-md flex items-center gap-2.5 shadow-[#007df7]/20">
                <Sparkles className="w-4 h-4 fill-current text-[#007df7] animate-pulse" />
                <span>Melhoria por IA Ativada</span>
              </div>
            </div>
          )}

          {/* Notificação Discreta de Auto-Sync de Legenda */}
          {autoSyncToast && (
            <div className="absolute top-16 inset-x-0 flex justify-center pointer-events-none z-40 px-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="bg-[#0f121a]/90 border border-emerald-500/40 text-emerald-300 px-4 py-1.5 rounded-full text-xs font-bold shadow-2xl backdrop-blur-md flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>{autoSyncToast}</span>
              </div>
            </div>
          )}

          {/* Notificação Discreta de Erro / Indisponibilidade de Legenda */}
          {subtitleErrorToast && (
            <div className="absolute top-16 inset-x-0 flex justify-center pointer-events-none z-40 px-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="bg-[#0f121a]/95 border border-amber-500/40 text-amber-300 px-4 py-1.5 rounded-full text-xs font-bold shadow-2xl backdrop-blur-md flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{subtitleErrorToast}</span>
              </div>
            </div>
          )}

          {/* Subtitle Overlay with Custom Styles and Configurable Vertical Height */}
          {appliedSubtitleId !== 'off' && activeCue && !/suporte a legendas|legenda em portugu[eê]s|\[zapitv/i.test(activeCue.text) && (
            <div
              className="absolute inset-x-0 flex justify-center pointer-events-none z-30 px-6 transition-all duration-75"
              style={{
                bottom: `calc(${normalizeVerticalPosition(subtitleStyle.verticalPosition)}% + env(safe-area-inset-bottom, 0px))`
              }}
            >
              <span 
                className="max-w-4xl text-center font-bold px-4 py-1.5 rounded-lg transition-all whitespace-pre-line"
                style={subtitleStyleService.computeSubtitleCSS(subtitleStyle, false)}
              >
                {activeCue.text}
              </span>
            </div>
          )}

          {/* Botão de Skip Inteligente (Pular Abertura / Recapitulação / Encerramento) com Contorno de Progresso */}
          {activeSkipInterval && !isPlayingIntro && !showNonDubbedPrompt && (
            <ZapiSkipButton
              interval={activeSkipInterval}
              currentTime={currentTime}
              onSkip={handleExecuteSkip}
            />
          )}

          {/* Card Flutuante de Reprodução Automática (Contagem Regressiva de 10s) */}
          {showAutoPlayCountdown && nextEpisodeInfo && !isPlayingIntro && !showNonDubbedPrompt && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-24 sm:bottom-28 right-4 sm:right-8 z-35 w-[310px] sm:w-[350px] bg-[#0f121a]/95 border border-white/15 rounded-2xl p-4 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-3 fade-in duration-300 select-none text-left"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-300">
                  <Play className="w-3.5 h-3.5 fill-[#007df7] text-[#007df7]" />
                  <span>Próximo episódio em</span>
                  <span className="text-[#007df7] font-black text-sm font-mono">{countdownSeconds}s</span>
                </div>
                <button
                  type="button"
                  onClick={handleCancelAutoPlay}
                  className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                  title="Cancelar reprodução automática"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="mb-3">
                <span className="text-[10px] uppercase font-black tracking-wider text-[#007df7] block">
                  Temporada {nextEpisodeInfo.season} • Episódio {nextEpisodeInfo.episode}
                </span>
                <h5 className="text-white font-bold text-xs sm:text-sm line-clamp-1">
                  {nextEpisodeInfo.title}
                </h5>
              </div>

              {/* Barra de Progresso da Contagem (10s) */}
              <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-[#007df7] transition-all duration-1000 ease-linear shadow-[0_0_8px_rgba(0,125,247,0.8)]"
                  style={{ width: `${Math.max(0, Math.min(100, (countdownSeconds / 10) * 100))}%` }}
                />
              </div>

              {/* Botões Assistir Agora e Cancelar */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleWatchNextNow}
                  className="flex-1 py-2 px-3 bg-[#007df7] hover:bg-[#0069d9] active:scale-95 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-md shadow-[#007df7]/20 cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-current" />
                  Assistir agora
                </button>
                <button
                  type="button"
                  onClick={handleCancelAutoPlay}
                  className="py-2 px-3 bg-white/10 hover:bg-white/15 active:scale-95 text-gray-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Tela de Finalização quando Autoplay Desativado ou Cancelado */}
          {(!autoPlayEnabled || isAutoPlayCancelled) && duration > 0 && currentTime >= (duration - 1) && !isPlaying && nextEpisodeInfo && onNextEpisode && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300 select-none"
            >
              <div className="w-14 h-14 rounded-full bg-[#007df7]/20 border border-[#007df7]/40 flex items-center justify-center mb-4 text-[#007df7]">
                <Check className="w-7 h-7" />
              </div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Episódio Finalizado</span>
              <h3 className="text-xl sm:text-2xl font-black text-white mb-1">
                Temporada {nextEpisodeInfo.season} • Episódio {nextEpisodeInfo.episode}
              </h3>
              <p className="text-gray-300 text-sm mb-6 max-w-md line-clamp-1">{nextEpisodeInfo.title}</p>
              
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const video = videoRef.current;
                    if (video) {
                      video.currentTime = 0;
                      video.play().then(() => setIsPlaying(true)).catch(() => {});
                    }
                  }}
                  className="px-5 py-2.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" /> Assistir Novamente
                </button>
                <button
                  type="button"
                  onClick={onNextEpisode}
                  className="px-6 py-2.5 bg-[#007df7] hover:bg-[#0069d9] active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-[#007df7]/30 cursor-pointer"
                >
                  <SkipForward className="w-4 h-4 fill-current" /> Próximo Episódio
                </button>
              </div>
            </div>
          )}

          {/* Buffering/Loading Spinner — Carregamento Oficial ZapiTV */}
          {(isLoading || isLoadingStreams) && !showNonDubbedPrompt && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 pointer-events-none select-none">
              <ZapiLoader size="lg" />
            </div>
          )}

          {/* Error Message with Fallback */}
          {hasError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-30 p-6 text-center">
              <AlertCircle className="w-16 h-16 text-red-500 mb-4 animate-bounce" />
              <h3 className="text-white text-xl font-black mb-2">Fonte Indisponível</h3>
              <p className="text-gray-400 text-sm max-w-md mb-6">{errorMessage}</p>
              <button
                onClick={() => onRetrySources?.()}
                disabled={!onRetrySources}
                className="px-6 py-3 bg-[#007df7] hover:bg-[#0069d9] text-white rounded-full font-black text-sm uppercase tracking-wider transition-all"
              >
                Tentar Novamente
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bottom Controls Bar (Native ZapiTV Controls) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`absolute bottom-0 inset-x-0 p-4 md:p-6 bg-gradient-to-t from-black/95 via-black/60 to-transparent z-40 transition-opacity duration-300 ${(showControls || !isPlaying) && !showNonDubbedPrompt ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        {/* Progress Scrubber */}
        <div className="relative w-full py-2.5 cursor-pointer mb-3 group flex items-center select-none">
          {/* Linha Cinza de Fundo (Track) */}
          <div className="w-full h-2 bg-white/20 rounded-full relative flex items-center">
            {/* Linha Azul de Progresso — Cresce centralizada verticalmente com a linha cinza */}
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-2 group-hover:h-3 bg-[#007df7] rounded-full transition-all duration-150 flex items-center pointer-events-none"
              style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
            >
              {/* Bolinha Branca (Thumb) perfeitamente centralizada na ponta da linha azul */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={(e) => {
              const val = Number(e.target.value);
              setCurrentTime(val);
              if (videoRef.current) videoRef.current.currentTime = val;
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
        </div>

        <div className="flex items-center justify-between">
          {/* Left Controls */}
          <div className="flex items-center gap-3 md:gap-5">
            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all hover:scale-105"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>

            <button
              onClick={() => skipTime(-10)}
              className="text-gray-300 hover:text-white transition-colors"
              title="Retroceder 10s"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            <button
              onClick={() => skipTime(10)}
              className="text-gray-300 hover:text-white transition-colors"
              title="Avançar 10s"
            >
              <RotateCw className="w-5 h-5" />
            </button>

            {/* Volume */}
            <div className="flex items-center gap-2 group">
              <button onClick={toggleMute} className="text-gray-300 hover:text-white transition-colors">
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => changeVolume(Number(e.target.value))}
                className="w-16 sm:w-24 accent-[#007df7] cursor-pointer"
              />
            </div>

            {/* Time display */}
            <span className="text-xs text-gray-300 font-bold ml-2">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2 md:gap-3">
            {onNextEpisode && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNextEpisode();
                }}
                disabled={isLoadingStreams}
                className={`flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-all ${
                  isLoadingStreams ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'
                }`}
                title="Próximo Episódio (N)"
              >
                <SkipForward className="w-4 h-4 text-[#007df7]" />
                <span className="hidden sm:inline">Próximo</span>
              </button>
            )}

            {/* Audio / Dubbing Language Menu Button */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowAudioMenu(!showAudioMenu);
                  setShowSubtitlesMenu(false);
                  setShowQualityMenu(false);
                }}
                className={`p-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                  showAudioMenu ? 'bg-white/20 text-white' : 'text-gray-300 hover:text-white hover:bg-white/10'
                }`}
                title="Áudio e Dublagem"
              >
                <Languages className="w-5 h-5" />
                <span className="text-[11px] font-bold hidden xl:inline">
                  {availableAudioOptions.find(o => o.isCurrent)?.flag || '🇧🇷'}
                </span>
              </button>

              {showAudioMenu && (
                <div className="absolute bottom-12 right-0 bg-[#0f1115] border border-white/10 rounded-2xl p-3 w-72 shadow-2xl space-y-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <span className="text-xs uppercase font-black text-gray-300">Áudio e Dublagem</span>
                    <span className="text-[10px] text-gray-400 font-bold">
                      {availableAudioOptions.length} {availableAudioOptions.length === 1 ? 'opção' : 'opções'}
                    </span>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-1 custom-scrollbar pr-1">
                    {availableAudioOptions.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => handleSelectAudio(opt)}
                        className={`w-full text-left px-3 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-between ${
                          opt.isCurrent
                            ? 'bg-[#007df7] text-white shadow-md shadow-[#007df7]/20'
                            : 'text-gray-300 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate pr-2 min-w-0">
                          <span className="text-sm shrink-0">{opt.flag}</span>
                          <span className="truncate">{opt.label}</span>
                          <span
                            className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded shrink-0 ${
                              opt.isCurrent ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-400'
                            }`}
                          >
                            {opt.badge}
                          </span>
                        </div>
                        {opt.isCurrent && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    ))}

                    {availableAudioOptions.length <= 1 && (
                      <p className="text-[11px] text-gray-400 py-2 px-1 text-center leading-relaxed">
                        Áudio atual em reprodução direta.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Subtitles Menu Button */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowSubtitlesMenu(!showSubtitlesMenu);
                  setShowQualityMenu(false);
                  setShowAudioMenu(false);
                }}
                className={`p-2 rounded-lg transition-colors ${selectedSubtitleId !== 'off' ? 'bg-[#007df7] text-white' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}
                title="Legendas"
              >
                <Subtitles className="w-5 h-5" />
              </button>

              {showSubtitlesMenu && (
                <div className="absolute bottom-12 right-0 bg-[#0f1115] border border-white/10 rounded-2xl p-3 w-84 sm:w-88 shadow-2xl space-y-2 z-50 animate-in fade-in zoom-in-95 duration-150 max-h-[82vh] overflow-y-auto custom-scrollbar">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10 sticky top-0 bg-[#0f1115] z-10">
                    <span className="text-xs uppercase font-black text-gray-300">Legendas</span>
                    <button
                      onClick={() => setShowStyleEditor(!showStyleEditor)}
                      className="text-[10px] uppercase font-bold text-[#007df7] hover:underline flex items-center gap-1"
                    >
                      <Sliders className="w-3 h-3" /> {showStyleEditor ? 'Idiomas' : 'Estilo'}
                    </button>
                  </div>

                  {!showStyleEditor ? (
                    <div className="space-y-2">
                      {subtitlesList.length > 6 && (
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Buscar idioma..."
                            value={subtitleSearch}
                            onChange={(e) => setSubtitleSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#007df7]"
                          />
                        </div>
                      )}

                      {/* Aviso se a fonte contiver hardsub (legendas gravadas na imagem) */}
                      {currentStream && analyzeStreamSubtitleFormat(currentStream).format === 'hardsub_foreign' && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 text-[10px] text-amber-300 flex items-start gap-1.5 leading-tight">
                          <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-amber-400 mt-0.5" />
                          <span>Este vídeo possui legendas embutidas nos frames (Hardsub em outro idioma).</span>
                        </div>
                      )}

                      <div className="max-h-64 overflow-y-auto space-y-1 custom-scrollbar pr-1">
                        <button
                          onClick={() => {
                            userManuallyChangedSubRef.current = true;
                            setSelectedSubtitleId('off');
                            setAppliedSubtitleId('off');
                            setCues([]);
                            setShowSubtitlesMenu(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-between ${appliedSubtitleId === 'off' ? 'bg-[#007df7] text-white shadow-md shadow-[#007df7]/20' : 'text-gray-300 hover:bg-white/10'}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">🚫</span>
                            <span>Desativada</span>
                          </div>
                          {appliedSubtitleId === 'off' && <Check className="w-3.5 h-3.5" />}
                        </button>

                        {filteredSubtitles.map(sub => {
                          const isApplied = appliedSubtitleId === sub.id;
                          const isRequested = selectedSubtitleId === sub.id;
                          const isLoadingThis = isRequested && subtitleStatus === 'loading';
                          const isErrorThis = isRequested && subtitleStatus === 'error';

                          return (
                            <button
                              key={sub.id}
                              onClick={() => {
                                userManuallyChangedSubRef.current = true;
                                setSelectedSubtitleId(sub.id);
                                setShowSubtitlesMenu(false);
                              }}
                              className={`w-full text-left px-3 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-between ${isApplied ? 'bg-[#007df7] text-white shadow-md shadow-[#007df7]/20' : 'text-gray-300 hover:bg-white/10'} ${sub.isPtBr ? 'border-l-2 border-[#007df7] pl-2.5' : ''}`}
                            >
                              <div className="flex items-center gap-2 truncate pr-2 min-w-0">
                                <span className="text-sm shrink-0">{sub.flag}</span>
                                <span className="truncate">{sub.languageName}</span>
                                {sub.isAutoTranslated ? (
                                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
                                    Tradução IA
                                  </span>
                                ) : sub.release ? (
                                  <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded shrink-0 ${isApplied ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-400'}`}>
                                    {sub.release}
                                  </span>
                                ) : null}
                                {sub.autoSyncBadge && (
                                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                                    Auto-Sync
                                  </span>
                                )}
                              </div>
                              {isApplied && <Check className="w-3.5 h-3.5 shrink-0" />}
                              {isLoadingThis && !isApplied && <RefreshCw className="w-3.5 h-3.5 shrink-0 text-[#007df7] animate-spin" />}
                              {isErrorThis && !isApplied && (
                                <span title="Falha ao aplicar legenda" className="shrink-0">
                                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                                </span>
                              )}
                            </button>
                          );
                        })}

                        {filteredSubtitles.length === 0 && (
                          <p className="text-[11px] text-gray-400 py-3 text-center">
                            {subtitleSearch ? 'Nenhum idioma encontrado.' : 'Nenhuma legenda disponível.'}
                          </p>
                        )}
                      </div>

                      {/* Controle Rápido de Posição vertical */}
                      <div className="pt-2 border-t border-white/10">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] uppercase font-bold text-gray-400">Posição vertical</span>
                          <div className="flex items-center gap-2">
                            {normalizeVerticalPosition(subtitleStyle.verticalPosition) !== DEFAULT_VERTICAL_POSITION && (
                              <button
                                onClick={() => updateSubtitleStyle({ verticalPosition: DEFAULT_VERTICAL_POSITION })}
                                className="text-[10px] text-[#007df7] hover:underline flex items-center gap-1 transition-colors"
                                title="Restaurar altura padrão"
                              >
                                <RotateCcw className="w-2.5 h-2.5" />
                                Restaurar
                              </button>
                            )}
                            <span className="text-[10px] text-gray-400 font-mono">
                              {normalizeVerticalPosition(subtitleStyle.verticalPosition)}%
                              {normalizeVerticalPosition(subtitleStyle.verticalPosition) === DEFAULT_VERTICAL_POSITION && ' (Padrão)'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="4"
                            max="35"
                            step="0.5"
                            value={normalizeVerticalPosition(subtitleStyle.verticalPosition)}
                            onChange={(e) => updateSubtitleStyle({ verticalPosition: parseFloat(e.target.value) })}
                            className="w-full accent-[#007df7] h-1.5 bg-white/10 rounded-lg cursor-pointer"
                            title="Posição vertical: arraste para a esquerda para descer ou para a direita para subir"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Subtitle Style Editor */
                    <div className="space-y-3 pt-1">
                      {/* Preview em Tempo Real (Demonstrando 2 Linhas) */}
                      <div className="relative rounded-xl overflow-hidden bg-gradient-to-b from-gray-950 via-zinc-900 to-black border border-white/10 p-3 text-center flex items-center justify-center min-h-[66px] shadow-inner select-none">
                        <span
                          className="font-bold px-3 py-1.5 rounded-md transition-all inline-block select-none whitespace-pre-line"
                          style={subtitleStyleService.computeSubtitleCSS(subtitleStyle, true)}
                        >
                          Primeira linha de legenda
                          {'\n'}
                          Segunda linha com espaçamento
                        </span>
                      </div>

                      {/* Contorno da Legenda */}
                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Contorno</span>
                        <div className="grid grid-cols-4 gap-1">
                          {[
                            { id: 'none', label: 'Nenhum' },
                            { id: 'thin', label: 'Fino' },
                            { id: 'medium', label: 'Médio' },
                            { id: 'thick', label: 'Forte' }
                          ].map(item => (
                            <button
                              key={item.id}
                              onClick={() => updateSubtitleStyle({ outline: item.id as any })}
                              className={`py-1 text-[10px] font-bold rounded-lg transition-all ${
                                subtitleStyle.outline === item.id 
                                  ? 'bg-[#007df7] text-white shadow-md shadow-[#007df7]/20' 
                                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Sombra da Legenda */}
                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Sombra</span>
                        <div className="grid grid-cols-4 gap-1">
                          {[
                            { id: 'none', label: 'Nenhuma' },
                            { id: 'soft', label: 'Suave' },
                            { id: 'strong', label: 'Forte' },
                            { id: 'drop', label: 'Projetada' }
                          ].map(item => (
                            <button
                              key={item.id}
                              onClick={() => updateSubtitleStyle({ shadow: item.id as any })}
                              className={`py-1 text-[10px] font-bold rounded-lg transition-all ${
                                subtitleStyle.shadow === item.id 
                                  ? 'bg-[#007df7] text-white shadow-md shadow-[#007df7]/20' 
                                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Tamanho da Fonte */}
                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Tamanho da Fonte</span>
                        <div className="grid grid-cols-4 gap-1">
                          {(['sm', 'md', 'lg', 'xl'] as const).map(size => (
                            <button
                              key={size}
                              onClick={() => updateSubtitleStyle({ fontSize: size })}
                              className={`py-1 text-xs font-black rounded-lg transition-all ${
                                subtitleStyle.fontSize === size ? 'bg-[#007df7] text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'
                              }`}
                            >
                              {size.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Espaçamento Vertical (Entre Linhas de Legenda) */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] uppercase font-bold text-gray-400">Espaçamento Vertical (2 Linhas)</span>
                          <span className="text-[10px] text-gray-400 font-mono">
                            {subtitleStyle.lineSpacing === 'compact' ? 'Compacto (1.15x)' :
                             subtitleStyle.lineSpacing === 'normal' ? 'Normal (1.35x)' :
                             subtitleStyle.lineSpacing === 'relaxed' ? 'Espaçado (1.60x)' :
                             'Amplo (1.95x)'}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          {[
                            { id: 'compact', label: 'Compacto' },
                            { id: 'normal', label: 'Normal' },
                            { id: 'relaxed', label: 'Espaçado' },
                            { id: 'spacious', label: 'Amplo' }
                          ].map(item => (
                            <button
                              key={item.id}
                              onClick={() => updateSubtitleStyle({ lineSpacing: item.id as any, customLineSpacing: undefined })}
                              className={`py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                                subtitleStyle.lineSpacing === item.id && typeof subtitleStyle.customLineSpacing !== 'number'
                                  ? 'bg-[#007df7] text-white shadow-md shadow-[#007df7]/20 font-black' 
                                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                        {/* Micro-ajuste deslizante fino */}
                        <div className="flex items-center gap-2 mt-1.5">
                          <input
                            type="range"
                            min="1.0"
                            max="2.3"
                            step="0.05"
                            value={
                              typeof subtitleStyle.customLineSpacing === 'number'
                                ? subtitleStyle.customLineSpacing
                                : (subtitleStyle.lineSpacing === 'compact' ? 1.15 :
                                   subtitleStyle.lineSpacing === 'normal' ? 1.35 :
                                   subtitleStyle.lineSpacing === 'relaxed' ? 1.6 : 1.95)
                            }
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              updateSubtitleStyle({
                                customLineSpacing: val,
                                lineSpacing: val < 1.25 ? 'compact' : val < 1.5 ? 'normal' : val < 1.8 ? 'relaxed' : 'spacious'
                              });
                            }}
                            className="w-full accent-[#007df7] h-1.5 bg-white/10 rounded-lg cursor-pointer"
                            title="Deslize para ajuste contínuo de espaçamento"
                          />
                          <span className="text-[10px] font-mono text-gray-300 min-w-[36px] text-right">
                            {(typeof subtitleStyle.customLineSpacing === 'number'
                              ? subtitleStyle.customLineSpacing
                              : (subtitleStyle.lineSpacing === 'compact' ? 1.15 :
                                 subtitleStyle.lineSpacing === 'normal' ? 1.35 :
                                 subtitleStyle.lineSpacing === 'relaxed' ? 1.6 : 1.95)
                            ).toFixed(2)}x
                          </span>
                        </div>
                      </div>

                      {/* Posição vertical */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] uppercase font-bold text-gray-400">Posição vertical</span>
                          <div className="flex items-center gap-2">
                            {normalizeVerticalPosition(subtitleStyle.verticalPosition) !== DEFAULT_VERTICAL_POSITION && (
                              <button
                                onClick={() => updateSubtitleStyle({ verticalPosition: DEFAULT_VERTICAL_POSITION })}
                                className="text-[10px] text-[#007df7] hover:underline flex items-center gap-1 transition-colors"
                                title="Restaurar altura padrão"
                              >
                                <RotateCcw className="w-2.5 h-2.5" />
                                Restaurar
                              </button>
                            )}
                            <span className="text-[10px] text-gray-400 font-mono">
                              {normalizeVerticalPosition(subtitleStyle.verticalPosition)}%
                              {normalizeVerticalPosition(subtitleStyle.verticalPosition) === DEFAULT_VERTICAL_POSITION && ' (Padrão)'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="4"
                            max="35"
                            step="0.5"
                            value={normalizeVerticalPosition(subtitleStyle.verticalPosition)}
                            onChange={(e) => updateSubtitleStyle({ verticalPosition: parseFloat(e.target.value) })}
                            className="w-full accent-[#007df7] h-1.5 bg-white/10 rounded-lg cursor-pointer"
                            title="Posição vertical: arraste para a esquerda para descer ou para a direita para subir"
                          />
                        </div>
                      </div>

                      {/* Cor da Legenda */}
                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Cor do Texto</span>
                        <div className="flex items-center gap-2">
                          {[
                            { name: 'Branco', hex: '#FFFFFF' },
                            { name: 'Amarelo', hex: '#FACC15' },
                            { name: 'Ciano', hex: '#38BDF8' },
                            { name: 'Verde', hex: '#4ADE80' }
                          ].map(color => (
                            <button
                              key={color.hex}
                              onClick={() => updateSubtitleStyle({ color: color.hex })}
                              className={`w-7 h-7 rounded-full border-2 transition-transform ${
                                subtitleStyle.color === color.hex ? 'scale-110 border-[#007df7]' : 'border-transparent'
                              }`}
                              style={{ backgroundColor: color.hex }}
                              title={color.name}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Fundo da Legenda */}
                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Fundo</span>
                        <div className="grid grid-cols-3 gap-1">
                          {[
                            { id: 'none', label: 'Nenhum' },
                            { id: 'semi', label: 'Translúcido' },
                            { id: 'solid', label: 'Sólido' }
                          ].map(bg => (
                            <button
                              key={bg.id}
                              onClick={() => updateSubtitleStyle({ bgColor: bg.id as any })}
                              className={`py-1 text-[10px] font-bold rounded-lg transition-all ${
                                subtitleStyle.bgColor === bg.id ? 'bg-[#007df7] text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'
                              }`}
                            >
                              {bg.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Sincronização Inteligente & Delay */}
                      <div className="pt-2 flex flex-col gap-2 border-t border-white/10">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-gray-400 font-bold">
                              Sincronia ({subDelay > 0 ? `+${subDelay}s` : `${subDelay}s`})
                            </span>
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              Auto-Sync
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                const newD = Number((subDelay - 0.5).toFixed(1));
                                setSubDelay(newD);
                                subtitleAutoSyncService.saveOffset(item.id, newD, currentStream, selectedSubtitleId);
                              }}
                              className="px-2 py-0.5 bg-white/5 hover:bg-white/10 rounded text-[10px] font-bold text-white transition-colors"
                              title="Atrasar legenda"
                            >
                              -0.5s
                            </button>
                            <button
                              onClick={() => {
                                setSubDelay(0);
                                subtitleAutoSyncService.saveOffset(item.id, 0, currentStream, selectedSubtitleId);
                              }}
                              className="px-2 py-0.5 bg-white/5 hover:bg-white/10 rounded text-[10px] font-bold text-white transition-colors"
                              title="Zerar atraso"
                            >
                              0s
                            </button>
                            <button
                              onClick={() => {
                                const newD = Number((subDelay + 0.5).toFixed(1));
                                setSubDelay(newD);
                                subtitleAutoSyncService.saveOffset(item.id, newD, currentStream, selectedSubtitleId);
                              }}
                              className="px-2 py-0.5 bg-white/5 hover:bg-white/10 rounded text-[10px] font-bold text-white transition-colors"
                              title="Adiantar legenda"
                            >
                              +0.5s
                            </button>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            const track = subtitlesList.find(s => s.id === selectedSubtitleId);
                            subtitleAutoSyncService.clearSavedOffset(item.id, currentStream, selectedSubtitleId);
                            const auto = subtitleAutoSyncService.calculateAutoOffset({
                              contentId: item.id,
                              video: videoRef.current,
                              cues,
                              stream: currentStream,
                              track,
                              skipInterval: activeSkipInterval
                            });
                            setSubDelay(auto.offset);
                            setAutoSyncToast(auto.explanation);
                          }}
                          className="w-full py-1.5 px-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition-colors border border-emerald-500/30 cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3 text-emerald-400" /> Auto-Sincronizar com o Vídeo
                        </button>
                      </div>

                      {/* Rodapé do Editor */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => {
                            const reset = subtitleStyleService.resetSubtitleStyle();
                            setSubtitleStyle(reset);
                          }}
                          className="py-1.5 px-3 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg text-xs font-bold transition-colors"
                          title="Restaurar padrão"
                        >
                          Padrão
                        </button>
                        <button
                          onClick={() => setShowStyleEditor(false)}
                          className="flex-1 py-1.5 bg-[#007df7] text-white rounded-lg text-xs font-bold hover:bg-[#0069d9] transition-all"
                        >
                          Salvar e Voltar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quality Menu Button */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowQualityMenu(!showQualityMenu);
                  setShowSubtitlesMenu(false);
                  setShowAudioMenu(false);
                }}
                className="p-2 text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-white/10"
                title="Qualidade de Vídeo"
              >
                <Settings className="w-5 h-5" />
              </button>

              {showQualityMenu && (
                <div className="absolute bottom-12 right-0 bg-[#0f1115] border border-white/10 rounded-2xl p-3 w-72 shadow-2xl space-y-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                  {/* Qualidade de Vídeo */}
                  <div>
                    <span className="text-[10px] uppercase font-black text-gray-400 block mb-1.5">Qualidade de Vídeo</span>
                    <div className="grid grid-cols-3 gap-1">
                      {availableQualities.map(q => (
                        <button
                          key={q}
                          onClick={() => handleSelectQuality(q)}
                          className={`py-1 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 ${
                            selectedQuality === q ? 'bg-[#007df7] text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'
                          }`}
                        >
                          <span>{q.toUpperCase()}</span>
                          {selectedQuality === q && <Check className="w-3 h-3" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reprodução Automática de Episódios */}
                  <div className="pt-2.5 border-t border-white/10 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-black text-gray-400 block">Reprodução automática</span>
                      <span className="text-[9px] text-gray-500">Avançar próximo episódio</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleAutoPlay}
                      className={`w-10 h-5.5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                        autoPlayEnabled ? 'bg-[#007df7]' : 'bg-gray-600/40'
                      }`}
                      title={autoPlayEnabled ? 'Desativar reprodução automática' : 'Ativar reprodução automática'}
                    >
                      <div className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform ${
                        autoPlayEnabled ? 'translate-x-4.5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  {/* PiP automático ao trocar de aba */}
                  {isPipSupported && (
                    <div className="pt-2.5 border-t border-white/10 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-black text-gray-400 block">PiP ao trocar de aba</span>
                        <span className="text-[9px] text-gray-500">Ativar janela flutuante ao sair</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !autoPipOnBlur;
                          setAutoPipOnBlur(next);
                          pipService.setAutoPipOnBlurEnabled(next);
                        }}
                        className={`w-10 h-5.5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                          autoPipOnBlur ? 'bg-[#007df7]' : 'bg-gray-600/40'
                        }`}
                        title={autoPipOnBlur ? 'Desativar PiP automático' : 'Ativar PiP automático'}
                      >
                        <div className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform ${
                          autoPipOnBlur ? 'translate-x-4.5' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>
                  )}

                  {/* Pular Abertura / Encerramento */}
                  <div className="pt-2.5 border-t border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-black text-gray-400">Pular Cenas</span>
                      <button
                        type="button"
                        onClick={handleToggleAutoSkip}
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase transition-all cursor-pointer ${
                          autoSkipEnabled ? 'bg-[#007df7] text-white shadow-sm' : 'bg-white/10 text-gray-400 hover:bg-white/15'
                        }`}
                      >
                        {autoSkipEnabled ? 'Automático: Sim' : 'Automático: Não'}
                      </button>
                    </div>

                    {/* Sincronização / Deslocamento */}
                    <div className="bg-white/5 rounded-xl p-2.5 space-y-1.5 border border-white/5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-gray-300 font-bold">Ajuste de Abertura</span>
                        <span className="text-orange-400 font-mono font-bold">
                          {skipOffset > 0 ? `+${skipOffset}s` : `${skipOffset}s`}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleAdjustOffset(-1)}
                          className="flex-1 py-1 bg-white/5 hover:bg-white/10 text-gray-300 rounded text-[10px] font-bold cursor-pointer"
                          title="Adiantar 1 segundo"
                        >
                          -1s
                        </button>
                        <button
                          type="button"
                          onClick={handleResetOffset}
                          className="flex-1 py-1 bg-white/5 hover:bg-white/10 text-gray-400 rounded text-[10px] font-bold cursor-pointer"
                          title="Resetar deslocamento"
                        >
                          0s
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdjustOffset(1)}
                          className="flex-1 py-1 bg-white/5 hover:bg-white/10 text-gray-300 rounded text-[10px] font-bold cursor-pointer"
                          title="Atrasar 1 segundo"
                        >
                          +1s
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setManualStartInput(Math.floor(currentTime).toString());
                            setManualEndInput(Math.floor(currentTime + 90).toString());
                            setShowManualSkipModal(true);
                            setShowQualityMenu(false);
                          }}
                          className="px-2.5 py-1 bg-[#007df7]/20 hover:bg-[#007df7]/30 text-[#007df7] rounded text-[10px] font-black cursor-pointer"
                          title="Editar marcação do episódio"
                        >
                          Manual
                        </button>
                      </div>
                    </div>

                    {/* Exibe marcações detectadas */}
                    {skipIntervals.length > 0 && (
                      <div className="text-[10px] text-gray-400 font-medium space-y-0.5 pt-1">
                        {skipIntervals.map((it, idx) => (
                          <div key={idx} className="flex justify-between items-center text-gray-400">
                            <span>{it.label}:</span>
                            <span className="font-mono text-gray-300">
                              {formatTime(it.startTime)} - {formatTime(it.endTime)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Picture-in-Picture (Imagem em imagem) Button */}
            {isPipSupported && (
              <button
                type="button"
                onClick={handleTogglePip}
                className={`p-2 rounded-lg transition-all flex items-center justify-center cursor-pointer ${
                  isPipActive
                    ? 'bg-[#007df7] text-white shadow-md shadow-[#007df7]/30 ring-1 ring-[#007df7]'
                    : 'text-gray-300 hover:text-white hover:bg-white/10'
                }`}
                title={isPipActive ? "Sair da imagem em imagem (P)" : "Imagem em imagem (P)"}
                aria-label="Imagem em imagem"
              >
                <PictureInPicture2 className="w-5 h-5" />
              </button>
            )}

            {/* Dev Diagnostic Button */}
            {import.meta.env.DEV && (
              <button
                type="button"
                onClick={() => setShowDevDiagnostics(prev => !prev)}
                className={`p-2 rounded-lg transition-all flex items-center justify-center cursor-pointer ${
                  showDevDiagnostics ? 'bg-sky-500/20 text-sky-400' : 'text-gray-400 hover:text-white hover:bg-white/10'
                }`}
                title="Diagnóstico de Fontes e Quarentena (Dev - Ctrl+Shift+D)"
                aria-label="Diagnóstico de Fontes"
              >
                <ShieldAlert className="w-5 h-5 text-sky-400" />
              </button>
            )}

            <button
              onClick={toggleFullscreen}
              className="p-2 text-gray-300 hover:text-white transition-colors"
              title="Tela Cheia (F)"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Dev Stream Diagnostics Modal */}
      {showDevDiagnostics && (
        <ZapiStreamDiagnosticsModal
          item={item}
          streams={streams}
          selectedStreamIndex={selectedStreamIndex}
          season={initialSeason}
          episode={initialEpisode}
          onClose={() => setShowDevDiagnostics(false)}
        />
      )}
    </div>
  );
};

export default ZapiPlayer;
