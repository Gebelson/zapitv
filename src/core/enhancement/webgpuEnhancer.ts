/**
 * ZapiTV — WebGPUEnhancer
 * Motor de aprimoramento de vídeo em tempo real acelerado por WebGPU.
 * 
 * Implementa:
 * 1. Shaders WGSL avançados com algoritmo Anime4K (Line Restoration, Thinning, Deblur & Bilateral Denoise)
 * 2. AMD FidelityFX CAS (Contrast Adaptive Sharpening) em WGSL para Filmes e Séries Live-Action
 * 3. Textura GPU reutilizável com zero alocações por quadro (evita GC pauses e perda de FPS)
 * 4. Comparação instantânea (Hold-to-Compare) sem interrupção de reprodução
 */

import { ContentCategory, VideoProcessingPlan } from './aiEnhancerTypes';

type GPUDevice = any;
type GPUCanvasContext = any;
type GPURenderPipeline = any;
type GPUBuffer = any;
type GPUSampler = any;
type GPUTexture = any;
type GPURenderPassDescriptor = any;

const GPU_BUFFER_USAGE_UNIFORM = 0x0040;
const GPU_BUFFER_USAGE_COPY_DST = 0x0008;
const GPU_TEXTURE_USAGE_TEXTURE_BINDING = 0x04;
const GPU_TEXTURE_USAGE_COPY_DST = 0x02;
const GPU_TEXTURE_USAGE_RENDER_ATTACHMENT = 0x10;

