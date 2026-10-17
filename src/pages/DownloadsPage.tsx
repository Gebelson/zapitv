import React, { useState, useEffect } from 'react';
import {
  DownloadCloud, HardDrive, Trash2, Play, CheckCircle2,
  AlertCircle, RefreshCw, Pause, ArrowRight, Film, Tv, Sparkles, Filter, FolderDown, Upload
} from 'lucide-react';
import { ContentItem, ContentType } from '../../types';
import { offlineDb } from '../core/offline/offlineDb';
import { offlineDownloadManager } from '../core/offline/offlineDownloadManager';
import { offlineStorageDriver } from '../core/offline/offlineStorageDriver';
import { OfflineDownload, StorageEstimateResult } from '../core/offline/offlineTypes';
import { ZapiLoader } from '../components/common/ZapiLoader';
import { helperClient, HelperJob } from '../core/offline/helperClient';

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
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importTitle, setImportTitle] = useState('');
  const [importType, setImportType] = useState<ContentType>(ContentType.MOVIE);
  const [importSeason, setImportSeason] = useState(1);
  const [importEpisode, setImportEpisode] = useState(1);
  const [importError, setImportError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [helperRunning, setHelperRunning] = useState(false);
  const [helperConnected, setHelperConnected] = useState(false);
  const [helperCode, setHelperCode] = useState('');
  const [helperError, setHelperError] = useState('');
  const [helperJobs, setHelperJobs] = useState<HelperJob[]>([]);
  const [helperLibrary, setHelperLibrary] = useState<HelperJob[]>([]);
  const [helperVideo, setHelperVideo] = useState<string | null>(null);

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

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const running = await helperClient.probe();
      const connected = running && await helperClient.connected();
      if (!alive) return;
      setHelperRunning(running);
      setHelperConnected(connected);
      if (connected) {
        try {
          const [jobs, library] = await Promise.all([helperClient.jobs(), helperClient.library()]);
          if (alive) { setHelperJobs(jobs); setHelperLibrary(library); }
        } catch (error) { if (alive) setHelperError(error instanceof Error ? error.message : 'Falha no Helper.'); }
      }
    };
    void refresh();
    const timer = helperConnected ? setInterval(refresh, 4000) : null;
    return () => { alive = false; if (timer) clearInterval(timer); };
  }, [helperConnected]);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
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
  const visibleHelperLibrary = helperLibrary.filter(entry => activeTab === 'all' || (activeTab === 'movies' && entry.type === ContentType.MOVIE) || (activeTab === 'series' && (entry.type === ContentType.SERIES || entry.type === ContentType.ANIME)));

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

  const handleImport = async () => {
    if (!importFile || isImporting) return;
    setIsImporting(true);
    setImportError('');
    try {
      await offlineDownloadManager.importLocalFile(importFile, {
        title: importTitle, type: importType, season: importSeason, episode: importEpisode
      });
      setImportFile(null);
      offlineDownloadManager.getStorageEstimate().then(setStorageEstimate);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Não foi possível importar o arquivo.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleSaveFile = async (download: OfflineDownload) => {
    try {
      const fileName = `${download.title}${download.episode ? ` - T${download.season}E${download.episode}` : ''}.${download.format}`
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '').slice(0, 140);
      const savePicker = (window as Window & {
        showSaveFilePicker?: (options: { suggestedName: string }) => Promise<FileSystemFileHandle>;
      }).showSaveFilePicker;
      if (savePicker) {
        const handle = await savePicker.call(window, { suggestedName: fileName });
        const file = await offlineStorageDriver.getFile(download.storagePath, download.storageDriver, download.fileHandle, true);
        const writable = await handle.createWritable();
        await file.stream().pipeTo(writable);
      } else {
        const file = await offlineStorageDriver.getFile(download.storagePath, download.storageDriver, download.fileHandle, true);
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      alert(error instanceof Error ? error.message : 'Não foi possível salvar o arquivo.');
    }
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
        <label className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#007df7] text-white text-xs font-bold cursor-pointer hover:bg-[#006ee0] transition-colors">
          <Upload className="w-4 h-4" /> Importar arquivo
          <input type="file" accept="video/mp4,video/webm,.mp4,.webm" className="sr-only" onChange={event => {
            const file = event.target.files?.[0];
            if (file) {
              setImportFile(file);
              setImportTitle(file.name.replace(/\.(mp4|webm)$/i, '').trim());
              setImportError('');
            }
            event.target.value = '';
          }} />
        </label>
      </div>

      <section className={`mb-6 rounded-3xl border p-4 ${isDarkMode ? 'border-white/10 bg-[#0f121a] text-white' : 'border-gray-200 bg-white text-gray-900'}`} aria-label="ZapiTV Helper">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-bold">ZapiTV Helper <span className="text-xs font-normal text-gray-400">{helperConnected ? 'conectado' : helperRunning ? 'aguardando pareamento' : 'não encontrado'}</span></h3>
            <p className="text-xs text-gray-400 mt-1">Downloads locais autorizados ficam no seu computador. O Helper é opcional.</p>
          </div>
          {!helperRunning && <div className="flex gap-2"><a href="/downloads/zapitv-helper-windows.zip" download className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/15">Baixar Helper para Windows</a><button type="button" onClick={async () => setHelperRunning(await helperClient.probe())} className="rounded-xl bg-white/10 px-3 py-2 text-xs">Verificar novamente</button></div>}
          {helperConnected && <button type="button" onClick={async () => { await helperClient.disconnect(); setHelperConnected(false); setHelperJobs([]); setHelperLibrary([]); }} className="rounded-xl bg-white/10 px-3 py-2 text-xs">Desconectar</button>}
        </div>
        {helperRunning && !helperConnected && <form className="mt-3 flex gap-2 flex-wrap" onSubmit={async event => {
          event.preventDefault(); setHelperError('');
          try { await helperClient.pair(helperCode.trim()); setHelperConnected(true); setHelperCode(''); }
          catch (error) { setHelperError(error instanceof Error ? error.message : 'Não foi possível conectar.'); }
        }}>
          <input aria-label="Código mostrado pelo ZapiTV Helper" inputMode="numeric" maxLength={6} value={helperCode} onChange={event => setHelperCode(event.target.value.replace(/\D/g, ''))} placeholder="Código no Helper" className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm" />
          <button type="submit" disabled={helperCode.length !== 6} className="rounded-xl bg-[#007df7] px-4 py-2 text-xs font-bold disabled:opacity-40">Conectar</button>
        </form>}
        {helperError && <p role="alert" className="mt-2 text-xs text-red-400">{helperError}</p>}
        {helperConnected && <div className="mt-4 space-y-2">
          {helperJobs.filter(job => job.status !== 'completed' && job.status !== 'cancelled').map(job => <div key={job.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/5 p-3 text-xs">
            <div className="min-w-0"><p className="font-bold truncate">{job.title}{job.episode ? ` · T${job.season}E${job.episode}` : ''}</p><p className="text-gray-400">{job.status} · {formatBytes(job.bytes)}{job.total ? ` / ${formatBytes(job.total)}` : ''}{job.error ? ` · ${job.error}` : ''}</p></div>
            <div className="flex gap-2 shrink-0">{job.status === 'downloading' && <button onClick={() => helperClient.action(job.id, 'pause')} aria-label="Pausar">Pausar</button>}{['paused', 'error'].includes(job.status) && <button onClick={() => helperClient.action(job.id, 'resume')} aria-label="Retomar">Retomar</button>}<button onClick={() => helperClient.cancel(job.id)} aria-label="Cancelar">Cancelar</button></div>
          </div>)}
          {visibleHelperLibrary.map(entry => <div key={entry.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/5 p-3 text-xs"><span className="truncate">{entry.title}{entry.episode ? ` · T${entry.season}E${entry.episode}` : ''} · {entry.quality}</span><button type="button" className="font-bold text-[#007df7]" onClick={async () => { try { setHelperVideo(await helperClient.mediaUrl(entry.id)); } catch (error) { setHelperError(error instanceof Error ? error.message : 'Arquivo indisponível.'); } }}>Assistir offline</button></div>)}
        </div>}
      </section>
      {helperVideo && <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/95 p-4" role="dialog" aria-modal="true" aria-label="Reprodução offline"><button type="button" onClick={() => setHelperVideo(null)} className="absolute right-5 top-5 text-white">Fechar</button><video src={helperVideo} controls autoPlay className="max-h-full max-w-full" /></div>}

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
            Todos ({completedDownloads.length + helperLibrary.length})
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
            Filmes ({completedDownloads.filter(d => d.type === ContentType.MOVIE).length + helperLibrary.filter(d => d.type === ContentType.MOVIE).length})
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
            Séries & Animes ({completedDownloads.filter(d => d.type === ContentType.SERIES || d.type === ContentType.ANIME).length + helperLibrary.filter(d => d.type === ContentType.SERIES || d.type === ContentType.ANIME).length})
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
                ? Math.min(99, Math.round((dl.downloadedBytes / dl.totalBytes) * 100))
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
                    {dl.status === 'downloading' && dl.sourceUrl ? (
                      <button
                        onClick={() => offlineDownloadManager.pauseDownload(dl.id)}
                        className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                        title="Pausar"
                      >
                        <Pause className="w-4 h-4" />
                      </button>
                    ) : dl.status === 'downloading' ? null : dl.status === 'error' && dl.sourceUrl ? (
                      <button
                        onClick={() => offlineDownloadManager.resumeDownload(dl.id)}
                        className="p-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors cursor-pointer"
                        title="Tentar Novamente"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    ) : dl.sourceUrl ? (
                      <button
                        onClick={() => offlineDownloadManager.resumeDownload(dl.id)}
                        className="p-2.5 rounded-xl bg-[#007df7] hover:bg-[#006ee0] text-white transition-colors cursor-pointer"
                        title="Retomar"
                      >
                        <Play className="w-4 h-4 fill-current" />
                      </button>
                    ) : null}
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
      {filteredCompleted.length === 0 && activeDownloads.length === 0 && visibleHelperLibrary.length === 0 ? (
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
                  {item.image ? <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  /> : <div className="w-full h-full flex items-center justify-center text-[#007df7]"><Film className="w-10 h-10" /></div>}
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
                      {item.audioTrack.language === 'und' ? 'Áudio não identificado' : item.audioTrack.isDubbed ? '🇧🇷 Dublado PT-BR' : 'Áudio Original'}
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
                <button type="button" onClick={() => handleSaveFile(item)}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer border border-white/5"
                  title="Salvar arquivo no dispositivo" aria-label="Salvar arquivo no dispositivo">
                  <FolderDown className="w-4 h-4" />
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
              {itemToDelete.storageDriver === 'file' ? 'O registro será removido do ZapiTV. O arquivo salvo na sua pasta permanecerá no dispositivo.' : <>O arquivo offline de <span className="text-white font-bold">{itemToDelete.title}</span> será removido permanentemente do armazenamento do ZapiTV.</>}
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

      {importFile && (
        <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-label="Importar arquivo local" className="w-full max-w-md bg-[#0f121a] border border-white/10 rounded-3xl p-6 text-white shadow-2xl space-y-4">
            <h3 className="text-lg font-black">Importar para a biblioteca local</h3>
            <p className="text-xs text-gray-400 truncate">{importFile.name}</p>
            <label className="block text-xs font-bold">Título
              <input value={importTitle} onChange={event => setImportTitle(event.target.value)} className="mt-1 w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white" />
            </label>
            <label className="block text-xs font-bold">Tipo
              <select value={importType} onChange={event => setImportType(event.target.value as ContentType)} className="mt-1 w-full p-2.5 rounded-xl bg-[#171a22] border border-white/10 text-white">
                <option value={ContentType.MOVIE}>Filme</option><option value={ContentType.SERIES}>Série</option><option value={ContentType.ANIME}>Anime</option>
              </select>
            </label>
            {importType !== ContentType.MOVIE && <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-bold">Temporada<input type="number" min="1" value={importSeason} onChange={event => setImportSeason(Number(event.target.value))} className="mt-1 w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white" /></label>
              <label className="text-xs font-bold">Episódio<input type="number" min="1" value={importEpisode} onChange={event => setImportEpisode(Number(event.target.value))} className="mt-1 w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white" /></label>
            </div>}
            <p className="text-[11px] text-gray-400">Confirme os dados. O ZapiTV não associa arquivos a obras apenas pelo nome.</p>
            {importError && <p role="alert" className="text-xs text-red-400">{importError}</p>}
            <div className="flex gap-3">
              <button type="button" disabled={isImporting} onClick={() => setImportFile(null)} className="flex-1 py-2.5 rounded-xl bg-white/10 text-xs font-bold">Cancelar</button>
              <button type="button" disabled={isImporting || !importTitle.trim()} onClick={handleImport} className="flex-1 py-2.5 rounded-xl bg-[#007df7] disabled:opacity-40 text-xs font-bold">{isImporting ? 'Importando...' : 'Importar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DownloadsPage;
