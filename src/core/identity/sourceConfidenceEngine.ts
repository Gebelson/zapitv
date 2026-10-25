/**
 * ZapiTV — SourceConfidenceEngine
 * Motor de Validação e Classificação de Confiabilidade das Fontes de Streaming.
 * 
 * Níveis de Confiabilidade:
 * - VERIFIED: Fonte validada com evidências suficientes de identidade, procedência e compatibilidade.
 * - PROVISIONAL: Fonte com informações promissoras, mas validação incompleta.
 * - SUSPICIOUS: Inconsistências de metadados ou sinais de associação incorreta.
 * - REJECTED: Fonte comprovadamente incompatível com a obra solicitada.
 * - QUARANTINED: Fonte bloqueada após incidente grave, trote ou evidência de conteúdo inadequado/adulto.
 */

import { StremioStream } from '../stremio/stremioTypes';
import { CanonicalMediaIdentity, canonicalIdentityService } from './canonicalIdentity';
import { streamQuarantineService } from '../security/streamQuarantineService';
import { ContentType } from '../../../types';

export type SourceConfidence = 'VERIFIED' | 'PROVISIONAL' | 'SUSPICIOUS' | 'REJECTED' | 'QUARANTINED';

export interface StreamConfidenceEvaluation {
  stream: StremioStream;
  confidence: SourceConfidence;
  isMatch: boolean;
  reasons: string[];
  canonicalTitle: string;
}

export interface IdentityValidationRecord {
  timestamp: string;
  targetTitle: string;
  targetImdbId?: string;
  targetTmdbId?: string;
  targetType: string;
  season?: number;
  episode?: number;
  providerId?: string;
  providerName?: string;
  streamTitle?: string;
  streamUrl?: string;
  declaredTitle?: string;
  isMatch: boolean;
  confidence: SourceConfidence;
  reasons: string[];
}

// Termos técnicos, resoluções e tags de release que podem legitimamente suceder um título sem indicar outra obra
const isKnownTechnicalOrReleaseWord = (word: string): boolean => {
  return /^(s\d+|e\d+|ep\d*|season|temporada|episodio|epis[oó]dio|19\d{2}|20\d{2}|1080p|720p|4k|2160p|480p|360p|hd|sd|fhd|uhd|bluray|bdrip|brrip|webrip|webdl|web|hdtv|dvdrip|dvd|x264|x265|hevc|h264|h265|avc|aac|ac3|eac3|dts|mp4|mkv|avi|webm|dublado|legendado|dual|multi|audio|áudio|pt|br|ptbr|pob|eng|sub|softsub|hardsub|remux|complete|ita|spa|fra|ger|rus|jap|kor|nf|amzn|atvp|dnp|hmax|dsnp|repack|proper|ii|iii|iv|v|vi|vii|viii|ix|x|1st|2nd|3rd|4th|5th|part|cour)$/i.test(word);
};

// Obras conhecidas que costumam colidir erroneamente em scrapers de torrents/animes
const KNOWN_COLLISION_TITLES = [
  'sparks of tomorrow',
  'eternal aseria',
  'angel heart',
  'black clover',
  'murai in love',
  'saving 80,000 gold',
  'overflow',
  'plantão médico',
  'er plantão médico',
  'ultraman'
];

export class SourceConfidenceEngine {
  private diagnosticHistory: IdentityValidationRecord[] = [];
  private readonly MAX_DIAGNOSTICS = 50;

  public getRecentDiagnostics(): IdentityValidationRecord[] {
    return [...this.diagnosticHistory];
  }

  public clearDiagnostics(): void {
    this.diagnosticHistory = [];
  }

