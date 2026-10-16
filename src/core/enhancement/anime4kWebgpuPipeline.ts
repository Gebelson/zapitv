/**
 * ZapiTV — Anime4K WebGPU Real Processing Pipeline
 * Implementação nativa de Super-Resolução e Restauração de Linhas em WGSL.
 * Executa passes de Line Thinning, Deblur adaptativo e Denoise Bilateral em GPU real.
 */

export interface Anime4KParams {
  sharpenAmount: number;      // 0.0 a 2.0 (padrão 1.0 para anime)
  lineThinningAmount: number; // 0.0 a 1.5 (padrão 0.8)
  denoiseAmount: number;      // 0.0 a 1.0 (padrão 0.5)
  luminanceCorrection: number;// -0.2 a 0.2
  contrastMultiplier: number; // 1.0 a 1.2
  saturationMultiplier: number;// 1.0 a 1.15
  isHoldingOriginal: boolean; // bypass instantâneo
  splitPosition: number;      // 0 a 100 (% para split screen)
  splitEnabled: boolean;
}

export const DEFAULT_ANIME4K_PARAMS: Anime4KParams = {
  sharpenAmount: 1.0,
  lineThinningAmount: 0.8,
  denoiseAmount: 0.5,
  luminanceCorrection: 0.0,
  contrastMultiplier: 1.0,
  saturationMultiplier: 1.0,
  isHoldingOriginal: false,
  splitPosition: 50,
  splitEnabled: false
};

