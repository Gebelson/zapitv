import { ContentItem } from '../../../types';

export interface OfficialPlatform {
  id: string;
  name: string;
  url: string;
  badge?: string;
  category: 'c-drama' | 'k-drama' | 'anime' | 'global' | 'official';
  isDirectLink?: boolean;
}

export class OfficialPlatformsService {
  /**
   * Identifica plataformas oficiais de streaming e transmissão para uma obra.
   * REGRA OBRIGATÓRIA: NUNCA gera recomendações baseadas apenas em gêneros genéricos como Drama e Romance.
   */
  public getOfficialPlatforms(item: Partial<ContentItem> & { alternateTitles?: string[] }): OfficialPlatform[] {
    const platforms: OfficialPlatform[] = [];
    const title = (item.title || item.originalTitle || '').trim();
    if (!title) return platforms;

    const encodedTitle = encodeURIComponent(title);
    const originalTitle = item.originalTitle || '';

    // Apenas reconhece produção asiática se houver caracteres nativos asiáticos ou rede transmissora declarada.
    // NUNCA classifica como drama asiático baseado apenas nos gêneros genéricos "Drama" ou "Romance".
    const isAsianDrama = Boolean(
      /[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/.test(originalTitle) ||
      item.networks?.some(n => /iqiyi|tencent|wetv|youku|mango/i.test(n.name || ''))
    );

    // 1. Link oficial direto se disponível na propriedade homepage
    if (item.homepage && /^https?:\/\//i.test(item.homepage)) {
      const hp = item.homepage;
      let platformName = 'Site Oficial da Produção';
      let category: OfficialPlatform['category'] = 'official';

      if (/iqiyi\.com/i.test(hp)) {
        platformName = 'iQIYI Oficial';
        category = 'c-drama';
      } else if (/wetv\.vip|v\.qq\.com/i.test(hp)) {
        platformName = 'Tencent Video / WeTV Oficial';
        category = 'c-drama';
      } else if (/viki\.com/i.test(hp)) {
        platformName = 'Rakuten Viki Oficial';
        category = 'c-drama';
      } else if (/netflix\.com/i.test(hp)) {
        platformName = 'Netflix Oficial';
        category = 'global';
      } else if (/crunchyroll\.com/i.test(hp)) {
        platformName = 'Crunchyroll Oficial';
        category = 'anime';
      }

      platforms.push({
        id: 'official-homepage',
        name: platformName,
        url: hp,
        badge: 'Link Direto',
        category,
        isDirectLink: true
      });
    }

    // 2. Plataformas identificadas via redes/produtoras oficiais (TMDB networks)
    if (Array.isArray(item.networks)) {
      for (const net of item.networks) {
        const netName = (net.name || '').toLowerCase();
        if (netName.includes('iqiyi') && !platforms.some(p => p.id === 'iqiyi')) {
          platforms.push({
            id: 'iqiyi',
            name: 'iQIYI',
            url: `https://www.iqiyi.com/search/${encodedTitle}`,
            badge: 'Transmissora Original',
            category: 'c-drama'
          });
        }
        if ((netName.includes('tencent') || netName.includes('wetv')) && !platforms.some(p => p.id === 'wetv')) {
          platforms.push({
            id: 'wetv',
            name: 'WeTV / Tencent Video',
            url: `https://wetv.vip/search?q=${encodedTitle}`,
            badge: 'Transmissora Original',
            category: 'c-drama'
          });
        }
      }
    }

    // 3. Plataformas oficiais canônicas para C-Dramas e produções asiáticas com comprovação
    if (isAsianDrama) {
      if (!platforms.some(p => p.id === 'iqiyi')) {
        platforms.push({
          id: 'iqiyi',
          name: 'iQIYI',
          url: `https://www.iqiyi.com/search/${encodedTitle}`,
          badge: 'Streaming Oficial',
          category: 'c-drama'
        });
      }
      if (!platforms.some(p => p.id === 'wetv')) {
        platforms.push({
          id: 'wetv',
          name: 'WeTV (Tencent)',
          url: `https://wetv.vip/search?q=${encodedTitle}`,
          badge: 'Streaming Oficial',
          category: 'c-drama'
        });
      }
      if (!platforms.some(p => p.id === 'viki')) {
        platforms.push({
          id: 'viki',
          name: 'Rakuten Viki',
          url: `https://www.viki.com/search?q=${encodedTitle}`,
          badge: 'Legendas Oficiais',
          category: 'c-drama'
        });
      }
      if (!platforms.some(p => p.id === 'youtube-c-drama')) {
        platforms.push({
          id: 'youtube-c-drama',
          name: 'YouTube Oficial',
          url: `https://www.youtube.com/results?search_query=${encodedTitle}+official+ep+1`,
          badge: 'Canal Oficial C-Drama',
          category: 'c-drama'
        });
      }
    }

    return platforms;
  }
}

export const officialPlatformsService = new OfficialPlatformsService();
