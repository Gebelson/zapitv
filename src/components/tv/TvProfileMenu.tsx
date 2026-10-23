import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Bookmark, Clock, Settings, RotateCw, ChevronRight } from 'lucide-react';
import { useTvFocusable } from '../../core/tv/useTvFocusable';
import { tvNavigationManager } from '../../core/tv/tvNavigationManager';
import { uiSoundService } from '../../core/audio/uiSoundService';
import { FocusContext, useFocusable, setFocus } from '@noriginmedia/norigin-spatial-navigation';

interface TvProfileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: 'mylist' | 'history' | 'settings') => void;
  userName?: string;
  avatarUrl?: string;
  accountPlan?: string;
}

const TvProfileMenuItem: React.FC<{
  focusKey: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}> = ({ focusKey, icon, label, onClick, disabled }) => {
  const { ref, focused } = useTvFocusable({
    focusKey,
    onEnterPress: () => {
      if (!disabled) {
        onClick();
      }
    },
    autoScroll: true
  });

  return (
    <button
      ref={ref}
      type="button"
      data-focus-key={focusKey}
      data-tv-focused={focused ? "true" : undefined}
      onClick={() => {
        if (!disabled) {
          onClick();
        }
      }}
      disabled={disabled}
      className={`w-full flex items-center justify-between px-4 py-2 rounded-xl text-left transition-all duration-200 outline-none select-none ${
        focused
          ? 'bg-gradient-to-r from-cyan-500/25 to-blue-600/30 text-cyan-300 border border-cyan-400/60 shadow-[0_0_15px_rgba(0,229,255,0.35)] scale-[1.02]'
          : 'text-gray-200 hover:bg-white/10 border border-transparent'
      } ${disabled ? 'opacity-75 cursor-not-allowed' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${focused ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/5 text-gray-400'}`}>
          {icon}
        </div>
        <span className="text-sm font-bold tracking-wide">{label}</span>
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
  avatarUrl,
  accountPlan
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const { ref: noriginRef, focusKey } = useFocusable({
    focusKey: 'tv-profile-menu',
    trackChildren: true
  });

  const handleClose = useCallback(() => {
    uiSoundService.play('close');
    onClose();
  }, [onClose]);

  // Manipulador para atualizar ZapiTV (recarregamento real, bypass de cache e busca da versão Vercel)
  const handleUpdateApp = useCallback(async () => {
    if (isUpdating) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    uiSoundService.play('confirm');
    setIsUpdating(true);

    try {
      // 1. Limpar cache de assets estáticos do CacheStorage para forçar nova versão da Vercel
      // NOTA: Preserva integralmente localStorage, indexedDB (sessão, histórico, preferências e favoritos mantidos)
      if (typeof window !== 'undefined' && 'caches' in window) {
        try {
          const cacheKeys = await caches.keys();
          await Promise.all(cacheKeys.filter(key => key.startsWith('zapitv-shell-')).map(key => caches.delete(key)));
        } catch (cacheErr) {
          console.warn('[TvProfileMenu] Aviso ao limpar CacheStorage:', cacheErr);
        }
      }

      // 2. Notificar e solicitar atualização aos Service Workers ativos
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const registration of registrations) {
            if (registration.scope === `${window.location.origin}/`) await registration.unregister();
          }
        } catch (swErr) {
          console.warn('[TvProfileMenu] Aviso ao atualizar Service Worker:', swErr);
        }
      }
    } catch (err) {
      console.error('[TvProfileMenu] Erro durante rotina de atualização:', err);
    }

    // 3. Fornece tempo para feedback visual antes do recarregamento real no Tizen/MSX
    setTimeout(() => {
      try {
        // Preserva a rota (/tv) e parâmetros de diagnóstico existentes (?tvdiag=1) sem sair do MSX
        window.location.reload();
      } catch (reloadErr) {
        window.location.href = window.location.href;
      }
    }, 450);
  }, [isUpdating]);

  // Registra manipulador do botão Voltar na pilha da TV (Prioridade 100 - Modal/Menu)
  useEffect(() => {
    if (!isOpen) return;

    // Foca o primeiro item do menu ao abrir
    const timer = setTimeout(() => {
      setFocus('tv-menu-mylist');
    }, 50);

    const unregister = tvNavigationManager.registerBackHandler('tv-profile-menu', 100, () => {
      handleClose();
      // Restaura o foco para o botão de perfil
      setTimeout(() => setFocus('tv-nav-profile'), 50);
      return true;
    });

    return () => {
      clearTimeout(timer);
      unregister();
    };
  }, [isOpen, handleClose]);

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
          if (!isUpdating) {
            handleClose();
            setFocus('tv-nav-profile');
          }
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
            {accountPlan ? <div className="text-[11px] text-cyan-400 font-medium truncate">Plano {accountPlan}</div> : null}
          </div>
        </div>

        {/* Itens do Menu */}
        <div className="space-y-1">
          <TvProfileMenuItem
            focusKey="tv-menu-mylist"
            icon={<Bookmark className="w-4 h-4" />}
            label="Minha Lista"
            onClick={() => {
              uiSoundService.play('click');
              onClose();
              onNavigate('mylist');
            }}
          />

          <TvProfileMenuItem
            focusKey="tv-menu-history"
            icon={<Clock className="w-4 h-4" />}
            label="Histórico"
            onClick={() => {
              uiSoundService.play('click');
              onClose();
              onNavigate('history');
            }}
          />

          <TvProfileMenuItem
            focusKey="tv-menu-settings"
            icon={<Settings className="w-4 h-4" />}
            label="Configurações"
            onClick={() => {
              uiSoundService.play('click');
              onClose();
              onNavigate('settings');
            }}
          />

          {/* Divisor discreto para separar ação de sistema */}
          <div className="my-1.5 border-t border-white/10" />

          {/* Opção Atualizar ZapiTV */}
          <TvProfileMenuItem
            focusKey="tv-menu-update"
            icon={<RotateCw className={`w-4 h-4 ${isUpdating ? 'animate-spin text-cyan-400' : ''}`} />}
            label={isUpdating ? "Atualizando..." : "Atualizar ZapiTV"}
            onClick={handleUpdateApp}
            disabled={isUpdating}
          />
        </div>
      </div>
    </FocusContext.Provider>
  );
};
