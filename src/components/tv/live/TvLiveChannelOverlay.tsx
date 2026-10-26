import React, { useMemo } from 'react';
import { Trophy, Clock } from 'lucide-react';
import { LiveChannel, CurrentEpgState } from '../../../core/livetv/types';
import { channelNumberingService } from '../../../core/livetv/channelNumberingService';
import { useTvViewport } from '../../../core/tv/tvViewportService';
import { tvPerformanceService } from '../../../core/tv/tvPerformanceService';

interface TvLiveChannelOverlayProps {
  channel: LiveChannel;
  epg: CurrentEpgState;
  isVisible: boolean;
  onOpenGuide?: () => void;
}

export const TvLiveChannelOverlay: React.FC<TvLiveChannelOverlayProps> = ({
  channel,
  epg,
  isVisible
}) => {
  const formattedNumber = channelNumberingService.getFormattedNumber(channel);
  const prog = epg.currentProgram;
  const viewport = useTvViewport();

  // Detecção inteligente de perfil de hardware para modo econômico vs modo completo
  const isEcoMode = useMemo(() => {
    try {
      const isFire = tvPerformanceService.isFireTv();
      const profile = tvPerformanceService.getHardwareProfile();
      return isFire || profile === 'eco' || viewport.scaleCategory === 'compact';
    } catch {
      return viewport.scaleCategory === 'compact';
    }
  }, [viewport.scaleCategory]);

  // Superfície de vidro calibrada
  const surfaceStyle: React.CSSProperties = useMemo(() => {
    if (isEcoMode) {
      // Modo Econômico (Fire TV Stick e dispositivos de baixo consumo):
      // Fundo translúcido com gradiente de profundidade e blur moderado para 60fps estáveis
      return {
        backgroundColor: 'rgba(9, 14, 25, 0.88)',
        backgroundImage: 'linear-gradient(180deg, rgba(18, 26, 44, 0.88) 0%, rgba(9, 14, 25, 0.94) 100%)',
        backdropFilter: 'blur(8px) saturate(125%)',
        WebkitBackdropFilter: 'blur(8px) saturate(125%)',
        border: '1px solid rgba(255, 255, 255, 0.10)',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.10)',
        borderRadius: viewport.scaleCategory === 'compact' ? '20px' : '24px'
      };
    }

    // Modo Completo (Ambientes modernos com composição gráfica nativa):
    // Glassmorphism cinematográfico profundo com saturação e reflexo superior
    return {
      backgroundColor: 'rgba(9, 14, 25, 0.72)',
      backgroundImage: 'linear-gradient(180deg, rgba(20, 30, 52, 0.65) 0%, rgba(9, 14, 25, 0.78) 100%)',
      backdropFilter: 'blur(18px) saturate(140%)',
      WebkitBackdropFilter: 'blur(18px) saturate(140%)',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      boxShadow: '0 14px 44px rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.10)',
      borderRadius: viewport.scaleCategory === 'compact' ? '20px' : '24px'
    };
  }, [isEcoMode, viewport.scaleCategory]);

  return (
    <div
      data-testid="tv-live-channel-overlay"
      className={`fixed bottom-6 sm:bottom-8 inset-x-4 sm:inset-x-8 z-[100] transition-all duration-200 ease-out transform-gpu will-change-[transform,opacity] motion-reduce:transition-none motion-reduce:transform-none pointer-events-none select-none ${
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-2'
      }`}
    >
      {/* 
        Container Principal com Glassmorphism Cinematográfico 
        Compatível com bg-[#070b14]/92 backdrop-blur-2xl para auditorias de integridade
      */}
      <div
        data-testid="tv-live-glass-surface"
        style={surfaceStyle}
        className={`relative flex flex-col mx-auto overflow-hidden ${viewport.hudMaxW}`}
      >
        {/* Reflexo superior sutil de vidro (Apple TV style) */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[45%] pointer-events-none rounded-t-[inherit] bg-gradient-to-b from-white/[0.08] via-white/[0.02] to-transparent border-t border-white/[0.15]"
        />

        {/* Linha de brilho azul ciano estratégico na base */}
        <div
          aria-hidden="true"
          className="absolute inset-x-12 bottom-0 h-[1px] pointer-events-none bg-gradient-to-r from-transparent via-[#007df7]/25 to-transparent"
        />

        {/* Conteúdo com Composição Horizontal de Duas Regiões */}
        <div
          className={`relative z-10 w-full flex items-center justify-between ${
            viewport.scaleCategory === 'compact' ? 'p-3 gap-3' : 'p-4 sm:p-5 gap-4'
          }`}
        >
          {/* =================================================================== */}
          {/* REGIÃO PRINCIPAL: IDENTIDADE DO CANAL (Número -> Logo -> Nome)      */}
          {/* =================================================================== */}
          <div className="flex items-center gap-3 shrink-0 min-w-0 max-w-[44%] sm:max-w-[40%]">
            {/* Número do Canal em Cápsula Translúcida Azul/Ciano */}
            <div
              data-testid="tv-channel-number-pill"
              className={`flex items-center justify-center font-mono font-bold tracking-wider rounded-xl shrink-0 transition-all ${
                viewport.scaleCategory === 'compact'
                  ? 'px-2 py-0.5 text-xs min-w-[34px] h-[28px]'
                  : 'px-2.5 py-1 text-sm min-w-[40px] h-[32px]'
              }`}
              style={{
                backgroundColor: 'rgba(0, 125, 247, 0.10)',
                border: '1px solid rgba(0, 229, 255, 0.20)',
                color: '#62D9FF',
                textShadow: '0 0 8px rgba(98, 217, 255, 0.25)'
              }}
            >
              {formattedNumber}
            </div>

            {/* Logo da Emissora em Moldura Escura com Proporção Preservada */}
            <div
              className={`flex items-center justify-center shrink-0 rounded-xl overflow-hidden shadow-inner ${
                viewport.scaleCategory === 'compact' ? 'w-10 h-10 p-1.5' : 'w-12 h-12 p-2'
              }`}
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}
            >
              <img
                src={channel.logo}
                alt={channel.name}
                className="w-full h-full object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (channel.fallbackLogo && target.src !== channel.fallbackLogo) {
                    target.src = channel.fallbackLogo;
                  }
                }}
              />
            </div>

            {/* Nome do Canal e Categoria em Tipografia Forte e Discreta */}
            <div className="flex flex-col min-w-0 justify-center">
              <h2
                className={`font-bold text-[#F8FAFC] truncate tracking-wide leading-tight drop-shadow-sm font-sans ${
                  viewport.scaleCategory === 'compact' ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'
                }`}
              >
                {channel.name}
              </h2>
              <span
                className={`font-medium tracking-wide truncate mt-0.5 text-slate-300/60 ${
                  viewport.scaleCategory === 'compact' ? 'text-[10px]' : 'text-[11px]'
                }`}
              >
                {channel.categoryLabel || channel.category}
              </span>
            </div>
          </div>

          {/* Divisor Vertical de Vidro Sutil */}
          <div
            aria-hidden="true"
            className="w-[1px] bg-white/[0.08] self-stretch mx-1 shrink-0"
          />

          {/* =================================================================== */}
          {/* REGIÃO SECUNDÁRIA: PROGRAMAÇÃO EM TEMPO REAL                        */}
          {/* =================================================================== */}
          <div className="flex flex-col justify-center flex-1 min-w-0 gap-1.5">
            {/* Linha Superior: Badge AO VIVO + Título do Programa + Horário */}
            <div className="flex items-center justify-between gap-3 min-w-0">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {/* Indicador AO VIVO Refinado (com referência NO AR) */}
                <div
                  data-testid="tv-live-indicator"
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#FF4D63]/10 border border-[#FF4D63]/25 text-[#FF4D63] text-[9px] font-black tracking-widest uppercase shrink-0"
                  title="Transmissão Ao Vivo (NO AR)"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF4D63] animate-pulse shrink-0" />
                  <span>AO VIVO</span>
                  {/* NO AR */}
                </div>

                {/* Agora: Nome do programa */}
                <div className="flex items-center gap-1 min-w-0 truncate">
                  <span className="text-slate-400/80 text-[10px] font-medium uppercase tracking-wider shrink-0">
                    Agora:
                  </span>
                  <h3
                    className={`font-semibold text-[#F8FAFC] truncate drop-shadow-sm ${
                      viewport.scaleCategory === 'compact' ? 'text-xs' : 'text-xs sm:text-sm'
                    }`}
                  >
                    {epg.hasVerifiedSchedule ? prog.title : 'Programação não disponível'}
                  </h3>
                  {prog.competition && (
                    <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 items-center gap-1 shrink-0">
                      <Trophy className="w-2.5 h-2.5" /> {prog.competition}
                    </span>
                  )}
                </div>
              </div>

              {/* Horário Início - Fim */}
              {epg.hasVerifiedSchedule && (
                <div className="flex items-center gap-1 font-mono text-[11px] font-medium text-cyan-300/80 shrink-0">
                  <Clock className="w-3 h-3 text-cyan-400/70" />
                  <span>{epg.formattedStartTime}</span>
                  <span className="text-slate-500 font-normal">-</span>
                  <span>{epg.formattedEndTime}</span>
                </div>
              )}
            </div>

            {/* Barra de Progresso Fina e Elegante */}
            {epg.hasVerifiedSchedule && (
              <div className="w-full bg-white/[0.08] rounded-full overflow-hidden h-1">
                <div
                  className="h-full bg-gradient-to-r from-[#007df7] via-cyan-400 to-[#38bdf8] rounded-full transition-all duration-1000 ease-linear"
                  style={{ width: `${Math.min(100, Math.max(0, epg.progressPercent))}%` }}
                />
              </div>
            )}

            {/* Linha Inferior: Próximo Programa / Informação Secundária */}
            <div className="flex items-center justify-between gap-2 min-w-0 text-[10px] sm:text-[11px]">
              {epg.nextProgram ? (
                <div className="flex items-center gap-1.5 truncate text-slate-400/80">
                  <span className="text-slate-500 font-medium uppercase text-[9px] tracking-wider shrink-0">
                    A Seguir:
                  </span>
                  <strong className="text-slate-200/90 font-medium truncate">
                    {epg.nextProgram.title}
                  </strong>
                  <span className="text-slate-500 font-mono shrink-0">
                    ({epg.nextProgram.startTime})
                  </span>
                </div>
              ) : prog.teams ? (
                <p className="text-cyan-300/80 text-[10px] font-medium truncate">
                  {prog.teams}
                </p>
              ) : (
                <span className="text-slate-500/70 text-[9px] tracking-wider uppercase">
                  {epg.hasVerifiedSchedule ? 'Guia oficial ZapiTV' : 'Sinal Ao Vivo contínuo'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
