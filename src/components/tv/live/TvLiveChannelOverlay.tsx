import React from 'react';
import { Radio, Calendar, Trophy, Clock, Volume2, ShieldCheck } from 'lucide-react';
import { LiveChannel, CurrentEpgState } from '../../../core/livetv/types';
import { channelNumberingService } from '../../../core/livetv/channelNumberingService';

interface TvLiveChannelOverlayProps {
  channel: LiveChannel;
  epg: CurrentEpgState;
  isVisible: boolean;
  onOpenGuide?: () => void;
}

export const TvLiveChannelOverlay: React.FC<TvLiveChannelOverlayProps> = ({
  channel,
  epg,
  isVisible,
  onOpenGuide
}) => {
  const formattedNumber = channelNumberingService.getFormattedNumber(channel);
  const prog = epg.currentProgram;

  return (
    <div
      data-testid="tv-live-channel-overlay"
      className={`fixed bottom-6 inset-x-8 z-[100] transition-all duration-300 transform-gpu pointer-events-none select-none ${
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-6'
      }`}
    >
      <div className="relative bg-[#070b14]/92 backdrop-blur-2xl border border-white/15 rounded-3xl p-5 sm:p-6 shadow-2xl shadow-black/80 flex flex-col gap-3 max-w-5xl mx-auto overflow-hidden">
        {/* Linha superior: Número, Logo, Nome do canal, Categoria e Qualidade */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {/* Número do Canal Estilo SKY / Claro */}
            <div className="flex items-center justify-center px-3.5 py-1.5 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 font-black font-mono text-xl sm:text-2xl tracking-widest drop-shadow-[0_0_10px_rgba(0,229,255,0.6)] shrink-0">
              {formattedNumber}
            </div>

            {/* Logo da Emissora */}
            <div className="w-14 h-14 rounded-2xl bg-black/40 border border-white/10 p-2 flex items-center justify-center shrink-0 shadow-inner">
              <img
                src={channel.logo}
                alt={channel.name}
                className="w-full h-full object-contain drop-shadow"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (channel.fallbackLogo && target.src !== channel.fallbackLogo) {
                    target.src = channel.fallbackLogo;
                  }
                }}
              />
            </div>

            {/* Nome e Badges */}
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-white font-black text-lg sm:text-xl truncate tracking-wide drop-shadow">
                  {channel.name}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/10 text-gray-300 border border-white/10">
                  {channel.categoryLabel || channel.category}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  {channel.quality || '1080p'}
                </span>
              </div>
            </div>
          </div>

          {/* Dica de Teclas de Atalho do Controle Remoto */}
          <div className="hidden md:flex items-center gap-3 text-[11px] text-gray-400 font-medium">
            <span className="flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-xl border border-white/5">
              <span className="text-cyan-400 font-bold">▲</span> Guia
            </span>
            <span className="flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-xl border border-white/5">
              <span className="text-cyan-400 font-bold">◄ ►</span> Zapping
            </span>
            <span className="flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-xl border border-white/5">
              <span className="text-cyan-400 font-bold">0-9</span> Canal
            </span>
            <span className="flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-xl border border-white/5">
              <span className="text-cyan-400 font-bold">VOLTAR</span> Menu
            </span>
          </div>
        </div>

        {/* Linha do Programa Atual e Horário */}
        <div className="flex flex-col gap-1.5 pt-1">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-red-600 text-white flex items-center gap-1 shadow-sm shrink-0">
                <Radio className="w-2.5 h-2.5 animate-pulse" /> NO AR
              </span>
              <h3 className="text-white font-bold text-sm sm:text-base truncate drop-shadow">
                {epg.hasVerifiedSchedule ? prog.title : 'Programação não disponível'}
              </h3>
              {prog.competition && (
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 items-center gap-1 shrink-0">
                  <Trophy className="w-2.5 h-2.5" /> {prog.competition}
                </span>
              )}
            </div>

            {epg.hasVerifiedSchedule && (
              <div className="flex items-center gap-1 text-xs font-mono font-bold text-cyan-300 shrink-0">
                <Clock className="w-3.5 h-3.5" />
                <span>{epg.formattedStartTime}</span>
                <span className="text-gray-500 font-normal">-</span>
                <span>{epg.formattedEndTime}</span>
              </div>
            )}
          </div>

          {/* Confronto Esportivo / Sinopse */}
          {prog.teams && (
            <p className="text-cyan-300 text-xs font-bold pl-1 truncate">
              {prog.teams}
            </p>
          )}

          {/* Barra de Progresso Real */}
          {epg.hasVerifiedSchedule && (
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-gradient-to-r from-[#007df7] to-cyan-400 transition-all duration-1000 ease-linear shadow-[0_0_8px_rgba(0,229,255,0.7)]"
                style={{ width: `${epg.progressPercent}%` }}
              />
            </div>
          )}

          {/* Próximo Programa */}
          {epg.nextProgram && (
            <div className="text-[11px] text-gray-400 truncate pt-1 flex items-center gap-1.5">
              <span className="text-gray-500 uppercase text-[9px] font-bold">A Seguir:</span>
              <strong className="text-gray-300 font-semibold">{epg.nextProgram.title}</strong>
              <span className="text-gray-500 font-mono">({epg.nextProgram.startTime})</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
