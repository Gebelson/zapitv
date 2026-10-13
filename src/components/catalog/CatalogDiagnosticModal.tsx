import React, { useState, useEffect } from 'react';
import { X, Search, RefreshCw, Activity, CheckCircle2, AlertTriangle, Clock, Database, Radio, Download } from 'lucide-react';
import { diagnosticService, CatalogDiagnosticReport, CanonicalTraceResult } from '../../core/catalog/DiagnosticService';
import { mediaAvailabilityIndex } from '../../core/catalog/MediaAvailabilityIndex';
import { catalogAvailabilityQueue } from '../../core/catalog/CatalogAvailabilityQueue';

interface CatalogDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
}

export const CatalogDiagnosticModal: React.FC<CatalogDiagnosticModalProps> = ({
  isOpen,
  onClose,
  isDarkMode
}) => {
  const [report, setReport] = useState<CatalogDiagnosticReport>(() => diagnosticService.getFullReport());
  const [searchQuery, setSearchQuery] = useState('');
  const [traceResult, setTraceResult] = useState<CanonicalTraceResult | null>(null);
  const [isTracing, setIsTracing] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setReport(diagnosticService.getFullReport());
    }, 2000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTrace = () => {
    if (!searchQuery.trim()) return;
    setIsTracing(true);
    try {
      const result = diagnosticService.traceItem(searchQuery.trim());
      setTraceResult(result);
    } catch (e) {
      console.warn('Erro ao rastrear item:', e);
    } finally {
      setIsTracing(false);
    }
  };

  const handleCleanNegativeCaches = () => {
    const cleaned = mediaAvailabilityIndex.cleanOldNegativeCaches();
    setNotification(`Limpeza concluída: ${cleaned} itens temporários ou expirados resetados para re-verificação.`);
    setReport(diagnosticService.getFullReport());
    setTimeout(() => setNotification(null), 4000);
  };

  const handleResumeQueue = () => {
    catalogAvailabilityQueue.resume();
    setNotification('Fila de disponibilidade em segundo plano acelerada com sucesso.');
    setReport(diagnosticService.getFullReport());
    setTimeout(() => setNotification(null), 4000);
  };

  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `zapitv-catalog-diagnostic-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const queueLength = catalogAvailabilityQueue.getQueueLength();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-5xl max-h-[90vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden transition-all ${
          isDarkMode ? 'bg-[#0f1117] border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-900'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-5 border-b ${isDarkMode ? 'border-gray-800/80 bg-gray-900/40' : 'border-gray-200 bg-gray-50'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-600/10 border border-orange-500/20 flex items-center justify-center text-orange-500">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
                Painel de Diagnóstico do Catálogo
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
                  Ao Vivo
                </span>
              </h2>
              <p className="text-xs opacity-60">Auditoria das Camadas A (Descoberta), B (Disponibilidade) e C (Reprodução)</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-600'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notificação Temporária */}
        {notification && (
          <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-6 py-2.5 text-xs text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notification}</span>
          </div>
        )}

        {/* Content Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Métricas Principais em Grade */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Descoberta */}
            <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center justify-between text-xs font-semibold opacity-70 mb-2">
                <span>Descoberta</span>
                <Database className="w-4 h-4 text-orange-500" />
              </div>
              <div className="text-2xl font-black text-orange-500">{report.discovery.totalDiscovered}</div>
              <div className="mt-2 text-[11px] opacity-60 space-y-0.5">
                <div>Filmes: <span className="font-bold">{report.discovery.moviesCount}</span></div>
                <div>Séries: <span className="font-bold">{report.discovery.seriesCount}</span></div>
                <div>Animes: <span className="font-bold">{report.discovery.animesCount}</span></div>
              </div>
            </div>

            {/* Disponibilidade */}
            <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center justify-between text-xs font-semibold opacity-70 mb-2">
                <span>Disponíveis</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-black text-emerald-500">{report.availability.availableCount}</div>
              <div className="mt-2 text-[11px] opacity-60 space-y-0.5">
                <div>Verificando: <span className="font-bold">{report.availability.checkingCount}</span></div>
                <div>Fila Pendente: <span className="font-bold">{queueLength}</span></div>
                <div>Total Indexado: <span className="font-bold">{report.availability.totalIndexed}</span></div>
              </div>
            </div>

            {/* Fontes & Áudio */}
            <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center justify-between text-xs font-semibold opacity-70 mb-2">
                <span>Fontes Válidas</span>
                <Radio className="w-4 h-4 text-cyan-500" />
              </div>
              <div className="text-2xl font-black text-cyan-500">{report.sources.totalValid}</div>
              <div className="mt-2 text-[11px] opacity-60 space-y-0.5">
                <div>Dublado PT-BR: <span className="font-bold text-emerald-400">{report.sources.dubbedPtBrCount}</span></div>
                <div>Áudio Original: <span className="font-bold text-blue-400">{report.sources.originalAudioCount}</span></div>
                <div>Total Coletado: <span className="font-bold">{report.sources.totalFound}</span></div>
              </div>
            </div>

            {/* Erros / Indisponíveis */}
            <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center justify-between text-xs font-semibold opacity-70 mb-2">
                <span>Rejeições & Falhas</span>
                <AlertTriangle className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-2xl font-black text-rose-500">{report.sources.totalRejected}</div>
              <div className="mt-2 text-[11px] opacity-60 space-y-0.5">
                <div>Sem Fonte (Conf): <span className="font-bold text-rose-400">{report.availability.unavailableConfirmedCount}</span></div>
                <div>Erro Temp (Rede): <span className="font-bold text-amber-400">{report.availability.temporaryErrorCount}</span></div>
                <div>Provedores Ativos: <span className="font-bold">{report.providers.length}</span></div>
              </div>
            </div>
          </div>

          {/* Ferramenta de Rastreamento Canônico (Tracer) */}
          <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-gray-900/30 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
            <h3 className="text-sm font-bold mb-1 flex items-center gap-2">
              <Search className="w-4 h-4 text-orange-500" />
              Rastreador Canônico de Títulos (Trace Item)
            </h3>
            <p className="text-xs opacity-60 mb-3">
              Investigue por que um título específico está ou não aparecendo no catálogo e quais regras de validação foram aplicadas.
            </p>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTrace()}
                  placeholder="Ex: tt1431045, Vingadores, Naruto, Shingeki no Kyojin..."
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border outline-none transition-all ${
                    isDarkMode 
                      ? 'bg-black/40 border-gray-800 focus:border-orange-500 text-white' 
                      : 'bg-white border-gray-300 focus:border-orange-500 text-gray-900'
                  }`}
                />
              </div>
              <button
                onClick={handleTrace}
                disabled={isTracing || !searchQuery.trim()}
                className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
              >
                {isTracing ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Rastrear'}
              </button>
            </div>

            {/* Resultado do Trace */}
            {traceResult && (
              <div className={`mt-4 p-4 rounded-xl border animate-in fade-in duration-200 ${isDarkMode ? 'bg-black/60 border-gray-800' : 'bg-white border-gray-200'}`}>
                <div className="flex items-start justify-between gap-4 border-b pb-3 mb-3 border-gray-800/40">
                  <div>
                    <h4 className="text-base font-black">{traceResult.query}</h4>
                    <span className="text-xs opacity-60 font-mono">Chave: {traceResult.canonicalKey}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                      traceResult.status === 'AVAILABLE' 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : traceResult.status === 'CHECKING' 
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
                        : traceResult.status === 'TEMPORARY_ERROR'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}>
                      {traceResult.status}
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      traceResult.isPlayable ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {traceResult.isPlayable ? 'Exibido no Catálogo' : 'Oculto até validação'}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-xs text-orange-200 mb-3">
                  <span className="font-bold">Diagnóstico:</span> {traceResult.explanation}
                </div>

                <div className="text-xs opacity-80 space-y-1">
                  <div><span className="font-bold">Recomendação:</span> {traceResult.recommendation}</div>
                  <div><span className="font-bold">Provedores Verificados:</span> {traceResult.providersChecked.join(', ') || 'Nenhum'}</div>
                </div>
              </div>
            )}
          </div>

          {/* Motivos de Rejeição de Fontes */}
          <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
            <h4 className="text-xs font-bold uppercase tracking-wider opacity-60 mb-3">Detalhamento de Fontes Rejeitadas</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/20 text-xs">
                <span className="opacity-80">Domínio Estacionado / Ad</span>
                <span className="font-bold text-rose-400 px-2 py-0.5 rounded-md bg-rose-500/10">{report.rejections.parkedOrAdDomain}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/20 text-xs">
                <span className="opacity-80">Mídia Não Lançada</span>
                <span className="font-bold text-rose-400 px-2 py-0.5 rounded-md bg-rose-500/10">{report.rejections.unreleasedMedia}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/20 text-xs">
                <span className="opacity-80">Incompatibilidade de Título</span>
                <span className="font-bold text-rose-400 px-2 py-0.5 rounded-md bg-rose-500/10">{report.rejections.identityMismatch}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/20 text-xs">
                <span className="opacity-80">CAM / Telesync</span>
                <span className="font-bold text-rose-400 px-2 py-0.5 rounded-md bg-rose-500/10">{report.rejections.camOrTelesync}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/20 text-xs">
                <span className="opacity-80">Formato Inválido</span>
                <span className="font-bold text-rose-400 px-2 py-0.5 rounded-md bg-rose-500/10">{report.rejections.invalidMediaFormat}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/20 text-xs">
                <span className="opacity-80">Outros</span>
                <span className="font-bold text-rose-400 px-2 py-0.5 rounded-md bg-rose-500/10">{report.rejections.other}</span>
              </div>
            </div>
          </div>

          {/* Métricas dos Provedores */}
          {report.providers.length > 0 && (
            <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
              <h4 className="text-xs font-bold uppercase tracking-wider opacity-60 mb-3">Saúde dos Provedores Conectados</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {report.providers.map(prov => (
                  <div key={prov.id} className="flex items-center justify-between p-2.5 rounded-xl bg-black/20 text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${prov.status === 'online' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <span className="font-semibold">{prov.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] opacity-70">
                      <span>Latência: {prov.averageLatencyMs}ms</span>
                      <span className={prov.errorCount > 0 ? 'text-amber-400' : ''}>Erros: {prov.errorCount}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer com Ações de Manutenção */}
        <div className={`flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t ${isDarkMode ? 'border-gray-800/80 bg-gray-900/40' : 'border-gray-200 bg-gray-50'}`}>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCleanNegativeCaches}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-2 ${
                isDarkMode ? 'border-gray-700 hover:bg-white/10 text-gray-300' : 'border-gray-300 hover:bg-gray-100 text-gray-700'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Limpar Caches Negativos Antigos
            </button>
            <button
              onClick={handleResumeQueue}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-2 ${
                isDarkMode ? 'border-gray-700 hover:bg-white/10 text-gray-300' : 'border-gray-300 hover:bg-gray-100 text-gray-700'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Acelerar Fila de Verificação
            </button>
          </div>

          <button
            onClick={handleExportJson}
            className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-colors flex items-center gap-2"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar Relatório JSON
          </button>
        </div>
      </div>
    </div>
  );
};
