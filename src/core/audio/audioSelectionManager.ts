import { StremioStream } from '../stremio/stremioTypes';

export type AudioKind = 'hls-rendition' | 'embedded-track' | 'separate-source';

export interface AudioOption {
  id: string;                      // ex: 'hls-0', 'stream-pt-br', 'stream-ja'
  langCode: string;                // 'pt-BR' | 'ja' | 'en' | 'es' | 'ko' | 'fr' | 'de' | 'it' | 'other'
  label: string;                   // 'Português (Brasil)', 'Japonês', 'Inglês', 'Espanhol', etc.
  flag: string;                    // 🇧🇷, 🇯🇵, 🇺🇸, 🇪🇸, etc.
  badge: 'Original' | 'Dublado';
  kind: AudioKind;
  isCurrent: boolean;              // Indica se esta é a faixa EFETIVAMENTE ativa no player
  hlsTrackIndex?: number;          // Se kind === 'hls-rendition'
  streamIndex?: number;            // Se kind === 'separate-source'
  confidence: number;              // 0 a 1
  note?: string;
}

export interface AudioContextItem {
  id?: string;
  imdbId?: string;
  title: string;
  type?: string;
  genres?: string[];
  audioStatus?: string;
  description?: string;
  originalLanguage?: string;
}

export interface HlsAudioTrackItem {
  id: number;
  name: string;
  lang?: string;
}

export class AudioSelectionManager {
  /**
   * Normaliza estritamente códigos e nomes de idiomas sem falsos positivos.
   * Evita que preposições como 'en' ('en español') sejam reconhecidas como Inglês.
   */
  public normalizeLanguageCode(textOrLang: string): string {
    const raw = (textOrLang || '').trim().toLowerCase();
    if (!raw) return 'unknown';

    // 1. Português do Brasil
    if (
      /^(pt[-_]?br|por[-_]?br|pob|bra|brazuca|brazilian|nacional)$/i.test(raw) ||
      /\b(portugu[eê]s[-_]?br|dublado\s*pt[-_]?br|áudio\s*pt[-_]?br|audio\s*pt[-_]?br)\b/i.test(raw) ||
      (/^(pt|por|portugu[eê]s)$/i.test(raw) && !raw.includes('pt-pt'))
    ) {
      return 'pt-BR';
    }

    // 2. Português de Portugal
    if (/^(pt[-_]?pt|portugu[eê]s[-_]?pt|lusitano)$/i.test(raw) || /\bpt[-_]?pt\b/i.test(raw)) {
      return 'pt-PT';
    }

    // 3. Japonês
    if (
      /^(ja|jp|jpn|japanese|japon[eê]s)$/i.test(raw) ||
      /\b(japanese|japon[eê]s|áudio\s*japon[eê]s|audio\s*japones)\b/i.test(raw)
    ) {
      return 'ja';
    }

    // 4. Espanhol (VERIFICAR ANTES DE INGLÊS PARA EVITAR QUE 'en español' CAIA EM INGLÊS!)
    if (
      /^(es|esp|spa|spanish|espanhol|español|castellano|latino|audio[-_]?latino)$/i.test(raw) ||
      /\b(spanish|espanhol|español|castellano|áudio\s*latino|audio\s*latino|dublado\s*latino)\b/i.test(raw)
    ) {
      return 'es';
    }

    // 5. Inglês (somente códigos exatos ou palavras 'english'/'inglês', sem confundir com a preposição 'en')
    if (
      /^(en|eng|english|ingl[eê]s)$/i.test(raw) ||
      /\b(english|ingl[eê]s|audio\s*en|áudio\s*ingl[eê]s)\b/i.test(raw)
    ) {
      return 'en';
    }

    // 6. Coreano
    if (/^(ko|kor|korean|coreano)$/i.test(raw) || /\b(korean|coreano)\b/i.test(raw)) {
      return 'ko';
    }

    // 7. Francês
    if (/^(fr|fra|fre|french|franc[eê]s)$/i.test(raw) || /\b(french|franc[eê]s)\b/i.test(raw)) {
      return 'fr';
    }

    // 8. Alemão
    if (/^(de|ger|deu|german|alem[aã]o)$/i.test(raw) || /\b(german|alem[aã]o)\b/i.test(raw)) {
      return 'de';
    }

    // 9. Italiano
    if (/^(it|ita|italian|italiano)$/i.test(raw) || /\b(italian|italiano)\b/i.test(raw)) {
      return 'it';
    }

    return 'other';
  }

