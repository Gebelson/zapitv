import React, { useState, useEffect, useRef } from 'react';
import { tvModeService } from '../../core/tv/tvModeService';
import { getCurrentFocusKey } from '@noriginmedia/norigin-spatial-navigation';
import { playbackOptimizerService } from '../../core/playback/PlaybackOptimizerService';

interface KeyRecord {
  id: string;
  key: string;
  code: string;
  keyCode: number;
  time: string;
  latencyMs: number;
  activeElement: string;
  focusKey: string;
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
  const [currentNoriginFocus, setCurrentNoriginFocus] = useState<string>('none');
  const [navigableCount, setNavigableCount] = useState<number>(0);
  const [videoMetrics, setVideoMetrics] = useState<string | null>(null);
  const countRef = useRef(0);

  useEffect(() => {
    return tvModeService.subscribe(() => {
      setIsVisible(tvModeService.isDiagMode());
    });
  }, []);

  // Monitora o elemento focado e a contagem de componentes navegáveis
  useEffect(() => {
    if (!isVisible) return;

    let ticks = 0;
    const interval = setInterval(() => {
      const active = document.activeElement;
      let activeDesc = 'body';
      if (active && active !== document.body) {
        const tag = active.tagName.toLowerCase();
        const id = active.id ? `#${active.id}` : '';
        const focusKeyAttr = active.getAttribute('data-focus-key') ? `[${active.getAttribute('data-focus-key')}]` : '';
        activeDesc = `${tag}${id}${focusKeyAttr}`;
      }
      setCurrentActiveElement(activeDesc);
      setCurrentNoriginFocus(getCurrentFocusKey() || 'nenhum');
      setNavigableCount(document.querySelectorAll('[data-focus-key]').length);
      if (++ticks % 4 === 0) {
        const video = document.querySelector<HTMLVideoElement>('video[data-zapi-main-video]');
        if (!video) {
          setVideoMetrics(null);
        } else {
          const telemetry = playbackOptimizerService.getTelemetry();
          const frames = video.getVideoPlaybackQuality?.();
          const resolution = video.videoWidth && video.videoHeight ? `${video.videoWidth}×${video.videoHeight}` : 'aguardando';
          const quality = telemetry.currentResolution || 'auto';
          const declared = video.dataset.sourceQuality || 'não declarada';
          const buffer = telemetry.bufferAheadSeconds.toFixed(1);
          const dropped = frames ? `${frames.droppedVideoFrames}/${frames.totalVideoFrames}` : 'não informado';
          const device = playbackOptimizerService.getDeviceProfile();
          const engine = telemetry.streamSourceType === 'hls'
            ? (video.currentSrc.startsWith('blob:') ? 'HLS.js' : 'HLS nativo')
            : 'HTML5 nativo';
          setVideoMetrics(`${device.deviceType} · ${engine} · ${resolution} · qualidade ${quality} · fonte ${declared} · buffer ${buffer}s · interrupções ${telemetry.bufferingCount} (${Math.round(telemetry.totalBufferingDurationMs / 1000)}s) · recuperações ${telemetry.stallsRecovered} · quadros perdidos ${dropped} · erro de mídia ${video.error?.code || 0}`);
        }
      }
    }, 250);

    return () => clearInterval(interval);
  }, [isVisible]);

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
        const focusKeyAttr = active.getAttribute('data-focus-key') ? `[${active.getAttribute('data-focus-key')}]` : '';
        activeDesc = `${tag}${id}${focusKeyAttr}`;
      }
      setCurrentActiveElement(activeDesc);
      const curFocus = getCurrentFocusKey() || 'nenhum';
      setCurrentNoriginFocus(curFocus);

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
        focusKey: curFocus,
        defaultPrevented: e.defaultPrevented
      };

      setKeyLogs(prev => [record, ...prev.slice(0, 6)]);
    };

    window.addEventListener('keydown', handleKeyDownCapture, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDownCapture, { capture: true });
    };
  }, [isVisible]);

  if (!isVisible) return null;

  const currentPath = typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : '';
  const isTvRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/tv');
  const activeLayoutDesc = isTvRoute ? 'Smart TV (TvApp Cinematográfico)' : 'Desktop Layout (Sidebar)';

  // Determina a região de foco ativa
  let focusRegionDesc = 'Corpo Principal';
  if (currentNoriginFocus.startsWith('tv-nav-')) focusRegionDesc = 'Cabeçalho Superior';
  else if (currentNoriginFocus.startsWith('tv-hero-')) focusRegionDesc = 'Banner Principal';
  else if (currentNoriginFocus.startsWith('card-')) focusRegionDesc = 'Carrosséis de Conteúdo';
  else if (currentNoriginFocus.startsWith('tv-menu-')) focusRegionDesc = 'Menu de Perfil';
  else if (currentNoriginFocus.startsWith('tv-details-')) focusRegionDesc = 'Modal de Detalhes';
  else if (currentNoriginFocus.startsWith('tv-search-')) focusRegionDesc = 'Tela de Busca';

  return (
    <aside
      aria-label="Diagnóstico de Controle Remoto da TV"
      className="fixed bottom-4 right-4 z-[99999] pointer-events-auto font-mono text-[11px] select-none"
    >
      <div className="bg-[#070b14]/98 border-2 border-cyan-400 rounded-2xl shadow-2xl backdrop-blur-none text-white p-3.5 max-w-sm w-88 max-h-[88vh] flex flex-col gap-2 overflow-hidden transition-all duration-300">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-cyan-400/30 pb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <h2 className="font-bold text-xs tracking-wider uppercase text-cyan-300">
              ZapiTV Smart TV Diagnostic
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
            {/* Informações de Rota, Layout e Versão */}
            <div className="bg-black/50 border border-white/10 rounded-lg p-2 space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span className="text-gray-400">Rota Atual:</span>
                <span className="text-cyan-300 font-bold truncate max-w-[190px]">{currentPath}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Layout Ativo:</span>
                <span className={`font-bold ${isTvRoute ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {activeLayoutDesc}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Versão / Build:</span>
                <span className="text-gray-300 font-medium">04e663d (v2.0-tv)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Componentes Focáveis:</span>
                <span className="text-cyan-400 font-bold">{navigableCount} elementos</span>
              </div>
            </div>

            {videoMetrics && (
              <div className="bg-black/40 border border-white/10 rounded-lg p-2 text-[10px] text-gray-300">
                <span className="text-cyan-300 font-bold">Vídeo real: </span>{videoMetrics}
              </div>
            )}

            {/* Foco e Região Ativa */}
            <div className="bg-black/40 border border-cyan-400/40 rounded-lg p-2 space-y-0.5">
              <div className="flex justify-between text-[10px]">
                <span className="text-cyan-400 uppercase font-bold">Região de Foco:</span>
                <span className="text-white font-black">{focusRegionDesc}</span>
              </div>
              <div className="text-[10px] truncate text-gray-300">
                <span className="text-gray-400">Foco Espacial: </span>
                <span className="text-cyan-300 font-bold">{currentNoriginFocus}</span>
              </div>
            </div>

            {/* Status das teclas críticas */}
            <div>
              <p className="text-[10px] text-gray-400 mb-1 font-semibold uppercase">Teclas Verificadas</p>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                {Object.entries(testedKeys).map(([keyName, count]) => {
                  const received = count > 0;
                  return (
                    <div
                      key={keyName}
                      className={`flex items-center justify-between px-2 py-0.5 rounded border ${
                        received
                          ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
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

            {/* Histórico recente */}
            <div className="flex-1 overflow-y-auto max-h-36 no-scrollbar space-y-1">
              <span className="text-[9px] text-gray-400 uppercase font-semibold">Últimos Eventos Recebidos:</span>
              {keyLogs.length === 0 ? (
                <p className="text-gray-500 text-[10px] italic py-1 text-center">
                  Pressione botões no controle remoto para testar...
                </p>
              ) : (
                keyLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-1 rounded bg-white/5 border border-white/5 flex flex-col gap-0.5 text-[10px]"
                  >
                    <div className="flex justify-between items-center text-cyan-300 font-bold">
                      <span>{log.key} ({log.keyCode})</span>
                      <span className="text-[9px] text-gray-400 font-normal">{log.time}</span>
                    </div>
                    <div className="flex justify-between text-gray-400 text-[9px]">
                      <span className="truncate max-w-[170px]" title={log.focusKey}>{log.focusKey}</span>
                      <span className="text-amber-400">{log.latencyMs}ms</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Dica técnica MSX */}
            <div className="text-[9px] text-gray-400 border-t border-white/10 pt-1 leading-tight">
              Tizen Back = 10009. Teclas são capturadas com prioridade em capture-phase.
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
