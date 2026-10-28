import { StremioStream } from '../stremio/stremioTypes';
import { videoAdBlocker } from '../security/videoAdBlocker';
import { streamQuarantineService } from '../security/streamQuarantineService';
import { LruCache } from '../cache/LruCache';
import { resolveValidationTargetUrl } from './validationTargetUrl';
import { theatricalFilterService } from '../catalog/theatricalFilterService';

export interface StreamValidationResult {
  valid: boolean;
  url: string;
  finalUrl?: string;
  status?: number;
  contentType?: string;
  isParked?: boolean;
  isManifestValid?: boolean;
  requiresEngine?: boolean;
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
  rejectStream: (stream: StremioStream, rawCandidates?: string[]) => boolean;
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
        text.includes('khalifa') ||
        text.includes('mia khalifa')
      ) {
        return true;
      }
      return false;
    }
  },
  // 6. Resident Evil (2026 live-action por Zach Cregger / tt13000574 / 1423191)
  // Rejeita terminantemente animações (Kadokawa / Marza / Vendetta / Degeneration / Damnation / Death Island / Infinite Darkness)
  // e adaptações anteriores da franquia associadas erroneamente ao título de 2026.
  {
    targetPattern: /resident\s*evil|tt13000574|1423191|movie-resident-evil-2026/i,
    rejectStream: (s, rawCandidates = []) => {
      const text = `${s.name || ''} ${s.title || ''} ${s.description || ''} ${s.url || ''}`.toLowerCase();
      const candText = (Array.isArray(rawCandidates) ? rawCandidates.join(' ') : String(rawCandidates || '')).toLowerCase();
      const isTargetAnimation = /vendetta|damnation|degeneration|infinite darkness|death island/i.test(candText);

      // Rejeita animações para produções live-action
      if (!isTargetAnimation) {
        const animationTerms = [
          'vendetta',
          'kadokawa',
          'marza',
          'degeneration',
          'damnation',
          'death island',
          'infinite darkness',
          'anime',
          'animado',
          'animation',
          'animated'
        ];
        if (animationTerms.some(term => text.includes(term))) {
          return true;
        }
      }

      // Se a obra solicitada for especificamente o live-action de 2026 (Zach Cregger / tt13000574 / 1423191)
      const isTarget2026 = /tt13000574|1423191|movie-resident-evil-2026|2026|zach/i.test(candText);
      if (isTarget2026) {
        const otherAdaptations = [
          'welcome to raccoon city',
          'raccoon city',
          'apocalypse',
          'extinction',
          'afterlife',
          'retribution',
          'final chapter',
          'netflix'
        ];
        if (otherAdaptations.some(term => text.includes(term))) {
          return true;
        }
        // Rejeita anos anteriores a 2026 (1990-2024)
        const yearMatches = text.match(/\b(19\d{2}|20[0-2][0-4])\b/g);
        if (yearMatches && yearMatches.length > 0) {
          return true;
        }
      }

      return false;
    }
  },
  // 7. Lupin (Série live-action Netflix 2021 com Omar Sy / tt2531336 / 96677)
  // Rejeita terminantemente produções da animação Lupin III (The First, Part 1-6, Sansei, Cagliostro, etc.)
  // quando a obra solicitada for a série live-action da Netflix.
  {
    targetPattern: /\blupin\b/i,
    rejectStream: (s, rawCandidates = []) => {
      const candText = (Array.isArray(rawCandidates) ? rawCandidates.join(' ') : String(rawCandidates || '')).toLowerCase();
      const isTargetLupin3 = /\b(?:iii|the\s+third|the\s+first|sansei|cagliostro)\b/i.test(candText);
      if (!isTargetLupin3) {
        const text = `${s.name || ''} ${s.title || ''} ${s.description || ''} ${s.url || ''}`.toLowerCase();
        return /\b(?:iii|the\s+third|the\s+first|sansei|cagliostro|part\s*[1-6]|anime)\b/i.test(text);
      }
      return false;
    }
  }
];

class StreamValidator {
  private blacklist: Set<string> = new Set(KNOWN_PARKED_DOMAINS);
  private cache = new LruCache<string, { result: StreamValidationResult; timestamp: number }>(400, 5 * 60 * 1000);
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos de cache

