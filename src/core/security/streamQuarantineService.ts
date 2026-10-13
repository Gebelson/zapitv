/**
 * ZapiTV — StreamQuarantineService
 * Serviço de Quarentena Permanente e Auditoria de Streams Fraudulentos / Corrompidos / Conteúdo Adulto Incorreto.
 * Garante que fontes maliciosas, trotes ou vídeos de outras obras sejam isolados imediatamente e nunca reapareçam.
 */

import { StremioStream } from '../stremio/stremioTypes';

export interface QuarantinedItem {
  id: string; // Hash, URL ou assinatura
  type: 'infoHash' | 'url' | 'title_collision' | 'adult_troll';
  reason: string;
  targetTitle?: string;
  sourceProvider?: string;
  quarantinedAt: string;
}

const STORAGE_QUARANTINE_KEY = 'zapitv_stream_quarantine_v1';

// Hashes e assinaturas confirmadas de trotes, pornografia acidental ou streams maliciosos
export const KNOWN_MALICIOUS_HASHES: Array<{ hash: string; reason: string }> = [
  // Casos Hope: O Primeiro Impacto (Mia Khalifa porn / trotes falsos indexados como supostos WEB-DL)
  { hash: '812efbe7d0a75fb31bf9426db566f299d10b3474', reason: 'Trote adulto / Mia Khalifa disfarçado de gravação de cinema' },
  { hash: '6dc48c588dca97da6c610ae730c556a2c7c6718d', reason: 'Trote adulto / Conteúdo pornográfico' },
  { hash: 'e79c88ea04c7326eb0f88ae9f18571689317e27f', reason: 'Trote adulto / Conteúdo pornográfico' },
  { hash: 'f9a842dfe9f5b2e7fda509f2306e0700b97a4036', reason: 'Trote adulto / Mia Khalifa' },
  { hash: 'd0eacddff07a24173d8f7dc11a18ef3ed32b886a', reason: 'Vídeo adulto não solicitado em indexador de torrent' },
  { hash: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678', reason: 'Arquivo corrompido / scam' }
];

export const ADULT_ACTORS_AND_TERMS: string[] = [
  'mia khalifa',
  'khalifa',
  'brazzers',
  'xvideos',
  'pornhub',
  'redtube',
  'youporn',
  'bangbros',
  'naughtyamerica',
  'spankbang',
  'xhamster',
  'pornstar',
  'hardcore xxx',
  'creampie',
  'blowjob',
  'ben the men',
  'playweb',
  'mature porn',
  'erotic xxx'
];

export class StreamQuarantineService {
  private quarantinedMap: Map<string, QuarantinedItem> = new Map();
  private listeners: Set<() => void> = new Set<() => void>();

  constructor() {
    this.initDefaultQuarantine();
    this.loadFromStorage();
  }

  private initDefaultQuarantine(): void {
    for (const item of KNOWN_MALICIOUS_HASHES) {
      this.quarantinedMap.set(item.hash.toLowerCase(), {
        id: item.hash.toLowerCase(),
        type: 'infoHash',
        reason: item.reason,
        targetTitle: 'Hope: O Primeiro Impacto',
        sourceProvider: 'Torrent Scraper',
        quarantinedAt: '2026-10-13T00:00:00.000Z'
      });
    }
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const data = localStorage.getItem(STORAGE_QUARANTINE_KEY);
      if (data) {
        const list: QuarantinedItem[] = JSON.parse(data);
        if (Array.isArray(list)) {
          list.forEach(item => {
            if (item && item.id) {
              this.quarantinedMap.set(item.id.toLowerCase(), item);
            }
          });
        }
      }
    } catch (e) {
      console.warn('[StreamQuarantine] Erro ao carregar quarentena do storage:', e);
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const list = Array.from(this.quarantinedMap.values());
      localStorage.setItem(STORAGE_QUARANTINE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('[StreamQuarantine] Erro ao salvar quarentena no storage:', e);
    }
  }

  /**
   * Coloca um stream ou hash em quarentena imediatamente e persiste no sistema.
   */
  public quarantine(
    identifier: string,
    reason: string,
    type: 'infoHash' | 'url' | 'title_collision' | 'adult_troll' = 'url',
    targetTitle?: string,
    sourceProvider?: string
  ): void {
    if (!identifier) return;
    const cleanId = identifier.trim().toLowerCase();
    const item: QuarantinedItem = {
      id: cleanId,
      type,
      reason,
      targetTitle,
      sourceProvider,
      quarantinedAt: new Date().toISOString()
    };
    this.quarantinedMap.set(cleanId, item);
    this.saveToStorage();
    console.error(`🚨 [QUARANTINE] Fonte isolada permanentemente: "${cleanId}" | Motivo: ${reason}`);
    this.listeners.forEach(fn => fn());
  }

  /**
   * Avalia rigorosamente se um stream deve ser colocado em quarentena ou já está isolado.
   */
  public evaluateQuarantine(
    stream: StremioStream,
    targetTitle?: string
  ): { isQuarantined: boolean; reason?: string } {
    if (!stream) return { isQuarantined: true, reason: 'Stream nulo ou inválido' };

    const hash = (stream.infoHash || '').trim().toLowerCase();
    const url = (stream.url || '').trim().toLowerCase();
    const title = (stream.title || '').toLowerCase();
    const name = (stream.name || '').toLowerCase();
    const combined = `${name} ${title} ${url} ${hash}`;

    // 1. Checagem direta de Hash em quarentena
    if (hash && this.quarantinedMap.has(hash)) {
      return { isQuarantined: true, reason: this.quarantinedMap.get(hash)?.reason || 'Hash em quarentena' };
    }

    // 2. Checagem direta de URL em quarentena
    if (url && this.quarantinedMap.has(url)) {
      return { isQuarantined: true, reason: this.quarantinedMap.get(url)?.reason || 'URL em quarentena' };
    }

    // 3. Checagem de termos pornográficos ou atrizes adultas
    for (const adultTerm of ADULT_ACTORS_AND_TERMS) {
      if (combined.includes(adultTerm)) {
        const reason = `Conteúdo adulto/trote detectado: termo "${adultTerm}"`;
        if (hash) this.quarantine(hash, reason, 'adult_troll', targetTitle, stream.providerName);
        if (url) this.quarantine(url, reason, 'adult_troll', targetTitle, stream.providerName);
        return { isQuarantined: true, reason };
      }
    }

    // 4. Caso específico Doraemon -> Sparks of Tomorrow
    if (targetTitle && /doraemon|gato do futuro/i.test(targetTitle)) {
      if (
        combined.includes('sparks of tomorrow') ||
        combined.includes('/1684/') ||
        combined.includes('kurage.live') ||
        combined.includes('animegg')
      ) {
        const reason = 'Colisão conhecida de anime upstream: "Sparks of Tomorrow" atribuído a Doraemon';
        if (url) this.quarantine(url, reason, 'title_collision', targetTitle, stream.providerName);
        return { isQuarantined: true, reason };
      }
    }

    // 5. Caso Hope (2026): filme em cartaz com suposto WEB-DL/AMZN/Bluray (100% trote falso)
    if (targetTitle && /hope.*primeiro.*impacto|hopeu|1058424|tt27369017/i.test(targetTitle)) {
      if (
        (title.includes('web-dl') || title.includes('webrip') || title.includes('amzn') || title.includes('bluray')) &&
        !title.includes('trailer') &&
        !title.includes('teaser')
      ) {
        const reason = 'Release WEB-DL/Bluray fraudulenta de filme em cartaz nos cinemas (Hope 2026)';
        if (hash) this.quarantine(hash, reason, 'adult_troll', targetTitle, stream.providerName);
        return { isQuarantined: true, reason };
      }
    }

    return { isQuarantined: false };
  }

  /**
   * Retorna lista de todos os itens em quarentena para diagnóstico
   */
  public getQuarantineList(): QuarantinedItem[] {
    return Array.from(this.quarantinedMap.values());
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const streamQuarantineService = new StreamQuarantineService();
