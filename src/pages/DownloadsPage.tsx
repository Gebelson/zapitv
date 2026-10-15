import React, { useState, useEffect } from 'react';
import { DownloadCloud, HardDrive, Trash2, Play, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { ContentItem } from '../../types';

interface DownloadsPageProps {
  isDarkMode?: boolean;
  onSelectItem?: (item: ContentItem) => void;
}

export const DownloadsPage: React.FC<DownloadsPageProps> = ({ isDarkMode = true, onSelectItem }) => {
  const [storageEstimate, setStorageEstimate] = useState<{ usedMb: number; quotaMb: number }>({ usedMb: 0, quotaMb: 0 });
  const [downloadedItems, setDownloadedItems] = useState<any[]>([]);

  useEffect(() => {
    // Estimativa de armazenamento do navegador via Storage API
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      navigator.storage.estimate().then(({ usage, quota }) => {
        setStorageEstimate({
          usedMb: Math.round((usage || 0) / (1024 * 1024)),
          quotaMb: Math.round((quota || 0) / (1024 * 1024))
        });
      }).catch(() => {});
    }
  }, []);

  return (
    <div className="px-4 md:px-12 py-8 pb-32 space-y-8 animate-in fade-in duration-500">
      {/* Cabeçalho */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b ${isDarkMode ? 'border-white/10' : 'border-black/10'}`}>
        <div>
          <h2 className={`text-xl sm:text-2xl md:text-5xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Meus Downloads
          </h2>
        </div>

        {/* Status de Armazenamento Offline */}
        <div className={`flex items-center gap-3 p-3.5 rounded-2xl border ${
          isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-100 border-gray-200'
        }`}>
          <HardDrive className="w-5 h-5 text-[#007df7]" />
          <div className="text-xs">
            <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Armazenamento ZapiTV
            </p>
            <p className="text-gray-400 font-mono">
              {storageEstimate.usedMb} MB utilizados de {storageEstimate.quotaMb > 0 ? `${Math.round(storageEstimate.quotaMb / 1024)} GB` : 'disponível'}
            </p>
          </div>
        </div>
      </div>

      {/* Conteúdo de Downloads */}
      {downloadedItems.length === 0 ? (
        <div className={`p-12 md:p-16 rounded-3xl border text-center flex flex-col items-center justify-center max-w-2xl mx-auto my-12 ${
          isDarkMode ? 'bg-white/[0.02] border-white/10' : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="w-16 h-16 rounded-full bg-[#007df7]/10 flex items-center justify-center text-[#007df7] mb-4">
            <DownloadCloud className="w-8 h-8" />
          </div>
          <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Nenhum download ativo no momento
          </h3>
          <p className="text-sm text-gray-400 max-w-md leading-relaxed mb-6">
            Quando você baixa episódios ou filmes para assistir em viagens ou sem internet, eles aparecem salvos aqui com acesso instantâneo.
          </p>
          <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
            <CheckCircle2 className="w-4 h-4" />
            <span>Sistema PWA Offline e Cache em Alta Performance pronto para uso</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {downloadedItems.map((item) => (
            <div key={item.id} className="p-4 rounded-2xl border bg-white/5 border-white/10 flex items-center justify-between">
              <span>{item.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DownloadsPage;