  public clearCache(): void {
    this.cache.clear();
  }

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
        const isProvisional = res.status === 403 || res.status === 405;
        const result: StreamValidationResult = {
          valid: isProvisional,
          url,
          status: res.status,
          reason: isProvisional
            ? `Fonte aceita provisoriamente (Status HTTP ${res.status} não impede reprodução no navegador)`
            : (errorData.reason || `Falha na validação HTTP: status ${res.status}`),
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
      // Não tratar falhas de HEAD/CORS/Timeout temporário como prova definitiva de indisponibilidade
      const isMediaExtension = url.includes('.m3u8') || url.includes('.mp4') || url.includes('.webm') || url.includes('.mpd');
      const result: StreamValidationResult = {
        valid: isMediaExtension,
        url,
        reason: `Verificação leve em segundo plano pendente (${err.message})`,
        latencyMs: Date.now() - start
      };
      this.cache.set(url, { result, timestamp: Date.now() });
      return result;
    }
  }

  /**
   * Valida estritamente se o stream corresponde à temporada e ao episódio solicitados,
   * impedindo que fontes da T1 sejam aceitas como fallback indevido para a T2.
   */
  public isStreamMatchingEpisode(
    stream: StremioStream,
    episodeParams?: { season: number; episode: number }
  ): boolean {
    if (!episodeParams) return true;
    const { season, episode } = episodeParams;
    const streamTitle = (stream.title || '').trim();
    const streamName = (stream.name || '').trim();
    const streamDesc = (stream.description || '').trim();
    const streamUrl = (stream.url || '').trim();
    // Isola o caminho do arquivo na URL para evitar que hostnames de CDN (ex: cdn-s01.domain.com) colidam com identificadores de temporada
    let urlPath = '';
    try {
      const parsed = new URL(streamUrl);
      urlPath = parsed.pathname;
    } catch {
      urlPath = streamUrl;
    }
    const text = `${streamName} ${streamTitle} ${streamDesc} ${urlPath}`.toLowerCase();

    // 1. Tag de episódio absoluto em parênteses: ex: '(Ep. 1)', '(Ep. 13)'
    const absMatch = text.match(/\((?:ep|episode)\.?\s*(\d+)\)/i);
    if (absMatch && season > 1) {
      const absEp = parseInt(absMatch[1], 10);
      // Se temporada > 1 e o episódio absoluto é menor ou igual ao número do episódio relativo
      // (ex: na T2 E1, um stream com '(Ep. 1)' é comprovadamente da Temporada 1)
      if (absEp <= episode) {
        console.warn(`[StreamValidator] Stream rejeitado por episódio absoluto da T1 em requisição da T${season}: ${streamTitle}`);
        return false;
      }
    }

    // 2. Tag combinada S01E01, T01EP01, S1E1, T02 EP01
    const seMatches = Array.from(text.matchAll(/\b(?:s|t)0*(\d{1,2})\s*(?:e|ep)0*(\d{1,3})\b/gi));
    const hasExactMatch = seMatches.length > 0 && seMatches.some(m => parseInt(m[1], 10) === season && parseInt(m[2], 10) === episode);
    if (seMatches.length > 0 && !hasExactMatch) {
      const m = seMatches[0];
      const sFound = parseInt(m[1], 10);
      const eFound = parseInt(m[2], 10);
      console.warn(`[StreamValidator] Stream rejeitado por temporada/episódio divergente [T${sFound}E${eFound} vs T${season}E${episode}]: ${streamTitle}`);
      return false;
    }

    // 3. Temporada declarada explicitamente (ex: 'S01', 'T01', 'Season 1', 'Temporada 1')
    // Não confunde com resoluções ou intervalos '01-12'
    const sMatches = Array.from(text.matchAll(/\b(?:season\s*|temporada\s*|sais(?:on)?\s*|s0*|t0*)(\d{1,2})\b(?!\s*-\s*\d)/gi));
    for (const m of sMatches) {
      const sFound = parseInt(m[1], 10);
      if (sFound > 0 && sFound <= 50) {
        if (sFound !== season) {
          // Se o stream já possui a tag exata SxxExx para o episódio requisitado (ex: S01E01 em animes com dupla numeração de franquia como S17),
          // não o rejeitamos por anotações secundárias de temporada em parênteses.
          if (hasExactMatch) {
            continue;
          }
          const fullMatch = m[0].toLowerCase();
          if (fullMatch.startsWith('season') || fullMatch.startsWith('temporada') || fullMatch.startsWith('sais') || /^[st]0\d$/.test(fullMatch)) {
            console.warn(`[StreamValidator] Stream rejeitado por temporada divergente [T${sFound} vs T${season}]: ${streamTitle}`);
            return false;
          }
        }
      }
    }

    // 4. Numerais romanos e subtítulos de temporadas (ex: Clevatess II vs Clevatess I)
    if (season === 1 && /\b(?:clevatess\s+ii|mushoku\s+tensei\s+ii|2nd\s+season|2ª\s*temporada)\b/i.test(text)) {
      console.warn(`[StreamValidator] Stream da Temporada 2 rejeitado para requisição da Temporada 1: ${streamTitle}`);
      return false;
    }

    return true;
  }

  /**
   * Verifica se o stream realmente corresponde ao título do conteúdo requisitado,
   * prevenindo que animes/séries sejam trocados por conteúdos corrompidos em addons de terceiros.
   */
  public isStreamMatchingTargetTitle(
    stream: StremioStream,
    targetTitle?: string,
    originalTitle?: string,
    alternateTitles?: string[],
    episodeParams?: { season: number; episode: number }
  ): boolean {
    const sTitle = (stream.title || stream.description || '').trim();
    const sName = (stream.name || '').trim();
    const sUrl = (stream.url || '').trim();
    const combined = `${sName} ${sTitle} ${stream.description || ''} ${sUrl}`.toLowerCase();

    // Validação estrita de temporada e episódio (Blindagem contra mistura de T1 e T2)
    if (episodeParams && !this.isStreamMatchingEpisode(stream, episodeParams)) {
      return false;
    }

    // Uma URL acessível pode ser trailer ou amostra.
    if (/\b(trailer|teaser|sample|demo)\b/i.test(`${sName} ${sTitle}`)) {
      return false;
    }

    if (/🐉\s*Malfoy/i.test(`${sName} ${sTitle}`)) return false;

    // 0. Quarentena permanente imediata (bloqueia hashes banidos, atrizes adultas, trotes)
    const quarantine = streamQuarantineService.evaluateQuarantine(stream, targetTitle || originalTitle);
    if (quarantine.isQuarantined) {
      console.warn(`[StreamValidator] Stream bloqueado em quarentena: ${sTitle || sUrl} (Motivo: ${quarantine.reason})`);
      return false;
    }

    // 1. Rejeita terminantemente fontes com propaganda de apostas/1xBet embutida ou na blacklist administrativa
    if (videoAdBlocker.isStreamBlocked(sUrl)) {
      console.warn(`[StreamValidator] Stream rejeitado por bloqueio de propaganda embutida: ${sUrl}`);
      return false;
    }

    const adEval = videoAdBlocker.evaluateStream(stream, targetTitle || originalTitle);
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

    const rawCandidates = [targetTitle, originalTitle, ...(alternateTitles || [])]
      .filter((t): t is string => Boolean(t && t.trim()));

    if (rawCandidates.length === 0) return true;

    // Magnetflix's specific S1E1 asset plays an older Woody Woodpecker cartoon,
    // not "Guerra é Guerra". Scope the quarantine to this asset and episode.
    if (episodeParams?.season === 1 && episodeParams?.episode === 1 &&
        rawCandidates.some(title => /^(?:o novo pica[- ]pau|the new woody woodpecker show)$/i.test(title.trim())) &&
        /magnetflix/i.test(`${sName} ${stream.description || ''}`) &&
        /\/185995\.mp4(?:\?|$)/i.test(resolveValidationTargetUrl(sUrl) || sUrl)) {
      return false;
    }

    // O addon devolve a terceira temporada sob a consulta da primeira.
    // O título da obra coincide, mas o episódio solicitado não.
    if (episodeParams?.season === 1 &&
        rawCandidates.some(title => /mushoku tensei/i.test(title)) &&
        /\bmushoku tensei\s+iii\b/i.test(sTitle)) {
      return false;
    }

    // Se o conteúdo solicitado é uma série (com episodeParams), rejeita fontes que são comprovadamente filmes isolados
    if (episodeParams && episodeParams.season > 0) {
      const releaseYearMatch = sTitle.match(/\b(19\d{2}|20\d{2})\b/);
      const hasEpisodeMarker = /\b(?:s\d{1,2}|t\d{1,2}|e\d{1,3}|ep\d{1,3}|season|temporada|epis[oó]dio)\b/i.test(combined);
      if (releaseYearMatch && !hasEpisodeMarker) {
        const movieReleaseTags = /\b(bluray|bdrip|brrip|dvdrip|remux)\b/i.test(sTitle);
        if (movieReleaseTags) {
          console.warn(`[StreamValidator] Fonte de filme rejeitada para requisição de série: ${sTitle}`);
          return false;
        }
      }
    }

    // 2. Aplica regras de bloqueio de desvios conhecidos (ex: Doraemon -> Sparks of Tomorrow)
    for (const rule of KNOWN_UPSTREAM_MISMATCHES) {
      if (rawCandidates.some(cand => rule.targetPattern.test(cand))) {
        if (rule.rejectStream(stream, rawCandidates)) {
          console.warn(`[StreamValidator] Stream rejeitado por desvio conhecido para '[${rawCandidates.join(', ')}]': ${sTitle || sUrl}`);
          return false;
        }
      }
    }

    const normalizeTitle = (str: string) => {
      return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const cleanCandidates = rawCandidates.map(normalizeTitle).filter(Boolean);

    // 3. Validação de título declarado em streams estruturados (ex: '🐦‍🔥 Nome da Obra ⏸️')
    const fenixMatch = sTitle.match(/🐦‍🔥\s*([^\n⏸️]+)/i);
    if (fenixMatch) {
      const declaredTitle = normalizeTitle(fenixMatch[1]);

      // Tradução oficial exata; não aceitar correspondência por palavras vagas.
      let matchesAny = declaredTitle === 'a casa do dragao' &&
        cleanCandidates.includes('house of the dragon');
      for (const cand of cleanCandidates) {
        if (declaredTitle === cand ||
            declaredTitle.startsWith(cand + ' ') ||
            declaredTitle.startsWith(cand + ':') ||
            declaredTitle.startsWith(cand + ' -')) {
          matchesAny = true;
          break;
        }
        // Para títulos com 2 ou mais termos (ex: "Chicago Typewriter"), TODOS os termos devem estar presentes
        const candWords = cand.split(' ').filter(w => w.length >= 3);
        if (candWords.length >= 2 && candWords.every(cw => declaredTitle.includes(cw))) {
          matchesAny = true;
          break;
        }
      }

      if (!matchesAny && cleanCandidates.length > 0) {
        console.warn(`[StreamValidator] Título do stream '${declaredTitle}' não corresponde aos títulos solicitados [${cleanCandidates.join(', ')}]`);
        return false;
      }
    }

    // 4. Validação de torrents com releases claramente de outras obras
    if (sTitle.length > 5 && (sTitle.includes('1080p') || sTitle.includes('720p') || sTitle.includes('.mkv') || sTitle.includes('.mp4') || sTitle.includes('NyaaSi') || sTitle.includes('TorrentGalaxy') || sTitle.includes('1337x'))) {
      const cleanSTitle = normalizeTitle(sTitle.replace(/\[[^\]]+\]/g, ' '));
      const otherKnownSeries = ['ultraman', 'aseria', 'angel heart', 'sparks of tomorrow', 'black clover', 'murai in love', 'saving 80,000 gold'];

      const matchesTarget = cleanCandidates.some(cand => {
        const words = cand.split(' ').filter(w => w.length >= 3);
        if (words.length >= 2) {
          return cleanSTitle.includes(cand) || words.every(w => cleanSTitle.includes(w));
        }
        return cleanSTitle.includes(cand);
      });

      if (!matchesTarget && otherKnownSeries.some(t => cleanSTitle.includes(t))) {
        console.warn(`[StreamValidator] Release torrent com título trocado rejeitada: '${sTitle}' para '[${cleanCandidates.join(', ')}]'`);
        return false;
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

    // Validação estrita: exige correspondência de frase completa ou de TODOS os termos significativos
    const targetWords = cleanTarget.split(/\s+/).filter(w => w.length >= 3);
    if (targetWords.length >= 2) {
      const allPresent = cleanStream.includes(cleanTarget) || targetWords.every(w => cleanStream.includes(w));
      if (!allPresent) {
        return false;
      }
    } else if (targetWords.length === 1) {
      const singleWord = targetWords[0];
      const escaped = singleWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const m = cleanStream.match(new RegExp(`(^|\\s)${escaped}(\\s|$)`, 'i'));
      if (!m) return false;
      const after = cleanStream.slice(m.index! + m[1].length + singleWord.length).trim();
      const nextWord = after.split(/\s+/)[0];
      if (nextWord && !/^(s\d+e\d+|s\d+|e\d+|ep\d*|t\d+ep?\d+|season|temporada|episodio|19\d{2}|20\d{2}|1080p|720p|4k|2160p|480p|bluray|bdrip|webrip|webdl|web|dvdrip|x264|x265|dublado|legendado|dual|audio|pt|br)$/i.test(nextWord)) {
        return false;
      }
    }

    if (episodeParams) {
      if (!this.isStreamMatchingEpisode({ title: streamText } as any, episodeParams)) {
        return false;
      }
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
  public filterCleanStreams(
    streams: StremioStream[],
    targetTitle?: string,
    originalTitle?: string,
    alternateTitles?: string[],
    episodeParams?: { season: number; episode: number }
  ): StremioStream[] {
    return streams.filter(s => {
      if (!s.url && !s.infoHash) return false;
      if (s.url && this.isUrlBlacklisted(s.url)) return false;
      if (s.url && videoAdBlocker.isStreamBlocked(s.url)) return false;
      if (theatricalFilterService.isCamRecording(`${s.name || ''} ${s.title || ''}`)) return false;
      return this.isStreamMatchingTargetTitle(s, targetTitle, originalTitle, alternateTitles, episodeParams);
    });
  }
}

export const streamValidator = new StreamValidator();
