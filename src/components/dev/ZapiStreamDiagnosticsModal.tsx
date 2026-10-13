/**
 * ZapiTV — Ferramenta Interna de Diagnóstico de Streams (Ambiente de Desenvolvimento)
 * Permite auditar a identidade canônica, fontes consultadas, nível de confiança (5 tiers),
 * motivos de seleção/rejeição e quarentena de segurança.
 */

import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, X, RefreshCw, CheckCircle2, Ban } from 'lucide-react';
import { ContentItem } from '../../../types';
import { StremioStream } from '../../core/stremio/stremioTypes';
import { canonicalIdentityService } from '../../core/identity/canonicalIdentity';
import { sourceConfidenceEngine, SourceConfidence } from '../../core/identity/sourceConfidenceEngine';
import { streamQuarantineService } from '../../core/security/streamQuarantineService';
import { providerRegistry } from '../../core/providers/providerRegistry';

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
  const [activeTab, setActiveTab] = useState<'streams' | 'quarantine'>('streams');
  const [cacheCleared, setCacheCleared] = useState(false);

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
