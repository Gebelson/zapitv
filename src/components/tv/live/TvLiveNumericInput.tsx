import React from 'react';
import { Tv, AlertCircle } from 'lucide-react';

interface TvLiveNumericInputProps {
  digits: string;
  isVisible: boolean;
  errorMessage?: string | null;
}

export const TvLiveNumericInput: React.FC<TvLiveNumericInputProps> = ({
  digits,
  isVisible,
  errorMessage
}) => {
  if (!isVisible && !errorMessage) return null;

  return (
    <div className="fixed top-8 right-10 z-[200] pointer-events-none select-none animate-in fade-in zoom-in-95 duration-150">
      <div className={`px-5 py-3 rounded-2xl backdrop-blur-xl border shadow-2xl flex items-center gap-3.5 transition-all ${
        errorMessage
          ? 'bg-red-950/90 border-red-500/40 text-red-200 shadow-red-950/50'
          : 'bg-[#0a0f18]/90 border-[#007df7]/50 text-white shadow-[#007df7]/20 ring-1 ring-[#007df7]/30'
      }`}>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
          errorMessage ? 'bg-red-500/20 text-red-400' : 'bg-[#007df7]/20 text-[#007df7]'
        }`}>
          {errorMessage ? (
            <AlertCircle className="w-5 h-5" />
          ) : (
            <Tv className="w-5 h-5 animate-pulse" />
          )}
        </div>

        <div className="flex flex-col">
          {errorMessage ? (
            <span className="text-sm font-bold tracking-wide">
              {errorMessage}
            </span>
          ) : (
            <>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                Sintonizando canal
              </span>
              <div className="flex items-center gap-1">
                <span className="text-2xl font-black font-mono tracking-widest text-cyan-300 drop-shadow-[0_0_12px_rgba(0,229,255,0.7)]">
                  {digits}
                </span>
                <span className="w-2 h-5 bg-[#007df7] animate-pulse rounded-sm ml-1" />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
