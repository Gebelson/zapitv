import React, { useState, useEffect, useRef } from 'react';
import { tvModeService } from '../../core/tv/tvModeService';

interface KeyRecord {
  id: string;
  key: string;
  code: string;
  keyCode: number;
  time: string;
  latencyMs: number;
  activeElement: string;
  defaultPrevented: boolean;
}

export const TvRemoteDiagnosticOverlay: React.FC = () => {
  const [isVisible, setIsVisible] = useState<boolean>(() => tvModeService.isDiagMode());
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [keyLogs, setKeyLogs] = useState<KeyRecord[]>([]);
  const [testedKeys, setTestedKeys] = useState<{ [key: string]: number }>({
    ArrowUp: 0,
    ArrowDown: 0,
    ArrowLeft: 0,
    ArrowRight: 0,
    Enter: 0,
    Escape: 0,
    Backspace: 0,
    TizenBack_10009: 0,
  });

  const [currentActiveElement, setCurrentActiveElement] = useState<string>('none');
  const countRef = useRef(0);

  useEffect(() => {
    return tvModeService.subscribe(() => {
      setIsVisible(tvModeService.isDiagMode());
    });
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDownCapture = (e: KeyboardEvent) => {
      const start = performance.now();
      const code = e.code || 'UnknownCode';
      const key = e.key || 'UnknownKey';
      const keyCode = e.keyCode || e.which || 0;

      // Classifica a tecla
      let testCategory = '';
      if (keyCode === 10009 || key === 'GoBack' || key === 'Return') {
        testCategory = 'TizenBack_10009';
      } else if (key === 'ArrowUp' || keyCode === 38) {
        testCategory = 'ArrowUp';
      } else if (key === 'ArrowDown' || keyCode === 40) {
        testCategory = 'ArrowDown';
      } else if (key === 'ArrowLeft' || keyCode === 37) {
        testCategory = 'ArrowLeft';
      } else if (key === 'ArrowRight' || keyCode === 39) {
        testCategory = 'ArrowRight';
      } else if (key === 'Enter' || keyCode === 13) {
        testCategory = 'Enter';
      } else if (key === 'Escape' || keyCode === 27) {
        testCategory = 'Escape';
      } else if (key === 'Backspace' || keyCode === 8) {
        testCategory = 'Backspace';
      }

      if (testCategory) {
        setTestedKeys(prev => ({
          ...prev,
          [testCategory]: (prev[testCategory] || 0) + 1
        }));
      }

      const active = document.activeElement;
      let activeDesc = 'body';
      if (active && active !== document.body) {
        const tag = active.tagName.toLowerCase();
        const id = active.id ? `#${active.id}` : '';
        const focusKey = active.getAttribute('data-focus-key') ? `[${active.getAttribute('data-focus-key')}]` : '';
        const cls = active.className && typeof active.className === 'string'
          ? `.${active.className.split(' ').slice(0, 2).join('.')}`
          : '';
        activeDesc = `${tag}${id}${focusKey}${cls}`;
      }
      setCurrentActiveElement(activeDesc);

      const latencyMs = Math.round(performance.now() - start);
      countRef.current += 1;

      const record: KeyRecord = {
        id: `k_${Date.now()}_${countRef.current}`,
        key,
        code,
        keyCode,
        time: new Date().toLocaleTimeString('pt-BR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        latencyMs,
        activeElement: activeDesc,
        defaultPrevented: e.defaultPrevented
      };

      setKeyLogs(prev => [record, ...prev.slice(0, 7)]);
    };

    window.addEventListener('keydown', handleKeyDownCapture, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDownCapture, { capture: true });
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <aside
      aria-label="Diagnóstico de Controle Remoto da TV"
      className="fixed bottom-4 right-4 z-[99999] pointer-events-auto font-mono text-[11px] select-none"
    >
      <div className="bg-[#070b14]/95 border-2 border-cyan-400/80 rounded-2xl shadow-2xl backdrop-blur-xl text-white p-4 max-w-sm w-80 max-h-[85vh] flex flex-col gap-2.5 overflow-hidden transition-all duration-300">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-cyan-400/20 pb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <h2 className="font-bold text-xs tracking-wider uppercase text-cyan-300">
              TV Remote Diagnostics
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] text-gray-300"
              title={isMinimized ? 'Expandir' : 'Minimizar'}
            >
              {isMinimized ? 'Expandir' : 'Minimizar'}
            </button>
            <button
              onClick={() => tvModeService.setDiagMode(false)}
              className="px-2 py-0.5 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 text-[10px]"
              title="Fechar painel"
            >
              ✕
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Status das teclas críticas */}
            <div>
              <p className="text-[10px] text-gray-400 mb-1 font-semibold uppercase">Teclas Verificadas</p>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                {Object.entries(testedKeys).map(([keyName, count]) => {
                  const received = count > 0;
                  return (
                    <div
                      key={keyName}
                      className={`flex items-center justify-between px-2 py-1 rounded border ${
                        received
                          ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300'
                          : 'bg-white/5 border-white/10 text-gray-400'
                      }`}
                    >
                      <span className="truncate">{keyName}</span>
                      <span className="font-bold">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Foco Atual */}
            <div className="bg-black/40 border border-white/10 rounded-lg p-2">
              <span className="text-[9px] text-cyan-300/70 block uppercase font-bold">Elemento em Foco (activeElement):</span>
              <span className="text-[11px] text-cyan-200 font-semibold truncate block">
                {currentActiveElement}
              </span>
            </div>

            {/* Histórico recente */}
            <div className="flex-1 overflow-y-auto max-h-48 no-scrollbar space-y-1">
              <span className="text-[9px] text-gray-400 uppercase font-semibold">Últimos Eventos Recebidos:</span>
              {keyLogs.length === 0 ? (
                <p className="text-gray-500 text-[10px] italic py-2 text-center">
                  Pressione botões no controle remoto para testar...
                </p>
              ) : (
                keyLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-1.5 rounded bg-white/5 border border-white/5 flex flex-col gap-0.5 text-[10px]"
                  >
                    <div className="flex justify-between items-center text-cyan-300 font-bold">
                      <span>{log.key} ({log.keyCode})</span>
                      <span className="text-[9px] text-gray-400 font-normal">{log.time}</span>
                    </div>
                    <div className="flex justify-between text-gray-400 text-[9px]">
                      <span className="truncate max-w-[170px]" title={log.activeElement}>{log.activeElement}</span>
                      <span className="text-amber-400">{log.latencyMs}ms</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Dica técnica MSX */}
            <div className="text-[9px] text-gray-400 border-t border-white/10 pt-1.5 leading-tight">
              Tizen Back code = 10009. Ativado via <span className="text-cyan-300">?tvdiag=1</span>.
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
