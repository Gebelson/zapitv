export enum ContentType {
  MOVIE = 'FILME',
  SERIES = 'SÉRIE',
  ANIME = 'ANIME'
}

export interface HeroTag {
  id: string;
  text: string;
  color: string; // Hex code ou classe tailwind representativa
  style: 'solid' | 'transparent';
}

export interface ContentItem {
  id: string;
  title: string;
  type: ContentType;
  rating: number;
  year: number;
  image: string;
  backdrop?: string;
  description?: string;
  isFeatured?: boolean;
  platform?: string; // Mantido para compatibilidade, usado como fallback
  genres?: string[];
  heroTags?: HeroTag[]; // Nova propriedade para tags personalizadas
  tmdbId?: string; // ID numérico do TMDB
  imdbId?: string; // ID do IMDB (ex: tt1234567)
  videoUrl?: string; // Custom video URL
  originalTitle?: string;
  duration?: number;
  overview?: string;
  poster?: string;
  
  // Novos metadados detalhados
  director?: string; // Para séries, funciona como "Criador"
  cast?: string[];
  writers?: string[];
  traits?: string[]; // ex: "Empolgante", "Sombrio"
  maturityAdvisories?: string[]; // ex: "violência", "nudez"
  ageRating?: string; // Classificação Indicativa

  // Disponibilidade e Verificação de Áudio Real
  availabilityStatus?: 'verified' | 'declared' | 'unavailable'; // 'Disponível e testado' | 'Fonte declarada' | 'Indisponível'
  audioStatus?: 'pt-br-dubbed' | 'pt-br-original' | 'pt-br-declared' | 'pt-br-subtitles' | 'other' | 'universal' | 'unknown';
  verifiedStreams?: any[];
  seasonsCount?: number;
  episodes?: {
    id: string;
    number: number;
    title: string;
    description: string;
    image: string;
    videoUrl?: string;
  }[];
}

export interface SiteNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'alert' | 'promo';
  timestamp: string;
  read?: boolean;
}

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  isChild: boolean;
  pin?: string; // Senha de 4 dígitos
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: 'admin' | 'user';
  devMode: boolean;
  memberSince: string;
  plan: string;
  status: 'Ativo' | 'Inativo' | 'Pendente' | 'Atrasado';
  profiles: Profile[];
}

export interface CustomSection {
  id: string;
  title: string;
  items: string[]; // Array de IDs dos conteúdos
}

export type AppView = 'home' | 'featured' | 'movies' | 'series' | 'animes' | 'programas' | 'mylist' | 'profile' | 'settings' | 'help' | 'admin' | 'login' | 'signup' | 'profile-selector';