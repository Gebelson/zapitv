import React, { useRef, useCallback, useEffect } from 'react';
import { Sparkles, MoveHorizontal, X } from 'lucide-react';
import { aiEnhancerService } from '../../core/enhancement/aiEnhancerService';

interface ZapiAiSplitComparisonProps {
  splitPosition: number;
  onClose?: () => void;
}

export const ZapiAiSplitComparison: React.FC<ZapiAiSplitComparisonProps> = ({
  splitPosition,
  onClose
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    isDraggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateSplitFromEvent(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    e.stopPropagation();
    updateSplitFromEvent(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const updateSplitFromEvent = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = clientX - rect.left;
    const pct = Math.max(5, Math.min(95, Math.round((x / rect.width) * 100)));
    aiEnhancerService.setSplitPosition(pct);
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-30 pointer-events-none select-none overflow-hidden"
    >
      {/* Badges de Identificação */}
      <div className="absolute top-5 left-5 pointer-events-none transition-opacity">
        <div className="px-3 py-1.5 rounded-full bg-black/60 border border-white/20 backdrop-blur-md shadow-xl flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-gray-400" />
          <span className="text-[11px] font-bold text-gray-200 tracking-wider uppercase">Original</span>
        </div>
      </div>

      <div className="absolute top-5 right-5 pointer-events-auto flex items-center gap-2">
        <div className="px-3 py-1.5 rounded-full bg-[#007df7]/80 border border-white/30 backdrop-blur-md shadow-xl flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
          <span className="text-[11px] font-black text-white tracking-wider uppercase">IA Aprimorado</span>
        </div>

        {onClose && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1.5 rounded-full bg-black/60 hover:bg-black/80 border border-white/20 text-white/80 hover:text-white transition-all shadow-xl"
            title="Fechar Comparação Dividida"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Linha Divisória Interativa */}
      <div
        className="absolute top-0 bottom-0 pointer-events-auto cursor-ew-resize flex items-center justify-center group"
        style={{ left: `${splitPosition}%`, transform: 'translateX(-50%)', width: '36px' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Linha visual brilhante */}
        <div className="w-[2px] h-full bg-[#007df7] shadow-[0_0_12px_rgba(0,125,247,0.9)] group-hover:w-[3px] transition-all" />

        {/* Handle circular central */}
        <div className="absolute w-9 h-9 rounded-full bg-[#007df7] border-2 border-white shadow-2xl flex items-center justify-center text-white scale-100 group-hover:scale-110 active:scale-95 transition-transform">
          <MoveHorizontal className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
};

export default ZapiAiSplitComparison;
