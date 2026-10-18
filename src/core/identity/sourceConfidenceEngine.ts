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
      return {
        stream,
        confidence: 'QUARANTINED',
        isMatch: false,
        reasons,
        canonicalTitle: identity.title
      };
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
        return {
          stream,
          confidence: 'QUARANTINED',
          isMatch: false,
          reasons,
          canonicalTitle: identity.title
        };
      }
    }

    // 3. FONTES VERIFICADAS DO ACERVO OFICIAL ZAPITV / CDN DIRETO
    // Apenas a entrada local associada por ID exato pode ser considerada verificada.
    // Nome do provedor e domínio de hospedagem não provam qual vídeo foi servido.
    const isAcervoOficial = stream.providerId === 'zapitv-verified';

    const episodeTag = streamTitle.match(/(?:\bS(\d{1,2})\s*E(\d{1,3})\b|\bT(\d{1,2})\s*EP?(\d{1,3})\b)/i);
    if (episodeTag && identity.type === ContentType.MOVIE) {
      reasons.push('Fonte episódica oferecida para um filme');
      return { stream, confidence: 'REJECTED', isMatch: false, reasons, canonicalTitle: identity.title };
    }
    if (episodeTag && identity.season && identity.episode &&
        (Number(episodeTag[1] || episodeTag[3]) !== identity.season || Number(episodeTag[2] || episodeTag[4]) !== identity.episode)) {
      reasons.push('Temporada ou episódio diferente do solicitado');
      return { stream, confidence: 'REJECTED', isMatch: false, reasons, canonicalTitle: identity.title };
    }

    if (identity.type === ContentType.MOVIE && identity.year) {
      const releaseYear = streamTitle.match(/\b(19\d{2}|20\d{2})\b/);
      if (releaseYear && Math.abs(Number(releaseYear[1]) - identity.year) > 1) {
        reasons.push('Ano da fonte diferente do filme solicitado');
        return { stream, confidence: 'REJECTED', isMatch: false, reasons, canonicalTitle: identity.title };
      }
    }

    // Addons que separam explicitamente o título da obra na primeira linha
    // precisam corresponder ao título canônico inteiro ou à sua parte principal
    const declaredTitle = streamTitle.match(/🐦‍🔥\s*([^\n⏸️]+)/)?.[1]?.trim();
    if (declaredTitle) {
      const normalizedDeclared = canonicalIdentityService.normalizeTitle(declaredTitle);
      const declaredParts = declaredTitle.split(/[:\-–—|]/).map(p => canonicalIdentityService.normalizeTitle(p.trim())).filter(p => p.length >= 3);
      const aliases = [identity.title, identity.originalTitle, ...(identity.knownAliases || [])].filter(Boolean)
        .map(alias => canonicalIdentityService.normalizeTitle(alias!));

      const isMatch = aliases.some(alias =>
        normalizedDeclared === alias ||
        declaredParts.includes(alias) ||
        (alias.length >= 5 && normalizedDeclared.startsWith(alias))
      );

      // Verificação de segurança: não permitir substituição de Naruto clássico por Shippuden
      const isShippudenMismatch = normalizedDeclared.includes('shippuden') && !aliases.some(a => a.includes('shippuden'));

      if (!isMatch || isShippudenMismatch) {
        reasons.push('Título declarado pelo addon difere da obra solicitada');
        return { stream, confidence: 'REJECTED', isMatch: false, reasons, canonicalTitle: identity.title };
      }
    }

    if (isAcervoOficial) {
      reasons.push('Fonte canônica verificada pelo acervo oficial ZapiTV');
      return {
        stream,
        confidence: 'VERIFIED',
        isMatch: true,
        reasons,
        canonicalTitle: identity.title
      };
    }

    // 4. DETECÇÃO DE OBRAS COMPLETAMENTE DIFERENTES (Colisão de Títulos)
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
          return {
            stream,
            confidence: 'REJECTED',
            isMatch: false,
            reasons,
            canonicalTitle: identity.title
          };
        }
      }
    }

    // Caso específico Resident Evil: animação 3D substituindo filme live-action
    if (/resident evil/i.test(identity.title) && !/vendetta|damnation|degeneration|infinite darkness|death island/i.test(identity.title)) {
      if (/vendetta|damnation|degeneration|infinite darkness|death island/i.test(combined)) {
        reasons.push('Animação 3D de Resident Evil não pode substituir o filme live-action solicitado');
        return {
          stream,
          confidence: 'REJECTED',
          isMatch: false,
          reasons,
          canonicalTitle: identity.title
        };
      }
    }

    // 5. VALIDAÇÃO DE SOBREPOSIÇÃO DE TÍTULO (Positive Title Overlap)
    const targetTokens = canonicalIdentityService.extractSignificantTokens(identity.title);
    const origTokens = identity.originalTitle ? canonicalIdentityService.extractSignificantTokens(identity.originalTitle) : [];
    const cleanStreamTitle = canonicalIdentityService.normalizeTitle(`${streamTitle} ${stream.description || ''}`);
    const titleWords = new Set(canonicalIdentityService.extractSignificantTokens(`${streamName} ${streamTitle} ${stream.description || ''}`));

    // Verifica se algum alias canônico coincide
    let aliasMatched = false;
    for (const alias of identity.knownAliases) {
      const cleanAlias = canonicalIdentityService.normalizeTitle(alias);
      if (cleanAlias.length >= 3 && new RegExp(`(^|\\s)${cleanAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(streamTitleToCheck)) {
        aliasMatched = true;
        break;
      }
    }

    // Verifica sobreposição de tokens de título nacional ou original
    const matchingTarget = targetTokens.filter(token => titleWords.has(token));
    const matchingOrig = origTokens.filter(token => titleWords.has(token));
    const tokenOverlapRatio = targetTokens.length > 0 ? (matchingTarget.length / targetTokens.length) : 0;
    const origOverlapRatio = origTokens.length > 0 ? (matchingOrig.length / origTokens.length) : 0;

    // Se qualquer token distintivo (comprimento >= 4) do título nacional ou original estiver presente no stream
    const hasDistinctiveToken = [...matchingTarget, ...matchingOrig].some(t => t.length >= 4);

    const hasTitleCorrespondence = aliasMatched || tokenOverlapRatio >= 0.3 || origOverlapRatio >= 0.3 || hasDistinctiveToken;

    if (!hasTitleCorrespondence) {
      reasons.push(`Título do stream não possui correspondência com "${identity.title}"`);
      return {
        stream,
        confidence: 'REJECTED',
        isMatch: false,
        reasons,
        canonicalTitle: identity.title
      };
    }

    // 6. REGRA CONSERVADORA PARA CONTEÚDO INFANTIL / FAMILIAR
    if (identity.isChildFriendly) {
      // Para produções infantis, a correspondência deve ser explícita
      if (!aliasMatched && tokenOverlapRatio < 0.3 && origOverlapRatio < 0.3 && !hasDistinctiveToken) {
        reasons.push('Conteúdo infantil exige confirmação rigorosa de identidade');
        return {
          stream,
          confidence: 'REJECTED',
          isMatch: false,
          reasons,
          canonicalTitle: identity.title
        };
      }
      
      // Se não for do acervo oficial, classifica no máximo como PROVISIONAL (nunca auto-aprova fontes obscuras)
      reasons.push('Conteúdo infantil: correspondência aprovada com validação cautelosa');
      return {
        stream,
        confidence: 'PROVISIONAL',
        isMatch: true,
        reasons,
        canonicalTitle: identity.title
      };
    }

    // 7. CLASSIFICAÇÃO PARA DEMAIS PRODUÇÕES
    if (aliasMatched || tokenOverlapRatio >= 0.5) {
      reasons.push(`Correspondência de título verificada (${Math.round(tokenOverlapRatio * 100)}% dos termos)`);
      return {
        stream,
        confidence: 'PROVISIONAL',
        isMatch: true,
        reasons,
        canonicalTitle: identity.title
      };
    }

    reasons.push('Informações do stream incompletas ou correspondência parcial');
    return {
      stream,
      confidence: 'SUSPICIOUS',
      isMatch: false,
      reasons,
      canonicalTitle: identity.title
    };
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
