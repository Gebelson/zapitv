import React, { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bookmark, Clock, Settings, RotateCw, ChevronRight } from 'lucide-react';
import { useTvFocusable } from '../../core/tv/useTvFocusable';
import { tvNavigationManager } from '../../core/tv/tvNavigationManager';
import { uiSoundService } from '../../core/audio/uiSoundService';
import { useTvViewport } from '../../core/tv/tvViewportService';
import { tvPerformanceService } from '../../core/tv/tvPerformanceService';
import { FocusContext, useFocusable, setFocus } from '@noriginmedia/norigin-spatial-navigation';

interface TvProfileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: 'mylist' | 'history' | 'settings') => void;
  userName?: string;
  avatarUrl?: string;
  accountPlan?: string;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

interface ProfileMenuConfig {
  menuWidth: number;
  menuPadding: number;
  menuRadius: number;
  avatarSize: number;
  avatarBorder: number;
  headerPaddingX: number;
  headerPaddingY: number;
  headerMarginBottom: number;
  userNameFontSize: number;
  planFontSize: number;
  itemHeight: number;
  itemPaddingX: number;
  itemPaddingY: number;
  itemRadius: number;
  itemFontSize: number;
  iconSize: number;
  iconBoxPadding: number;
  iconBoxRadius: number;
  chevronSize: number;
  itemsGap: number;
  dividerMarginY: number;
}

/**
 * Calcula dimensões e tokens responsivos para o menu de perfil.
 * Isola rigorosamente as reduções do Amazon Fire TV das demais Smart TVs (Samsung Tizen, LG webOS, MSX, desktop).
 */
function getProfileMenuConfig(isFireTv: boolean, scaleCategory: 'compact' | 'standard' | 'expanded'): ProfileMenuConfig {
  if (!isFireTv) {
    // Dimensões originais preservadas integralmente para todas as outras Smart TVs
    return {
      menuWidth: 320,
      menuPadding: 12,
      menuRadius: 16,
      avatarSize: 40,
      avatarBorder: 2,
      headerPaddingX: 12,
      headerPaddingY: 10,
      headerMarginBottom: 8,
      userNameFontSize: 14,
      planFontSize: 11,
      itemHeight: 44,
      itemPaddingX: 16,
      itemPaddingY: 8,
      itemRadius: 12,
      itemFontSize: 14,
      iconSize: 16,
      iconBoxPadding: 8,
      iconBoxRadius: 8,
      chevronSize: 16,
      itemsGap: 4,
      dividerMarginY: 6
    };
  }

  // Variante compacta calibrada exclusivamente para o ecossistema Amazon Fire TV:
  if (scaleCategory === 'compact') {
    // Fire TV Stick (960x540 CSS px)
    return {
      menuWidth: 240,       // Faixa de referência: 230-260px
      menuPadding: 8,       // Faixa de referência: 8-10px
      menuRadius: 12,      // Faixa de referência: 12-16px
      avatarSize: 28,       // Faixa de referência: 28-32px
      avatarBorder: 1.5,
      headerPaddingX: 8,
      headerPaddingY: 6,
      headerMarginBottom: 6,
      userNameFontSize: 12, // Faixa de referência: 11-12px
      planFontSize: 10,
      itemHeight: 32,       // Faixa de referência: 32-36px
      itemPaddingX: 8,
      itemPaddingY: 4,
      itemRadius: 8,
      itemFontSize: 11,     // Faixa de referência: 11-12px
      iconSize: 13,         // Faixa de referência: 13-15px
      iconBoxPadding: 4,
      iconBoxRadius: 6,
      chevronSize: 13,
      itemsGap: 3,
      dividerMarginY: 4
    };
  }

  if (scaleCategory === 'standard') {
    // Fire TV 720p (1280x720 CSS px)
    return {
      menuWidth: 250,       // Faixa de referência: 230-260px
      menuPadding: 9,       // Faixa de referência: 8-10px
      menuRadius: 14,      // Faixa de referência: 12-16px
      avatarSize: 30,       // Faixa de referência: 28-32px
      avatarBorder: 1.5,
      headerPaddingX: 10,
      headerPaddingY: 7,
      headerMarginBottom: 6,
      userNameFontSize: 12.5,
      planFontSize: 10.5,
      itemHeight: 34,       // Faixa de referência: 32-36px
      itemPaddingX: 10,
      itemPaddingY: 5,
      itemRadius: 9,
      itemFontSize: 12,     // Faixa de referência: 11-12px
      iconSize: 14,         // Faixa de referência: 13-15px
      iconBoxPadding: 5,
      iconBoxRadius: 7,
      chevronSize: 14,
      itemsGap: 3,
      dividerMarginY: 5
    };
  }

  // Fire TV 1080p / 4K Max / Cube (1920x1080 CSS px)
  return {
    menuWidth: 260,         // Faixa de referência: 230-260px
    menuPadding: 10,        // Faixa de referência: 8-10px
    menuRadius: 16,        // Faixa de referência: 12-16px
    avatarSize: 32,         // Faixa de referência: 28-32px
    avatarBorder: 2,
    headerPaddingX: 12,
    headerPaddingY: 8,
    headerMarginBottom: 8,
    userNameFontSize: 13,
    planFontSize: 11,
    itemHeight: 36,         // Faixa de referência: 32-36px
    itemPaddingX: 12,
    itemPaddingY: 6,
    itemRadius: 10,
    itemFontSize: 12,       // Faixa de referência: 11-12px
    iconSize: 15,           // Faixa de referência: 13-15px
    iconBoxPadding: 6,
    iconBoxRadius: 8,
    chevronSize: 15,
    itemsGap: 4,
    dividerMarginY: 6
  };
}

