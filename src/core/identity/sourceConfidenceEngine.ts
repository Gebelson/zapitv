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
import { sanitizePlaybackReason } from '../tracking/mediaLoadingTracker';

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
// NOTA CRÍTICA: Numerais romanos (II, III, IV, etc.) e designadores de sequência/parte (1st, 2nd, Part, Cour)
// NÃO são termos técnicos, pois diferenciam obras completamente distintas (ex: Lupin vs Lupin III).
const isKnownTechnicalOrReleaseWord = (word: string): boolean => {
  return /^(s\d+e\d+|s\d+|e\d+|ep\d*|t\d+ep?\d+|t\d+|\d+x\d+|season|temporada|episodio|epis[oó]dio|capitulo|cap[ií]tulo|19\d{2}|20\d{2}|1080p|720p|4k|2160p|480p|360p|hd|sd|fhd|uhd|bluray|bdrip|brrip|webrip|webdl|web|hdtv|dvdrip|dvd|x264|x265|hevc|h264|h265|avc|aac|ac3|eac3|dts|mp4|mkv|avi|webm|dublado|legendado|dual|multi|audio|áudio|pt|br|ptbr|pob|eng|sub|softsub|hardsub|remux|complete|ita|spa|fra|ger|rus|jap|kor|nf|amzn|atvp|dnp|hmax|dsnp|repack|proper)$/i.test(word);
};

// Termos que indicam continuações, subtítulos, numerais ou produções derivadas (NUNCA descartar como termos técnicos)
const isDistinguishingTitleModifier = (word: string, isMovie: boolean = false, fullText: string = ''): boolean => {
  if (isMovie && (word === 'movie' || word === 'filme')) return false;
  if ((word === 'first' || word === '1st' || word === 'second' || word === '2nd' || word === 'third' || word === '3rd') &&
      new RegExp(`\\b${word}\\s+(?:season|temporada)\\b`, 'i').test(fullText)) {
    return false;
  }
  return /^(ii|iii|iv|v|vi|vii|viii|ix|x|1st|2nd|3rd|4th|5th|first|second|third|part|cour|origins|reboot|remake|shippuden|boruto|returns|forever|revelations|unlimited|sansei|movie|filme|alicization|alternative|progressive|underworld|ordinal|apocalypse|extinction|afterlife|retribution)$/i.test(word);
};

