import React, { useEffect, useState } from 'react';
import { X, Calendar, Clock, Radio } from 'lucide-react';
import { LiveChannel, EpgProgram } from '../../core/livetv/types';
import { epgService } from '../../core/livetv/epgService';

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
  const [schedule, setSchedule] = useState<EpgProgram[]>([]);
  const [currentBrazilMinutes, setCurrentBrazilMinutes] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setSchedule(epgService.getDailySchedule(channel));
      setCurrentBrazilMinutes(epgService.getCurrentBrazilMinutes());
    }
  }, [isOpen, channel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#0f121a]/95 border border-white/15 rounded-3xl p-6 shadow-2xl backdrop-blur-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 p-1.5 border border-white/10 flex items-center justify-center shrink-0">
              <img src={channel.logo} alt={channel.name} className="w-full h-full object-contain" />
            </div>
            <div>
              <h3 className="text-white font-black text-base sm:text-lg flex items-center gap-2">
                <span>{channel.name}</span>
                <span className="text-xs text-orange-400 font-bold px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20">
                  {channel.categoryLabel}
                </span>
              </h3>
              <span className="text-gray-400 text-xs flex items-center gap-1.5 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-[#007df7]" /> Guia Oficial do Dia (Horário de Brasília)
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all border border-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Schedule List */}
        <div className="flex-1 overflow-y-auto no-scrollbar py-4 space-y-3">
          {schedule.map((prog, idx) => {
            const isCurrent = prog.startMinutes <= currentBrazilMinutes && currentBrazilMinutes < prog.endMinutes;
            const isPast = prog.endMinutes <= currentBrazilMinutes;

            return (
              <div
                key={prog.id || idx}
                className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isCurrent
                    ? 'bg-[#007df7]/15 border-[#007df7]/50 shadow-lg shadow-[#007df7]/10 ring-1 ring-[#007df7]/40'
                    : isPast
                      ? 'bg-white/[0.02] border-white/5 opacity-50'
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex items-center gap-1 text-xs font-mono font-bold text-[#007df7] shrink-0 pt-0.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{prog.startTime}</span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className={`font-bold text-sm ${isCurrent ? 'text-white font-black' : 'text-gray-200'}`}>
                        {prog.title}
                      </h4>
                      {isCurrent && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-red-600 text-white flex items-center gap-1">
                          <Radio className="w-2.5 h-2.5 animate-pulse" /> NO AR
                        </span>
                      )}
                    </div>
                    {prog.description && (
                      <p className="text-gray-400 text-xs line-clamp-2 mt-1 leading-relaxed">
                        {prog.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex items-center justify-between sm:justify-end gap-2">
                  <span className="text-[10px] uppercase font-bold text-gray-400 px-2.5 py-1 rounded-lg bg-white/5 border border-white/5">
                    {prog.category || 'Geral'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {onWatchChannel && (
          <div className="pt-4 border-t border-white/10 flex items-center justify-between shrink-0">
            <span className="text-xs text-gray-400">Canal verificado em alta definição</span>
            <button
              onClick={() => {
                onClose();
                onWatchChannel(channel);
              }}
              className="px-5 py-2.5 bg-[#007df7] hover:bg-[#0069d9] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-[#007df7]/30 cursor-pointer"
            >
              Sintonizar Agora
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