const TvProfileMenuItem: React.FC<{
  focusKey: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  onArrowPress?: (direction: string) => boolean;
  config: ProfileMenuConfig;
  isFireTv: boolean;
}> = ({ focusKey, icon, label, onClick, disabled, onArrowPress, config, isFireTv }) => {
  const { ref, focused } = useTvFocusable({
    focusKey,
    onEnterPress: () => {
      if (!disabled) {
        onClick();
      }
    },
    onArrowPress,
    autoScroll: true
  });

  const renderedIcon = React.isValidElement(icon)
    ? React.cloneElement(icon as React.ReactElement<any>, {
        style: {
          width: `${config.iconSize}px`,
          height: `${config.iconSize}px`,
          minWidth: `${config.iconSize}px`,
          ...(icon.props as any)?.style
        },
        className: (icon.props as any)?.className || ''
      })
    : icon;

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
      style={{
        height: `${config.itemHeight}px`,
        minHeight: `${config.itemHeight}px`,
        paddingLeft: `${config.itemPaddingX}px`,
        paddingRight: `${config.itemPaddingX}px`,
        paddingTop: `${config.itemPaddingY}px`,
        paddingBottom: `${config.itemPaddingY}px`,
        borderRadius: `${config.itemRadius}px`,
        fontSize: `${config.itemFontSize}px`
      }}
      className={`w-full flex items-center justify-between text-left transition-all duration-200 outline-none select-none ${
        focused
          ? 'bg-gradient-to-r from-cyan-500/25 to-blue-600/30 text-cyan-300 border border-cyan-400/60 shadow-[0_0_15px_rgba(0,229,255,0.35)] scale-[1.01]'
          : 'text-gray-200 hover:bg-white/10 border border-transparent'
      } ${disabled ? 'opacity-75 cursor-not-allowed' : ''}`}
    >
      <div 
        className="flex items-center min-w-0"
        style={{ gap: isFireTv ? '8px' : '12px' }}
      >
        <div 
          className={`shrink-0 flex items-center justify-center ${
            focused ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/5 text-gray-400'
          }`}
          style={{
            padding: `${config.iconBoxPadding}px`,
            borderRadius: `${config.iconBoxRadius}px`
          }}
        >
          {renderedIcon}
        </div>
        <span 
          className="font-bold tracking-wide truncate"
          style={{ fontSize: `${config.itemFontSize}px` }}
        >
          {label}
        </span>
      </div>
      <ChevronRight 
        style={{
          width: `${config.chevronSize}px`,
          height: `${config.chevronSize}px`,
          minWidth: `${config.chevronSize}px`
        }}
        className={`shrink-0 ${
          focused ? 'text-cyan-300 translate-x-0.5' : 'text-gray-500'
        } transition-transform`} 
      />
    </button>
  );
};

