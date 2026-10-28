import { StremioStream } from '../stremio/stremioTypes';
import type { SubtitleTrack } from './subtitleService';

export type SubtitleFormat =
  | 'clean_confirmed'    // Vídeo limpo confirmado (RAW, Clean, No Subs, Unsubbed)
  | 'softsub'            // Legenda interna selecionável (Softsub, MKV, Multi-sub)
  | 'hardsub_ptbr'       // Legenda gravada na imagem em português (Hardsub PT-BR)
  | 'hardsub_foreign'    // Legenda gravada na imagem em outro idioma (ENG, ESP, etc.)
  | 'unknown';           // Tipo de legenda desconhecido ou não especificado

export interface SubtitleAnalysisResult {
  format: SubtitleFormat;
  isHardsub: boolean;
  isClean: boolean;
  isSoftsub: boolean;
  language?: string;
  hasPtSubtitle: boolean;
  confidence: number;
  details: string;
}

export interface UserSubtitlePreference {
  enabled: boolean;          // true: legendas ativadas; false: "Sem legenda" / desativada
  language: string;         // 'pt-BR' | 'pt' | 'en' | 'es' etc.
  hasExplicitChoice: boolean; // Indica se o usuário realizou uma escolha intencional
  updatedAt: number;
}

export const STORAGE_KEY_SUBTITLE_PREFERENCE = 'zapitv_subtitle_user_preference';
export const EVENT_SUBTITLE_PREFERENCE_CHANGED = 'zapitv_subtitle_preference_changed';

export const DEFAULT_USER_SUBTITLE_PREFERENCE: UserSubtitlePreference = {
  enabled: true,
  language: 'pt-BR',
  hasExplicitChoice: false,
  updatedAt: 0
};

const CLEAN_PATTERNS = [
  /\b(raw|clean|no[-_]?subs?|unsubbed|sem[-_]?legendas?|sem[-_]?leg|clean[-_]?video|textless|ncop|nced)\b/i,
  /\b(bd[-_]?rip\s*raw|bdrip\s*raw|web[-_]?dl\s*raw|webrip\s*raw|dvd[-_]?raw)\b/i,
  /\b(audio\s*japones\s*sem\s*legenda|japones\s*puro|sem\s*legendas?\s*embutidas?)\b/i,
  /\[raw\]/i,
  /\braw\b/i
];

const SOFTSUB_PATTERNS = [
  /\b(soft[-_]?subs?|multi[-_]?subs?|embedded[-_]?subs?|switchable[-_]?subs?|selectable[-_]?subs?)\b/i,
  /\b(legendas?\s*selecion[aá]veis?|faixas?\s*de\s*legenda|legendas?\s*internas?)\b/i,
  /\[softsubs?\]/i,
  /\[multi[-_]?subs?\]/i
];

const HARDSUB_FOREIGN_PATTERNS = [
  /\b(?:spanish|espa[nñ]ol|espanhol|castellano|latino|spa|esp|es)[-_.\s]*(?:hard[-_.\s]?subs?|burned[-_.\s]?in|legendas?[-_.\s]?(?:fixas?|embutidas?))\b/i,
  /\b(?:hard[-_.\s]?subs?|hardcoded[-_.\s]*subs?|legendas?[-_.\s]?(?:fixas?|embutidas?))[-_.\s]*(?:spanish|espa[nñ]ol|espanhol|castellano|latino|spa|esp|es)\b/i,
  /\b(eng(?:lish)?[-_.\s]*hardsubs?|hardsubs?[-_.\s]*eng(?:lish)?|hardcoded[-_.\s]*(?:eng|english|spa|spanish|esp|fre|french|ita|italian))\b/i,
  /\b(hardsub\s*\[(?:eng|en|es|spa|fre|ita)\]|subbed\s*\[(?:eng|en|es|spa|fre|ita)\])\b/i,
  /\b(subs?\s*burned\s*in\s*eng(?:lish)?|burned[-_.\s]*in\s*eng(?:lish)?)\b/i,
  /\b(legendado\s*em\s*(?:ingl[eê]s|espanhol|franc[eê]s))\b/i,
  /\[(?:eng|en|spa|es|english|spanish)\s*hardsubs?\]/i,
  /\[hardcoded\s*subs?\]/i
];

