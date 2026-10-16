import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Copy, Check, Play, X, Shield, ArrowRight, 
  Sparkles, Link2, Mic, AlertCircle, Radio
} from 'lucide-react';
import { ContentItem } from '../../../types';
import { watchPartyService } from '../../core/watchparty/WatchPartyService';
import { WatchPartyMediaMetadata } from '../../core/watchparty/watchPartyTypes';

interface WatchPartyModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: ContentItem | null;
  season?: number;
  episode?: number;
  currentProfileName?: string;
  onStartWatchPartyPlayback?: (item: ContentItem, season?: number, episode?: number) => void;
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
  initialRoomId
}) => {
  const [mode, setMode] = useState<'create' | 'join'>(initialRoomId ? 'join' : 'create');
  const [nickname, setNickname] = useState(currentProfileName || 'Convidado');
  const [joinInput, setJoinInput] = useState(initialRoomId || '');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialRoomId) {
      setJoinInput(initialRoomId);
      setMode('join');
    }
  }, [initialRoomId]);

  useEffect(() => {
    if (currentProfileName) {
      setNickname(currentProfileName);
    }
  }, [currentProfileName]);

  if (!isOpen) return null;

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

  const getInviteLink = (roomId: string) => {
    const origin = window.location.origin;
    return `${origin}/sala/${roomId}`;
  };

  const handleCopyLink = async () => {
    if (!createdRoomId) return;
    try {
      const link = getInviteLink(createdRoomId);
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

    try {
      setIsCreating(true);
      setErrorMessage(null);

      const mediaMetadata: WatchPartyMediaMetadata = {
        contentId: item.id,
        tmdbId: item.tmdbId,
        title: item.title,
        type: item.type as any,
        seasonNumber: season,
        episodeNumber: episode,
        posterUrl: item.image,
        backdropUrl: item.backdrop
      };

      const roomId = await watchPartyService.createRoom(
        nickname.trim() || 'Anfitrião',
        mediaMetadata
      );

      setCreatedRoomId(roomId);
    } catch (err: any) {
      console.error('Falha ao criar sala:', err);
      setErrorMessage(err.message || 'Falha ao conectar aos nós P2P. Tente novamente.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleLaunchPlayback = () => {
    if (item && onStartWatchPartyPlayback) {
      onStartWatchPartyPlayback(item, season, episode);
      onClose();
    }
  };

  const handleJoinRoom = async () => {
    const cleanRoomId = extractRoomId(joinInput);
    if (!cleanRoomId) {
      setErrorMessage('Informe o código ou o link da sala.');
      return;
    }

    try {
      setIsJoining(true);
      setErrorMessage(null);

      const joinedRoomId = await watchPartyService.joinRoom(
        cleanRoomId,
        nickname.trim() || 'Convidado'
      );

      // Aguarda receber os metadados da sala do Host
      const state = watchPartyService.getRoomState();
      if (state && state.mediaMetadata && onStartWatchPartyPlayback) {
        // Objeto de mídia sintetizado ou reconstruído
        const media = state.mediaMetadata;
        const synthItem: ContentItem = {
          id: media.contentId,
          tmdbId: media.tmdbId,
          title: media.title,
          type: media.type as any,
          image: media.posterUrl || '',
          backdrop: media.backdropUrl || '',
          year: new Date().getFullYear(),
          rating: 10,
          genres: []
        };
        onStartWatchPartyPlayback(synthItem, media.seasonNumber, media.episodeNumber);
        onClose();
      } else {
        // Conexão iniciada, o player assumirá a sincronia assim que o host responder
        onClose();
      }
    } catch (err: any) {
      console.error('Falha ao entrar na sala:', err);
      setErrorMessage(err.message || 'Não foi possível entrar na sala. Verifique o código e tente novamente.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !createdRoomId) {
          onClose();
        }
      }}
    >
      <div 
        className="relative w-full max-w-lg bg-[#0e131d] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl text-white overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow de fundo */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#007df7]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Botão Fechar */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors z-10"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cabeçalho */}
        <div className="flex items-center gap-3 mb-6">
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
              Assista a filmes e séries sincronizados com seus amigos em tempo real
            </p>
          </div>
        </div>

        {/* Informações da Mídia se selecionada */}
        {item && (
          <div className="mb-6 p-3 sm:p-3.5 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-3">
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
          <div className="mb-5 p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Estado 1: Sala já criada com sucesso */}
        {createdRoomId ? (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl text-center">
              <div className="inline-flex items-center gap-2 text-green-400 font-bold text-sm mb-1">
                <Radio className="w-4 h-4 animate-pulse" />
                <span>Sala P2P Criada com Sucesso!</span>
              </div>
              <p className="text-xs text-gray-300">
                Compartilhe o link abaixo com seus amigos. Quando eles entrarem, o player de todos será sincronizado com o seu.
              </p>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">
                Link de Convite
              </label>
              <div className="flex items-center gap-2 p-2.5 bg-black/40 border border-white/15 rounded-2xl">
                <input
                  type="text"
                  readOnly
                  value={getInviteLink(createdRoomId)}
                  className="bg-transparent flex-1 text-xs text-white outline-none select-all px-2 font-mono"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    copied 
                      ? 'bg-green-600 text-white shadow-lg shadow-green-600/30' 
                      : 'bg-[#007df7] hover:bg-[#0069d9] text-white shadow-lg shadow-[#007df7]/30'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
              <span>Código da sala: <strong className="text-white font-mono">{createdRoomId}</strong></span>
              <span className="flex items-center gap-1 text-cyan-400">
                <Shield className="w-3 h-3" /> Conexão Direta Criptografada
              </span>
            </div>

            <p className="text-[10px] text-gray-400/80 leading-relaxed text-center px-2">
              🔒 Comunicação P2P gratuita ponta a ponta. Caso algum colega em rede corporativa com firewall restrito (NAT simétrico) não consiga conectar, use Wi-Fi doméstico ou conexão móvel (4G/5G).
            </p>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={handleLaunchPlayback}
                className="w-full py-3.5 bg-gradient-to-r from-[#007df7] to-cyan-500 hover:from-[#0069d9] hover:to-cyan-600 text-white font-black text-sm rounded-2xl shadow-xl shadow-[#007df7]/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Iniciar Reprodução na Sala</span>
              </button>
            </div>
          </div>
        ) : (
          /* Estado 2: Abas de Criação ou Entrada */
          <div className="space-y-5">
            {/* Abas */}
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

            {/* Campo Apelido */}
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
              <div className="space-y-4 pt-1">
                <div className="p-3.5 bg-white/5 border border-white/5 rounded-2xl text-xs text-gray-300 space-y-1.5">
                  <div className="flex items-center gap-2 text-white font-bold">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span>Como funciona:</span>
                  </div>
                  <p>• Você é o anfitrião e comanda o Play, Pause, Seek e troca de episódios.</p>
                  <p>• Cada participante assiste com seu próprio áudio, idioma e volume individual.</p>
                  <p>• Sem custos, sem cadastro e com chat integrado em tempo real.</p>
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
                      <span>Conectando à malha P2P...</span>
                    </div>
                  ) : (
                    <>
                      <Users className="w-4 h-4" />
                      <span>Criar Sala e Gerar Link</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-4 pt-1">
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
                      className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 focus:border-[#007df7] rounded-2xl text-sm text-white placeholder-gray-500 outline-none transition-all font-mono text-xs sm:text-sm"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isJoining || !joinInput.trim()}
                  onClick={handleJoinRoom}
                  className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-[#007df7] hover:from-cyan-600 hover:to-[#0069d9] active:scale-95 text-white font-black text-sm rounded-2xl shadow-xl shadow-cyan-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {isJoining ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Entrando na sala...</span>
                    </div>
                  ) : (
                    <>
                      <span>Entrar na Sala</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