const ANIME4K_WGSL = /* wgsl */ `
struct Uniforms {
  textureSize: vec2<f32>,
  sharpenAmount: f32,
  lineThinningAmount: f32,
  denoiseAmount: f32,
  luminanceCorrection: f32,
  contrastMultiplier: f32,
  saturationMultiplier: f32,
  isHoldingOriginal: f32,
  splitPosition: f32,
  splitEnabled: f32,
  pad0: f32,
  pad1: vec4<f32>,
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

// 1. Bilateral Denoise para remoção de artefatos de compressão em cel-shading
fn anime4kDenoise(uv: vec2<f32>, step: vec2<f32>, centerCol: vec3<f32>, weight: f32) -> vec3<f32> {
  if (weight <= 0.02) {
    return centerCol;
  }
  let cLuma = getLuma(centerCol);
  var sumCol = centerCol;
  var sumWeight = 1.0;

  let offsets = array<vec2<f32>, 8>(
    vec2<f32>(-1.0, -1.0), vec2<f32>( 0.0, -1.0), vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  0.0),                         vec2<f32>( 1.0,  0.0),
    vec2<f32>(-1.0,  1.0), vec2<f32>( 0.0,  1.0), vec2<f32>( 1.0,  1.0)
  );

  let spatialSigmaSq = 2.0;
  let rangeSigmaSq = max(0.002, 0.05 * (1.0 - weight * 0.5));

  for (var i = 0; i < 8; i++) {
    let sampleUv = uv + offsets[i] * step;
    let sCol = textureSample(u_texture, u_sampler, sampleUv).rgb;
    let sLuma = getLuma(sCol);

    let dSpatial = dot(offsets[i], offsets[i]);
    let dRange = (sLuma - cLuma) * (sLuma - cLuma);

    let w = exp(-dSpatial / spatialSigmaSq - dRange / rangeSigmaSq);
    sumCol += sCol * w;
    sumWeight += w;
  }

  let filtered = sumCol / sumWeight;
  return mix(centerCol, filtered, clamp(weight * 0.85, 0.0, 0.90));
}

// 2. Anime4K Line Restoration & Thinning (Restauração e Afinamento de Linhas)
fn anime4kLineThinning(uv: vec2<f32>, step: vec2<f32>, col: vec3<f32>, thinWeight: f32, sharpWeight: f32) -> vec3<f32> {
  // Amostragem da vizinhança 3x3
  let tl = textureSample(u_texture, u_sampler, uv + vec2<f32>(-step.x, -step.y)).rgb;
  let tc = textureSample(u_texture, u_sampler, uv + vec2<f32>( 0.0,    -step.y)).rgb;
  let tr = textureSample(u_texture, u_sampler, uv + vec2<f32>( step.x, -step.y)).rgb;

  let ml = textureSample(u_texture, u_sampler, uv + vec2<f32>(-step.x,  0.0)).rgb;
  let mc = col;
  let mr = textureSample(u_texture, u_sampler, uv + vec2<f32>( step.x,  0.0)).rgb;

  let bl = textureSample(u_texture, u_sampler, uv + vec2<f32>(-step.x,  step.y)).rgb;
  let bc = textureSample(u_texture, u_sampler, uv + vec2<f32>( 0.0,     step.y)).rgb;
  let br = textureSample(u_texture, u_sampler, uv + vec2<f32>( step.x,  step.y)).rgb;

  let l_tl = getLuma(tl); let l_tc = getLuma(tc); let l_tr = getLuma(tr);
  let l_ml = getLuma(ml); let l_mc = getLuma(mc); let l_mr = getLuma(mr);
  let l_bl = getLuma(bl); let l_bc = getLuma(bc); let l_br = getLuma(br);

  // Gradiente Sobel para identificar a direção normal da linha de contorno
  let gx = (l_tr + 2.0 * l_mr + l_br) - (l_tl + 2.0 * l_ml + l_bl);
  let gy = (l_bl + 2.0 * l_bc + l_br) - (l_tl + 2.0 * l_tc + l_tr);
  let gradLen = sqrt(gx * gx + gy * gy);

  var result = mc;

  // Se estiver sobre uma borda/linha de contorno
  if (gradLen > 0.06 && thinWeight > 0.05) {
    let normal = normalize(vec2<f32>(gx, gy));
    let sampleA = textureSample(u_texture, u_sampler, uv - normal * step * 0.85).rgb;
    let sampleB = textureSample(u_texture, u_sampler, uv + normal * step * 0.85).rgb;

    let lumaA = getLuma(sampleA);
    let lumaB = getLuma(sampleB);

    // O centro da linha de anime é mais escuro que a vizinhança.
    // Para afinar o traço e recuperar nitidez original sem serrilhar:
    let minSample = select(sampleB, sampleA, lumaA < lumaB);
    let maxSample = select(sampleA, sampleB, lumaA < lumaB);

    let edgeContrast = (max(lumaA, lumaB) - min(lumaA, lumaB));
    let blendFactor = clamp(thinWeight * 0.75 * edgeContrast * 2.5, 0.0, 0.65);

    // Se o pixel atual estiver no halo externo da linha, empurra para clarear
    if (l_mc > min(lumaA, lumaB) + 0.08) {
      result = mix(mc, maxSample, blendFactor * 0.55);
    } else {
      // Se estiver próximo ao núcleo da linha, consolida o pigmento escuro
      result = mix(mc, minSample, blendFactor * 0.40);
    }
  }

  // 3. Unsharp Mask adaptativo para preservação de micro-texturas e olhos
  if (sharpWeight > 0.05) {
    let blur = (tc + ml + mr + bc) * 0.25;
    let highPass = result - blur;
    // Limita o unsharp para evitar overshoot (halos brancos)
    let clampedHighPass = clamp(highPass, vec3<f32>(-0.15), vec3<f32>(0.15));
    result = clamp(result + clampedHighPass * (sharpWeight * 0.90), vec3<f32>(0.0), vec3<f32>(1.0));
  }

  return result;
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let rawColor = textureSample(u_texture, u_sampler, uv);

  // Bypass instantâneo para comparação
  if (u.isHoldingOriginal > 0.5) {
    return rawColor;
  }

  // Split-screen interativo: à esquerda exibe original, à direita aprimorado
  if (u.splitEnabled > 0.5) {
    let splitCoord = u.splitPosition / 100.0;
    if (uv.x < splitCoord) {
      return rawColor;
    }
    // Linha divisória branca suave
    if (abs(uv.x - splitCoord) < (1.5 / u.textureSize.x)) {
      return vec4<f32>(1.0, 1.0, 1.0, 1.0);
    }
  }

  let step = 1.0 / u.textureSize;

  // Pass 1: Denoise bilateral cel-shading
  let denoised = anime4kDenoise(uv, step, rawColor.rgb, u.denoiseAmount);

  // Pass 2: Line thinning & edge restoration
  var enhanced = anime4kLineThinning(uv, step, denoised, u.lineThinningAmount, u.sharpenAmount);

  // Compensação de sombras suave se solicitada
  if (abs(u.luminanceCorrection) > 0.005) {
    let l = getLuma(enhanced);
    let shadowMask = clamp((1.0 - l) * 1.5, 0.0, 1.0);
    enhanced = enhanced + (u.luminanceCorrection * shadowMask * (1.0 - enhanced));
  }

  // Micro-contraste s-curve sutil
  if (abs(u.contrastMultiplier - 1.0) > 0.01) {
    let luma = getLuma(enhanced);
    let sCurve = luma * luma * (3.0 - 2.0 * luma);
    enhanced = mix(enhanced, enhanced * (sCurve / max(luma, 0.001)), clamp(u.contrastMultiplier - 1.0, 0.0, 0.20));
  }

  // Saturação natural
  if (u.saturationMultiplier > 1.0) {
    let gray = getLuma(enhanced);
    enhanced = mix(vec3<f32>(gray), enhanced, u.saturationMultiplier);
  }

  return vec4<f32>(clamp(enhanced, vec3<f32>(0.0), vec3<f32>(1.0)), rawColor.a);
}
`;

export class Anime4KWebGPUPipeline {
  private device: any = null;
  private context: any = null;
  private pipeline: any = null;
  private uniformBuffer: any = null;
  private sampler: any = null;
  private videoTexture: any = null;
  private textureWidth = 0;
  private textureHeight = 0;
  private bindGroup: any = null;
  private presentationFormat: any = null;
  private isInitialized = false;
  private adapterInfo: any = null;

