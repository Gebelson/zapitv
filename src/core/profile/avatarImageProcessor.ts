/**
 * ZAPITV — PROCESSAMENTO E OTIMIZAÇÃO DE FOTOS DE PERFIL (IPAD, SAFARI & WEB)
 * 
 * Módulo especializado em processamento local e seguro de avatares:
 * 1. Detecção robusta de tipo por Magic Bytes (MIME vazio, Safari Files, HEIC, HEIF, JPEG, PNG, WebP).
 * 2. Suporte nativo a decodificação de HEIC/HEIF no Safari/iPadOS (com fallback para heic2any quando necessário).
 * 3. Suporte a fotos de alta resolução da câmera do iPad/iPhone (até 25 MB).
 * 4. Redimensionamento e center-crop preservando proporção para até 256x256 pixels.
 * 5. Compressão adaptativa em JPEG para respeitar estritamente o limite de MAX_PROFILE_AVATAR_LENGTH (80.000 chars).
 * 6. Preservação de orientação EXIF da imagem.
 * 7. Gerenciamento seguro de memória e liberação de Object URLs.
 */

import { MAX_PROFILE_AVATAR_LENGTH } from './avatarImages';

export const MAX_SOURCE_IMAGE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
export const TARGET_AVATAR_DIMENSION = 256; // 256 x 256 pixels

export interface ImageFormatDetection {
  format: 'jpeg' | 'png' | 'webp' | 'heic' | 'gif' | 'unknown';
  mime: string;
  isHeic: boolean;
  isValid: boolean;
}

export class AvatarProcessingError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'FILE_TOO_LARGE'
      | 'EMPTY_FILE'
      | 'INVALID_FORMAT'
      | 'DECODE_FAILED'
      | 'CONVERSION_FAILED'
      | 'CANVAS_UNAVAILABLE'
  ) {
    super(message);
    this.name = 'AvatarProcessingError';
  }
}

/**
 * Lê os primeiros 32 bytes do arquivo e detecta o formato real pelos Magic Bytes,
 * sem depender exclusivamente de file.type (que costuma vir vazio no iPad).
 */
export async function detectImageFormat(file: Blob, fileName: string = ''): Promise<ImageFormatDetection> {
  const nameLower = fileName.toLowerCase();
  const typeLower = (file.type || '').toLowerCase();

  // 1. Tenta identificar via Magic Bytes
  let headerBytes: Uint8Array = new Uint8Array(0);
  try {
    const slice = file.slice(0, 32);
    const buffer = await slice.arrayBuffer();
    headerBytes = new Uint8Array(buffer);
  } catch {
    // Falha ao ler arrayBuffer, prossegue com MIME/extensão
  }

  // JPEG: FF D8 FF
  if (headerBytes.length >= 3 && headerBytes[0] === 0xff && headerBytes[1] === 0xd8 && headerBytes[2] === 0xff) {
    return { format: 'jpeg', mime: 'image/jpeg', isHeic: false, isValid: true };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    headerBytes.length >= 8 &&
    headerBytes[0] === 0x89 &&
    headerBytes[1] === 0x50 &&
    headerBytes[2] === 0x4e &&
    headerBytes[3] === 0x47
  ) {
    return { format: 'png', mime: 'image/png', isHeic: false, isValid: true };
  }

  // WebP: RIFF ... WEBP
  if (
    headerBytes.length >= 12 &&
    headerBytes[0] === 0x52 && // R
    headerBytes[1] === 0x49 && // I
    headerBytes[2] === 0x46 && // F
    headerBytes[3] === 0x46 && // F
    headerBytes[8] === 0x57 && // W
    headerBytes[9] === 0x45 && // E
    headerBytes[10] === 0x42 && // B
    headerBytes[11] === 0x50 // P
  ) {
    return { format: 'webp', mime: 'image/webp', isHeic: false, isValid: true };
  }

  // HEIC / HEIF / ISO Media (ftyp box com marcas heic, heix, hevc, hevx, mif1, msf1)
  if (headerBytes.length >= 12) {
    const ftyp = String.fromCharCode(...headerBytes.slice(4, 8));
    if (ftyp === 'ftyp') {
      const brand = String.fromCharCode(...headerBytes.slice(8, 12)).toLowerCase();
      const compatibleHeicBrands = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1', 'avif'];
      if (compatibleHeicBrands.some((b) => brand.includes(b))) {
        return { format: 'heic', mime: 'image/heic', isHeic: true, isValid: true };
      }
    }
  }

  // 2. Fallback para extensão de arquivo (comum no iPadOS com MIME vazio)
  if (nameLower.endsWith('.heic') || nameLower.endsWith('.heif')) {
    return { format: 'heic', mime: 'image/heic', isHeic: true, isValid: true };
  }
  if (nameLower.endsWith('.jpg') || nameLower.endsWith('.jpeg')) {
    return { format: 'jpeg', mime: 'image/jpeg', isHeic: false, isValid: true };
  }
  if (nameLower.endsWith('.png')) {
    return { format: 'png', mime: 'image/png', isHeic: false, isValid: true };
  }
  if (nameLower.endsWith('.webp')) {
    return { format: 'webp', mime: 'image/webp', isHeic: false, isValid: true };
  }

  // 3. Fallback para file.type informado
  if (typeLower.includes('heic') || typeLower.includes('heif')) {
    return { format: 'heic', mime: 'image/heic', isHeic: true, isValid: true };
  }
  if (typeLower === 'image/jpeg' || typeLower === 'image/jpg') {
    return { format: 'jpeg', mime: 'image/jpeg', isHeic: false, isValid: true };
  }
  if (typeLower === 'image/png') {
    return { format: 'png', mime: 'image/png', isHeic: false, isValid: true };
  }
  if (typeLower === 'image/webp') {
    return { format: 'webp', mime: 'image/webp', isHeic: false, isValid: true };
  }
  if (typeLower.startsWith('image/')) {
    return { format: 'jpeg', mime: typeLower, isHeic: false, isValid: true };
  }

  return { format: 'unknown', mime: typeLower || 'application/octet-stream', isHeic: false, isValid: false };
}

