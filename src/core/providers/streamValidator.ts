import { StremioStream } from '../stremio/stremioTypes';
import { videoAdBlocker } from '../security/videoAdBlocker';
import { streamQuarantineService } from '../security/streamQuarantineService';

export interface StreamValidationResult {
  valid: boolean;
  url: string;
  finalUrl?: string;
  status?: number;
  contentType?: string;
  isParked?: boolean;
  isManifestValid?: boolean;
  reason?: string;
  latencyMs?: number;
}

// Domínios conhecidos por estarem expirados, estacionados ou associados ao ParkLogic
export const KNOWN_PARKED_DOMAINS = [
  'superflixapi.top',
  'parklogic.com',
  'parklogic',
  'bodis.com',
  'sedo.com',
  'parkingcrew.net',
  'hugedomains.com',
  'dan.com'
];

// Termos indicativos de estacionamento de domínio no corpo da resposta
export const PARKING_SIGNATURES = [
  'this page has been created by parklogic',
  'parklogic.com',
  'visit parklogic.com',
  'domain parked',
  'domain has expired',
  'domain is parked',
  'godaddy parking',
  'buy this domain',
  'domain name is available',
  'is parked free courtesy of',
  'sedo domain parking',
  'namecheap parking'
];

// Regras específicas de bloqueio para conteúdos trocados / corrompidos em provedores upstream
export const KNOWN_UPSTREAM_MISMATCHES: Array<{
  targetPattern: RegExp;
  rejectStream: (stream: StremioStream) => boolean;
}> = [
  // 1. Doraemon: provedores upstream mapeiam erroneamente para Sparks of Tomorrow (/1684/), kurage.live proxy ou ER Plantão Médico ou Ultraman
  {
    targetPattern: /doraemon|gato do futuro|57911|65733|tt0069576|tt4083422/i,
    rejectStream: (s) => {
      const text = `${s.name || ''} ${s.title || ''} ${s.url || ''}`.toLowerCase();
      return (
        text.includes('/1684/') ||
        text.includes('kurage.live') ||
        text.includes('animegg') ||
        text.includes('sparks of tomorrow') ||
        text.includes('plantão médico') ||
        text.includes('plantao medico') ||
        text.includes('ultraman') ||
        text.includes('eternal aseria') ||
        text.includes('angel heart')
      );
    }
  },
  // 2. Overflow: provedores upstream mapeiam erroneamente para Black Clover (/1224/)
  {
    targetPattern: /overflow/i,
    rejectStream: (s) => {
      const text = `${s.name || ''} ${s.title || ''} ${s.url || ''}`.toLowerCase();
      return (
        text.includes('/1224/') ||
        text.includes('black clover') ||
        text.includes('clover')
      );
    }
  },
  // 3. Mori no Kuma-san: provedores upstream mapeiam erroneamente para Murai in Love (/1736/)
  {
    targetPattern: /mori.*kuma/i,
    rejectStream: (s) => {
      const text = `${s.name || ''} ${s.title || ''} ${s.url || ''}`.toLowerCase();
      return (
        text.includes('/1736/') ||
        text.includes('murai in love') ||
        text.includes('murai no koi') ||
        text.includes('murai')
      );
    }
  },
  // 4. Modaete yo, Adam-kun: provedores upstream mapeiam erroneamente para Saving 80,000 Gold in Another World
  {
    targetPattern: /modaete.*adam/i,
    rejectStream: (s) => {
      const text = `${s.name || ''} ${s.title || ''} ${s.url || ''}`.toLowerCase();
      return (
        text.includes('/1332/') ||
        text.includes('saving 80,000 gold') ||
        text.includes('80,000 gold') ||
        text.includes('8-manmai') ||
        text.includes('black adam')
      );
    }
  },
  // 5. Hope: bloquear apenas hashes e assinaturas conhecidos de vídeos trocados.
  {
    targetPattern: /hope.*primeiro.*impacto|hopeu|1058424|tt27369017/i,
    rejectStream: (s) => {
      const text = `${s.name || ''} ${s.title || ''} ${s.url || ''} ${s.infoHash || ''}`.toLowerCase();
      // O rótulo WEB-DL, WEBRip ou AMZN não prova que a fonte está errada.
      if (
        text.includes('f9a842dfe9f5b2e7fda509f2306e0700b97a4036') ||
        text.includes('d0eacddff07a24173d8f7dc11a18ef3ed32b886a') ||
        text.includes('ben the men') ||
        text.includes('khalifa') ||
        text.includes('mia khalifa')
      ) {
        return true;
      }
      return false;
    }
  }
];

