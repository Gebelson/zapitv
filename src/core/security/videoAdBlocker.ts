import { StremioStream } from '../stremio/stremioTypes';

export type AdAuditStatus = 'limpo' | 'suspeito' | 'bloqueado por propaganda embutida';

export interface AdDetectionEvidence {
  timestampSeconds?: number;
  region: 'metadata' | 'top_banner' | 'bottom_banner' | 'top_left' | 'top_right' | 'temporal_persistence' | 'manual_override';
  matchedTerm?: string;
  confidence: number; // 0.0 a 1.0
  description: string;
}

export interface AdAuditRecord {
  id: string;
  streamUrl: string;
  streamName?: string;
  contentTitle?: string;
  season?: number;
  episode?: number;
  providerName?: string;
  status: AdAuditStatus;
  riskScore: number; // 0 a 100
  reason: string;
  evidences: AdDetectionEvidence[];
  checkedAt: string;
  manualOverride?: boolean;
}

export interface FramePixelData {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

// 1. Termos e Marcas Conhecidas de Casas de Aposta, Cassinos e Publicidade Embutida
export const BETTING_KEYWORDS = [
  '1xbet',
  '1x-bet',
  '1x_bet',
  '1x bet',
  'onexbet',
  'bet365',
  'betano',
  'blaze',
  'sportingbet',
  'pixbet',
  'betfair',
  'betway',
  'kto',
  'parimatch',
  'melbet',
  'linebet',
  'mostbet',
  'pinnacle',
  'novibet',
  'estrelabet',
  'estrella bet',
  'esportes da sorte',
  'esportesdasorte',
  'superbet',
  'vaidebet',
  'vai de bet',
  'f12bet',
  'f12.bet',
  'casa de aposta',
  'casas de apostas',
  'apostas online',
  'aposte ja',
  'aposte agora',
  'cassino',
  'casino',
  'roleta',
  'slots',
  'fortune tiger',
  'tigrinho',
  'ganhe bonus',
  'bonus de boas vindas',
  'deposite e ganhe',
  'promocode',
  'promo code',
  'cupom de aposta'
];

export const BETTING_RELEASE_TAGS = [
  /\[1xbet\]/i,
  /\b1xbet\b/i,
  /\bcleopatra\b/i,
  /\btelebet\b/i,
  /\bhdtc[-_.]1xbet/i,
  /\bcamrip[-_.]1xbet/i,
  /\btelecine[-_.]1xbet/i,
  /\b1x[-_.]?bet/i,
  /\bcasino[-_.]?rip/i,
  /\bbet[-_.]?rip/i
];

class VideoAdBlockerService {
  private readonly STORAGE_RECORDS_KEY = 'zapitv_ad_audit_records';
  private readonly STORAGE_MANUAL_BLOCKS_KEY = 'zapitv_manual_ad_blocks';

  private auditRecords: Map<string, AdAuditRecord> = new Map();
  private manualBlocks: Map<string, { reason: string; title?: string; timestamp: string }> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const recordsJson = localStorage.getItem(this.STORAGE_RECORDS_KEY);
      if (recordsJson) {
        const list: AdAuditRecord[] = JSON.parse(recordsJson);
        if (Array.isArray(list)) {
          // Descarta falsos-positivos visuais de amostragem de frames (ex: cenas azuis, Doraemon, etc.)
          const validList = list.filter(r => !r.id?.startsWith('visual-'));
          validList.forEach(r => this.auditRecords.set(r.streamUrl, r));
        }
      }

      const manualJson = localStorage.getItem(this.STORAGE_MANUAL_BLOCKS_KEY);
      if (manualJson) {
        const map: Record<string, any> = JSON.parse(manualJson);
        Object.entries(map).forEach(([url, val]) => {
          this.manualBlocks.set(url, val);
        });
      }
    } catch (e) {
      console.warn('[VideoAdBlocker] Erro ao carregar dados do localStorage:', e);
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const list = Array.from(this.auditRecords.values()).slice(-200); // Manter últimas 200 auditorias
      localStorage.setItem(this.STORAGE_RECORDS_KEY, JSON.stringify(list));

      const manualObj: Record<string, any> = {};
      this.manualBlocks.forEach((v, k) => { manualObj[k] = v; });
      localStorage.setItem(this.STORAGE_MANUAL_BLOCKS_KEY, JSON.stringify(manualObj));
    } catch (e) {
      console.warn('[VideoAdBlocker] Erro ao salvar dados no localStorage:', e);
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(fn => {
      try { fn(); } catch {}
    });
  }