const HARDSUB_PTBR_PATTERNS = [
  /\b(hardsub[-_.]?pt[-_.]?br|pt[-_.]?br[-_.]?hardsub|hardsub\s*\[pt[-_.]?br\]|hardsub\s*pt|hardsub[-_.]?br)\b/i,
  /\b(?:legendas?[-_.\s]?(?:fixas?|embutidas?|gravadas?)|burned[-_.\s]?in[-_.\s]?subs?)[-_.\s]*(?:pt[-_.]?br|portugu[eê]s(?:[-_.\s]*brasileiro)?)\b/i
];

export class SubtitlePreferenceService {
  private memoryPreference: UserSubtitlePreference = { ...DEFAULT_USER_SUBTITLE_PREFERENCE };
  private listeners: Set<(pref: UserSubtitlePreference) => void> = new Set();

  constructor() {
    this.initFromStorage();
  }

  private initFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SUBTITLE_PREFERENCE);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.enabled === 'boolean') {
          this.memoryPreference = {
            enabled: parsed.enabled,
            language: typeof parsed.language === 'string' && parsed.language.trim() ? parsed.language.trim() : 'pt-BR',
            hasExplicitChoice: parsed.hasExplicitChoice !== false,
            updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now()
          };
        }
      }
    } catch (e) {
      console.warn('[SubtitlePreferenceService] Falha ao carregar preferência do localStorage:', e);
    }
  }

  /**
   * Obtém a preferência atual de legendas do usuário (persistente via localStorage).
   */
  public getUserPreference(): UserSubtitlePreference {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_SUBTITLE_PREFERENCE);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed?.enabled === 'boolean') {
            this.memoryPreference = {
              enabled: parsed.enabled,
              language: typeof parsed.language === 'string' && parsed.language.trim() ? parsed.language.trim() : 'pt-BR',
              hasExplicitChoice: parsed.hasExplicitChoice !== false,
              updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now()
            };
          }
        }
      } catch {}
    }
    return { ...this.memoryPreference };
  }

  /**
   * Salva alterações nas preferências de legenda do usuário no localStorage e notifica assinantes.
   */
  public setUserPreference(updates: Partial<UserSubtitlePreference>): UserSubtitlePreference {
    const current = this.getUserPreference();
    const next: UserSubtitlePreference = {
      ...current,
      ...updates,
      hasExplicitChoice: true,
      updatedAt: Date.now()
    };

    this.memoryPreference = next;

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(STORAGE_KEY_SUBTITLE_PREFERENCE, JSON.stringify(next));
      } catch (e) {
        console.warn('[SubtitlePreferenceService] Falha ao gravar preferência no localStorage:', e);
      }
    }

    this.notifyListeners(next);
    return next;
  }

  /**
   * Ativa ou desativa as legendas de forma persistente.
   * Se enabled === false, salva "Sem legenda" para todos os episódios futuros.
   */
  public setSubtitlesEnabled(enabled: boolean): void {
    this.setUserPreference({ enabled });
  }

  /**
   * Verifica se o usuário optou por manter legendas ativadas.
   */
  public isSubtitlesEnabled(): boolean {
    return this.getUserPreference().enabled;
  }

  /**
   * Define o idioma preferido de legendas (ex: 'pt-BR', 'en', 'es') e ativa a exibição.
   */
  public setPreferredLanguage(language: string): void {
    const cleanLang = (language || '').trim();
    if (cleanLang) {
      this.setUserPreference({ language: cleanLang, enabled: true });
    }
  }

  /**
   * Retorna o código do idioma de legendas preferido pelo usuário.
   */
  public getPreferredLanguage(): string {
    return this.getUserPreference().language || 'pt-BR';
  }

  /**
   * Indica se o usuário realizou uma escolha intencional de legendas.
   */
  public hasExplicitPreference(): boolean {
    return this.getUserPreference().hasExplicitChoice;
  }

  /**
   * Assina notificações de mudança nas preferências de legendas.
   */
  public subscribe(listener: (pref: UserSubtitlePreference) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(pref: UserSubtitlePreference): void {
    this.listeners.forEach(fn => {
      try {
        fn(pref);
      } catch (err) {
        console.error('[SubtitlePreferenceService] Erro no listener:', err);
      }
    });

    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent(EVENT_SUBTITLE_PREFERENCE_CHANGED, { detail: pref }));
      } catch {}
    }
  }

  /**
   * Localiza a melhor faixa de legenda compatível com o idioma preferido do usuário.
   * Se o idioma preferido não estiver disponível e legendas estiverem ativadas,
   * utiliza uma alternativa disponível (Requisito 9).
   */
  public findBestTrack(tracks: SubtitleTrack[], preferredLang?: string): SubtitleTrack | null {
    if (!tracks || tracks.length === 0) return null;

    const targetLang = (preferredLang || this.getPreferredLanguage()).toLowerCase().trim();

    // 1. Português do Brasil (Prioridade Máxima)
    if (
      targetLang === 'pt-br' ||
      targetLang === 'pt' ||
      targetLang === 'por' ||
      targetLang === 'pob' ||
      targetLang === 'bra'
    ) {
      const ptBrTrack = tracks.find(t => t.isPtBr) ||
                        tracks.find(t => /^(pob|pt-br|bra|por-br)$/i.test(t.lang)) ||
                        tracks.find(t => /portugu[eê]s\s*\(brasil\)|pt[-_]?br/i.test(t.label || t.languageName));
      if (ptBrTrack) return ptBrTrack;

      const ptAnyTrack = tracks.find(t => /^(por|pt|pt-pt)$/i.test(t.lang)) ||
                         tracks.find(t => /portugu[eê]s/i.test(t.label || t.languageName));
      if (ptAnyTrack) return ptAnyTrack;
    } else {
      // 2. Outro idioma preferido (ex: Inglês, Espanhol, etc.)
      const exactMatch = tracks.find(t => t.lang?.toLowerCase() === targetLang);
      if (exactMatch) return exactMatch;

      const partialMatch = tracks.find(t =>
        t.lang?.toLowerCase().startsWith(targetLang.slice(0, 2)) ||
        t.languageName?.toLowerCase().includes(targetLang) ||
        t.label?.toLowerCase().includes(targetLang)
      );
      if (partialMatch) return partialMatch;
    }

    // 3. Fallback alternativo quando as legendas estão habilitadas pelo usuário (Requisito 9)
    // Retorna a melhor faixa disponível classificada por ordem de qualidade
    return tracks[0] || null;
  }

  /**
   * Resolve a faixa de legenda a ser aplicada de acordo com as regras rígidas do sistema:
   * 1. Se o usuário escolheu "Sem legenda", NUNCA ativa faixas.
   * 2. Se a fonte possui Hardsub, NUNCA sobrepõe legendas externas duplicadas.
   * 3. Se habilitadas, seleciona o idioma preferido ou alternativa.
   */
  public resolveDesiredSubtitleTrack(
    tracks: SubtitleTrack[],
    currentStream?: StremioStream,
    hasBrazilianAudio?: boolean
  ): {
    track: SubtitleTrack | null;
    mode: 'disabled_by_user' | 'hardsub_detected' | 'selected' | 'none_available' | 'default_off_for_ptbr_audio';
    format?: SubtitleFormat;
    reason: string;
  } {
    const pref = this.getUserPreference();

    // 1. Usuário desativou legendas expressamente ("Sem legenda"): NUNCA ativa automaticamente!
    if (!pref.enabled) {
      return {
        track: null,
        mode: 'disabled_by_user',
        reason: 'O usuário selecionou Sem legenda (preferência persistente)'
      };
    }

    // 2. Se a fonte contiver Hardsub (legendas embutidas permanentemente nos frames da imagem):
    if (currentStream) {
      const formatAnalysis = this.analyzeSubtitles(currentStream);
      if (formatAnalysis.isHardsub) {
        return {
          track: null,
          mode: 'hardsub_detected',
          format: formatAnalysis.format,
          reason: 'O vídeo já possui legendas gravadas na imagem (Hardsub)'
        };
      }
    }

    // 3. Se o usuário nunca configurou e o áudio é em português brasileiro: default desligado
    if (!pref.hasExplicitChoice && hasBrazilianAudio) {
      return {
        track: null,
        mode: 'default_off_for_ptbr_audio',
        reason: 'Áudio original ou dublado em português (padrão desligado para novas sessões)'
      };
    }

    // 4. Sem faixas
    if (!tracks || tracks.length === 0) {
      return {
        track: null,
        mode: 'none_available',
        reason: 'Nenhuma faixa de legenda encontrada para o conteúdo'
      };
    }

    // 5. Legendas habilitadas: busca idioma preferido ou fallback
    const track = this.findBestTrack(tracks, pref.language);
    return {
      track,
      mode: 'selected',
      reason: track ? `Faixa selecionada (${track.languageName})` : 'Nenhuma faixa compatível'
    };
  }

  /**
   * Avalia as legendas disponíveis no stream e o tipo de vídeo (limpo, softsub, hardsub).
   */
  public analyzeSubtitles(stream: StremioStream, hasExternalPtSub = false): SubtitleAnalysisResult {
    const combined = `${stream.name || ''} ${stream.title || ''} ${stream.description || ''}`.toLowerCase();
    const url = (stream.url || '').toLowerCase();

    const hasPtBrIndication = /\b(legenda[-_]?pt|legendado|legendada|leg[-_]?pt|softsub|hardsub)\b/i.test(combined) ||
      (/\b(pt[-_]?br|portugu[eê]s)\b/i.test(combined) && !/\bdublado\b/i.test(combined));

    // 1. Identificar hardsub estrangeiro
    if (HARDSUB_FOREIGN_PATTERNS.some(p => p.test(combined))) {
      return {
        format: 'hardsub_foreign',
        isHardsub: true,
        isClean: false,
        isSoftsub: false,
        language: 'foreign',
        hasPtSubtitle: false,
        confidence: 0.95,
        details: 'Legenda gravada em outro idioma detectada'
      };
    }

    // 2. Avaliar indícios de Clean / RAW
    const hasCleanKeyword = CLEAN_PATTERNS.some(p => p.test(combined));

    // 3. Avaliar indícios de Softsub
    const hasSoftsubKeyword = SOFTSUB_PATTERNS.some(p => p.test(combined)) || url.endsWith('.mkv');

    // 4. Avaliar indícios de Hardsub PT-BR
    const hasHardsubPtBrKeyword = HARDSUB_PTBR_PATTERNS.some(p => p.test(combined));

    // Decisão da classificação
    if (hasCleanKeyword && !hasHardsubPtBrKeyword) {
      return {
        format: 'clean_confirmed',
        isHardsub: false,
        isClean: true,
        isSoftsub: false,
        hasPtSubtitle: hasExternalPtSub,
        confidence: 0.9,
        details: 'Vídeo original limpo (sem legendas gravadas na imagem)'
      };
    }

    if (hasSoftsubKeyword && !hasHardsubPtBrKeyword) {
      return {
        format: 'softsub',
        isHardsub: false,
        isClean: false,
        isSoftsub: true,
        hasPtSubtitle: hasPtBrIndication || hasExternalPtSub,
        confidence: 0.85,
        details: 'Legendas internas selecionáveis (Softsub)'
      };
    }

    if (hasHardsubPtBrKeyword) {
      return {
        format: 'hardsub_ptbr',
        isHardsub: true,
        isClean: false,
        isSoftsub: false,
        language: 'pt-BR',
        hasPtSubtitle: true,
        confidence: 0.85,
        details: 'Legenda gravada na imagem em PT-BR (Hardsub)'
      };
    }

    if (/\b(hard[-_]?subs?|hardcoded|legendas?[-_\s]?(?:fixas?|embutidas?|gravadas?))\b/i.test(combined)) {
      return {
        format: 'unknown',
        isHardsub: true,
        isClean: false,
        isSoftsub: false,
        hasPtSubtitle: hasExternalPtSub,
        confidence: 0.5,
        details: 'Legenda gravada com idioma não confirmado'
      };
    }

    // Desconhecido
    return {
      format: 'unknown',
      isHardsub: false,
      isClean: false,
      isSoftsub: false,
      hasPtSubtitle: hasPtBrIndication || hasExternalPtSub,
      confidence: 0.5,
      details: 'Formato de legenda não identificado explicitamente nos metadados'
    };
  }
}

export const subtitlePreferenceService = new SubtitlePreferenceService();
