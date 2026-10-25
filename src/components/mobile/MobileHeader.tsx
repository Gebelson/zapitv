import React, { useState, useEffect } from 'react';
import { Bell, X, Info, AlertTriangle, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Profile, SiteNotification, User } from '../../../types';
import { ZapiAnimatedLogo } from '../common/ZapiAnimatedLogo';
import { uiSoundService } from '../../core/audio/uiSoundService';

interface MobileHeaderProps {
  currentUser?: User;
  activeProfile?: Profile | null;
  notifications?: SiteNotification[];
  isDarkMode?: boolean;
  onOpenNotifications?: () => void;
  onOpenProfile?: () => void;
  scrollY?: number;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  currentUser,
  activeProfile,
  notifications = [],
  isDarkMode = true,
  onOpenProfile,
  scrollY = 0
}) => {
  const navigate = useNavigate();
  const [showNotifyPanel, setShowNotifyPanel] = useState(false);
  const [readNotifs, setReadNotifs] = useState<string[]>([]);

  const isScrolled = scrollY > 20;
  const unreadCount = notifications.filter(n => !readNotifs.includes(n.id) && !n.read).length;

  const handleLogoClick = () => {
    uiSoundService.play('click');
    navigate('/');
  };

  const handleProfileClick = () => {
    uiSoundService.play('click');
    if (onOpenProfile) {
      onOpenProfile();
    } else {
      navigate('/minha-zapitv');
    }
  };

  const handleToggleNotifications = () => {
    uiSoundService.play(showNotifyPanel ? 'close' : 'click');
    setShowNotifyPanel(prev => !prev);
  };

  return (
    <>
      <header
        data-testid="mobile-header"
        className={`fixed top-0 left-0 right-0 z-[110] transition-colors duration-300 select-none pt-[env(safe-area-inset-top,0px)] ${
          isScrolled
            ? (isDarkMode
                ? 'bg-[#05070a]/95 backdrop-blur-xl border-b border-white/10 shadow-lg'
                : 'bg-[#F8F9FC]/95 backdrop-blur-xl border-b border-black/10 shadow-sm text-gray-900')
            : (isDarkMode
                ? 'bg-gradient-to-b from-[#05070a]/90 via-[#05070a]/40 to-transparent'
                : 'bg-gradient-to-b from-[#F8F9FC]/90 via-[#F8F9FC]/40 to-transparent text-gray-900')
        }`}
      >
        <div className="h-14 px-4 flex items-center justify-between max-w-lg mx-auto">
          {/* Logo ZapiTV */}
          <div
            role="button"
            tabIndex={0}
            onClick={handleLogoClick}
            aria-label="Ir para a página inicial"
            className="flex items-center gap-2 cursor-pointer active:scale-95 transition-transform focus:outline-none"
          >
            <div className="w-8 h-8 flex items-center justify-center shrink-0">
              <ZapiAnimatedLogo />
            </div>
            <span
              className="text-lg font-black tracking-tight text-white sidebar-text-glow"
              style={{ fontFamily: "'Sora', sans-serif" }}
            >
              Zapi<span className="text-[#007df7]">TV</span>
            </span>
          </div>

          {/* Ações da direita: Notificações & Perfil */}
          <div className="flex items-center gap-2.5">
            {/* Botão de Notificações */}
            <button
              type="button"
              onClick={handleToggleNotifications}
              aria-label="Abrir notificações"
              className="relative p-2 rounded-full text-slate-300 hover:text-white active:bg-white/10 transition-colors cursor-pointer"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#007df7] text-[9px] font-bold text-white flex items-center justify-center shadow-md animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Avatar do Perfil */}
            <button
              type="button"
              onClick={handleProfileClick}
              aria-label={`Perfil de ${activeProfile?.name || currentUser?.name || 'Usuário'}`}
              className="relative rounded-full ring-2 ring-[#007df7]/40 active:ring-[#007df7] transition-all overflow-hidden w-8 h-8 cursor-pointer shrink-0"
            >
              <img
                src={activeProfile?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                alt={activeProfile?.name || 'Perfil'}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100';
                }}
              />
            </button>
          </div>
        </div>
      </header>

      {/* Drawer / Painel de Notificações Mobile */}
      {showNotifyPanel && (
        <div className="fixed inset-0 z-[160] flex flex-col justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-h-[80vh] bg-[#0E131F] rounded-t-3xl border-t border-white/10 p-5 overflow-hidden flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300"
            style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-[#007df7]" />
                <h3 className="font-bold text-white text-base">Notificações</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#007df7] text-white">
                    {unreadCount} novas
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowNotifyPanel(false)}
                className="p-1.5 rounded-full bg-white/10 text-slate-300 hover:text-white"
                aria-label="Fechar notificações"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto no-scrollbar space-y-2 flex-1">
              {notifications.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  <p>Nenhuma notificação no momento.</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => setReadNotifs(prev => [...prev, notif.id])}
                    className="p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors flex items-start gap-3"
                  >
                    <div className="p-2 rounded-xl bg-[#007df7]/20 text-[#007df7] shrink-0 mt-0.5">
                      {notif.type === 'alert' ? <AlertTriangle className="w-4 h-4" /> : notif.type === 'promo' ? <Star className="w-4 h-4" /> : <Info className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-xs text-white leading-snug">{notif.title}</p>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{notif.message}</p>
                      <span className="text-[9px] text-slate-500 mt-1.5 block">{notif.timestamp}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