  /**
   * Avalia os metadados do stream (título, release, provedor, URL) em busca de marcas de apostas ou tags de publicidade.
   */
  public hasBettingMetadata(stream: StremioStream): { hasAd: boolean; term?: string } {
    const combined = `${stream.name || ''} ${stream.title || ''} ${stream.description || ''} ${stream.url || ''}`.toLowerCase();

    for (const tagRegex of BETTING_RELEASE_TAGS) {
      if (tagRegex.test(combined)) {
        return { hasAd: true, term: tagRegex.source };
      }
    }

    for (const kw of BETTING_KEYWORDS) {
      // Exclui palavras comuns se isoladas, exige fronteira de palavra
      const regex = new RegExp(`(^|[^a-z0-9])${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i');
      if (regex.test(combined)) {
        return { hasAd: true, term: kw };
      }
    }

    return { hasAd: false };
  }

  /**
   * Avalia um stream completo (metadados + histórico de auditoria + bloqueios manuais).
   */
  public evaluateStream(stream: StremioStream, contentTitle?: string, season?: number, episode?: number): AdAuditRecord {
    const url = stream.url || '';
    if (!url) {
      return {
        id: `audit-${Date.now()}`,
        streamUrl: '',
        status: 'bloqueado por propaganda embutida',
        riskScore: 100,
        reason: 'URL do stream inválida ou inexistente',
        evidences: [],
        checkedAt: new Date().toISOString()
      };
    }

    // 1. Bloqueio manual administrativo
    if (this.manualBlocks.has(url)) {
      const manual = this.manualBlocks.get(url)!;
      const record: AdAuditRecord = {
        id: `manual-${url}`,
        streamUrl: url,
        streamName: stream.name,
        contentTitle: contentTitle || manual.title,
        season,
        episode,
        providerName: stream.providerName,
        status: 'bloqueado por propaganda embutida',
        riskScore: 100,
        reason: manual.reason || 'Fonte bloqueada manualmente por publicidade embutida no painel administrativo',
        evidences: [{
          region: 'manual_override',
          confidence: 1.0,
          description: `Bloqueio manual em ${manual.timestamp}: ${manual.reason}`
        }],
        checkedAt: new Date().toISOString(),
        manualOverride: true
      };
      this.auditRecords.set(url, record);
      return record;
    }

    // 2. Histórico prévio de auditoria
    const existing = this.auditRecords.get(url);
    if (existing && existing.status === 'bloqueado por propaganda embutida') {
      return existing;
    }

    // 3. Inspeção de Metadados e Release
    const metaCheck = this.hasBettingMetadata(stream);
    if (metaCheck.hasAd) {
      const record: AdAuditRecord = {
        id: `meta-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        streamUrl: url,
        streamName: stream.name,
        contentTitle,
        season,
        episode,
        providerName: stream.providerName,
        status: 'bloqueado por propaganda embutida',
        riskScore: 98,
        reason: `Publicidade de apostas/1xBet detectada nos metadados da mídia (termo: "${metaCheck.term}")`,
        evidences: [{
          region: 'metadata',
          matchedTerm: metaCheck.term,
          confidence: 0.98,
          description: `Identificador de casa de aposta "${metaCheck.term}" na assinatura da release/stream.`
        }],
        checkedAt: new Date().toISOString()
      };
      this.auditRecords.set(url, record);
      this.saveToStorage();
      this.notify();
      return record;
    }

    // Retorna registro limpo provisório (sujeito à análise de frames durante o carregamento)
    const cleanRecord: AdAuditRecord = existing || {
      id: `clean-${Date.now()}`,
      streamUrl: url,
      streamName: stream.name,
      contentTitle,
      season,
      episode,
      providerName: stream.providerName,
      status: 'limpo',
      riskScore: 0,
      reason: 'Nenhuma marca ou publicidade de apostas identificada.',
      evidences: [],
      checkedAt: new Date().toISOString()
    };
    return cleanRecord;
  }

