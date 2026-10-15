/**
 * ZapiTV — Ferramenta Interna de Diagnóstico de Streams (Ambiente de Desenvolvimento)
 * Permite auditar a identidade canônica, fontes consultadas, nível de confiança (5 tiers),
 * motivos de seleção/rejeição e quarentena de segurança.
 */

import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, X, RefreshCw, CheckCircle2, Ban, Activity, Wifi, Cpu, Layers, Gauge } from 'lucide-react';
import { ContentItem } from '../../../types';
import { StremioStream } from '../../core/stremio/stremioTypes';
import { canonicalIdentityService } from '../../core/identity/canonicalIdentity';
import { sourceConfidenceEngine, SourceConfidence } from '../../core/identity/sourceConfidenceEngine';
import { streamQuarantineService } from '../../core/security/streamQuarantineService';
import { providerRegistry } from '../../core/providers/providerRegistry';
import { playbackOptimizerService, PlaybackTelemetry, NetworkProfile, DeviceProfile } from '../../core/playback/PlaybackOptimizerService';

interface ZapiStreamDiagnosticsModalProps {
  item: ContentItem;
  streams: StremioStream[];
  selectedStreamIndex: number;
  season?: number;
  episode?: number;
  onClose: () => void;
}

export const ZapiStreamDiagnosticsModal: React.FC<ZapiStreamDiagnosticsModalProps> = ({
  item,
  streams,
  selectedStreamIndex,
  season,
  episode,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'streams' | 'quarantine' | 'telemetry'>('streams');
  const [cacheCleared, setCacheCleared] = useState(false);
  const [telemetry, setTelemetry] = useState<PlaybackTelemetry>(playbackOptimizerService.getTelemetry());
  const [netProfile, setNetProfile] = useState<NetworkProfile>(playbackOptimizerService.getNetworkProfile());
  const [devProfile, setDevProfile] = useState<DeviceProfile>(playbackOptimizerService.getDeviceProfile());

  useEffect(() => {
    const unsub = playbackOptimizerService.subscribeTelemetry((t) => {
      setTelemetry(t);
      setNetProfile(playbackOptimizerService.getNetworkProfile());
      setDevProfile(playbackOptimizerService.getDeviceProfile());
    });
    return () => unsub();
  }, []);

  const identity = canonicalIdentityService.buildIdentity(item, season && episode ? { season, episode } : null);
  const evaluations = sourceConfidenceEngine.evaluateBatch(streams, identity);
  const quarantineList = streamQuarantineService.getQuarantineList();

  const handleClearCache = () => {
    providerRegistry.clearCache();
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 2000);
  };

  const getConfidenceBadge = (conf: SourceConfidence) => {
    switch (conf) {
      case 'VERIFIED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">VERIFIED</span>;
      case 'PROVISIONAL':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">PROVISIONAL</span>;
      case 'SUSPICIOUS':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">SUSPICIOUS</span>;
      case 'REJECTED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">REJECTED</span>;
      case 'QUARANTINED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">QUARANTINED</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-[5000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#0c0e14] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-left font-sans text-xs">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[#007df7]" />
            <div>
              <h3 className="text-sm font-black text-white">Diagnóstico de Identidade & Fontes (Dev)</h3>
              <p className="text-[11px] text-gray-400">Auditoria canônica de segurança de conteúdo</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClearCache}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Limpar cache de streams e ranqueamento"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${cacheCleared ? 'text-emerald-400' : ''}`} />
              {cacheCleared ? 'Cache Limpo!' : 'Limpar Cache'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Canonical Identity Summary Banner */}
        <div className="p-4 bg-[#131722] border-b border-white/10 grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
          <div>
            <span className="text-gray-400 block font-bold">Título Canônico:</span>
            <span className="text-white font-bold">{identity.title}</span>
          </div>
          <div>
            <span className="text-gray-400 block font-bold">Ano / Tipo:</span>
            <span className="text-white">{identity.year} • {identity.type}</span>
          </div>
          <div>
            <span className="text-gray-400 block font-bold">IDs Oficiais:</span>
            <span className="text-gray-300 font-mono">TMDB: {identity.tmdbId || 'N/A'} • IMDb: {identity.imdbId || 'N/A'}</span>
          </div>
          <div>
            <span className="text-gray-400 block font-bold">Proteções Especiais:</span>
            <span className="flex items-center gap-1.5">
              {identity.isChildFriendly && <span className="px-1.5 py-0.5 bg-sky-500/20 text-sky-400 rounded text-[10px] font-bold">Infantil (Restrito)</span>}
              {identity.isTheatricalUnreleased && <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[10px] font-bold">Em Cartaz 2026</span>}
              {!identity.isChildFriendly && !identity.isTheatricalUnreleased && <span className="text-gray-400">Padrão Geral</span>}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 bg-black/40 px-4 pt-2 gap-4">
          <button
            onClick={() => setActiveTab('streams')}
            className={`pb-2.5 font-bold cursor-pointer transition-colors border-b-2 ${
              activeTab === 'streams' ? 'text-[#007df7] border-[#007df7]' : 'text-gray-400 border-transparent hover:text-white'
            }`}
          >
            Streams Avaliados ({evaluations.length})
          </button>
          <button
            onClick={() => setActiveTab('telemetry')}
            className={`pb-2.5 font-bold cursor-pointer transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'telemetry' ? 'text-emerald-400 border-emerald-400' : 'text-gray-400 border-transparent hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" /> Métricas & ABR
          </button>
          <button
            onClick={() => setActiveTab('quarantine')}
            className={`pb-2.5 font-bold cursor-pointer transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'quarantine' ? 'text-purple-400 border-purple-400' : 'text-gray-400 border-transparent hover:text-white'
            }`}
          >
            <Ban className="w-3.5 h-3.5" /> Quarentena Permanente ({quarantineList.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {activeTab === 'streams' && (
            <div className="space-y-3">
              {evaluations.length === 0 ? (
                <div className="py-12 text-center text-gray-500">
                  Nenhum stream retornado ou todas as fontes foram descartadas por segurança.
                </div>
              ) : (
                evaluations.map((ev, idx) => {
                  const isSelected = idx === selectedStreamIndex;
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-[#007df7]/10 border-[#007df7]/40 ring-1 ring-[#007df7]/30'
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-gray-400 font-bold">#{idx + 1}</span>
                          <span className="text-white font-bold text-xs">{ev.stream.title || ev.stream.name || 'Sem título'}</span>
                          {isSelected && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#007df7] text-white">
                              Ativo no Player
                            </span>
                          )}
                        </div>
                        <div>{getConfidenceBadge(ev.confidence)}</div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-gray-400 mb-2 font-mono">
                        <div>Provedor: <span className="text-gray-300">{ev.stream.providerName || 'Desconhecido'}</span></div>
                        <div>Áudio: <span className="text-gray-300">{(ev.stream as any)._audioTier || 'N/A'}</span></div>
                        <div>Legendas: <span className="text-gray-300">{(ev.stream as any)._subtitleFormat || 'N/A'}</span></div>
                        <div>Score: <span className="text-[#007df7] font-bold">{(ev.stream as any)._smartScore ?? 'N/A'}</span></div>
                      </div>

                      <div className="text-[11px] text-gray-300 bg-black/40 p-2 rounded-lg space-y-1">
                        <span className="text-gray-500 font-bold block text-[10px] uppercase tracking-wider">Evidências de Validação:</span>
                        {ev.reasons.map((r, rIdx) => (
                          <div key={rIdx} className="flex items-center gap-1.5 text-gray-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#007df7]" />
                            <span>{r}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'telemetry' && (
            <div className="space-y-4">
              {/* Header de Ações */}
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <div className="text-[11px] text-gray-400">
                  Métricas em tempo real coletadas pelo <strong className="text-white">PlaybackOptimizerService</strong>.
                </div>
                <button
                  onClick={() => playbackOptimizerService.resetTelemetry()}
                  className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[10px] font-bold transition-colors cursor-pointer"
                >
                  Zerar Contadores
                </button>
              </div>

              {/* Grid 1: Desempenho de Inicialização e Buffer */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* TTFF */}
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-gray-400 mb-1">
                    <span className="font-bold flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5 text-emerald-400" /> TTFF (Time to 1st Frame)
                    </span>
                    <span className="text-[10px] text-gray-500">Meta: &lt; 500ms</span>
                  </div>
                  <div className="text-2xl font-black font-mono text-white mt-1">
                    {telemetry.ttffMs !== null ? (
                      <span className={telemetry.ttffMs < 500 ? 'text-emerald-400' : telemetry.ttffMs < 1500 ? 'text-blue-400' : 'text-amber-400'}>
                        {telemetry.ttffMs} <span className="text-xs font-normal">ms</span>
                      </span>
                    ) : (
                      <span className="text-gray-500 text-base">Iniciando...</span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Tempo entre o clique no play e a renderização do primeiro frame visual.
                  </p>
                </div>

                {/* Buffer à frente */}
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-gray-400 mb-1">
                    <span className="font-bold flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-sky-400" /> Buffer à Frente
                    </span>
                    <span className="text-[10px] font-mono text-sky-400 font-bold">
                      {telemetry.bufferAheadSeconds.toFixed(1)}s
                    </span>
                  </div>
                  {/* Barra Gráfica de Buffer */}
                  <div className="w-full bg-black/60 rounded-full h-3 overflow-hidden border border-white/10 my-2">
                    <div
                      className={`h-full transition-all duration-300 ${
                        telemetry.bufferAheadSeconds < 3
                          ? 'bg-red-500'
                          : telemetry.bufferAheadSeconds < 10
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, (telemetry.bufferAheadSeconds / 30) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-gray-500 font-mono">
                    <span>0s (Crítico)</span>
                    <span>15s</span>
                    <span>30s (Ideal)</span>
                  </div>
                </div>

                {/* Bitrate & Resolução Atual */}
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-gray-400 mb-1">
                    <span className="font-bold flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-purple-400" /> Bitrate & Resolução
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#007df7]/20 text-[#007df7] uppercase">
                      ABR: {telemetry.activeAbrMode}
                    </span>
                  </div>
                  <div className="text-xl font-black font-mono text-white mt-1">
                    {telemetry.currentResolution.toUpperCase()}
                    {telemetry.currentBitrateKbps ? (
                      <span className="text-gray-400 text-xs font-normal ml-2">
                        @ {(telemetry.currentBitrateKbps / 1000).toFixed(1)} Mbps
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Tipo de Fonte: <strong className="text-gray-200 uppercase">{telemetry.streamSourceType}</strong>
                  </p>
                </div>
              </div>

              {/* Grid 2: Estabilidade e Resiliência Anti-Travamento */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-gray-400 block text-[10px] uppercase font-bold">Pausas p/ Buffer</span>
                  <span className="text-lg font-black font-mono text-white mt-0.5 block">
                    {telemetry.bufferingCount} <span className="text-xs text-gray-400 font-normal">vezes</span>
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {(telemetry.totalBufferingDurationMs / 1000).toFixed(1)}s total
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-gray-400 block text-[10px] uppercase font-bold">Stalls Recuperados</span>
                  <span className="text-lg font-black font-mono text-emerald-400 mt-0.5 block">
                    {telemetry.stallsRecovered}
                  </span>
                  <span className="text-[10px] text-gray-500">Recuperações automáticas</span>
                </div>

                <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-gray-400 block text-[10px] uppercase font-bold">Frames Perdidos</span>
                  <span className="text-lg font-black font-mono text-amber-400 mt-0.5 block">
                    {telemetry.droppedFrames}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {telemetry.totalFrames > 0
                      ? `${((telemetry.droppedFrames / telemetry.totalFrames) * 100).toFixed(2)}% drop rate`
                      : '0% drop rate'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-gray-400 block text-[10px] uppercase font-bold">Conexão Lenta?</span>
                  <span className="text-lg font-black mt-0.5 block">
                    {netProfile.isSlowConnection ? (
                      <span className="text-amber-400 text-sm font-bold">Sim (Otimizada)</span>
                    ) : (
                      <span className="text-emerald-400 text-sm font-bold">Não (Normal)</span>
                    )}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {netProfile.isUnstable ? 'Rede Instável' : 'Rede Estável'}
                  </span>
                </div>
              </div>

              {/* Grid 3: Diagnóstico de Rede & Dispositivo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Perfil de Rede */}
                <div className="p-3 rounded-xl bg-[#131722] border border-white/10 space-y-1.5">
                  <div className="flex items-center gap-2 text-white font-bold mb-1">
                    <Wifi className="w-4 h-4 text-[#007df7]" /> Perfil de Conexão Detectado
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span className="text-gray-400">Tipo de Rede Efetivo:</span>
                    <span className="font-mono font-bold text-white uppercase">{netProfile.effectiveType}</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span className="text-gray-400">Largura de Banda (Downlink):</span>
                    <span className="font-mono text-emerald-400 font-bold">{netProfile.downlinkMbps.toFixed(2)} Mbps</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span className="text-gray-400">Latência de Ida e Volta (RTT):</span>
                    <span className="font-mono text-white">{netProfile.rttMs} ms</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span className="text-gray-400">Modo Economia de Dados:</span>
                    <span className="font-mono text-white">{netProfile.saveData ? 'Ativado' : 'Desativado'}</span>
                  </div>
                </div>

                {/* Perfil do Dispositivo */}
                <div className="p-3 rounded-xl bg-[#131722] border border-white/10 space-y-1.5">
                  <div className="flex items-center gap-2 text-white font-bold mb-1">
                    <Cpu className="w-4 h-4 text-emerald-400" /> Perfil do Dispositivo & Hardware
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span className="text-gray-400">Categoria do Aparelho:</span>
                    <span className="font-mono font-bold text-white uppercase">{devProfile.deviceType}</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span className="text-gray-400">Hardware / Limitação:</span>
                    <span className="font-mono text-white">
                      {devProfile.isLowEnd ? 'Dispositivo Leve (Economia Ativa)' : 'Hardware Padrão / Alto'}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span className="text-gray-400">Limite de Buffer Seguro:</span>
                    <span className="font-mono text-sky-400 font-bold">{devProfile.memoryLimitMB} MB</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span className="text-gray-400">Qualidade Inicial Recomendada:</span>
                    <span className="font-mono text-emerald-400 font-bold">{devProfile.recommendedInitialQuality}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'quarantine' && (
            <div className="space-y-2">
              {quarantineList.map((q, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/20 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-purple-300 font-bold text-[11px]">{q.id}</span>
                    <span className="text-[10px] text-purple-400 uppercase font-bold">{q.type}</span>
                  </div>
                  <div className="text-gray-300 text-[11px]">{q.reason}</div>
                  <div className="text-[10px] text-gray-500">Isolado em: {new Date(q.quarantinedAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
