/**
 * ZapiTV — AnimeEditorialService
 * Organização e curadoria editorial da página Animes inspirada na Crunchyroll Brasil.
 * Cruza listas editoriais públicas com o catálogo elegível da ZapiTV.
 */

import { ContentItem, ContentType } from '../../../types';
import { catalogEligibilityService } from '../catalog/CatalogEligibilityService';
import { searchService } from '../search/searchService';
import { aniListClient } from '../anilist/aniListClient';

export interface AnimeEditorialCategory {
  id: string;
  title: string;
  items: ContentItem[];
}

interface CuratedTitle {
  canonicalName: string;
  aliases: string[];
  aniListId?: number;
  tmdbId?: string;
  minYear?: number;
  maxYear?: number;
}

// Chave isolada de persistência local para curadoria de animes
const STORAGE_KEY = 'zapitv_anime_editorial_v1';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Catálogo editorial de referência baseado nas listas públicas e categorias da Crunchyroll Brasil
const EDITORIAL_SEEDS: Record<string, { title: string; titles: CuratedTitle[] }> = {
  simulcasts: {
    title: 'Simulcasts da Temporada',
    titles: [
      { canonicalName: 'Solo Leveling', aliases: ['ore dake level up na ken', 'solo leveling: reawakening'], aniListId: 151807 },
      { canonicalName: 'Dandadan', aliases: ['dan da dan'], aniListId: 171018 },
      { canonicalName: 'Bleach: Thousand-Year Blood War', aliases: ['bleach: sennen kessen-hen', 'bleach tybw'], aniListId: 116674 },
      { canonicalName: 'Re:Zero - Starting Life in Another World', aliases: ['re:zero kara hajimeru isekai seikatsu', 're:zero'], aniListId: 163134 },
      { canonicalName: 'Blue Lock', aliases: ['blue lock vs u-20', 'blue lock 2nd season'], aniListId: 163148 },
      { canonicalName: 'Ranma 1/2', aliases: ['ranma 1/2 (2024)', 'ranma 1/2 remake'], minYear: 2024 },
      { canonicalName: 'Sakamoto Days', aliases: ['sakamoto days'], aniListId: 177708 },
      { canonicalName: 'Kaiju No. 8', aliases: ['kaijuu 8-gou', 'kaiju no 8'], aniListId: 153288 },
      { canonicalName: 'Frieren: Beyond Journey\'s End', aliases: ['sousou no frieren', 'frieren e a jornada para o além', 'frieren'], aniListId: 154587 },
      { canonicalName: 'Demon Slayer: Kimetsu no Yaiba', aliases: ['kimetsu no yaiba', 'demon slayer: hashira training arc'], aniListId: 166240 },
      { canonicalName: 'Tower of God', aliases: ['kami no tou', 'tower of god season 2'], aniListId: 153406 },
      { canonicalName: 'Wind Breaker', aliases: ['wind breaker'], aniListId: 163270 },
      { canonicalName: 'Shangri-La Frontier', aliases: ['shangri-la frontier: kusoge hunter'], aniListId: 151970 },
      { canonicalName: 'Oshi no Ko', aliases: ['oshi no ko season 2', '【oshi no ko】'], aniListId: 166531 },
      { canonicalName: 'The Apothecary Diaries', aliases: ['kusuriya no hitorigoto', 'diários de uma apotecária'], aniListId: 161645 },
      { canonicalName: 'Clevatess', aliases: ['clevatess: majuu no ou to itsuwari no yuusha denshou'] }
    ]
  },
  popular: {
    title: 'Animes Mais Populares',
    titles: [
      { canonicalName: 'Jujutsu Kaisen', aliases: ['batalha de feiticeiros', 'jujutsu kaisen 0'], aniListId: 113415 },
      { canonicalName: 'Demon Slayer: Kimetsu no Yaiba', aliases: ['kimetsu no yaiba', 'demon slayer'], aniListId: 101922 },
      { canonicalName: 'Attack on Titan', aliases: ['shingeki no kyojin', 'ataque dos titãs'], aniListId: 16498 },
      { canonicalName: 'One Piece', aliases: ['one piece film: red', 'one piece br'], aniListId: 21 },
      { canonicalName: 'Solo Leveling', aliases: ['ore dake level up na ken'], aniListId: 151807 },
      { canonicalName: 'Chainsaw Man', aliases: ['chainsawman', 'o homem motosserra'], aniListId: 127230 },
      { canonicalName: 'Naruto Shippuden', aliases: ['naruto', 'naruto: shippuuden'], aniListId: 1735 },
      { canonicalName: 'My Hero Academia', aliases: ['boku no hero academia', 'my hero academia'], aniListId: 21459 },
      { canonicalName: 'Hunter x Hunter', aliases: ['hunter × hunter', 'hunter x hunter (2011)'], aniListId: 11061 },
      { canonicalName: 'Death Note', aliases: ['death note'], aniListId: 1535 },
      { canonicalName: 'Black Clover', aliases: ['black clover: sword of the wizard king'], aniListId: 97940 },
      { canonicalName: 'Dragon Ball Z', aliases: ['dragon ball super', 'dragon ball kai', 'dragon ball daima'], aniListId: 223 },
      { canonicalName: 'Tokyo Ghoul', aliases: ['tokyo ghoul:re'], aniListId: 20605 },
      { canonicalName: 'Fullmetal Alchemist: Brotherhood', aliases: ['hagane no renkinjutsushi: brotherhood'], aniListId: 5114 },
      { canonicalName: 'Spy x Family', aliases: ['spy × family', 'spy x family code: white'], aniListId: 140960 },
      { canonicalName: 'Haikyu!!', aliases: ['haikyuu!!', 'haikyu!'], aniListId: 20464 },
      { canonicalName: 'Bleach', aliases: ['bleach (2004)'], aniListId: 269 },
      { canonicalName: 'Vinland Saga', aliases: ['vinland saga season 2'], aniListId: 101348 },
      { canonicalName: 'Mob Psycho 100', aliases: ['mob psycho 100 ii', 'mob psycho 100 iii'], aniListId: 21507 }
    ]
  },
  trending: {
    title: 'Em Alta Agora',
    titles: [
      { canonicalName: 'Solo Leveling', aliases: ['ore dake level up na ken'], aniListId: 151807 },
      { canonicalName: 'Dandadan', aliases: ['dan da dan'], aniListId: 171018 },
      { canonicalName: 'Jujutsu Kaisen', aliases: ['batalha de feiticeiros'], aniListId: 113415 },
      { canonicalName: 'One Piece', aliases: ['one piece'], aniListId: 21 },
      { canonicalName: 'Chainsaw Man', aliases: ['chainsawman'], aniListId: 127230 },
      { canonicalName: 'Frieren: Beyond Journey\'s End', aliases: ['sousou no frieren', 'frieren e a jornada para o além'], aniListId: 154587 },
      { canonicalName: 'Kaiju No. 8', aliases: ['kaijuu 8-gou'], aniListId: 153288 },
      { canonicalName: 'Demon Slayer: Kimetsu no Yaiba', aliases: ['kimetsu no yaiba'], aniListId: 101922 },
      { canonicalName: 'Bleach: Thousand-Year Blood War', aliases: ['bleach: sennen kessen-hen', 'bleach tybw'], aniListId: 116674 },
      { canonicalName: 'Spy x Family', aliases: ['spy × family'], aniListId: 140960 }
    ]
  },
  actionAdventure: {
    title: 'Ação e Aventura',
    titles: [
      { canonicalName: 'Jujutsu Kaisen', aliases: ['batalha de feiticeiros'] },
      { canonicalName: 'Demon Slayer: Kimetsu no Yaiba', aliases: ['kimetsu no yaiba'] },
      { canonicalName: 'Solo Leveling', aliases: ['ore dake level up na ken'] },
      { canonicalName: 'Attack on Titan', aliases: ['shingeki no kyojin'] },
      { canonicalName: 'One Piece', aliases: ['one piece'] },
      { canonicalName: 'Chainsaw Man', aliases: ['chainsawman'] },
      { canonicalName: 'Naruto Shippuden', aliases: ['naruto'] },
      { canonicalName: 'Bleach', aliases: ['bleach (2004)'] },
      { canonicalName: 'Hunter x Hunter', aliases: ['hunter × hunter'] },
      { canonicalName: 'Black Clover', aliases: ['black clover'] },
      { canonicalName: 'Kaiju No. 8', aliases: ['kaijuu 8-gou'] },
      { canonicalName: 'Tokyo Ghoul', aliases: ['tokyo ghoul'] },
      { canonicalName: 'Vinland Saga', aliases: ['vinland saga'] },
      { canonicalName: 'Wind Breaker', aliases: ['wind breaker'] },
      { canonicalName: 'Hell\'s Paradise', aliases: ['jigokuraku'] }
    ]
  },
  fantasyIsekai: {
    title: 'Fantasia e Isekai',
    titles: [
      { canonicalName: 'Frieren: Beyond Journey\'s End', aliases: ['sousou no frieren', 'frieren e a jornada para o além'] },
      { canonicalName: 'Mushoku Tensei: Jobless Reincarnation', aliases: ['mushoku tensei: isekai ittara honki dasu', 'mushoku tensei'] },
      { canonicalName: 'That Time I Got Reincarnated as a Slime', aliases: ['tensei shitara slime datta ken', 'slime isekai'] },
      { canonicalName: 'Re:Zero - Starting Life in Another World', aliases: ['re:zero kara hajimeru isekai seikatsu', 're:zero'] },
      { canonicalName: 'Overlord', aliases: ['overlord iv', 'overlord iii'] },
      { canonicalName: 'The Rising of the Shield Hero', aliases: ['tate no yuusha no nariagari'] },
      { canonicalName: 'Solo Leveling', aliases: ['ore dake level up na ken'] },
      { canonicalName: 'KonoSuba', aliases: ['kono subarashii sekai ni shukufuku wo!', 'konosuba'] },
      { canonicalName: 'Shangri-La Frontier', aliases: ['shangri-la frontier'] },
      { canonicalName: 'Black Clover', aliases: ['black clover'] }
    ]
  },
  romance: {
    title: 'Romance',
    titles: [
      { canonicalName: 'Kaguya-sama: Love Is War', aliases: ['kaguya-sama wa kokurasetai', 'kaguya sama'] },
      { canonicalName: 'Horimiya', aliases: ['horimiya: the missing pieces'] },
      { canonicalName: 'My Dress-Up Darling', aliases: ['sono bisque doll wa koi wo suru'] },
      { canonicalName: 'The Dangers in My Heart', aliases: ['boku no kokoro no yabai yatsu'] },
      { canonicalName: 'Komi Can\'t Communicate', aliases: ['komi-san wa, komyushou desu.'] },
      { canonicalName: 'Toradora!', aliases: ['toradora'] },
      { canonicalName: 'Your Name', aliases: ['kimi no na wa.', 'your name.'] },
      { canonicalName: 'Oshi no Ko', aliases: ['【oshi no ko】'] },
      { canonicalName: 'Fruits Basket', aliases: ['fruits basket (2019)'] },
      { canonicalName: 'Rascal Does Not Dream of Bunny Girl Senpai', aliases: ['seishun buta yarou'] }
    ]
  },
  shounen: {
    title: 'Shounen',
    titles: [
      { canonicalName: 'One Piece', aliases: ['one piece'] },
      { canonicalName: 'Naruto', aliases: ['naruto shippuden', 'naruto: shippuuden'] },
      { canonicalName: 'Dragon Ball Z', aliases: ['dragon ball super', 'dragon ball'] },
      { canonicalName: 'Demon Slayer: Kimetsu no Yaiba', aliases: ['kimetsu no yaiba'] },
      { canonicalName: 'Jujutsu Kaisen', aliases: ['batalha de feiticeiros'] },
      { canonicalName: 'My Hero Academia', aliases: ['boku no hero academia'] },
      { canonicalName: 'Black Clover', aliases: ['black clover'] },
      { canonicalName: 'Bleach', aliases: ['bleach'] },
      { canonicalName: 'Hunter x Hunter', aliases: ['hunter × hunter'] },
      { canonicalName: 'Haikyu!!', aliases: ['haikyuu!!'] },
      { canonicalName: 'Dr. Stone', aliases: ['dr. stone: new world', 'dr. stone: stone wars', 'dr stone'], aniListId: 105333, tmdbId: '86031' },
      { canonicalName: 'Fire Force', aliases: ['enn enn no shouboutai'] }
    ]
  },
  classics: {
    title: 'Clássicos Imperdíveis',
    titles: [
      { canonicalName: 'Death Note', aliases: ['death note'], maxYear: 2010 },
      { canonicalName: 'Fullmetal Alchemist: Brotherhood', aliases: ['hagane no renkinjutsushi'], maxYear: 2012 },
      { canonicalName: 'Cowboy Bebop', aliases: ['cowboy bebop'], maxYear: 2002 },
      { canonicalName: 'Dragon Ball Z', aliases: ['dragon ball z'], maxYear: 2000 },
      { canonicalName: 'Yu Yu Hakusho', aliases: ['yuu☆yuu☆hakusho', 'yu yu hakusho'], maxYear: 2000 },
      { canonicalName: 'Neon Genesis Evangelion', aliases: ['shin seiki evangelion', 'evangelion'], maxYear: 2005 },
      { canonicalName: 'Hunter x Hunter (1999)', aliases: ['hunter x hunter'], maxYear: 2002 },
      { canonicalName: 'Monster', aliases: ['monster (naoki urasawa)'], maxYear: 2006 },
      { canonicalName: 'Inuyasha', aliases: ['inu yasha', 'inuyasha'], maxYear: 2010 },
      { canonicalName: 'Sailor Moon', aliases: ['bishoujo senshi sailor moon'], maxYear: 2000 },
      { canonicalName: 'Os Cavaleiros do Zodíaco', aliases: ['saint seiya', 'cavaleiros do zodíaco'], maxYear: 2005 },
      { canonicalName: 'Akira', aliases: ['akira (1988)'], maxYear: 1995 }
    ]
  }
};

