import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Video,
  Volume2,
  Cpu,
  Check,
  Eye,
  Columns,
  ChevronDown,
  ChevronUp,
  Info,
  ShieldCheck,
  Sliders,
  Layers
} from 'lucide-react';
import {
  AiEnhancerSettings,
  EnhancementIntensity,
  EnhancerTelemetry,
  VideoProcessingPlan,
  AudioProcessingPlan,
  ContentCategory
} from '../../core/enhancement/aiEnhancerTypes';
import { aiEnhancerService } from '../../core/enhancement/aiEnhancerService';
import { videoEnhancer } from '../../core/enhancement/videoEnhancer';
import { audioEnhancer } from '../../core/enhancement/audioEnhancer';

interface ZapiAiEnhancerPanelProps {
  onClose: () => void;
}

export const ZapiAiEnhancerPanel: React.FC<ZapiAiEnhancerPanelProps> = ({ onClose }) => {
  const [settings, setSettings] = useState<AiEnhancerSettings>(() => aiEnhancerService.getSettings());
  const [telemetry, setTelemetry] = useState<EnhancerTelemetry | null>(null);
  const [videoPlan, setVideoPlan] = useState<VideoProcessingPlan>(() => aiEnhancerService.getVideoPlan());
  const [audioPlan, setAudioPlan] = useState<AudioProcessingPlan>(() => aiEnhancerService.getAudioPlan());
  const [isHoldingOriginal, setIsHoldingOriginal] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  useEffect(() => {
    const unsub = aiEnhancerService.subscribe(newSettings => {
      setSettings(newSettings);
      setVideoPlan(aiEnhancerService.getVideoPlan());
      setAudioPlan(aiEnhancerService.getAudioPlan());
    });

    videoEnhancer.setTelemetryCallback((t, p) => {
      setTelemetry(t);
      setVideoPlan(p);
      setAudioPlan(audioEnhancer.getCurrentPlan());
    });

    return () => {
      unsub();
    };
  }, []);

  const handleToggleMaster = () => {
    aiEnhancerService.toggleEnabled();
  };

  const handleToggleVideo = () => {
    aiEnhancerService.setVideoEnabled(!settings.videoEnabled);
  };

  const handleToggleAudio = () => {
    aiEnhancerService.setAudioEnabled(!settings.audioEnabled);
  };

  const handleSelectIntensity = (intensity: EnhancementIntensity) => {
    aiEnhancerService.setIntensity(intensity);
  };

  const handleSelectCategory = (category?: ContentCategory) => {
    aiEnhancerService.setCategoryOverride(category);
  };

  const handleToggleSplit = () => {
    const newMode = settings.comparisonMode === 'split' ? 'off' : 'split';
    aiEnhancerService.setComparisonMode(newMode);
  };

  // Hold-to-compare handlers
  const handleHoldStart = () => {
    if (!settings.enabled) return;
    setIsHoldingOriginal(true);
    aiEnhancerService.setHoldComparison(true);
  };

  const handleHoldEnd = () => {
    if (!settings.enabled) return;
    setIsHoldingOriginal(false);
    aiEnhancerService.setHoldComparison(false);
  };

  const intensityOptions: Array<{ id: EnhancementIntensity; label: string; desc: string }> = [
    { id: 'auto', label: 'Automático', desc: 'Ajusta dinamicamente conforme cada cena' },
    { id: 'subtle', label: 'Suave', desc: 'Micro-ajustes sutis preservando textura' },
    { id: 'balanced', label: 'Equilibrado', desc: 'Ganho ideal de nitidez e clareza vocal' },
    { id: 'strong', label: 'Forte', desc: 'Máximo ganho para fontes com compressão' }
  ];

  const categoryOptions: Array<{ id?: ContentCategory; label: string }> = [
    { id: undefined, label: 'Auto (IA)' },
    { id: 'anime', label: 'Anime 2D' },
    { id: 'live-action', label: 'Live-Action' },
    { id: 'animation-3d', label: '3D / CGI' }
  ];

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute bottom-12 right-0 bg-[#0f1115]/95 border border-white/10 rounded-2xl p-4 w-84 sm:w-92 shadow-2xl backdrop-blur-2xl space-y-3.5 z-50 animate-in fade-in zoom-in-95 duration-150 select-none text-left max-h-[85vh] overflow-y-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#007df7]/20 border border-[#007df7]/40 flex items-center justify-center text-[#007df7] shadow-[0_0_12px_rgba(0,125,247,0.3)]">
            <Sparkles className="w-4 h-4 fill-current" />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase text-white tracking-wider">Melhoria por IA</h4>
            <span className="text-[10px] text-gray-400 block font-medium">GPU Real-time Engine</span>
          </div>
        </div>

        {/* Master Toggle Switch */}
        <button
          onClick={handleToggleMaster}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
            settings.enabled ? 'bg-[#007df7]' : 'bg-white/20'
          }`}
          title={settings.enabled ? 'Desativar Melhoria por IA' : 'Ativar Melhoria por IA'}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              settings.enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Main Controls */}
      <div className={`space-y-3 transition-opacity duration-200 ${settings.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
        {/* Sub-Toggles: Vídeo e Áudio */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleToggleVideo}
            className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              settings.videoEnabled
                ? 'bg-[#007df7]/15 border-[#007df7]/40 text-white shadow-sm'
                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-[#007df7]" />
              <span>Imagem</span>
            </div>
            {settings.videoEnabled && <Check className="w-3.5 h-3.5 text-[#007df7]" />}
          </button>

          <button
            onClick={handleToggleAudio}
            className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              settings.audioEnabled
                ? 'bg-[#007df7]/15 border-[#007df7]/40 text-white shadow-sm'
                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-[#007df7]" />
              <span>Voz e Som</span>
            </div>
            {settings.audioEnabled && <Check className="w-3.5 h-3.5 text-[#007df7]" />}
          </button>
        </div>

        {/* Ferramentas de Comparação Visual */}
        <div className="space-y-1.5">
          <span className="text-[10px] uppercase font-black text-gray-400 block">Modos de Comparação</span>
          <div className="grid grid-cols-2 gap-2">
            {/* Botão Segurar para Comparar */}
            <button
              onMouseDown={handleHoldStart}
              onMouseUp={handleHoldEnd}
              onMouseLeave={handleHoldEnd}
              onTouchStart={handleHoldStart}
              onTouchEnd={handleHoldEnd}
              className={`p-2 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                isHoldingOriginal
                  ? 'bg-amber-500/25 border-amber-500 text-amber-200 shadow-lg scale-95'
                  : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
              }`}
              title="Segure para ver o original sem filtros e solte para ver aprimorado"
            >
              <Eye className="w-3.5 h-3.5 text-[#007df7]" />
              <span>{isHoldingOriginal ? 'Original...' : 'Segurar Original'}</span>
            </button>

            {/* Divisão de Tela (Split-Screen) */}
            <button
              onClick={handleToggleSplit}
              className={`p-2 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                settings.comparisonMode === 'split'
                  ? 'bg-[#007df7] border-[#007df7] text-white shadow-lg'
                  : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
              }`}
              title="Dividir a tela ao meio para comparar antes e depois"
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Tela Dividida</span>
            </button>
          </div>
        </div>

        {/* Perfil de Conteúdo */}
        <div>
          <span className="text-[10px] uppercase font-black text-gray-400 block mb-1.5">Perfil de Algoritmo</span>
          <div className="grid grid-cols-4 gap-1">
            {categoryOptions.map(cat => {
              const isSelected = settings.categoryOverride === cat.id;
              return (
                <button
                  key={cat.label}
                  onClick={() => handleSelectCategory(cat.id)}
                  className={`py-1.5 px-1 rounded-lg text-[10px] font-bold transition-all text-center cursor-pointer ${
                    isSelected
                      ? 'bg-[#007df7] text-white font-black shadow-sm'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Intensidade */}
        <div>
          <span className="text-[10px] uppercase font-black text-gray-400 block mb-1.5">Intensidade do Processamento</span>
          <div className="grid grid-cols-2 gap-1.5">
            {intensityOptions.map(opt => (
              <button
                key={opt.id}
                onClick={() => handleSelectIntensity(opt.id)}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all text-left flex items-center justify-between cursor-pointer ${
                  settings.intensity === opt.id
                    ? 'bg-[#007df7] text-white shadow-md shadow-[#007df7]/25 font-black'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
                title={opt.desc}
              >
                <span>{opt.label}</span>
                {settings.intensity === opt.id && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            ))}
          </div>
        </div>

        {/* Resumo Dinâmico & Telemetria em Tempo Real */}
        <div className="bg-white/5 border border-white/5 rounded-xl p-2.5 space-y-2 text-[10px]">
          <div className="flex items-center justify-between font-medium">
            <span className="text-gray-400 flex items-center gap-1">
              <Cpu className="w-3 h-3 text-[#007df7]" /> Motor Ativo:
            </span>
            <span className="font-mono font-bold text-gray-200 flex items-center gap-1">
              {videoPlan.activeEngine === 'webgpu' ? (
                <span className="text-cyan-400">WebGPU (Anime4K/CAS)</span>
              ) : videoPlan.activeEngine === 'webgl' ? (
                <span className="text-blue-400">WebGL (Acelerado)</span>
              ) : videoPlan.activeEngine === 'css' ? (
                <span className="text-amber-400">Aceleração Segura (CORS)</span>
              ) : (
                'Nativo'
              )}
            </span>
          </div>

          {videoPlan.explanation && (
            <div className="text-[10px] text-gray-300 bg-black/40 rounded-lg p-2 font-medium leading-relaxed border border-white/5">
              {videoPlan.explanation}
            </div>
          )}

          <div className="grid grid-cols-3 gap-1 pt-1 border-t border-white/10 text-center font-mono">
            <div className="bg-white/5 rounded p-1">
              <span className="text-[9px] text-gray-400 block font-sans">Nitidez</span>
              <span className="text-[#007df7] font-bold">
                {videoPlan.sharpenAmount > 0 ? `+${Math.round(videoPlan.sharpenAmount * 100)}%` : '0%'}
              </span>
            </div>
            <div className="bg-white/5 rounded p-1">
              <span className="text-[9px] text-gray-400 block font-sans">Sombras</span>
              <span className="text-emerald-400 font-bold">
                {videoPlan.luminanceCorrection > 0 ? `+${Math.round(videoPlan.luminanceCorrection * 100)}%` : '0%'}
              </span>
            </div>
            <div className="bg-white/5 rounded p-1">
              <span className="text-[9px] text-gray-400 block font-sans">FPS</span>
              <span className="text-white font-bold">{telemetry?.fps || 60}</span>
            </div>
          </div>

          {/* Toggle de Diagnóstico Avançado */}
          <button
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="w-full pt-1 text-[10px] text-gray-400 hover:text-white flex items-center justify-center gap-1 transition-colors cursor-pointer"
          >
            <span>{showDiagnostics ? 'Ocultar Diagnóstico Técnico' : 'Diagnóstico Avançado'}</span>
            {showDiagnostics ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {/* Detalhes Técnicos Expandidos */}
          {showDiagnostics && (
            <div className="pt-2 border-t border-white/10 space-y-1.5 text-[9px] font-mono text-gray-400 animate-in fade-in duration-150">
              <div className="flex justify-between">
                <span>Resolução Origem:</span>
                <span className="text-gray-200">{telemetry?.resolutionSource || '1920x1080'}</span>
              </div>
              <div className="flex justify-between">
                <span>Resolução Tela:</span>
                <span className="text-gray-200">{telemetry?.resolutionDisplay || '1920x1080'}</span>
              </div>
              <div className="flex justify-between">
                <span>Tempo Quadro:</span>
                <span className="text-gray-200">{telemetry?.avgProcessTimeMs || 1.8} ms</span>
              </div>
              <div className="flex justify-between">
                <span>Voz / Diálogos:</span>
                <span className="text-gray-200">
                  {audioPlan.pipeline === 'webaudio' ? `+${audioPlan.vocalClarityGainDb} dB (Peaking 2.8kHz)` : 'Nativo'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Compressor Áudio:</span>
                <span className="text-gray-200">
                  {audioPlan.pipeline === 'webaudio' ? `${audioPlan.compressorRatio}:1 (${audioPlan.compressorThresholdDb} dB)` : 'Nativo'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Origem CORS:</span>
                <span className={telemetry?.isCorsRestricted ? 'text-amber-400' : 'text-emerald-400'}>
                  {telemetry?.isCorsRestricted ? 'Restrito (Fallback)' : 'Confiável (Acesso GPU Direto)'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {!settings.enabled && (
        <div className="p-2.5 bg-white/5 rounded-xl text-[11px] text-gray-400 text-center leading-relaxed font-medium">
          Ative para aprimorar nitidez de contornos (Anime4K / AMD CAS), iluminar sombras e aumentar clareza de diálogos em tempo real via GPU.
        </div>
      )}
    </div>
  );
};

export default ZapiAiEnhancerPanel;
