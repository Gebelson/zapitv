import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, MessageSquare, Mic, MicOff, Copy, Check, 
  LogOut, Send, Crown, Volume2, VolumeX, X, Radio, 
  SlidersHorizontal, Sparkles
} from 'lucide-react';
import { watchPartyService } from '../../core/watchparty/WatchPartyService';
import { 
  WatchPartyChatMessage, 
  WatchPartyParticipant 
} from '../../core/watchparty/watchPartyTypes';

interface WatchPartyOverlayProps {
  onLeaveRoom?: () => void;
  isPlayerControlsVisible?: boolean;
}

export const WatchPartyOverlay: React.FC<WatchPartyOverlayProps> = ({
  onLeaveRoom,
  isPlayerControlsVisible = true
}) => {
  const [roomState, setRoomState] = useState(() => 
    watchPartyService.getRoomState()
  );
  const [messages, setMessages] = useState<WatchPartyChatMessage[]>(() => 
    watchPartyService.getChatHistory()
  );
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [showParticipantsList, setShowParticipantsList] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(() => watchPartyService.isVoiceActive());
  const [isMuted, setIsMuted] = useState(() => watchPartyService.isMicrophoneMuted());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const toastTimeoutRef = useRef<any>(null);

  const showToast = (text: string) => {
    setToastMessage(text);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  useEffect(() => {
    const unsubscribeState = watchPartyService.onStateChange((state) => {
      setRoomState(state);
    });

    const unsubscribeChat = watchPartyService.onChatMessage((msg) => {
      setMessages(prev => [...prev, msg]);
      if (!isChatOpen) {
        setUnreadCount(prev => prev + 1);
      }
    });

    const unsubscribeParticipants = watchPartyService.onParticipantChange((participants) => {
      setRoomState(prev => ({
        ...prev,
        participants
      }));
    });

    const unsubscribeBuffering = watchPartyService.onBufferingChange((peerId, isBuffering) => {
      const p = watchPartyService.getRoomState()?.participants.find(x => x.peerId === peerId || (x as any).id === peerId);
      const name = p ? p.nickname : 'Um participante';
      if (isBuffering) {
        showToast(`${name} está carregando o vídeo...`);
      }
    });

    const unsubscribeVoice = watchPartyService.onVoiceStateChange((data) => {
      setIsVoiceActive(data.isVoiceActive);
      setIsMuted(data.isMuted);
    });

    return () => {
      unsubscribeState();
      unsubscribeChat();
      unsubscribeParticipants();
      unsubscribeBuffering();
      unsubscribeVoice();
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, [isChatOpen]);

  useEffect(() => {
    if (isChatOpen) {
      setUnreadCount(0);
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isChatOpen, messages.length]);

  if (!roomState || !roomState.isActive) {
    return null;
  }

  const isHost = roomState.localParticipant.isHost;
  const participantCount = roomState.participants.length;

  // Verifica se alguém na sala está falando no momento
  const someoneSpeaking = roomState.participants.find(p => p.isSpeaking);

  const handleCopyInvite = async () => {
    try {
      const origin = window.location.origin;
      const link = `${origin}/sala/${roomState.roomId}`;
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
      showToast('Link de convite copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Erro ao copiar link:', e);
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
          showToast('Microfone ativado na Watch Party.');
        } else {
          showToast('Permissão de microfone não concedida.');
        }
      } else {
        const currentlyMuted = watchPartyService.toggleMuteVoice();
        setIsMuted(currentlyMuted);
        showToast(currentlyMuted ? 'Microfone silenciado.' : 'Microfone desmutado.');
      }
    } catch (err: any) {
      console.error('Falha de microfone:', err);
      showToast('Erro ao acessar microfone.');
    }
  };

  const handleStopVoice = () => {
    watchPartyService.stopVoiceChat();
    setIsVoiceActive(false);
    setIsMuted(true);
    showToast('Voz desativada.');
  };

  const handleLeave = () => {
    if (window.confirm('Deseja realmente sair da Watch Party? Você continuará assistindo normalmente de onde parou.')) {
      watchPartyService.leaveRoom();
      if (onLeaveRoom) onLeaveRoom();
    }
  };

  return (
    <>
      {/* Toast Notificação de Sincronia / Entrada / Voz */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[4600] pointer-events-none animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="px-4 py-2 bg-black/90 backdrop-blur-md border border-cyan-500/40 rounded-full text-white text-xs font-semibold shadow-2xl flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Barra Superior / Pílula da Watch Party */}
      <div 
        className={`absolute top-4 left-4 z-[4500] flex items-center gap-2 transition-all duration-300 ${
          isPlayerControlsVisible || isChatOpen || showParticipantsList ? 'opacity-100' : 'opacity-75 hover:opacity-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pílula Principal */}
        <div className="flex items-center gap-1.5 p-1 bg-black/75 backdrop-blur-md border border-white/15 rounded-full text-white shadow-2xl">
          {/* Status badge & lista de participantes */}
          <button
            type="button"
            onClick={() => setShowParticipantsList(prev => !prev)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors text-xs font-bold"
            title="Ver participantes e áudio individual"
          >
            <div className="relative">
              <span className={`w-2 h-2 rounded-full block ${someoneSpeaking ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-ping' : 'bg-emerald-500 animate-pulse'}`} />
            </div>
            <span className="tracking-wide">Watch Party</span>
            {someoneSpeaking && (
              <span className="text-[10px] text-emerald-300 font-bold hidden sm:inline flex items-center gap-1">
                • {someoneSpeaking.nickname || 'Amigo'} falando
              </span>
            )}
            <span className="bg-white/15 px-2 py-0.5 rounded-full text-[10px] text-cyan-300 font-mono">
              {participantCount}/6
            </span>
          </button>

          {/* Botão Copiar Convite */}
          <button
            type="button"
            onClick={handleCopyInvite}
            className="p-1.5 rounded-full text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
            title="Copiar link de convite"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>

          {/* Botão Microfone / Voz P2P */}
          <button
            type="button"
            onClick={handleToggleVoice}
            className={`relative p-1.5 rounded-full transition-all ${
              isVoiceActive && !isMuted
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/40 ring-2 ring-emerald-400/50' 
                : isVoiceActive && isMuted
                ? 'bg-amber-600/80 text-white hover:bg-amber-600'
                : 'text-gray-300 hover:text-white hover:bg-white/10'
            }`}
            title={
              !isVoiceActive 
                ? 'Ativar Microfone (Voz P2P)' 
                : isMuted 
                ? 'Desmutar Microfone' 
                : 'Silenciar Microfone'
            }
          >
            {isVoiceActive && !isMuted ? (
              <Mic className="w-4 h-4 animate-pulse" />
            ) : (
              <MicOff className="w-4 h-4" />
            )}
            {/* Indicador de fala local */}
            {roomState.localParticipant.isSpeaking && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,1)] animate-ping" />
            )}
          </button>

          {/* Botão Chat com Badge */}
          <button
            type="button"
            onClick={() => setIsChatOpen(prev => !prev)}
            className={`relative p-1.5 rounded-full transition-colors ${
              isChatOpen 
                ? 'bg-[#007df7] text-white shadow-md shadow-[#007df7]/30' 
                : 'text-gray-300 hover:text-white hover:bg-white/10'
            }`}
            title="Abrir Chat da Sala"
          >
            <MessageSquare className="w-4 h-4" />
            {unreadCount > 0 && !isChatOpen && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center animate-bounce">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Botão Sair */}
          <button
            type="button"
            onClick={handleLeave}
            className="p-1.5 rounded-full text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-colors"
            title="Sair da Watch Party"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Menu Flutuante de Participantes & Ajuste de Volume Individual */}
        {showParticipantsList && (
          <div 
            className="absolute top-12 left-0 w-80 bg-[#0e131d]/95 backdrop-blur-2xl border border-white/15 rounded-3xl p-4 shadow-2xl text-white space-y-3 animate-in fade-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10 text-xs font-bold text-gray-400 uppercase tracking-wider">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span>Participantes ({participantCount}/6)</span>
              </div>
              <button 
                onClick={() => setShowParticipantsList(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Painel de Controles Rápidos de Microfone do Usuário */}
            <div className="p-2.5 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-xl ${isVoiceActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-gray-400'}`}>
                  {isVoiceActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </div>
                <div>
                  <span className="font-bold text-white block">Seu Microfone</span>
                  <span className="text-[10px] text-gray-400">
                    {!isVoiceActive ? 'Desativado' : isMuted ? 'Silenciado' : 'Ativo e transmitindo'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {isVoiceActive ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const m = watchPartyService.toggleMuteVoice();
                        setIsMuted(m);
                      }}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-colors ${
                        isMuted 
                          ? 'bg-amber-600 text-white' 
                          : 'bg-white/10 text-white hover:bg-white/20'
                      }`}
                    >
                      {isMuted ? 'Desmutar' : 'Silenciar'}
                    </button>
                    <button
                      type="button"
                      onClick={handleStopVoice}
                      className="p-1 rounded-xl text-red-400 hover:bg-red-500/20"
                      title="Desativar Voz"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleToggleVoice}
                    className="px-3 py-1 bg-[#007df7] hover:bg-[#0069d9] text-white rounded-xl text-[11px] font-bold shadow-md shadow-[#007df7]/30 transition-colors"
                  >
                    Ativar
                  </button>
                )}
              </div>
            </div>

            {/* Lista com Volumes Individuais */}
            <div className="max-h-56 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {roomState.participants.map((p) => {
                const isMe = p.peerId === roomState.localParticipant.peerId || (p as any).id === roomState.localParticipant.id;
                const volumeVal = p.audioVolume !== undefined ? p.audioVolume : 1.0;
                const isMutedLocally = Boolean(p.isLocallyMuted);

                return (
                  <div 
                    key={p.peerId || (p as any).id}
                    className="p-2.5 rounded-2xl bg-white/5 border border-white/5 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate">
                        {/* Avatar com halo de fala suave */}
                        <div className={`relative w-7 h-7 rounded-full bg-gradient-to-tr from-[#007df7] to-cyan-400 flex items-center justify-center font-bold text-[10px] text-white shrink-0 transition-all ${
                          p.isSpeaking 
                            ? 'ring-2 ring-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)] animate-pulse' 
                            : 'ring-1 ring-white/10'
                        }`}>
                          {(p.nickname || 'Amigo').slice(0, 2).toUpperCase()}
                          {p.isSpeaking && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border border-black rounded-full" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <span className="font-semibold truncate text-white block">
                            {p.nickname || 'Convidado'} {isMe && '(Você)'}
                          </span>
                          <span className="text-[10px] text-gray-400 flex items-center gap-1">
                            {p.isSpeaking ? (
                              <span className="text-emerald-400 font-bold animate-pulse">Falando...</span>
                            ) : p.isAudioMuted ? (
                              <span className="text-gray-500">Mic desligado</span>
                            ) : (
                              <span className="text-gray-400">Na chamada</span>
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {p.isHost && (
                          <span title="Anfitrião da Sala" className="p-1">
                            <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                          </span>
                        )}
                        {p.status === 'buffering' && (
                          <span className="text-[10px] text-amber-400 animate-pulse font-mono bg-amber-500/10 px-1.5 py-0.5 rounded">
                            Buffering...
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Controle de volume individual para os outros participantes */}
                    {!isMe && (
                      <div className="pt-1.5 border-t border-white/5 flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            watchPartyService.toggleMuteParticipantLocally(p.peerId || (p as any).id);
                          }}
                          className={`p-1 rounded-lg transition-colors ${
                            isMutedLocally ? 'text-red-400 hover:text-red-300' : 'text-gray-400 hover:text-white'
                          }`}
                          title={isMutedLocally ? 'Desmutar este participante' : 'Silenciar este participante'}
                        >
                          {isMutedLocally ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                        </button>

                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          disabled={isMutedLocally}
                          value={isMutedLocally ? 0 : volumeVal}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            watchPartyService.setParticipantAudioVolume(p.peerId || (p as any).id, val);
                          }}
                          className="flex-1 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#007df7] disabled:opacity-30"
                          title={`Volume: ${Math.round(volumeVal * 100)}%`}
                        />

                        <span className="text-[10px] font-mono text-gray-400 w-8 text-right">
                          {isMutedLocally ? 'Mudo' : `${Math.round(volumeVal * 100)}%`}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-white/10 text-[11px] text-gray-400 space-y-1.5">
              <div className="flex items-center justify-between">
                <span>Controle da reprodução:</span>
                <span className="font-bold text-cyan-300">
                  {isHost ? 'Você comanda' : 'Anfitrião comanda'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1 border-t border-white/5">
                <span className="flex items-center gap-1 text-emerald-400/90 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  WebRTC P2P Direto
                </span>
                <span 
                  className="cursor-help hover:text-gray-300 transition-colors"
                  title="Conexão criptografada direta ponto a ponto sem servidores intermediários. Redes com firewall corporativo restritivo ou CGNAT duplo podem exigir Wi-Fi doméstico ou 4G/5G."
                >
                  Firewall/NAT Info
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Painel Lateral Flutuante do Chat */}
      {isChatOpen && (
        <div 
          className="absolute top-0 right-0 bottom-0 w-80 sm:w-96 bg-black/90 backdrop-blur-2xl border-l border-white/15 z-[4600] flex flex-col shadow-2xl text-white animate-in slide-in-from-right duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Topo do Chat */}
          <div className="px-4 py-3.5 border-b border-white/10 flex items-center justify-between bg-white/5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#007df7] flex items-center justify-center text-white">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Chat da Sala</h4>
                <p className="text-[10px] text-gray-400">
                  {roomState.mediaMetadata?.title || 'Watch Party'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsChatOpen(false)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Fechar Chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Histórico de Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-gray-400 space-y-2">
                <MessageSquare className="w-8 h-8 text-gray-600 stroke-1" />
                <p className="text-xs">Nenhuma mensagem ainda.</p>
                <p className="text-[11px] text-gray-500">
                  Mande um oi e comente sobre o filme com seus amigos!
                </p>
              </div>
            ) : (
              messages.map((m) => {
                const isMe = m.senderId === roomState.localParticipant.peerId || m.senderId === (roomState.localParticipant as any).id;
                const timeStr = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                return (
                  <div 
                    key={m.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 text-[10px] text-gray-400">
                      <span className="font-bold text-gray-300">{m.senderNickname}</span>
                      {m.isHost && (
                        <Crown className="w-3 h-3 text-amber-400 fill-amber-400 inline" />
                      )}
                      <span>•</span>
                      <span>{timeStr}</span>
                    </div>

                    <div 
                      className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-xs leading-relaxed break-words ${
                        isMe 
                          ? 'bg-[#007df7] text-white rounded-tr-none shadow-md shadow-[#007df7]/20' 
                          : 'bg-white/10 text-gray-100 rounded-tl-none border border-white/5'
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Barra de Entrada de Mensagem */}
          <form 
            onSubmit={handleSendMessage}
            className="p-3 border-t border-white/10 bg-white/5 flex items-center gap-2"
          >
            <input
              type="text"
              maxLength={280}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Digite uma mensagem..."
              className="flex-1 px-3.5 py-2.5 bg-black/50 border border-white/15 focus:border-[#007df7] rounded-xl text-xs text-white placeholder-gray-500 outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={!chatInput.trim()}
              className="p-2.5 bg-[#007df7] hover:bg-[#0069d9] active:scale-95 disabled:opacity-40 text-white rounded-xl transition-all shadow-md shadow-[#007df7]/30"
              title="Enviar"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
