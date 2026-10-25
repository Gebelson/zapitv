import { ContentItem } from '../../../types';
import { posterRecoveryService, isCorruptedPosterUrl } from './PosterRecoveryService';
import { isValidHeroImageUrl } from './heroCarouselStore';

export const ZAPITV_HERO_FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=80';

export interface HeroImageResolutionResult {
  url: string;
  isFallback: boolean;
  source: 'poster' | 'image' | 'cached_recovery' | 'backdrop' | 'alternative' | 'recovered_api' | 'brand_fallback';
}

class HeroImageService {
  private static instance: HeroImageService;
  private failedUrlCache = new Map<string, number>(); // URL -> timestamp
  private validatedUrlCache = new Set<string>();
  private inFlightPreloads = new Map<string, Promise<boolean>>();
  private readonly FAILURE_TTL_MS = 10 * 60 * 1000; // 10 minutos de retenção para falhas transitórias

  private constructor() {}

  public static getInstance(): HeroImageService {
    if (!HeroImageService.instance) {
      HeroImageService.instance = new HeroImageService();
    }
    return HeroImageService.instance;
  }

  /**
   * Verifica se uma URL falhou recentemente nesta sessão
   */
  public isUrlFailed(url: string | null | undefined): boolean {
    if (!url || typeof url !== 'string') return true;
    const cleanUrl = url.trim();
    if (!cleanUrl || isCorruptedPosterUrl(cleanUrl)) return true;
    const failedAt = this.failedUrlCache.get(cleanUrl);
    if (!failedAt) return false;
    if (Date.now() - failedAt > this.FAILURE_TTL_MS) {
      this.failedUrlCache.delete(cleanUrl);
      return false;
    }
    return true;
  }

  /**
   * Registra uma URL que falhou no carregamento
   */
  public markUrlFailed(url: string | null | undefined): void {
    if (!url || typeof url !== 'string') return;
    const cleanUrl = url.trim();
    if (cleanUrl) {
      this.failedUrlCache.set(cleanUrl, Date.now());
      this.validatedUrlCache.delete(cleanUrl);
    }
  }

  /**
   * Verifica se uma URL já foi validada e decodificada com sucesso na memória
   */
  public isUrlValidated(url: string | null | undefined): boolean {
    if (!url || typeof url !== 'string') return false;
    return this.validatedUrlCache.has(url.trim());
  }

  /**
   * Registra uma URL validada
   */
  public markUrlValidated(url: string | null | undefined): void {
    if (!url || typeof url !== 'string') return;
    const cleanUrl = url.trim();
    if (cleanUrl) {
      this.validatedUrlCache.add(cleanUrl);
      this.failedUrlCache.delete(cleanUrl);
    }
  }

  /**
   * Limpa os caches em memória (útil para testes ou reinicialização)
   */
  public clearCache(): void {
    this.failedUrlCache.clear();
    this.validatedUrlCache.clear();
    this.inFlightPreloads.clear();
  }

  /**
   * Monta a cadeia ordenada e desduplicada de candidatos a imagem para uma obra
   * 1º Pôster/imagem vertical oficial (item.poster || item.image)
   * 2º Pôster alternativo em cache (posterRecoveryService.getCachedPoster(item))
   * 3º Backdrop oficial do item (item.backdrop)
   * 4º Backdrop alternativo / imagens adicionais (item.backdrops, item.images)
   * 5º Fallback institucional da marca ZapiTV
   */
  public getCandidateUrls(item: ContentItem): string[] {
    if (!item) return [ZAPITV_HERO_FALLBACK_IMAGE];

    const candidates: string[] = [];
    const seen = new Set<string>();

    const add = (candidate: any) => {
      if (isValidHeroImageUrl(candidate)) {
        const normalized = String(candidate).trim();
        if (!isCorruptedPosterUrl(normalized) && !seen.has(normalized)) {
          seen.add(normalized);
          candidates.push(normalized);
        }
      }
    };

    // 1º Pôster vertical ou imagem principal
    add(item.poster);
    add(item.image);

    // 2º Pôster em cache de recuperação
    try {
      const cached = posterRecoveryService.getCachedPoster(item);
      add(cached);
    } catch {
      // Ignora erro em ambientes sem storage
    }

    // 3º Backdrop oficial
    add(item.backdrop);

    // 4º Imagens adicionais do item
    if (Array.isArray(item.backdrops)) {
      for (const b of item.backdrops) add(b);
    }
    if (Array.isArray(item.images)) {
      for (const img of item.images) add(img);
    }

    // 5º Fallback elegante institucional da ZapiTV
    add(ZAPITV_HERO_FALLBACK_IMAGE);

    return candidates;
  }

