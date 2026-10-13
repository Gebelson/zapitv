import { LiveChannel, LiveChannelCategory, LiveStreamSource, RawChannelInput } from './types';

export class ChannelNormalizer {
  private static instance: ChannelNormalizer;

  public static getInstance(): ChannelNormalizer {
    if (!ChannelNormalizer.instance) {
      ChannelNormalizer.instance = new ChannelNormalizer();
    }
    return ChannelNormalizer.instance;
  }

  /**
   * Converte uma string bruta de categoria em LiveChannelCategory canônica
   */
  public normalizeCategory(rawCat?: string): { category: LiveChannelCategory; categoryLabel: string } {
    if (!rawCat) return { category: 'aberta', categoryLabel: 'TV Aberta' };

    const c = rawCat.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    if (c.includes('favorit')) return { category: 'favoritos', categoryLabel: 'Favoritos' };
    if (c.includes('esport') || c.includes('futebol') || c.includes('sports')) return { category: 'esportes', categoryLabel: 'Esportes' };
    if (c.includes('notic') || c.includes('news') || c.includes('jornal')) return { category: 'noticias', categoryLabel: 'Notícias' };
    if (c.includes('infantil') || c.includes('kid') || c.includes('animac') || c.includes('desenho')) return { category: 'infantil', categoryLabel: 'Infantil' };
    if (c.includes('filme') || c.includes('serie') || c.includes('cine') || c.includes('movie')) return { category: 'filmes_series', categoryLabel: 'Filmes & Séries' };
    if (c.includes('cultur') || c.includes('arte')) return { category: 'cultura', categoryLabel: 'Cultura' };
    if (c.includes('educa') || c.includes('ensino')) return { category: 'educacao', categoryLabel: 'Educação' };
    if (c.includes('music') || c.includes('clip') || c.includes('show')) return { category: 'musica', categoryLabel: 'Música' };
    if (c.includes('region') || c.includes('estado') || c.includes('local') || c.includes('sp') || c.includes('rj') || c.includes('go')) return { category: 'regionais', categoryLabel: 'Regionais' };
    if (c.includes('doc') || c.includes('histori') || c.includes('naturez')) return { category: 'documentarios', categoryLabel: 'Documentários' };

    return { category: 'aberta', categoryLabel: 'TV Aberta' };
  }

