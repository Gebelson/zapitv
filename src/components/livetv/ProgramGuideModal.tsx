import React, { useEffect, useState, useRef, useCallback } from 'react';
import { X, Calendar, Clock, Radio, Trophy, Film, Tv, ShieldCheck, ChevronRight } from 'lucide-react';
import { LiveChannel, EpgProgram } from '../../core/livetv/types';
import { epgService, EpgDateOption } from '../../core/livetv/epgService';

interface ProgramGuideModalProps {
  channel: LiveChannel;
  isOpen: boolean;
  onClose: () => void;
  onWatchChannel?: (channel: LiveChannel) => void;
}

export const ProgramGuideModal: React.FC<ProgramGuideModalProps> = ({
  channel,
  isOpen,
  onClose,
  onWatchChannel
}) => {
  const [availableDates, setAvailableDates] = useState<EpgDateOption[]>([]);
  const [selectedDateIdx, setSelectedDateIdx] = useState(0);
  const [schedule, setSchedule] = useState<EpgProgram[]>([]);
  const [currentBrazilMinutes, setCurrentBrazilMinutes] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const currentItemRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Carrega opções de datas e programação ao abrir ou alternar canal
  useEffect(() => {
    if (isOpen) {
      const dates = epgService.getAvailableDates(channel);
      setAvailableDates(dates);
      setSelectedDateIdx(0);

      const daily = epgService.getDailySchedule(channel, 0);
      setSchedule(daily);

      const bMin = epgService.getCurrentBrazilMinutes();
      setCurrentBrazilMinutes(bMin);

      // Encontra índice do programa atual
      const nowUtc = Date.now();
      let curIdx = -1;
      for (let i = 0; i < daily.length; i++) {
        const p = daily[i];
        if (p.startUtcMs && p.endUtcMs && p.startUtcMs <= nowUtc && nowUtc < p.endUtcMs) {
          curIdx = i;
          break;
        } else if (p.startMinutes <= bMin && bMin < p.endMinutes) {
          curIdx = i;
          break;
        }
      }
      setFocusedIndex(curIdx !== -1 ? curIdx : 0);
    }
  }, [isOpen, channel]);

  // Atualiza programação quando o usuário seleciona outra data
  const handleSelectDate = useCallback((idx: number) => {
    setSelectedDateIdx(idx);
    const dateOpt = availableDates[idx];
    if (dateOpt) {
      const daily = epgService.getDailySchedule(channel, dateOpt.offset);
      setSchedule(daily);
      setFocusedIndex(0);
    }
  }, [availableDates, channel]);

  // Rolagem automática para o programa atual ou focado
  useEffect(() => {
    if (isOpen && currentItemRef.current) {
      setTimeout(() => {
        currentItemRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 150);
    }
  }, [isOpen, selectedDateIdx]);

  // Rolagem suave quando o índice de foco do controle remoto mudar
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && itemRefs.current[focusedIndex]) {
      itemRefs.current[focusedIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [focusedIndex, isOpen]);

  // Suporte a controle remoto para Smart TV (Setas, OK, Voltar)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex(prev => Math.min(schedule.length - 1, prev + 1));
          break;

        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex(prev => Math.max(0, prev - 1));
          break;

        case 'ArrowLeft':
          if (availableDates.length > 1) {
            e.preventDefault();
            const nextIdx = Math.max(0, selectedDateIdx - 1);
            if (nextIdx !== selectedDateIdx) {
              handleSelectDate(nextIdx);
            }
          }
          break;

        case 'ArrowRight':
          if (availableDates.length > 1) {
            e.preventDefault();
            const nextIdx = Math.min(availableDates.length - 1, selectedDateIdx + 1);
            if (nextIdx !== selectedDateIdx) {
              handleSelectDate(nextIdx);
            }
          }
          break;

        case 'Enter':
          e.preventDefault();
          if (onWatchChannel) {
            onClose();
            onWatchChannel(channel);
          }
          break;

        case 'Escape':
        case 'Backspace':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, schedule.length, focusedIndex, selectedDateIdx, availableDates.length, handleSelectDate, onClose, onWatchChannel, channel]);

  if (!isOpen) return null;

  const isTodaySelected = selectedDateIdx === 0;
  const nowUtc = Date.now();

  return (
    <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-2xl bg-[#0f121a]/95 border border-white/15 rounded-3xl p-5 sm:p-7 shadow-2xl backdrop-blur-2xl flex flex-col max-h-[88vh] overflow-hidden">
        {/* Cabeçalho do Canal */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0 gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-white/10 p-2 border border-white/15 flex items-center justify-center shrink-0 shadow-md">
              <img src={channel.logo} alt={channel.name} className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-white font-black text-base sm:text-lg">
                  {channel.name}
                </h3>
                <span className="text-[10px] text-orange-400 font-bold px-2.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 uppercase tracking-wider">
                  {channel.categoryLabel}
                </span>
                <span className="text-[10px] text-gray-300 font-bold px-2 py-0.5 rounded-full bg-white/10 border border-white/10">
                  {channel.quality || '1080p'}
                </span>
              </div>
              <span className="text-gray-400 text-xs flex items-center gap-1.5 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-[#007df7]" />
                <span>Programação Oficial (Horário de Brasília)</span>
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all border border-white/10 cursor-pointer shrink-0"
            title="Fechar guia"
            aria-label="Fechar guia"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Seletor de Datas (Hoje, Amanhã, etc.) */}
        {availableDates.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-3 border-b border-white/5 shrink-0">
            {availableDates.map((dOpt, idx) => {
              const isSelected = selectedDateIdx === idx;
              return (
                <button
                  key={dOpt.dateStr}
                  onClick={() => handleSelectDate(idx)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[#007df7] text-white shadow-md shadow-[#007df7]/30 scale-102'
                      : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/5'
                  }`}
                >
                  <Calendar className="w-3 h-3" />
                  {dOpt.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Lista de Programas com Scroll e Foco Inteligente */}
        <div ref={listContainerRef} className="flex-1 overflow-y-auto no-scrollbar py-4 space-y-3">
          {schedule.length === 0 || schedule[0]?.isFallback ? (
            <div className="min-h-[220px] flex flex-col items-center justify-center p-6 text-center bg-white/5 border border-white/10 rounded-2xl">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-3 text-gray-400">
                <Calendar className="w-6 h-6" />
              </div>
              <h4 className="text-white text-base font-bold mb-1">
                Programação não disponível
              </h4>
              <p className="text-gray-400 text-xs max-w-md leading-relaxed">
                Este canal transmite continuamente sua grade, mas os horários detalhados de transmissão não foram disponibilizados pela emissora para esta data.
              </p>
            </div>
          ) : (
            schedule.map((prog, idx) => {
              // Verifica se o programa é o atual no ar
              let isCurrent = false;
              if (isTodaySelected) {
                if (prog.startUtcMs && prog.endUtcMs) {
                  isCurrent = prog.startUtcMs <= nowUtc && nowUtc < prog.endUtcMs;
                } else {
                  isCurrent = prog.startMinutes <= currentBrazilMinutes && currentBrazilMinutes < prog.endMinutes;
                }
              }

              const isPast = isTodaySelected && (prog.endUtcMs ? prog.endUtcMs <= nowUtc : prog.endMinutes <= currentBrazilMinutes);
              const isFocused = focusedIndex === idx;

              // Calcula progresso para o programa no ar
              let progressPercent = 0;
              if (isCurrent) {
                const totalDur = prog.durationMinutes || Math.max(1, prog.endMinutes - prog.startMinutes);
                let elap = 0;
                if (prog.startUtcMs && nowUtc >= prog.startUtcMs) {
                  elap = Math.floor((nowUtc - prog.startUtcMs) / 60000);
                } else {
                  elap = currentBrazilMinutes - prog.startMinutes;
                  if (elap < 0) elap += 1440;
                }
                progressPercent = Math.min(100, Math.max(0, Math.round((elap / totalDur) * 100)));
              }

              return (
                <div
                  key={prog.id || idx}
                  ref={(el) => {
                    itemRefs.current[idx] = el;
                    if (isCurrent) currentItemRef.current = el;
                  }}
                  onClick={() => setFocusedIndex(idx)}
                  className={`group relative p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isCurrent
                      ? 'bg-[#007df7]/15 border-[#007df7] shadow-xl shadow-[#007df7]/20 ring-1 ring-[#007df7]/50'
                      : isFocused
                        ? 'bg-white/10 border-[#007df7]/70 shadow-lg ring-1 ring-[#007df7]/30 scale-[1.01]'
                        : isPast
                          ? 'bg-white/[0.02] border-white/5 opacity-55 hover:opacity-85'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start gap-3.5 max-w-xl">
                    {/* Horário */}
                    <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#007df7] shrink-0 pt-0.5">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>{prog.startTime}</span>
                      <span className="text-gray-500 font-normal">-</span>
                      <span>{prog.endTime}</span>
                    </div>

                    {/* Informações do Programa */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className={`text-sm ${isCurrent ? 'text-white font-black drop-shadow' : 'text-gray-200 font-bold'}`}>
                          {prog.title}
                        </h4>

                        {/* Badges de Destaque Oficial */}
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-red-600 text-white flex items-center gap-1 shadow-sm">
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

                      {/* Partida ou Equipes */}
                      {prog.teams && (
                        <p className="text-[#007df7] text-xs font-bold">
                          {prog.teams}
                        </p>
                      )}

                      {/* Sinopse / Descrição */}
                      {prog.description && (
                        <p className="text-gray-400 text-xs line-clamp-2 leading-relaxed">
                          {prog.description}
                        </p>
                      )}

                      {/* Barra de Progresso Real para o programa atual */}
                      {isCurrent && (
                        <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden mt-2">
                          <div
                            className="h-full bg-[#007df7] transition-all duration-1000 ease-linear shadow-[0_0_8px_rgba(0,125,247,0.8)]"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Categoria e Duração */}
                  <div className="shrink-0 flex items-center justify-between sm:justify-end gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                    {prog.durationMinutes && prog.durationMinutes > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5">
                        {prog.durationMinutes >= 60
                          ? `${Math.floor(prog.durationMinutes / 60)}h ${prog.durationMinutes % 60 ? (prog.durationMinutes % 60) + 'm' : ''}`
                          : `${prog.durationMinutes} min`}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-gray-300">
                      {prog.category || channel.categoryLabel}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé */}
        <div className="pt-4 border-t border-white/10 flex items-center justify-between shrink-0 gap-3">
          <div className="text-xs text-gray-400 flex items-center gap-1.5 truncate">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">Transmissão oficial em alta definição</span>
          </div>

          {onWatchChannel && (
            <button
              onClick={() => {
                onClose();
                onWatchChannel(channel);
              }}
              className="px-5 py-2.5 bg-[#007df7] hover:bg-[#0069d9] active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-[#007df7]/30 cursor-pointer shrink-0"
            >
              Sintonizar Canal
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