  /**
   * Analisa um frame de vídeo pixel a pixel (Canvas ImageData) buscando assinaturas de overlays,
   * faixas publicitárias no topo/rodapé e marcas d'água de alto contraste.
   */
  public analyzeFrameData(
    frame: FramePixelData,
    timestampSeconds = 0
  ): { riskScore: number; evidences: AdDetectionEvidence[] } {
    const { width, height, data } = frame;
    if (width < 10 || height < 10) return { riskScore: 0, evidences: [] };

    const evidences: AdDetectionEvidence[] = [];
    let riskScore = 0;

    // Regiões Críticas de Overlay Publicitário:
    // 1. Top Banner: linhas y de 0 até 18% da altura
    const topBannerEnd = Math.floor(height * 0.18);
    // 2. Bottom Banner: linhas y de 82% até 100% da altura
    const bottomBannerStart = Math.floor(height * 0.82);

    // Função auxiliar para obter cor RGB em (x, y)
    const getPixel = (x: number, y: number) => {
      const idx = (y * width + x) * 4;
      return { r: data[idx], g: data[idx + 1], b: data[idx + 2], a: data[idx + 3] };
    };

    // A. Detecção de Faixa com Assinatura Cromática 1xBet / Casas de Aposta
    // A 1xBet utiliza fundo azul saturado (#003b8e até #0d47a1 ou #1a5fb4) com texto branco contrastante,
    // ou barras promocionais sólidas vermelhas/verdes com alto contraste.
    const checkRegionForAdBanner = (startY: number, endY: number, regionName: 'top_banner' | 'bottom_banner') => {
      let blueBannerPixels = 0;
      let highContrastTransitions = 0;
      let totalSampled = 0;

      const stepY = Math.max(1, Math.floor((endY - startY) / 10));
      const stepX = Math.max(1, Math.floor(width / 40));

      for (let y = startY; y < endY; y += stepY) {
        let prevLum = -1;
        for (let x = 0; x < width; x += stepX) {
          const { r, g, b } = getPixel(x, y);
          totalSampled++;

          // Luminância perceptual
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;

          // Assinatura de Azul 1xBet: R < 70, G entre 40 e 150, B > 140 (Azul dominante vibrante)
          if (b > 130 && b > r * 1.6 && b > g * 1.1) {
            blueBannerPixels++;
          }

          // Transição de alto contraste característica de tipografia sobre faixa (texto branco em fundo azul/escuro)
          if (prevLum >= 0 && Math.abs(lum - prevLum) > 95) {
            highContrastTransitions++;
          }
          prevLum = lum;
        }
      }

      const blueRatio = totalSampled > 0 ? blueBannerPixels / totalSampled : 0;
      const transitionRatio = totalSampled > 0 ? highContrastTransitions / totalSampled : 0;

      // Se houver uma faixa azul forte com caracteres de alto contraste
      if (blueRatio > 0.35 && transitionRatio > 0.15) {
        evidences.push({
          timestampSeconds,
          region: regionName,
          matchedTerm: '1xBet Banner Cromático',
          confidence: 0.95,
          description: `Faixa retangular com assinatura cromática 1xBet (${Math.round(blueRatio * 100)}% azul e alto contraste de texto) detectada no ${regionName === 'top_banner' ? 'topo' : 'rodapé'}.`
        });
        riskScore = Math.max(riskScore, 95);
      } else if (blueRatio > 0.25 || transitionRatio > 0.35) {
        // Faixa de alto contraste persistente com indício de anúncio
        evidences.push({
          timestampSeconds,
          region: regionName,
          confidence: 0.70,
          description: `Banner de alto contraste com densidade tipográfica incomum na região ${regionName}.`
        });
        riskScore = Math.max(riskScore, 70);
      }
    };

    // Analisar Top Banner
    checkRegionForAdBanner(0, topBannerEnd, 'top_banner');

    // Analisar Bottom Banner
    checkRegionForAdBanner(bottomBannerStart, height, 'bottom_banner');

    // B. Detecção de Marcas d'água e QR Codes nos cantos (Top-Left e Top-Right)
    const checkCorner = (startX: number, endX: number, startY: number, endY: number, regionName: 'top_left' | 'top_right') => {
      let badgePixelCount = 0;
      let samples = 0;
      for (let y = startY; y < endY; y += 2) {
        for (let x = startX; x < endX; x += 2) {
          const { r, g, b } = getPixel(x, y);
          samples++;
          // Watermark de apostas (azul saturado ou amarelo de bônus ou caixa de alto contraste)
          if ((b > 140 && b > r * 1.5) || (r > 200 && g > 180 && b < 60)) {
            badgePixelCount++;
          }
        }
      }
      const ratio = samples > 0 ? badgePixelCount / samples : 0;
      if (ratio > 0.20) {
        evidences.push({
          timestampSeconds,
          region: regionName,
          matchedTerm: "Watermark de Apostas",
          confidence: 0.85,
          description: `Marca d'água promocional com padrão gráfico característico no canto ${regionName === 'top_left' ? 'superior esquerdo' : 'superior direito'}.`
        });
        riskScore = Math.max(riskScore, 85);
      }
    };

    checkCorner(0, Math.floor(width * 0.28), 0, Math.floor(height * 0.22), 'top_left');
    checkCorner(Math.floor(width * 0.72), width, 0, Math.floor(height * 0.22), 'top_right');

    return { riskScore, evidences };
  }