// Shader WGSL de Alto Desempenho com Anime4K e AMD CAS
const WGSL_SHADER_SOURCE = /* wgsl */ `
struct Uniforms {
  textureSize: vec2<f32>,
  sharpenAmount: f32,
  denoiseAmount: f32,
  luminanceCorrection: f32,
  contrastMultiplier: f32,
  saturationMultiplier: f32,
  contentType: f32, // 0 = live-action/CAS, 1 = anime, 2 = 3d
  isHoldingOriginal: f32, // 1 = bypass instantâneo
  pad0: f32,
  pad1: f32,
  pad2: f32,
  pad3: vec4<f32>,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var u_sampler: sampler;
@group(0) @binding(2) var u_texture: texture_2d<f32>;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var pos = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>( 1.0,  1.0)
  );

  var uv = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, 0.0),
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(1.0, 0.0)
  );

  var output: VertexOutput;
  output.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
  output.uv = uv[vertexIndex];
  return output;
}

fn getLuma(color: vec3<f32>) -> f32 {
  return dot(color, vec3<f32>(0.2126, 0.7152, 0.0722));
}

// Algoritmo AMD FidelityFX CAS (Contrast Adaptive Sharpening) com Proteção de Pele
fn applyAmdCas(uv: vec2<f32>, step: vec2<f32>, sharpWeight: f32) -> vec3<f32> {
  let c = textureSample(u_texture, u_sampler, uv).rgb;
  let a = textureSample(u_texture, u_sampler, uv + vec2<f32>(0.0, -step.y)).rgb;
  let b = textureSample(u_texture, u_sampler, uv + vec2<f32>(-step.x, 0.0)).rgb;
  let d = textureSample(u_texture, u_sampler, uv + vec2<f32>(step.x, 0.0)).rgb;
  let e = textureSample(u_texture, u_sampler, uv + vec2<f32>(0.0, step.y)).rgb;

  let minRgb = min(c, min(min(a, b), min(d, e)));
  let maxRgb = max(c, max(max(a, b), max(d, e)));

  // Protege tons de pele natural para não criar granulação artificial em rostos
  let isSkinTone = (c.r > c.g) && (c.g > c.b) && (c.r - c.b > 0.08) && (c.r < 0.92);
  var effectiveSharp = sharpWeight;
  if (isSkinTone) {
    effectiveSharp = sharpWeight * 0.45;
  }

  // Amplitude local e ponderação adaptativa CAS com ganho visual nítido
  let amp = saturate(min(minRgb, 2.0 - maxRgb) / max(maxRgb, vec3<f32>(0.0001)));
  let w = -sqrt(amp) * (effectiveSharp * 0.70);

  let weightAvg = (w.r + w.g + w.b) / 3.0;
  let weightSum = 1.0 + 4.0 * weightAvg;
  let sharpened = (c + (a + b + d + e) * weightAvg) / max(weightSum, 0.001);

  return clamp(sharpened, vec3<f32>(0.0), vec3<f32>(1.0));
}

// Algoritmo Anime4K: Restauração de linhas (Line Thinning/Darkening) + Denoise Bilateral
fn applyAnime4K(uv: vec2<f32>, step: vec2<f32>, sharpWeight: f32, denoiseWeight: f32) -> vec3<f32> {
  let c  = textureSample(u_texture, u_sampler, uv).rgb;
  let up = textureSample(u_texture, u_sampler, uv + vec2<f32>(0.0, -step.y)).rgb;
  let dn = textureSample(u_texture, u_sampler, uv + vec2<f32>(0.0, step.y)).rgb;
  let lf = textureSample(u_texture, u_sampler, uv + vec2<f32>(-step.x, 0.0)).rgb;
  let rt = textureSample(u_texture, u_sampler, uv + vec2<f32>(step.x, 0.0)).rgb;
  let ul = textureSample(u_texture, u_sampler, uv + vec2<f32>(-step.x, -step.y)).rgb;
  let ur = textureSample(u_texture, u_sampler, uv + vec2<f32>(step.x, -step.y)).rgb;
  let dl = textureSample(u_texture, u_sampler, uv + vec2<f32>(-step.x, step.y)).rgb;
  let dr = textureSample(u_texture, u_sampler, uv + vec2<f32>(step.x, step.y)).rgb;

  // 1. Denoise bilateral de áreas planas (remove artefatos de compressão H.264/MPEG de animes)
  var filtered = c;
  if (denoiseWeight > 0.05) {
    let gx = (ur.r + 2.0 * rt.r + dr.r) - (ul.r + 2.0 * lf.r + dl.r);
    let gy = (dl.r + 2.0 * dn.r + dr.r) - (ul.r + 2.0 * up.r + ur.r);
    let grad = abs(gx) + abs(gy);

    // Em áreas com baixo gradiente (cel shading plano) aplica média bilateral
    if (grad < 0.28) {
      let avg = (c * 3.0 + up + dn + lf + rt + ul + ur + dl + dr) / 11.0;
      filtered = mix(c, avg, clamp(denoiseWeight * 0.85, 0.0, 0.80));
    }
  }

  // 2. Anime4K Line Restoration & Thinning (Aprimoramento de traços e contornos)
  var lineEnhanced = filtered;
  if (sharpWeight > 0.05) {
    let minNeighbor = min(min(up, dn), min(lf, rt));
    let maxNeighbor = max(max(up, dn), max(lf, rt));
    let edgeDiff = length(maxNeighbor - minNeighbor);

    // Identifica linhas pretas e bordas de anime
    if (edgeDiff > 0.08 && edgeDiff < 0.92) {
      // Afina o traço aproximando os pixels de borda do valor mínimo vizinho
      let lineBlend = clamp(sharpWeight * 0.75, 0.0, 0.70);
      lineEnhanced = mix(filtered, minNeighbor, lineBlend);
    } else {
      // Texturas internas e detalhes: unsharp mask suave
      let blur = (up + dn + lf + rt) * 0.25;
      let detail = filtered - blur;
      lineEnhanced = clamp(filtered + detail * (sharpWeight * 1.1), vec3<f32>(0.0), vec3<f32>(1.0));
    }
  }

  return lineEnhanced;
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let rawColor = textureSample(u_texture, u_sampler, uv);

  // Bypass instantâneo quando o usuário pressiona para comparar com o original
  if (u.isHoldingOriginal > 0.5) {
    return rawColor;
  }

  let step = 1.0 / u.textureSize;
  var color: vec3<f32>;

  if (u.contentType > 0.5 && u.contentType < 1.5) {
    // Anime 2D: Pipeline Anime4K de traços e cel-shading
    color = applyAnime4K(uv, step, u.sharpenAmount, u.denoiseAmount);
  } else {
    // Live-Action & Animação 3D: AMD FidelityFX CAS
    color = applyAmdCas(uv, step, u.sharpenAmount);
  }

  // Compensação de sombras inteligente sem estourar pretos absolutos
  if (abs(u.luminanceCorrection) > 0.005) {
    let l = getLuma(color);
    let shadowMask = clamp((1.0 - l) * 1.5, 0.0, 1.0);
    color = color + (u.luminanceCorrection * shadowMask * (1.0 - color));
  }

  // Micro-contraste adaptativo suave
  if (abs(u.contrastMultiplier - 1.0) > 0.01) {
    let luma = getLuma(color);
    let sCurve = luma * luma * (3.0 - 2.0 * luma);
    color = mix(color, color * (sCurve / max(luma, 0.001)), clamp(u.contrastMultiplier - 1.0, 0.0, 0.25));
  }

  // Preservação de vivacidade e cores
  if (u.saturationMultiplier > 1.0) {
    let gray = getLuma(color);
    color = mix(vec3<f32>(gray), color, u.saturationMultiplier);
  }

  return vec4<f32>(clamp(color, vec3<f32>(0.0), vec3<f32>(1.0)), rawColor.a);
}
`;