/**
 * Normaliza um texto para comparação fonética/textual tolerante
 */
function normalizeString(val: string | undefined | null): string {
  if (!val) return '';
  return val
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9\s]/g, ' ')   // pontuações viram espaço
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Verifica se um ContentItem possui evidência confiável de áudio dublado em Português (PT-BR)
 */
export function hasPtBrAudioEvidence(item: ContentItem): boolean {
  if (!item) return false;
  if (item.audioStatus === 'pt-br-dubbed' || item.audioStatus === 'pt-br-declared') return true;
  if (item.verifiedStreams && Array.isArray(item.verifiedStreams)) {
    if (item.verifiedStreams.some((s: any) => s.isPtBr || s.isDubbed || s.audioLanguage === 'pt-BR')) {
      return true;
    }
  }

  try {
    const canonicalKey = catalogEligibilityService.getCanonicalKey(item);
    const rec = catalogEligibilityService.getRecord(canonicalKey);
    if (rec && rec.hasPtBrAudio) return true;
  } catch {}

  const text = `${item.title || ''} ${item.description || ''} ${item.heroTags?.map(t => t.text).join(' ') || ''}`.toLowerCase();
  if (/\b(dublado|dublada|dublados|audio\s*pt|áudio\s*pt|audio\s*pt[-_]?br|áudio\s*pt[-_]?br|brazuca)\b/i.test(text)) {
    return true;
  }
  if (/\[dublado\]|🇧🇷\s*dublado/i.test(text)) {
    return true;
  }

  return false;
}