  /**
   * Avalia a persistência temporal comparando 2 frames em momentos diferentes.
   * Se o centro do vídeo mudar (cena do filme/anime), mas uma faixa no topo/rodapé permanecer estática,
   * comprova-se matematicamente a presença de overlay gráfico embutido.
   */
  public analyzeTemporalPersistence(
    frame1: FramePixelData,
    frame2: FramePixelData
  ): { isPersistentOverlay: boolean; region?: 'top_banner' | 'bottom_banner'; confidence: number } {
    if (frame1.width !== frame2.width || frame1.height !== frame2.height) {
      return { isPersistentOverlay: false, confidence: 0 };
    }

    const { width, height } = frame1;
    const topLimit = Math.floor(height * 0.18);
    const topNarrowLimit = Math.floor(height * 0.10);
    const bottomStart = Math.floor(height * 0.82);
    const bottomNarrowStart = Math.floor(height * 0.90);
    const centerStart = Math.floor(height * 0.30);
    const centerEnd = Math.floor(height * 0.70);

    let centerDiffSum = 0;
    let centerPixels = 0;
    let topNarrowDiffSum = 0;
    let topNarrowPixels = 0;
    let topWideDiffSum = 0;
    let topWidePixels = 0;
    let bottomNarrowDiffSum = 0;
    let bottomNarrowPixels = 0;
    let bottomWideDiffSum = 0;
    let bottomWidePixels = 0;

    const step = 4;
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const idx = (y * width + x) * 4;
        const diff = (
          Math.abs(frame1.data[idx] - frame2.data[idx]) +
          Math.abs(frame1.data[idx + 1] - frame2.data[idx + 1]) +
          Math.abs(frame1.data[idx + 2] - frame2.data[idx + 2])
        ) / 3;

        if (y < topNarrowLimit) {
          topNarrowDiffSum += diff;
          topNarrowPixels++;
        }
        if (y < topLimit) {
          topWideDiffSum += diff;
          topWidePixels++;
        } else if (y >= bottomNarrowStart) {
          bottomNarrowDiffSum += diff;
          bottomNarrowPixels++;
        } else if (y >= bottomStart) {
          bottomWideDiffSum += diff;
          bottomWidePixels++;
        } else if (y >= centerStart && y <= centerEnd) {
          centerDiffSum += diff;
          centerPixels++;
        }
      }
    }

    const avgCenterDiff = centerPixels > 0 ? centerDiffSum / centerPixels : 0;
    const avgTopNarrowDiff = topNarrowPixels > 0 ? topNarrowDiffSum / topNarrowPixels : 0;
    const avgTopWideDiff = topWidePixels > 0 ? topWideDiffSum / topWidePixels : 0;
    const avgBottomNarrowDiff = bottomNarrowPixels > 0 ? bottomNarrowDiffSum / bottomNarrowPixels : 0;
    const avgBottomWideDiff = bottomWidePixels > 0 ? bottomWideDiffSum / bottomWidePixels : 0;

    // Se o centro do vídeo mudou (filme em movimento, avgCenterDiff > 18),
    // mas o topo (estreito ou largo) teve diferença quase zero (< 5), é uma propaganda fixa embutida!
    if (avgCenterDiff > 18 && (avgTopNarrowDiff < 5 || avgTopWideDiff < 5)) {
      return { isPersistentOverlay: true, region: 'top_banner', confidence: 0.95 };
    }

    if (avgCenterDiff > 18 && (avgBottomNarrowDiff < 5 || avgBottomWideDiff < 5)) {
      return { isPersistentOverlay: true, region: 'bottom_banner', confidence: 0.95 };
    }

    return { isPersistentOverlay: false, confidence: 0 };
  }

  /**
   * Registra ou atualiza uma auditoria no banco e salva no cache.
   */
  public registerAuditResult(record: AdAuditRecord): void {
    this.auditRecords.set(record.streamUrl, record);
    this.saveToStorage();
    this.notify();
  }

  /**
   * Bloqueio manual de um stream específico no painel administrativo.
   */
  public blockStreamManually(streamUrl: string, reason: string, contentTitle?: string): void {
    if (!streamUrl) return;
    const timestamp = new Date().toLocaleString('pt-BR');
    this.manualBlocks.set(streamUrl, { reason, title: contentTitle, timestamp });

    const record: AdAuditRecord = {
      id: `manual-${Date.now()}`,
      streamUrl,
      contentTitle,
      status: 'bloqueado por propaganda embutida',
      riskScore: 100,
      reason: reason || 'Bloqueado manualmente no painel administrativo',
      evidences: [{
        region: 'manual_override',
        confidence: 1.0,
        description: `Bloqueio manual administrativo em ${timestamp}: ${reason}`
      }],
      checkedAt: new Date().toISOString(),
      manualOverride: true
    };

    this.auditRecords.set(streamUrl, record);
    this.saveToStorage();
    this.notify();
  }

  /**
   * Desbloqueia ou reabilita um stream manual ou previamente bloqueado.
   */
  public unblockStream(streamUrl: string): void {
    if (!streamUrl) return;
    this.manualBlocks.delete(streamUrl);
    const existing = this.auditRecords.get(streamUrl);
    if (existing) {
      existing.status = 'limpo';
      existing.riskScore = 0;
      existing.reason = 'Reabilitado manualmente pelo administrador.';
      existing.manualOverride = false;
      this.auditRecords.set(streamUrl, existing);
    }
    this.saveToStorage();
    this.notify();
  }

  /**
   * Verifica rapidamente se a URL está em estado de bloqueio.
   */
  public isStreamBlocked(streamUrl: string): boolean {
    if (!streamUrl) return false;
    if (this.manualBlocks.has(streamUrl)) return true;
    const record = this.auditRecords.get(streamUrl);
    if (!record || record.id?.startsWith('visual-')) return false;
    return record.status === 'bloqueado por propaganda embutida';
  }

  /**
   * Obtém a lista completa de auditorias para exibição no painel administrativo.
   */
  public getAuditRecords(): AdAuditRecord[] {
    return Array.from(this.auditRecords.values()).sort((a, b) => 
      new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime()
    );
  }

  /**
   * Limpa o histórico de auditoria (preservando bloqueios manuais explícitos).
   */
  public clearAuditHistory(): void {
    this.auditRecords.clear();
    // Restaura bloqueios manuais
    this.manualBlocks.forEach((v, url) => {
      this.auditRecords.set(url, {
        id: `manual-${url}`,
        streamUrl: url,
        contentTitle: v.title,
        status: 'bloqueado por propaganda embutida',
        riskScore: 100,
        reason: v.reason,
        evidences: [{
          region: 'manual_override',
          confidence: 1.0,
          description: `Bloqueio manual em ${v.timestamp}: ${v.reason}`
        }],
        checkedAt: new Date().toISOString(),
        manualOverride: true
      });
    });
    this.saveToStorage();
    this.notify();
  }
}

export const videoAdBlocker = new VideoAdBlockerService();