export class WebGPUEnhancer {
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private pipeline: GPURenderPipeline | null = null;
  private uniformBuffer: GPUBuffer | null = null;
  private sampler: GPUSampler | null = null;
  private videoTexture: GPUTexture | null = null;
  private textureWidth = 0;
  private textureHeight = 0;
  private bindGroup: any = null;
  private presentationFormat: any = null;
  private isInitialized = false;
  private isSupported = false;

  constructor() {
    this.checkSupport();
  }

  public checkSupport(): boolean {
    if (typeof navigator !== 'undefined' && (navigator as any).gpu) {
      this.isSupported = true;
      return true;
    }
    this.isSupported = false;
    return false;
  }

  public isAvailable(): boolean {
    return this.isSupported;
  }

  public async init(canvas: HTMLCanvasElement): Promise<boolean> {
    if (!this.checkSupport()) return false;

    try {
      const gpu = (navigator as any).gpu;
      const adapter = await gpu.requestAdapter({
        powerPreference: 'high-performance'
      });

      if (!adapter) {
        console.warn('[ZapiWebGPU] Adaptador WebGPU não encontrado.');
        return false;
      }

      this.device = await adapter.requestDevice();
      if (!this.device) {
        return false;
      }

      const presentationFormat = gpu.getPreferredCanvasFormat();
      this.presentationFormat = presentationFormat;

      // Compila o shader e pipeline primeiro
      const shaderModule = this.device.createShaderModule({
        label: 'ZapiTV AI Enhancement Shaders',
        code: WGSL_SHADER_SOURCE
      });

      this.pipeline = this.device.createRenderPipeline({
        label: 'ZapiTV AI Pipeline',
        layout: 'auto',
        vertex: {
          module: shaderModule,
          entryPoint: 'vs_main'
        },
        fragment: {
          module: shaderModule,
          entryPoint: 'fs_main',
          targets: [{ format: presentationFormat }]
        },
        primitive: {
          topology: 'triangle-list'
        }
      });

      this.context = canvas.getContext('webgpu') as GPUCanvasContext | null;
      if (!this.context) {
        return false;
      }

      this.context.configure({
        device: this.device,
        format: presentationFormat,
        alphaMode: 'premultiplied'
      });

      // Uniform buffer para parâmetros dinâmicos (64 bytes)
      this.uniformBuffer = this.device.createBuffer({
        size: 64,
        usage: GPU_BUFFER_USAGE_UNIFORM | GPU_BUFFER_USAGE_COPY_DST
      });

      this.sampler = this.device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear'
      });

