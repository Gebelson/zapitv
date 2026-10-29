import { AVATARS } from './avatarImages';

export interface AvatarDefinition {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  gradient: string;
  dataUri: string;
}

// Keep saved identifiers, restoring the owner's original images and order.
const existingIds = ['cyan', 'blue', 'purple', 'emerald', 'amber', 'ruby', 'magenta', 'teal'];
export const OFFICIAL_AVATARS: AvatarDefinition[] = AVATARS.map((image, index) => ({
  id: `zapi-avatar-${existingIds[index] || index + 1}`,
  name: `Avatar ${index + 1}`,
  primaryColor: '#007df7',
  secondaryColor: '#00baa3',
  gradient: 'linear-gradient(135deg, #007df7, #00baa3)',
  dataUri: image,
}));

export const DEFAULT_AVATAR_ID = 'zapi-avatar-cyan';
export const VALID_AVATAR_IDS = OFFICIAL_AVATARS.map(avatar => avatar.id);

export function getAvatarById(id?: string | null): AvatarDefinition {
  return OFFICIAL_AVATARS.find(avatar => avatar.id === id) || OFFICIAL_AVATARS[0];
}

export function resolveAvatarUrl(avatarIdOrUrl?: string | null): string {
  const found = OFFICIAL_AVATARS.find(avatar => avatar.id === avatarIdOrUrl);
  if (found) return found.dataUri;
  if (avatarIdOrUrl && /^(https?:\/\/|data:image\/)/i.test(avatarIdOrUrl)) return avatarIdOrUrl;
  return OFFICIAL_AVATARS[0].dataUri;
}