  /**
   * Retorna os metadados visuais (label, flag) para um idioma normalizado.
   */
  public getLanguageDisplay(langCode: string): { label: string; flag: string } {
    switch (langCode) {
      case 'pt-BR':
        return { label: 'Português (Brasil)', flag: '🇧🇷' };
      case 'pt-PT':
        return { label: 'Português (Portugal)', flag: '🇵🇹' };
      case 'ja':
        return { label: 'Japonês', flag: '🇯🇵' };
      case 'en':
        return { label: 'Inglês', flag: '🇺🇸' };
      case 'es':
        return { label: 'Espanhol', flag: '🇪🇸' };
      case 'ko':
        return { label: 'Coreano', flag: '🇰🇷' };
      case 'fr':
        return { label: 'Francês', flag: '🇫🇷' };
      case 'de':
        return { label: 'Alemão', flag: '🇩🇪' };
      case 'it':
        return { label: 'Italiano', flag: '🇮🇹' };
      default:
        return { label: 'Outro Idioma', flag: '🌐' };
    }
  }

  /**
   * Determina o idioma original principal de uma obra.
   */
  public detectOriginalLanguage(item: AudioContextItem): string {
    if (item.originalLanguage) {
      const norm = this.normalizeLanguageCode(item.originalLanguage);
      if (norm !== 'unknown' && norm !== 'other') return norm;
    }

    const isNational = item.audioStatus === 'pt-br-original' || 
                       (item.genres && item.genres.includes('Nacional'));
    if (isNational) return 'pt-BR';

    const isAnime = (item.type && item.type.toLowerCase() === 'anime') || 
                    (item.genres && item.genres.includes('Anime')) ||
                    /anime/i.test(item.description || '');
    if (isAnime) return 'ja';

    const isKorean = Boolean(item.genres && (item.genres.includes('Dorama') || item.genres.includes('K-Drama')));
    if (isKorean) return 'ko';

    const desc = (item.description || '').toLowerCase();
    if (/\b(espanhol|spanish|m[eé]xico|argentina|espanha)\b/i.test(desc) || item.genres?.includes('Espanhol')) {
      return 'es';
    }
    if (/\b(franc[eê]s|french|fran[cç]a)\b/i.test(desc) || item.genres?.includes('Francês')) {
      return 'fr';
    }

    return 'en';
  }

