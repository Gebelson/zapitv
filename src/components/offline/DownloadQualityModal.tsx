import React, { useState, useEffect } from 'react';
import { X, Download, HardDrive, AlertCircle, Check, Sparkles } from 'lucide-react';
import { DownloadQualityOption, StorageEstimateResult } from '../../core/offline/offlineTypes';
import { offlineDownloadManager } from '../../core/offline/offlineDownloadManager';

interface DownloadQualityModalProps {
  isOpen: boolean;
  title: string;
  episodeInfo?: string;
  options: DownloadQualityOption[];
  unavailableReason?: string;
  onConfirm: (option: DownloadQualityOption) => void;
  onClose: () => void;
}

export const DownloadQualityModal: React.FC<DownloadQualityModalProps> = ({
  isOpen,
  title,
  episodeInfo,
  options,
  unavailableReason,
  onConfirm,
  onClose
}) => {
  const [selectedQuality, setSelectedQuality] = useState<string>(() => options[0]?.quality || '720p');
  const [storageEstimate, setStorageEstimate] = useState<StorageEstimateResult | null>(null);

  useEffect(() => {
    if (isOpen) {
      offlineDownloadManager.getStorageEstimate().then(setStorageEstimate);
      if (options.length > 0) {
        // Seleciona a mais alta disponível por padrão
        const defaultOpt = options.find(o => o.quality === '1080p') || options.find(o => o.quality === '720p') || options[0];
        setSelectedQuality(defaultOpt.quality);
      }
    }
  }, [isOpen, options]);

  if (!isOpen) return null;

  const currentOption = options.find(o => o.quality === selectedQuality) || options[0];

  const formatBytes = (bytes: number) => {
    if (!bytes) return 'Tamanho dinâmico';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${Math.round(mb)} MB`;
  };

  const hasEnoughSpace = !storageEstimate || storageEstimate.availableBytes > (currentOption?.estimatedBytes || 0);

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-[#0f121a] border border-white/10 rounded-3xl p-6 shadow-2xl text-white relative animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-[#007df7] block mb-1">
              Download Offline ZapiTV
            </span>
            <h3 className="text-lg font-black line-clamp-1">{title}</h3>
            {episodeInfo && (
              <p className="text-xs text-gray-400 mt-0.5">{episodeInfo}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Seleção de Qualidade Real ou Mensagem de Motivo */}
        {options.length === 0 ? (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-3 mb-6">
            <AlertCircle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <p className="font-bold text-amber-200 mb-1">Download offline indisponível no momento</p>
              <p className="text-gray-300 leading-relaxed text-[11px]">
                {unavailableReason || 'As fontes disponíveis para este conteúdo não permitem gravação local direta no navegador ou exigem streaming online.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2 mb-6">
            <label className="text-xs font-bold text-gray-400 block mb-1">
              Selecione a qualidade real disponível:
            </label>
            <div className={`grid gap-2 ${options.length === 1 ? 'grid-cols-1' : (options.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}`}>
              {options.map((opt) => {
                const isSelected = opt.quality === selectedQuality;
                return (
                  <button
                    key={opt.quality}
                    type="button"
                    onClick={() => setSelectedQuality(opt.quality)}
                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#007df7] border-[#007df7] text-white shadow-lg shadow-[#007df7]/25 scale-[1.02]'
                        : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                    <span className="block text-sm font-black">{opt.quality}</span>
                    <span className="block text-[10px] opacity-75 mt-0.5 font-mono">
                      {formatBytes(opt.estimatedBytes)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Detalhes de Áudio e Idioma */}
        {currentOption && (
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2 mb-6 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Áudio do Download:</span>
              <span className="font-bold text-white flex items-center gap-1.5">
                {currentOption.isDubbed ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Dublado (Português - Brasil)
                  </span>
                ) : (
                  <span className="text-gray-300">Áudio Original</span>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Espaço Estimado:</span>
              <span className="font-bold text-white font-mono">
                {formatBytes(currentOption.estimatedBytes)}
              </span>
            </div>
          </div>
        )}

        {/* Verificação de Armazenamento do Dispositivo */}
        {storageEstimate && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1.5">
              <span className="flex items-center gap-1">
                <HardDrive className="w-3.5 h-3.5 text-[#007df7]" />
                Espaço livre no dispositivo
              </span>
              <span className="font-mono font-bold text-gray-300">
                {formatBytes(storageEstimate.availableBytes)} livres
              </span>
            </div>
            {!hasEnoughSpace && (
              <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Espaço em disco insuficiente para este download.</span>
              </div>
            )}
          </div>
        )}

        {/* Ações */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 bg-white/10 hover:bg-white/15 text-white font-bold rounded-2xl transition-all cursor-pointer text-xs"
          >
            {options.length === 0 ? 'Fechar' : 'Cancelar'}
          </button>
          <button
            type="button"
            disabled={!hasEnoughSpace || !currentOption || options.length === 0}
            onClick={() => {
              if (currentOption) {
                onConfirm(currentOption);
                onClose();
              }
            }}
            className={`flex-1 py-3 font-bold rounded-2xl transition-all flex items-center justify-center gap-2 text-xs shadow-lg ${
              !hasEnoughSpace || !currentOption || options.length === 0
                ? 'opacity-40 cursor-not-allowed bg-gray-700 text-gray-400'
                : 'bg-[#007df7] hover:bg-[#006ee0] text-white shadow-[#007df7]/30 cursor-pointer active:scale-95'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Confirmar e Baixar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
