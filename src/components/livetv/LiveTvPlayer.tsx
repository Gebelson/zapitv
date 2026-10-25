import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls, { type HlsConfig } from 'hls.js';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, 
  Settings, AlertCircle, RefreshCw, Radio, ChevronLeft, ChevronRight, X,
  PictureInPicture2, ShieldCheck
} from 'lucide-react';
import { LiveChannel, LiveStreamSource } from '../../core/livetv/types';
import { channelHealthService } from '../../core/livetv/channelHealthService';
import { channelSourceResolver } from '../../core/livetv/ChannelSourceResolver';
import { liveTvPreferences } from '../../core/livetv/liveTvPreferences';
import { tvModeService } from '../../core/tv/tvModeService';
import { ZapiLoader } from '../common/ZapiLoader';
import { pipService } from '../../core/pip/pipService';

export type LiveTvPlaybackStatus = 'loading' | 'recovering' | 'playing' | 'waiting_interaction' | 'unavailable';

interface LiveTvPlayerProps {
  channel: LiveChannel;
  autoPlay?: boolean;
  initialMuted?: boolean;
  isInteractive?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onNextChannel?: () => void;
  onPrevChannel?: () => void;
  onClose?: () => void;
  channelIndexInfo?: { current: number; total: number };
}

const maskStreamUrl = (u: string): string => {
  try {
    const parsed = new URL(u);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return u.split('?')[0];
  }
};

const logLiveTvDiag = (event: string, details?: Record<string, any>) => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV) {
    console.log(`[ZapiTV LiveTV] ${event}`, details || {});
  }
};

