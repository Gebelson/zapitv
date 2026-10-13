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

    // 2. FILMES EM CARTAZ / NÃO LANÇADOS EM DIGITAL (Proteção Anti-Scam)
    // Filmes como Hope (2026), Vingadores 2026 que não saíram em streaming não possuem WEB-DL legítimo
    if (identity.isTheatricalUnreleased) {
      const isClaimingDigital = (
        (combined.includes('web-dl') || combined.includes('webrip') || combined.includes('bluray') || combined.includes('amzn')) &&
        !combined.includes('trailer') &&
        !combined.includes('teaser')
      );
      if (isClaimingDigital) {
        const reason = `Release digital fraudulenta para obra em cartaz/não lançada: "${identity.title}"`;
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
    const isAcervoOficial = (
      stream.providerId === 'zapitv-verified' ||
      stream.providerName?.includes('Acervo') ||
      stream.providerName?.includes('ZapiTV') ||
      streamUrl.includes('archive.org') ||
      streamUrl.includes('/api/stremio/cinema-aberto') ||
      streamUrl.includes('/api/stremio/blender-open') ||
      streamUrl.includes('/api/stremio/public-domain')
    );

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
    const streamTitleToCheck = canonicalIdentityService.normalizeTitle(`${streamName} ${streamTitle}`);
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
    const cleanStreamTitle = canonicalIdentityService.normalizeTitle(streamTitle);

    // Verifica se algum alias canônico coincide
    let aliasMatched = false;
    for (const alias of identity.knownAliases) {
      if (cleanStreamTitle.includes(alias) || combined.includes(alias)) {
        aliasMatched = true;
        break;
      }
    }

    // Verifica sobreposição de tokens
    const matchingTokens = targetTokens.filter(token => cleanStreamTitle.includes(token) || combined.includes(token));
    const tokenOverlapRatio = targetTokens.length > 0 ? (matchingTokens.length / targetTokens.length) : 0;

    if (!aliasMatched && tokenOverlapRatio === 0) {
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
      if (!aliasMatched && tokenOverlapRatio < 0.5) {
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
