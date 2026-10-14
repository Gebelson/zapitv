import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  MonitorPlay, Tv, Search, Heart, Radio, X, Sparkles, Filter
} from 'lucide-react';
import { LiveChannel, LiveChannelCategory } from '../src/core/livetv/types';
import { channelRegistry, liveTvProviderRegistry } from '../src/core/livetv/channelRegistry';
import { channelHealthService } from '../src/core/livetv/channelHealthService';
import { liveTvPreferences } from '../src/core/livetv/liveTvPreferences';
import { ChannelGrid } from '../src/components/livetv/ChannelGrid';
import { TelevisionMode } from '../src/components/livetv/TelevisionMode';
import { LiveTvPlayer } from '../src/components/livetv/LiveTvPlayer';

interface ProgramasViewProps {
  isDarkMode: boolean;
  initialMode?: 'televisao' | 'programas';
}

const ProgramasView: React.FC<ProgramasViewProps> = ({ isDarkMode, initialMode }) => {
  const [preferences, setPreferences] = useState(() => {
    const base = liveTvPreferences.getState();
    if (initialMode && base.activeMode !== initialMode) {
      liveTvPreferences.setActiveMode(initialMode);
      return { ...base, activeMode: initialMode };
    }
    return base;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [allChannels, setAllChannels] = useState<LiveChannel[]>(() => channelRegistry.getAllChannels());
  const [activeChannel, setActiveChannel] = useState<LiveChannel>(() => {
    const all = channelRegistry.getAllChannels();
    const last = all.find(c => c.id === preferences.lastWatchedChannelId);
    return last || all[0];
  });
  const [fullscreenChannel, setFullscreenChannel] = useState<LiveChannel | null>(null);

  // Escuta alterações de preferências (favoritos, modo, categoria)
  useEffect(() => {
    const unsub = liveTvPreferences.subscribe(setPreferences);
    return unsub;
  }, []);

  // Escuta alterações de canais do agregador de provedores
  useEffect(() => {
    const unsub = liveTvProviderRegistry.subscribe((updated) => {
      setAllChannels(updated);
      setActiveChannel(prev => {
        const found = updated.find(c => c.id === prev?.id);
        return found || prev || updated[0];
      });
    });
    // Inicializa carregamento assíncrono dos provedores
    liveTvProviderRegistry.initialize().catch(() => {});
    return unsub;
  }, []);

  // Dispara verificação de saúde dos canais em segundo plano na montagem
  useEffect(() => {
    channelHealthService.verifyAllChannels().catch(() => {});
  }, []);

  // Previne rolagem do body quando o modal fullscreen estiver aberto
  useEffect(() => {
    if (fullscreenChannel) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [fullscreenChannel]);

  // Contagem dinâmica real de canais disponíveis
  const availableCount = useMemo(() => {
    return allChannels.filter(c => c.status === 'AVAILABLE').length;
  }, [allChannels]);

  // Filtra canais por categoria selecionada e busca
  const filteredChannels = useMemo(() => {
    let list = channelRegistry.getChannelsByCategory(preferences.selectedCategory, preferences.favoriteChannelIds);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(c => 
        c.name.toLowerCase().includes(q) ||
        c.categoryLabel.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
      );
    }

    return list;
  }, [allChannels, preferences.selectedCategory, preferences.favoriteChannelIds, searchQuery]);

  // Alterna Modo Televisão
  const toggleTelevisionMode = () => {
    const nextMode = preferences.activeMode === 'televisao' ? 'programas' : 'televisao';
    liveTvPreferences.setActiveMode(nextMode);
  };

  // Seleciona categoria
  const handleSelectCategory = (cat: LiveChannelCategory) => {
    liveTvPreferences.setSelectedCategory(cat);
  };

  // Seleciona canal (atualiza ativo e salva último assistido)
  const handleSelectChannel = (channel: LiveChannel) => {
    setActiveChannel(channel);
    liveTvPreferences.setLastWatched(channel.id);
  };

  // Assistir canal diretamente em tela cheia/player principal
  const handleWatchChannel = (channel: LiveChannel) => {
    setActiveChannel(channel);
    liveTvPreferences.setLastWatched(channel.id);

    if (channel.requiresExternalAccess && channel.externalAccessUrl) {
      window.open(channel.externalAccessUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    setFullscreenChannel(channel);
  };

  return (
    <div className="px-4 md:px-12 py-8 pb-32 animate-in fade-in duration-500 font-sans">
      {/* ========================================================================= */}
      {/* CABEÇALHO OFICIAL COM BOTÃO "TELEVISÃO" E CONTAGEM REAL VALIDADA         */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 md:mb-12">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-orange-600/15 border border-orange-600/30 text-orange-500 flex items-center justify-center shrink-0 shadow-lg shadow-orange-600/10">
              <MonitorPlay className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-white">
                  Programas ao Vivo
                </h2>

                {/* Botão Oficial "Televisão" alinhado verticalmente com o título */}
                <button
                  onClick={toggleTelevisionMode}
                  className={`flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all duration-300 shadow-xl cursor-pointer ${
                    preferences.activeMode === 'televisao'
                      ? 'bg-[#007df7] text-white shadow-[#007df7]/40 ring-2 ring-white/20 scale-105'
                      : 'bg-white/10 hover:bg-white/20 text-white border border-white/15 hover:border-white/30 hover:scale-105'
                  }`}
                  title="Ativar/Desativar Modo Televisão Interativo"
                >
                  <Tv className="w-4 h-4 text-white" />
                  <span>Televisão</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Barra de Busca de Canais e Programas ao Vivo */}
        <div className="relative w-full md:w-80 shrink-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar canal ou programa..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-white text-xs sm:text-sm placeholder-gray-500 outline-none focus:border-[#007df7] focus:bg-white/10 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CORPO PRINCIPAL: MODO TELEVISÃO OU MODO PROGRAMAS                         */}
      {/* ========================================================================= */}
      {preferences.activeMode === 'televisao' ? (
        <TelevisionMode
          channels={filteredChannels.length > 0 ? filteredChannels : allChannels}
          activeChannel={activeChannel}
          onSelectChannel={handleSelectChannel}
          onExitTelevisionMode={() => liveTvPreferences.setActiveMode('programas')}
          isDarkMode={isDarkMode}
        />
      ) : (
        <ChannelGrid
          channels={filteredChannels}
          selectedCategory={preferences.selectedCategory}
          onSelectCategory={handleSelectCategory}
          selectedChannelId={activeChannel.id}
          onSelectChannel={handleSelectChannel}
          onWatchNow={handleWatchChannel}
          isDarkMode={isDarkMode}
          searchQuery={searchQuery}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL DO PLAYER NATIVO EM TELA CHEIA (ASSISTIR AO CANAL)                   */}
      {/* ========================================================================= */}
      {fullscreenChannel && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in p-2 sm:p-6 md:p-10 select-none">
          <div className="relative aspect-video w-full max-w-6xl bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/20">
            <LiveTvPlayer
              key={fullscreenChannel.id}
              channel={fullscreenChannel}
              autoPlay={true}
              initialMuted={false}
              isInteractive={true}
              onClose={() => setFullscreenChannel(null)}
              onNextChannel={() => {
                const idx = allChannels.findIndex(c => c.id === fullscreenChannel.id);
                if (idx !== -1) {
                  const nextCh = allChannels[(idx + 1) % allChannels.length];
                  setFullscreenChannel(nextCh);
                  setActiveChannel(nextCh);
                }
              }}
              onPrevChannel={() => {
                const idx = allChannels.findIndex(c => c.id === fullscreenChannel.id);
                if (idx !== -1) {
                  const prevCh = allChannels[(idx - 1 + allChannels.length) % allChannels.length];
                  setFullscreenChannel(prevCh);
                  setActiveChannel(prevCh);
                }
              }}
              channelIndexInfo={{
                current: allChannels.findIndex(c => c.id === fullscreenChannel.id) + 1,
                total: allChannels.length
              }}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ProgramasView;
