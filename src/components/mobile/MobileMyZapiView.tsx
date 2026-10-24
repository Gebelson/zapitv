import React, { useState, useEffect } from 'react';
import { 
  UserRound, List, Heart, History, Users, Settings, 
  HelpCircle, Activity, Volume2, VolumeX, Sun, Moon, 
  LogOut, ChevronRight, MessageSquarePlus 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { User, Profile, ContentItem } from '../../../types';
import { MobileContentRow } from './MobileContentRow';
import { storageService } from '../../core/storage/storageService';
import { uiSoundService } from '../../core/audio/uiSoundService';
import { catalogEligibilityService } from '../../core/catalog/CatalogEligibilityService';
import { deduplicateContentItems } from '../../core/catalog/catalogDeduplication';

interface MobileMyZapiViewProps {
  currentUser: User;
  activeProfile: Profile | null;
  allContent: ContentItem[];
  myList: string[];
  favorites: string[];
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  onLogout: () => void;
  onSwitchProfile: () => void;
  onOpenDiagnostics?: () => void;
  onSelectContent: (item: ContentItem) => void;
}

export const MobileMyZapiView: React.FC<MobileMyZapiViewProps> = ({
  currentUser,
  activeProfile,
  allContent,
  myList,
  favorites,
  isDarkMode,
  setIsDarkMode,
  onLogout,
  onSwitchProfile,
  onOpenDiagnostics,
  onSelectContent
}) => {
  const navigate = useNavigate();
  const [continueWatchingItems, setContinueWatchingItems] = useState<ContentItem[]>([]);
  const [soundsEnabled, setSoundsEnabled] = useState(() => uiSoundService.getPreferences().enabled);

  useEffect(() => {
    return uiSoundService.subscribe(() => {
      setSoundsEnabled(uiSoundService.getPreferences().enabled);
    });
  }, []);

  useEffect(() => {
    let isMounted = true;
    storageService.getContinueWatching().then(progressList => {
      if (!isMounted) return;
      const inProgress = progressList
        .filter(p => p.percentage < 95 && p.currentTime > 5)
        .map(p => p.item)
        .filter(item => item && item.id);
      setContinueWatchingItems(deduplicateContentItems(catalogEligibilityService.filterEligibleItemsSync(inProgress)));
    }).catch(() => {});

    return () => { isMounted = false; };
  }, []);

  const handleToggleSound = () => {
    const next = !soundsEnabled;
    uiSoundService.updatePreferences({ enabled: next });
    if (next) uiSoundService.prime();
  };

  // Itens da Minha Lista
  const myListItems = allContent.filter(item => myList.includes(item.id));
  // Itens Favoritos
  const favoriteItems = allContent.filter(item => favorites.includes(item.id));

  return (
    <div data-testid="mobile-my-zapitv" className="pt-16 pb-28 px-4 max-w-lg mx-auto select-none">
      {/* 1. Card de Identidade do Perfil */}
      <div className="p-4 rounded-3xl bg-gradient-to-r from-white/10 to-white/5 border border-white/10 shadow-xl mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="relative">
            <img
              src={activeProfile?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120'}
              alt={activeProfile?.name || 'Perfil'}
              className="w-14 h-14 rounded-2xl object-cover ring-2 ring-[#007df7] shadow-md"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120';
              }}
            />
            {activeProfile?.isChild && (
              <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md bg-amber-500 text-[8px] font-black text-black">
                KIDS
              </span>
            )}
          </div>
          <div>
            <h2 className="text-lg font-black text-white leading-tight">
              {activeProfile?.name || currentUser.name}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{currentUser.email}</p>
            <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#007df7]/20 text-[#007df7] border border-[#007df7]/30">
              Plano {currentUser.plan || 'Premium'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            uiSoundService.play('click');
            onSwitchProfile();
          }}
          className="px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-bold active:bg-white/20 transition-all cursor-pointer"
        >
          Trocar
        </button>
      </div>

      {/* 2. Continuar Assistindo na Minha ZapiTV */}
      {continueWatchingItems.length > 0 && (
        <MobileContentRow
          title="Continuar Assistindo"
          subtitle="Em andamento"
          items={continueWatchingItems}
          onItemClick={onSelectContent}
          showProgress={true}
        />
      )}

      {/* 3. Minha Lista */}
      {myListItems.length > 0 && (
        <MobileContentRow
          title="Minha Lista"
          subtitle={`${myListItems.length} salvos para assistir`}
          items={myListItems}
          onItemClick={onSelectContent}
        />
      )}

      {/* 4. Favoritos */}
      {favoriteItems.length > 0 && (
        <MobileContentRow
          title="Meus Favoritos"
          subtitle={`${favoriteItems.length} produções curtidas`}
          items={favoriteItems}
          onItemClick={onSelectContent}
        />
      )}

      {/* 5. Ações Rápidas & Configurações Agrupadas */}
      <div className="mt-6 space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-2 mb-2">
          Preferências e Sistema
        </h3>

        {/* Gerenciar Perfis */}
        <button
          type="button"
          onClick={() => {
            uiSoundService.play('click');
            navigate('/perfil-selector');
          }}
          className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 active:scale-[0.99] transition-all cursor-pointer text-left"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/5 text-slate-300">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-xs text-white">Gerenciar Perfis</p>
              <p className="text-[10px] text-slate-400">Adicionar, editar e trocar de perfil</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>

        {/* Sons da Interface */}
        <div className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/5 text-slate-300">
              {soundsEnabled ? <Volume2 className="w-4 h-4 text-[#007df7]" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </div>
            <div>
              <p className="font-semibold text-xs text-white">Sons da Interface</p>
              <p className="text-[10px] text-slate-400">Efeitos sonoros ao tocar e navegar</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggleSound}
            aria-label="Alternar sons da interface"
            className={`w-11 h-6 rounded-full transition-colors p-0.5 flex items-center cursor-pointer ${
              soundsEnabled ? 'bg-[#007df7] justify-end' : 'bg-white/20 justify-start'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white shadow-md" />
          </button>
        </div>

        {/* Tema Escuro / Claro */}
        <div className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/5 text-slate-300">
              {isDarkMode ? <Moon className="w-4 h-4 text-amber-300" /> : <Sun className="w-4 h-4 text-amber-500" />}
            </div>
            <div>
              <p className="font-semibold text-xs text-white">Tema Escuro</p>
              <p className="text-[10px] text-slate-400">{isDarkMode ? 'Modo escuro ativo' : 'Modo claro ativo'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              uiSoundService.play('click');
              setIsDarkMode(!isDarkMode);
            }}
            aria-label="Alternar tema"
            className={`w-11 h-6 rounded-full transition-colors p-0.5 flex items-center cursor-pointer ${
              isDarkMode ? 'bg-[#007df7] justify-end' : 'bg-white/20 justify-start'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white shadow-md" />
          </button>
        </div>

        {/* Diagnóstico do Catálogo */}
        <button
          type="button"
          onClick={() => {
            uiSoundService.play('click');
            if (onOpenDiagnostics) onOpenDiagnostics();
          }}
          className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 active:scale-[0.99] transition-all cursor-pointer text-left"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/5 text-slate-300">
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="font-semibold text-xs text-white">Diagnóstico do Catálogo</p>
              <p className="text-[10px] text-slate-400">Verificar integridade e fontes ativas</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>

        {/* Central de Ajuda */}
        <button
          type="button"
          onClick={() => {
            uiSoundService.play('click');
            navigate('/ajuda');
          }}
          className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 active:scale-[0.99] transition-all cursor-pointer text-left"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/5 text-slate-300">
              <HelpCircle className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <p className="font-semibold text-xs text-white">Central de Ajuda</p>
              <p className="text-[10px] text-slate-400">Dúvidas frequentes e suporte</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>

        {/* Sair da ZapiTV */}
        <button
          type="button"
          onClick={() => {
            uiSoundService.play('click');
            onLogout();
          }}
          className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 active:bg-rose-500/20 transition-all cursor-pointer text-left mt-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
              <LogOut className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-xs text-rose-300">Sair da ZapiTV</p>
              <p className="text-[10px] text-rose-400/70">Encerrar sessão neste dispositivo</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-rose-400/50" />
        </button>
      </div>
    </div>
  );
};
