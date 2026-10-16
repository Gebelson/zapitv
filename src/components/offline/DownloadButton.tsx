import React, { useState, useEffect } from 'react';
import { Download, CheckCircle2, RefreshCw, AlertCircle, Pause, Play } from 'lucide-react';
import { ContentItem, ContentType } from '../../../types';
import { StremioStream } from '../../core/stremio/stremioTypes';
import { offlineDb } from '../../core/offline/offlineDb';
import { offlineDownloadManager } from '../../core/offline/offlineDownloadManager';
import { offlineSourceInspector } from '../../core/offline/offlineSourceInspector';
import { providerRegistry } from '../../core/providers/providerRegistry';
import { subtitleService } from '../../core/subtitles/subtitleService';
import { DownloadQualityModal } from './DownloadQualityModal';
import { DownloadQualityOption, OfflineDownload, OfflineSubtitleTrack } from '../../core/offline/offlineTypes';

interface DownloadButtonProps {
  item: ContentItem;
  streams: StremioStream[];
  season?: number;
  episode?: number;
  episodeTitle?: string;
  variant?: 'full' | 'icon' | 'compact';
  className?: string;
}

export const DownloadButton: React.FC<DownloadButtonProps> = ({
  item,
  streams,
  season,
  episode,
  episodeTitle,
  variant = 'full',
  className = ''
}) => {
  const [downloadRecord, setDownloadRecord] = useState<OfflineDownload | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [downloadOptions, setDownloadOptions] = useState<DownloadQualityOption[]>([]);
  const [unavailableReason, setUnavailableReason] = useState<string | undefined>();
  const [isInspecting, setIsInspecting] = useState(false);

  // Monitora o estado do download para este item e episódio
  useEffect(() => {
    return offlineDb.subscribe((downloads) => {
      const match = downloads.find(d => 
        d.itemId === item.id &&
        (season === undefined || d.season === season) &&
        (episode === undefined || d.episode === episode)
      );
      setDownloadRecord(match || null);
    });
  }, [item.id, season, episode]);

  const handleOpenModal = async () => {
    if (downloadRecord?.status === 'completed') return;
    if (downloadRecord?.status === 'downloading') {
      await offlineDownloadManager.pauseDownload(downloadRecord.id);
      return;
    }
    if (downloadRecord?.status === 'paused' || downloadRecord?.status === 'error') {
      await offlineDownloadManager.resumeDownload(downloadRecord.id);
      return;
    }

    setIsInspecting(true);
    try {
      let candidateStreams = Array.isArray(streams) ? [...streams] : [];

      // 1. Se candidateStreams estiver vazio, consulta dinamicamente o providerRegistry
      if (candidateStreams.length === 0) {
        const isMovie = item.mediaFormat === 'movie' || item.type === ContentType.MOVIE;
        const targetType = isMovie ? 'movie' : (item.type === ContentType.ANIME ? 'anime' : 'series');
        const epParams = (season !== undefined && episode !== undefined) ? { season, episode } : undefined;
        try {
          candidateStreams = await providerRegistry.resolveStreams(
            targetType,
            {
              tmdbId: item.tmdbId,
              imdbId: item.imdbId,
              id: item.id,
              title: item.title,
              originalTitle: item.originalTitle,
              year: item.year
            },
            epParams
          );
        } catch (err) {
          console.warn('[DownloadButton] Falha ao consultar fontes no providerRegistry:', err);
        }
      }

      // 2. Se ainda estiver vazio, verifica se há verifiedStreams no próprio item
      if (candidateStreams.length === 0 && item.verifiedStreams && item.verifiedStreams.length > 0) {
        candidateStreams = [...item.verifiedStreams];
      }

      const durationMins = parseInt(String(item.duration || '').replace(/\D/g, ''), 10) || 90;
      const diagnosis = await offlineSourceInspector.inspectDownloadOptionsDetailed({
        item,
        streams: candidateStreams,
        season,
        episode,
        preferredLanguage: 'pt-BR',
        durationMinutes: durationMins
      });

      setDownloadOptions(diagnosis.options);
      setUnavailableReason(diagnosis.reason);
      setIsModalOpen(true);
    } catch (e: any) {
      console.warn('[DownloadButton] Erro ao inspecionar opções:', e);
      setDownloadOptions([]);
      setUnavailableReason('Ocorreu um erro ao verificar as fontes de download para este título.');
      setIsModalOpen(true);
    } finally {
      setIsInspecting(false);
    }
  };

  const handleConfirmDownload = async (option: DownloadQualityOption) => {
    try {
      const baseStream = streams?.find(s => s.url === option.sourceUrl);
      const matchedStream: StremioStream = {
        ...(baseStream || {}),
        name: baseStream?.name || `ZapiTV Stream (${option.quality})`,
        title: baseStream?.title || `${item.title} - ${option.quality}`,
        url: option.sourceUrl,
        sourceType: option.sourceType,
        quality: option.quality,
        isDubbed: option.isDubbed,
        isPtBr: option.isDubbed
      };

      // Tenta obter legendas disponíveis para salvar offline (máx 800ms para iniciar download imediatamente)
      let offlineSubtitles: OfflineSubtitleTrack[] = [];
      try {
        const tracks = await Promise.race([
          subtitleService.fetchSubtitles(item, season, episode, matchedStream),
          new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 800))
        ]);
        if (tracks && tracks.length > 0) {
          offlineSubtitles = tracks.slice(0, 3).map((t: any) => ({
            id: t.id,
            languageName: t.label || t.lang,
            languageCode: t.lang,
            isPtBr: Boolean(t.isPtBr),
            format: 'vtt' as const,
            cues: []
          }));
        }
      } catch {}

      console.log('[DownloadButton] Iniciando download no OfflineDownloadManager para:', item.title, option.quality);
      await offlineDownloadManager.startDownload({
        item,
        selectedStream: matchedStream,
        season,
        episode,
        episodeTitle,
        subtitles: offlineSubtitles
      });
      console.log('[DownloadButton] Download enfileirado com sucesso!');
    } catch (err: any) {
      alert(err.message || 'Não foi possível iniciar o download.');
    }
  };

  const status = downloadRecord?.status;
  const progressPercent = downloadRecord && downloadRecord.totalBytes > 0
    ? Math.min(100, Math.round((downloadRecord.downloadedBytes / downloadRecord.totalBytes) * 100))
    : 0;

  // 1. Variante Ícone Circular (usado na lista de episódios)
  if (variant === 'icon' || variant === 'compact') {
    return (
      <>
        <button
          type="button"
          onClick={handleOpenModal}
          disabled={isInspecting}
          className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
            status === 'completed'
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
              : status === 'downloading'
              ? 'bg-[#007df7]/20 border-[#007df7]/40 text-[#007df7]'
              : status === 'paused'
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
              : status === 'error'
              ? 'bg-red-500/20 border-red-500/40 text-red-400'
              : 'bg-white/5 border-white/10 text-gray-300 hover:text-white hover:bg-white/15 hover:border-white/20'
          }`}
          title={
            status === 'completed'
              ? 'Download concluído'
              : status === 'downloading'
              ? `Baixando (${progressPercent}%) - Clique para pausar`
              : status === 'paused'
              ? 'Pausado - Clique para retomar'
              : status === 'error'
              ? 'Erro na transferência - Clique para tentar novamente'
              : 'Baixar para assistir offline'
          }
        >
          {isInspecting ? (
            <RefreshCw className="w-4 h-4 animate-spin text-[#007df7]" />
          ) : status === 'completed' ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : status === 'downloading' ? (
            <span className="text-[10px] font-mono font-black">{progressPercent}%</span>
          ) : status === 'paused' ? (
            <Play className="w-4 h-4 fill-current" />
          ) : status === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-400" />
          ) : (
            <Download className="w-4 h-4" />
          )}
        </button>

        <DownloadQualityModal
          isOpen={isModalOpen}
          title={item.title}
          episodeInfo={episode ? `Temporada ${season} • Episódio ${episode}${episodeTitle ? `: ${episodeTitle}` : ''}` : undefined}
          options={downloadOptions}
          unavailableReason={unavailableReason}
          onConfirm={handleConfirmDownload}
          onClose={() => setIsModalOpen(false)}
        />
      </>
    );
  }

  // 2. Variante Completa (usada no topo do modal de detalhes ao lado de "Assistir")
  return (
    <>
      <button
        type="button"
        onClick={handleOpenModal}
        disabled={isInspecting}
        className={`h-11 sm:h-12 px-4 sm:px-5 rounded-xl sm:rounded-2xl font-bold transition-all flex items-center justify-center gap-2 text-xs sm:text-sm md:text-base shadow-lg select-none cursor-pointer ${
          status === 'completed'
            ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
            : status === 'downloading'
            ? 'bg-[#007df7]/20 border border-[#007df7]/40 text-[#007df7]'
            : status === 'paused'
            ? 'bg-amber-500/20 border border-amber-500/30 text-amber-400'
            : status === 'error'
            ? 'bg-red-500/20 border border-red-500/30 text-red-400'
            : 'bg-white/10 hover:bg-white/15 text-white border border-white/10 hover:scale-105 active:scale-95'
        } ${className}`}
      >
        {isInspecting ? (
          <>
            <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-[#007df7]" />
            <span>Verificando...</span>
          </>
        ) : status === 'completed' ? (
          <>
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
            <span>Baixado</span>
          </>
        ) : status === 'downloading' ? (
          <>
            <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-[#007df7]" />
            <span>Baixando {progressPercent}%</span>
          </>
        ) : status === 'paused' ? (
          <>
            <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current text-amber-400" />
            <span>Retomar Download</span>
          </>
        ) : status === 'error' ? (
          <>
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
            <span>Tentar Novamente</span>
          </>
        ) : (
          <>
            <Download className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            <span>Baixar</span>
          </>
        )}
      </button>

      <DownloadQualityModal
        isOpen={isModalOpen}
        title={item.title}
        episodeInfo={episode ? `Temporada ${season} • Episódio ${episode}${episodeTitle ? `: ${episodeTitle}` : ''}` : undefined}
        options={downloadOptions}
        unavailableReason={unavailableReason}
        onConfirm={handleConfirmDownload}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
};