  /**
   * Analisa estritamente os metadados de um stream para determinar qual é o seu áudio real.
   * Não presume que qualquer anime seja japonês se a fonte não fornecer evidência ou for declarada em outro idioma.
   */
  public inspectStreamAudioLanguage(stream: StremioStream, originalLang: string): string {
    const name = (stream.name || '').trim();
    const title = (stream.title || '').trim();
    const desc = (stream.description || '').trim();
    const combined = `${name} ${title} ${desc}`.toLowerCase();

    // 1. Provedores 100% verificados como acervo dublado brasileiro
    const isBrazilianVerified = 
      stream.providerId === 'zapitv-verified' ||
      /zapitv verificado|cinema aberto|mico[-_]?le[aã]o|acervo zapitv/i.test(stream.providerName || '') ||
      /redecanais|comando|bludv|lapumia|wolverdon/i.test(combined);

    if (stream.isDubbed === true || isBrazilianVerified) {
      return 'pt-BR';
    }

    // 2. Tags explícitas de dublagem PT-BR
    if (
      /\b(dublado|dublada|dublados|audio\s*pt[-_]?br|áudio\s*pt[-_]?br|pt[-_]?br\s*dub|fhd[-_]?dub|hd[-_]?dub)\b/i.test(combined) ||
      /🇧🇷\s*dublado|\[dublado\]|\[dub\]/i.test(combined)
    ) {
      return 'pt-BR';
    }

    // 3. Espanhol / Latino explícito (verificado antes de inglês para não casar 'en espanol')
    if (
      /\b(audio\s*latino|áudio\s*latino|dublado\s*latino|en\s*español|en\s*espanhol|castellano|español|espanhol|latino)\b/i.test(combined) ||
      /🇲🇽|🇪🇸/i.test(combined)
    ) {
      return 'es';
    }

    // 4. Japonês explícito
    if (
      /\b(japanese|japon[eê]s|áudio\s*japon[eê]s|audio\s*japones)\b/i.test(combined) ||
      /🇯🇵/i.test(combined)
    ) {
      return 'ja';
    }

    // 5. Inglês explícito
    if (
      /\b(english\s*audio|áudio\s*ingl[eê]s|audio\s*ingles|dual[-_]?audio.*eng)\b/i.test(combined) ||
      /🇬🇧|🇺🇸/i.test(combined)
    ) {
      return 'en';
    }

    // 6. Se o stream indicar Dual Audio sem dizer o segundo idioma:
    if (/\b(dual[-_]?audio|dual[-_]?áudio|multi[-_]?audio)\b/i.test(combined)) {
      // Se tiver menção a PT-BR ou dublado, o áudio prioritário é PT-BR
      if (/pt[-_]?br|por|dub/i.test(combined)) {
        return 'pt-BR';
      }
    }

    // 7. Se for expressamente legendado ('legendado', 'softsub', 'sub') ou indicar áudio original:
    if (/\b(legendado|softsub|hardsub|sub\b|leg\b|original)\b/i.test(combined)) {
      return originalLang;
    }

    // 8. Se nada for conclusivo mas for PT-BR declarado no objeto
    if (stream.isPtBr === true && !stream.isSubtitled) {
      return 'pt-BR';
    }

    return 'unknown';
  }