// Obras conhecidas que costumam colidir erroneamente em scrapers de torrents/animes
const KNOWN_COLLISION_TITLES = [
  'lupin iii',
  'lupin the third',
  'lupin sansei',
  'the cazalets',
  'raven of the inner palace',
  'koukyuu no karasu',
  'jimihen',
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
      streamTitle: sanitizePlaybackReason(stream.title || stream.name),
      streamUrl: stream.url ? '[redacted-url]' : undefined,
      declaredTitle: sanitizePlaybackReason(declaredTitle),
      isMatch: result.isMatch,
      confidence: result.confidence,
      reasons: result.reasons.map(reason => sanitizePlaybackReason(reason) || '')
    };

    this.diagnosticHistory.unshift(record);
    if (this.diagnosticHistory.length > this.MAX_DIAGNOSTICS) {
      this.diagnosticHistory.pop();
    }

    if (!result.isMatch) {
      console.warn('[IdentityValidator]', sanitizePlaybackReason(`Fonte rejeitada para "${identity.title}" (${identity.type}): ${result.reasons.join(' • ')} [stream: ${stream.title || stream.name || 'unnamed source'}]`));
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

    // Verificação de conflito estrito de identificadores externos (IMDb / TMDB)
    if (stream.imdbId && identity.imdbId && stream.imdbId.toLowerCase() !== identity.imdbId.toLowerCase()) {
      reasons.push(`IMDb ID do stream (${stream.imdbId}) diverge da obra solicitada (${identity.imdbId})`);
      const evalResult: StreamConfidenceEvaluation = { stream, confidence: 'REJECTED', isMatch: false, reasons, canonicalTitle: identity.title };
      this.recordDiagnostic(stream, identity, evalResult);
      return evalResult;
    }
    if (stream.tmdbId && identity.tmdbId && String(stream.tmdbId) !== String(identity.tmdbId)) {
      reasons.push(`TMDB ID do stream (${stream.tmdbId}) diverge da obra solicitada (${identity.tmdbId})`);
      const evalResult: StreamConfidenceEvaluation = { stream, confidence: 'REJECTED', isMatch: false, reasons, canonicalTitle: identity.title };
      this.recordDiagnostic(stream, identity, evalResult);
      return evalResult;
    }
    const declaredImdbInText = (streamTitle + ' ' + streamUrl).match(/\b(tt\d{7,10})\b/i)?.[1]?.toLowerCase();
    if (declaredImdbInText && identity.imdbId && declaredImdbInText !== identity.imdbId.toLowerCase()) {
      reasons.push(`IMDb ID identificado no stream (${declaredImdbInText}) diverge da obra solicitada (${identity.imdbId})`);
      const evalResult: StreamConfidenceEvaluation = { stream, confidence: 'REJECTED', isMatch: false, reasons, canonicalTitle: identity.title };
      this.recordDiagnostic(stream, identity, evalResult);
      return evalResult;
    }

    const episodeTag = `${streamTitle} ${streamName}`.match(/(?:\b[st]0*(\d{1,2})[\s·._-]*ep?0*(\d{1,4})\b|(\d{1,2})[ªa]?\s*temporada\s*(?:epis[oó]dio|ep)\s*(\d{1,3})\b|(?:temporada|season)\s*(\d{1,2})\s*(?:epis[oó]dio|ep|episode)\s*(\d{1,3})\b|\b(\d{1,2})x(\d{1,3})\b)/i);
    const parsedSeason = episodeTag ? Number(episodeTag[1] || episodeTag[3] || episodeTag[5] || episodeTag[7] || episodeTag[9]) : undefined;
    const parsedEpisode = episodeTag ? Number(episodeTag[2] || episodeTag[4] || episodeTag[6] || episodeTag[8] || episodeTag[10]) : undefined;

    if (episodeTag && identity.type === ContentType.MOVIE) {
      reasons.push('Fonte episódica oferecida para um filme');
      const evalResult: StreamConfidenceEvaluation = { stream, confidence: 'REJECTED', isMatch: false, reasons, canonicalTitle: identity.title };
      this.recordDiagnostic(stream, identity, evalResult);
      return evalResult;
    }
    if (episodeTag && identity.season !== undefined && identity.episode !== undefined &&
        (parsedSeason !== identity.season || parsedEpisode !== identity.episode)) {
      reasons.push('Temporada ou episódio diferente do solicitado');
      const evalResult: StreamConfidenceEvaluation = { stream, confidence: 'REJECTED', isMatch: false, reasons, canonicalTitle: identity.title };
      this.recordDiagnostic(stream, identity, evalResult);
      return evalResult;
    }

    // Detecção de episódio absoluto de outra temporada (ex: anime T2 E1 com tag '(Ep. 1)')
    const absEpMatch = streamTitle.match(/\((?:ep|episode)\.?\s*(\d+)\)/i);
    if (absEpMatch && identity.season && identity.season > 1 && identity.episode) {
      const absEp = parseInt(absEpMatch[1], 10);
      if (absEp < identity.episode || (identity.episode === 1 && absEp === 1)) {
        reasons.push(`Episódio absoluto (${absEp}) pertence à primeira temporada e não à temporada ${identity.season}`);
        const evalResult: StreamConfidenceEvaluation = { stream, confidence: 'REJECTED', isMatch: false, reasons, canonicalTitle: identity.title };
        this.recordDiagnostic(stream, identity, evalResult);
        return evalResult;
      }
    }

        // Detecção de divergência explícita de episódio no nome do arquivo / URL
    if (identity.episode !== undefined && streamUrl) {
      let filename = '';
      try {
        const parsed = new URL(streamUrl);
        const pathSegments = decodeURIComponent(parsed.pathname).split('/').filter(Boolean);
        filename = pathSegments.pop() || '';
        if (filename.toLowerCase().endsWith('.m3u8') && pathSegments.length > 0) {
          filename = pathSegments.pop() || '';
        }
      } catch {
        const pathSegments = decodeURIComponent(streamUrl).split('/').filter(Boolean);
        filename = pathSegments.pop() || '';
        if (filename.toLowerCase().endsWith('.m3u8') && pathSegments.length > 0) {
          filename = pathSegments.pop() || '';
        }
      }

      if (filename) {
        let fileEp: number | null = null;
        const opMatch = filename.match(/\b(?:op|one[-_ ]?piece)[-_ ]*0*(\d{1,4})\b/i);
        const seMatch = filename.match(/\b(?:s|t)0*(\d{1,2})[-_ ]*(?:e|ep)0*(\d{1,4})\b/i);
        const epPrefixMatch = filename.match(/\b(?:ep|episode)[-_ ]*0*(\d{1,4})\b/i);
        const standaloneMatch = filename.match(/^(?:.*[._ -])?0*(\d{1,4})(?:_\d+p)?\.(?:mp4|mkv|avi|webm|ts|m3u8)(?:\?.*)?$/i);

        if (opMatch) {
          fileEp = parseInt(opMatch[1], 10);
        } else if (seMatch) {
          fileEp = parseInt(seMatch[2], 10);
        } else if (epPrefixMatch) {
          fileEp = parseInt(epPrefixMatch[1], 10);
        } else if (standaloneMatch) {
          const num = parseInt(standaloneMatch[1], 10);
          if (num !== 1080 && num !== 720 && num !== 480 && num !== 2160 && num !== 360 && num !== 4320 && num !== 1440) {
            fileEp = num;
          }
        }

        if (fileEp !== null && fileEp !== identity.episode) {
          reasons.push(`Nome do arquivo de mídia (${filename}) aponta para o episódio ${fileEp}, divergindo do episódio solicitado (${identity.episode})`);
          const evalResult: StreamConfidenceEvaluation = { stream, confidence: 'REJECTED', isMatch: false, reasons, canonicalTitle: identity.title };
          this.recordDiagnostic(stream, identity, evalResult);
          return evalResult;
        }
      }
    }

    // Se o conteúdo solicitado é uma série/anime episódica, rejeita fontes que são comprovadamente filmes isolados
    if ((identity.type === ContentType.SERIES || identity.type === ContentType.ANIME) && identity.season) {
      const isStandaloneMovieRelease = /\b(?:bluray|bdrip|brrip|dvdrip|remux|the\s+first|the\s+movie|o\s+filme)\b/i.test(streamTitle) &&
        !episodeTag && !absEpMatch && !/\b(?:s\d+|e\d+|ep\d*|temporada|epis[oó]dio)\b/i.test(combined);
      if (isStandaloneMovieRelease) {
        reasons.push('Fonte de filme isolado não corresponde à série/episódio solicitado');
        const evalResult: StreamConfidenceEvaluation = { stream, confidence: 'REJECTED', isMatch: false, reasons, canonicalTitle: identity.title };
        this.recordDiagnostic(stream, identity, evalResult);
        return evalResult;
      }
    }

    if (identity.season === 1 && /\b(?:clevatess\s+ii|mushoku\s+tensei\s+ii|sword\s+art\s+online\s+ii|2nd\s+season|3rd\s+season|sais(?:on)?\s*0*[2-9]|\bseason\s*0*[2-9]\b|\btemporada\s*0*[2-9]\b)\b/i.test(streamTitle)) {
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

    // Caso específico Resident Evil: animação 3D substituindo filme live-action ou desvio de obra entre produções da franquia
    if (/resident evil/i.test(identity.title)) {
      const isAnimeTarget = /vendetta|damnation|degeneration|infinite darkness|death island/i.test(identity.title);
      if (!isAnimeTarget && /vendetta|damnation|degeneration|infinite darkness|death island|kadokawa|marza|anime|animado|animation|animated/i.test(combined)) {
        reasons.push('Animação 3D de Resident Evil (Kadokawa/Vendetta/etc.) não pode substituir o filme live-action solicitado');
        const evalResult: StreamConfidenceEvaluation = { stream, confidence: 'REJECTED', isMatch: false, reasons, canonicalTitle: identity.title };
        this.recordDiagnostic(stream, identity, evalResult, declaredTitle);
        return evalResult;
      }

      // Isolamento estrito entre os diferentes filmes e subtítulos da franquia Resident Evil
      const franchiseSubtitles = [
        { key: 'apocalypse', label: 'Apocalypse / Apocalipse' },
        { key: 'extinction', label: 'Extinction / A Extinção' },
        { key: 'afterlife', label: 'Afterlife / Recomeço' },
        { key: 'retribution', label: 'Retribution / Retribuição' },
        { key: 'final chapter', label: 'The Final Chapter / O Capítulo Final' },
        { key: 'welcome to raccoon city', label: 'Welcome to Raccoon City / Bem-Vindo a Raccoon City' },
        { key: 'raccoon city', label: 'Raccoon City' },
        { key: 'degeneration', label: 'Degeneration / Degeneração' },
        { key: 'damnation', label: 'Damnation / Condenação' },
        { key: 'vendetta', label: 'Vendetta / A Vingança' },
        { key: 'death island', label: 'Death Island / Ilha da Morte' },
        { key: 'infinite darkness', label: 'Infinite Darkness / No Escuro Absoluto' }
      ];
      const targetLower = `${identity.title} ${identity.originalTitle || ''}`.toLowerCase();
      for (const sub of franchiseSubtitles) {
        const streamHasSub = combined.includes(sub.key);
        const targetHasSub = targetLower.includes(sub.key);
        if (streamHasSub && !targetHasSub) {
          reasons.push(`Filme diferente da franquia Resident Evil: stream contém "${sub.label}"`);
          const evalResult: StreamConfidenceEvaluation = { stream, confidence: 'REJECTED', isMatch: false, reasons, canonicalTitle: identity.title };
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
        // Se o alias possui apenas 1 palavra (ex: "lupin", "chicago"), precisamos garantir que o stream
        // não é uma obra com título composto mais longo (ex: "lupin iii", "chicago typewriter", "chicago fire", "chicago p.d.")
        const aliasWords = cleanAlias.split(/\s+/).filter(Boolean);
        if (aliasWords.length === 1 && match.index !== undefined) {
          const matchPos = match.index + match[1].length;
          const afterText = streamTitleToCheck.slice(matchPos + cleanAlias.length).trim();
          const nextWord = afterText.split(/\s+/)[0];
          const isSeasonOrEpIndicator = /^\d+\s*(?:temporada|season|episodio|epis[oó]dio|ep|capitulo|cap[ií]tulo)\b/i.test(afterText) ||
                                       /^(?:temporada|season|episodio|epis[oó]dio|ep)\s*\d+\b/i.test(afterText);
          if (nextWord && !isKnownTechnicalOrReleaseWord(nextWord) && !isSeasonOrEpIndicator) {
            // A palavra seguinte faz parte de um título composto diferente
            continue;
          }
        } else if (aliasWords.length >= 2 && match.index !== undefined) {
          const matchPos = match.index + match[1].length;
          const afterText = streamTitleToCheck.slice(matchPos + cleanAlias.length).trim();
          const nextWord = afterText.split(/\s+/)[0];
          const isTargetMovie = identity.type === ContentType.MOVIE;
          const isMultiWordModifier = /^(?:the\s+movie|the\s+first|the\s+second|the\s+third)\b/i.test(afterText);
          if (nextWord && (isDistinguishingTitleModifier(nextWord, isTargetMovie, streamTitleToCheck) || isMultiWordModifier)) {
            const aliasWordsSet = new Set(aliasWords);
            if (!aliasWordsSet.has(nextWord.toLowerCase())) {
              // A palavra seguinte é um numeral romano ou modificador de sequência não presente no título solicitado
              continue;
            }
          }
        }
        matchedAlias = cleanAlias;
        break;
      }
    }

    // Validação de modificadores distintivos de franquia/sequência presentes nos tokens
    const allKnownTargetWords = new Set<string>();
    targetTokens.forEach(t => allKnownTargetWords.add(t));
    origTokens.forEach(t => allKnownTargetWords.add(t));
    allAliases.forEach(a => {
      canonicalIdentityService.normalizeTitle(a).split(/\s+/).filter(Boolean).forEach(t => allKnownTargetWords.add(t));
    });

    const isTargetMovie = identity.type === ContentType.MOVIE;
    const hasDistinguishingModifierNotInTarget = Array.from(titleWords).some(
      word => isDistinguishingTitleModifier(word, isTargetMovie, streamTitleToCheck) && !allKnownTargetWords.has(word)
    );

    if (hasDistinguishingModifierNotInTarget) {
      reasons.push('Título do stream contém modificador de obra/sequência derivada não pertencente à obra solicitada');
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
