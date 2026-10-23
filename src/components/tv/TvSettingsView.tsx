import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX, Sliders, Sparkles, RotateCcw, ArrowLeft, Settings, Tv, Check, CheckCircle2 } from 'lucide-react';
import { FocusContext, useFocusable, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useTvFocusable } from '../../core/tv/useTvFocusable';
import { tvNavigationManager } from '../../core/tv/tvNavigationManager';
import { uiSoundService, UiSoundPreferences } from '../../core/audio/uiSoundService';

interface TvSettingsViewProps {
  onBack: () => void;
}

export const TvSettingsView: React.FC<TvSettingsViewProps> = ({ onBack }) => {
  const { ref: noriginRef, focusKey } = useFocusable({
    focusKey: 'tv-settings-root',
    trackChildren: true
  });

  const [prefs, setPrefs] = useState<UiSoundPreferences>(() => uiSoundService.getPreferences());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    return uiSoundService.subscribe(() => {
      setPrefs(uiSoundService.getPreferences());
    });
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Back button
  const { ref: backRef, focused: isBackFocused } = useTvFocusable({
    focusKey: 'tv-setting-back',
    soundType: 'hover',
    enterSound: 'close',
    onEnterPress: () => {
      uiSoundService.play('close');
      onBack();
    }
  });

  // Sound toggle button
  const { ref: toggleRef, focused: isToggleFocused } = useTvFocusable({
    focusKey: 'tv-setting-sound-toggle',
    soundType: 'hover',
    enterSound: 'none',
    onEnterPress: () => {
      const nextEnabled = !prefs.enabled;
      uiSoundService.updatePreferences({ enabled: nextEnabled });
      uiSoundService.play('toggle', { preview: true });
      showToast(nextEnabled ? 'Sons de interface ativados' : 'Sons de interface desativados');
    }
  });

  // Volume adjuster button
  const volumeSteps = [10, 24, 50, 75, 100];
  const { ref: volumeRef, focused: isVolumeFocused } = useTvFocusable({
    focusKey: 'tv-setting-sound-volume',
    soundType: 'hover',
    enterSound: 'none',
    onArrowPress: (direction) => {
      if (direction === 'left') {
        const nextVol = Math.max(0, prefs.volume - 5);
        uiSoundService.updatePreferences({ volume: nextVol });
        uiSoundService.play('click', { preview: true });
        return false;
      }
      if (direction === 'right') {
        const nextVol = Math.min(100, prefs.volume + 5);
        uiSoundService.updatePreferences({ volume: nextVol });
        uiSoundService.play('click', { preview: true });
        return false;
      }
      return true;
    },
    onEnterPress: () => {
      // Cycle through standard preset steps
      const currentIdx = volumeSteps.findIndex(v => v >= prefs.volume);
      const nextIdx = (currentIdx + 1) % volumeSteps.length;
      const nextVol = volumeSteps[nextIdx];
      uiSoundService.updatePreferences({ volume: nextVol });
      uiSoundService.play('click', { preview: true });
      showToast(`Volume ajustado para ${nextVol}%`);
    }
  });

  // Sound test button
  const { ref: testRef, focused: isTestFocused } = useTvFocusable({
    focusKey: 'tv-setting-sound-test',
    soundType: 'hover',
    enterSound: 'none',
    onEnterPress: () => {
      uiSoundService.play('confirm', { preview: true });
      showToast('Efeito sonoro executado');
    }
  });

  // Restore defaults button
  const { ref: resetRef, focused: isResetFocused } = useTvFocusable({
    focusKey: 'tv-setting-sound-reset',
    soundType: 'hover',
    enterSound: 'none',
    onEnterPress: () => {
      uiSoundService.resetDefaults();
      uiSoundService.play('success', { preview: true });
      showToast('Padrões da Smart TV restaurados');
    }
  });

  useEffect(() => {
    const unregister = tvNavigationManager.registerBackHandler('tv-settings-view', 150, () => {
      uiSoundService.play('close');
      onBack();
      return true;
    });

    const timer = setTimeout(() => {
      setFocus('tv-setting-sound-toggle');
    }, 60);

    return () => {
      clearTimeout(timer);
      unregister();
    };
  }, [onBack]);

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={noriginRef as any}
        className="w-full min-h-screen pt-28 px-14 sm:px-16 pb-24 select-none bg-gradient-to-b from-[#0f172a] via-[#090d16] to-[#05070c] text-white"
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <button
              ref={backRef}
              type="button"
              data-focus-key="tv-setting-back"
              data-tv-focused={isBackFocused ? 'true' : undefined}
              onClick={() => {
                uiSoundService.play('close');
                onBack();
              }}
              className={`p-3.5 rounded-2xl border transition-all duration-200 outline-none flex items-center justify-center ${
                isBackFocused
                  ? 'bg-cyan-500/25 text-cyan-300 border-2 border-cyan-400 scale-105 shadow-[0_0_20px_rgba(0,229,255,0.5)]'
                  : 'bg-white/10 text-gray-200 border-2 border-white/15 hover:bg-white/15'
              }`}
            >
              <ArrowLeft className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                <Settings className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-white tracking-wide">Configurações da Smart TV</h1>
                <p className="text-sm text-gray-400">Preferências de áudio, interface e reprodução</p>
              </div>
            </div>
          </div>

          {toastMessage && (
            <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 text-sm font-bold animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-cyan-300" />
              <span>{toastMessage}</span>
            </div>
          )}
        </div>

        {/* Grade de Configurações */}
        <div className="max-w-4xl space-y-6">
          {/* Seção: Áudio e Sons de Interface */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
            <div className="flex items-center gap-3 mb-5">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white uppercase tracking-wider">Efeitos Sonoros da Interface</h2>
            </div>

            <div className="space-y-4">
              {/* Opção 1: Ligar/Desligar Sons */}
              <button
                ref={toggleRef}
                type="button"
                data-focus-key="tv-setting-sound-toggle"
                data-tv-focused={isToggleFocused ? 'true' : undefined}
                onClick={() => {
                  const nextEnabled = !prefs.enabled;
                  uiSoundService.updatePreferences({ enabled: nextEnabled });
                  uiSoundService.play('toggle', { preview: true });
                  showToast(nextEnabled ? 'Sons de interface ativados' : 'Sons de interface desativados');
                }}
                className={`w-full p-5 rounded-2xl border transition-all duration-200 outline-none flex items-center justify-between text-left ${
                  isToggleFocused
                    ? 'bg-cyan-500/25 border-cyan-400 ring-2 ring-cyan-300 shadow-[0_0_25px_rgba(0,229,255,0.4)] scale-[1.01]'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${prefs.enabled ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/10 text-gray-400'}`}>
                    {prefs.enabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white">Sons de Navegação e Foco</div>
                    <div className="text-sm text-gray-400">Feedback sonoro ao percorrer carrosséis, menus e botões no controle remoto</div>
                  </div>
                </div>

                <div className={`px-4 py-2 rounded-xl text-sm font-black uppercase tracking-wider flex items-center gap-2 ${
                  prefs.enabled
                    ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(0,229,255,0.4)]'
                    : 'bg-white/10 text-gray-400'
                }`}>
                  {prefs.enabled && <Check className="w-4 h-4 stroke-[3]" />}
                  <span>{prefs.enabled ? 'Ativado' : 'Desativado'}</span>
                </div>
              </button>

              {/* Opção 2: Volume dos Sons */}
              <button
                ref={volumeRef}
                type="button"
                data-focus-key="tv-setting-sound-volume"
                data-tv-focused={isVolumeFocused ? 'true' : undefined}
                onClick={() => {
                  const currentIdx = volumeSteps.findIndex(v => v >= prefs.volume);
                  const nextIdx = (currentIdx + 1) % volumeSteps.length;
                  const nextVol = volumeSteps[nextIdx];
                  uiSoundService.updatePreferences({ volume: nextVol });
                  uiSoundService.play('click', { preview: true });
                  showToast(`Volume ajustado para ${nextVol}%`);
                }}
                className={`w-full p-5 rounded-2xl border transition-all duration-200 outline-none flex items-center justify-between text-left ${
                  isVolumeFocused
                    ? 'bg-cyan-500/25 border-cyan-400 ring-2 ring-cyan-300 shadow-[0_0_25px_rgba(0,229,255,0.4)] scale-[1.01]'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-cyan-500/20 text-cyan-300">
                    <Sliders className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white">Volume dos Sons</div>
                    <div className="text-sm text-gray-400">Use as setas Esquerda / Direita ou pressione OK para alternar níveis</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-32 h-2.5 rounded-full bg-white/20 overflow-hidden relative">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-150"
                      style={{ width: `${prefs.volume}%` }}
                    />
                  </div>
                  <span className="text-lg font-black text-cyan-300 min-w-[50px] text-right">{prefs.volume}%</span>
                </div>
              </button>

              {/* Opção 3: Testar Efeito Sonoro */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  ref={testRef}
                  type="button"
                  data-focus-key="tv-setting-sound-test"
                  data-tv-focused={isTestFocused ? 'true' : undefined}
                  onClick={() => {
                    uiSoundService.play('confirm', { preview: true });
                    showToast('Efeito sonoro executado');
                  }}
                  className={`p-4 rounded-2xl border transition-all duration-200 outline-none flex items-center justify-center gap-3 font-bold ${
                    isTestFocused
                      ? 'bg-cyan-500/25 border-cyan-400 ring-2 ring-cyan-300 shadow-[0_0_20px_rgba(0,229,255,0.4)] text-white scale-[1.02]'
                      : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  <Sparkles className="w-5 h-5 text-cyan-400" />
                  <span>Testar Efeito Sonoro</span>
                </button>

                {/* Opção 4: Restaurar Padrões */}
                <button
                  ref={resetRef}
                  type="button"
                  data-focus-key="tv-setting-sound-reset"
                  data-tv-focused={isResetFocused ? 'true' : undefined}
                  onClick={() => {
                    uiSoundService.resetDefaults();
                    uiSoundService.play('success', { preview: true });
                    showToast('Padrões da Smart TV restaurados');
                  }}
                  className={`p-4 rounded-2xl border transition-all duration-200 outline-none flex items-center justify-center gap-3 font-bold ${
                    isResetFocused
                      ? 'bg-cyan-500/25 border-cyan-400 ring-2 ring-cyan-300 shadow-[0_0_20px_rgba(0,229,255,0.4)] text-white scale-[1.02]'
                      : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  <RotateCcw className="w-5 h-5 text-cyan-400" />
                  <span>Restaurar Padrões da TV</span>
                </button>
              </div>
            </div>
          </div>

          {/* Seção: Status da Smart TV e Streaming */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
            <div className="flex items-center gap-3 mb-5">
              <Tv className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-bold text-white uppercase tracking-wider">Informações da Smart TV</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="text-gray-400 mb-1">Áudio Preferencial</div>
                <div className="text-white font-bold text-base flex items-center gap-2">
                  <span>Português (Brasil) Dublado</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">Automático</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="text-gray-400 mb-1">Qualidade de Vídeo</div>
                <div className="text-white font-bold text-base flex items-center gap-2">
                  <span>Adaptativa Full HD (1080p)</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">Buffer Inteligente</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </FocusContext.Provider>
  );
};