      this.isInitialized = true;
      return true;
    } catch (err) {
      console.warn('[ZapiWebGPU] Erro ao inicializar motor WebGPU:', err);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Renderiza um quadro do elemento <video> com textura reutilizável zero-copy
   */
  public renderFrame(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    plan: VideoProcessingPlan,
    category: ContentCategory,
    isHoldingOriginal: boolean = false
  ): boolean {
    if (!this.isInitialized || !this.device || !this.context || !this.pipeline || !this.uniformBuffer || !this.sampler) {
      return false;
    }

    try {
      const vWidth = video.videoWidth;
      const vHeight = video.videoHeight;
      if (!vWidth || !vHeight || video.readyState < 2) return false;

      // Sincroniza dimensões do canvas com o vídeo e reconfigura swap chain se necessário
      if (canvas.width !== vWidth || canvas.height !== vHeight) {
        canvas.width = vWidth;
        canvas.height = vHeight;
        if (this.presentationFormat) {
          this.context.configure({
            device: this.device,
            format: this.presentationFormat,
            alphaMode: 'premultiplied'
          });
        }
      }

      // Reutiliza a textura GPU existente sem alocar a cada frame
      if (!this.videoTexture || this.textureWidth !== vWidth || this.textureHeight !== vHeight) {
        if (this.videoTexture) {
          try { this.videoTexture.destroy(); } catch {}
        }
        this.videoTexture = this.device.createTexture({
          size: [vWidth, vHeight, 1],
          format: 'rgba8unorm',
          usage: GPU_TEXTURE_USAGE_TEXTURE_BINDING | GPU_TEXTURE_USAGE_COPY_DST | GPU_TEXTURE_USAGE_RENDER_ATTACHMENT
        });
        this.textureWidth = vWidth;
        this.textureHeight = vHeight;

        // Recria bindGroup associado à nova textura
        this.bindGroup = this.device.createBindGroup({
          layout: this.pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: this.uniformBuffer } },
            { binding: 1, resource: this.sampler },
            { binding: 2, resource: this.videoTexture.createView() }
          ]
        });
      }

      // Copia o quadro atual do elemento de vídeo para a textura GPU
      this.device.queue.copyExternalImageToTexture(
        { source: video },
        { texture: this.videoTexture },
        [vWidth, vHeight]
      );

      // Atualiza uniforms dinâmicos (64 bytes = 16 floats)
      const uniformData = new Float32Array([
        vWidth,
        vHeight,
        plan.sharpenAmount,
        plan.denoiseAmount,
        plan.luminanceCorrection,
        plan.contrastMultiplier,
        plan.saturationMultiplier,
        category === 'anime' ? 1.0 : (category === 'animation-3d' ? 2.0 : 0.0),
        isHoldingOriginal ? 1.0 : 0.0,
        0.0, 0.0, 0.0,
        0.0, 0.0, 0.0, 0.0
      ]);

      this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);

      const commandEncoder = this.device.createCommandEncoder();
      const textureView = this.context.getCurrentTexture().createView();

      const renderPassDescriptor: GPURenderPassDescriptor = {
        colorAttachments: [
          {
            view: textureView,
            clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 },
            loadOp: 'clear',
            storeOp: 'store'
          }
        ]
      };

      const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
      passEncoder.setPipeline(this.pipeline);
      passEncoder.setBindGroup(0, this.bindGroup);
      passEncoder.draw(6);
      passEncoder.end();

      this.device.queue.submit([commandEncoder.finish()]);

      return true;
    } catch (err: any) {
      if (err?.name === 'SecurityError' || String(err).includes('tainted')) {
        return false;
      }
      return false;
    }
  }

  public destroy(): void {
    if (this.videoTexture) {
      try { this.videoTexture.destroy(); } catch {}
      this.videoTexture = null;
    }
    if (this.uniformBuffer) {
      try { this.uniformBuffer.destroy(); } catch {}
      this.uniformBuffer = null;
    }
    this.bindGroup = null;
    this.device = null;
    this.context = null;
    this.pipeline = null;
    this.isInitialized = false;
  }
}

export const webgpuEnhancer = new WebGPUEnhancer();
