import { LiveChannel, LiveChannelCategory, LiveStreamSource, RawChannelInput, ChannelHealthStatus } from './types';
import { liveStreamValidator } from './LiveStreamValidator';

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
    if (c.includes('infantil') || c.includes('kid') || c.includes('animac') || c.includes('desenho') || c.includes('anime')) return { category: 'infantil', categoryLabel: 'Infantil' };
    if (c.includes('filme') || c.includes('serie') || c.includes('cine') || c.includes('movie') || c.includes('comedy')) return { category: 'filmes_series', categoryLabel: 'Filmes & Séries' };
    if (c.includes('cultur') || c.includes('arte')) return { category: 'cultura', categoryLabel: 'Cultura' };
    if (c.includes('educa') || c.includes('ensino')) return { category: 'educacao', categoryLabel: 'Educação' };
    if (c.includes('music') || c.includes('clip') || c.includes('show')) return { category: 'musica', categoryLabel: 'Música' };
    if (c.includes('region') || c.includes('estado') || c.includes('local') || c.includes('legislative')) return { category: 'regionais', categoryLabel: 'Regionais' };
    if (c.includes('doc') || c.includes('histori') || c.includes('naturez')) return { category: 'documentarios', categoryLabel: 'Documentários' };

    return { category: 'aberta', categoryLabel: 'TV Aberta' };
  }

  /**
   * Gera um slug canônico estável para deduplicação
   */
  public generateCanonicalSlug(name: string, tvgId?: string): string {
    if (tvgId) {
      const cleanTvg = tvgId
        .toLowerCase()
        .replace(/\.br(@[a-z0-9]+)?$/i, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      if (cleanTvg.length >= 3) return cleanTvg;
    }

    let clean = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s*\(\d+p\)/gi, '')
      .replace(/\s*\[.*?\]/g, '')
      .replace(/\s*\(Brazil\)/gi, '')
      .replace(/\s*\(Brasil\)/gi, '')
      .trim();

    if (clean !== 'tv brasil' && clean !== 'brasil' && clean.endsWith(' brasil')) {
      clean = clean.replace(/\s+brasil$/i, '').trim();
    } else if (clean !== 'tv brazil' && clean !== 'brazil' && clean.endsWith(' brazil')) {
      clean = clean.replace(/\s+brazil$/i, '').trim();
    }

    return clean
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Converte uma lista de RawChannelInput em LiveChannel[] únicos e deduplicados
   */
  public normalizeAndDeduplicate(rawList: RawChannelInput[]): LiveChannel[] {
    const channelMap = new Map<string, LiveChannel>();

    for (const raw of rawList) {
      if (!raw.name) continue;

      const canonicalId = raw.id || this.generateCanonicalSlug(raw.name, raw.tvgId);
      const { category, categoryLabel } = this.normalizeCategory(raw.category || raw.groupTitle);

      const isExternal = Boolean(raw.requiresExternalAccess);
      const url = raw.url ? raw.url.trim() : '';

      // Se for domínio estacionado inválido e tiver URL, ignore este stream
      if (url && liveStreamValidator.isParkedDomain(url)) {
        continue;
      }

      const streamSource: LiveStreamSource | null = url ? {
        id: `${canonicalId}-${raw.provider.replace(/\s+/g, '-').toLowerCase()}-${Math.random().toString(36).substring(2, 6)}`,
        url: url,
        quality: raw.quality || this.detectQuality(raw.name) || '720p',
        provider: raw.provider,
        format: url.includes('.mpd') ? 'dash' : 'hls',
        isOfficial: raw.isOfficial || false,
        resolutionHeight: this.parseQualityNumber(raw.quality || this.detectQuality(raw.name))
      } : null;

      if (!channelMap.has(canonicalId)) {
        // Primeiro registro deste canal canônico
        const sources: LiveStreamSource[] = [];
        if (streamSource) {
          sources.push(streamSource);
        }
        if (raw.sources && Array.isArray(raw.sources)) {
          for (const s of raw.sources) {
            if (s.url && !sources.some(existing => existing.url === s.url)) {
              sources.push(s);
            }
          }
        }
        if (raw.backupStreamUrls && Array.isArray(raw.backupStreamUrls)) {
          for (let i = 0; i < raw.backupStreamUrls.length; i++) {
            const bUrl = raw.backupStreamUrls[i];
            if (bUrl && !sources.some(existing => existing.url === bUrl)) {
              sources.push({
                id: `${canonicalId}-backup-${i}`,
                url: bUrl,
                quality: '720p',
                provider: raw.provider || 'Backup',
                format: bUrl.includes('.mpd') ? 'dash' : 'hls',
                isOfficial: raw.isOfficial || false,
                isBackup: true,
                resolutionHeight: 720
              });
            }
          }
        }

        let initialStatus: ChannelHealthStatus;
        if (isExternal) {
          initialStatus = 'EXTERNAL_ACCESS';
        } else if (sources.length === 0) {
          initialStatus = 'UNAVAILABLE';
        } else {
          // Consulta cache de saúde prévio se houver
          const cached = sources[0]?.url ? liveStreamValidator.getCachedStatus(sources[0].url) : null;
          initialStatus = cached || 'CHECKING';
        }

        const newChannel: LiveChannel = {
          id: canonicalId,
          canonicalId: canonicalId,
          name: this.cleanChannelName(raw.name),
          shortName: this.extractShortName(raw.name),
          description: raw.description || `Transmissão ao vivo de ${this.cleanChannelName(raw.name)}.`,
          logo: raw.tvgLogo || this.getDefaultLogoForChannel(canonicalId),
          fallbackLogo: this.getDefaultLogoForChannel(canonicalId),
          category: category,
          categoryLabel: categoryLabel,
          streamUrl: sources[0]?.url || '',
          sources: sources,
          backupStreamUrls: sources.slice(1).map(s => s.url),
          accessType: isExternal ? 'external' : 'internal',
          epgId: raw.tvgId || `${canonicalId}.br`,
          quality: sources[0]?.quality || raw.quality || '720p',
          isHd: (sources[0]?.quality || raw.quality || '').includes('1080') || (sources[0]?.quality || raw.quality || '').includes('720'),
          isOfficial: raw.isOfficial || false,
          requiresExternalAccess: isExternal,
          externalAccessUrl: raw.externalAccessUrl,
          externalProviderName: raw.externalProviderName,
          status: initialStatus,
          isEnabled: true,
          country: raw.country || 'BR',
          region: raw.region
        };
        channelMap.set(canonicalId, newChannel);
      } else {
        // Canal já existe: mesclar fontes preservando dados canônicos
        const existing = channelMap.get(canonicalId)!;

        // Se o novo registro tiver logo oficial e o atual for genérico
        if (raw.tvgLogo && (raw.tvgLogo.includes('wikimedia') || !existing.logo)) {
          existing.logo = raw.tvgLogo;
        }

        // Se tiver descrição melhor
        if (raw.description && (!existing.description || existing.description.length < raw.description.length)) {
          existing.description = raw.description;
        }

        // Adicionar novo stream caso seja uma URL distinta
        if (streamSource && !existing.sources?.some(s => s.url === streamSource.url)) {
          existing.sources = existing.sources || [];
          existing.sources.push(streamSource);

          // Ordenação: 1º isOfficial, 2º maior resolução
          existing.sources.sort((a, b) => {
            if (a.isOfficial && !b.isOfficial) return -1;
            if (!a.isOfficial && b.isOfficial) return 1;
            return (b.resolutionHeight || 720) - (a.resolutionHeight || 720);
          });

          // Atualizar stream principal e backups
          if (!existing.streamUrl) {
            existing.streamUrl = existing.sources[0].url;
            existing.quality = existing.sources[0].quality;
          }
          existing.backupStreamUrls = existing.sources.slice(1).map(s => s.url);
          if (existing.status === 'UNAVAILABLE' && existing.sources.length > 0) {
            const cached = liveStreamValidator.getCachedStatus(existing.sources[0].url);
            existing.status = cached || 'CHECKING';
          }
        }
      }
    }

    return Array.from(channelMap.values());
  }

  private detectQuality(name: string): string | undefined {
    if (name.includes('1080p') || name.includes('Full HD')) return '1080p';
    if (name.includes('720p') || name.includes('HD')) return '720p';
    if (name.includes('480p') || name.includes('SD')) return '480p';
    return undefined;
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
      .replace(/\s*\(\d+p\)/gi, '')
      .replace(/\s*\[.*?\]/g, '')
      .replace(/\s*\(Brazil\)/gi, '')
      .replace(/\s*\(SD\)/gi, '')
      .replace(/\s*\(HD\)/gi, '')
      .trim();
  }

  private extractShortName(rawName: string): string {
    const cleaned = this.cleanChannelName(rawName);
    return cleaned.split('(')[0].split('-')[0].trim();
  }

  private getDefaultLogoForChannel(id: string): string {
    return `https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=400&auto=format&fit=crop&q=80`;
  }
}

export const channelNormalizer = ChannelNormalizer.getInstance();