/**
 * Tenta decodificar o arquivo nativamente no navegador (Safari decodifica HEIC, JPEG, PNG nativamente).
 */
async function decodeImageElement(blob: Blob): Promise<{ width: number; height: number; element: HTMLImageElement | ImageBitmap; cleanup: () => void }> {
  // Tentativa 1: createImageBitmap com orientação automática EXIF
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      if (bitmap && bitmap.width > 0 && bitmap.height > 0) {
        return {
          width: bitmap.width,
          height: bitmap.height,
          element: bitmap,
          cleanup: () => {
            try {
              bitmap.close();
            } catch {}
          },
        };
      }
    } catch {
      // Fallback para HTMLImageElement
    }
  }

  // Tentativa 2: HTMLImageElement com URL.createObjectURL
  if (typeof Image !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.decoding = 'async';
      const loaded = await new Promise<boolean>((resolve) => {
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = objectUrl;
      });

      if (loaded && img.naturalWidth > 0 && img.naturalHeight > 0) {
        return {
          width: img.naturalWidth,
          height: img.naturalHeight,
          element: img,
          cleanup: () => {
            try {
              URL.revokeObjectURL(objectUrl);
            } catch {}
          },
        };
      }
    } finally {
      // Cleanup é feito após desenhar no canvas
    }
    try {
      URL.revokeObjectURL(objectUrl);
    } catch {}
  }

  throw new AvatarProcessingError(
    'Não foi possível decodificar a imagem fornecida.',
    'DECODE_FAILED'
  );
}

/**
 * Converte HEIC/HEIF usando heic2any quando o navegador não possui decodificador nativo de HEIC.
 */
async function convertHeicToJpegBlob(blob: Blob): Promise<Blob> {
  try {
    const heic2anyModule = await import('heic2any');
    const heic2any = (heic2anyModule as any).default || heic2anyModule;
    const result = await heic2any({
      blob,
      toType: 'image/jpeg',
      quality: 0.9,
    });
    return Array.isArray(result) ? result[0] : result;
  } catch (err: any) {
    throw new AvatarProcessingError(
      'Não foi possível converter a foto HEIC/HEIF selecionada. Tente salvar como JPEG ou tirar um print.',
      'CONVERSION_FAILED'
    );
  }
}

export interface ProcessedAvatarResult {
  dataUrl: string;
  byteLength: number;
  width: number;
  height: number;
}

/**
 * Processa uma foto selecionada no iPad, PC ou mobile:
 * - Valida tamanho e tipo
 * - Decodifica (nativamente ou via heic2any)
 * - Corta quadrado centralizado (center crop)
 * - Redimensiona para até 256x256
 * - Comprime em JPEG adaptativamente até <= MAX_PROFILE_AVATAR_LENGTH (80.000 chars)
 */
