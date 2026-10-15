import React, { useState, useEffect, useCallback } from 'react';
import { History, Trash2, Play, Clock, Sparkles } from 'lucide-react';
import { storageService, WatchProgress } from '../core/storage/storageService';
import { ContentItem } from '../../types';

interface HistoryPageProps {
  isDarkMode?: boolean;
  onSelectItem: (item: ContentItem) => void;
  allContent: ContentItem[];
}

export const HistoryPage: React.FC<HistoryPageProps> = ({ isDarkMode = true, onSelectItem, allContent }) => {
  const [historyList, setHistoryList] = useState<WatchProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    try {
      const items = await storageService.getContinueWatching();
      setHistoryList(items);
    } catch {
      setHistoryList([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
    const handleUpdate = () => loadHistory();
    window.addEventListener('zapitv_progress_updated', handleUpdate);
    return () => window.removeEventListener('zapitv_progress_updated', handleUpdate);
  }, [loadHistory]);

  const handleClearHistory = async () => {
    if (window.confirm('Deseja realmente limpar todo o histórico de visualização?')) {
      await storageService.clearAllProgress();
      setHistoryList([]);
      window.dispatchEvent(new CustomEvent('zapitv_progress_updated'));
    }
  };

  const handleItemClick = (progress: WatchProgress) => {
    const found = allContent.find(c => c.id === progress.contentId || c.imdbId === progress.contentId || c.tmdbId === progress.contentId);
    if (found) {
      onSelectItem(found);
    } else if (progress.item) {
      onSelectItem(progress.item);
    } else {
      // Cria representação mínima se o item original não estiver no cache imediato
      const fallbackItem: ContentItem = {
        id: progress.contentId,
        title: progress.item?.title || 'Conteúdo ZapiTV',
        type: (progress.item?.type || 'FILME') as any,
        image: progress.item?.image || '',
        backdrop: progress.item?.backdrop,
        rating: 8.0,
        year: 2024,
      };
      onSelectItem(fallbackItem);
    }
  };

  return (
    <div className="px-4 md:px-12 py-8 pb-32 space-y-8 animate-in fade-in duration-500">
      {/* Cabeçalho */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b ${isDarkMode ? 'border-white/10' : 'border-black/10'}`}>
        <div>
          <h2 className={`text-xl sm:text-2xl md:text-5xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Histórico de Visualização
          </h2>
        </div>

        {historyList.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition-all self-start md:self-auto"
          >
            <Trash2 className="w-4 h-4" />
            <span>Limpar Histórico</span>
          </button>
        )}
      </div>

      {/* Lista do Histórico */}
      {historyList.length === 0 ? (
        <div className={`p-12 md:p-16 rounded-3xl border text-center flex flex-col items-center justify-center max-w-2xl mx-auto my-12 ${
          isDarkMode ? 'bg-white/[0.02] border-white/10' : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-4">
            <Clock className="w-8 h-8" />
          </div>
          <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Nenhum histórico recente
          </h3>
          <p className="text-sm text-gray-400 max-w-md leading-relaxed">
            Assim que você começar a assistir a qualquer filme, série ou anime no ZapiTV, seu progresso será salvo automaticamente nesta página.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
          {historyList.map((progress) => {
            const item = progress.item;
            const percent = Math.min(100, Math.round((progress.currentTime / Math.max(1, progress.duration)) * 100));
            const imgSrc = item?.backdrop || item?.image || '';
            const title = item?.title || 'Conteúdo ZapiTV';

            return (
              <div
                key={progress.contentId}
                onClick={() => handleItemClick(progress)}
                className={`group relative rounded-2xl overflow-hidden border cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl ${
                  isDarkMode ? 'bg-[#151C26] border-white/10 hover:border-indigo-500/50' : 'bg-white border-gray-200'
                }`}
              >
                {/* Poster / Backdrop */}
                <div className="aspect-[16/10] relative bg-black/40 overflow-hidden">
                  {imgSrc ? (
                    <img
                      src={imgSrc}
                      alt={title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-900/40 to-black flex items-center justify-center text-gray-500">
                      <Sparkles className="w-8 h-8" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                  
                  {/* Botão Play overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-12 rounded-full bg-orange-600 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                      <Play className="w-6 h-6 fill-white ml-0.5" />
                    </div>
                  </div>

                  {/* Barra de Progresso */}
                  <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/20">
                    <div 
                      className="h-full bg-orange-500 rounded-r-full"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                {/* Detalhes */}
                <div className="p-3.5 space-y-1">
                  <h4 className={`text-sm font-bold truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {title}
                  </h4>
                  <div className="flex items-center justify-between text-[11px] text-gray-400 font-medium">
                    {progress.season && progress.episode ? (
                      <span className="text-orange-400 font-bold">
                        T{progress.season} • EP{progress.episode}
                      </span>
                    ) : (
                      <span>Filme</span>
                    )}
                    <span>{percent}% assistido</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
