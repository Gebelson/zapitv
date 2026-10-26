import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Calendar, Clock, Radio, Trophy, Film, Tv, ShieldCheck, ChevronRight, X } from 'lucide-react';
import { LiveChannel, EpgProgram, CurrentEpgState } from '../../../core/livetv/types';
import { epgService } from '../../../core/livetv/epgService';
import { channelNumberingService } from '../../../core/livetv/channelNumberingService';

interface TvLiveChannelGuideProps {
  channels: LiveChannel[];
  activeChannelId: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectChannel: (channel: LiveChannel) => void;
}

export const TvLiveChannelGuide: React.FC<TvLiveChannelGuideProps> = ({
  channels,
  activeChannelId,
  isOpen,
  onClose,
  onSelectChannel
}) => {
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [programIdx, setProgramIdx] = useState<number>(0);
  const [pane, setPane] = useState<'channels' | 'programs'>('channels');

  const channelListRef = useRef<HTMLDivElement | null>(null);
  const channelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const programListRef = useRef<HTMLDivElement | null>(null);
  const programRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Inicializa a seleção no canal ativo ao abrir
  useEffect(() => {
    if (isOpen) {
      const idx = channels.findIndex(c => c.id === activeChannelId);
      const safeIdx = idx >= 0 ? idx : 0;
      setSelectedIdx(safeIdx);
      setProgramIdx(0);
      setPane('channels');
    }
  }, [isOpen, activeChannelId, channels]);

  const focusedChannel = channels[selectedIdx] || channels[0];
  const schedule = focusedChannel ? epgService.getDailySchedule(focusedChannel, 0) : [];
  const brasiliaMinutes = epgService.getCurrentBrazilMinutes();
  const nowUtc = Date.now();

  // Scroll automático da lista de canais para o canal focado
  useEffect(() => {
    if (isOpen && channelRefs.current[selectedIdx]) {
      channelRefs.current[selectedIdx]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIdx, isOpen]);

  // Scroll automático da lista de programas
  useEffect(() => {
    if (isOpen && pane === 'programs' && programRefs.current[programIdx]) {
      programRefs.current[programIdx]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [programIdx, pane, isOpen]);

  // Suporte aos controles remotos da Smart TV
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (pane === 'channels') {
            setSelectedIdx(prev => Math.min(channels.length - 1, prev + 1));
            setProgramIdx(0);
          } else {
            setProgramIdx(prev => Math.min(schedule.length - 1, prev + 1));
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (pane === 'channels') {
            setSelectedIdx(prev => Math.max(0, prev - 1));
            setProgramIdx(0);
          } else {
            setProgramIdx(prev => Math.max(0, prev - 1));
          }
          break;

        case 'ArrowRight':
          e.preventDefault();
          if (pane === 'channels' && schedule.length > 0 && !schedule[0].isFallback) {
            setPane('programs');
          }
          break;

        case 'ArrowLeft':
          e.preventDefault();
          if (pane === 'programs') {
            setPane('channels');
          }
          break;

        case 'Enter':
          e.preventDefault();
          if (focusedChannel) {
            onSelectChannel(focusedChannel);
            onClose();
          }
          break;

        case 'Escape':
        case 'Backspace':
          e.preventDefault();
          if (pane === 'programs') {
            setPane('channels');
          } else {
            onClose();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, channels, selectedIdx, programIdx, pane, schedule, focusedChannel, onSelectChannel, onClose]);

  if (!isOpen) return null;

  return (
    <div
      data-testid="tv-live-channel-guide"
      className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-md flex flex-col p-8 sm:p-12 animate-in fade-in duration-200 select-none pointer-events-auto"
    >
      {/* Cabeçalho do Guia de Programação */}
      <div className="flex items-center justify-between pb-5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 flex items-center justify-center font-black drop-shadow-[0_0_12px_rgba(0,229,255,0.6)]">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-white font-black text-xl tracking-wide flex items-center gap-2">
              <span>Guia de Canais Ao Vivo</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                EPG Oficial
              </span>
            </h2>
            <p className="text-gray-400 text-xs">
              Navegue com as setas do controle. Pressione OK para sintonizar a emissora.
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all border border-white/10 cursor-pointer"
          title="Fechar guia (VOLTAR)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Grade estilo SKY/NET: Lista de Canais à esquerda + Programação detalhada à direita */}
      <div className="flex-1 grid grid-cols-12 gap-6 min-h-0 pt-6">
        {/* Painel Esquerdo: Lista Vertical de Canais (Colunas 1 a 5) */}
        <div
          ref={channelListRef}
          className="col-span-5 flex flex-col gap-2 overflow-y-auto no-scrollbar pr-2"
        >
          {channels.map((ch, idx) => {
            const isSelected = selectedIdx === idx;
            const isCurrentChannelPlaying = ch.id === activeChannelId;
            const chEpg = epgService.getCurrentEpgState(ch);
            const num = channelNumberingService.getFormattedNumber(ch);

            return (
              <div
                key={ch.id}
                ref={(el) => { channelRefs.current[idx] = el; }}
                onClick={() => {
                  setSelectedIdx(idx);
                  onSelectChannel(ch);
                  onClose();
                }}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  isSelected && pane === 'channels'
                    ? 'bg-cyan-500/20 border-cyan-400 shadow-xl shadow-cyan-500/20 ring-2 ring-cyan-400/80 scale-[1.01]'
                    : isSelected
                    ? 'bg-white/10 border-cyan-400/50 ring-1 ring-cyan-400/30'
                    : isCurrentChannelPlaying
                    ? 'bg-white/10 border-white/20 text-white'
                    : 'bg-white/5 border-white/5 hover:border-white/15 opacity-80 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono font-black text-sm text-cyan-300 drop-shadow w-9 text-center shrink-0">
                    {num}
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-black/40 border border-white/10 p-1 flex items-center justify-center shrink-0">
                    <img src={ch.logo} alt={ch.name} className="w-full h-full object-contain" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-sm truncate">
                        {ch.name}
                      </span>
                      {isCurrentChannelPlaying && (
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                      )}
                    </div>
                    <span className="text-gray-400 text-[11px] truncate">
                      {chEpg.hasVerifiedSchedule ? chEpg.currentProgram.title : 'Programação não disponível'}
                    </span>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
              </div>
            );
          })}
        </div>

        {/* Painel Direito: Linha do Tempo e Detalhes da Programação do Canal Focado (Colunas 6 a 12) */}
        <div className="col-span-7 bg-[#070b14]/90 border border-white/15 rounded-3xl p-6 flex flex-col min-h-0 shadow-2xl backdrop-blur-2xl">
          {focusedChannel && (
            <>
              {/* Header do Canal no Painel de Detalhes */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-black/50 border border-white/15 p-2 flex items-center justify-center shrink-0">
                    <img src={focusedChannel.logo} alt={focusedChannel.name} className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-cyan-300 font-mono font-black text-lg">
                        {channelNumberingService.getFormattedNumber(focusedChannel)}
                      </span>
                      <h3 className="text-white font-black text-lg">
                        {focusedChannel.name}
                      </h3>
                      <span className="text-[10px] text-gray-300 font-bold px-2 py-0.5 rounded-full bg-white/10 border border-white/10 uppercase">
                        {focusedChannel.categoryLabel}
                      </span>
                    </div>
                    <span className="text-gray-400 text-xs">
                      {focusedChannel.description || 'Transmissão oficial em alta definição.'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onSelectChannel(focusedChannel);
                    onClose();
                  }}
                  className="px-4 py-2 bg-[#007df7] hover:bg-[#0069d9] active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-[#007df7]/30 cursor-pointer"
                >
                  Sintonizar
                </button>
              </div>

              {/* Lista de Programas do Canal */}
              <div
                ref={programListRef}
                className="flex-1 overflow-y-auto no-scrollbar py-4 space-y-2.5"
              >
                {schedule.length === 0 || schedule[0]?.isFallback ? (
                  <div className="min-h-[200px] flex flex-col items-center justify-center p-6 text-center text-gray-400">
                    <Calendar className="w-8 h-8 mb-2 text-gray-500" />
                    <p className="text-sm font-bold text-gray-300">Programação não disponível</p>
                    <p className="text-xs text-gray-500 mt-1 max-w-sm">
                      A emissora transmite continuamente sua grade, porém os horários oficiais não foram fornecidos para esta data.
                    </p>
                  </div>
                ) : (
                  schedule.map((prog, pIdx) => {
                    let isCurrent = false;
                    if (prog.startUtcMs && prog.endUtcMs) {
                      isCurrent = prog.startUtcMs <= nowUtc && nowUtc < prog.endUtcMs;
                    } else {
                      isCurrent = prog.startMinutes <= brasiliaMinutes && brasiliaMinutes < prog.endMinutes;
                    }

                    const isProgFocused = pane === 'programs' && programIdx === pIdx;

                    return (
                      <div
                        key={prog.id || pIdx}
                        ref={(el) => { programRefs.current[pIdx] = el; }}
                        onClick={() => {
                          setPane('programs');
                          setProgramIdx(pIdx);
                        }}
                        className={`p-3.5 rounded-2xl border transition-all flex flex-col gap-1.5 ${
                          isProgFocused
                            ? 'bg-cyan-500/20 border-cyan-400 ring-2 ring-cyan-400/80 shadow-lg'
                            : isCurrent
                            ? 'bg-[#007df7]/15 border-[#007df7] shadow-md ring-1 ring-[#007df7]/40'
                            : 'bg-white/5 border-white/5 hover:border-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-cyan-300 font-mono text-xs font-bold">
                              {prog.startTime} - {prog.endTime}
                            </span>
                            {isCurrent && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-red-600 text-white flex items-center gap-1">
                                <Radio className="w-2.5 h-2.5 animate-pulse" /> NO AR
                              </span>
                            )}
                            {prog.isLive && !isCurrent && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/30">
                                AO VIVO
                              </span>
                            )}
                            {prog.competition && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                <Trophy className="w-2.5 h-2.5" /> {prog.competition}
                              </span>
                            )}
                          </div>

                          {prog.durationMinutes && (
                            <span className="text-[10px] text-gray-400 font-mono">
                              {prog.durationMinutes}m
                            </span>
                          )}
                        </div>

                        <h4 className={`text-sm ${isCurrent ? 'text-white font-black' : 'text-gray-200 font-bold'}`}>
                          {prog.title}
                        </h4>

                        {prog.teams && (
                          <p className="text-cyan-300 text-xs font-bold">
                            {prog.teams}
                          </p>
                        )}

                        {prog.description && (
                          <p className="text-gray-400 text-xs line-clamp-2 leading-relaxed">
                            {prog.description}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
