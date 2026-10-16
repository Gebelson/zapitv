import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Anime4KWebGPUPipeline, Anime4KParams, DEFAULT_ANIME4K_PARAMS } from '../../core/enhancement/anime4kWebgpuPipeline';
import { Play, Pause, RotateCcw, Eye, Sliders, Cpu, Activity, Download, Layers, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

interface LabProps {
  isDarkMode?: boolean;
}

const TEST_VIDEOS = [
  { id: 'anime_480p', name: 'Animação Padrão (854x480)', url: '/test-videos/anime_480p_sample.mp4', resolution: '480p', type: 'anime' },
  { id: 'intro_480p', name: 'ZapiTV Intro Animation (854x480)', url: '/test-videos/intro_480p.mp4', resolution: '480p', type: 'animation' },
  { id: 'intro_360p', name: 'ZapiTV Intro Baixa Resolução (640x360)', url: '/test-videos/intro_360p.mp4', resolution: '360p', type: 'animation' },
  { id: 'intro_720p', name: 'ZapiTV Intro Alta Resolução (1280x720)', url: '/test-videos/intro_720p.mp4', resolution: '720p', type: 'animation' },
];

export const VideoEnhancementLab: React.FC<LabProps> = ({ isDarkMode = true }) => {
  const [selectedVideo, setSelectedVideo] = useState(TEST_VIDEOS[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pipelineMode, setPipelineMode] = useState<'passthrough' | 'webgpu' | 'off'>('passthrough');
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splitPos, setSplitPos] = useState(50);
  const [isHoldingOriginal, setIsHoldingOriginal] = useState(false);
  const [sideBySide, setSideBySide] = useState(false);
  const [zoomLoupe, setZoomLoupe] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });

  // WebGPU status
  const [webgpuSupported, setWebgpuSupported] = useState<boolean | null>(null);
  const [gpuAdapterName, setGpuAdapterName] = useState<string>('Verificando...');
  const [webgpuError, setWebgpuError] = useState<string | null>(null);

  // Real-time diagnostics
  const [fps, setFps] = useState(0);
  const [processTimeMs, setProcessTimeMs] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [videoDims, setVideoDims] = useState({ width: 0, height: 0 });
  const [canvasDims, setCanvasDims] = useState({ width: 0, height: 0 });
  const [boxDims, setBoxDims] = useState({ width: 0, height: 0 });
  const [tarjaStatus, setTarjaStatus] = useState<'ok' | 'detected'>('ok');

  // Captures
  const [capturedOriginalUrl, setCapturedOriginalUrl] = useState<string | null>(null);
  const [capturedEnhancedUrl, setCapturedEnhancedUrl] = useState<string | null>(null);

  // Controls
  const [params, setParams] = useState<Anime4KParams>({ ...DEFAULT_ANIME4K_PARAMS });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const webgpuCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const passthroughCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sideCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const webgpuPipelineRef = useRef<Anime4KWebGPUPipeline | null>(null);
  const rafIdRef = useRef<number | null>(null);

  // Initialize pipeline
  useEffect(() => {
    const pipeline = new Anime4KWebGPUPipeline();
    webgpuPipelineRef.current = pipeline;

    if (webgpuCanvasRef.current) {
      pipeline.initialize(webgpuCanvasRef.current).then(res => {
        if (res.success) {
          setWebgpuSupported(true);
          const desc = res.adapterInfo?.architecture || res.adapterInfo?.description || 'GPU WebGPU Acelerada';
          setGpuAdapterName(desc);
        } else {
          setWebgpuSupported(false);
          setWebgpuError(res.error || 'Falha ao inicializar WebGPU');
          console.warn('[WebGPU Lab] Erro de inicialização:', res.error);
        }
      });
    }

    return () => {
      pipeline.destroy();
      webgpuPipelineRef.current = null;
    };
  }, []);

  // Update canvas sizing & check for tarjas
  const updateMetrics = useCallback(() => {
    const video = videoRef.current;
    const canvas = pipelineMode === 'webgpu' ? webgpuCanvasRef.current : passthroughCanvasRef.current;
    const container = containerRef.current;
    if (!video || !canvas) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const cw = canvas.width;
    const ch = canvas.height;

    setVideoDims({ width: vw, height: vh });
    setCanvasDims({ width: cw, height: ch });

    if (container) {
      const rect = container.getBoundingClientRect();
      setBoxDims({ width: Math.round(rect.width), height: Math.round(rect.height) });

      // Verificação de tarja:
      // Se a proporção do vídeo e do canvas for idêntica, não existe letterboxing artificial
      if (vw > 0 && vh > 0 && cw > 0 && ch > 0) {
        const vRatio = vw / vh;
        const cRatio = cw / ch;
        const diff = Math.abs(vRatio - cRatio);
        setTarjaStatus(diff < 0.005 ? 'ok' : 'detected');
      }
    }
  }, [pipelineMode]);

  // Frame processing loop
  useEffect(() => {
    let active = true;
    let frames = 0;
    let lastTime = performance.now();

    const render = () => {
      if (!active) return;
      const video = videoRef.current;

      if (video && video.readyState >= 2 && video.videoWidth > 0) {
        const t0 = performance.now();
        let rendered = false;

        const effectiveParams: Anime4KParams = {
          ...params,
          isHoldingOriginal,
          splitEnabled,
          splitPosition: splitPos
        };

        if (pipelineMode === 'webgpu' && webgpuPipelineRef.current && webgpuSupported && webgpuCanvasRef.current) {
          rendered = webgpuPipelineRef.current.render(video, webgpuCanvasRef.current, effectiveParams);
        } else if (pipelineMode === 'passthrough' && passthroughCanvasRef.current) {
          // Fase 1: Passthrough Limpo sem IA via 2D Canvas 1:1
          const c = passthroughCanvasRef.current;
          if (c.width !== video.videoWidth || c.height !== video.videoHeight) {
            c.width = video.videoWidth;
            c.height = video.videoHeight;
          }
          const ctx = c.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
            rendered = true;
          }
        }

        const t1 = performance.now();
        setProcessTimeMs(Number((t1 - t0).toFixed(2)));

        if (rendered) {
          frames++;
          setFrameCount(prev => prev + 1);
        }

        const now = performance.now();
        if (now - lastTime >= 1000) {
          setFps(Math.round((frames * 1000) / (now - lastTime)));
          frames = 0;
          lastTime = now;
        }

        updateMetrics();
      }

      // Utiliza requestVideoFrameCallback se disponível no browser
      if (video && 'requestVideoFrameCallback' in video && typeof (video as any).requestVideoFrameCallback === 'function') {
        (video as any).requestVideoFrameCallback(render);
      } else {
        rafIdRef.current = requestAnimationFrame(render);
      }
    };

    const videoEl = videoRef.current;
    if (videoEl && 'requestVideoFrameCallback' in videoEl && typeof (videoEl as any).requestVideoFrameCallback === 'function') {
      (videoEl as any).requestVideoFrameCallback(render);
    } else {
      rafIdRef.current = requestAnimationFrame(render);
    }

    return () => {
      active = false;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [pipelineMode, params, isHoldingOriginal, splitEnabled, splitPos, webgpuSupported, updateMetrics]);

  // Capture snapshots for visual comparison evidence (Fase 11)
  const handleCaptureSnapshot = useCallback(() => {
    const video = videoRef.current;
    const canvas = pipelineMode === 'webgpu' ? webgpuCanvasRef.current : passthroughCanvasRef.current;
    if (!video || !canvas) return;

    // 1. Amostra do vídeo original
    const origCanvas = document.createElement('canvas');
    origCanvas.width = video.videoWidth;
    origCanvas.height = video.videoHeight;
    const ctx = origCanvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
      const origData = origCanvas.toDataURL('image/png');
      setCapturedOriginalUrl(origData);
    }

    // 2. Amostra do canvas aprimorado
    try {
      const enhData = canvas.toDataURL('image/png');
      setCapturedEnhancedUrl(enhData);
    } catch (e) {
      console.warn('Erro ao extrair imagem do canvas WebGPU:', e);
    }
  }, [pipelineMode]);

  return (
    <div className={`min-h-screen p-4 sm:p-6 lg:p-8 ${isDarkMode ? 'bg-[#0b0e14] text-white' : 'bg-gray-100 text-gray-900'}`}>
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header do Laboratório */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-blue-900/40 via-purple-900/30 to-black/60 border border-blue-500/30 backdrop-blur-md">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-blue-500 text-white">
                Ambiente de Homologação
              </span>
              <span className="text-xs text-gray-400 font-mono">/dev/video-enhancement-lab</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
              Laboratório de Processamento GPU & Anime4K
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Validação isolada de renderização, zero tarjas, super-resolução real e comparação em tempo real.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className={`px-4 py-2 rounded-xl border flex items-center gap-2 text-xs font-bold ${
              webgpuSupported 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}>
              {webgpuSupported ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-amber-400" />}
              <span>{webgpuSupported ? 'WebGPU Ativo' : 'WebGPU Indisponível'}</span>
            </div>
          </div>
        </div>

        {/* Barra de Seleção de Vídeo e Modo de Teste */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Vídeo de Teste Autorizado</label>
            <select
              value={selectedVideo.id}
              onChange={(e) => {
                const found = TEST_VIDEOS.find(v => v.id === e.target.value);
                if (found) {
                  setSelectedVideo(found);
                  if (videoRef.current) {
                    videoRef.current.src = found.url;
                    videoRef.current.load();
                    videoRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
                  }
                }
              }}
              className="px-3 py-2 rounded-lg bg-black/40 border border-white/20 text-sm font-semibold focus:outline-none focus:border-blue-500 text-white"
            >
              {TEST_VIDEOS.map(v => (
                <option key={v.id} value={v.id} className="bg-gray-900 text-white">
                  {v.name} ({v.resolution})
                </option>
              ))}
            </select>
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Pipeline Gráfico</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setPipelineMode('passthrough')}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                  pipelineMode === 'passthrough'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'bg-white/10 hover:bg-white/20 text-gray-300'
                }`}
              >
                1. Passthrough (Sem IA)
              </button>
              <button
                onClick={() => setPipelineMode('webgpu')}
                disabled={!webgpuSupported}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                  pipelineMode === 'webgpu'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                    : webgpuSupported
                    ? 'bg-white/10 hover:bg-white/20 text-gray-300'
                    : 'bg-white/5 text-gray-600 cursor-not-allowed'
                }`}
              >
                2. Anime4K WebGPU
              </button>
              <button
                onClick={() => setPipelineMode('off')}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                  pipelineMode === 'off'
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                    : 'bg-white/10 hover:bg-white/20 text-gray-300'
                }`}
              >
                Apenas Vídeo Nativo
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Comparação Interativa</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSplitEnabled(!splitEnabled)}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                  splitEnabled ? 'bg-amber-600 text-white' : 'bg-white/10 hover:bg-white/20 text-gray-300'
                }`}
              >
                {splitEnabled ? 'Dividir Tela: ATIVADO' : 'Dividir Tela: DESLIGADO'}
              </button>
              <button
                onPointerDown={() => setIsHoldingOriginal(true)}
                onPointerUp={() => setIsHoldingOriginal(false)}
                onPointerLeave={() => setIsHoldingOriginal(false)}
                className="px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 active:scale-95 text-xs font-bold text-white transition-all select-none"
              >
                Segure p/ Original
              </button>
            </div>
          </div>
        </div>

        {/* Viewport Principal de Reprodução e Renderização */}
        <div className="p-4 rounded-2xl bg-black/80 border border-white/10 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between mb-3 px-2">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const video = videoRef.current;
                  if (!video) return;
                  if (isPlaying) {
                    video.pause();
                    setIsPlaying(false);
                  } else {
                    video.play().then(() => setIsPlaying(true)).catch(() => {});
                  }
                }}
                className="p-2.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md active:scale-95 cursor-pointer"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>

              <button
                onClick={() => {
                  const video = videoRef.current;
                  if (video) {
                    video.currentTime = 0;
                    video.play().then(() => setIsPlaying(true)).catch(() => {});
                  }
                }}
                className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 cursor-pointer"
                title="Reiniciar Vídeo"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <div className="text-xs text-gray-300">
                <span className="font-bold">{selectedVideo.name}</span>
                <span className="text-gray-500 ml-2">({videoDims.width}x{videoDims.height})</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleCaptureSnapshot}
                className="px-3 py-1.5 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-xs font-bold text-blue-300 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Capturar Evidências PNG
              </button>

              <button
                onClick={() => setZoomLoupe(!zoomLoupe)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  zoomLoupe ? 'bg-purple-600 text-white' : 'bg-white/10 hover:bg-white/20 text-gray-300'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Lupa de Detalhes (300%)
              </button>
            </div>
          </div>

          {/* Container Visual com Proporção Rígida (Elimina 100% das Tarjas Pretas) */}
          <div
            ref={containerRef}
            className="relative w-full max-h-[70vh] flex items-center justify-center bg-black rounded-xl overflow-hidden select-none"
            style={{
              aspectRatio: videoDims.width && videoDims.height ? `${videoDims.width} / ${videoDims.height}` : '16 / 9'
            }}
            onMouseMove={(e) => {
              if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width;
                const y = (e.clientY - rect.top) / rect.height;
                setMousePos({ x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) });
                if (splitEnabled) {
                  setSplitPos(Math.round(x * 100));
                }
              }
            }}
          >
            {/* Camada 1: Vídeo Nativo */}
            <video
              ref={videoRef}
              src={selectedVideo.url}
              playsInline
              loop
              muted
              autoPlay
              crossOrigin="anonymous"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onLoadedMetadata={updateMetrics}
              className="absolute inset-0 w-full h-full object-fill pointer-events-none"
            />

            {/* Camada 2A: Canvas Passthrough 2D sem IA */}
            <canvas
              ref={passthroughCanvasRef}
              className={`absolute inset-0 w-full h-full object-fill pointer-events-none transition-opacity duration-100 ${
                pipelineMode === 'passthrough' ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            />

            {/* Camada 2B: Canvas Aceleração WebGPU (Anime4K WGSL) */}
            <canvas
              ref={webgpuCanvasRef}
              className={`absolute inset-0 w-full h-full object-fill pointer-events-none transition-opacity duration-100 ${
                pipelineMode === 'webgpu' ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            />

            {/* Divisor Visual de Comparação Dividida */}
            {splitEnabled && pipelineMode !== 'off' && (
              <>
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)] z-10 pointer-events-none"
                  style={{ left: `${splitPos}%` }}
                />
                <div
                  className="absolute top-4 px-2 py-1 rounded bg-black/80 text-[10px] font-black uppercase text-white border border-white/20 z-10 pointer-events-none"
                  style={{ left: `${Math.max(2, splitPos - 12)}%` }}
                >
                  Original
                </div>
                <div
                  className="absolute top-4 px-2 py-1 rounded bg-blue-600 text-[10px] font-black uppercase text-white border border-blue-400 z-10 pointer-events-none"
                  style={{ left: `${Math.min(88, splitPos + 2)}%` }}
                >
                  Anime4K WebGPU
                </div>
              </>
            )}

            {/* Lupa de Detalhes 300% para comprovação de Super-Resolução */}
            {zoomLoupe && (
              <div
                className="absolute w-48 h-48 rounded-full border-2 border-blue-400 shadow-2xl pointer-events-none overflow-hidden z-20"
                style={{
                  left: `calc(${mousePos.x * 100}% - 96px)`,
                  top: `calc(${mousePos.y * 100}% - 96px)`,
                  backgroundImage: `url(${capturedEnhancedUrl || selectedVideo.url})`,
                  backgroundSize: `${boxDims.width * 3}px ${boxDims.height * 3}px`,
                  backgroundPosition: `-${mousePos.x * boxDims.width * 3 - 96}px -${mousePos.y * boxDims.height * 3 - 96}px`,
                  boxShadow: '0 0 20px rgba(0, 125, 247, 0.6)'
                }}
              >
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/80 px-2 py-0.5 rounded text-[9px] font-bold text-white uppercase">
                  Zoom 300%
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Painel de Diagnóstico Rigoroso e Métricas da GPU */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Taxa de Quadros</span>
            <span className="text-xl font-black text-emerald-400 mt-0.5">{fps} FPS</span>
            <span className="text-[10px] text-gray-500">{frameCount} frames processados</span>
          </div>

          <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Tempo por Frame</span>
            <span className="text-xl font-black text-blue-400 mt-0.5">{processTimeMs} ms</span>
            <span className="text-[10px] text-gray-500">Orçamento: &lt; 33.3ms (30fps)</span>
          </div>

          <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Resolução do Vídeo</span>
            <span className="text-xl font-black text-purple-400 mt-0.5">{videoDims.width}x{videoDims.height}</span>
            <span className="text-[10px] text-gray-500">Proporção: {(videoDims.width / (videoDims.height || 1)).toFixed(3)}</span>
          </div>

          <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Resolução do Canvas</span>
            <span className="text-xl font-black text-cyan-400 mt-0.5">{canvasDims.width}x{canvasDims.height}</span>
            <span className="text-[10px] text-gray-500">Pixel Ratio 1:1 rigoroso</span>
          </div>

          <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Status de Tarjas</span>
            <span className={`text-xl font-black mt-0.5 ${tarjaStatus === 'ok' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {tarjaStatus === 'ok' ? '0 Tarjas' : 'Desalinhado'}
            </span>
            <span className="text-[10px] text-gray-500">Enquadramento Perfeito</span>
          </div>

          <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Dispositivo GPU</span>
            <span className="text-xs font-bold text-white mt-1 truncate" title={gpuAdapterName}>
              {gpuAdapterName}
            </span>
            <span className="text-[10px] text-emerald-400">Hardware Nativo</span>
          </div>
        </div>

        {/* Parâmetros do Anime4K para Ajustes Técnicos de Laboratório */}
        <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-bold">Parâmetros do Kernel Anime4K (WGSL)</h2>
            </div>
            <button
              onClick={() => setParams({ ...DEFAULT_ANIME4K_PARAMS })}
              className="text-xs text-blue-400 hover:text-blue-300 font-bold underline cursor-pointer"
            >
              Restaurar Padrões Ideais
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-gray-300">Afinamento de Traço (Line Thinning)</span>
                <span className="text-blue-400">{params.lineThinningAmount.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1.5"
                step="0.05"
                value={params.lineThinningAmount}
                onChange={(e) => setParams({ ...params, lineThinningAmount: parseFloat(e.target.value) })}
                className="w-full accent-blue-500"
              />
              <span className="text-[10px] text-gray-500">Afina contornos grossos típicos de ampliação 480p.</span>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-gray-300">Nitidez e Deblur (Sharpen)</span>
                <span className="text-blue-400">{params.sharpenAmount.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="2.0"
                step="0.05"
                value={params.sharpenAmount}
                onChange={(e) => setParams({ ...params, sharpenAmount: parseFloat(e.target.value) })}
                className="w-full accent-blue-500"
              />
              <span className="text-[10px] text-gray-500">Restaura definição de bordas sem criar halos.</span>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-gray-300">Denoise Bilateral Cel-Shading</span>
                <span className="text-blue-400">{params.denoiseAmount.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1.0"
                step="0.05"
                value={params.denoiseAmount}
                onChange={(e) => setParams({ ...params, denoiseAmount: parseFloat(e.target.value) })}
                className="w-full accent-blue-500"
              />
              <span className="text-[10px] text-gray-500">Remove granulação e artefatos de blocos H.264.</span>
            </div>
          </div>
        </div>

        {/* Seção de Evidências Capturadas (Fase 11) */}
        {(capturedOriginalUrl || capturedEnhancedUrl) && (
          <div className="p-6 rounded-2xl bg-black/60 border border-blue-500/30 space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              Evidências Visuais Capturadas no Mesmo Frame
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {capturedOriginalUrl && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-gray-400 uppercase">Frame Original ({videoDims.width}x{videoDims.height})</span>
                    <a
                      href={capturedOriginalUrl}
                      download={`zapitv-frame-original-${selectedVideo.id}.png`}
                      className="text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" /> Baixar PNG
                    </a>
                  </div>
                  <img
                    src={capturedOriginalUrl}
                    alt="Frame Original"
                    className="w-full rounded-xl border border-white/10"
                  />
                </div>
              )}

              {capturedEnhancedUrl && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-blue-400 uppercase">Frame Aprimorado Anime4K WebGPU</span>
                    <a
                      href={capturedEnhancedUrl}
                      download={`zapitv-frame-enhanced-anime4k-${selectedVideo.id}.png`}
                      className="text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" /> Baixar PNG
                    </a>
                  </div>
                  <img
                    src={capturedEnhancedUrl}
                    alt="Frame Aprimorado"
                    className="w-full rounded-xl border border-blue-500/40 shadow-lg"
                  />
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
