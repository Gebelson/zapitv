
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPortal, flushSync } from 'react-dom';
import { Search, Bell, Sun, Moon, User as UserIcon, X, Info, AlertTriangle, Star, Settings, LogOut, Menu, Edit3, HelpCircle, ChevronRight, RefreshCw, Lock, Activity } from 'lucide-react';
import { AppView, User, SiteNotification, Profile, ContentItem, ContentType } from '../types';
import { searchService } from '../src/core/search/searchService';

interface HeaderProps {
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  currentUser: User;
  activeProfile: Profile | null;
  currentView?: AppView;
  setCurrentView: (view: AppView) => void;
  onSwitchProfile: () => void;
  onSelectProfile: (profile: Profile) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSelectContent?: (item: ContentItem) => void;
  allContent?: ContentItem[];
  notifications?: SiteNotification[];
  onLogout: () => void;
  onToggleMobileMenu?: () => void;
  onOpenDiagnostics?: () => void;
  onSearchSubmit?: (query: string) => void;
  onClearSearch?: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
  isDarkMode, setIsDarkMode, currentUser, activeProfile, currentView = 'home', setCurrentView, 
  onSwitchProfile, onSelectProfile, searchQuery, setSearchQuery, onSelectContent, allContent = [],
  notifications = [], onLogout, onToggleMobileMenu, onOpenDiagnostics, onSearchSubmit, onClearSearch
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifyPanel, setShowNotifyPanel] = useState(false);
  
  // Estados para PIN (Troca Rápida)
  const [targetProfile, setTargetProfile] = useState<Profile | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);
  
  const notifyRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Categoria e placeholder contextual de busca baseados na URL e view atual
  const getEffectiveCategory = (): import('../src/core/search/searchService').SearchCategory => {
    const path = location.pathname;
    if (path.startsWith('/filmes')) return 'movies';
    if (path.startsWith('/series')) return 'series';
    if (path.startsWith('/animes')) return 'animes';
    if (path.startsWith('/programas') || path.startsWith('/televisao')) return 'live';
    return searchService.mapAppViewToCategory(currentView);
  };

  const searchCategory = getEffectiveCategory();
  const searchPlaceholder = searchService.getPlaceholder(searchCategory);

  const [suggestions, setSuggestions] = useState<ContentItem[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Ao mudar de rota ou view: cancela requisições pendentes e fecha dropdown
  useEffect(() => {
    setShowSearchDropdown(false);
    setSuggestions([]);
    searchService.cancelPending();
  }, [location.pathname, currentView]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifyRef.current && !notifyRef.current.contains(event.target as Node)) {
        setShowNotifyPanel(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Busca sugestões com debounce enquanto o usuário digita
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setShowSearchDropdown(false);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      try {
        const results = await searchService.getSuggestions(trimmed, searchCategory, 5, allContent);
        if (active) {
          setSuggestions(results);
          setShowSearchDropdown(true);
        }
      } catch {
        if (active) setSuggestions([]);
      }
    }, 200);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery, searchCategory, allContent]);

  // Lógica de Troca de Perfil com PIN
  const handleProfileSwitchRequest = (profile: Profile) => {
    setShowDropdown(false);
    if (profile.pin) {
      setTargetProfile(profile);
      setPinInput('');
      setPinError(false);
    } else {
      onSelectProfile(profile);
    }
  };

  const handlePinChange = (val: string) => {
    if (!/^\d*$/.test(val)) return;
    if (val.length > 4) return;
    
    setPinInput(val);
    setPinError(false);

    if (val.length === 4) {
      if (targetProfile && val === targetProfile.pin) {
        onSelectProfile(targetProfile);
        setTargetProfile(null);
        setPinInput('');
      } else {
        setPinError(true);
        setTimeout(() => setPinInput(''), 400);
      }
    }
  };

  const renderPinModal = () => {
    if (!targetProfile) return null;

    // Usamos Portal para garantir que o modal fique no topo de tudo, fora do contexto sticky/fixed do header
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
        <div className="w-full max-w-sm bg-black/30 backdrop-blur-xl border border-white/10 rounded-[40px] p-8 md:p-10 shadow-2xl flex flex-col items-center relative overflow-hidden animate-in zoom-in-95 duration-300">
          
          {/* Efeito de brilho de vidro */}
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

          <h3 className="text-xl font-black text-white mb-2 relative z-10">Bloqueio de Perfil</h3>
          <p className="text-gray-300 mb-8 text-center text-xs relative z-10 max-w-[80%]">Digite o PIN de {targetProfile.name} para acessar.</p>
          
          <div className={`flex gap-4 mb-8 relative z-10 ${pinError ? 'animate-shake' : ''}`}>
            {[0, 1, 2, 3].map((i) => (
              <div 
                key={i} 
                className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                  pinInput.length > i 
                    ? (pinError ? 'bg-red-500 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-white border-white shadow-[0_0_10px_rgba(255,255,255,0.5)]') 
                    : 'border-white/20 bg-transparent'
                }`} 
              />
            ))}
          </div>

          <input 
            ref={pinInputRef}
            type="tel" 
            value={pinInput} 
            onChange={(e) => handlePinChange(e.target.value)}
            className="opacity-0 absolute pointer-events-none" 
            autoFocus 
            onBlur={() => pinInputRef.current?.focus()}
          />

          <div className="grid grid-cols-3 gap-4 md:gap-5 mb-8 relative z-10">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button 
                key={num} 
                onClick={() => handlePinChange(pinInput + num)}
                className="w-16 h-16 rounded-full border border-white/10 hover:bg-white/10 hover:border-white/40 text-white text-2xl font-bold transition-all flex items-center justify-center active:scale-90 active:bg-white/20"
              >
                {num}
              </button>
            ))}
            <div className="w-16 h-16" />
            <button 
              onClick={() => handlePinChange(pinInput + '0')}
              className="w-16 h-16 rounded-full border border-white/10 hover:bg-white/10 hover:border-white/40 text-white text-2xl font-bold transition-all flex items-center justify-center active:scale-90 active:bg-white/20"
            >
              0
            </button>
             <button 
              onClick={() => setPinInput(pinInput.slice(0, -1))}
              className="w-16 h-16 rounded-full border-transparent hover:bg-white/10 text-white flex items-center justify-center active:scale-90"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <button onClick={() => { setTargetProfile(null); setPinInput(''); }} className="text-white/40 hover:text-white uppercase font-bold text-xs tracking-widest transition-colors relative z-10">
            Cancelar
          </button>
        </div>
        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-10px); }
            75% { transform: translateX(10px); }
          }
          .animate-shake { animation: shake 0.3s ease-in-out; }
        `}</style>
      </div>,
      document.body
    );
  };

  const handleToggleTheme = (event: React.MouseEvent<HTMLButtonElement>) => {
    const nextMode = !isDarkMode;

    const isAppearanceTransition =
      typeof document !== 'undefined' &&
      'startViewTransition' in document &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!isAppearanceTransition) {
      setIsDarkMode(nextMode);
      return;
    }

    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    try {
      const transition = (document as any).startViewTransition(() => {
        if (nextMode) {
          document.body.classList.add('dark');
        } else {
          document.body.classList.remove('dark');
        }
        flushSync(() => {
          setIsDarkMode(nextMode);
        });
      });

      transition.ready.then(() => {
        const clipPath = [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${endRadius}px at ${x}px ${y}px)`
        ];

        document.documentElement.animate(
          { clipPath },
          {
            duration: 550,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            pseudoElement: '::view-transition-new(root)'
          }
        );
      }).catch(() => {
        setIsDarkMode(nextMode);
      });
    } catch {
      setIsDarkMode(nextMode);
    }
  };

  return (
    <header className={`sticky top-0 z-[160] h-20 px-4 md:px-8 flex items-center justify-between transition-all duration-500 ${
      isDarkMode 
        ? 'bg-[#05070A]/75 border-b border-white/5 shadow-[0_4px_30px_rgba(0,0,0,0.3)]' 
        : 'bg-[#F8F9FC]/75 border-b border-black/5 shadow-[0_4px_30px_rgba(0,0,0,0.05)]'
    } backdrop-blur-2xl`}>
      
      <div className="flex items-center gap-3 md:gap-4 flex-1 max-w-xl relative z-10">
        <button 
          onClick={onToggleMobileMenu}
          className={`lg:hidden p-2 rounded-xl transition-colors ${
            isDarkMode ? 'hover:bg-white/10 text-white' : 'hover:bg-black/5 text-gray-900'
          }`}
        >
          <Menu className="w-6 h-6" />
        </button>

        <div ref={searchContainerRef} className="relative flex-1">
          <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'} pointer-events-none`} />
          <input
            type="text"
            value={searchQuery}
            onFocus={() => {
              if (searchQuery.trim().length >= 2 && suggestions.length > 0) {
                setShowSearchDropdown(true);
              }
            }}
            onChange={(e) => {
              const val = e.target.value;
              setSearchQuery(val);
              if (!val.trim() && onClearSearch) {
                onClearSearch();
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setShowSearchDropdown(false);
              } else if (e.key === 'Enter') {
                setShowSearchDropdown(false);
                if (onSearchSubmit && searchQuery.trim()) {
                  onSearchSubmit(searchQuery.trim());
                }
              }
            }}
            placeholder={searchPlaceholder}
            className={`w-full pl-11 pr-10 py-2.5 rounded-xl border outline-none text-sm transition-all ${
              isDarkMode 
                ? 'bg-black/40 focus:bg-black/60 text-white placeholder:text-gray-500 border-white/15 hover:border-white/25 focus:border-[#007df7]/60' 
                : 'bg-black/5 focus:bg-black/10 text-gray-900 placeholder:text-gray-400 border-black/10 hover:border-black/20 focus:border-[#007df7]/60'
            }`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSuggestions([]);
                setShowSearchDropdown(false);
                if (onClearSearch) {
                  onClearSearch();
                }
              }}
              className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors cursor-pointer ${
                isDarkMode ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-900 hover:bg-black/5'
              }`}
              title="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Dropdown Contextual de Sugestões Rápidas */}
          {showSearchDropdown && suggestions.length > 0 && (
            <div className={`absolute top-full left-0 right-0 mt-2 rounded-2xl shadow-2xl border overflow-hidden z-50 backdrop-blur-xl ${
              isDarkMode 
                ? 'bg-[#0f131a]/95 border-white/10 text-white shadow-black/80' 
                : 'bg-white/95 border-black/10 text-gray-900 shadow-xl'
            }`}>
              <div className="p-2 space-y-1 max-h-[360px] overflow-y-auto no-scrollbar">
                {suggestions.map((item) => (
                  <button
                    key={`sug-${item.id}`}
                    type="button"
                    onClick={() => {
                      setShowSearchDropdown(false);
                      if (onSelectContent) {
                        onSelectContent(item);
                      }
                    }}
                    className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all text-left ${
                      isDarkMode 
                        ? 'hover:bg-white/10 text-gray-200 hover:text-white' 
                        : 'hover:bg-black/5 text-gray-800 hover:text-black'
                    }`}
                  >
                    <img 
                      src={item.image} 
                      alt={item.title} 
                      className="w-10 h-14 object-cover rounded-lg shrink-0 shadow-sm"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=200';
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{item.title}</p>
                      <div className="flex items-center gap-2 text-xs opacity-70 mt-0.5">
                        <span>{item.year || ''}</span>
                        <span>•</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          item.type === ContentType.MOVIE ? 'bg-blue-500/20 text-blue-400' :
                          item.type === ContentType.ANIME ? 'bg-purple-500/20 text-purple-400' :
                          'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {item.type === ContentType.MOVIE ? 'Filme' :
                           item.type === ContentType.ANIME ? 'Anime' : 'Série'}
                        </span>
                        {item.rating && (
                          <>
                            <span>•</span>
                            <span className="text-yellow-400 font-bold">★ {item.rating.toFixed(1)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSearchDropdown(false);
                  if (onSearchSubmit && searchQuery.trim()) {
                    onSearchSubmit(searchQuery.trim());
                  }
                }}
                className={`w-full p-2.5 border-t text-center text-xs font-semibold cursor-pointer transition-colors ${
                  isDarkMode 
                    ? 'border-white/5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white' 
                    : 'border-black/5 bg-black/5 hover:bg-black/10 text-gray-700 hover:text-black'
                }`}
              >
                Pressione Enter para ver todos os resultados
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-6 relative z-10 ml-4">
        <button 
          onClick={handleToggleTheme}
          aria-label={isDarkMode ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
          className={`p-2.5 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-black/5 text-gray-500 hover:text-gray-900'}`}
        >
          {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {onOpenDiagnostics && (
          <button
            onClick={onOpenDiagnostics}
            title="Diagnóstico do Catálogo"
            aria-label="Diagnóstico do Catálogo"
            className={`p-2.5 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-white/10 text-orange-400 hover:text-orange-300' : 'hover:bg-black/5 text-orange-500 hover:text-orange-600'}`}
          >
            <Activity className="w-5 h-5" />
          </button>
        )}
        
        <div className="relative" ref={notifyRef}>
          <button 
            onClick={() => { setShowNotifyPanel(!showNotifyPanel); setShowDropdown(false); }} 
            className={`relative p-2.5 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-black/5 text-gray-500 hover:text-gray-900'}`}
          >
            <Bell className="w-5 h-5" />
            {notifications.length > 0 && (
              <span className="absolute top-2.5 right-2.5 w-4 h-4 bg-[#007df7] rounded-full border-2 border-[#05070A] text-[8px] flex items-center justify-center font-bold text-white animate-pulse">
                {notifications.length}
              </span>
            )}
          </button>

          {showNotifyPanel && (
            <div className={`absolute right-0 mt-3 w-72 md:w-80 rounded-3xl shadow-2xl border overflow-hidden animate-in slide-in-from-top-2 duration-200 z-[100] ${
              isDarkMode ? 'bg-[#151C26] border-gray-800 text-white' : 'bg-white border-gray-100 text-gray-900'
            }`}>
              <div className="p-6 border-b border-gray-800/50 flex justify-between items-center">
                <h4 className="font-black text-sm">Central de Alertas</h4>
                <button onClick={() => setShowNotifyPanel(false)}><X className="w-4 h-4 opacity-40 hover:opacity-100" /></button>
              </div>
              <div className="max-h-96 overflow-y-auto no-scrollbar">
                {notifications.length > 0 ? (
                  notifications.map((n) => (
                    <div key={n.id} className={`p-5 border-b border-gray-800/20 flex gap-4 hover:bg-white/5 transition-colors cursor-default animate-in fade-in`}>
                      <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${
                        n.type === 'info' ? 'bg-blue-500/10 text-blue-500' : 
                        n.type === 'alert' ? 'bg-[#007df7]/10 text-[#007df7]' : 'bg-[#007df7]/10 text-[#007df7]'
                      }`}>
                        {n.type === 'info' && <Info className="w-5 h-5" />}
                        {n.type === 'alert' && <AlertTriangle className="w-5 h-5" />}
                        {n.type === 'promo' && <Star className="w-5 h-5" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-black text-xs mb-1 leading-tight">{n.title}</p>
                        <p className="text-xs opacity-60 leading-relaxed mb-2 line-clamp-3">{n.message}</p>
                        <p className="text-[9px] uppercase font-black opacity-30 tracking-widest">{n.timestamp}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-12 text-center opacity-30 flex flex-col items-center">
                    <Bell className="w-10 h-10 mb-3" />
                    <p className="text-sm font-bold">Nada novo por aqui</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={profileRef}>
          <button 
            onClick={() => setShowDropdown(!showDropdown)} 
            className={`flex items-center gap-1.5 p-0.5 md:p-1 rounded-lg transition-all group ${
              showDropdown ? 'opacity-100' : 'opacity-90'
            }`}
          >
            <div className="w-8 h-8 md:w-9 md:h-9 rounded overflow-hidden shadow-lg group-hover:scale-105 transition-transform">
              <img src={activeProfile?.avatar || 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png'} className="w-full h-full object-cover" loading="lazy" />
            </div>
            <div className={`w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] transition-transform duration-300 ${isDarkMode ? 'border-t-white' : 'border-t-gray-800'} ${showDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showDropdown && (
            <div 
              className={`absolute right-0 mt-2 w-56 md:w-64 rounded-sm shadow-[0_0_20px_rgba(0,0,0,0.5)] border-t-2 border-t-white animate-in fade-in slide-in-from-top-1 duration-200 z-[200] ${
              isDarkMode ? 'bg-black text-white' : 'bg-white text-gray-900 border-x border-b border-black/5'
            }`}>
              {/* Seta superior */}
              <div className="absolute -top-[9px] right-3 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[8px] border-b-white" />

              {/* Lista de outros perfis */}
              <div className="p-2 space-y-1">
                {currentUser.profiles.filter(p => p.id !== activeProfile?.id).map(p => (
                  <button key={p.id} onClick={() => handleProfileSwitchRequest(p)} className="w-full flex items-center gap-3 px-3 py-2 rounded hover:underline transition-all group relative">
                    <div className="relative w-8 h-8 shrink-0">
                      <img src={p.avatar} className="w-full h-full rounded" loading="lazy" />
                      {p.pin && (
                        <div className="absolute inset-0 bg-black/50 rounded flex items-center justify-center">
                          <Lock className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-bold truncate">{p.name}</span>
                  </button>
                ))}
              </div>

              <div className={`h-[1px] w-full ${isDarkMode ? 'bg-white/10' : 'bg-black/5'}`} />

              <div className="p-2">
                <button onClick={() => { navigate('/perfil'); onSwitchProfile(); setShowDropdown(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold hover:underline opacity-80 hover:opacity-100 transition-all">
                  <Edit3 className="w-4 h-4 shrink-0" />
                  Gerenciar perfis
                </button>
              </div>

              <div className={`h-[1px] w-full ${isDarkMode ? 'bg-white/10' : 'bg-black/5'}`} />

              <div className="p-2 space-y-1">
                <button onClick={() => { navigate('/configuracoes'); setCurrentView('settings'); setShowDropdown(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold hover:underline opacity-80 hover:opacity-100 transition-all">
                  <UserIcon className="w-4 h-4 shrink-0" />
                  Configurações
                </button>
                <button onClick={() => { navigate('/ajuda'); setCurrentView('help'); setShowDropdown(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold hover:underline opacity-80 hover:opacity-100 transition-all">
                  <HelpCircle className="w-4 h-4 shrink-0" />
                  Central de Ajuda
                </button>
                {onOpenDiagnostics && (
                  <button onClick={() => { onOpenDiagnostics(); setShowDropdown(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold hover:underline opacity-80 hover:opacity-100 transition-all text-orange-400">
                    <Activity className="w-4 h-4 shrink-0" />
                    Diagnóstico do Catálogo
                  </button>
                )}
              </div>

              <div className={`h-[1px] w-full ${isDarkMode ? 'bg-white/10' : 'bg-black/5'}`} />

              <div className="p-0">
                <button 
                  onClick={() => { onLogout(); setShowDropdown(false); }} 
                  className="w-full py-4 text-center text-xs font-bold hover:underline transition-all text-[#007df7]"
                >
                  Sair da Zapi<span className="text-blue-500">TV</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Renderiza o modal se houver tentativa de troca protegida */}
      {renderPinModal()}
    </header>
  );
};

export default Header;
