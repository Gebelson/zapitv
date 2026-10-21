import React, { useEffect, useRef, useCallback } from 'react';
import { Bookmark, Clock, Settings, LogOut, ChevronRight } from 'lucide-react';
import { useTvFocusable } from '../../core/tv/useTvFocusable';
import { tvNavigationManager } from '../../core/tv/tvNavigationManager';
import { FocusContext, useFocusable, setFocus } from '@noriginmedia/norigin-spatial-navigation';

interface TvProfileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: 'mylist' | 'history' | 'settings') => void;
  userName?: string;
  avatarUrl?: string;
}

const TvProfileMenuItem: React.FC<{
  focusKey: string;
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onClick: () => void;
}> = ({ focusKey, icon, label, sublabel, onClick }) => {
  const { ref, focused } = useTvFocusable({
    focusKey,
    onEnterPress: onClick,
    autoScroll: true
  });

  return (
    <button
      ref={ref}
      type="button"
      data-focus-key={focusKey}
      data-tv-focused={focused ? "true" : undefined}
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all duration-200 outline-none select-none ${
        focused
          ? 'bg-gradient-to-r from-cyan-500/25 to-blue-600/30 text-cyan-300 border border-cyan-400/60 shadow-[0_0_15px_rgba(0,229,255,0.35)] scale-[1.02]'
          : 'text-gray-200 hover:bg-white/10 border border-transparent'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${focused ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/5 text-gray-400'}`}>
          {icon}
        </div>
        <div>
          <div className="text-sm font-bold tracking-wide">{label}</div>
          {sublabel && <div className="text-[11px] text-gray-400">{sublabel}</div>}
        </div>
      </div>
      <ChevronRight className={`w-4 h-4 ${focused ? 'text-cyan-300 translate-x-0.5' : 'text-gray-500'} transition-transform`} />
    </button>
  );
};

export const TvProfileMenu: React.FC<TvProfileMenuProps> = ({
  isOpen,
  onClose,
  onNavigate,
  userName = 'Meu Perfil',
  avatarUrl
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  const { ref: noriginRef, focusKey } = useFocusable({
    focusKey: 'tv-profile-menu',
    trackChildren: true
  });

  // Registra manipulador do botão Voltar na pilha da TV (Prioridade 100 - Modal/Menu)
  useEffect(() => {
    if (!isOpen) return;

    // Foca o primeiro item do menu ao abrir
    const timer = setTimeout(() => {
      setFocus('tv-menu-mylist');
    }, 50);

    const unregister = tvNavigationManager.registerBackHandler('tv-profile-menu', 100, () => {
      onClose();
      // Restaura o foco para o botão de perfil
      setTimeout(() => setFocus('tv-nav-profile'), 50);
      return true;
    });

    return () => {
      clearTimeout(timer);
      unregister();
    };
  }, [isOpen, onClose]);

  const setCombinedRef = useCallback((node: HTMLDivElement | null) => {
    (menuRef as any).current = node;
    (noriginRef as any).current = node;
  }, [noriginRef]);

  if (!isOpen) return null;

  return (
    <FocusContext.Provider value={focusKey}>
      {/* Overlay transparente para captura de clique externo */}
      <div 
        className="fixed inset-0 z-[150] bg-black/40 backdrop-blur-none"
        onClick={() => {
          onClose();
          setFocus('tv-nav-profile');
        }}
      />

      {/* Menu Suspenso Ancorado à Direita */}
      <div
        ref={setCombinedRef}
        className="fixed top-18 right-8 sm:right-12 z-[160] w-[320px] bg-[#0c121e]/98 border border-white/15 rounded-2xl shadow-2xl p-3 animate-in fade-in slide-in-from-top-2 duration-200 select-none"
        style={{
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(0, 125, 247, 0.25)'
        }}
      >
        {/* Cabeçalho do Perfil */}
        <div className="flex items-center gap-3 px-3 py-2.5 mb-2 border-b border-white/10">
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-cyan-400/60 bg-gradient-to-tr from-blue-600 to-cyan-400 p-0.5 shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt={userName} className="w-full h-full object-cover rounded-full" />
            ) : (
              <div className="w-full h-full rounded-full bg-[#151f32] flex items-center justify-center text-cyan-300 font-bold text-sm">
                {userName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-black text-white truncate">{userName}</div>
            <div className="text-[11px] text-cyan-400 font-medium">ZapiTV Smart TV</div>
          </div>
        </div>

        {/* Itens do Menu */}
        <div className="space-y-1">
          <TvProfileMenuItem
            focusKey="tv-menu-mylist"
            icon={<Bookmark className="w-4 h-4" />}
            label="Minha Lista"
            sublabel="Seus filmes e séries salvos"
            onClick={() => {
              onClose();
              onNavigate('mylist');
            }}
          />

          <TvProfileMenuItem
            focusKey="tv-menu-history"
            icon={<Clock className="w-4 h-4" />}
            label="Histórico"
            sublabel="Títulos reproduzidos recentemente"
            onClick={() => {
              onClose();
              onNavigate('history');
            }}
          />

          <TvProfileMenuItem
            focusKey="tv-menu-settings"
            icon={<Settings className="w-4 h-4" />}
            label="Configurações"
            sublabel="Preferências de streaming e áudio"
            onClick={() => {
              onClose();
              onNavigate('settings');
            }}
          />
        </div>
      </div>
    </FocusContext.Provider>
  );
};
