/**
 * ZapiTV - ConsentManager
 * Gerenciador de Consentimento e Privacidade para Recomendações Colaborativas:
 * 1. Participação voluntária e informada (Opt-in explícito do usuário)
 * 2. Identificador pseudonimizado (UUID v4 aleatório gerado localmente no navegador)
 * 3. Tolerância zero para fingerprinting, cookies de terceiros ou dados pessoais
 * 4. Exclusão absoluta de conteúdos adultos ou sensíveis
 * 5. Revogação de consentimento com limpeza local e purga no backend
 */

import { ContentItem } from '../../../types';
import { adultContentService } from '../adult/AdultContentService';

const STORAGE_KEY_CONSENT = 'zapitv_collaborative_consent';
const STORAGE_KEY_ANON_ID = 'zapitv_collaborative_anon_id';

export class ConsentManager {
  private isOptedInCache: boolean | null = null;
  private anonymousIdCache: string | null = null;

  constructor() {
    this.init();
  }

  private init(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const consent = localStorage.getItem(STORAGE_KEY_CONSENT);
      this.isOptedInCache = consent === 'true';
      this.anonymousIdCache = localStorage.getItem(STORAGE_KEY_ANON_ID);
    } catch {}
  }

  /**
   * Verifica se o usuário consentiu voluntariamente em participar das recomendações colaborativas.
   */
  public isCollaborativeOptedIn(): boolean {
    if (this.isOptedInCache !== null) return this.isOptedInCache;
    if (typeof window !== 'undefined' && window.localStorage) {
      this.isOptedInCache = localStorage.getItem(STORAGE_KEY_CONSENT) === 'true';
      return this.isOptedInCache;
    }
    return false;
  }

  /**
   * Atualiza o estado de consentimento voluntário.
   */
  public setCollaborativeOptIn(optIn: boolean): void {
    this.isOptedInCache = optIn;
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEY_CONSENT, optIn ? 'true' : 'false');
      if (optIn && !this.anonymousIdCache) {
        this.getAnonymousClientId(); // Gera o identificador inicial se não existir
      }
    }
  }

  /**
   * Retorna o identificador pseudonimizado atual ou gera um novo UUID v4 caso não exista.
   */
  public getAnonymousClientId(): string {
    if (this.anonymousIdCache) return this.anonymousIdCache;

    if (typeof window !== 'undefined' && window.localStorage) {
      const existing = localStorage.getItem(STORAGE_KEY_ANON_ID);
      if (existing) {
        this.anonymousIdCache = existing;
        return existing;
      }
    }

    // Gerador de UUID v4 criptográfico puro (sem fingerprinting do dispositivo)
    const newId = this.generateCryptographicUUID();
    this.anonymousIdCache = newId;

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(STORAGE_KEY_ANON_ID, newId);
      } catch {}
    }

    return newId;
  }

  /**
   * Gera um UUID v4 seguro sem qualquer informação do hardware ou rede.
   */
  private generateCryptographicUUID(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Rotaciona o identificador pseudonimizado do usuário sob demanda.
   */
  public rotateAnonymousId(): string {
    const newId = this.generateCryptographicUUID();
    this.anonymousIdCache = newId;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(STORAGE_KEY_ANON_ID, newId);
      } catch {}
    }
    return newId;
  }

  /**
   * Verifica se um evento pode ser transmitido com segurança:
   * 1. Consentimento explícito deve estar ativo.
   * 2. O conteúdo NÃO pode ser adulto ou pornográfico.
   */
  public canSendEvent(item: ContentItem): boolean {
    if (!this.isCollaborativeOptedIn()) return false;
    if (!item || !item.id) return false;

    // Regra estrita: nunca enviar eventos de conteúdo adulto para filtragem coletiva
    if (item.isAdult || adultContentService.isAdultContent(item)) {
      return false;
    }

    return true;
  }

  /**
   * Revoga o consentimento, apaga o identificador local e solicita a exclusão
   * de quaisquer dados associados no backend seguro.
   */
  public async revokeConsentAndPurge(): Promise<boolean> {
    const anonId = this.anonymousIdCache;
    this.setCollaborativeOptIn(false);
    this.anonymousIdCache = null;

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem(STORAGE_KEY_ANON_ID);
        localStorage.removeItem(STORAGE_KEY_CONSENT);
      } catch {}
    }

    if (anonId) {
      try {
        await fetch(`/api/recommendations/user-data/${encodeURIComponent(anonId)}`, {
          method: 'DELETE',
          signal: AbortSignal.timeout(3000)
        });
      } catch {
        // Falha de rede tolerada
      }
    }

    return true;
  }
}

export const consentManager = new ConsentManager();
