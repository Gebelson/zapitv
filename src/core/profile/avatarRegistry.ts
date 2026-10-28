/**
 * ZAPITV — REGISTRO DE AVATARES OFICIAIS (P3.B)
 * 
 * Biblioteca de avatares originais, licenciados e exclusivos da ZapiTV.
 * Utiliza paletas cinematográficas (gradientes escuros, neon e formas vetoriais limpas)
 * sem uso de conteúdo de terceiros ou protegidos por copyright.
 */

export interface AvatarDefinition {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  gradient: string;
  svgShape: string;
  dataUri: string;
}

function buildAvatarSvg(primary: string, secondary: string, shapePath: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${primary}" />
        <stop offset="100%" stop-color="${secondary}" />
      </linearGradient>
      <linearGradient id="inner" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.25" />
        <stop offset="100%" stop-color="#000000" stop-opacity="0.35" />
      </linearGradient>
    </defs>
    <rect width="120" height="120" rx="28" fill="url(#g)" />
    <rect width="120" height="120" rx="28" fill="url(#inner)" />
    <g fill="#ffffff" opacity="0.95">
      ${shapePath}
    </g>
  </svg>`.replace(/\s+/g, ' ').trim();
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const OFFICIAL_AVATARS: AvatarDefinition[] = [
  {
    id: 'zapi-avatar-cyan',
    name: 'Ciano Neon',
    primaryColor: '#00baa3',
    secondaryColor: '#007df7',
    gradient: 'linear-gradient(135deg, #00baa3 0%, #007df7 100%)',
    svgShape: '<path d="M60 26 L86 52 L60 78 L34 52 Z M60 42 L70 52 L60 62 L50 52 Z M54 84 L66 84 L66 94 L54 94 Z" />',
    dataUri: '',
  },
  {
    id: 'zapi-avatar-blue',
    name: 'Azul Cósmico',
    primaryColor: '#007df7',
    secondaryColor: '#4f46e5',
    gradient: 'linear-gradient(135deg, #007df7 0%, #4f46e5 100%)',
    svgShape: '<path d="M60 28 C76.5 28 90 41.5 90 58 C90 74.5 76.5 88 60 88 C43.5 88 30 74.5 30 58 C30 41.5 43.5 28 60 28 Z M60 40 C50 40 42 48 42 58 C42 68 50 76 60 76 C70 76 78 68 78 58 C78 48 70 40 60 40 Z" />',
    dataUri: '',
  },
  {
    id: 'zapi-avatar-purple',
    name: 'Cyber Violeta',
    primaryColor: '#b273d8',
    secondaryColor: '#7c3aed',
    gradient: 'linear-gradient(135deg, #b273d8 0%, #7c3aed 100%)',
    svgShape: '<polygon points="60,25 72,48 95,52 78,69 82,93 60,81 38,93 42,69 25,52 48,48" />',
    dataUri: '',
  },
  {
    id: 'zapi-avatar-emerald',
    name: 'Esmeralda',
    primaryColor: '#10b981',
    secondaryColor: '#047857',
    gradient: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
    svgShape: '<path d="M60 25 L88 45 L88 75 L60 95 L32 75 L32 45 Z M60 38 L44 50 L44 70 L60 82 L76 70 L76 50 Z" />',
    dataUri: '',
  },
  {
    id: 'zapi-avatar-amber',
    name: 'Âmbar Solar',
    primaryColor: '#f59e0b',
    secondaryColor: '#d97706',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    svgShape: '<circle cx="60" cy="60" r="18" /><path d="M60 25 L60 35 M60 85 L60 95 M25 60 L35 60 M85 60 L95 60 M35 35 L42 42 M78 78 L85 85 M35 85 L42 78 M78 42 L85 35" stroke="#ffffff" stroke-width="4" stroke-linecap="round" fill="none" />',
    dataUri: '',
  },
  {
    id: 'zapi-avatar-ruby',
    name: 'Rubi Intenso',
    primaryColor: '#ef4444',
    secondaryColor: '#b91c1c',
    gradient: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
    svgShape: '<path d="M42 32 L78 32 L92 48 L60 92 L28 48 Z M45 44 L75 44 L60 76 Z" />',
    dataUri: '',
  },
  {
    id: 'zapi-avatar-magenta',
    name: 'Magenta Neon',
    primaryColor: '#ec4899',
    secondaryColor: '#9333ea',
    gradient: 'linear-gradient(135deg, #ec4899 0%, #9333ea 100%)',
    svgShape: '<path d="M48 35 L72 35 C80 35 86 41 86 49 C86 55 82 60 76 62 C83 64 88 70 88 77 C88 86 80 92 71 92 L48 92 Z M58 45 L58 56 L69 56 C72 56 75 53 75 50.5 C75 48 72 45 69 45 Z M58 66 L58 81 L71 81 C74 81 77 78 77 73.5 C77 69 74 66 71 66 Z" />',
    dataUri: '',
  },
  {
    id: 'zapi-avatar-teal',
    name: 'Turquesa Glacial',
    primaryColor: '#06b6d4',
    secondaryColor: '#0e7490',
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #0e7490 100%)',
    svgShape: '<path d="M60 25 L85 50 L60 95 L35 50 Z M60 40 L72 52 L60 78 L48 52 Z" />',
    dataUri: '',
  },
];

// Gera dataUri dinamicamente para cada avatar
OFFICIAL_AVATARS.forEach((av) => {
  av.dataUri = buildAvatarSvg(av.primaryColor, av.secondaryColor, av.svgShape);
});

export const DEFAULT_AVATAR_ID = 'zapi-avatar-cyan';

export const VALID_AVATAR_IDS = OFFICIAL_AVATARS.map((a) => a.id);

export function getAvatarById(id?: string | null): AvatarDefinition {
  if (!id) return OFFICIAL_AVATARS[0];
  const found = OFFICIAL_AVATARS.find((a) => a.id === id);
  return found || OFFICIAL_AVATARS[0];
}

export function resolveAvatarUrl(avatarIdOrUrl?: string | null): string {
  if (!avatarIdOrUrl) return OFFICIAL_AVATARS[0].dataUri;
  // Se for um ID oficial, retorna o SVG embutido
  const found = OFFICIAL_AVATARS.find((a) => a.id === avatarIdOrUrl);
  if (found) return found.dataUri;
  // Se for URL HTTP ou data URI, retorna diretamente
  if (avatarIdOrUrl.startsWith('http://') || avatarIdOrUrl.startsWith('https://') || avatarIdOrUrl.startsWith('data:')) {
    return avatarIdOrUrl;
  }
  return OFFICIAL_AVATARS[0].dataUri;
}