export async function processAvatarImageFile(file: File | Blob, fileName: string = ''): Promise<ProcessedAvatarResult> {
  if (!file || file.size === 0) {
    throw new AvatarProcessingError('O arquivo selecionado está vazio.', 'EMPTY_FILE');
  }

  if (file.size > MAX_SOURCE_IMAGE_SIZE_BYTES) {
    throw new AvatarProcessingError(
      `A foto selecionada tem ${(file.size / (1024 * 1024)).toFixed(1)} MB. O limite máximo permitido é 25 MB.`,
      'FILE_TOO_LARGE'
    );
  }

  const effectiveName = fileName || (file instanceof File ? file.name : '');
  const detection = await detectImageFormat(file, effectiveName);

  if (!detection.isValid) {
    throw new AvatarProcessingError(
      'Formato de arquivo não reconhecido. Formatos suportados: JPG, PNG, WebP e HEIC/HEIF.',
      'INVALID_FORMAT'
    );
  }

  // Tenta decodificar nativamente primeiro
  let decoded: { width: number; height: number; element: HTMLImageElement | ImageBitmap; cleanup: () => void } | null = null;
  try {
    decoded = await decodeImageElement(file);
  } catch (nativeErr) {
    // Se falhou e for HEIC, tenta converter para JPEG com heic2any
    if (detection.isHeic) {
      const convertedJpegBlob = await convertHeicToJpegBlob(file);
      decoded = await decodeImageElement(convertedJpegBlob);
    } else {
      throw nativeErr;
    }
  }

  try {
    const { width: srcW, height: srcH, element: srcElement } = decoded;
    if (!srcW || !srcH) {
      throw new AvatarProcessingError('Dimensões da imagem inválidas.', 'DECODE_FAILED');
    }

    if (typeof document === 'undefined') {
      throw new AvatarProcessingError('Ambiente sem suporte a Canvas.', 'CANVAS_UNAVAILABLE');
    }

    // Center crop quadrado
    const cropSquare = Math.min(srcW, srcH);
    const cropX = (srcW - cropSquare) / 2;
    const cropY = (srcH - cropSquare) / 2;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) {
      throw new AvatarProcessingError('Não foi possível inicializar o contexto de desenho.', 'CANVAS_UNAVAILABLE');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Lista de resoluções e qualidades para garantir <= MAX_PROFILE_AVATAR_LENGTH (80.000 chars)
    const compressionPasses: Array<{ dimension: number; quality: number }> = [
      { dimension: 256, quality: 0.85 },
      { dimension: 256, quality: 0.75 },
      { dimension: 256, quality: 0.65 },
      { dimension: 256, quality: 0.50 },
      { dimension: 192, quality: 0.70 },
      { dimension: 192, quality: 0.55 },
      { dimension: 160, quality: 0.65 },
      { dimension: 160, quality: 0.50 },
      { dimension: 128, quality: 0.60 },
    ];

    let finalDataUrl = '';
    let finalDimension = TARGET_AVATAR_DIMENSION;

    for (const pass of compressionPasses) {
      canvas.width = pass.dimension;
      canvas.height = pass.dimension;

      // Limpa e redesenha com interpolação suave
      ctx.clearRect(0, 0, pass.dimension, pass.dimension);
      ctx.drawImage(
        srcElement as any,
        cropX,
        cropY,
        cropSquare,
        cropSquare,
        0,
        0,
        pass.dimension,
        pass.dimension
      );

      const candidateDataUrl = canvas.toDataURL('image/jpeg', pass.quality);

      if (candidateDataUrl.length <= MAX_PROFILE_AVATAR_LENGTH) {
        finalDataUrl = candidateDataUrl;
        finalDimension = pass.dimension;
        break;
      }
    }

    // Se mesmo na última iteração exceder (cenário extremo de ruído), reduz qualidade ao mínimo
    if (!finalDataUrl || finalDataUrl.length > MAX_PROFILE_AVATAR_LENGTH) {
      canvas.width = 128;
      canvas.height = 128;
      ctx.clearRect(0, 0, 128, 128);
      ctx.drawImage(srcElement as any, cropX, cropY, cropSquare, cropSquare, 0, 0, 128, 128);
      finalDataUrl = canvas.toDataURL('image/jpeg', 0.4);
      finalDimension = 128;
    }

    // Limpeza de canvas em memória
    canvas.width = 0;
    canvas.height = 0;

    if (!finalDataUrl || finalDataUrl.length > MAX_PROFILE_AVATAR_LENGTH) {
      throw new AvatarProcessingError(
        'A imagem gerada ainda é muito grande para o perfil. Tente outra foto.',
        'CONVERSION_FAILED'
      );
    }

    return {
      dataUrl: finalDataUrl,
      byteLength: finalDataUrl.length,
      width: finalDimension,
      height: finalDimension,
    };
  } finally {
    decoded?.cleanup();
  }
}
