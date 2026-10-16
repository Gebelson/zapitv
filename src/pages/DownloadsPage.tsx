import React, { useState, useEffect } from 'react';
import {
  DownloadCloud, HardDrive, Trash2, Play, CheckCircle2,
  AlertCircle, RefreshCw, Pause, ArrowRight, Film, Tv, Sparkles, Filter
} from 'lucide-react';
import { ContentItem, ContentType } from '../../types';
import { offlineDb } from '../core/offline/offlineDb';
import { offlineDownloadManager } from '../core/offline/offlineDownloadManager';
import { OfflineDownload, StorageEstimateResult } from '../core/offline/offlineTypes';
import { ZapiLoader } from '../components/common/ZapiLoader';

interface DownloadsPageProps {
  isDarkMode?: boolean;
  onPlayOffline?: (download: OfflineDownload) => void;
  onNavigateHome?: () => void;
}

export const DownloadsPage: React.FC<DownloadsPageProps> = ({
  isDarkMode = true,
  onPlayOffline,
  onNavigateHome
}) => {
  const [downloads, setDownloads] = useState<OfflineDownload[]>([]);
  const [storageEstimate, setStorageEstimate] = useState<StorageEstimateResult | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'movies' | 'series' | 'active'>('all');
  const [itemToDelete, setItemToDelete] = useState<OfflineDownload | null>(null);

  useEffect(() => {
    // Subscreve às atualizações reativas do banco de downloads
    const unsub = offlineDb.subscribe(setDownloads);
    offlineDownloadManager.getStorageEstimate().then(setStorageEstimate);

    const interval = setInterval(() => {
      offlineDownloadManager.getStorageEstimate().then(setStorageEstimate);
    }, 4000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${Math.round(mb)} MB`;
  };

  const formatSpeed = (bytesPerSec: number) => {
    if (!bytesPerSec || bytesPerSec <= 0) return '';
    const mbPerSec = bytesPerSec / (1024 * 1024);
    if (mbPerSec >= 1) {
      return `${mbPerSec.toFixed(1)} MB/s`;
    }
    return `${Math.round(bytesPerSec / 1024)} KB/s`;
  };

  // Filtragem de downloads por aba
  const activeDownloads = downloads.filter(d => d.status === 'downloading' || d.status === 'pending' || d.status === 'paused' || d.status === 'error');
  const completedDownloads = downloads.filter(d => d.status === 'completed');

  const filteredCompleted = completedDownloads.filter(d => {
    if (activeTab === 'movies') return d.type === ContentType.MOVIE;
    if (activeTab === 'series') return d.type === ContentType.SERIES || d.type === ContentType.ANIME;
    return true;
  });

  const handleDelete = async (download: OfflineDownload) => {
    await offlineDownloadManager.cancelDownload(download.id);
    setItemToDelete(null);
    offlineDownloadManager.getStorageEstimate().then(setStorageEstimate);
  };

  return (
    <div className="px-3 sm:px-6 md:px-12 py-6 sm:py-8 pb-32 max-w-[2560px] mx-auto">
      {/* Cabeçalho */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 md:gap-7 pb-4 mb-6 sm:mb-8 md:mb-12 border-b ${isDarkMode ? 'border-white/10' : 'border-black/10'}`}>
        <div>
          <h2 className={`text-xl sm:text-2xl md:text-5xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Downloads
          </h2>
        </div>
      </div>

      {/* Filtros por Categoria e Quadro de Armazenamento */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/5 pb-4 mb-8">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-[#007df7] text-white shadow-lg shadow-[#007df7]/25'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Todos ({completedDownloads.length})
          </button>
          <button
            onClick={() => setActiveTab('movies')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'movies'
                ? 'bg-[#007df7] text-white shadow-lg shadow-[#007df7]/25'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            Filmes ({completedDownloads.filter(d => d.type === ContentType.MOVIE).length})
          </button>
          <button
            onClick={() => setActiveTab('series')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'series'
                ? 'bg-[#007df7] text-white shadow-lg shadow-[#007df7]/25'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            Séries & Animes ({completedDownloads.filter(d => d.type === ContentType.SERIES || d.type === ContentType.ANIME).length})
          </button>
        </div>

        {/* Card de Armazenamento ZapiTV */}
        {storageEstimate && (
          <div className={`p-4 rounded-3xl border flex items-center gap-4 min-w-[280px] shadow-xl ${
            isDarkMode ? 'bg-[#0f121a] border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'
          }`}>
            <div className="w-12 h-12 rounded-2xl bg-[#007df7]/15 flex items-center justify-center text-[#007df7] shrink-0">
              <HardDrive className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                <span>Espaço Ocupado</span>
                <span className="font-mono text-[#007df7]">{formatBytes(storageEstimate.downloadsBytes)}</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-1">
                <div 
                  className="h-full bg-[#007df7] rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(0,125,247,0.8)]"
                  style={{ width: `${Math.max(2, Math.min(100, storageEstimate.usagePercent))}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-400 truncate">
                {formatBytes(storageEstimate.availableBytes)} disponíveis no dispositivo
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Seção de Downloads Ativos (Transferências em Andamento / Pausadas) */}
      {activeDownloads.length > 0 && (
        <div className="space-y-4 mb-8">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-[#007df7] animate-spin" />
            <h3 className={`text-sm font-black uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Transferências Ativas ({activeDownloads.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeDownloads.map((dl) => {
              const percent = dl.totalBytes > 0
                ? Math.min(100, Math.round((dl.downloadedBytes / dl.totalBytes) * 100))
                : 0;

              return (
                <div
                  key={dl.id}
                  className={`p-4 rounded-3xl border flex items-center gap-4 shadow-lg transition-all ${
                    isDarkMode ? 'bg-[#0f121a]/90 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'
                  }`}
                >
                  <img
                    src={dl.image}
                    alt={dl.title}
                    className="w-16 h-24 object-cover rounded-2xl bg-black shrink-0 shadow-md"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#007df7] block">
                      {dl.quality} • {dl.audioTrack.isDubbed ? 'Dublado' : 'Original'}
                    </span>
                    <h4 className="font-bold text-sm truncate">{dl.title}</h4>
                    {dl.episode && (
                      <p className="text-xs text-gray-400 truncate">
                        T{dl.season} • EP{dl.episode} {dl.episodeTitle ? `- ${dl.episodeTitle}` : ''}
                      </p>
                    )}

                    {/* Barra de Progresso */}
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden my-2">
                      <div
                        className={`h-full transition-all duration-300 ${
                          dl.status === 'paused' ? 'bg-amber-400' : dl.status === 'error' ? 'bg-red-500' : 'bg-[#007df7]'
                        }`}
                        style={{ width: `${Math.max(3, percent)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-gray-400">
                      <span>{formatBytes(dl.downloadedBytes)} de {dl.totalBytes > 0 ? formatBytes(dl.totalBytes) : 'calculando...'}</span>
                      <span className={`font-bold ${dl.status === 'error' ? 'text-red-400' : 'text-white'}`}>
                        {dl.status === 'paused' ? 'Pausado' : dl.status === 'error' ? (dl.errorReason || 'Erro na transferência') : `${percent}% ${formatSpeed(dl.speedBytesPerSec)}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    {dl.status === 'downloading' ? (
                      <button
                        onClick={() => offlineDownloadManager.pauseDownload(dl.id)}
                        className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                        title="Pausar"
                      >
                        <Pause className="w-4 h-4" />
                      </button>
                    ) : dl.status === 'error' ? (
                      <button
                        onClick={() => offlineDownloadManager.resumeDownload(dl.id)}
                        className="p-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors cursor-pointer"
                        title="Tentar Novamente"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => offlineDownloadManager.resumeDownload(dl.id)}
                        className="p-2.5 rounded-xl bg-[#007df7] hover:bg-[#006ee0] text-white transition-colors cursor-pointer"
                        title="Retomar"
                      >
                        <Play className="w-4 h-4 fill-current" />
                      </button>
                    )}
                    <button
                      onClick={() => setItemToDelete(dl)}
                      className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer"
                      title="Cancelar e Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lista de Downloads Concluídos */}
      {filteredCompleted.length === 0 && activeDownloads.length === 0 ? (
        <div className={`p-12 md:p-16 rounded-3xl border text-center flex flex-col items-center justify-center max-w-2xl mx-auto my-12 ${
          isDarkMode ? 'bg-white/[0.02] border-white/10' : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="w-16 h-16 rounded-full bg-[#007df7]/10 flex items-center justify-center text-[#007df7] mb-4">
            <DownloadCloud className="w-8 h-8" />
          </div>
          <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Nenhum conteúdo baixado ainda
          </h3>
          <p className="text-sm text-gray-400 max-w-md leading-relaxed mb-6">
            Navegue pelos detalhes de filmes, animes ou séries e clique em <span className="text-[#007df7] font-bold">"Baixar"</span> para salvar episódios no seu aparelho.
          </p>
          {onNavigateHome && (
            <button
              onClick={onNavigateHome}
              className="px-6 py-3 bg-[#007df7] hover:bg-[#006ee0] text-white font-bold rounded-2xl transition-all shadow-lg shadow-[#007df7]/30 flex items-center gap-2 cursor-pointer active:scale-95 text-xs sm:text-sm"
            >
              <span>Explorar Catálogo</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCompleted.map((item) => (
            <div
              key={item.id}
              className={`group p-3.5 rounded-3xl border flex flex-col justify-between transition-all hover:scale-[1.01] shadow-xl relative overflow-hidden ${
                isDarkMode ? 'bg-[#0f121a] border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'
              }`}
            >
              <div className="flex gap-3">
                <div className="relative w-20 h-28 sm:w-24 sm:h-36 rounded-2xl overflow-hidden bg-black shrink-0 shadow-md">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[9px] font-black uppercase text-[#007df7] border border-white/10">
                    {item.quality}
                  </div>
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                  <div>
                    <h4 className="font-bold text-sm sm:text-base leading-tight line-clamp-2 group-hover:text-[#007df7] transition-colors">
                      {item.title}
                    </h4>
                    {item.episode ? (
                      <span className="inline-block mt-1 text-[11px] font-black text-[#007df7] bg-[#007df7]/10 px-2 py-0.5 rounded-md border border-[#007df7]/20">
                        T{item.season} • EP{item.episode}
                      </span>
                    ) : (
                      <span className="inline-block mt-1 text-[11px] text-gray-400">
                        Filme Completo
                      </span>
                    )}
                    <p className="text-[11px] text-gray-400 mt-1">
                      {item.audioTrack.isDubbed ? '🇧🇷 Dublado PT-BR' : 'Áudio Original'}
                    </p>
                  </div>

                  <div className="text-[11px] font-mono text-gray-400 mt-2">
                    {formatBytes(item.totalBytes)}
                  </div>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => onPlayOffline?.(item)}
                  className="flex-1 py-2.5 px-3 bg-[#007df7] hover:bg-[#006ee0] text-white font-bold rounded-xl transition-all shadow-md shadow-[#007df7]/20 flex items-center justify-center gap-2 text-xs cursor-pointer active:scale-95"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Assistir</span>
                </button>
                <button
                  type="button"
                  onClick={() => setItemToDelete(item)}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors cursor-pointer border border-white/5"
                  title="Excluir arquivo offline"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[350] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-[#0f121a] border border-white/10 rounded-3xl p-6 shadow-2xl text-white text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black mb-2">Excluir Download?</h3>
            <p className="text-xs text-gray-400 leading-relaxed mb-6">
              O arquivo offline de <span className="text-white font-bold">{itemToDelete.title}</span> será removido permanentemente do seu dispositivo para liberar espaço.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-2.5 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDelete(itemToDelete)}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-red-600/30"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DownloadsPage;