  /**
   * Constrói a lista oficial de opções de áudio para o ZapiPlayer.
   * RESPEITA A REGRA DE OURO:
   * - Se for HLS com faixas no manifesto, gera opções para cada faixa real.
   * - Se forem streams separados, gera opções APENAS para os idiomas que comprovadamente
   *   possuem fontes web-ready e acessíveis no momento.
   * - O check azul (`isCurrent`) é ativado estritamente para o ID do áudio confirmado.
   */
  public buildAudioOptions(params: {
    item: AudioContextItem;
    streams: StremioStream[];
    hlsTracks: HlsAudioTrackItem[];
    currentStreamIndex: number;
    activeAudioId: string | null;
    selectedHlsTrackId?: number;
  }): AudioOption[] {
    const { item, streams, hlsTracks, currentStreamIndex, activeAudioId, selectedHlsTrackId } = params;
    const originalLang = this.detectOriginalLanguage(item);
    const optionsMap = new Map<string, AudioOption>();

    // CENÁRIO A: HLS com múltiplas faixas de áudio nativas no manifesto
    if (hlsTracks && hlsTracks.length > 1) {
      hlsTracks.forEach(track => {
        const normCode = this.normalizeLanguageCode(track.lang || track.name);
        const resolvedLang = normCode !== 'unknown' ? normCode : 'other';
        const display = this.getLanguageDisplay(resolvedLang);
        const isOriginal = resolvedLang === originalLang;
        const id = `hls-${track.id}`;

        const isCurrent = activeAudioId 
          ? activeAudioId === id 
          : (selectedHlsTrackId !== undefined ? selectedHlsTrackId === track.id : track.id === 0);

        optionsMap.set(id, {
          id,
          langCode: resolvedLang,
          label: track.name && !track.name.toLowerCase().startsWith('faixa') ? track.name : display.label,
          flag: display.flag,
          badge: isOriginal ? 'Original' : 'Dublado',
          kind: 'hls-rendition',
          isCurrent,
          hlsTrackIndex: track.id,
          confidence: 1.0
        });
      });

      return Array.from(optionsMap.values());
    }

    // CENÁRIO B: Streams separados (áudio dependente de trocar a fonte de vídeo)
    // Filtra apenas streams web-ready (rejeita torrents sem engine direto)
    const webReadyStreamsWithIndices: Array<{ stream: StremioStream; index: number }> = [];

    (streams || []).forEach((st, idx) => {
      // Rejeita streams marcados expressamente como notWebReady ou URLs torrent sem streaming HTTP
      const isNotWeb = st.behaviorHints?.notWebReady === true;
      const isTorrentUrl = st.url?.startsWith('magnet:') || (!st.url && (st as any).infoHash);
      if (!isNotWeb && !isTorrentUrl && st.url) {
        webReadyStreamsWithIndices.push({ stream: st, index: idx });
      }
    });

    // Mapeia idiomas comprovados presentes nas fontes web-ready
    const foundLanguages = new Map<string, { streamIndex: number; stream: StremioStream; isOriginal: boolean }>();

    for (const itemStream of webReadyStreamsWithIndices) {
      const detectedLang = this.inspectStreamAudioLanguage(itemStream.stream, originalLang);
      if (detectedLang !== 'unknown' && !foundLanguages.has(detectedLang)) {
        foundLanguages.set(detectedLang, {
          streamIndex: itemStream.index,
          stream: itemStream.stream,
          isOriginal: detectedLang === originalLang
        });
      }
    }

    // Se o stream atual não foi mapeado (ex: metadados genéricos), preserva sua existência como áudio atual
    const currentStream = streams && streams[currentStreamIndex];
    if (currentStream && !Array.from(foundLanguages.values()).some(f => f.streamIndex === currentStreamIndex)) {
      const curLang = this.inspectStreamAudioLanguage(currentStream, originalLang);
      const fallbackLang = curLang !== 'unknown' ? curLang : originalLang;
      if (!foundLanguages.has(fallbackLang)) {
        foundLanguages.set(fallbackLang, {
          streamIndex: currentStreamIndex,
          stream: currentStream,
          isOriginal: fallbackLang === originalLang
        });
      }
    }

    // Monta as opções concretas
    foundLanguages.forEach((data, langCode) => {
      const display = this.getLanguageDisplay(langCode);
      const optId = `stream-${langCode}`;
      
      const isCurrent = activeAudioId
        ? activeAudioId.toLowerCase() === optId.toLowerCase()
        : currentStreamIndex === data.streamIndex;

      optionsMap.set(optId, {
        id: optId,
        langCode,
        label: display.label,
        flag: display.flag,
        badge: data.isOriginal ? 'Original' : 'Dublado',
        kind: 'separate-source',
        isCurrent,
        streamIndex: data.streamIndex,
        confidence: 0.95
      });
    });

    // Se nenhuma fonte pôde ser classificada com precisão, fornece a opção do áudio atual
    if (optionsMap.size === 0 && currentStream) {
      const display = this.getLanguageDisplay(originalLang);
      optionsMap.set('stream-default', {
        id: 'stream-default',
        langCode: originalLang,
        label: display.label,
        flag: display.flag,
        badge: 'Original',
        kind: 'separate-source',
        isCurrent: true,
        streamIndex: currentStreamIndex,
        confidence: 0.8
      });
    }

    const list = Array.from(optionsMap.values());

    // Se nenhuma opção estiver marcada como current, e não havia activeAudioId explícito, usa currentStreamIndex
    const hasCurrent = list.some(o => o.isCurrent);
    if (!hasCurrent && list.length > 0) {
      const matchCurrent = list.find(o => o.streamIndex === currentStreamIndex);
      if (matchCurrent) {
        matchCurrent.isCurrent = true;
      } else if (!activeAudioId) {
        list[0].isCurrent = true;
      }
    }

    return list;
  }
}

export const audioSelectionManager = new AudioSelectionManager();