/**
 * Verifica se um anime do catálogo corresponde a uma entrada curada
 */
function matchAnime(candidate: ContentItem, target: CuratedTitle): boolean {
  if (target.aniListId && candidate.aniListId && candidate.aniListId === target.aniListId) {
    return true;
  }
  if (target.tmdbId && candidate.tmdbId && candidate.tmdbId === target.tmdbId) {
    return true;
  }

  if (target.minYear && candidate.year && candidate.year < target.minYear) return false;
  if (target.maxYear && candidate.year && candidate.year > target.maxYear) return false;

  const candidateTitle = normalizeString(candidate.title);
  const candidateOrig = normalizeString(candidate.originalTitle);
  const allAliases = [target.canonicalName, ...target.aliases].map(normalizeString);

  for (const alias of allAliases) {
    if (!alias) continue;
    if (candidateTitle === alias || candidateOrig === alias) return true;
    if (candidateTitle.startsWith(alias) || alias.startsWith(candidateTitle)) {
      // Evita falsos positivos com títulos muito curtos
      if (Math.min(candidateTitle.length, alias.length) >= 4) return true;
    }
  }

  return false;
}

export class AnimeEditorialService {
  private static instance: AnimeEditorialService;
  private lastUpdate: number = 0;
  private memoryCache: Map<string, ContentItem[]> = new Map();

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): AnimeEditorialService {
    if (!AnimeEditorialService.instance) {
      AnimeEditorialService.instance = new AnimeEditorialService();
    }
    return AnimeEditorialService.instance;
  }

  private loadFromStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed.timestamp === 'number') {
            this.lastUpdate = parsed.timestamp;
          }
        }
      }
    } catch {}
  }

  /**
   * Constrói as fileiras organizadas baseadas na Crunchyroll cruzando estritamente com os animes elegíveis da ZapiTV
   */
  public getEditorialCategories(availableAnimes: ContentItem[]): AnimeEditorialCategory[] {
    if (!availableAnimes || availableAnimes.length === 0) return [];

    // Filtra estritamente por obras de anime elegíveis
    const animes = catalogEligibilityService
      .filterEligibleItemsSync(availableAnimes)
      .filter(item => searchService.isAnimeItem(item));

    if (animes.length === 0) return [];

    const categories: AnimeEditorialCategory[] = [];

    // 1. Simulcasts da Temporada
    const simulcastsMatched: ContentItem[] = [];
    const simulcastsSeeds = EDITORIAL_SEEDS.simulcasts.titles;
    for (const target of simulcastsSeeds) {
      const match = animes.find(a => !simulcastsMatched.some(m => m.id === a.id) && matchAnime(a, target));
      if (match) simulcastsMatched.push(match);
    }
    // Adiciona outros animes da temporada recente (2024-2026) se disponíveis
    const recentSeasonal = animes.filter(a =>
      (a.year >= 2024 || (a.releaseDate && a.releaseDate >= '2024-01-01')) &&
      !simulcastsMatched.some(m => m.id === a.id)
    );
    const simulcastsFinal = [...simulcastsMatched, ...recentSeasonal];
    if (simulcastsFinal.length >= 3) {
      categories.push({
        id: 'anime-simulcasts',
        title: EDITORIAL_SEEDS.simulcasts.title,
        items: simulcastsFinal
      });
    }

    // 2. Animes Mais Populares
    const popularMatched: ContentItem[] = [];
    const popularSeeds = EDITORIAL_SEEDS.popular.titles;
    for (const target of popularSeeds) {
      const match = animes.find(a => !popularMatched.some(m => m.id === a.id) && matchAnime(a, target));
      if (match) popularMatched.push(match);
    }
    // Completa com animes ordenados por nota e popularidade do catálogo
    const restPopular = [...animes]
      .filter(a => !popularMatched.some(m => m.id === a.id))
      .sort((a, b) => (b.popularity || b.rating || 0) - (a.popularity || a.rating || 0));
    const popularFinal = [...popularMatched, ...restPopular];
    if (popularFinal.length >= 3) {
      categories.push({
        id: 'anime-popular',
        title: EDITORIAL_SEEDS.popular.title,
        items: popularFinal
      });
    }

    // 3. Novidades (lançamentos recentes)
    const newItems = [...animes]
      .sort((a, b) => {
        const yearDiff = (b.year || 0) - (a.year || 0);
        if (yearDiff !== 0) return yearDiff;
        return (b.popularity || 0) - (a.popularity || 0);
      });
    if (newItems.length >= 3) {
      categories.push({
        id: 'anime-new-episodes',
        title: 'Novidades',
        items: newItems
      });
    }

    // 4. Em Alta Agora
    const trendingMatched: ContentItem[] = [];
    for (const target of EDITORIAL_SEEDS.trending.titles) {
      const match = animes.find(a => !trendingMatched.some(m => m.id === a.id) && matchAnime(a, target));
      if (match) trendingMatched.push(match);
    }
    // Completa com itens populares recentes
    const restTrending = animes.filter(a => a.year >= 2023 && !trendingMatched.some(m => m.id === a.id));
    const trendingFinal = [...trendingMatched, ...restTrending];
    if (trendingFinal.length >= 3) {
      categories.push({
        id: 'anime-trending',
        title: EDITORIAL_SEEDS.trending.title,
        items: trendingFinal
      });
    }

    // 5. Dublados em Português (Exclusivamente com evidência confiável no ZapiTV)
    const dubbedAnimes = animes.filter(a => hasPtBrAudioEvidence(a));
    if (dubbedAnimes.length >= 3) {
      categories.push({
        id: 'anime-dubbed',
        title: 'Dublados em Português',
        items: dubbedAnimes
      });
    }

    // 6. Ação e Aventura
    const actionMatched: ContentItem[] = [];
    for (const target of EDITORIAL_SEEDS.actionAdventure.titles) {
      const match = animes.find(a => !actionMatched.some(m => m.id === a.id) && matchAnime(a, target));
      if (match) actionMatched.push(match);
    }
    const otherAction = animes.filter(a =>
      !actionMatched.some(m => m.id === a.id) &&
      a.genres?.some(g => /ação|action|aventura|adventure/i.test(g))
    );
    const actionFinal = [...actionMatched, ...otherAction];
    if (actionFinal.length >= 3) {
      categories.push({
        id: 'anime-action',
        title: EDITORIAL_SEEDS.actionAdventure.title,
        items: actionFinal
      });
    }

    // 7. Fantasia e Isekai
    const fantasyMatched: ContentItem[] = [];
    for (const target of EDITORIAL_SEEDS.fantasyIsekai.titles) {
      const match = animes.find(a => !fantasyMatched.some(m => m.id === a.id) && matchAnime(a, target));
      if (match) fantasyMatched.push(match);
    }
    const otherFantasy = animes.filter(a =>
      !fantasyMatched.some(m => m.id === a.id) &&
      (a.genres?.some(g => /fantasia|fantasy|isekai/i.test(g)) || /isekai|outro mundo/i.test(a.description || ''))
    );
    const fantasyFinal = [...fantasyMatched, ...otherFantasy];
    if (fantasyFinal.length >= 3) {
      categories.push({
        id: 'anime-fantasy-isekai',
        title: EDITORIAL_SEEDS.fantasyIsekai.title,
        items: fantasyFinal
      });
    }

    // 8. Romance
    const romanceMatched: ContentItem[] = [];
    for (const target of EDITORIAL_SEEDS.romance.titles) {
      const match = animes.find(a => !romanceMatched.some(m => m.id === a.id) && matchAnime(a, target));
      if (match) romanceMatched.push(match);
    }
    const otherRomance = animes.filter(a =>
      !romanceMatched.some(m => m.id === a.id) &&
      a.genres?.some(g => /romance|com[eé]dia rom[aâ]ntica|slice of life/i.test(g))
    );
    const romanceFinal = [...romanceMatched, ...otherRomance];
    if (romanceFinal.length >= 3) {
      categories.push({
        id: 'anime-romance',
        title: EDITORIAL_SEEDS.romance.title,
        items: romanceFinal
      });
    }

    // 9. Shounen
    const shounenMatched: ContentItem[] = [];
    for (const target of EDITORIAL_SEEDS.shounen.titles) {
      const match = animes.find(a => !shounenMatched.some(m => m.id === a.id) && matchAnime(a, target));
      if (match) shounenMatched.push(match);
    }
    const otherShounen = animes.filter(a =>
      !shounenMatched.some(m => m.id === a.id) &&
      a.genres?.some(g => /shounen|shonen/i.test(g))
    );
    const shounenFinal = [...shounenMatched, ...otherShounen];
    if (shounenFinal.length >= 3) {
      categories.push({
        id: 'anime-shounen',
        title: EDITORIAL_SEEDS.shounen.title,
        items: shounenFinal
      });
    }

    // 10. Clássicos Imperdíveis
    const classicsMatched: ContentItem[] = [];
    for (const target of EDITORIAL_SEEDS.classics.titles) {
      const match = animes.find(a => !classicsMatched.some(m => m.id === a.id) && matchAnime(a, target));
      if (match) classicsMatched.push(match);
    }
    const otherClassics = animes.filter(a =>
      !classicsMatched.some(m => m.id === a.id) &&
      a.year && a.year <= 2012 &&
      (a.rating >= 7.8 || (a.genres?.some(g => /cl[aá]ssico/i.test(g))))
    );
    const classicsFinal = [...classicsMatched, ...otherClassics];
    if (classicsFinal.length >= 3) {
      categories.push({
        id: 'anime-classics',
        title: EDITORIAL_SEEDS.classics.title,
        items: classicsFinal
      });
    }

    // Dispara checagem em background de atualização semanal se necessário
    this.checkWeeklyUpdate();

    return categories;
  }

  /**
   * Checagem e atualização semanal leve em background
   */
  private checkWeeklyUpdate(): void {
    if (typeof window === 'undefined') return;
    const now = Date.now();
    if (now - this.lastUpdate < WEEK_MS) return;
    this.lastUpdate = now;

    // Tenta atualizar rankings de popularidade via AniList oficial (sem scraping)
    aniListClient.getPopularAnimes(1, 10).then(popular => {
      if (popular && popular.length > 0) {
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
              timestamp: now,
              sampleCount: popular.length
            }));
          }
        } catch {}
      }
    }).catch(() => {
      // Falha de rede absorvida com 100% de transparência
    });
  }
}

export const animeEditorialService = AnimeEditorialService.getInstance();