class StreamValidator {
  private blacklist: Set<string> = new Set(KNOWN_PARKED_DOMAINS);
  private cache: Map<string, { result: StreamValidationResult; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos de cache

  /**
   * Verifica rapidamente se a URL pertence a um domínio comprovadamente estacionado ou na lista negra.
   */
  public isUrlBlacklisted(url: string): boolean {
    if (!url) return true;
    try {
      const base = typeof window !== 'undefined' ? window.location.origin : (process.env.VITE_APP_URL || 'http://localhost:4000');
      const parsed = new URL(url.startsWith('/') ? `${base}${url}` : url);
      const host = parsed.hostname.toLowerCase();
      for (const domain of this.blacklist) {
        if (host === domain || host.endsWith(`.${domain}`)) {
          return true;
        }
      }
      return false;
    } catch {
      return true;
    }
  }

  /**
   * Adiciona um domínio ou URL à lista negra após falha confirmada.
   */
  public blacklistDomain(domainOrUrl: string, reason?: string): void {
    try {
      let host = domainOrUrl.toLowerCase();
      if (domainOrUrl.includes('://')) {
        host = new URL(domainOrUrl).hostname.toLowerCase();
      }
      this.blacklist.add(host);
      console.warn(`[StreamValidator] Domínio adicionado à lista negra: ${host} (Motivo: ${reason || 'Não informado'})`);
    } catch {
      this.blacklist.add(domainOrUrl.toLowerCase());
    }
  }

  /**
   * Remove da lista negra caso tenha sido reabilitado.
   */
  public unblacklistDomain(domain: string): void {
    this.blacklist.delete(domain.toLowerCase());
  }

  /**
   * Obtém a lista atual de domínios bloqueados.
   */
  public getBlacklistedDomains(): string[] {
    return Array.from(this.blacklist);
  }

  /**
   * Valida um stream de mídia (HLS, MP4 ou Embed) verificando se a URL é acessível,
   * se o manifesto é legítimo e se não retorna uma página ParkLogic ou erro HTTP.
   */
  public async validateStream(stream: StremioStream, timeoutMs = 6000): Promise<StreamValidationResult> {
    const url = stream.url;
    if (!url) {
      return {
        valid: false,
        url: '',
        reason: 'URL do stream inexistente.'
      };
    }

    // 1. Checagem imediata de lista negra
    if (this.isUrlBlacklisted(url)) {
      return {
        valid: false,
        url,
        isParked: true,
        reason: 'Domínio identificado na lista de estacionamento/ParkLogic.'
      };
    }

    // 2. Verificar cache
    const cached = this.cache.get(url);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL_MS) {
      return cached.result;
    }

    const start = Date.now();
    try {
      // No navegador, consultar o endpoint de validação do servidor para evitar bloqueio por CORS
      const isBrowser = typeof window !== 'undefined';
      let endpoint = '';
      if (isBrowser) {
        endpoint = `/api/validate-stream?url=${encodeURIComponent(url)}&type=${stream.sourceType || 'auto'}`;
      } else {
        // No ambiente Node/Testes, usar chamada direta ou rota local
        endpoint = `http://localhost:4000/api/validate-stream?url=${encodeURIComponent(url)}&type=${stream.sourceType || 'auto'}`;
      }

      const res = await fetch(endpoint, {
        signal: AbortSignal.timeout(timeoutMs)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const result: StreamValidationResult = {
          valid: false,
          url,
          status: res.status,
          reason: errorData.reason || `Falha na validação HTTP: status ${res.status}`,
          latencyMs: Date.now() - start
        };
        this.cache.set(url, { result, timestamp: Date.now() });
        return result;
      }

      const data = await res.json() as StreamValidationResult;
      data.latencyMs = Date.now() - start;

      // Se foi detectado estacionamento, adiciona à blacklist
      if (data.isParked || (data.finalUrl && this.isUrlBlacklisted(data.finalUrl))) {
        this.blacklistDomain(url, data.reason || 'Detectado ParkLogic no servidor');
        data.valid = false;
        data.isParked = true;
      }

      this.cache.set(url, { result: data, timestamp: Date.now() });
      return data;
    } catch (err: any) {
      const result: StreamValidationResult = {
        valid: false,
        url,
        reason: `Tempo limite ou erro de rede ao validar: ${err.message}`,
        latencyMs: Date.now() - start
      };
      this.cache.set(url, { result, timestamp: Date.now() });
      return result;
    }
  }

  /**
   * Verifica se o stream realmente corresponde ao título do conteúdo requisitado,
   * prevenindo que animes/séries sejam trocados por conteúdos corrompidos em addons de terceiros.
   */
  public isStreamMatchingTargetTitle(stream: StremioStream, targetTitle?: string): boolean {
    const sTitle = (stream.title || '').trim();
    const sName = (stream.name || '').trim();
    const sUrl = (stream.url || '').trim();
    const combined = `${sName} ${sTitle} ${sUrl}`.toLowerCase();

    // Uma URL acessível pode ser trailer ou amostra.
    if (/\b(trailer|teaser|sample|demo)\b/i.test(`${sName} ${sTitle}`)) {
      return false;
    }

    if (/🐉\s*Malfoy/i.test(`${sName} ${sTitle}`)) return false;

    // 0. Quarentena permanente imediata (bloqueia hashes banidos, atrizes adultas, trotes)
    const quarantine = streamQuarantineService.evaluateQuarantine(stream, targetTitle);
    if (quarantine.isQuarantined) {
      console.warn(`[StreamValidator] Stream bloqueado em quarentena: ${sTitle || sUrl} (Motivo: ${quarantine.reason})`);
      return false;
    }

    // 1. Rejeita terminantemente fontes com propaganda de apostas/1xBet embutida ou na blacklist administrativa
    if (videoAdBlocker.isStreamBlocked(sUrl)) {
      console.warn(`[StreamValidator] Stream rejeitado por bloqueio de propaganda embutida: ${sUrl}`);
      return false;
    }

    const adEval = videoAdBlocker.evaluateStream(stream, targetTitle);
    if (adEval.status === 'bloqueado por propaganda embutida') {
      console.warn(`[StreamValidator] Stream rejeitado por propaganda embutida (1xBet / Apostas): ${sTitle || sUrl} (Motivo: ${adEval.reason})`);
      return false;
    }

    // 2. Rejeita mensagens de rate-limit ou avisos de banimento
    if (
      combined.includes('aguarde 5 minutos') ||
      combined.includes('muitas requisições') ||
      combined.includes('muitas requisicoes') ||
      combined.includes('(banned)') ||
      sUrl.includes('koyeb.app/stream/51389') ||
      sUrl.includes('01+piloto.mkv') ||
      sUrl.includes('01%2bpiloto.mkv')
    ) {
      return false;
    }

    // 3. Rejeita terminantemente streams com termos adultos, atrizes pornô ou trotes (ex: Mia Khalifa, Brazzers, etc.)
    const adultTrollSignatures = [
      'khalifa',
      'mia khalifa',
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
      'blowjob'
    ];
    if (adultTrollSignatures.some(term => combined.includes(term))) {
      console.warn(`[StreamValidator] Stream rejeitado por conter termos adultos/trote: ${sTitle || sUrl}`);
      return false;
    }

    if (!targetTitle || !targetTitle.trim()) return true;

    // 2. Aplica regras de bloqueio de desvios conhecidos (ex: Doraemon -> Sparks of Tomorrow)
    for (const rule of KNOWN_UPSTREAM_MISMATCHES) {
      if (rule.targetPattern.test(targetTitle)) {
        if (rule.rejectStream(stream)) {
          console.warn(`[StreamValidator] Stream rejeitado por desvio conhecido para '${targetTitle}': ${sTitle || sUrl}`);
          return false;
        }
      }
    }

    // 3. Validação de título declarado em streams estruturados (ex: '🐦‍🔥 Nome da Obra ⏸️')
    const fenixMatch = sTitle.match(/🐦‍🔥\s*([^\n⏸️]+)/i);
    if (fenixMatch) {
      const declaredTitle = fenixMatch[1].trim().toLowerCase();
      const cleanTarget = targetTitle.toLowerCase()
        .replace(/[^\w\s\u00C0-\u00FF]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      const targetWords = cleanTarget.split(' ').filter(w => w.length >= 3);
      const declaredWords = declaredTitle
        .replace(/[^\w\s\u00C0-\u00FF]/gi, ' ')
        .split(' ')
        .filter(w => w.length >= 3);
      
      if (targetWords.length > 0 && declaredWords.length > 0) {
        const hasOverlap = targetWords.some(tw => declaredTitle.includes(tw)) ||
                           declaredWords.some(dw => cleanTarget.includes(dw));
        if (!hasOverlap) {
          console.warn(`[StreamValidator] Título do stream '${declaredTitle}' não corresponde ao título solicitado '${targetTitle}'`);
          return false;
        }
      }
    }

    // 4. Validação de torrents com releases claramente de outras obras
    if (sTitle.length > 5 && (sTitle.includes('1080p') || sTitle.includes('720p') || sTitle.includes('.mkv') || sTitle.includes('.mp4') || sTitle.includes('NyaaSi') || sTitle.includes('TorrentGalaxy') || sTitle.includes('1337x'))) {
      const cleanSTitle = sTitle.replace(/\[[^\]]+\]/g, ' ')
        .replace(/[^\w\s\u00C0-\u00FF]/gi, ' ')
        .toLowerCase();
      
      const cleanTarget = targetTitle.toLowerCase()
        .replace(/[^\w\s\u00C0-\u00FF]/gi, ' ')
        .trim();
      
      const mainTargetWord = cleanTarget.split(' ').find(w => w.length >= 4);
      if (mainTargetWord && !cleanSTitle.includes(mainTargetWord)) {
        const otherKnownSeries = ['ultraman', 'aseria', 'angel heart', 'sparks of tomorrow', 'black clover', 'murai in love', 'saving 80,000 gold'];
        if (otherKnownSeries.some(t => cleanSTitle.includes(t))) {
          console.warn(`[StreamValidator] Release torrent com título trocado rejeitada: '${sTitle}' para '${targetTitle}'`);
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Verifica se o nome/texto do stream corresponde ao título alvo e parâmetros de episódio
   */
  public isContentMatchingTarget(
    streamText: string,
    targetTitle: string,
    episodeParams?: { season: number; episode: number }
  ): boolean {
    if (!targetTitle || !streamText) return true;
    const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const cleanStream = normalize(streamText);
    const cleanTarget = normalize(targetTitle);

    // Se o stream contiver o título ou palavras-chave
    const targetWords = cleanTarget.split(/\s+/).filter(w => w.length >= 4);
    if (targetWords.length > 0 && !cleanStream.includes(cleanTarget)) {
      const matchesAtLeastOne = targetWords.some(w => cleanStream.includes(w));
      if (!matchesAtLeastOne) {
        return false;
      }
    }

    if (episodeParams) {
      const s = episodeParams.season;
      const e = episodeParams.episode;
      const sPattern = new RegExp(`s0*${s}|temporada\\s*0*${s}`, 'i');
      if (cleanStream.includes('temporada') && !sPattern.test(cleanStream)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Filtra uma lista de streams, eliminando imediatamente fontes de domínios parked/inválidos
   * e streams que pertencem a conteúdos trocados/diferentes do solicitado.
   */
  public filterCleanStreams(streams: StremioStream[], targetTitle?: string): StremioStream[] {
    return streams.filter(s => {
      if (!s.url) return false;
      if (this.isUrlBlacklisted(s.url)) return false;
      if (videoAdBlocker.isStreamBlocked(s.url)) return false;
      return this.isStreamMatchingTargetTitle(s, targetTitle);
    });
  }
}

export const streamValidator = new StreamValidator();
