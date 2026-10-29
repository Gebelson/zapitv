/**
 * ZAPITV — TELA DE ATIVAÇÃO GUIADA SMART TV (16:9 WIDESCREEN)
 * 
 * Exibida em Smart TV, Fire TV, Android TV, Samsung Tizen, LG webOS e MSX
 * para usuários não autenticados.
 * 
 * Recursos:
 * - Layout 16:9 widescreen adaptado para 720p, 1080p e 4K.
 * - Passo a passo visual em 3 etapas com indicador de progresso:
 *     1. Escaneie o QR Code
 *     2. Entre na sua conta
 *     3. Autorize a televisão
 * - QR Code SVG de alto contraste nítido à distância ao lado das instruções.
 * - Endereço curto e código alfanumérico formatado (XXXX-XXXX).
 * - Polling automático resiliente (RFC 8628).
 * - Aprovação automática: ao autorizar no celular, conecta a TV e abre perfis sem cliques extras.
 * - Barreira de foco para controle remoto (D-Pad).
 * - Opção "Entrar com controle remoto" para quem preferir digitar na TV.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import { useFocusable, FocusContext, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { 
  Tv, 
  Smartphone, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ArrowLeft, 
  Key, 
  Lock, 
  Mail, 
  Loader2,
  ShieldCheck,
  Check
} from 'lucide-react';
import { deviceAuthClient, DeviceChallengeData } from '../../core/deviceAuth/deviceAuthClient';
import { authClient } from '../../core/auth/authClient';
import { ZapiBrandLogo } from '../common/ZapiBrandLogo';
import { uiSoundService } from '../../core/audio/uiSoundService';
import { tvPerformanceService } from '../../core/tv/tvPerformanceService';

export interface TvActivationScreenProps {
  onTvLinked: (userData: any) => Promise<void> | void;
  onLoginWithRemote?: (email: string, pass: string) => Promise<string | null>;
  authError?: string | null;
  onRetryAuth?: () => void;
}


export const TvActivationScreen: React.FC<TvActivationScreenProps> = ({
  onTvLinked,
  onLoginWithRemote,
  authError,
  onRetryAuth,
}) => {
  const [challenge, setChallenge] = useState<DeviceChallengeData | null>(null);
  const [qrSvg, setQrSvg] = useState<string>('');
  const [status, setStatus] = useState<'loading' | 'pending' | 'approved' | 'rejected' | 'expired' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [secondsRemaining, setSecondsRemaining] = useState<number>(600);
  const [showRemoteLogin, setShowRemoteLogin] = useState<boolean>(false);

  // Estados do formulário de login por controle remoto na TV
  const [remoteEmail, setRemoteEmail] = useState('');
  const [remotePassword, setRemotePassword] = useState('');
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pollIntervalRef = useRef<number>(5000);
  const isPollingRef = useRef<boolean>(false);
  const mountedRef = useRef(false);
  const challengeGenerationRef = useRef(0);
  const linkedCallbackRef = useRef(onTvLinked);
  linkedCallbackRef.current = onTvLinked;

  // Detecção amigável do modelo de Smart TV
  const deviceName = tvPerformanceService.getDeviceModel() || 'Smart TV';

  // Norigin Spatial Navigation
  const { ref: containerRef, focusKey } = useFocusable({
    focusKey: 'TV_ACTIVATION_SCREEN_ROOT',
    isFocusBoundary: true,
  });

  const { ref: refreshBtnRef, focused: refreshFocused } = useFocusable({
    focusKey: 'TV_ACT_BTN_REFRESH',
    onEnterPress: () => {
      uiSoundService.play('click');
      initChallenge();
    },
    onFocus: () => uiSoundService.play('hover'),
  });

  const { ref: remoteLoginBtnRef, focused: remoteLoginFocused } = useFocusable({
    focusKey: 'TV_ACT_BTN_REMOTE_LOGIN',
    onEnterPress: () => {
      uiSoundService.play('click');
      setShowRemoteLogin(true);
    },
    onFocus: () => uiSoundService.play('hover'),
  });

  const { ref: backToQrBtnRef, focused: backToQrFocused } = useFocusable({
    focusKey: 'TV_ACT_BTN_BACK_TO_QR',
    onEnterPress: () => {
      uiSoundService.play('click');
      setShowRemoteLogin(false);
      setRemoteError(null);
    },
    onFocus: () => uiSoundService.play('hover'),
  });

  const { ref: retryAuthBtnRef, focused: retryAuthFocused } = useFocusable({
    focusKey: 'TV_ACT_BTN_RETRY_AUTH',
    onEnterPress: () => {
      uiSoundService.play('click');
      if (onRetryAuth) onRetryAuth();
    },
    onFocus: () => uiSoundService.play('hover'),
  });

  const clearTimers = useCallback(() => {
    challengeGenerationRef.current += 1;
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

  const initChallenge = useCallback(async () => {
    clearTimers();
    const generation = challengeGenerationRef.current;
    setStatus('loading');
    setErrorMessage('');
    setQrSvg('');

    try {
      const data = await deviceAuthClient.createChallenge();
      if (!mountedRef.current || generation !== challengeGenerationRef.current) return;
      setChallenge(data);
      setSecondsRemaining(data.expiresIn || 600);
      pollIntervalRef.current = (data.interval || 5) * 1000;

      // Gera SVG do QR Code localmente com alta nitidez
      const svg = await QRCode.toString(data.verificationUrl, {
        type: 'svg',
        margin: 2,
        color: {
          dark: '#05070a',
          light: '#ffffff',
        },
      });
      if (!mountedRef.current || generation !== challengeGenerationRef.current) return;

      setQrSvg(svg);
      setStatus('pending');

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

      startPolling(data.deviceCode);
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err?.message || 'Não foi possível gerar o código de ativação da TV.');
    }
  }, [clearTimers]);

  const startPolling = useCallback((deviceCode: string) => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;
    const generation = challengeGenerationRef.current;

    const poll = async () => {
      if (!isPollingRef.current) return;

      abortControllerRef.current = new AbortController();

      try {
        const res = await deviceAuthClient.pollChallenge(deviceCode, abortControllerRef.current.signal);
        if (!mountedRef.current || generation !== challengeGenerationRef.current) return;

        if (res.status === 'approved') {
          clearTimers();
          const session = await authClient.checkSession();
          if (!mountedRef.current) return;
          if (!session.authenticated || !session.user?.id) {
            setStatus('error');
            setErrorMessage('A sessão da televisão não foi confirmada. Gere um novo código para tentar novamente.');
            return;
          }
          setStatus('approved');
          uiSoundService.play('success');

          // Transição automática: aguarda 1.2s para mostrar o check e fecha suavemente
          pollTimerRef.current = setTimeout(async () => {
            if (!mountedRef.current) return;
            try {
              await linkedCallbackRef.current(res);
            } catch (error) {
              if (!mountedRef.current) return;
              setStatus('error');
              setErrorMessage(error instanceof Error ? error.message : 'Não foi possível confirmar a sessão da TV.');
            }
          }, 1200);
          return;
        }

        if (res.status === 'rejected') {
          clearTimers();
          setStatus('rejected');
          uiSoundService.play('error');
          return;
        }

        if (res.status === 'expired' || res.status === 'consumed') {
          clearTimers();
          setStatus('expired');
          return;
        }

        if (res.status === 'slow_down') {
          pollIntervalRef.current = Math.min(pollIntervalRef.current + 5000, 15000);
        }

        if (isPollingRef.current) {
          pollTimerRef.current = setTimeout(poll, pollIntervalRef.current);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        if (isPollingRef.current) {
          pollTimerRef.current = setTimeout(poll, pollIntervalRef.current);
        }
      }
    };

    pollTimerRef.current = setTimeout(poll, pollIntervalRef.current);
  }, [clearTimers]);

  useEffect(() => {
    mountedRef.current = true;
    initChallenge();
    return () => {
      mountedRef.current = false;
      clearTimers();
    };
  }, [initChallenge, clearTimers]);

  // Bloqueio rigoroso de scroll do body e captura de teclas na TV
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      // Impede que Escape feche o fluxo obrigatório da TV
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
      // Se pressionar Back e estiver na tela de login por controle, volta para a tela de QR code
      if ((e.key === 'Backspace' || e.key === 'GoBack') && showRemoteLogin) {
        e.preventDefault();
        setShowRemoteLogin(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [showRemoteLogin]);

  // Manipulador de login por controle remoto na TV
  const handleRemoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onLoginWithRemote) return;
    setRemoteLoading(true);
    setRemoteError(null);

    try {
      const err = await onLoginWithRemote(remoteEmail, remotePassword);
      if (err) {
        setRemoteError(err);
      } else {
        uiSoundService.play('success');
      }
    } catch (err: any) {
      setRemoteError(err?.message || 'Falha ao autenticar.');
    } finally {
      setRemoteLoading(false);
    }
  };

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const hostAddress = typeof window !== 'undefined' ? window.location.host + '/tv/ativar' : 'zapitv.vercel.app/tv/ativar';

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Ativação da Smart TV ZapiTV"
        className="fixed inset-0 z-[9999] bg-[#05070a]/95 backdrop-blur-2xl flex flex-col justify-between p-6 sm:p-10 md:p-14 select-none overflow-hidden text-white"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        {/* Glow de ambientação no fundo */}
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#007df7]/15 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-[#00baa3]/15 rounded-full blur-[120px] pointer-events-none" />

        {/* ================================================================== */}
        {/* TOPO: IDENTIDADE ZAPITV & BADGE DO DISPOSITIVO                     */}
        {/* ================================================================== */}
        <header className="flex items-center justify-between relative z-10 w-full pb-4 border-b border-white/10">
          <ZapiBrandLogo size="lg" />

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-white/80">
              <Tv className="w-4 h-4 text-[#00baa3]" />
              <span className="truncate max-w-[200px] sm:max-w-[320px]">{deviceName}</span>
            </div>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#007df7]/10 border border-[#007df7]/30 text-xs font-bold text-[#007df7] uppercase tracking-wider">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#007df7] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#007df7]"></span>
              </span>
              <span>Ativação Guiada</span>
            </div>
          </div>
        </header>

        {/* ================================================================== */}
        {/* CORPO PRINCIPAL: TRATAMENTO DE ERRO DE CONEXÃO OU WIDESCREEN       */}
        {/* ================================================================== */}
        {authError ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto my-auto relative z-10">
            <div className="w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center mb-6">
              <AlertCircle className="w-10 h-10" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-3" style={{ fontFamily: "'Sora', sans-serif" }}>
              Sem Conexão com o Servidor
            </h2>
            <p className="text-sm text-white/70 mb-8 leading-relaxed">
              {authError}
            </p>
            <button
              ref={retryAuthBtnRef}
              type="button"
              onClick={() => {
                if (onRetryAuth) onRetryAuth();
              }}
              className={`py-4 px-8 rounded-2xl bg-gradient-to-r from-[#007df7] to-[#00baa3] text-white font-bold text-base tracking-wide shadow-xl shadow-[#007df7]/25 flex items-center gap-3 transition-all cursor-pointer ${
                retryAuthFocused ? 'ring-4 ring-white scale-105' : ''
              }`}
            >
              <RefreshCw className="w-5 h-5" />
              <span>Tentar novamente</span>
            </button>
          </div>
        ) : showRemoteLogin ? (
          /* ================================================================ */
          /* MODO ALTERNATIVO: LOGIN COM CONTROLE REMOTO NA TV                */
          /* ================================================================ */
          <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full my-auto relative z-10 animate-in fade-in duration-300">
            <div className="w-full bg-[#0b0e14] border border-white/15 rounded-3xl p-8 sm:p-10 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <button
                  ref={backToQrBtnRef}
                  type="button"
                  onClick={() => setShowRemoteLogin(false)}
                  className={`flex items-center gap-2 text-xs font-bold text-white/70 hover:text-white transition-all px-3 py-1.5 rounded-xl ${
                    backToQrFocused ? 'bg-white/20 text-white ring-2 ring-white' : ''
                  }`}
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar para QR Code</span>
                </button>
                <div className="text-xs uppercase tracking-wider text-white/40 font-bold">Login TV</div>
              </div>

              <h2 className="text-2xl font-black text-white mb-2" style={{ fontFamily: "'Sora', sans-serif" }}>
                Entrar com Controle Remoto
              </h2>
              <p className="text-xs text-white/60 mb-6">
                Digite suas credenciais ZapiTV utilizando o teclado virtual.
              </p>

              {remoteError && (
                <div className="p-3 mb-5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{remoteError}</span>
                </div>
              )}

              <form onSubmit={handleRemoteSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-white/70 mb-1.5">E-mail</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={remoteEmail}
                      onChange={(e) => setRemoteEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 text-sm outline-none focus:border-[#007df7] focus:bg-white/10 transition-all font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-white/70 mb-1.5">Senha</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={remotePassword}
                      onChange={(e) => setRemotePassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 text-sm outline-none focus:border-[#007df7] focus:bg-white/10 transition-all font-medium"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={remoteLoading}
                  className="w-full py-4 mt-3 bg-gradient-to-r from-[#007df7] to-[#00baa3] text-white font-bold text-sm rounded-xl shadow-lg shadow-[#007df7]/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  {remoteLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Autenticando...</span>
                    </>
                  ) : (
                    <span>Entrar na ZapiTV</span>
                  )}
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* ================================================================ */
          /* MODO PRINCIPAL: WIDESCREEN 16:9 COM PASSO A PASSO GUIADO         */
          /* ================================================================ */
          <main className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-14 items-center my-auto relative z-10 py-4 max-w-7xl mx-auto w-full">
            {/* -------------------------------------------------------------- */}
            {/* COLUNA ESQUERDA: PASSO A PASSO EM 3 ETAPAS (7 COLUNAS)         */}
            {/* -------------------------------------------------------------- */}
            <div className="md:col-span-7 flex flex-col justify-center space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight" style={{ fontFamily: "'Sora', sans-serif" }}>
                  Entre na sua conta pelo celular
                </h1>
                <p className="text-sm sm:text-base text-white/70 mt-2 max-w-xl">
                  Siga os 3 passos rápidos para conectar esta televisão com segurança e sem complicação.
                </p>
              </div>

              {/* Indicador de Progresso Visual das 3 Etapas */}
              <div className="space-y-4 pt-1">
                {/* ETAPA 1 */}
                <div className="flex items-start gap-4 p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 transition-all">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#007df7] to-[#00baa3] text-white font-black text-base flex items-center justify-center shrink-0 shadow-lg shadow-[#007df7]/30">
                    1
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-base sm:text-lg text-white flex items-center gap-2">
                      <span>Escaneie o QR Code</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300 bg-cyan-500/20 px-2 py-0.5 rounded-full">
                        Câmera do Celular
                      </span>
                    </h3>
                    <p className="text-xs sm:text-sm text-white/70 mt-0.5 leading-relaxed">
                      Abra a câmera do celular e aponte para o QR Code exibido na televisão.
                    </p>
                  </div>
                </div>

                {/* ETAPA 2 */}
                <div className="flex items-start gap-4 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 transition-all">
                  <div className="w-10 h-10 rounded-xl bg-white/10 text-white/90 font-black text-base flex items-center justify-center shrink-0 border border-white/10">
                    2
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-base sm:text-lg text-white">
                      Entre na sua conta
                    </h3>
                    <p className="text-xs sm:text-sm text-white/70 mt-0.5 leading-relaxed">
                      Faça login ou crie sua conta ZapiTV pelo celular.
                    </p>
                  </div>
                </div>

                {/* ETAPA 3 */}
                <div className="flex items-start gap-4 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 transition-all">
                  <div className="w-10 h-10 rounded-xl bg-white/10 text-white/90 font-black text-base flex items-center justify-center shrink-0 border border-white/10">
                    3
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-base sm:text-lg text-white">
                      Autorize a televisão
                    </h3>
                    <p className="text-xs sm:text-sm text-white/70 mt-0.5 leading-relaxed">
                      Confirme a conexão no celular e aguarde. Sua televisão será conectada automaticamente.
                    </p>
                  </div>
                </div>
              </div>

              {/* CARD DE ATIVAÇÃO MANUAL ALTERNATIVA */}
              <div className="pt-2">
                <div className="p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-center sm:text-left">
                    <span className="block text-xs uppercase tracking-wider text-white/50 font-bold mb-1">
                      Não consegue escanear? Acesse:
                    </span>
                    <strong className="text-sm sm:text-base text-cyan-300 font-mono font-bold tracking-tight">
                      {hostAddress}
                    </strong>
                  </div>

                  <div className="flex flex-col items-center sm:items-end">
                    <span className="text-[11px] uppercase tracking-wider text-white/50 font-bold mb-0.5">
                      Código de Ativação:
                    </span>
                    <div className="px-4 py-1.5 rounded-xl bg-black/40 border border-cyan-400/40 text-xl sm:text-2xl font-mono font-black text-white tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-white to-[#00baa3]">
                      {challenge?.userCode || '---- ----'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* -------------------------------------------------------------- */}
            {/* COLUNA DIREITA: QR CODE COM DESTAQUE E POLLING (5 COLUNAS)     */}
            {/* -------------------------------------------------------------- */}
            <div className="md:col-span-5 flex flex-col items-center justify-center">
              <div className="relative flex flex-col items-center">
                {/* Moldura de Alta Visibilidade do QR Code */}
                <div className="p-4 bg-white rounded-3xl shadow-2xl shadow-[#007df7]/25 border-4 border-white/20 relative group">
                  {status === 'loading' ? (
                    <div className="w-56 h-56 sm:w-64 sm:h-64 flex flex-col items-center justify-center gap-3 text-black">
                      <RefreshCw className="w-10 h-10 text-[#007df7] animate-spin" />
                      <span className="text-xs font-bold text-slate-700">Gerando código seguro...</span>
                    </div>
                  ) : status === 'approved' ? (
                    <div className="w-56 h-56 sm:w-64 sm:h-64 flex flex-col items-center justify-center gap-3 text-emerald-600 animate-in zoom-in-95 duration-300">
                      <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
                        <Check className="w-12 h-12 text-emerald-600 stroke-[3]" />
                      </div>
                      <span className="text-base font-black text-slate-900">TV Conectada!</span>
                      <span className="text-xs text-slate-500 font-medium">Abrindo perfis...</span>
                    </div>
                  ) : status === 'expired' ? (
                    <div className="w-56 h-56 sm:w-64 sm:h-64 flex flex-col items-center justify-center gap-3 text-red-500 p-4 text-center">
                      <AlertCircle className="w-12 h-12" />
                      <span className="text-sm font-bold text-slate-900">Código Expirado</span>
                      <span className="text-xs text-slate-500">O prazo de 10 minutos esgotou.</span>
                    </div>
                  ) : status === 'rejected' ? (
                    <div className="w-56 h-56 sm:w-64 sm:h-64 flex flex-col items-center justify-center gap-3 text-amber-600 p-4 text-center">
                      <AlertCircle className="w-12 h-12" />
                      <span className="text-sm font-bold text-slate-900">Solicitação Cancelada</span>
                      <span className="text-xs text-slate-500">A vinculação foi recusada no celular.</span>
                    </div>
                  ) : status === 'error' ? (
                    <div className="w-56 h-56 sm:w-64 sm:h-64 flex flex-col items-center justify-center gap-3 text-red-500 p-4 text-center">
                      <AlertCircle className="w-12 h-12" />
                      <span className="text-sm font-bold text-slate-900">Falha de Conexão</span>
                      <span className="text-xs text-slate-500">{errorMessage || 'Não foi possível carregar o código.'}</span>
                    </div>
                  ) : (
                    <div 
                      className="w-56 h-56 sm:w-64 sm:h-64 [&>svg]:w-full [&>svg]:h-full"
                      dangerouslySetInnerHTML={{ __html: qrSvg }}
                    />
                  )}
                </div>

                {/* Status de Polling / Espera com Beacon Animado */}
                <div className="mt-4 flex flex-col items-center text-center">
                  {status === 'pending' && (
                    <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                      <span>Aguardando autorização no celular...</span>
                    </div>
                  )}

                  {status === 'pending' && (
                    <span className="text-[11px] text-white/50 mt-1.5">
                      Código expira em: <strong className="text-white/80">{timeFormatted}</strong>
                    </span>
                  )}
                </div>

                {/* Botões de Ação para Controle Remoto (D-Pad) */}
                <div className="flex flex-col gap-2.5 w-full max-w-xs mt-4">
                  {(status === 'expired' || status === 'rejected' || status === 'error') && (
                    <button
                      ref={refreshBtnRef}
                      type="button"
                      onClick={() => {
                        uiSoundService.play('click');
                        initChallenge();
                      }}
                      className={`w-full py-3 px-5 rounded-2xl bg-[#007df7] hover:bg-[#007df7]/80 text-white font-bold text-xs tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        refreshFocused ? 'ring-4 ring-white bg-[#00baa3] text-black scale-105' : ''
                      }`}
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Gerar novo código</span>
                    </button>
                  )}

                  {onLoginWithRemote && (
                    <button
                      ref={remoteLoginBtnRef}
                      type="button"
                      onClick={() => {
                        uiSoundService.play('click');
                        setShowRemoteLogin(true);
                      }}
                      className={`w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-medium text-xs transition-all flex items-center justify-center gap-2 border border-white/10 cursor-pointer ${
                        remoteLoginFocused ? 'ring-4 ring-cyan-400 bg-white/20 text-white scale-105' : ''
                      }`}
                    >
                      <Key className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Entrar pelo controle remoto</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </main>
        )}

        {/* ================================================================== */}
        {/* RODAPÉ: GARANTIA DE SEGURANÇA E D-PAD HELP                         */}
        {/* ================================================================== */}
        <footer className="flex flex-col sm:flex-row items-center justify-between text-xs text-white/40 pt-3 border-t border-white/10 relative z-10 gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Sessão independente protegida pela RFC 8628 com encriptação de ponta a ponta.</span>
          </div>
          <div className="text-[11px] text-white/50">
            Utilize o controle remoto [OK / Setas] para navegar
          </div>
        </footer>
      </div>
    </FocusContext.Provider>
  );
};

export default TvActivationScreen;