export const LiveTvPlayer: React.FC<LiveTvPlayerProps> = ({
  channel,
  autoPlay = true,
  initialMuted = false,
  isInteractive = true,
  isExpanded = false,
  onToggleExpand,
  onNextChannel,
  onPrevChannel,
  onClose,
  channelIndexInfo
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const activeChannelIdRef = useRef<string>(channel.id);
  const playbackGenerationRef = useRef<number>(0);
  const startupWatchdogTimeoutRef = useRef<any>(null);
  const attemptedUrlsThisSessionRef = useRef<Set<string>>(new Set());

  const [playbackStatus, setPlaybackStatus] = useState<LiveTvPlaybackStatus>('loading');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeSourceUrl, setActiveSourceUrl] = useState('');
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);

  const [volume, setVolume] = useState(() => liveTvPreferences.getState().volume);
  const [isMuted, setIsMuted] = useState(initialMuted);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [availableQualities, setAvailableQualities] = useState<string[]>(['Auto']);
  const [selectedQuality, setSelectedQuality] = useState('Auto');
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [isPipActive, setIsPipActive] = useState(false);
  const [isPipSupported, setIsPipSupported] = useState(() => pipService.isPipSupported());

  // Watchdog e métricas
  const controlsTimeoutRef = useRef<any>(null);
  const watchdogIntervalRef = useRef<any>(null);
  const lastCurrentTimeRef = useRef<number>(0);
  const stalledDurationRef = useRef<number>(0);
  const networkRetryCountRef = useRef<number>(0);
  const mediaRecoveryCountRef = useRef<number>(0);
  const playStartTimeRef = useRef<number>(0);

  const isTv = tvModeService.isTvMode() || (typeof window !== 'undefined' && window.location.pathname.startsWith('/tv'));
  const STARTUP_TIMEOUT_MS = isTv ? 10000 : 7000;
  const MAX_STALL_TIMEOUT_S = isTv ? 16 : 12;

  // Mantém referência do canal ativo para evitar conflitos assíncronos
  useEffect(() => {
    activeChannelIdRef.current = channel.id;
  }, [channel.id]);

  // Monitora eventos Picture-in-Picture
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onEnter = () => setIsPipActive(true);
    const onLeave = () => setIsPipActive(false);

    video.addEventListener('enterpictureinpicture', onEnter);
    video.addEventListener('leavepictureinpicture', onLeave);

    return () => {
      video.removeEventListener('enterpictureinpicture', onEnter);
      video.removeEventListener('leavepictureinpicture', onLeave);
    };
  }, []);

  const handleTogglePip = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      await pipService.togglePictureInPicture(video);
    } catch (err: any) {
      console.warn('Erro ao alternar Picture-in-Picture no Live TV:', err);
    }
  }, []);

  // Manipulação de atividade do cursor para ocultar controles
  const handleUserActivity = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
        setShowQualityMenu(false);
      }
    }, 3500);
  }, [isPlaying]);

  // Alterna Tela Cheia
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // Monitora mudanças de tela cheia
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Limpa completamente instâncias do player
  const cleanupPlayer = useCallback(() => {
    // Incrementa geração de reprodução para invalidar callbacks assíncronos anteriores
    playbackGenerationRef.current += 1;

    if (startupWatchdogTimeoutRef.current) {
      clearTimeout(startupWatchdogTimeoutRef.current);
      startupWatchdogTimeoutRef.current = null;
    }
    if (watchdogIntervalRef.current) {
      clearInterval(watchdogIntervalRef.current);
      watchdogIntervalRef.current = null;
    }
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }
    if (hlsRef.current) {
      try {
        hlsRef.current.stopLoad();
        hlsRef.current.detachMedia();
        hlsRef.current.destroy();
      } catch (err) {
        // Silencioso em cleanup
      }
      hlsRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      } catch (err) {
        // Silencioso em cleanup
      }
    }
    stalledDurationRef.current = 0;
    lastCurrentTimeRef.current = 0;
    networkRetryCountRef.current = 0;
    mediaRecoveryCountRef.current = 0;
  }, []);

  // Tenta próxima fonte de backup quando a atual falha (Determinístico e Anti-Loop)
  const tryNextFallbackSource = useCallback((failedUrl: string, reason: string, isPermanent = false) => {
    // Se o canal já mudou durante a tentativa, cancela
    if (activeChannelIdRef.current !== channel.id) return;

    logLiveTvDiag('Falha de fonte detectada', {
      channelId: channel.id,
      failedUrl: maskStreamUrl(failedUrl),
      reason,
      isPermanent
    });

    if (failedUrl) {
      attemptedUrlsThisSessionRef.current.add(failedUrl);
    }

    const nextSource = channelHealthService.handlePlaybackFailure(
      channel,
      failedUrl,
      reason,
      reason.toLowerCase().includes('conexão') || reason.toLowerCase().includes('rede'),
      isPermanent
    );

    // Anti-loop: Só alterna se houver próxima fonte, se ela for diferente da atual e ainda não tiver sido tentada nesta sessão
    if (nextSource && nextSource.url && nextSource.url !== failedUrl && !attemptedUrlsThisSessionRef.current.has(nextSource.url)) {
      setPlaybackStatus('recovering');
      setFallbackNotice(`Alternando para fonte alternativa (${nextSource.quality || 'Backup'})...`);
      setIsUsingFallback(true);
      setTimeout(() => setFallbackNotice(null), 4000);
      playStreamUrl(nextSource.url);
    } else {
      logLiveTvDiag('Todas as fontes esgotadas para o canal', {
        channelId: channel.id,
        tentativas: attemptedUrlsThisSessionRef.current.size
      });
      setPlaybackStatus('unavailable');
      setHasError(true);
      setErrorMessage(reason || 'Esta transmissão está temporariamente indisponível.');
      setIsLoading(false);
      setIsPlaying(false);
    }
  }, [channel]);

  // Função interna para iniciar a reprodução de uma URL específica
  const playStreamUrl = useCallback((rawTargetUrl: string) => {
    const video = videoRef.current;
    if (!video || !channel) return;

    // Limpa player anterior e captura token de geração unívoco
    cleanupPlayer();
    const currentGeneration = playbackGenerationRef.current;

    setPlaybackStatus('loading');
    setIsLoading(true);
    setHasError(false);
    setErrorMessage('');
    playStartTimeRef.current = Date.now();
    networkRetryCountRef.current = 0;
    mediaRecoveryCountRef.current = 0;

    const streamUrl = channelHealthService.getPlayableUrl(rawTargetUrl);
    setActiveSourceUrl(rawTargetUrl);
    attemptedUrlsThisSessionRef.current.add(rawTargetUrl);

    if (!streamUrl) {
      setPlaybackStatus('unavailable');
      setHasError(true);
      setErrorMessage('Endereço de transmissão não configurado.');
      setIsLoading(false);
      return;
    }

    logLiveTvDiag('Iniciando carregamento de stream', {
      channelId: channel.id,
      url: maskStreamUrl(rawTargetUrl),
      isTv,
      generation: currentGeneration
    });

    // Startup Watchdog Independente:
    // Impede spinner infinito se o manifesto não carregar ou se os segmentos não iniciarem,
    // mas respeita bloqueios de autoplay e pausas voluntárias do usuário.
    startupWatchdogTimeoutRef.current = setTimeout(() => {
      if (playbackGenerationRef.current !== currentGeneration || activeChannelIdRef.current !== channel.id) return;

      const v = videoRef.current;
      if (!v) return;

      // Se o player está aguardando interação do usuário pelo navegador, não mata a fonte
      if (v.paused && !autoPlay) return;

      const hasStarted = !v.paused && v.currentTime > 0.05 && v.readyState >= 2;
      if (!hasStarted) {
        logLiveTvDiag('Startup Watchdog Timeout atingido', {
          channelId: channel.id,
          url: maskStreamUrl(rawTargetUrl),
          timeoutMs: STARTUP_TIMEOUT_MS
        });
        cleanupPlayer();
        tryNextFallbackSource(rawTargetUrl, 'O sinal demorou muito para responder no carregamento inicial.');
      }
    }, STARTUP_TIMEOUT_MS);

    // Preserva volume e mudo atuais do usuário
    const currentPrefs = liveTvPreferences.getState();
    video.muted = isMuted;
    video.volume = currentPrefs.volume;

    if (streamUrl.includes('.m3u8') && Hls.isSupported()) {
      // Perfil de reprodução ESTÁVEL e ÁGIL (TTFF 2-3s) com parâmetros otimizados
      const hlsConfig: Partial<HlsConfig> = isTv
        ? {
            enableWorker: false, // Menor consumo de memória e overhead em navegadores de TV
            lowLatencyMode: false,
            backBufferLength: 10,
            maxBufferLength: 15,
            maxMaxBufferLength: 30,
            liveSyncDurationCount: 3,
            liveMaxLatencyDurationCount: 6,
            manifestLoadingTimeOut: 6000,
            manifestLoadingMaxRetry: 2,
            levelLoadingTimeOut: 6000,
            levelLoadingMaxRetry: 2,
            fragLoadingTimeOut: 8000,
            fragLoadingMaxRetry: 2,
            abrEwmaDefaultEstimate: 1500000,
            startLevel: -1
          }
        : {
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 15,
            maxBufferLength: 25,
            maxMaxBufferLength: 50,
            liveSyncDurationCount: 3,
            liveMaxLatencyDurationCount: 6,
            manifestLoadingTimeOut: 6000,
            manifestLoadingMaxRetry: 2,
            levelLoadingTimeOut: 6000,
            levelLoadingMaxRetry: 2,
            fragLoadingTimeOut: 8000,
            fragLoadingMaxRetry: 2,
            abrEwmaDefaultEstimate: 2000000,
            startLevel: -1
          };

      const hls = new Hls(hlsConfig);
      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        if (playbackGenerationRef.current !== currentGeneration || activeChannelIdRef.current !== channel.id) return;
        // Não marcar isLoading(false) aqui — aguardar sinal real de vídeo/áudio reproduzível
        const heights = data.levels.map(l => `${l.height}p`).filter(Boolean);
        const unique = Array.from(new Set(heights));
        setAvailableQualities(['Auto', ...unique]);

        if (autoPlay) {
          video.play().then(() => {
            if (playbackGenerationRef.current !== currentGeneration) return;
            // O evento onPlaying fará a confirmação definitiva
          }).catch(() => {
            if (playbackGenerationRef.current !== currentGeneration) return;
            // Em navegadores com autoplay restrito, tenta com mudo
            video.muted = true;
            setIsMuted(true);
            video.play().then(() => {
              if (playbackGenerationRef.current !== currentGeneration) return;
            }).catch(() => {
              if (playbackGenerationRef.current !== currentGeneration) return;
              // Autoplay bloqueado pelo navegador exigindo interação do usuário
              // NÃO marcar como falha nem deixar o watchdog matar a fonte
              setIsLoading(false);
              setIsPlaying(false);
              setPlaybackStatus('waiting_interaction');
            });
          });
        } else {
          setIsLoading(false);
          setIsPlaying(false);
          setPlaybackStatus('waiting_interaction');
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (playbackGenerationRef.current !== currentGeneration || activeChannelIdRef.current !== channel.id) return;

        // Análise de códigos HTTP em respostas de rede
        const responseCode = data.response?.code;
        if (responseCode === 401 || responseCode === 403) {
          cleanupPlayer();
          tryNextFallbackSource(rawTargetUrl, 'Canal restrito ou requer autorização do provedor oficial.', true);
          return;
        }
        if (responseCode === 404 || responseCode === 410) {
          cleanupPlayer();
          tryNextFallbackSource(rawTargetUrl, 'Transmissão não encontrada no provedor (404).', true);
          return;
        }

        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              // Tenta recarregar até 2 vezes com backoff; se persistir, aciona fallback
              if (networkRetryCountRef.current < 2) {
                networkRetryCountRef.current++;
                setPlaybackStatus('recovering');
                logLiveTvDiag('Tentativa de reconexão de rede HLS', { tentativa: networkRetryCountRef.current });
                hls.startLoad();
              } else {
                cleanupPlayer();
                tryNextFallbackSource(rawTargetUrl, 'Instabilidade contínua de conexão com o servidor de transmissão.');
              }
              break;

            case Hls.ErrorTypes.MEDIA_ERROR:
              // Recuperação controlada de erro de mídia (máximo 1 tentativa)
              if (mediaRecoveryCountRef.current < 1) {
                mediaRecoveryCountRef.current++;
                setPlaybackStatus('recovering');
                logLiveTvDiag('Recuperação de erro de decodificação de mídia HLS');
                hls.recoverMediaError();
              } else {
                cleanupPlayer();
                tryNextFallbackSource(rawTargetUrl, 'Falha irrecuperável na decodificação do fluxo de mídia.');
              }
              break;

            default:
              cleanupPlayer();
              tryNextFallbackSource(rawTargetUrl, 'Falha fatal na inicialização do fluxo de vídeo.');
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Suporte nativo Safari / iOS / Tizen nativo
      video.src = streamUrl;
      video.onloadedmetadata = () => {
        if (playbackGenerationRef.current !== currentGeneration || activeChannelIdRef.current !== channel.id) return;
        // Não marcar isLoading(false) imediatamente — aguardar frames reais
        if (autoPlay) {
          video.play().then(() => {
            if (playbackGenerationRef.current !== currentGeneration) return;
          }).catch(() => {
            if (playbackGenerationRef.current !== currentGeneration) return;
            video.muted = true;
            setIsMuted(true);
            video.play().catch(() => {
              if (playbackGenerationRef.current !== currentGeneration) return;
              setIsLoading(false);
              setIsPlaying(false);
              setPlaybackStatus('waiting_interaction');
            });
          });
        } else {
          setIsLoading(false);
          setIsPlaying(false);
          setPlaybackStatus('waiting_interaction');
        }
      };
      video.onerror = () => {
        if (playbackGenerationRef.current !== currentGeneration || activeChannelIdRef.current !== channel.id) return;
        cleanupPlayer();
        tryNextFallbackSource(rawTargetUrl, 'Falha no decodificador nativo de vídeo.');
      };
    } else {
      cleanupPlayer();
      setPlaybackStatus('unavailable');
      setHasError(true);
      setErrorMessage('Formato de transmissão não suportado neste navegador.');
      setIsLoading(false);
      return;
    }

    // Inicializa Watchdog de Reprodução Contínua e Prevenção de Buffering Infinito
    watchdogIntervalRef.current = setInterval(() => {
      if (playbackGenerationRef.current !== currentGeneration || activeChannelIdRef.current !== channel.id) return;
      const v = videoRef.current;
      if (!v) return;

      // Se o vídeo deveria estar tocando (não pausado pelo usuário e sem erro)
      if (!v.paused && !v.ended) {
        const curTime = v.currentTime;
        const diff = Math.abs(curTime - lastCurrentTimeRef.current);

        if (diff < 0.1) {
          // O tempo não está avançando: STALL / BUFFERING
          stalledDurationRef.current += 1;

          // 1. Buffering breve (3 segundos): ativa spinner sem travar
          if (stalledDurationRef.current === 3) {
            setPlaybackStatus('recovering');
            setIsLoading(true);
            channelHealthService.recordStall(channel, rawTargetUrl);
          }

          // 2. Buffering prolongado (6 segundos): Recuperação Nível 1
          if (stalledDurationRef.current === 6) {
            // Tenta avançar para a ponta do buffer se houver dados
            if (v.buffered && v.buffered.length > 0) {
              const bufEnd = v.buffered.end(v.buffered.length - 1);
              if (bufEnd > curTime + 1) {
                v.currentTime = bufEnd - 1.5;
              }
            }
            if (hlsRef.current && networkRetryCountRef.current < 2) {
              hlsRef.current.startLoad();
              if (hlsRef.current.autoLevelEnabled && hlsRef.current.currentLevel > 0) {
                hlsRef.current.nextLevel = hlsRef.current.currentLevel - 1;
              }
            }
          }

          // 3. Estagnação severa (10 segundos): Recuperação Nível 2
          if (stalledDurationRef.current === 10) {
            if (hlsRef.current && mediaRecoveryCountRef.current < 1) {
              mediaRecoveryCountRef.current++;
              hlsRef.current.recoverMediaError();
            }
          }

          // 4. Timeout final: Falha confirmada da fonte
          if (stalledDurationRef.current >= MAX_STALL_TIMEOUT_S) {
            cleanupPlayer();
            tryNextFallbackSource(rawTargetUrl, 'A transmissão parou de responder durante a reprodução.');
          }
        } else {
          // O vídeo está avançando normalmente
          if (stalledDurationRef.current > 0) {
            stalledDurationRef.current = 0;
            setIsLoading(false);
            setPlaybackStatus('playing');
          }
          lastCurrentTimeRef.current = curTime;
          // Registra duração contínua de reprodução bem-sucedida
          channelHealthService.recordPlayDuration(rawTargetUrl, 1);
        }
      }
    }, 1000);

  }, [channel, isMuted, autoPlay, cleanupPlayer, tryNextFallbackSource, isTv, STARTUP_TIMEOUT_MS, MAX_STALL_TIMEOUT_S]);

  // Inicializa a reprodução utilizando a melhor fonte selecionada pelo ChannelSourceResolver
  const initPlayback = useCallback(() => {
    if (!channel) return;

    if (channel.requiresExternalAccess) {
      cleanupPlayer();
      setIsLoading(false);
      setHasError(false);
      setPlaybackStatus('playing');
      return;
    }

    const resolved = channelSourceResolver.resolveBestSource(channel);
    setIsUsingFallback(resolved.isFallback);

    if (resolved.allSourcesFailed || !resolved.hasEligibleSource || !resolved.primaryUrl) {
      setPlaybackStatus('unavailable');
      setHasError(true);
      setErrorMessage('Todas as fontes deste canal estão temporariamente indisponíveis.');
      setIsLoading(false);
      setIsPlaying(false);
      return;
    }

    playStreamUrl(resolved.primaryUrl);
  }, [channel, playStreamUrl, cleanupPlayer]);

  // Reinicia player quando o canal selecionado mudar
  useEffect(() => {
    activeChannelIdRef.current = channel.id;
    attemptedUrlsThisSessionRef.current.clear();
    initPlayback();
    return () => {
      cleanupPlayer();
    };
  }, [channel.id]);

  // Atualiza volume e mudo
  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    liveTvPreferences.setVolume(newVol);
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      if (newVol > 0 && isMuted) {
        videoRef.current.muted = false;
        setIsMuted(false);
        liveTvPreferences.setIsMuted(false);
      }
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    liveTvPreferences.setIsMuted(nextMuted);
    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const changeQuality = (q: string) => {
    setSelectedQuality(q);
    setShowQualityMenu(false);
    const hls = hlsRef.current;
    if (!hls) return;

    if (q === 'Auto') {
      hls.currentLevel = -1; // Auto ABR
    } else {
      const targetHeight = parseInt(q.replace('p', ''), 10);
      const levelIndex = hls.levels.findIndex(l => l.height === targetHeight);
      if (levelIndex !== -1) {
        hls.currentLevel = levelIndex;
      }
    }
  };

  // Se o canal não possui fonte incorporável autorizada (ex: canais estritamente pagos ou protegidos por DRM proprietário)
  if (channel.requiresExternalAccess) {
    return (
      <div
        ref={containerRef}
        className={`relative w-full h-full bg-[#0a0d14] flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden font-sans ${
          isFullscreen ? 'fixed inset-0 z-[5000]' : 'rounded-2xl border border-white/10'
        }`}
      >
        <div className="w-20 h-20 rounded-2xl bg-white/10 p-3 mb-5 border border-white/15 backdrop-blur-md shadow-2xl flex items-center justify-center">
          <img src={channel.logo} alt={channel.name} className="w-full h-full object-contain" />
        </div>

        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400">
            Grade Oficial
          </span>
        </div>

        <h3 className="text-white text-xl md:text-2xl font-black mb-2">{channel.name}</h3>
        <p className="text-gray-400 text-xs md:text-sm max-w-md mb-6 leading-relaxed">
          {channel.description || 'Este canal transmite sua grade linear sob direitos de transmissão na plataforma autorizada oficial.'}
        </p>

        <div className="px-6 py-4 rounded-2xl bg-white/5 border border-white/10 max-w-md text-center shadow-lg backdrop-blur-sm">
          <p className="text-white text-sm md:text-base font-bold mb-1.5">Transmissão indisponível no momento</p>
          <p className="text-gray-400 text-xs leading-relaxed">
            Este canal transmite sua grade linear exclusivamente em sua plataforma oficial credenciada ({channel.externalProviderName || 'Provedor Oficial'}).
          </p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all border border-white/10"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleUserActivity}
      onClick={handleUserActivity}
      className={`relative w-full h-full bg-black flex items-center justify-center select-none overflow-hidden font-sans group ${
        isFullscreen ? 'fixed inset-0 z-[5000]' : 'rounded-2xl'
      }`}
    >
      {/* Vídeo HTML5 HLS */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain bg-black cursor-pointer"
        playsInline
        onClick={togglePlay}
        onLoadedData={() => {
          if (activeChannelIdRef.current !== channel.id) return;
          if (videoRef.current && (videoRef.current.videoWidth > 0 || videoRef.current.readyState >= 2)) {
            setIsLoading(false);
          }
        }}
        onPlaying={() => {
          // Cancela startup watchdog imediatamente com o início real do playback
          if (startupWatchdogTimeoutRef.current) {
            clearTimeout(startupWatchdogTimeoutRef.current);
            startupWatchdogTimeoutRef.current = null;
          }
          setIsLoading(false);
          setIsPlaying(true);
          setHasError(false);
          setPlaybackStatus('playing');
          stalledDurationRef.current = 0;
          if (activeSourceUrl) {
            const timeToFirstFrame = Date.now() - playStartTimeRef.current;
            logLiveTvDiag('Primeiro frame renderizado', {
              channelId: channel.id,
              timeToFirstFrameMs: timeToFirstFrame,
              url: maskStreamUrl(activeSourceUrl)
            });
            channelHealthService.confirmPlayback(channel, activeSourceUrl, timeToFirstFrame);
          }
        }}
        onWaiting={() => {
          setIsLoading(true);
        }}
        onPause={() => setIsPlaying(false)}
      />

      {/* Notificação temporária de fallback de fonte */}
      {fallbackNotice && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-amber-500/90 text-black text-xs font-bold rounded-full shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2">
          {fallbackNotice}
        </div>
      )}

      {/* Tela de Aguardando Interação do Usuário (Autoplay Bloqueado) */}
      {playbackStatus === 'waiting_interaction' && !hasError && (
        <div 
          onClick={togglePlay}
          className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm cursor-pointer animate-in fade-in"
        >
          <div className="w-16 h-16 rounded-full bg-[#007df7] flex items-center justify-center text-white shadow-xl shadow-[#007df7]/40 hover:scale-110 active:scale-95 transition-all">
            <Play className="w-8 h-8 fill-current ml-1" />
          </div>
          <span className="text-white text-sm font-bold mt-4">Clique para reproduzir transmissão ao vivo</span>
          <span className="text-slate-400 text-xs mt-1">Interação necessária pelo navegador</span>
        </div>
      )}

      {/* Loading Buffering Spinner */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/50 backdrop-blur-[2px] pointer-events-none animate-in fade-in duration-200">
          <ZapiLoader size="lg" />
          <span className="text-white/80 text-xs font-bold tracking-widest uppercase mt-4 flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
            {playbackStatus === 'recovering' ? `Recuperando sinal de ${channel.name}...` : `Sintonizando ${channel.name}...`}
          </span>
        </div>
      )}

      {/* Tela de Erro / Indisponibilidade com Recuperação */}
      {hasError && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md p-6 text-center select-none">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4 text-red-500">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h4 className="text-white text-lg font-black mb-1">Transmissão Indisponível no Momento</h4>
          <p className="text-gray-400 text-xs max-w-sm mb-5 leading-relaxed">{errorMessage}</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                attemptedUrlsThisSessionRef.current.clear();
                channelSourceResolver.clearFailedSources(channel.id);
                initPlayback();
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#007df7] hover:bg-[#0069d9] active:scale-95 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-[#007df7]/30"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Tentar Reconectar
            </button>
            {onNextChannel && (
              <button
                onClick={onNextChannel}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
              >
                Próximo Canal <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top Header Bar (Canal & Fechar se fullscreen/modal) */}
      <div
        className={`absolute top-0 inset-x-0 p-4 md:p-6 bg-gradient-to-b from-black/90 via-black/40 to-transparent z-40 flex items-center justify-between transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/10 p-1.5 backdrop-blur-md border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
            <img src={channel.logo} alt={channel.name} className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-white font-black text-sm md:text-base leading-tight drop-shadow">{channel.name}</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-600/90 text-white flex items-center gap-1 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" /> AO VIVO
              </span>
              {isUsingFallback && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/80 text-black">
                  Backup
                </span>
              )}
            </div>
            <span className="text-gray-400 text-xs font-medium">{channel.categoryLabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {channelIndexInfo && (
            <span className="text-white/60 text-xs font-bold px-3 py-1 bg-white/10 rounded-full border border-white/10 backdrop-blur-md hidden sm:inline-block">
              Canal {channelIndexInfo.current} de {channelIndexInfo.total}
            </span>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all border border-white/10"
              title="Fechar Player"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Setas de Zapear nas laterais (hover ou touch) */}
      {isInteractive && (
        <>
          {onPrevChannel && (
            <button
              onClick={(e) => { e.stopPropagation(); onPrevChannel(); }}
              className={`absolute left-3 top-1/2 -translate-y-1/2 z-40 w-11 h-11 rounded-full bg-black/60 hover:bg-[#007df7] text-white flex items-center justify-center border border-white/15 backdrop-blur-md transition-all hover:scale-110 shadow-xl ${
                showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              title="Canal Anterior (Seta Esquerda)"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          {onNextChannel && (
            <button
              onClick={(e) => { e.stopPropagation(); onNextChannel(); }}
              className={`absolute right-3 top-1/2 -translate-y-1/2 z-40 w-11 h-11 rounded-full bg-black/60 hover:bg-[#007df7] text-white flex items-center justify-center border border-white/15 backdrop-blur-md transition-all hover:scale-110 shadow-xl ${
                showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              title="Próximo Canal (Seta Direita)"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
        </>
      )}

      {/* Barra Inferior de Controles */}
      <div
        className={`absolute bottom-0 inset-x-0 p-4 md:p-6 bg-gradient-to-t from-black/95 via-black/60 to-transparent z-40 transition-opacity duration-300 flex items-center justify-between ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Lado Esquerdo: Play/Pause, Volume */}
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-[#007df7] text-white flex items-center justify-center transition-all hover:scale-105"
            title={isPlaying ? 'Pausar' : 'Reproduzir'}
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>

          <div className="flex items-center gap-2 group/vol">
            <button
              onClick={toggleMute}
              className="text-gray-300 hover:text-white transition-colors p-1.5"
              title={isMuted ? 'Ativar som' : 'Silenciar'}
            >
              {isMuted || volume === 0 ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="w-16 sm:w-24 accent-[#007df7] cursor-pointer"
            />
          </div>
        </div>

        {/* Lado Direito: Qualidade, PiP, Tela Cheia */}
        <div className="flex items-center gap-2">
          {/* Seletor de Qualidade */}
          <div className="relative">
            <button
              onClick={() => setShowQualityMenu(!showQualityMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/10"
              title="Qualidade de Vídeo"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>{selectedQuality}</span>
            </button>

            {showQualityMenu && (
              <div className="absolute bottom-full right-0 mb-2 w-32 bg-[#0f121a]/95 border border-white/15 rounded-xl p-2 shadow-2xl backdrop-blur-xl animate-in fade-in z-50">
                <span className="text-[10px] uppercase font-bold text-gray-400 px-2 py-1 block">Qualidade</span>
                {availableQualities.map((q) => (
                  <button
                    key={q}
                    onClick={() => changeQuality(q)}
                    className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      selectedQuality === q ? 'bg-[#007df7] text-white' : 'text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Botão Picture-in-Picture */}
          {isPipSupported && (
            <button
              onClick={handleTogglePip}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                isPipActive
                  ? 'bg-[#007df7] text-white shadow-lg shadow-[#007df7]/40 ring-1 ring-[#007df7]'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
              title={isPipActive ? 'Sair da Imagem em Imagem' : 'Imagem em Imagem'}
              aria-label="Imagem em imagem"
            >
              <PictureInPicture2 className="w-5 h-5" />
            </button>
          )}

          {/* Botão de Tela Cheia */}
          <button
            onClick={toggleFullscreen}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
            title={isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