  private recordDiagnostic(
    stream: StremioStream,
    identity: CanonicalMediaIdentity,
    result: StreamConfidenceEvaluation,
    declaredTitle?: string
  ): void {
    const record: IdentityValidationRecord = {
      timestamp: new Date().toISOString(),
      targetTitle: identity.title,
      targetImdbId: identity.imdbId,
      targetTmdbId: identity.tmdbId,
      targetType: identity.type,
      season: identity.season,
      episode: identity.episode,
      providerId: stream.providerId,
      providerName: stream.providerName,
      streamTitle: stream.title || stream.name,
      streamUrl: stream.url,
      declaredTitle,
      isMatch: result.isMatch,
      confidence: result.confidence,
      reasons: result.reasons
    };

    this.diagnosticHistory.unshift(record);
    if (this.diagnosticHistory.length > this.MAX_DIAGNOSTICS) {
      this.diagnosticHistory.pop();
    }

    if (!result.isMatch) {
      console.warn(`[IdentityValidator] ❌ Fonte rejeitada para "${identity.title}" (${identity.type}${identity.year ? ' ' + identity.year : ''}): ${result.reasons.join(' • ')} [stream: ${stream.title || stream.name || stream.url}]`);
    }
  }

  /**
   * Avalia uma fonte de streaming contra a identidade canônica da obra solicitada.
   */
  public evaluate(
    stream: StremioStream,
    identity: CanonicalMediaIdentity
  ): StreamConfidenceEvaluation {
    const reasons: string[] = [];
    const streamName = stream.name || '';
    const streamTitle = stream.title || '';
    const streamUrl = stream.url || '';
    const streamInfoHash = (stream.infoHash || '').toLowerCase();
    const combined = `${streamName} ${streamTitle} ${streamUrl} ${streamInfoHash}`.toLowerCase();

    // 1. CHECAGEM OBRIGATÓRIA DE QUARENTENA (Prioridade Absoluta)
    const quarantineCheck = streamQuarantineService.evaluateQuarantine(stream, identity.title);
    if (quarantineCheck.isQuarantined) {
      reasons.push(quarantineCheck.reason || 'Fonte bloqueada por quarentena');
      const evalResult: StreamConfidenceEvaluation = {
        stream,
        confidence: 'QUARANTINED',
        isMatch: false,
        reasons,
        canonicalTitle: identity.title
      };
      this.recordDiagnostic(stream, identity, evalResult);
      return evalResult;
    }

    // 2. Filmes cuja estreia ainda está no futuro (proteção contra fontes falsas)
    if (identity.isTheatricalUnreleased) {
      const isClaimingDigital = (
        (combined.includes('web-dl') || combined.includes('webrip') || combined.includes('bluray') || combined.includes('amzn')) &&
        !combined.includes('trailer') &&
        !combined.includes('teaser')
      );
      if (isClaimingDigital) {
        const reason = `Release digital para obra ainda não lançada: "${identity.title}"`;
        streamQuarantineService.quarantine(streamInfoHash || streamUrl, reason, 'adult_troll', identity.title, stream.providerName);
        reasons.push(reason);
        const evalResult: StreamConfidenceEvaluation = {
          stream,
          confidence: 'QUARANTINED',
          isMatch: false,
          reasons,
          canonicalTitle: identity.title
        };
        this.recordDiagnostic(stream, identity, evalResult);
        return evalResult;
      }
    }

    // 3. FONTES VERIFICADAS DO ACERVO OFICIAL ZAPITV / CDN DIRETO
    const isAcervoOficial = stream.providerId === 'zapitv-verified';

    const episodeTag = streamTitle.match(/(?:\bS(\d{1,2})\s*E(\d{1,3})\b|\bT(\d{1,2})\s*EP?(\d{1,3})\b)/i);
    if (episodeTag && identity.type === ContentType.MOVIE) {
      reasons.push('Fonte episódica oferecida para um filme');
      const evalResult: StreamConfidenceEvaluation = { stream, confidence: 'REJECTED', isMatch: false, reasons, canonicalTitle: identity.title };
      this.recordDiagnostic(stream, identity, evalResult);
      return evalResult;
    }
    if (episodeTag && identity.season && identity.episode &&
        (Number(episodeTag[1] || episodeTag[3]) !== identity.season || Number(episodeTag[2] || episodeTag[4]) !== identity.episode)) {
      reasons.push('Temporada ou episódio diferente do solicitado');
      const evalResult: StreamConfidenceEvaluation = { stream, confidence: 'REJECTED', isMatch: false, reasons, canonicalTitle: identity.title };
      this.recordDiagnostic(stream, identity, evalResult);
      return evalResult;
    }

    // Detecção de episódio absoluto de outra temporada (ex: anime T2 E1 com tag '(Ep. 1)')
    const absEpMatch = streamTitle.match(/\((?:ep|episode)\.?\s*(\d+)\)/i);
    if (absEpMatch && identity.season && identity.season > 1 && identity.episode) {
      const absEp = parseInt(absEpMatch[1], 10);
      if (absEp <= identity.episode) {
        reasons.push(`Episódio absoluto (${absEp}) pertence à primeira temporada e não à temporada ${identity.season}`);
        const evalResult: StreamConfidenceEvaluation = { stream, confidence: 'REJECTED', isMatch: false, reasons, canonicalTitle: identity.title };
        this.recordDiagnostic(stream, identity, evalResult);
        return evalResult;
      }
    }

    if (identity.season === 1 && /\b(?:clevatess\s+ii|mushoku\s+tensei\s+ii|2nd\s+season|3rd\s+season|sais(?:on)?\s*0*2)\b/i.test(streamTitle)) {
      reasons.push('Fonte pertence a uma temporada posterior e não à primeira');
      const evalResult: StreamConfidenceEvaluation = { stream, confidence: 'REJECTED', isMatch: false, reasons, canonicalTitle: identity.title };
      this.recordDiagnostic(stream, identity, evalResult);
      return evalResult;
    }

    if (identity.type === ContentType.MOVIE && identity.year) {
      const releaseYear = streamTitle.match(/\b(19\d{2}|20\d{2})\b/);
      if (releaseYear && Math.abs(Number(releaseYear[1]) - identity.year) > 1) {
        reasons.push(`Ano da fonte (${releaseYear[1]}) diferente do filme solicitado (${identity.year})`);
        const evalResult: StreamConfidenceEvaluation = { stream, confidence: 'REJECTED', isMatch: false, reasons, canonicalTitle: identity.title };
        this.recordDiagnostic(stream, identity, evalResult);
        return evalResult;
      }
    }

    // Addons que separam explicitamente o título da obra na primeira linha (ex: FenixFlix)
    // precisam corresponder ao título canônico inteiro (não aceita prefixo insuficiente nem sobreposição de 1 palavra)
    const declaredTitle = streamTitle.match(/🐦‍🔥\s*([^\n⏸️]+)/)?.[1]?.trim();
    if (declaredTitle) {
      const normalizedDeclared = canonicalIdentityService.normalizeTitle(declaredTitle);
      const aliases = [identity.title, identity.originalTitle, ...(identity.knownAliases || [])].filter(Boolean)
        .map(alias => canonicalIdentityService.normalizeTitle(alias!));

      const isMatch = aliases.some(alias =>
        normalizedDeclared === alias ||
        normalizedDeclared.startsWith(alias + ' ') ||
        normalizedDeclared.startsWith(alias + ':') ||
        normalizedDeclared.startsWith(alias + ' -')
      );

      // Verificação de segurança: não permitir substituição de Naruto clássico por Shippuden
      const isShippudenMismatch = normalizedDeclared.includes('shippuden') && !aliases.some(a => a.includes('shippuden'));

      if (!isMatch || isShippudenMismatch) {
        reasons.push(`Título declarado pelo addon ('${declaredTitle}') difere da obra solicitada ('${identity.title}')`);
        const evalResult: StreamConfidenceEvaluation = { stream, confidence: 'REJECTED', isMatch: false, reasons, canonicalTitle: identity.title };
        this.recordDiagnostic(stream, identity, evalResult, declaredTitle);
        return evalResult;
      }
    }

    if (isAcervoOficial) {
      reasons.push('Fonte canônica verificada pelo acervo oficial ZapiTV');
      const evalResult: StreamConfidenceEvaluation = {
        stream,
        confidence: 'VERIFIED',
        isMatch: true,
        reasons,
        canonicalTitle: identity.title
      };
      this.recordDiagnostic(stream, identity, evalResult, declaredTitle);
      return evalResult;
    }

    // 4. DETECÇÃO DE OBRAS COMPLETAMENTE DIFERENTES (Colisão de Títulos Conhecidas)
    const streamTitleToCheck = canonicalIdentityService.normalizeTitle(`${streamName} ${streamTitle} ${stream.description || ''}`);
    for (const collisionTitle of KNOWN_COLLISION_TITLES) {
      const cleanCollision = canonicalIdentityService.normalizeTitle(collisionTitle);
      const regex = new RegExp(`(^|\\s)${cleanCollision}(\\s|$)`, 'i');
      if (regex.test(streamTitleToCheck)) {
        // Se a obra solicitada NÃO for a própria obra de colisão, é rejeição imediata
        const cleanTarget = canonicalIdentityService.normalizeTitle(identity.title);
        const cleanOrig = identity.originalTitle ? canonicalIdentityService.normalizeTitle(identity.originalTitle) : '';
        if (!cleanTarget.includes(cleanCollision) && !cleanOrig.includes(cleanCollision)) {
          reasons.push(`Obra incorreta detectada: stream contém "${collisionTitle}"`);
          const evalResult: StreamConfidenceEvaluation = {
            stream,
            confidence: 'REJECTED',
            isMatch: false,
            reasons,
            canonicalTitle: identity.title
          };
          this.recordDiagnostic(stream, identity, evalResult, declaredTitle);
          return evalResult;
        }
      }
    }

    // Caso específico Resident Evil: animação 3D substituindo filme live-action ou desvio de obra
    if (/resident evil/i.test(identity.title) && !/vendetta|damnation|degeneration|infinite darkness|death island/i.test(identity.title)) {
      if (/vendetta|damnation|degeneration|infinite darkness|death island|kadokawa|marza|anime|animado|animation|animated/i.test(combined)) {
        reasons.push('Animação 3D de Resident Evil (Kadokawa/Vendetta/etc.) não pode substituir o filme live-action solicitado');
        const evalResult: StreamConfidenceEvaluation = {
          stream,
          confidence: 'REJECTED',
          isMatch: false,
          reasons,
          canonicalTitle: identity.title
        };
        this.recordDiagnostic(stream, identity, evalResult, declaredTitle);
        return evalResult;
      }
      const isTarget2026 = identity.year === 2026 || identity.imdbId === 'tt13000574' || identity.tmdbId === '1423191' || /2026/.test(identity.title);
      if (isTarget2026) {
        if (/welcome to raccoon city|raccoon city|apocalypse|extinction|afterlife|retribution|final chapter|netflix/i.test(combined)) {
          reasons.push('Adaptação anterior de Resident Evil não corresponde à produção live-action de 2026');
          const evalResult: StreamConfidenceEvaluation = {
            stream,
            confidence: 'REJECTED',
            isMatch: false,
            reasons,
            canonicalTitle: identity.title
          };
          this.recordDiagnostic(stream, identity, evalResult, declaredTitle);
          return evalResult;
        }
      }
    }

    // 5. VALIDAÇÃO ESTRITA DE TÍTULO (Título Completo ou Alias Canônico Oficial)
    // NUNCA aceita sobreposição parcial de palavras (ex: "Chicago" NÃO corresponde a "Chicago Typewriter")
    const targetTokens = canonicalIdentityService.extractSignificantTokens(identity.title);
    const origTokens = identity.originalTitle ? canonicalIdentityService.extractSignificantTokens(identity.originalTitle) : [];
    const titleWords = new Set(canonicalIdentityService.extractSignificantTokens(`${streamName} ${streamTitle} ${stream.description || ''}`));

    let matchedAlias: string | null = null;
    const allAliases = [identity.title, identity.originalTitle, ...(identity.knownAliases || [])].filter(Boolean) as string[];

    for (const alias of allAliases) {
      const cleanAlias = canonicalIdentityService.normalizeTitle(alias);
      if (cleanAlias.length < 3) continue;

      const escaped = cleanAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const aliasRegex = new RegExp(`(^|\\s)${escaped}(\\s|$)`, 'i');
      const match = streamTitleToCheck.match(aliasRegex);

      if (match) {
        // Se o alias possui apenas 1 palavra (ex: "chicago"), precisamos garantir que o stream
        // não é uma obra com título composto mais longo (ex: "chicago typewriter", "chicago fire", "chicago p.d.")
        const aliasTokens = canonicalIdentityService.extractSignificantTokens(cleanAlias);
        if (aliasTokens.length === 1 && match.index !== undefined) {
          const matchPos = match.index + match[1].length;
          const afterText = streamTitleToCheck.slice(matchPos + cleanAlias.length).trim();
          const nextWord = afterText.split(/\s+/)[0];
          if (nextWord && !isKnownTechnicalOrReleaseWord(nextWord)) {
            // A palavra seguinte faz parte de um título composto diferente
            continue;
          }
        }
        matchedAlias = cleanAlias;
        break;
      }
    }

    // Se o título tem múltiplas palavras (ex: "Chicago Typewriter"), exige que TODOS os tokens distintivos estejam presentes
    const allTargetTokensPresent = targetTokens.length >= 2 && targetTokens.every(t => titleWords.has(t));
    const allOrigTokensPresent = origTokens.length >= 2 && origTokens.every(t => titleWords.has(t));

    const isFullTitleMatch = Boolean(matchedAlias) || allTargetTokensPresent || allOrigTokensPresent;

    if (!isFullTitleMatch) {
      reasons.push(`Título do stream não corresponde à obra solicitada "${identity.title}"`);
      const evalResult: StreamConfidenceEvaluation = {
        stream,
        confidence: 'REJECTED',
        isMatch: false,
        reasons,
        canonicalTitle: identity.title
      };
      this.recordDiagnostic(stream, identity, evalResult, declaredTitle);
      return evalResult;
    }

    // 6. VALIDAÇÃO DE ANO PARA SÉRIES E ANIMES
    // Impede que filmes antigos com mesmo nome passem como episódios de uma série
    if ((identity.type === ContentType.SERIES || identity.type === ContentType.ANIME) && identity.year) {
      const releaseYearMatch = streamTitle.match(/\b(19\d{2}|20\d{2})\b/);
      if (releaseYearMatch) {
        const foundYear = Number(releaseYearMatch[1]);
        if (Math.abs(foundYear - identity.year) > 1 && !episodeTag) {
          reasons.push(`Ano da fonte (${foundYear}) diverge da série (${identity.year}) sem identificador de episódio`);
          const evalResult: StreamConfidenceEvaluation = {
            stream,
            confidence: 'REJECTED',
            isMatch: false,
            reasons,
            canonicalTitle: identity.title
          };
          this.recordDiagnostic(stream, identity, evalResult, declaredTitle);
          return evalResult;
        }
      }
    }

    // 7. REGRA CONSERVADORA PARA CONTEÚDO INFANTIL / FAMILIAR
    if (identity.isChildFriendly) {
      reasons.push('Conteúdo infantil: correspondência aprovada com validação cautelosa');
      const evalResult: StreamConfidenceEvaluation = {
        stream,
        confidence: 'PROVISIONAL',
        isMatch: true,
        reasons,
        canonicalTitle: identity.title
      };
      this.recordDiagnostic(stream, identity, evalResult, declaredTitle);
      return evalResult;
    }

    // 8. CLASSIFICAÇÃO PARA DEMAIS PRODUÇÕES
    reasons.push(`Identidade confirmada para "${identity.title}"`);
    const evalResult: StreamConfidenceEvaluation = {
      stream,
      confidence: 'PROVISIONAL',
      isMatch: true,
      reasons,
      canonicalTitle: identity.title
    };
    this.recordDiagnostic(stream, identity, evalResult, declaredTitle);
    return evalResult;
  }

  /**
   * Filtra e classifica uma lista de streams para a mídia solicitada
   */
  public evaluateBatch(
    streams: StremioStream[],
    identity: CanonicalMediaIdentity
  ): StreamConfidenceEvaluation[] {
    return streams.map(s => this.evaluate(s, identity));
  }
}

export const sourceConfidenceEngine = new SourceConfidenceEngine();