  /**
   * Valida e decodifica nativamente uma imagem usando new Image() e decode()
   * Rejeita dimensões menores ou iguais a 50x50 (como pixels de rastreamento ou placeholders vazios)
   * Respeita timeout e AbortSignal
   */
  public validateAndPreloadImage(
    url: string,
    timeoutMs: number = 4500,
    signal?: AbortSignal
  ): Promise<boolean> {
    if (!isValidHeroImageUrl(url)) return Promise.resolve(false);
    const cleanUrl = url.trim();

    if (this.isUrlFailed(cleanUrl)) return Promise.resolve(false);
    if (this.isUrlValidated(cleanUrl)) return Promise.resolve(true);

    if (signal?.aborted) return Promise.resolve(false);

    // Evita requisições concorrentes idênticas
    if (this.inFlightPreloads.has(cleanUrl)) {
      return this.inFlightPreloads.get(cleanUrl)!;
    }

    const promise = new Promise<boolean>((resolve) => {
      // Em ambientes sem suporte a DOM / Image (ex: SSR, Node.js puro sem mock), valida sintaxe
      if (typeof window === 'undefined' || typeof Image === 'undefined') {
        const ok = isValidHeroImageUrl(cleanUrl);
        if (ok) this.markUrlValidated(cleanUrl);
        else this.markUrlFailed(cleanUrl);
        resolve(ok);
        return;
      }

      let settled = false;
      let timer: any = null;
      const img = new Image();

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        img.onload = null;
        img.onerror = null;
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        }
      };

      const finish = (success: boolean) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (success) {
          this.markUrlValidated(cleanUrl);
        } else {
          this.markUrlFailed(cleanUrl);
        }
        resolve(success);
      };

      const onAbort = () => {
        finish(false);
      };

      if (signal) {
        if (signal.aborted) {
          finish(false);
          return;
        }
        signal.addEventListener('abort', onAbort, { once: true });
      }

      timer = setTimeout(() => {
        finish(false);
      }, timeoutMs);

      img.onload = async () => {
        // Validação de dimensões úteis (maior que 50x50)
        if (img.naturalWidth <= 50 || img.naturalHeight <= 50) {
          finish(false);
          return;
        }

        // Tenta decodificação assíncrona na GPU se suportado pelo navegador
        if ('decode' in img && typeof img.decode === 'function') {
          try {
            await img.decode();
          } catch {
            // Se decode falhar mas onload disparou, aceita a imagem
          }
        }

        finish(true);
      };

      img.onerror = () => {
        finish(false);
      };

      img.src = cleanUrl;
    }).finally(() => {
      this.inFlightPreloads.delete(cleanUrl);
    });

    this.inFlightPreloads.set(cleanUrl, promise);
    return promise;
  }

  /**
   * Resolve a imagem ideal e comprovadamente funcional para o banner mobile.
   * Percorre a cadeia de fallback testando e validando cada candidato sem repetições.
   * Se os candidatos do item falharem, tenta recuperação via PosterRecoveryService.
   * Como último recurso, aplica o fallback institucional ZapiTV.
   */
  public async resolveHeroImageForItem(
    item: ContentItem,
    signal?: AbortSignal
  ): Promise<HeroImageResolutionResult> {
    if (!item) {
      return {
        url: ZAPITV_HERO_FALLBACK_IMAGE,
        isFallback: true,
        source: 'brand_fallback'
      };
    }

    const candidates = this.getCandidateUrls(item);

    // 1. Testa candidatos primários (pôster, cache, backdrop, extras)
    for (const url of candidates) {
      if (signal?.aborted) break;

      // O fallback da marca é testado por último após tentativa de recuperação
      if (url === ZAPITV_HERO_FALLBACK_IMAGE) continue;

      if (this.isUrlFailed(url)) continue;

      const success = await this.validateAndPreloadImage(url, 4500, signal);
      if (success) {
        let source: HeroImageResolutionResult['source'] = 'poster';
        if (url === item.image) source = 'image';
        else if (url === item.backdrop) source = 'backdrop';
        else if (Array.isArray(item.backdrops) && item.backdrops.includes(url)) source = 'alternative';
        else if (Array.isArray(item.images) && item.images.includes(url)) source = 'alternative';

        return { url, isFallback: false, source };
      }
    }

    // 2. Se nenhum candidato direto funcionou, tenta recuperação sob demanda via PosterRecoveryService
    if (!signal?.aborted) {
      try {
        const recovered = await posterRecoveryService.recoverPoster(item);
        if (recovered && isValidHeroImageUrl(recovered) && !this.isUrlFailed(recovered)) {
          const success = await this.validateAndPreloadImage(recovered, 4500, signal);
          if (success) {
            return {
              url: recovered,
              isFallback: false,
              source: 'recovered_api'
            };
          }
        }
      } catch {
        // Ignora erro de rede da recuperação
      }
    }

    // 3. Fallback de marca institucional como salvaguarda absoluta
    return {
      url: ZAPITV_HERO_FALLBACK_IMAGE,
      isFallback: true,
      source: 'brand_fallback'
    };
  }

  /**
   * Pré-carrega antecipadamente em segundo plano o próximo item do carrossel
   */
  public preloadHeroItem(item: ContentItem): void {
    if (!item) return;
    // Dispara resolução sem bloquear a thread
    this.resolveHeroImageForItem(item).catch(() => {});
  }
}

export const heroImageService = HeroImageService.getInstance();
