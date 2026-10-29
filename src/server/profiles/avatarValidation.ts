import { AVATARS, MAX_PROFILE_AVATAR_LENGTH } from '../../core/profile/avatarImages';
import { VALID_AVATAR_IDS } from '../../core/profile/avatarRegistry';

export function isValidProfileAvatar(value: string): boolean {
  if (VALID_AVATAR_IDS.includes(value) || AVATARS.includes(value)) return true;
  if (value.length > MAX_PROFILE_AVATAR_LENGTH) return false;
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return false;
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.toString('base64') !== match[2]) return false;
  if (match[1] === 'png') return bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (match[1] === 'jpeg') return bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes.at(-2) === 255 && bytes.at(-1) === 217;
  return bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
}