  /**
   * Gera um slug canônico estável para deduplicação
   */
  public generateCanonicalSlug(name: string, tvgId?: string): string {
    if (tvgId) {
      const cleanTvg = tvgId.toLowerCase().replace(/\.br$/, '').replace(/[^a-z0-9]+/g, '-');
      if (cleanTvg.length > 2) return cleanTvg;
    }

    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Converte uma lista de RawChannelInput (de vários provedores) em LiveChannel[] únicos e deduplicados
   */
  public normalizeAndDeduplicate(rawList: RawChannelInput[]): LiveChannel[] {
    const channelMap = new Map<string, LiveChannel>();

    for (const raw of rawList) {
      if (!raw.name) continue;

      const canonicalId = raw.id || this.generateCanonicalSlug(raw.name, raw.tvgId);
      const { category, categoryLabel } = this.normalizeCategory(raw.category || raw.groupTitle);

      const streamSource: LiveStreamSource = {
        id: `${canonicalId}-${raw.provider.replace(/\s+/g, '-').toLowerCase()}-${Math.random().toString(36).substring(2, 6)}`,
        url: raw.url,
        quality: raw.quality || '720p',
        provider: raw.provider,
        format: raw.url.includes('.mpd') ? 'dash' : 'hls',
        isOfficial: raw.isOfficial || false,
        resolutionHeight: this.parseQualityNumber(raw.quality)
      };

      if (!channelMap.has(canonicalId)) {
        // Primeiro registro deste canal canônico
        const newChannel: LiveChannel = {
          id: canonicalId,
          canonicalId: canonicalId,
          name: this.cleanChannelName(raw.name),
          shortName: this.extractShortName(raw.name),
          description: raw.description || `Transmissão ao vivo de ${raw.name}.`,
          logo: raw.tvgLogo || this.getDefaultLogoForChannel(canonicalId),
          fallbackLogo: this.getDefaultLogoForChannel(canonicalId),
          category: category,
          categoryLabel: categoryLabel,
          streamUrl: raw.url,
          sources: [streamSource],
          backupStreamUrls: [],
          epgId: raw.tvgId || `${canonicalId}.br`,
          quality: raw.quality || '1080p',
          isHd: (raw.quality || '').includes('1080') || (raw.quality || '').includes('720'),
          isOfficial: raw.isOfficial || false,
          requiresExternalAccess: raw.requiresExternalAccess || false,
          externalAccessUrl: raw.externalAccessUrl,
          externalProviderName: raw.externalProviderName,
          status: raw.requiresExternalAccess ? 'AVAILABLE' : (raw.url ? 'AVAILABLE' : 'UNAVAILABLE')
        };
        channelMap.set(canonicalId, newChannel);
      } else {
        // Canal já existe: mesclar e deduplicar streams
        const existing = channelMap.get(canonicalId)!;

        // Se o novo registro tiver logo melhor e o atual for genérico
        if (raw.tvgLogo && !existing.logo.includes('wikimedia') && raw.tvgLogo.includes('wikimedia')) {
          existing.logo = raw.tvgLogo;
        }

        // Se tiver descrição melhor
        if (raw.description && (!existing.description || existing.description.length < raw.description.length)) {
          existing.description = raw.description;
        }

        // Adicionar novo stream caso seja uma URL distinta
        if (raw.url && !existing.sources?.some(s => s.url === raw.url)) {
          existing.sources = existing.sources || [];
          existing.sources.push(streamSource);

          // Reordenar sources por resolução (1080p > 720p > 480p)
          existing.sources.sort((a, b) => (b.resolutionHeight || 720) - (a.resolutionHeight || 720));

          // Atualizar streamUrl principal para o de maior resolução
          existing.streamUrl = existing.sources[0].url;
          existing.backupStreamUrls = existing.sources.slice(1).map(s => s.url);
          existing.quality = existing.sources[0].quality;
        }
      }
    }

    return Array.from(channelMap.values());
  }

  private parseQualityNumber(q?: string): number {
    if (!q) return 720;
    if (q.includes('4k') || q.includes('2160')) return 2160;
    if (q.includes('1080')) return 1080;
    if (q.includes('720')) return 720;
    if (q.includes('480')) return 480;
    return 720;
  }

  private cleanChannelName(rawName: string): string {
    return rawName
      .replace(/\[.*?\]/g, '')
      .replace(/\(FHD\)|\(HD\)|\(SD\)|\(1080p\)|\(720p\)/gi, '')
      .replace(/\|\s*BR\s*\|/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractShortName(rawName: string): string {
    const clean = this.cleanChannelName(rawName);
    const parts = clean.split(' ');
    if (parts.length > 2) {
      return parts.slice(0, 2).join(' ');
    }
    return clean;
  }

  private getDefaultLogoForChannel(id: string): string {
    const logos: Record<string, string> = {
      'tv-brasil': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Logotipo_da_TV_Brasil.svg/512px-Logotipo_da_TV_Brasil.svg.png',
      'tv-cultura': 'https://upload.wikimedia.org/wikipedia/commons/8/82/Cultura_logo_2013.svg',
      'record-news': 'https://upload.wikimedia.org/wikipedia/commons/4/46/Record_News_logo_2023.svg',
      'tv-camara': 'https://i.imgur.com/UpV2PRk.png',
      'tv-senado': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/TV_Senado_logo.svg/512px-TV_Senado_logo.svg.png',
      'tv-justica': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/TV_Justi%C3%A7a_logo.svg/512px-TV_Justi%C3%A7a_logo.svg.png',
      'rede-brasil': 'https://upload.wikimedia.org/wikipedia/commons/d/d1/Marca_rede_brasil_rgb-color.png',
      'tv-aparecida': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/TV_Aparecida_logo_2015.svg/512px-TV_Aparecida_logo_2015.svg.png',
      'rede-vida': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Rede_Vida_logo_2016.svg/512px-Rede_Vida_logo_2016.svg.png',
      'canal-futura': 'https://upload.wikimedia.org/wikipedia/commons/c/ce/Canal_Futura_2022.svg',
      'tv-gazeta': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/TV_Gazeta_logo_2016.svg/512px-TV_Gazeta_logo_2016.svg.png',
      'sbt': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/SBT_logo.svg/512px-SBT_logo.svg.png',
      'band': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Band_logo_2018.svg/512px-Band_logo_2018.svg.png',
      'redetv': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/RedeTV%21_logo_2019.svg/512px-RedeTV%21_logo_2019.svg.png'
    };

    return logos[id] || 'https://i.imgur.com/UpV2PRk.png';
  }
}

export const channelNormalizer = ChannelNormalizer.getInstance();