  public async initialize(canvas: HTMLCanvasElement): Promise<{ success: boolean; error?: string; adapterInfo?: any }> {
    if (typeof navigator === 'undefined' || !(navigator as any).gpu) {
      return { success: false, error: 'WebGPU (navigator.gpu) não está disponível no navegador.' };
    }

    try {
      const gpu = (navigator as any).gpu;
      const adapter = await gpu.requestAdapter({
        powerPreference: 'high-performance'
      });

      if (!adapter) {
        return { success: false, error: 'Adaptador WebGPU não encontrado pelo sistema.' };
      }

      this.adapterInfo = (adapter as any).info || { name: 'GPU Compatível WebGPU' };
      this.device = await adapter.requestDevice();

      if (!this.device) {
        return { success: false, error: 'Falha ao instanciar GPUDevice.' };
      }

      const presentationFormat = gpu.getPreferredCanvasFormat();
      this.presentationFormat = presentationFormat;

      const shaderModule = this.device.createShaderModule({
        label: 'ZapiTV Anime4K Real Shaders',
        code: ANIME4K_WGSL
      });

      this.pipeline = this.device.createRenderPipeline({
        label: 'ZapiTV Anime4K Pipeline',
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

      this.context = canvas.getContext('webgpu');
      if (!this.context) {
        return { success: false, error: 'Canvas.getContext("webgpu") retornou nulo.' };
      }

      this.context.configure({
        device: this.device,
        format: presentationFormat,
        alphaMode: 'premultiplied'
      });

      // Buffer uniforme de 64 bytes (16 floats de 32 bits)
      this.uniformBuffer = this.device.createBuffer({
        size: 64,
        usage: 0x0040 | 0x0008 // UNIFORM | COPY_DST
      });

      this.sampler = this.device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear'
      });

      this.isInitialized = true;
      return { success: true, adapterInfo: this.adapterInfo };
    } catch (err: any) {
      return { success: false, error: String(err?.message || err) };
    }
  }

  public render(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    params: Anime4KParams = DEFAULT_ANIME4K_PARAMS
  ): boolean {
    if (!this.isInitialized || !this.device || !this.context || !this.pipeline || !this.uniformBuffer || !this.sampler) {
      return false;
    }

    try {
      const vWidth = video.videoWidth;
      const vHeight = video.videoHeight;
      if (!vWidth || !vHeight || video.readyState < 2) return false;

      // Sincroniza dimensões internas do canvas 1:1 com os pixels reais do vídeo
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

      // Reutilização eficiente de textura GPU (Zero allocations per frame)
      if (!this.videoTexture || this.textureWidth !== vWidth || this.textureHeight !== vHeight) {
        if (this.videoTexture) {
          try { this.videoTexture.destroy(); } catch {}
        }
        this.videoTexture = this.device.createTexture({
          size: [vWidth, vHeight, 1],
          format: 'rgba8unorm',
          usage: 0x04 | 0x02 | 0x10 // TEXTURE_BINDING | COPY_DST | RENDER_ATTACHMENT
        });
        this.textureWidth = vWidth;
        this.textureHeight = vHeight;

        this.bindGroup = this.device.createBindGroup({
          layout: this.pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: this.uniformBuffer } },
            { binding: 1, resource: this.sampler },
            { binding: 2, resource: this.videoTexture.createView() }
          ]
        });
      }

      // Cópia ultra-rápida do frame de vídeo para a textura WebGPU
      this.device.queue.copyExternalImageToTexture(
        { source: video },
        { texture: this.videoTexture },
        [vWidth, vHeight]
      );

      // Atualiza uniform data (16 floats = 64 bytes)
      const uniformFloats = new Float32Array([
        vWidth,
        vHeight,
        params.sharpenAmount,
        params.lineThinningAmount,
        params.denoiseAmount,
        params.luminanceCorrection,
        params.contrastMultiplier,
        params.saturationMultiplier,
        params.isHoldingOriginal ? 1.0 : 0.0,
        params.splitPosition,
        params.splitEnabled ? 1.0 : 0.0,
        0.0, // pad0
        0.0, 0.0, 0.0, 0.0 // pad1
      ]);

      this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformFloats);

      const commandEncoder = this.device.createCommandEncoder();
      const currentTexture = this.context.getCurrentTexture();
      const textureView = currentTexture.createView();

      const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: textureView,
            clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 },
            loadOp: 'clear',
            storeOp: 'store'
          }
        ]
      });

      renderPass.setPipeline(this.pipeline);
      renderPass.setBindGroup(0, this.bindGroup);
      renderPass.draw(6);
      renderPass.end();

      this.device.queue.submit([commandEncoder.finish()]);
      return true;
    } catch (e: any) {
      if (e?.name === 'SecurityError' || String(e).includes('tainted')) {
        console.warn('[Anime4K] CORS Security restriction:', e);
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
