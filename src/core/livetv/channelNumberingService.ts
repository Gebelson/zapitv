/**
 * ZapiTV — Serviço de Numeração Permanente de Canais (Estilo TV por Assinatura)
 *
 * Atribui e persiste números determinísticos e únicos (001, 002, 010, etc.)
 * para todos os canais ao vivo, preservando a identidade canônica mesmo após
 * reinicializações e atualizações de catálogo.
 */

import { LiveChannel } from './types';

const STORAGE_KEY_NUMBERING = 'zapitv_channel_numbers_map_v2';

export const DEFAULT_CANONICAL_CHANNEL_NUMBERS: Record<string, number> = {
  // Abertas / Públicas (001 - 009)
  'tv-brasil': 1,
  'tv-cultura': 2,
  'rede-brasil': 3,
  'sbt-news': 4,
  'pluto-tv-canal-uol': 5,
  'bmc-news': 6,

  // Esportes (010 - 019)
  'caze-tv': 10,
  'band-sports': 11,
  'pluto-tv-esportes': 12,
  'red-bull-tv-br': 13,

  // Filmes (020 - 029)
  'pluto-tv-cine-sucessos': 20,
  'pluto-tv-filmes-acao': 21,
  'pluto-tv-cine-classicos': 22,
  'pluto-tv-cine-comedia': 23,
  'pluto-tv-filmes-nacionais': 24,

  // Séries & Comédia (030 - 039)
  'csi-miami-br': 30,
  'south-park-br': 31,
  'star-trek-br': 32,
  'comedy-central-pluto': 33,
  'adrenalina-pura': 34,

  // Animes & Geek (040 - 049)
  'naruto-dublado': 40,
  'one-piece-dublado': 41,
  'pluto-tv-anime': 42,
  'pluto-tv-geek': 43,
  'pluto-tv-gamer': 44,

  // Infantil & Animações (050 - 059)
  'turma-da-monica': 50,
  'nickelodeon-classico': 51,
  'nickelodeon-toons': 52,
  'nick-jr-club': 53,
  'icarly-br': 54,
  'kenan-and-kel': 55,
  'desenhos-classicos': 56,

  // Música & Entretenimento (060 - 069)
  'mtv-biggest-pop': 60,
  'mtv-classic-br': 61,
  'mtv-pluto-tv': 62,

  // Culinária & Documentários (070 - 079)
  'tastemade-brasil': 70,
  'masterchef-brasil': 71,
  'smithsonian-channel': 72,
  'pluto-tv-natureza': 73,

  // Canais Institucionais / Regionais (080 - 099)
  'tv-senado': 80,
  'tv-camara': 81,
  'tv-justica': 82,
  'tv-brasil-central': 83,
  'conecta-mais-tv': 84,
  'eutv-regional': 85
};

export class ChannelNumberingService {
  private static instance: ChannelNumberingService;
  private channelNumberMap = new Map<string, number>();
  private numberChannelMap = new Map<number, string>();
  private isClient = typeof window !== 'undefined';

  public static getInstance(): ChannelNumberingService {
    if (!ChannelNumberingService.instance) {
      ChannelNumberingService.instance = new ChannelNumberingService();
    }
    return ChannelNumberingService.instance;
  }

  private constructor() {
    this.initializeMappings();
  }

  private initializeMappings(): void {
    // 1. Carrega mapeamentos pré-definidos canônicos
    for (const [id, num] of Object.entries(DEFAULT_CANONICAL_CHANNEL_NUMBERS)) {
      this.channelNumberMap.set(id, num);
      this.numberChannelMap.set(num, id);
    }

    // 2. Re-hidrata personalizações salvas no localStorage
    if (this.isClient) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_NUMBERING);
        if (saved) {
          const parsed: Record<string, number> = JSON.parse(saved);
          for (const [id, num] of Object.entries(parsed)) {
            if (typeof num === 'number' && num > 0) {
              this.channelNumberMap.set(id, num);
              this.numberChannelMap.set(num, id);
            }
          }
        }
      } catch {}
    }
  }

  private persistMappings(): void {
    if (!this.isClient) return;
    try {
      const obj: Record<string, number> = {};
      this.channelNumberMap.forEach((num, id) => {
        obj[id] = num;
      });
      localStorage.setItem(STORAGE_KEY_NUMBERING, JSON.stringify(obj));
    } catch {}
  }

  /**
   * Obtém o identificador canônico de um canal
   */
  public getCanonicalKey(channel: LiveChannel | string): string {
    if (typeof channel === 'string') return channel;
    return channel.canonicalId || channel.id;
  }

  /**
   * Obtém o número permanente do canal.
   * Se ainda não possuir número, aloca o próximo inteiro vago determinísticamente.
   */
  public getNumber(channel: LiveChannel | string): number {
    const key = this.getCanonicalKey(channel);
    const existing = this.channelNumberMap.get(key);
    if (existing !== undefined) return existing;

    // Aloca próximo número disponível a partir de 100 para canais dinâmicos/novos
    let candidate = 100;
    while (this.numberChannelMap.has(candidate)) {
      candidate++;
    }

    this.channelNumberMap.set(key, candidate);
    this.numberChannelMap.set(candidate, key);
    this.persistMappings();
    return candidate;
  }

  /**
   * Retorna o número formatado no estilo de TV fechada (ex: "001", "012", "125")
   */
  public getFormattedNumber(channel: LiveChannel | string): string {
    const num = this.getNumber(channel);
    return String(num).padStart(3, '0');
  }

  /**
   * Localiza o canal pelo seu número de discagem
   */
  public getChannelByNumber(num: number, availableChannels: LiveChannel[]): LiveChannel | undefined {
    // 1. Tenta correspondência direta pelos canais fornecidos que já têm o número computado
    const match = availableChannels.find(c => this.getNumber(c) === num);
    if (match) return match;

    // 2. Busca pelo ID mapeado
    const channelId = this.numberChannelMap.get(num);
    if (!channelId) return undefined;

    return availableChannels.find(c => c.id === channelId || c.canonicalId === channelId);
  }

  /**
   * Anota a propriedade `number` em cada canal e ordena a lista por número crescente
   */
  public annotateAndSortChannels(channels: LiveChannel[]): LiveChannel[] {
    const annotated = channels.map(c => ({
      ...c,
      number: this.getNumber(c)
    }));

    return annotated.sort((a, b) => (a.number || 0) - (b.number || 0));
  }
}

export const channelNumberingService = ChannelNumberingService.getInstance();
