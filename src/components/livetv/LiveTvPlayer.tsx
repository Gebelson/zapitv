import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, 
  Settings, AlertCircle, RefreshCw, Radio, ChevronLeft, ChevronRight, X,
  PictureInPicture2
} from 'lucide-react';
import { LiveChannel } from '../../core/livetv/types';
import { channelHealthService } from '../../core/livetv/channelHealthService';
import { liveTvPreferences } from '../../core/livetv/liveTvPreferences';
import { ZapiLoader } from '../common/ZapiLoader';
import { pipService } from '../../core/pip/pipService';

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

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [volume, setVolume] = useState(() => liveTvPreferences.getState().volume);
  const [isMuted, setIsMuted] = useState(initialMuted);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [availableQualities, setAvailableQualities] = useState<string[]>(['Auto']);
  const [selectedQuality, setSelectedQuality] = useState('Auto');
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [isPipActive, setIsPipActive] = useState(false);
  const [isPipSupported, setIsPipSupported] = useState(() => pipService.isPipSupported());
  const controlsTimeoutRef = useRef<any>(null);

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
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  // Monitora evento de tela cheia
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Inicializa a reprodução HLS
  const initPlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video || !channel) return;

    setIsLoading(true);
    setHasError(false);
    setErrorMessage('');

    // Destrói instância prévia para evitar vazamentos de memória e sobreposição de áudio
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const streamUrl = channelHealthService.getPlayableUrl(channel);
    if (!streamUrl) {
      setHasError(true);
      setErrorMessage('Endereço de transmissão não configurado.');
      setIsLoading(false);
      return;
    }

    video.muted = isMuted;
    video.volume = volume;

    if (streamUrl.includes('.m3u8') && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 6,
        manifestLoadingTimeOut: 10000,
        levelLoadingTimeOut: 10000
      });

      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        setIsLoading(false);
        const heights = data.levels.map(l => `${l.height}p`).filter(Boolean);
        const unique = Array.from(new Set(heights));
        setAvailableQualities(['Auto', ...unique]);

        if (autoPlay) {
          video.play().then(() => setIsPlaying(true)).catch(() => {
            // Em navegadores com autoplay restrito, inicia mudo
            video.muted = true;
            setIsMuted(true);
            video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
          });
        }
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
              setHasError(true);
              setErrorMessage('Transmissão ao vivo temporariamente instável ou indisponível.');
              setIsLoading(false);
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Suporte nativo Safari / iOS
      video.src = streamUrl;
      video.onloadedmetadata = () => {
        setIsLoading(false);
        if (autoPlay) {
          video.play().then(() => setIsPlaying(true)).catch(() => {
            video.muted = true;
            setIsMuted(true);
            video.play().catch(() => {});
          });
        }
      };
      video.onerror = () => {
        setHasError(true);
        setErrorMessage('Falha ao reproduzir fluxo nativo HLS.');
        setIsLoading(false);
      };
    } else {
      setHasError(true);
      setErrorMessage('Formato de transmissão não suportado neste navegador.');
      setIsLoading(false);
    }
  }, [channel, isMuted, volume, autoPlay]);

  // Reinicia player quando o canal selecionado mudar
  useEffect(() => {
    initPlayback();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
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
        onPlaying={() => {
          setIsLoading(false);
          setIsPlaying(true);
        }}
        onWaiting={() => setIsLoading(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Loading Buffering Spinner */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/50 backdrop-blur-[2px] pointer-events-none animate-in fade-in duration-200">
          <ZapiLoader size="lg" />
          <span className="text-white/80 text-xs font-bold tracking-widest uppercase mt-4 flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-orange-500 animate-pulse" /> Sintonizando {channel.name}...
          </span>
        </div>
      )}

      {/* Tela de Erro / Indisponibilidade */}
      {hasError && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md p-6 text-center select-none">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4 text-red-500">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h4 className="text-white text-lg font-black mb-1">Canal Temporariamente Fora do Ar</h4>
          <p className="text-gray-400 text-xs max-w-sm mb-5 leading-relaxed">{errorMessage}</p>
          <div className="flex items-center gap-3">
            <button
              onClick={initPlayback}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#007df7] hover:bg-[#0069d9] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-[#007df7]/30"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Tentar Reconectar
            </button>
            {onNextChannel && (
              <button
                onClick={onNextChannel}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
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

        {/* Lado Direito: Qualidade, Expandir / Tela Cheia */}
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
