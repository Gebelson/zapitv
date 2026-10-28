/**
 * ZAPITV — TELA DE VINCULAÇÃO SMART TV VIA QR CODE (P3.C)
 * 
 * Componente espacial com suporte nativo a controle remoto (D-Pad).
 * Gera QR Code local em formato SVG, exibe código legível, URL oficial
 * e gerencia polling resiliente conforme a RFC 8628.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation';
import { Smartphone, RefreshCw, ArrowLeft, CheckCircle2, AlertCircle, WifiOff } from 'lucide-react';
import { deviceAuthClient, DeviceChallengeData } from '../../core/deviceAuth/deviceAuthClient';
import { uiSoundService } from '../../core/audio/uiSoundService';

interface TvQrLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLinked: (userData: { user: { id: string; name: string; email: string }; token?: string }) => void;
}

export const TvQrLinkModal: React.FC<TvQrLinkModalProps> = ({ isOpen, onClose, onLinked }) => {
  const [challenge, setChallenge] = useState<DeviceChallengeData | null>(null);
  const [qrSvg, setQrSvg] = useState<string>('');
  const [status, setStatus] = useState<'loading' | 'pending' | 'approved' | 'rejected' | 'expired' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [secondsRemaining, setSecondsRemaining] = useState<number>(600);
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pollIntervalRef = useRef<number>(5000);
  const isPollingRef = useRef<boolean>(false);

  const { ref: containerRef, focusKey } = useFocusable({
    focusKey: 'TV_QR_LINK_MODAL_CONTAINER',
    isFocusBoundary: true,
  });

  const { ref: refreshButtonRef, focused: refreshFocused } = useFocusable({
    focusKey: 'TV_QR_BTN_REFRESH',
    onEnterPress: () => {
      uiSoundService.play('click');
      initChallenge();
    },
    onFocus: () => uiSoundService.play('hover'),
  });

  const { ref: backButtonRef, focused: backFocused } = useFocusable({
    focusKey: 'TV_QR_BTN_BACK',
    onEnterPress: () => {
      uiSoundService.play('click');
      handleClose();
    },
    onFocus: () => uiSoundService.play('hover'),
  });

  const clearTimers = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    isPollingRef.current = false;
  }, []);

  const handleClose = useCallback(() => {
    clearTimers();
    onClose();
  }, [clearTimers, onClose]);

  const initChallenge = useCallback(async () => {
    clearTimers();
    setStatus('loading');
    setErrorMessage('');
    setQrSvg('');

    try {
      const data = await deviceAuthClient.createChallenge();
      setChallenge(data);
      setSecondsRemaining(data.expiresIn || 600);
      pollIntervalRef.current = (data.interval || 5) * 1000;

      // Gera SVG do QR Code localmente sem dependência de canvas
      const svg = await QRCode.toString(data.verificationUrl, {
        type: 'svg',
        margin: 2,
        color: {
          dark: '#05070a',
          light: '#ffffff',
        },
      });

      setQrSvg(svg);
      setStatus('pending');

      // Inicia contagem regressiva
      countdownTimerRef.current = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearTimers();
            setStatus('expired');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Inicia polling
      startPolling(data.deviceCode);
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || 'Não foi possível conectar ao servidor. Tente novamente.');
    }
  }, [clearTimers]);

  const startPolling = useCallback((deviceCode: string) => {
    if (isPollingRef.current) return;

    const poll = async () => {
      if (!deviceCode || status === 'approved' || status === 'expired') return;

      abortControllerRef.current = new AbortController();
      isPollingRef.current = true;

      try {
        const res = await deviceAuthClient.pollChallenge(deviceCode, abortControllerRef.current.signal);

        if (res.status === 'approved') {
          clearTimers();
          setStatus('approved');
          uiSoundService.play('click');
          setTimeout(() => {
            onLinked({
              user: res.user || { id: '', name: 'Usuário', email: '' },
              token: res.token,
            });
          }, 1500);
          return;
        }

        if (res.status === 'expired') {
          clearTimers();
          setStatus('expired');
          return;
        }

        if (res.status === 'rejected') {
          clearTimers();
          setStatus('rejected');
          return;
        }

        if (res.status === 'slow_down') {
          // Aumenta o intervalo de polling conforme solicitado pelo servidor
          pollIntervalRef.current = Math.max(pollIntervalRef.current, (res.interval || 10) * 1000);
        } else if (res.interval) {
          pollIntervalRef.current = res.interval * 1000;
        }

        // Agenda próxima verificação
        isPollingRef.current = false;
        pollTimerRef.current = setTimeout(poll, pollIntervalRef.current);
      } catch (err: any) {
        isPollingRef.current = false;
        if (err.name === 'AbortError') return;

        // Se falhou por conexão de rede, aguarda e tenta novamente
        pollTimerRef.current = setTimeout(poll, pollIntervalRef.current);
      }
    };

    pollTimerRef.current = setTimeout(poll, pollIntervalRef.current);
  }, [clearTimers, onLinked, status]);

  // Listener para status online/offline
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Inicialização quando o modal é aberto
  useEffect(() => {
    if (isOpen) {
      initChallenge();
    } else {
      clearTimers();
    }

    return () => {
      clearTimers();
    };
  }, [isOpen, initChallenge, clearTimers]);

  if (!isOpen) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={containerRef}
        className="fixed inset-0 z-[600] bg-[#05070a]/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 md:p-12 select-none"
      >
        {/* Header com Logo ZapiTV */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#007df7] to-[#00baa3] flex items-center justify-center shadow-lg shadow-[#007df7]/20">
            <span className="text-white font-black text-xl" style={{ fontFamily: "'Sora', sans-serif" }}>Z</span>
          </div>
          <span className="text-2xl font-black tracking-wider text-white" style={{ fontFamily: "'Sora', sans-serif" }}>
            Zapi<span className="text-[#007df7]">TV</span>
          </span>
        </div>

        {/* Título e Subtítulo */}
        <div className="text-center max-w-2xl mb-8">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-2" style={{ fontFamily: "'Sora', sans-serif" }}>
            Entre na sua conta ZapiTV
          </h2>
          <p className="text-sm md:text-base text-white/60">
            Escaneie o QR Code com a câmera do celular ou acesse o endereço e digite o código de vinculação.
          </p>
        </div>

        {/* Banner Offline */}
        {isOffline && (
          <div className="mb-6 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2 text-amber-400 text-sm">
            <WifiOff className="w-4 h-4" />
            <span>Sem conexão com a internet. O código será atualizado quando a rede retornar.</span>
          </div>
        )}

        {/* Container Principal do QR Code e Instruções */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 max-w-3xl w-full flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12 shadow-2xl relative overflow-hidden">
          {/* Lado Esquerdo: QR Code */}
          <div className="flex flex-col items-center justify-center">
            <div className="w-56 h-56 md:w-64 md:h-64 bg-white p-3 rounded-2xl shadow-xl flex items-center justify-center relative">
              {status === 'loading' && (
                <div className="flex flex-col items-center gap-3 text-black">
                  <RefreshCw className="w-8 h-8 animate-spin text-[#007df7]" />
                  <span className="text-xs font-bold text-gray-600">Gerando QR Code...</span>
                </div>
              )}

              {status === 'approved' && (
                <div className="flex flex-col items-center gap-3 text-emerald-600">
                  <CheckCircle2 className="w-16 h-16 animate-bounce" />
                  <span className="text-sm font-black text-center">TV Vinculada!</span>
                </div>
              )}

              {status === 'expired' && (
                <div className="flex flex-col items-center gap-2 text-red-500 text-center p-2">
                  <AlertCircle className="w-10 h-10" />
                  <span className="text-xs font-bold">Código expirado</span>
                </div>
              )}

              {status === 'rejected' && (
                <div className="flex flex-col items-center gap-2 text-amber-500 text-center p-2">
                  <AlertCircle className="w-10 h-10" />
                  <span className="text-xs font-bold">Solicitação recusada</span>
                </div>
              )}

              {status === 'error' && (
                <div className="flex flex-col items-center gap-2 text-red-500 text-center p-2">
                  <AlertCircle className="w-10 h-10" />
                  <span className="text-xs font-bold">Erro de conexão</span>
                </div>
              )}

              {status === 'pending' && qrSvg && (
                <div
                  className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
              )}
            </div>

            {/* Timer de expiração */}
            {status === 'pending' && (
              <span className="mt-3 text-xs font-medium text-white/40">
                Código expira em: <strong className="text-white/80 font-bold">{timeFormatted}</strong>
              </span>
            )}
          </div>

          {/* Lado Direito: Passos e Código Curto */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left max-w-sm">
            <div className="flex items-center gap-2 px-3 py-1 bg-[#007df7]/10 border border-[#007df7]/30 rounded-full text-[#007df7] text-xs font-bold uppercase tracking-wider mb-4">
              <Smartphone className="w-3.5 h-3.5" />
              <span>Pelo Navegador ou Celular</span>
            </div>

            <p className="text-white/70 text-sm mb-2">1. No celular ou computador, acesse:</p>
            <div className="bg-white/10 px-4 py-2 rounded-xl text-white font-mono text-sm font-bold border border-white/10 mb-4 select-all">
              {challenge ? new URL(challenge.verificationUrl).host + '/tv/ativar' : 'zapitv.vercel.app/tv/ativar'}
            </div>

            <p className="text-white/70 text-sm mb-2">2. Digite este código de ativação:</p>
            <div className="bg-gradient-to-r from-[#007df7]/20 to-[#00baa3]/20 border-2 border-[#007df7]/50 px-6 py-3 rounded-2xl text-white font-mono text-2xl md:text-3xl font-black tracking-widest mb-4 shadow-lg shadow-[#007df7]/10">
              {challenge ? challenge.userCode : '---- ----'}
            </div>

            {/* Indicador de status de autorização */}
            {status === 'pending' && (
              <div className="flex items-center gap-2 text-xs text-[#00baa3] font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00baa3] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00baa3]"></span>
                </span>
                <span>Aguardando autorização no seu celular...</span>
              </div>
            )}

            {status === 'approved' && (
              <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Autorizado com sucesso! Abrindo perfis...</span>
              </div>
            )}

            {status === 'expired' && (
              <p className="text-xs text-red-400 font-medium">
                O prazo de 10 minutos expirou. Pressione &quot;Gerar novo código&quot; abaixo.
              </p>
            )}

            {status === 'rejected' && (
              <p className="text-xs text-amber-400 font-medium">
                A vinculação foi rejeitada no celular. Gere outro código se desejar tentar de novo.
              </p>
            )}
          </div>
        </div>

        {/* Controles de Navegação D-Pad (Controle Remoto) */}
        <div className="flex items-center gap-4 mt-8">
          {(status === 'expired' || status === 'rejected' || status === 'error') && (
            <button
              ref={refreshButtonRef}
              tabIndex={0}
              onClick={() => {
                uiSoundService.play('click');
                initChallenge();
              }}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm tracking-wide transition-all outline-none cursor-pointer ${
                refreshFocused
                  ? 'bg-[#00baa3] text-black scale-105 shadow-[0_0_20px_rgba(0,186,163,0.5)] ring-4 ring-[#00baa3]/30'
                  : 'bg-[#007df7] text-white hover:bg-[#007df7]/80'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              <span>Gerar novo código</span>
            </button>
          )}

          <button
            ref={backButtonRef}
            tabIndex={0}
            onClick={() => {
              uiSoundService.play('click');
              handleClose();
            }}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl border-2 font-bold text-sm tracking-wide transition-all outline-none cursor-pointer ${
              backFocused
                ? 'border-[#00baa3] text-[#00baa3] bg-white/5 scale-105 ring-4 ring-[#00baa3]/30'
                : 'border-white/20 text-white/70 hover:border-white hover:text-white'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar à TV</span>
          </button>
        </div>
      </div>
    </FocusContext.Provider>
  );
};
