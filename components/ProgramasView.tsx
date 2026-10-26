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
  const [allChannels, setAllChannels] = useState<LiveChannel[]>(() => channelRegistry.getVerifiedChannels());
  const [activeChannel, setActiveChannel] = useState<LiveChannel>(() => {
    const all = channelRegistry.getVerifiedChannels();
    const last = all.find(c => c.id === preferences.lastWatchedChannelId);
    return last || all[0];
  });
  const [fullscreenChannel, setFullscreenChannel] = useState<LiveChannel | null>(null);

  // Escuta alterações de preferências (favoritos, modo, categoria)
  useEffect(() => {
    const unsub = liveTvPreferences.subscribe(setPreferences);
    return unsub;
  }, []);

  // Escuta alterações de canais do agregador de provedores (restringindo estritamente aos verificados)
  useEffect(() => {
    const unsub = liveTvProviderRegistry.subscribe(() => {
      const verified = channelRegistry.getVerifiedChannels();
      setAllChannels(verified);
      setActiveChannel(prev => {
        const found = verified.find(c => c.id === prev?.id);
        return found || verified[0];
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

  // Contagem dinâmica real de canais disponíveis (estritamente canais verificados e funcionais)
  const availableCount = useMemo(() => {
    return allChannels.length;
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

  // Assistir canal diretamente em tela cheia/player principal (100% interno na ZapiTV)
  const handleWatchChannel = (channel: LiveChannel) => {
    setActiveChannel(channel);
    liveTvPreferences.setLastWatched(channel.id);
    setFullscreenChannel(channel);
  };

  return (
    <div className="px-3 sm:px-6 md:px-12 py-6 sm:py-8 pb-32 max-w-[2560px] mx-auto">
      {/* ========================================================================= */}
      {/* CABEÇALHO OFICIAL COM LINHA DIVISÓRIA PADRÃO EM DESTAQUE                 */}
      {/* ========================================================================= */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 md:gap-7 pb-4 mb-6 sm:mb-8 md:mb-12 border-b ${isDarkMode ? 'border-white/10' : 'border-black/10'}`}>
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          <h2 className={`text-xl sm:text-2xl md:text-5xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Inter', sans-serif" }}>
            Programas
          </h2>
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
                const verified = channelRegistry.getVerifiedChannels();
                if (verified.length === 0) {
                  setFullscreenChannel(null);
                  return;
                }
                const idx = verified.findIndex(c => c.id === fullscreenChannel.id);
                const nextIdx = idx !== -1 ? (idx + 1) % verified.length : 0;
                const nextCh = verified[nextIdx];
                setFullscreenChannel(nextCh);
                setActiveChannel(nextCh);
              }}
              onPrevChannel={() => {
                const verified = channelRegistry.getVerifiedChannels();
                if (verified.length === 0) {
                  setFullscreenChannel(null);
                  return;
                }
                const idx = verified.findIndex(c => c.id === fullscreenChannel.id);
                const prevIdx = idx !== -1 ? (idx - 1 + verified.length) % verified.length : 0;
                const prevCh = verified[prevIdx];
                setFullscreenChannel(prevCh);
                setActiveChannel(prevCh);
              }}
              channelIndexInfo={{
                current: Math.max(1, channelRegistry.getVerifiedChannels().findIndex(c => c.id === fullscreenChannel.id) + 1),
                total: channelRegistry.getVerifiedChannels().length
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
