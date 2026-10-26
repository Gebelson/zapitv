import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { LiveChannel, CurrentEpgState } from '../../../core/livetv/types';
import { liveTvProviderRegistry } from '../../../core/livetv/LiveTVProviderRegistry';
import { channelNumberingService } from '../../../core/livetv/channelNumberingService';
import { epgService } from '../../../core/livetv/epgService';
import { liveTvPreferences } from '../../../core/livetv/liveTvPreferences';
import { LiveTvPlayer } from '../../livetv/LiveTvPlayer';
import { TvLiveChannelOverlay } from './TvLiveChannelOverlay';
import { TvLiveChannelGuide } from './TvLiveChannelGuide';
import { TvLiveNumericInput } from './TvLiveNumericInput';
import { uiSoundService } from '../../../core/audio/uiSoundService';
import { tvNavigationManager } from '../../../core/tv/tvNavigationManager';

const STORAGE_LAST_TV_CHANNEL = 'zapitv_tv_last_channel_id';
const STORAGE_PREV_TV_CHANNEL = 'zapitv_tv_prev_channel_id';

interface TvLiveViewProps {
  onTriggerHeader: () => void;
  isHeaderVisible?: boolean;
}

export const TvLiveView: React.FC<TvLiveViewProps> = ({
  onTriggerHeader,
  isHeaderVisible = false
}) => {
  // Canais verificados elegíveis para reprodução interna
  const [rawChannels, setRawChannels] = useState<LiveChannel[]>(() => 
    liveTvProviderRegistry.getVerifiedChannels()
  );

  // Canais anotados com numeração permanente e ordenados por número
  const channels = useMemo(() => {
    return channelNumberingService.annotateAndSortChannels(rawChannels);
  }, [rawChannels]);

  // Canal ativo
  const [activeChannelId, setActiveChannelId] = useState<string>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_LAST_TV_CHANNEL) : null;
    const initialList = channelNumberingService.annotateAndSortChannels(liveTvProviderRegistry.getVerifiedChannels());
    if (saved && initialList.some(c => c.id === saved)) {
      return saved;
    }
    return initialList[0]?.id || 'tv-brasil';
  });

  const [prevChannelId, setPrevChannelId] = useState<string | null>(() => {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_PREV_TV_CHANNEL) : null;
  });

  // Estados de Interface e Controles Sobrepostos
  const [isOverlayVisible, setIsOverlayVisible] = useState(true);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [numericBuffer, setNumericBuffer] = useState('');
  const [numericErrorMessage, setNumericErrorMessage] = useState<string | null>(null);

  const overlayTimerRef = useRef<any>(null);
  const numericTimerRef = useRef<any>(null);
  const errorTimerRef = useRef<any>(null);

  // Obtém o objeto completo do canal ativo
  const activeChannel = useMemo(() => {
    return channels.find(c => c.id === activeChannelId) || channels[0];
  }, [channels, activeChannelId]);

  // Estado EPG do canal ativo
  const [epg, setEpg] = useState<CurrentEpgState>(() => {
    if (!activeChannel) {
      return {
        currentProgram: { id: 'none', title: 'Programação não disponível', startTime: '--:--', endTime: '--:--', startMinutes: 0, endMinutes: 1440 },
        progressPercent: 0,
        elapsedMinutes: 0,
        remainingMinutes: 0,
        formattedStartTime: '--:--',
        formattedEndTime: '--:--',
        hasVerifiedSchedule: false
      };
    }
    return epgService.getCurrentEpgState(activeChannel);
  });

  // Inscreve-se nas atualizações do registro de canais
  useEffect(() => {
    const unsub = liveTvProviderRegistry.subscribe((updated) => {
      const verified = liveTvProviderRegistry.getVerifiedChannels();
      setRawChannels(verified);
    });
    return () => unsub();
  }, []);

  // Atualiza EPG periodicamente
  useEffect(() => {
    if (!activeChannel) return;
    setEpg(epgService.getCurrentEpgState(activeChannel));

    const interval = setInterval(() => {
      setEpg(epgService.getCurrentEpgState(activeChannel));
    }, 30000);
    return () => clearInterval(interval);
  }, [activeChannel]);

  // Dispara temporizador de auto-hide da barra de informações
  const showOverlayTemporarily = useCallback((durationMs = 4500) => {
    if (overlayTimerRef.current) {
      clearTimeout(overlayTimerRef.current);
    }
    setIsOverlayVisible(true);
    overlayTimerRef.current = setTimeout(() => {
      setIsOverlayVisible(false);
    }, durationMs);
  }, []);

  // Exibe a barra de informações na inicialização
  useEffect(() => {
    showOverlayTemporarily(4500);
    return () => {
      if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    };
  }, [showOverlayTemporarily]);

  // Troca de canal com preservação de histórico
  const switchChannel = useCallback((targetChannel: LiveChannel) => {
    if (!targetChannel || targetChannel.id === activeChannelId) return;

    if (activeChannelId) {
      setPrevChannelId(activeChannelId);
      try {
        localStorage.setItem(STORAGE_PREV_TV_CHANNEL, activeChannelId);
      } catch {}
    }

    setActiveChannelId(targetChannel.id);
    try {
      localStorage.setItem(STORAGE_LAST_TV_CHANNEL, targetChannel.id);
    } catch {}

    uiSoundService.play('navigate');
    showOverlayTemporarily(4500);
  }, [activeChannelId, showOverlayTemporarily]);

  // Próximo canal (CH+)
  const handleNextChannel = useCallback(() => {
    if (channels.length <= 1) return;
    const currentIndex = channels.findIndex(c => c.id === activeChannelId);
    const nextIndex = (currentIndex + 1) % channels.length;
    switchChannel(channels[nextIndex]);
  }, [channels, activeChannelId, switchChannel]);

  // Canal anterior (CH-)
  const handlePrevChannel = useCallback(() => {
    if (channels.length <= 1) return;
    const currentIndex = channels.findIndex(c => c.id === activeChannelId);
    const prevIndex = (currentIndex - 1 + channels.length) % channels.length;
    switchChannel(channels[prevIndex]);
  }, [channels, activeChannelId, switchChannel]);

  // Alternar entre os dois últimos canais assistidos (Recall / Previous Channel)
  const handleRecallChannel = useCallback(() => {
    if (prevChannelId) {
      const prevCh = channels.find(c => c.id === prevChannelId);
      if (prevCh) {
        switchChannel(prevCh);
      }
    }
  }, [prevChannelId, channels, switchChannel]);

  // Confirmação do buffer numérico
  const commitNumericInput = useCallback(() => {
    if (numericTimerRef.current) {
      clearTimeout(numericTimerRef.current);
      numericTimerRef.current = null;
    }

    const num = parseInt(numericBuffer, 10);
    if (!isNaN(num) && num > 0) {
      const match = channelNumberingService.getChannelByNumber(num, channels);
      if (match) {
        switchChannel(match);
        setNumericBuffer('');
      } else {
        setNumericErrorMessage(`Canal ${num} não encontrado`);
        if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
        errorTimerRef.current = setTimeout(() => {
          setNumericErrorMessage(null);
          setNumericBuffer('');
        }, 2200);
      }
    } else {
      setNumericBuffer('');
    }
  }, [numericBuffer, channels, switchChannel]);

  // Acumula dígitos quando pressionados
  const handleDigitInput = useCallback((digit: string) => {
    if (isGuideOpen) return;

    setNumericErrorMessage(null);
    const next = (numericBuffer + digit).slice(-3); // Limita a 3 dígitos (ex: 001 até 999)
    setNumericBuffer(next);

    if (numericTimerRef.current) {
      clearTimeout(numericTimerRef.current);
    }
    // Confirma automaticamente após 1.5s sem novas teclas
    numericTimerRef.current = setTimeout(() => {
      const num = parseInt(next, 10);
      if (!isNaN(num) && num > 0) {
        const match = channelNumberingService.getChannelByNumber(num, channels);
        if (match) {
          switchChannel(match);
          setNumericBuffer('');
        } else {
          setNumericErrorMessage(`Canal ${num} não encontrado`);
          if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
          errorTimerRef.current = setTimeout(() => {
            setNumericErrorMessage(null);
            setNumericBuffer('');
          }, 2200);
        }
      } else {
        setNumericBuffer('');
      }
    }, 1500);
  }, [numericBuffer, isGuideOpen, channels, switchChannel]);

  // Manipulador do botão VOLTAR com hierarquia estrita de navegação
  useEffect(() => {
    // Registra manipulador com prioridade alta na pilha de voltar do TvNavigationManager
    const unregisterBack = tvNavigationManager.registerBackHandler('tv-live-view-back', 150, () => {
      // 1. Se estiver digitando número, cancela digitação
      if (numericBuffer) {
        if (numericTimerRef.current) clearTimeout(numericTimerRef.current);
        setNumericBuffer('');
        setNumericErrorMessage(null);
        return true;
      }

      // 2. Se o guia de canais estiver aberto, fecha o guia
      if (isGuideOpen) {
        setIsGuideOpen(false);
        return true;
      }

      // 3. Se a barra de informações estiver visível e o header estiver oculto, fecha a barra
      if (isOverlayVisible && !isHeaderVisible) {
        setIsOverlayVisible(false);
        return true;
      }

      // 4. Se o header estiver oculto, revela o header com foco na aba Ao Vivo!
      if (!isHeaderVisible) {
        onTriggerHeader();
        return true;
      }

      // Se o header já estiver visível, deixa a pilha padrão de voltar do TvApp operar
      return false;
    });

    return () => unregisterBack();
  }, [numericBuffer, isGuideOpen, isOverlayVisible, isHeaderVisible, onTriggerHeader]);

  // Captura global de teclas do controle remoto dedicadas à TV
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se estiver em input de busca ou texto
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (isInput) return;

      // 1. Teclas numéricas 0 a 9
      if (
        (e.key >= '0' && e.key <= '9') ||
        (e.code && e.code.startsWith('Digit') && e.code.length === 6) ||
        (e.code && e.code.startsWith('Numpad') && e.code.length === 7) ||
        (e.keyCode >= 48 && e.keyCode <= 57) ||
        (e.keyCode >= 96 && e.keyCode <= 105)
      ) {
        let char = e.key;
        if (!char || char.length > 1) {
          if (e.keyCode >= 48 && e.keyCode <= 57) {
            char = String(e.keyCode - 48);
          } else if (e.keyCode >= 96 && e.keyCode <= 105) {
            char = String(e.keyCode - 96);
          }
        }
        if (char && char >= '0' && char <= '9') {
          e.preventDefault();
          handleDigitInput(char);
          return;
        }
      }

      // 2. Se estiver digitando número:
      if (numericBuffer) {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitNumericInput();
          return;
        }
        if (e.key === 'Backspace' || e.keyCode === 8) {
          e.preventDefault();
          setNumericBuffer(prev => prev.slice(0, -1));
          return;
        }
        if (e.key === 'Escape' || e.keyCode === 10009 || e.key === 'Back') {
          e.preventDefault();
          if (numericTimerRef.current) clearTimeout(numericTimerRef.current);
          setNumericBuffer('');
          setNumericErrorMessage(null);
          return;
        }
      }

      // 3. Teclas físicas de canais (CH+ e CH-)
      // Samsung Tizen: ChannelUp (427), ChannelDown (428)
      // WebOS / Android / Fire TV: 'ChannelUp', 'ChannelDown', 'PageUp', 'PageDown'
      if (e.key === 'ChannelUp' || e.keyCode === 427 || e.key === 'PageUp') {
        e.preventDefault();
        handleNextChannel();
        return;
      }

      if (e.key === 'ChannelDown' || e.keyCode === 428 || e.key === 'PageDown') {
        e.preventDefault();
        handlePrevChannel();
        return;
      }

      // 4. Tecla Recall / Canal Anterior (Tizen 10190 / WebOS / VK_PREV_CHANNEL)
      if (e.key === 'PrevChannel' || e.key === 'Recall' || e.keyCode === 10190 || e.key === 'LastChannel') {
        e.preventDefault();
        handleRecallChannel();
        return;
      }

      // 5. Se o guia de canais estiver aberto, os direcionais pertencem exclusivamente ao guia!
      if (isGuideOpen) {
        return;
      }

      // 6. Controles Direcionais quando o Header e o Guia estiverem inativos:
      if (!isHeaderVisible) {
        switch (e.key) {
          case 'ArrowUp':
            e.preventDefault();
            setIsGuideOpen(true);
            setIsOverlayVisible(false);
            uiSoundService.play('click');
            break;

          case 'ArrowDown':
            e.preventDefault();
            setIsOverlayVisible(prev => !prev);
            if (!isOverlayVisible) {
              showOverlayTemporarily(4500);
            }
            break;

          case 'ArrowRight':
            e.preventDefault();
            handleNextChannel();
            break;

          case 'ArrowLeft':
            e.preventDefault();
            handlePrevChannel();
            break;

          case 'Enter':
            e.preventDefault();
            setIsOverlayVisible(prev => !prev);
            if (!isOverlayVisible) {
              showOverlayTemporarily(4500);
            }
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    numericBuffer,
    isGuideOpen,
    isHeaderVisible,
    isOverlayVisible,
    handleDigitInput,
    commitNumericInput,
    handleNextChannel,
    handlePrevChannel,
    handleRecallChannel,
    showOverlayTemporarily
  ]);

  if (!activeChannel) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white">
        <p className="text-lg font-bold">Nenhum canal ao vivo disponível no momento.</p>
      </div>
    );
  }

  return (
    <div
      data-testid="tv-live-view-root"
      className="fixed inset-0 z-0 bg-black overflow-hidden select-none"
    >
      {/* 1. Transmissão Linear em Tela Cheia 16:9 Sem Margens nem Bordas */}
      <div className="absolute inset-0 w-full h-full bg-black">
        <LiveTvPlayer
          key={activeChannel.id}
          channel={activeChannel}
          autoPlay={true}
          initialMuted={false}
          isInteractive={false}
          onNextChannel={handleNextChannel}
          onPrevChannel={handlePrevChannel}
        />
      </div>

      {/* 2. Indicador Numérico Elegante no Canto Superior Direito ao Digitar */}
      <TvLiveNumericInput
        digits={numericBuffer}
        isVisible={Boolean(numericBuffer)}
        errorMessage={numericErrorMessage}
      />

      {/* 3. Barra Informativa Sobreposta na Parte Inferior (Estilo SKY / NET / Claro) */}
      <TvLiveChannelOverlay
        channel={activeChannel}
        epg={epg}
        isVisible={isOverlayVisible && !isGuideOpen}
        onOpenGuide={() => setIsGuideOpen(true)}
      />

      {/* 4. Guia Eletrônico de Canais Ao Vivo Sobreposto à Transmissão */}
      <TvLiveChannelGuide
        channels={channels}
        activeChannelId={activeChannel.id}
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        onSelectChannel={switchChannel}
      />
    </div>
  );
};