export const TvProfileMenu: React.FC<TvProfileMenuProps> = ({
  isOpen,
  onClose,
  onNavigate,
  userName = 'Meu Perfil',
  avatarUrl,
  accountPlan,
  anchorRef
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const viewport = useTvViewport();

  // Detecção específica de Fire TV (isolando de Samsung Tizen, LG webOS, MSX e desktop)
  const deviceFamily = tvPerformanceService.getDeviceFamily();
  const isFireTv = deviceFamily === 'firetv' || (!['samsung', 'msx', 'generic'].includes(deviceFamily) && viewport.isFireTv);

  // Configuração responsiva e proporcional
  const config = getProfileMenuConfig(isFireTv, viewport.scaleCategory);

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

  // Posição ancorada calculada com precisão em relação ao botão de perfil e viewport da TV
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number }>({
    top: viewport.headerHeight + (isFireTv ? 6 : 8),
    right: viewport.safeMarginX
  });

  useEffect(() => {
    if (!isOpen) return;
    const topOffset = isFireTv ? 6 : 8;
    if (anchorRef?.current && typeof window !== 'undefined') {
      const rect = anchorRef.current.getBoundingClientRect();
      const top = rect.bottom > 0 ? Math.round(rect.bottom + topOffset) : viewport.headerHeight + topOffset;
      // Alinha à extremidade direita do botão de perfil, respeitando a margem da janela
      const right = rect.right > 0 ? Math.max(16, Math.round(window.innerWidth - rect.right)) : viewport.safeMarginX;
      setMenuPosition({ top, right });
    } else {
      setMenuPosition({
        top: viewport.headerHeight + topOffset,
        right: viewport.safeMarginX
      });
    }
  }, [isOpen, anchorRef, viewport.headerHeight, viewport.safeMarginX, isFireTv]);

  if (!isOpen) return null;

  const windowW = typeof window !== 'undefined' ? window.innerWidth : viewport.width;
  const windowH = typeof window !== 'undefined' ? window.innerHeight : viewport.height;
  const safeRight = Math.min(menuPosition.right, Math.max(16, windowW - config.menuWidth - 16));
  const maxAvailableHeight = Math.max(160, windowH - menuPosition.top - 16);

  const menuContent = (
    <FocusContext.Provider value={focusKey}>
      {/* Overlay 100% transparente: captura clique externo para fechar sem escurecimento visual da interface */}
      <div 
        data-testid="tv-profile-menu-overlay"
        className="fixed inset-0 z-[150] bg-transparent pointer-events-auto select-none"
        onClick={() => {
          if (!isUpdating) {
            handleClose();
            setFocus('tv-nav-profile');
          }
        }}
      />

      {/* Menu Suspenso Ancorado à Direita com Glassmorphism e Proporções Otimizadas */}
      <div
        ref={setCombinedRef}
        data-testid="tv-profile-menu-dropdown"
        data-firetv-compact={isFireTv ? "true" : undefined}
        data-device-family={deviceFamily}
        className="fixed z-[160] bg-[#0c121e]/98 border border-white/15 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200 select-none pointer-events-auto scrollbar-none"
        style={{
          top: `${menuPosition.top}px`,
          right: `${safeRight}px`,
          width: `${config.menuWidth}px`,
          maxWidth: `${config.menuWidth}px`,
          padding: `${config.menuPadding}px`,
          borderRadius: `${config.menuRadius}px`,
          maxHeight: `${maxAvailableHeight}px`,
          overflowY: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          boxShadow: isFireTv
            ? '0 12px 28px rgba(0, 0, 0, 0.8), 0 0 18px rgba(0, 125, 247, 0.2)'
            : '0 20px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(0, 125, 247, 0.25)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Perfil */}
        <div 
          className="flex items-center border-b border-white/10"
          style={{
            paddingLeft: `${config.headerPaddingX}px`,
            paddingRight: `${config.headerPaddingX}px`,
            paddingTop: `${config.headerPaddingY}px`,
            paddingBottom: `${config.headerPaddingY}px`,
            marginBottom: `${config.headerMarginBottom}px`,
            gap: isFireTv ? '8px' : '12px'
          }}
        >
          <div 
            className="rounded-full overflow-hidden border-cyan-400/60 bg-gradient-to-tr from-blue-600 to-cyan-400 p-0.5 shrink-0"
            style={{
              width: `${config.avatarSize}px`,
              height: `${config.avatarSize}px`,
              borderWidth: `${config.avatarBorder}px`
            }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={userName} className="w-full h-full object-cover rounded-full" />
            ) : (
              <div 
                className="w-full h-full rounded-full bg-[#151f32] flex items-center justify-center text-cyan-300 font-bold"
                style={{ fontSize: `${Math.round(config.avatarSize * 0.42)}px` }}
              >
                {userName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div 
              className="font-black text-white truncate"
              style={{ fontSize: `${config.userNameFontSize}px`, lineHeight: 1.25 }}
            >
              {userName}
            </div>
            {accountPlan ? (
              <div 
                className="text-cyan-400 font-medium truncate"
                style={{ fontSize: `${config.planFontSize}px`, lineHeight: 1.25 }}
              >
                Plano {accountPlan}
              </div>
            ) : null}
          </div>
        </div>

        {/* Itens do Menu com Navegação D-Pad Delimitada */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${config.itemsGap}px` }}>
          <TvProfileMenuItem
            focusKey="tv-menu-mylist"
            icon={<Bookmark className="w-4 h-4" />}
            label="Minha Lista"
            config={config}
            isFireTv={isFireTv}
            onArrowPress={(direction) => {
              if (direction === 'up' || direction === 'left' || direction === 'right') {
                return false;
              }
              return true;
            }}
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
            config={config}
            isFireTv={isFireTv}
            onArrowPress={(direction) => {
              if (direction === 'left' || direction === 'right') {
                return false;
              }
              return true;
            }}
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
            config={config}
            isFireTv={isFireTv}
            onArrowPress={(direction) => {
              if (direction === 'left' || direction === 'right') {
                return false;
              }
              return true;
            }}
            onClick={() => {
              uiSoundService.play('click');
              onClose();
              onNavigate('settings');
            }}
          />

          {/* Divisor discreto para separar ação de sistema */}
          <div 
            className="border-t border-white/10"
            style={{
              marginTop: `${config.dividerMarginY}px`,
              marginBottom: `${config.dividerMarginY}px`
            }}
          />

          {/* Opção Atualizar ZapiTV */}
          <TvProfileMenuItem
            focusKey="tv-menu-update"
            icon={<RotateCw className={`w-4 h-4 ${isUpdating ? 'animate-spin text-cyan-400' : ''}`} />}
            label={isUpdating ? "Atualizando..." : "Atualizar ZapiTV"}
            config={config}
            isFireTv={isFireTv}
            onArrowPress={(direction) => {
              if (direction === 'down' || direction === 'left' || direction === 'right') {
                return false;
              }
              return true;
            }}
            onClick={handleUpdateApp}
            disabled={isUpdating}
          />
        </div>
      </div>
    </FocusContext.Provider>
  );

  // Renderiza via Portal no document.body para isolar do transform-gpu e stacking context do header
  if (typeof document !== 'undefined' && document.body) {
    return createPortal(menuContent, document.body);
  }

  return menuContent;
};
