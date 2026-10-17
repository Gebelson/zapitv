import React, { useState, useEffect, useRef } from 'react';
import { Download, CheckCircle2, RefreshCw, AlertCircle, Pause, Play } from 'lucide-react';
import { ContentItem, ContentType } from '../../../types';
import { StremioStream } from '../../core/stremio/stremioTypes';
import { offlineDb } from '../../core/offline/offlineDb';
import { offlineDownloadManager } from '../../core/offline/offlineDownloadManager';
import { offlineSourceInspector } from '../../core/offline/offlineSourceInspector';
import { sourceVerificationService } from '../../core/providers/sourceVerificationService';
import { subtitleService, parseSRT } from '../../core/subtitles/subtitleService';
import { validateSubtitleContentMatch } from '../../core/subtitles/subtitleLanguageDetector';
import { DownloadQualityModal } from './DownloadQualityModal';
import { DownloadQualityOption, OfflineDownload, OfflineSubtitleTrack } from '../../core/offline/offlineTypes';
import { helperClient } from '../../core/offline/helperClient';

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
  const inspectedStreamsRef = useRef<StremioStream[]>([]);
  const inspectionControllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => inspectionControllerRef.current?.abort(), []);

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
    inspectionControllerRef.current?.abort();
    const controller = new AbortController();
    inspectionControllerRef.current = controller;
    try {
      // As fontes recebidas pelo modal podem pertencer ao episódio em pré-carregamento.
      // Para séries, a resolução sempre precisa usar a temporada e o episódio deste botão.
      let candidateStreams = season !== undefined && episode !== undefined
        ? []
        : (Array.isArray(streams) ? [...streams] : []);

      // Usa a mesma resolução canônica e segunda verificação do player online.
      // Os streams recebidos para filmes já podem vir do prefetch do modal.
      let discoveryReason: string | undefined;
      if (candidateStreams.length === 0) {
        const epParams = (season !== undefined && episode !== undefined) ? { season, episode } : undefined;
        try {
          const result = await sourceVerificationService.verifySources(item, epParams, { signal: controller.signal });
          candidateStreams = result.streams;
          if (result.state === 'INCONCLUSIVE') discoveryReason = 'A busca de fontes falhou temporariamente. Tente novamente.';
        } catch (err) {
          discoveryReason = 'A busca de fontes falhou temporariamente. Tente novamente.';
        }
      }

      if (controller.signal.aborted) return;

      // 2. Se ainda estiver vazio, verifica se há verifiedStreams no próprio item
      if (candidateStreams.length === 0 && season === undefined && item.verifiedStreams && item.verifiedStreams.length > 0) {
        candidateStreams = [...item.verifiedStreams];
      }

      inspectedStreamsRef.current = candidateStreams;

      const durationMins = parseInt(String(item.duration || '').replace(/\D/g, ''), 10) || 90;
      const diagnosis = await offlineSourceInspector.inspectDownloadOptionsDetailed({
        item,
        streams: candidateStreams,
        skipDiscovery: true,
        season,
        episode,
        preferredLanguage: 'pt-BR',
        durationMinutes: durationMins
      });

      if (controller.signal.aborted) return;
      const options = [...diagnosis.options];
      if (await helperClient.connected()) {
        const existing = new Set(options.map(option => option.sourceUrl));
        for (const stream of candidateStreams) {
          if (!stream.offlineAllowed || !stream.url || existing.has(stream.url) || stream.behaviorHints?.proxyHeaders?.request || stream.behaviorHints?.headers) continue;
          let parsed: URL;
          try { parsed = new URL(stream.url); } catch { continue; }
          if (!['http:', 'https:'].includes(parsed.protocol) || !/\.(mp4|webm)$/i.test(parsed.pathname)) continue;
          const format = parsed.pathname.toLowerCase().endsWith('.webm') ? 'webm' : 'mp4';
          const declaredQuality = String(stream.quality || '').match(/(?:2160|1440|1080|720|480|360)p/i)?.[0] || 'Original';
          options.push({ quality: declaredQuality, estimatedBytes: 0, sourceUrl: stream.url, sourceType: format, isDubbed: Boolean(stream.isDubbed), audioLanguage: stream.isPtBr ? 'pt-BR' : 'original', isAuthorized: true, method: 'helper' });
          existing.add(stream.url);
        }
      }
      setDownloadOptions(options);
      setUnavailableReason(candidateStreams.length === 0 ? discoveryReason || diagnosis.reason : options.length ? undefined : diagnosis.reason);
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

  const handleConfirmDownload = async (option: DownloadQualityOption): Promise<boolean> => {
    try {
      if (option.method === 'helper') {
        await helperClient.start({ itemId: item.id, title: item.title, type: item.type, season, episode, quality: option.quality, format: option.sourceType === 'webm' ? 'webm' : 'mp4', url: option.sourceUrl, offlineAllowed: true });
        return true;
      }
      let fileHandle: FileSystemFileHandle | undefined;
      const savePicker = (window as Window & {
        showSaveFilePicker?: (options: { suggestedName: string; types: Array<{ description: string; accept: Record<string, string[]> }> }) => Promise<FileSystemFileHandle>;
      }).showSaveFilePicker;
      if (savePicker) {
        const extension = option.sourceType === 'webm' ? 'webm' : 'mp4';
        const episodeSuffix = season !== undefined && episode !== undefined ? ` - T${season}E${episode}` : '';
        const suggestedName = `${item.title}${episodeSuffix} - ${option.quality}`.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim().slice(0, 120) + `.${extension}`;
        try {
          fileHandle = await savePicker.call(window, {
            suggestedName,
            types: [{ description: `Vídeo ${extension.toUpperCase()}`, accept: { [`video/${extension}`]: [`.${extension}`] } }]
          });
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return false;
          throw error;
        }
      }
      const baseStream = inspectedStreamsRef.current.find(s => s.url === option.sourceUrl);
      const matchedStream: StremioStream = {
        ...(baseStream || {}),
        name: baseStream?.name || `ZapiTV Stream (${option.quality})`,
        title: baseStream?.title || `${item.title} - ${option.quality}`,
        url: option.sourceUrl,
        sourceType: option.sourceType,
        quality: option.quality as StremioStream['quality'],
        isDubbed: option.isDubbed,
        isPtBr: option.audioLanguage === 'pt-BR',
        offlineAllowed: option.isAuthorized
      };

      // Salva apenas legendas com falas reais; uma faixa vazia não funciona offline.
      let offlineSubtitles: OfflineSubtitleTrack[] = [];
      try {
        const tracks = await Promise.race([
          subtitleService.fetchSubtitles(item, season, episode, matchedStream),
          new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 1200))
        ]);
        if (tracks && tracks.length > 0) {
          const candidates = await Promise.all(tracks.slice(0, 3).map(async (t: any) => {
            if (!t.url) return null;
            try {
              const data = await Promise.race([
                subtitleService.fetchAndDecodeSRT(t.url, t.lang),
                new Promise<string>((resolve) => setTimeout(() => resolve(''), 1200))
              ]);
              const cues = parseSRT(data);
              if (cues.length === 0 || !validateSubtitleContentMatch(cues, t.lang).isValid) return null;
              return { id: t.id, languageName: t.label || t.lang,
                languageCode: t.lang, isPtBr: Boolean(t.isPtBr),
                format: 'vtt' as const, cues };
            } catch { return null; }
          }));
          offlineSubtitles = candidates.filter(track => track !== null) as OfflineSubtitleTrack[];
        }
      } catch {}

      console.log('[DownloadButton] Iniciando download no OfflineDownloadManager para:', item.title, option.quality);
      await offlineDownloadManager.startDownload({
        item,
        selectedStream: matchedStream,
        season,
        episode,
        episodeTitle,
        subtitles: offlineSubtitles,
        fileHandle
      });
      console.log('[DownloadButton] Download enfileirado com sucesso!');
      return true;
    } catch (err: any) {
      alert(err.message || 'Não foi possível iniciar o download.');
      return false;
    }
  };

  const handleImportFile = async (file: File): Promise<boolean> => {
    try {
      await offlineDownloadManager.importLocalFile(file, {
        itemId: item.id,
        title: item.title,
        type: item.type,
        season,
        episode
      });
      return true;
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Não foi possível importar o arquivo.');
      return false;
    }
  };
  const canImportHere = item.mediaFormat === 'movie' || item.type === ContentType.MOVIE || (season !== undefined && episode !== undefined);

  const status = downloadRecord?.status;
  const progressPercent = downloadRecord && downloadRecord.totalBytes > 0
    ? Math.min(downloadRecord.status === 'completed' ? 100 : 99, Math.round((downloadRecord.downloadedBytes / downloadRecord.totalBytes) * 100))
    : 0;

  // 1. Variante Ícone Circular (usado na lista de episódios)
  if (variant === 'icon' || variant === 'compact') {
    return (
      <>
        <button
          type="button"
          onClick={handleOpenModal}
          disabled={isInspecting}
          aria-label={status === 'completed' ? 'Download concluído' : isInspecting ? 'Verificando download' : 'Baixar este episódio para assistir offline'}
          aria-busy={isInspecting}
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
          onImport={canImportHere ? handleImportFile : undefined}
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
        onImport={canImportHere ? handleImportFile : undefined}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
};
