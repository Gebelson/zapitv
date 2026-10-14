import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Tv, Play, Maximize, ChevronLeft, ChevronRight, Volume2, VolumeX, 
  Heart, Calendar, Radio, Sparkles, SlidersHorizontal, ExternalLink, ShieldCheck
} from 'lucide-react';
import { LiveChannel, CurrentEpgState } from '../../core/livetv/types';
import { epgService } from '../../core/livetv/epgService';
import { liveTvPreferences } from '../../core/livetv/liveTvPreferences';
import { LiveTvPlayer } from './LiveTvPlayer';
import { ProgramGuideModal } from './ProgramGuideModal';

interface TelevisionModeProps {
  channels: LiveChannel[];
  activeChannel: LiveChannel;
  onSelectChannel: (channel: LiveChannel) => void;
  onExitTelevisionMode: () => void;
  isDarkMode?: boolean;
}

export const TelevisionMode: React.FC<TelevisionModeProps> = ({
  channels,
  activeChannel,
  onSelectChannel,
  onExitTelevisionMode,
  isDarkMode = true
}) => {
  const [isMuted, setIsMuted] = useState(true); // Previews iniciam mudos por padrão (autoplay policy segura)
  const [isEpgModalOpen, setIsEpgModalOpen] = useState(false);
  const [epg, setEpg] = useState<CurrentEpgState>(() => epgService.getCurrentEpgState(activeChannel));
  const [isFav, setIsFav] = useState(() => liveTvPreferences.isFavorite(activeChannel.id));
  const [isFullPlaybackActive, setIsFullPlaybackActive] = useState(false);

  const previewContainerRef = useRef<HTMLDivElement | null>(null);

  // Índice atual para zapear
  const currentIndex = channels.findIndex(c => c.id === activeChannel.id);
  const safeIndex = currentIndex !== -1 ? currentIndex : 0;

  // Atualiza EPG e status de favorito quando o canal muda
  useEffect(() => {
    setEpg(epgService.getCurrentEpgState(activeChannel));
    setIsFav(liveTvPreferences.isFavorite(activeChannel.id));
    liveTvPreferences.setLastWatched(activeChannel.id);
  }, [activeChannel.id]);

  // Atualiza progresso da barra a cada 20 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      setEpg(epgService.getCurrentEpgState(activeChannel));
    }, 20000);
    return () => clearInterval(timer);
  }, [activeChannel.id]);

  // Zapear para o próximo canal
  const handleNextChannel = useCallback(() => {
    if (channels.length === 0) return;
    const nextIdx = (safeIndex + 1) % channels.length;
    onSelectChannel(channels[nextIdx]);
  }, [channels, safeIndex, onSelectChannel]);

  // Zapear para o canal anterior
  const handlePrevChannel = useCallback(() => {
    if (channels.length === 0) return;
    const prevIdx = (safeIndex - 1 + channels.length) % channels.length;
    onSelectChannel(channels[prevIdx]);
  }, [channels, safeIndex, onSelectChannel]);

  // Alterna favorito
  const handleToggleFav = () => {
    const next = liveTvPreferences.toggleFavorite(activeChannel.id);
    setIsFav(next);
  };

  // Assistir em Tela Cheia ou abrir Provedor Oficial
  const handleWatchFullscreen = () => {
    if (activeChannel.requiresExternalAccess && activeChannel.externalAccessUrl) {
      window.open(activeChannel.externalAccessUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    setIsMuted(false);
    liveTvPreferences.setIsMuted(false);
    setIsFullPlaybackActive(true);
    if (previewContainerRef.current) {
      if (!document.fullscreenElement) {
        previewContainerRef.current.requestFullscreen().catch(() => {});
      }
    }
  };

  // Atalhos de teclado para zapear estilo Smart TV
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se estiver em input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          handleNextChannel();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handlePrevChannel();
          break;
        case 'Enter':
          e.preventDefault();
          handleWatchFullscreen();
          break;
        case 'Escape':
          if (!document.fullscreenElement && isFullPlaybackActive) {
            setIsFullPlaybackActive(false);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextChannel, handlePrevChannel, isFullPlaybackActive, activeChannel]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Barra de Status do Modo Televisão */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-[#007df7]/15 via-white/5 to-transparent p-4 sm:p-5 rounded-3xl border border-[#007df7]/20 backdrop-blur-md">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-[#007df7] text-white flex items-center justify-center shadow-lg shadow-[#007df7]/30 shrink-0">
            <Tv className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-black text-base sm:text-lg">Modo Televisão</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/30">
                Zapping Ativo
              </span>
            </div>
            <p className="text-gray-400 text-xs mt-0.5">
              Use as setas do teclado (ou botões) para zapear entre os canais em tempo real.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsEpgModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/10 cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-[#007df7]" /> Guia do Dia
          </button>
          <button
            onClick={onExitTelevisionMode}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-bold transition-all border border-white/10 cursor-pointer"
          >
            Voltar à Grade
          </button>
        </div>
      </div>

      {/* Main 16:9 Preview Player Area */}
      <div 
        ref={previewContainerRef}
        className="relative aspect-video w-full max-w-6xl mx-auto bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/15"
      >
        {activeChannel.requiresExternalAccess ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-b from-[#0c101a] via-[#080b12] to-black text-center">
            <div className="w-20 h-20 rounded-3xl bg-white/10 p-3 border border-white/20 flex items-center justify-center mb-6 shadow-2xl">
              <img src={activeChannel.logo} alt={activeChannel.name} className="w-full h-full object-contain" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              <span className="text-amber-400 text-xs font-black uppercase tracking-wider">
                Transmissão Linear Oficial Exclusiva
              </span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-white mb-3">
              {activeChannel.name}
            </h3>
            <p className="text-gray-400 text-sm max-w-lg mb-6">
              Este canal é transmitido legalmente com exclusividade via assinatura oficial ({activeChannel.externalProviderName || 'Provedor Oficial'}). O ZapiTV respeita direitos de transmissão e não distribui retransmissões não autorizadas.
            </p>
            {activeChannel.externalAccessUrl && (
              <a
                href={activeChannel.externalAccessUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-black rounded-2xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all shadow-xl shadow-amber-500/20"
              >
                <ExternalLink className="w-4 h-4" /> Acessar no Provedor Oficial ({activeChannel.externalProviderName})
              </a>
            )}
          </div>
        ) : (
          <LiveTvPlayer
            key={activeChannel.id}
            channel={activeChannel}
            autoPlay={true}
            initialMuted={isMuted}
            isInteractive={true}
            onNextChannel={handleNextChannel}
            onPrevChannel={handlePrevChannel}
            channelIndexInfo={{ current: safeIndex + 1, total: channels.length }}
          />
        )}

        {/* Floating Channel & EPG Overlay Bar sobreposto na parte inferior */}
        <div className="absolute bottom-16 inset-x-4 sm:inset-x-8 z-35 pointer-events-none">
          <div className="p-4 sm:p-5 rounded-2xl bg-[#0f121a]/85 backdrop-blur-xl border border-white/15 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 pointer-events-auto">
            {/* Lado Esquerdo: Identificação & Programa Atual */}
            <div className="flex items-start gap-4 max-w-xl">
              <div className="w-12 h-12 rounded-xl bg-white/10 p-2 border border-white/15 flex items-center justify-center shrink-0">
                <img src={activeChannel.logo} alt={activeChannel.name} className="w-full h-full object-contain" />
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-black text-base drop-shadow">
                    {activeChannel.name}
                  </span>
                  {activeChannel.requiresExternalAccess ? (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/90 text-black flex items-center gap-1 shadow-sm">
                      <ShieldCheck className="w-2.5 h-2.5 text-black" /> Acesso Oficial
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-red-600 text-white flex items-center gap-1 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" /> AO VIVO
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-white/10 text-gray-300">
                    {activeChannel.quality || '1080p'}
                  </span>
                </div>

                {/* Programa Atual */}
                <div className="flex items-center gap-2 text-xs text-white font-bold">
                  <Radio className="w-3.5 h-3.5 text-[#007df7] animate-pulse shrink-0" />
                  <span className="truncate">
                    {activeChannel.requiresExternalAccess && activeChannel.externalProviderName
                      ? `Disponível em: ${activeChannel.externalProviderName}`
                      : epg.currentProgram.title}
                  </span>
                  {!activeChannel.requiresExternalAccess && (
                    <span className="text-gray-400 text-[11px] font-normal shrink-0">
                      ({epg.formattedStartTime} - {epg.formattedEndTime})
                    </span>
                  )}
                </div>

                {/* Barra de Progresso Real */}
                {!activeChannel.requiresExternalAccess && (
                  <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden mt-1.5">
                    <div
                      className="h-full bg-[#007df7] transition-all duration-1000 ease-linear shadow-[0_0_8px_rgba(0,125,247,0.8)]"
                      style={{ width: `${epg.progressPercent}%` }}
                    />
                  </div>
                )}

                {/* Próximo Programa */}
                {epg.nextProgram && !activeChannel.requiresExternalAccess && (
                  <div className="text-[11px] text-gray-400 truncate pt-0.5">
                    A seguir: <strong className="text-gray-300 font-semibold">{epg.nextProgram.title}</strong> ({epg.nextProgram.startTime})
                  </div>
                )}
              </div>
            </div>

            {/* Lado Direito: Botão Assistir & Favorito */}
            <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
              <button
                onClick={handleToggleFav}
                className={`p-2.5 rounded-xl border transition-all ${
                  isFav
                    ? 'bg-red-500/20 text-red-400 border-red-500/30'
                    : 'bg-white/10 text-gray-300 hover:text-white border-white/10 hover:bg-white/15'
                }`}
                title={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              >
                <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
              </button>

              {activeChannel.requiresExternalAccess ? (
                <button
                  onClick={handleWatchFullscreen}
                  className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-black rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-amber-500/30 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Acessar Provedor Oficial
                </button>
              ) : (
                <button
                  onClick={handleWatchFullscreen}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#007df7] hover:bg-[#0069d9] active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-[#007df7]/30 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Assistir em Tela Cheia
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Channel Rail (Carrossel Horizontal para Zapear Rapidamente) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-white font-black text-sm uppercase tracking-wider">Guia Rápido de Canais</h4>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrevChannel}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
              title="Canal Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextChannel}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
              title="Próximo Canal"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Rail Horizontal */}
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-2">
          {channels.map((ch) => {
            const isSelected = ch.id === activeChannel.id;
            return (
              <button
                key={ch.id}
                onClick={() => onSelectChannel(ch)}
                className={`flex items-center gap-3 p-2.5 pr-4 rounded-2xl border transition-all text-left shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-[#007df7]/20 border-[#007df7] ring-1 ring-[#007df7] shadow-lg shadow-[#007df7]/20 scale-105'
                    : 'bg-[#0f121a] hover:bg-white/10 border-white/10 hover:border-white/20 opacity-80 hover:opacity-100'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-black/40 p-1 border border-white/10 flex items-center justify-center shrink-0">
                  <img src={ch.logo} alt={ch.name} className="w-full h-full object-contain" />
                </div>
                <div className="min-w-[100px]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-white font-bold text-xs truncate max-w-[130px]">{ch.name}</span>
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#007df7] animate-ping" />
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400 block truncate max-w-[130px]">
                    {ch.categoryLabel}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Modal EPG com Grade Completa do Dia */}
      <ProgramGuideModal
        channel={activeChannel}
        isOpen={isEpgModalOpen}
        onClose={() => setIsEpgModalOpen(false)}
        onWatchChannel={handleWatchFullscreen}
      />
    </div>
  );
};
