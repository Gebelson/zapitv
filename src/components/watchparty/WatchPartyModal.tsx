import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Copy, Check, Play, X, Shield, ArrowRight, 
  Sparkles, Link2, Mic, MicOff, AlertCircle, Radio,
  Crown, Settings2, MessageSquare, Volume2, VolumeX,
  SlidersHorizontal, UserCheck, RefreshCw, LogOut, Send
} from 'lucide-react';
import { ContentItem } from '../../../types';
import { watchPartyService, WatchPartyService } from '../../core/watchparty/WatchPartyService';
import { uiSoundService } from '../../core/audio/uiSoundService';
import { 
  WatchPartyMediaMetadata, 
  WatchPartyChatMessage, 
  ParticipantPermissions,
  WatchPartyParticipant,
  TransmissionMode
} from '../../core/watchparty/watchPartyTypes';

interface WatchPartyModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: ContentItem | null;
  season?: number;
  episode?: number;
  currentProfileName?: string;
  onStartWatchPartyPlayback?: (item: ContentItem, season?: number, episode?: number) => void;
  onStartWatchPartyScreen?: () => void;
  initialRoomId?: string;
}

export const WatchPartyModal: React.FC<WatchPartyModalProps> = ({
  isOpen,
  onClose,
  item,
  season,
  episode,
  currentProfileName = 'Espectador',
  onStartWatchPartyPlayback,
  onStartWatchPartyScreen,
  initialRoomId
}) => {
  const [mode, setMode] = useState<'create' | 'join'>(initialRoomId ? 'join' : 'create');
  const [nickname, setNickname] = useState(currentProfileName || 'Convidado');
  const [joinInput, setJoinInput] = useState(initialRoomId || '');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isStartingShare, setIsStartingShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedTransmissionMode, setSelectedTransmissionMode] = useState<TransmissionMode>('host_broadcast');
  const [isMediaAuthorized, setIsMediaAuthorized] = useState(false);

  // Estado da Sala de Espera
  const [roomState, setRoomState] = useState(() => watchPartyService.getRoomState());
  const [activeTab, setActiveTab] = useState<'participants' | 'chat' | 'settings'>('participants');
  const [selectedPeerForPerms, setSelectedPeerForPerms] = useState<string | null>(null);

  // Chat no Lobby
  const [messages, setMessages] = useState<WatchPartyChatMessage[]>(() => watchPartyService.getChatHistory());
  const [chatInput, setChatInput] = useState('');
  const chatMessagesContainerRef = useRef<HTMLDivElement>(null);

  // Voz no Lobby
  const [isVoiceActive, setIsVoiceActive] = useState(() => watchPartyService.isVoiceActive());
  const [isMuted, setIsMuted] = useState(() => watchPartyService.isMicrophoneMuted());

  // Bloqueio de rolagem da página de fundo e suporte à tecla Escape
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const scrollY = window.scrollY;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        const state = watchPartyService.getRoomState();
        if (state.isActive && state.roomId) {
          watchPartyService.leaveRoom();
        }
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      window.scrollTo(0, scrollY);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onClose]);

  const hasAutoJoinedRef = useRef(false);

  useEffect(() => {
    if (initialRoomId) {
      setJoinInput(initialRoomId);
      setMode('join');
      if (!hasAutoJoinedRef.current && !watchPartyService.isConnected && !isJoining) {
        hasAutoJoinedRef.current = true;
        handleJoinRoom(initialRoomId);
      }
    }
  }, [initialRoomId]);

  useEffect(() => {
    if (currentProfileName) {
      setNickname(currentProfileName);
    }
  }, [currentProfileName]);

  // Sincronização de Estado da Watch Party
  useEffect(() => {
    const unsubState = watchPartyService.onStateChange((state) => {
      setRoomState(state);
      if (watchPartyService.roomInfo?.transmissionMode) {
        setSelectedTransmissionMode(watchPartyService.roomInfo.transmissionMode);
      }
    });

    const unsubChat = watchPartyService.onChatMessage((msg) => {
      setMessages(prev => [...prev, msg]);
      if (msg.senderId !== watchPartyService.selfId) uiSoundService.play('message');
    });

    const unsubVoice = watchPartyService.onVoiceStateChange((data) => {
      setIsVoiceActive(data.isVoiceActive);
      setIsMuted(data.isMuted);
    });

    // Transição automática para o Player quando a transmissão inicia (tanto para Transmissão do Host quanto Modo Sincronizado)
    const unsubTransmission = watchPartyService.onTransmissionStart((data: any) => {
      const media = data?.media || watchPartyService.roomInfo?.media;
      if (media && onStartWatchPartyPlayback) {
        const canonicalItem: ContentItem = {
          id: media.id || media.contentId || 'filme',
          title: media.title,
          type: (media.type as any) || 'movie',
          mediaFormat: media.mediaFormat,
          tmdbId: media.tmdbId,
          imdbId: media.imdbId,
          image: media.image || media.posterUrl || '',
          backdrop: media.backdrop || media.backdropUrl || '',
          year: media.year || new Date().getFullYear(),
          rating: 10,
          genres: []
        };
        onStartWatchPartyPlayback(canonicalItem, media.season, media.episode);
        onClose();
      } else if (data?.mode === 'screen' && onStartWatchPartyScreen) {
        onStartWatchPartyScreen();
        onClose();
      }
    });

    return () => {
      unsubState();
      unsubChat();
      unsubVoice();
      unsubTransmission();
    };
  }, [onStartWatchPartyPlayback, onStartWatchPartyScreen, onClose]);

  // Rolagem ISOLADA do chat — opera estritamente no container interno de mensagens,
  // sem nunca chamar scrollIntoView (que deslocava o modal e escondia o botão X)
  const scrollChatToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const el = chatMessagesContainerRef.current;
    if (!el) return;
    try {
      el.scrollTo({
        top: el.scrollHeight,
        behavior
      });
    } catch {
      el.scrollTop = el.scrollHeight;
    }
  };

  useEffect(() => {
    if (activeTab === 'chat') {
      const timer = setTimeout(() => {
        scrollChatToBottom('instant');
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'chat' && messages.length > 0) {
      scrollChatToBottom('smooth');
    }
  }, [messages.length, activeTab]);

  if (!isOpen) return null;

  const isConnected = roomState.isActive && roomState.roomId;
  const isHost = roomState.localParticipant.isHost;
  const roomMedia = roomState.mediaMetadata || (item ? WatchPartyService.normalizeMedia({
    ...item,
    season,
    episode
  }) : null);

  const extractRoomId = (input: string): string => {
    const trimmed = input.trim();
    if (trimmed.includes('/sala/')) {
      const parts = trimmed.split('/sala/');
      return parts[parts.length - 1].split('?')[0].split('#')[0].trim();
    }
    if (trimmed.includes('sala=')) {
      const match = trimmed.match(/sala=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) return match[1];
    }
    return trimmed;
  };

  const handleCopyLink = async () => {
    const link = watchPartyService.getInviteUrl(roomState.roomId || undefined);
    if (!link) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const input = document.createElement('input');
        input.value = link;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        input.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.warn('Erro ao copiar link:', e);
    }
  };

  const handleCreateRoom = async () => {
    if (!item) {
      setErrorMessage('Nenhum conteúdo selecionado para criar a sala.');
      return;
    }

    uiSoundService.prime();
    try {
      setIsCreating(true);
      setErrorMessage(null);

      const mediaMetadata: WatchPartyMediaMetadata = WatchPartyService.normalizeMedia({
        id: item.id,
        contentId: item.id,
        tmdbId: item.tmdbId,
        imdbId: item.imdbId,
        title: item.title,
        type: item.type,
        mediaFormat: item.mediaFormat,
        season,
        seasonNumber: season,
        episode,
        episodeNumber: episode,
        image: item.image,
        posterUrl: item.image,
        backdrop: item.backdrop,
        backdropUrl: item.backdrop,
        year: item.year
      });

      await watchPartyService.createRoom(
        mediaMetadata,
        nickname.trim() || 'Anfitrião',
        undefined,
        selectedTransmissionMode
      );
      uiSoundService.play('partyConnect');
    } catch (err: any) {
      console.error('Falha ao criar sala:', err);
      setErrorMessage(err.message || 'Falha ao conectar à rede P2P. Tente novamente.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async (overrideRoomId?: string) => {
    const rawTarget = typeof overrideRoomId === 'string' ? overrideRoomId : joinInput;
    const cleanRoomId = extractRoomId(rawTarget);
    if (!cleanRoomId) {
      setErrorMessage('Informe o código ou link completo da sala.');
      return;
    }

    uiSoundService.prime();
    try {
      setIsJoining(true);
      setErrorMessage(null);

      await watchPartyService.joinRoom(
        cleanRoomId,
        nickname.trim() || 'Convidado'
      );
      uiSoundService.play('partyConnect');
    } catch (err: any) {
      console.error('Falha ao entrar na sala:', err);
      setErrorMessage(err.message || 'Não foi possível entrar na sala. Verifique o código e tente novamente.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleStartSession = async (targetMode: TransmissionMode) => {
    if (!isHost) return;
    setErrorMessage(null);
    try {
      watchPartyService.setTransmissionMode(targetMode);
      watchPartyService.startTransmission(targetMode);
      const media = roomState.mediaMetadata || (item ? WatchPartyService.normalizeMedia({ ...item, season, episode }) : null);
      if (item && onStartWatchPartyPlayback) {
        onStartWatchPartyPlayback(item, season, episode);
        onClose();
      } else if (media && onStartWatchPartyPlayback) {
        const canonicalItem: ContentItem = {
          id: media.id || media.contentId || 'filme',
          title: media.title,
          type: (media.type as any) || 'movie',
          mediaFormat: media.mediaFormat,
          tmdbId: media.tmdbId,
          imdbId: media.imdbId,
          image: media.image || media.posterUrl || '',
          backdrop: media.backdrop || media.backdropUrl || '',
          year: media.year || new Date().getFullYear(),
          rating: 10,
          genres: []
        };
        onStartWatchPartyPlayback(canonicalItem, media.season, media.episode);
        onClose();
      }
    } catch (error: any) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível iniciar a transmissão.');
    }
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    watchPartyService.sendChatMessage(trimmed);
    setChatInput('');
  };

  const handleToggleVoice = async () => {
    try {
      if (!isVoiceActive) {
        const success = await watchPartyService.startVoiceChat();
        if (success) {
          setIsVoiceActive(true);
          setIsMuted(false);
        }
      } else {
        const currentlyMuted = watchPartyService.toggleMuteVoice();
        setIsMuted(currentlyMuted);
      }
    } catch (err: any) {
      console.warn('Erro ao alternar microfone:', err);
      setErrorMessage(err.message || 'Erro ao acessar microfone.');
    }
  };

  const handleLeaveRoom = () => {
    watchPartyService.leaveRoom();
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200 overflow-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isConnected) {
          onClose();
        }
      }}
    >
      <div 
        className="relative w-full max-w-2xl bg-[#0b0f19] border border-white/10 rounded-3xl p-4 sm:p-6 shadow-2xl text-white overflow-hidden max-h-[calc(100dvh-24px)] sm:max-h-[calc(100dvh-32px)] h-[min(680px,calc(100dvh-32px))] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow de fundo */}
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-[#007df7]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Botão Fechar Padrão (Idêntico ao ContentDetailModal) */}
        <button
          type="button"
          onClick={isConnected ? handleLeaveRoom : onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-50 w-9 h-9 sm:w-10 sm:h-10 bg-black/50 backdrop-blur-md border border-white/10 text-white rounded-full flex items-center justify-center hover:bg-white hover:text-black transition-all cursor-pointer"
          title={isConnected ? 'Sair da Sala' : 'Fechar'}
          aria-label={isConnected ? 'Sair da Sala' : 'Fechar'}
        >
          <X className="w-5 h-5" />
        </button>

        {/* ============================================================ */}
        {/* ESTADO 1: ENTRANDO / CRIANDO SALA (NÃO CONECTADO AINDA)       */}
        {/* ============================================================ */}
        {!isConnected ? (
          isJoining ? (
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#007df7]/20 to-cyan-400/20 border border-[#007df7]/40 flex items-center justify-center shadow-xl shadow-[#007df7]/20 animate-pulse">
                <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              </div>
              <div className="space-y-1.5 max-w-sm">
                <h3 className="text-lg font-black text-white">Conectando à Sala de Espera...</h3>
                <p className="text-xs text-gray-400">
                  Localizando a sessão do anfitrião e sincronizando informações de transmissão.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1.5 custom-scrollbar">
              {/* Cabeçalho */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#007df7] to-cyan-400 flex items-center justify-center shadow-lg shadow-[#007df7]/30">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-black text-white">Assistir Juntos</h2>
                    <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      P2P Gratuito
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Sala de espera sincronizada e chat integrado antes de iniciar
                  </p>
                </div>
              </div>

              {/* Informações da Mídia se selecionada */}
              {item && (
                <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-3">
                  <img 
                    src={item.image} 
                    alt={item.title} 
                    className="w-12 h-16 object-cover rounded-xl border border-white/10 shrink-0" 
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] uppercase font-bold text-[#007df7] tracking-wider block">
                      Conteúdo Selecionado
                    </span>
                    <h4 className="text-sm font-black text-white truncate">{item.title}</h4>
                    <p className="text-xs text-gray-400">
                      {season && episode ? `Temporada ${season} • Episódio ${episode}` : (item.year ? `${item.year}` : 'Filme completo')}
                    </p>
                  </div>
                </div>
              )}

              {/* Notificação de Erro */}
              {errorMessage && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex flex-col gap-2 text-xs text-red-300">
                  <div className="flex items-center gap-2 font-bold text-red-400">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Não foi possível conectar à sala</span>
                  </div>
                  <span>{errorMessage}</span>
                  {initialRoomId && (
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleJoinRoom(initialRoomId)}
                        className="px-3.5 py-1.5 bg-red-600/30 hover:bg-red-600/50 border border-red-500/40 rounded-xl text-white font-bold transition-all cursor-pointer"
                      >
                        Tentar Novamente
                      </button>
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-gray-300 font-bold transition-all cursor-pointer"
                      >
                        Fechar
                      </button>
                    </div>
                  )}
                </div>
              )}

            {/* Seletor de Abas Criar / Entrar */}
            <div className="grid grid-cols-2 p-1 bg-white/5 border border-white/10 rounded-2xl">
              <button
                type="button"
                onClick={() => setMode('create')}
                className={`py-2 text-xs font-black rounded-xl transition-all ${
                  mode === 'create'
                    ? 'bg-[#007df7] text-white shadow-md shadow-[#007df7]/30'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Criar Sala
              </button>
              <button
                type="button"
                onClick={() => setMode('join')}
                className={`py-2 text-xs font-black rounded-xl transition-all ${
                  mode === 'join'
                    ? 'bg-[#007df7] text-white shadow-md shadow-[#007df7]/30'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Entrar com Código
              </button>
            </div>

            {/* Campo de Apelido (Sem login obrigatório) */}
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                Seu Apelido na Sala
              </label>
              <input
                type="text"
                maxLength={24}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Ex: Carlos, Ana..."
                className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-[#007df7] rounded-2xl text-sm text-white placeholder-gray-500 outline-none transition-all"
              />
            </div>

            {mode === 'create' ? (
              <div className="space-y-4">
                <div className="p-3.5 bg-white/5 border border-white/5 rounded-2xl text-xs text-gray-300 space-y-1.5">
                  <div className="flex items-center gap-2 text-white font-bold">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span>Como funciona a Sala de Espera:</span>
                  </div>
                  <p>• Você entra primeiro na <strong>Sala de Espera</strong> e recebe um link seguro de convite.</p>
                  <p>• Converse pelo chat e teste o microfone antes de começar.</p>
                  <p>• O vídeo <strong>NUNCA toca sozinho</strong>. Você decide a hora exata de iniciar para todos.</p>
                </div>

                <button
                  type="button"
                  disabled={isCreating}
                  onClick={handleCreateRoom}
                  className="w-full py-3.5 bg-[#007df7] hover:bg-[#0069d9] active:scale-95 text-white font-black text-sm rounded-2xl shadow-xl shadow-[#007df7]/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {isCreating ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Criando Sala de Espera...</span>
                    </div>
                  ) : (
                    <>
                      <Users className="w-4 h-4" />
                      <span>Criar Sala de Espera</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                    Código ou Link da Sala
                  </label>
                  <div className="relative">
                    <Link2 className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={joinInput}
                      onChange={(e) => setJoinInput(e.target.value)}
                      placeholder="Cole o link ou código da sala..."
                      className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 focus:border-[#007df7] rounded-2xl text-white placeholder-gray-500 outline-none transition-all font-mono text-xs sm:text-sm"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isJoining || !joinInput.trim()}
                  onClick={() => handleJoinRoom()}
                  className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-[#007df7] hover:from-cyan-600 hover:to-[#0069d9] active:scale-95 text-white font-black text-sm rounded-2xl shadow-xl shadow-cyan-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {isJoining ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Entrando na Sala de Espera...</span>
                    </div>
                  ) : (
                    <>
                      <span>Entrar na Sala de Espera</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )
      ) : (
          /* ============================================================ */
          /* ESTADO 2: SALA DE ESPERA COMPARTILHADA (LOBBY EM TEMPO REAL)  */
          /* ============================================================ */
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden space-y-3">
            {/* Banner da Mídia Canônica da Sala */}
            <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-white/5 p-3 sm:p-3.5 flex items-center gap-3 shrink-0">
              {roomMedia?.backdrop && (
                <div 
                  className="absolute inset-0 bg-cover bg-center opacity-15 pointer-events-none"
                  style={{ backgroundImage: `url(${roomMedia.backdrop})` }}
                />
              )}
              <div className="relative z-10 shrink-0">
                {roomMedia?.image ? (
                  <img 
                    src={roomMedia.image} 
                    alt={roomMedia.title} 
                    className="w-14 h-20 sm:w-16 sm:h-24 object-cover rounded-xl border border-white/20 shadow-md"
                  />
                ) : (
                  <div className="w-14 h-20 sm:w-16 sm:h-24 rounded-xl bg-white/10 flex items-center justify-center text-gray-500">
                    <Users className="w-6 h-6" />
                  </div>
                )}
              </div>
              <div className="relative z-10 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-[#007df7]/25 text-[#007df7] border border-[#007df7]/40">
                    {roomMedia?.type === 'anime' ? 'Anime' : (roomMedia?.type === 'series' ? 'Série' : 'Filme')}
                  </span>
                  <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                    <Crown className="w-3 h-3 text-amber-400" />
                    Anfitrião: <strong className="text-white">{roomState.participants.find(p => p.isHost)?.nickname || 'Host'}</strong>
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-white truncate leading-snug">
                  {roomMedia?.title || 'Aguardando sincronização do anfitrião...'}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {roomMedia?.season && roomMedia?.episode 
                    ? `Temporada ${roomMedia.season} • Episódio ${roomMedia.episode}` 
                    : (roomMedia?.year ? `Ano ${roomMedia.year}` : 'Filme completo')}
                </p>
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-cyan-400">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Sessão P2P ponta a ponta criptografada</span>
                </div>
              </div>
            </div>

            {/* Link de Convite Compartilhável (Nunca localhost) */}
            <div className="shrink-0 p-2 sm:p-2.5 bg-black/40 border border-white/10 rounded-2xl flex items-center gap-2">
              <span className="text-[11px] font-bold text-gray-400 shrink-0 hidden sm:inline pl-2">
                Convite:
              </span>
              <input 
                type="text" 
                readOnly
                value={watchPartyService.getInviteUrl(roomState.roomId)}
                className="bg-transparent flex-1 text-xs text-gray-300 font-mono outline-none select-all px-2"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  copied 
                    ? 'bg-green-600 text-white shadow-md shadow-green-600/30' 
                    : 'bg-[#007df7] hover:bg-[#0069d9] text-white shadow-md shadow-[#007df7]/30'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>

            {/* Abas da Sala de Espera */}
            <div className="flex border-b border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('participants')}
                className={`pb-2.5 px-4 text-xs font-bold transition-all relative ${
                  activeTab === 'participants' ? 'text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Participantes ({roomState.participants.length}/6)</span>
                </span>
                {activeTab === 'participants' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#007df7] rounded-full" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                className={`pb-2.5 px-4 text-xs font-bold transition-all relative ${
                  activeTab === 'chat' ? 'text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                  <span>Chat da Sala ({messages.length})</span>
                </span>
                {activeTab === 'chat' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 rounded-full" />
                )}
              </button>

              {isHost && (
                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className={`pb-2.5 px-4 text-xs font-bold transition-all relative ${
                    activeTab === 'settings' ? 'text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Settings2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Controle do Host</span>
                  </span>
                  {activeTab === 'settings' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 rounded-full" />
                  )}
                </button>
              )}
            </div>

            {/* Conteúdo das Abas */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* ABA 1: LISTA DE PARTICIPANTES */}
              {activeTab === 'participants' && (
                <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-1.5 custom-scrollbar">
                  {roomState.participants.map((p) => {
                    const isSelf = p.peerId === roomState.localParticipant.id;
                    const isPeerHost = p.isHost;
                    const perms = watchPartyService.getParticipantPermissions(p.peerId);

                    return (
                      <div 
                        key={p.peerId}
                        className={`p-3 bg-white/5 border rounded-2xl flex flex-col gap-2 transition-all ${
                          p.isSpeaking ? 'border-emerald-500/50 shadow-md shadow-emerald-500/10' : 'border-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                                isPeerHost ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-[#007df7]/20 text-cyan-300 border border-[#007df7]/40'
                              }`}>
                                {p.nickname.slice(0, 2).toUpperCase()}
                              </div>
                              {p.isSpeaking && (
                                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-black animate-ping" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-white truncate">{p.nickname}</span>
                                {isSelf && (
                                  <span className="text-[10px] px-1.5 py-0.2 bg-[#007df7]/20 text-cyan-300 rounded font-semibold">
                                    Você
                                  </span>
                                )}
                                {isPeerHost && (
                                  <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded font-semibold flex items-center gap-1">
                                    <Crown className="w-2.5 h-2.5" /> Host
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                {p.isSpeaking ? (
                                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    Falando...
                                  </span>
                                ) : p.status === 'buffering' ? (
                                  'Preparando vídeo...'
                                ) : (
                                  'Conectado e pronto'
                                )}
                              </span>
                            </div>
                          </div>

                          {/* Controles de Áudio do Participante */}
                          <div className="flex items-center gap-2 shrink-0">
                            {!isSelf && (
                              <button
                                type="button"
                                onClick={() => watchPartyService.toggleMuteParticipantLocally(p.peerId)}
                                className={`p-1.5 rounded-xl border transition-all ${
                                  p.isLocallyMuted 
                                    ? 'bg-red-500/20 border-red-500/40 text-red-300' 
                                    : 'bg-white/5 border-white/10 text-gray-300 hover:text-white'
                                }`}
                                title={p.isLocallyMuted ? 'Desmutar para mim' : 'Silenciar para mim'}
                              >
                                {p.isLocallyMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                              </button>
                            )}

                            {/* Menu de Permissões (Apenas Host) */}
                            {isHost && !isSelf && (
                              <button
                                type="button"
                                onClick={() => setSelectedPeerForPerms(selectedPeerForPerms === p.peerId ? null : p.peerId)}
                                className={`p-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-all ${
                                  selectedPeerForPerms === p.peerId 
                                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' 
                                    : 'bg-white/5 border-white/10 text-gray-300 hover:text-white'
                                }`}
                                title="Gerenciar permissões deste participante"
                              >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Painel Expansível de Permissões do Participante */}
                        {isHost && !isSelf && selectedPeerForPerms === p.peerId && (
                          <div className="mt-1 pt-2 border-t border-white/10 grid grid-cols-2 gap-2 text-xs">
                            <label className="flex items-center gap-2 p-2 bg-black/30 rounded-xl cursor-pointer hover:bg-black/50">
                              <input 
                                type="checkbox"
                                checked={perms.canPlayPause}
                                onChange={(e) => watchPartyService.setParticipantPermission(p.peerId, 'canPlayPause', e.target.checked)}
                                className="rounded text-[#007df7] focus:ring-0"
                              />
                              <span className="text-[11px] text-gray-200">Pausar / Retomar</span>
                            </label>

                            <label className="flex items-center gap-2 p-2 bg-black/30 rounded-xl cursor-pointer hover:bg-black/50">
                              <input 
                                type="checkbox"
                                checked={perms.canSeek}
                                onChange={(e) => watchPartyService.setParticipantPermission(p.peerId, 'canSeek', e.target.checked)}
                                className="rounded text-[#007df7] focus:ring-0"
                              />
                              <span className="text-[11px] text-gray-200">Avançar / Seek</span>
                            </label>

                            <label className="flex items-center gap-2 p-2 bg-black/30 rounded-xl cursor-pointer hover:bg-black/50">
                              <input 
                                type="checkbox"
                                checked={perms.canChangeEpisode}
                                onChange={(e) => watchPartyService.setParticipantPermission(p.peerId, 'canChangeEpisode', e.target.checked)}
                                className="rounded text-[#007df7] focus:ring-0"
                              />
                              <span className="text-[11px] text-gray-200">Trocar Episódio</span>
                            </label>

                            <button
                              type="button"
                              onClick={() => watchPartyService.transferHost(p.peerId)}
                              className="p-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5"
                            >
                              <Crown className="w-3 h-3" /> Tornar Host
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ABA 2: CHAT DA SALA */}
              {activeTab === 'chat' && (
                <div className="flex-1 min-h-0 flex flex-col space-y-2 overflow-hidden">
                  <div 
                    ref={chatMessagesContainerRef}
                    className="flex-1 min-h-0 overflow-y-auto space-y-2 p-2.5 sm:p-3 bg-black/30 rounded-2xl border border-white/5 custom-scrollbar"
                  >
                    {messages.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-gray-500 py-8">
                        Nenhuma mensagem ainda. Diga oi para o grupo!
                      </div>
                    ) : (
                      messages.map((m) => (
                        <div key={m.id} className="text-xs">
                          <div className="flex items-baseline gap-1.5">
                            <span className={`font-bold ${m.isHost ? 'text-amber-400' : 'text-cyan-400'}`}>
                              {m.senderNickname}
                            </span>
                            {m.isHost && (
                              <span className="text-[9px] uppercase px-1 bg-amber-500/20 text-amber-300 rounded font-black">
                                Host
                              </span>
                            )}
                            <span className="text-[9px] text-gray-500">
                              {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-gray-200 mt-0.5 break-words">{m.text}</p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Input do Chat */}
                  {roomState.permissions.allowChat || isHost ? (
                    <form onSubmit={handleSendMessage} className="flex gap-2 shrink-0 pt-0.5">
                      <input 
                        type="text"
                        value={chatInput}
                        maxLength={280}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Digite uma mensagem na sala..."
                        className="flex-1 px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 outline-none focus:border-purple-500 transition-colors"
                      />
                      <button
                        type="submit"
                        disabled={!chatInput.trim()}
                        className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  ) : (
                    <div className="shrink-0 p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-center text-xs text-red-300">
                      O anfitrião desativou o envio de mensagens nesta sala.
                    </div>
                  )}
                </div>
              )}

              {/* ABA 3: CONFIGURAÇÕES DA SALA (ANFITRIÃO) */}
              {activeTab === 'settings' && isHost && (
                <div className="flex-1 min-h-0 overflow-y-auto space-y-3 p-1 pr-1.5 custom-scrollbar">
                  <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white">Permitir Mensagens de Chat</h4>
                      <p className="text-[11px] text-gray-400">Permite que todos os participantes enviem mensagens no chat</p>
                    </div>
                    <input 
                      type="checkbox"
                      checked={roomState.permissions.allowChat}
                      onChange={(e) => watchPartyService.setRoomConfig({ allowChat: e.target.checked })}
                      className="w-4 h-4 rounded text-[#007df7] focus:ring-0"
                    />
                  </div>

                  <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white">Permitir Chat de Voz (Microfone)</h4>
                      <p className="text-[11px] text-gray-400">Permite que participantes ativem seus microfones via WebRTC</p>
                    </div>
                    <input 
                      type="checkbox"
                      checked={roomState.permissions.allowVoice}
                      onChange={(e) => watchPartyService.setRoomConfig({ allowVoice: e.target.checked })}
                      className="w-4 h-4 rounded text-[#007df7] focus:ring-0"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Barra de Microfone no Lobby */}
            <div className="shrink-0 p-2 sm:p-2.5 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleVoice}
                  className={`p-2 rounded-xl transition-all flex items-center gap-2 ${
                    isVoiceActive && !isMuted
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/40 ring-1 ring-emerald-400' 
                      : isVoiceActive && isMuted
                      ? 'bg-amber-600/80 text-white'
                      : 'bg-white/10 text-gray-300 hover:text-white'
                  }`}
                >
                  {isVoiceActive && !isMuted ? <Mic className="w-4 h-4 animate-pulse" /> : <MicOff className="w-4 h-4" />}
                  <span className="text-xs font-bold">
                    {!isVoiceActive 
                      ? 'Ligar Microfone' 
                      : isMuted 
                      ? 'Microfone Mutado' 
                      : 'Microfone Aberto'}
                  </span>
                </button>
                {roomState.localParticipant.isSpeaking && (
                  <span className="text-[10px] text-emerald-400 font-bold hidden sm:inline animate-pulse">
                    Você está falando...
                  </span>
                )}
              </div>

              <div className="text-[11px] text-gray-400">
                Cancelamento de eco e ruído ativos
              </div>
            </div>

            {/* Rodapé de Ação: Início pelo Anfitrião ou Espera pelo Convidado */}
            <div className="pt-1 shrink-0">
              {isHost ? (
                <div className="space-y-2">
                  {/* Seletor de Modo de Watch Party */}
                  <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 border border-white/10 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTransmissionMode('host_broadcast');
                        watchPartyService.setTransmissionMode('host_broadcast');
                      }}
                      className={`p-2.5 rounded-xl text-left transition-all flex items-start gap-2 ${
                        selectedTransmissionMode === 'host_broadcast'
                          ? 'bg-[#007df7] text-white shadow-md shadow-[#007df7]/30'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Radio className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-black">Transmissão do Host</div>
                        <div className="text-[10px] opacity-80 leading-tight">WebRTC direto sem busca de fontes</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTransmissionMode('source');
                        watchPartyService.setTransmissionMode('source');
                      }}
                      className={`p-2.5 rounded-xl text-left transition-all flex items-start gap-2 ${
                        selectedTransmissionMode === 'source'
                          ? 'bg-[#007df7] text-white shadow-md shadow-[#007df7]/30'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Users className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-black">Modo Sincronizado</div>
                        <div className="text-[10px] opacity-80 leading-tight">Fontes individuais sincronizadas</div>
                      </div>
                    </button>
                  </div>

                  {/* Botão de Início conforme Modo Escolhido */}
                  {selectedTransmissionMode === 'host_broadcast' ? (
                    <div>
                      <button
                        type="button"
                        onClick={() => handleStartSession('host_broadcast')}
                        className="w-full py-3.5 bg-gradient-to-r from-[#007df7] to-cyan-500 hover:from-[#0069d9] hover:to-cyan-600 active:scale-95 text-white font-black text-sm rounded-2xl shadow-xl shadow-[#007df7]/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
                      >
                        <Radio className="w-4 h-4 animate-pulse" />
                        <span>INICIAR TRANSMISSÃO DO HOST (WEBRTC)</span>
                      </button>
                      <p className="text-[11px] text-gray-400 text-center mt-1.5">
                        Transmite áudio e vídeo do seu player diretamente para a sala.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <button
                        type="button"
                        onClick={() => handleStartSession('source')}
                        className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 active:scale-95 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
                      >
                        <Play className="w-4 h-4 fill-white" />
                        <span>INICIAR MODO SINCRONIZADO</span>
                      </button>
                      <p className="text-[11px] text-gray-400 text-center mt-1.5">
                        Cada participante carrega a fonte em seu dispositivo com timeline sincronizada.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="p-3.5 bg-[#007df7]/10 border border-[#007df7]/30 rounded-2xl text-center space-y-1">
                    <div className="inline-flex items-center gap-2 text-cyan-400 font-bold text-xs">
                      <Radio className="w-4 h-4 animate-pulse" />
                      <span>Aguardando o anfitrião iniciar a transmissão...</span>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      {watchPartyService.roomInfo?.transmissionMode === 'host_broadcast'
                        ? 'Modo: Transmissão do Host (WebRTC). Você assistirá ao fluxo direto do anfitrião.'
                        : 'Modo: Sincronizado. A intro do ZapiTV e o vídeo começarão juntos para todos.'}
                    </p>
                  </div>

                  {/* Pré-autorização explícita de áudio e vídeo pelo convidado no lobby */}
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
                        if (AudioCtx) {
                          const ctx = new AudioCtx();
                          ctx.resume().catch(() => {});
                        }
                      } catch {}
                      setIsMediaAuthorized(true);
                      watchPartyService.reportLocalStatus('ready');
                    }}
                    className={`w-full py-2.5 px-4 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      isMediaAuthorized
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 cursor-default'
                        : 'bg-white/5 hover:bg-white/10 border-white/20 text-white cursor-pointer active:scale-98'
                    }`}
                  >
                    {isMediaAuthorized ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Áudio e vídeo autorizados para início sincronizado</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-4 h-4 text-[#007df7]" />
                        <span>Clique aqui para autorizar reprodução com som no navegador</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
