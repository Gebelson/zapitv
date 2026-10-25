import React, { useState, useEffect } from 'react';
import { Heart, Play, Radio, ShieldCheck } from 'lucide-react';
import { LiveChannel, CurrentEpgState } from '../../core/livetv/types';
import { epgService } from '../../core/livetv/epgService';
import { liveTvPreferences } from '../../core/livetv/liveTvPreferences';

interface ChannelCardProps {
  channel: LiveChannel;
  isSelected?: boolean;
  isDarkMode?: boolean;
  onSelect: (channel: LiveChannel) => void;
  onWatchNow?: (channel: LiveChannel) => void;
}

export const ChannelCard: React.FC<ChannelCardProps> = ({
  channel,
  isSelected = false,
  isDarkMode = true,
  onSelect,
  onWatchNow
}) => {
  const [isFav, setIsFav] = useState(() => liveTvPreferences.isFavorite(channel.id));
  const [epg, setEpg] = useState<CurrentEpgState>(() => epgService.getCurrentEpgState(channel));

  // Atualiza periodicamente o progresso do EPG a cada 30 segundos
  useEffect(() => {
    setEpg(epgService.getCurrentEpgState(channel));
    const timer = setInterval(() => {
      setEpg(epgService.getCurrentEpgState(channel));
    }, 30000);
    return () => clearInterval(timer);
  }, [channel.id]);

  const handleToggleFav = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = liveTvPreferences.toggleFavorite(channel.id);
    setIsFav(next);
  };

  const handleCardClick = () => {
    onSelect(channel);
  };

  const handleWatchClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onWatchNow) {
      onWatchNow(channel);
    } else {
      onSelect(channel);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={`group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:z-20 border select-none ${
        isSelected
          ? 'ring-2 ring-[#007df7] border-[#007df7] shadow-xl shadow-[#007df7]/20 scale-[1.02]'
          : isDarkMode
            ? 'bg-[#0f121a] border-white/10 hover:border-white/20'
            : 'bg-white border-gray-200 shadow-md hover:border-gray-300'
      }`}
    >
      {/* Top Media Area (16:9) */}
      <div className="relative aspect-video w-full bg-gradient-to-br from-[#151a24] to-[#0a0d14] flex items-center justify-center p-4 overflow-hidden">
        {/* Logo do Canal */}
        <img
          src={channel.logo}
          alt={channel.name}
          className="max-h-16 max-w-[70%] object-contain drop-shadow-md transition-transform duration-500 group-hover:scale-110"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (channel.fallbackLogo && target.src !== channel.fallbackLogo) {
              target.src = channel.fallbackLogo;
            } else {
              target.style.display = 'none';
            }
          }}
        />

        {/* Badge de Status Canônico no canto superior esquerdo */}
        <div className="absolute top-2.5 left-2.5 z-10">
          {channel.requiresExternalAccess || channel.status === 'EXTERNAL_ACCESS' ? (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-zinc-700/90 text-gray-300 flex items-center gap-1 shadow-md border border-white/10">
              <ShieldCheck className="w-3 h-3 text-gray-300" /> Grade Oficial
            </span>
          ) : channel.status === 'AVAILABLE' || channel.status === 'VERIFIED' ? (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-red-600/90 text-white flex items-center gap-1 shadow-md">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" /> AO VIVO
            </span>
          ) : channel.status === 'UNSTABLE' ? (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/90 text-black flex items-center gap-1 shadow-md">
              <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" /> Instável
            </span>
          ) : channel.status === 'UNAVAILABLE' ? (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-zinc-700/90 text-gray-300 flex items-center gap-1 shadow-md border border-white/10">
              Indisponível
            </span>
          ) : channel.status === 'RESTRICTED' ? (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-purple-600/90 text-white flex items-center gap-1 shadow-md">
              Restrito
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-600/90 text-white flex items-center gap-1 shadow-md">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Sintonizando
            </span>
          )}
        </div>

        {/* Categoria / Qualidade no canto superior direito */}
        <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-black/60 backdrop-blur-md text-white/90 border border-white/10">
            {channel.quality || 'HD'}
          </span>
          <button
            type="button"
            onClick={handleToggleFav}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
              isFav
                ? 'bg-red-500 text-white shadow-md'
                : 'bg-black/50 text-white/60 hover:text-white hover:bg-black/80'
            }`}
            title={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          >
            <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Hover Overlay com botão rápido de assistir */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
          <button
            onClick={handleWatchClick}
            className="px-4 py-2 bg-[#007df7] hover:bg-[#0069d9] active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-lg shadow-[#007df7]/30"
          >
            <Play className="w-3.5 h-3.5 fill-current" /> Assistir
          </button>
        </div>
      </div>

      {/* Barra de Progresso do Programa Atual */}
      <div className="w-full h-1 bg-white/10 overflow-hidden">
        {epg.hasVerifiedSchedule && (
          <div
            className="h-full bg-[#007df7] transition-all duration-1000 ease-linear shadow-[0_0_6px_rgba(0,125,247,0.8)]"
            style={{ width: `${epg.progressPercent}%` }}
          />
        )}
      </div>

      {/* Detalhes do Canal & Programação EPG */}
      <div className="p-3.5">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h4 className="text-white font-black text-sm truncate flex items-center gap-1.5">
            {channel.number && (
              <span className="text-[#007df7] text-xs font-mono font-bold">#{channel.number}</span>
            )}
            <span>{channel.name}</span>
          </h4>
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider shrink-0">
            {channel.categoryLabel}
          </span>
        </div>

        {/* Programa Atual ou Provedor Oficial */}
        <div className="flex items-start gap-1.5 text-xs text-gray-300 font-semibold mb-1">
          <Radio className="w-3 h-3 text-[#007df7] shrink-0 mt-0.5 animate-pulse" />
          <span className="line-clamp-1">
            {channel.requiresExternalAccess && channel.externalProviderName
              ? `Disponível em: ${channel.externalProviderName}`
              : epg.hasVerifiedSchedule
                ? epg.currentProgram.title
                : 'Programação não disponível'}
          </span>
        </div>

        {/* Horário & Próximo Programa */}
        <div className="flex items-center justify-between text-[10px] text-gray-400 font-medium">
          {epg.hasVerifiedSchedule ? (
            <span>{epg.formattedStartTime} - {epg.formattedEndTime}</span>
          ) : (
            <span className="text-gray-500">Programação não disponível</span>
          )}
          {epg.nextProgram && !channel.requiresExternalAccess && epg.hasVerifiedSchedule && (
            <span className="truncate max-w-[110px] text-gray-500">
              A seguir: {epg.nextProgram.title}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
