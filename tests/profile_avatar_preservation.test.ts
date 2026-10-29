import assert from 'node:assert/strict';
import test from 'node:test';
import { createDatabase, ensureAuthTables } from '../src/server/database/client';
import { ProfileService } from '../src/server/profiles/profileService';
import { OFFICIAL_AVATARS, resolveAvatarUrl } from '../src/core/profile/avatarRegistry';

const originalImages = [
  '0KzQwwX', 'Spw0Cos', '6IEApDt', 'FyLB4ca', 'bA8ltkk', 'kimAW6g',
  'sTbJUBM', 'amtR2VN', '10zcAOY', '7yXXxXT', 'XK8zLav', '6IYczXJ',
].map(id => `https://i.imgur.com/${id}.png`);
const uploadedPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jMZkAAAAASUVORK5CYII=';

test('the original twelve curated images replace the generic shapes without changing existing IDs', () => {
  assert.ok(JSON.stringify(OFFICIAL_AVATARS.map(avatar => avatar.dataUri)) === JSON.stringify(originalImages), 'Preserve all twelve original image URLs and their order');
  assert.equal(resolveAvatarUrl('zapi-avatar-cyan'), originalImages[0]);
  assert.equal(resolveAvatarUrl('zapi-avatar-blue'), originalImages[1]);
});

test('uploaded pictures survive create, update and reload and remain scoped to the owning account', async () => {
  const db = createDatabase('file::memory:');
  try {
    await ensureAuthTables(db);
    for (const id of ['avatar-owner', 'avatar-other']) {
      await db.client.execute({ sql: 'INSERT INTO users(id,name,email,password_hash,terms_accepted_at,created_at,updated_at) VALUES (?,?,?,?,1,1,1)',
        args: [id, 'Fixture', `${id}@example.invalid`, 'fixture-hash'] });
    }
    const profile = await ProfileService.createProfile(db, 'avatar-owner', { name: 'Perfil', avatarId: uploadedPng });
    assert.equal(profile.avatarId, uploadedPng);
    await ProfileService.updateProfile(db, 'avatar-owner', profile.id, { avatarId: 'zapi-avatar-blue' });
    await ProfileService.updateProfile(db, 'avatar-owner', profile.id, { avatarId: uploadedPng });
    assert.equal((await ProfileService.getProfileById(db, 'avatar-owner', profile.id))?.avatarId, uploadedPng);
    assert.equal(await ProfileService.getProfileById(db, 'avatar-other', profile.id), null);
    await assert.rejects(() => ProfileService.updateProfile(db, 'avatar-other', profile.id, { avatarId: uploadedPng }));
    for (const invalid of ['data:image/svg+xml;base64,PHN2Zy8+', 'javascript:alert(1)', 'data:image/png;base64,YmFk']) {
      await assert.rejects(() => ProfileService.updateProfile(db, 'avatar-owner', profile.id, { avatarId: invalid }));
      await assert.rejects(() => ProfileService.createProfile(db, 'avatar-owner', { name: 'Inválido', avatarId: invalid }));
    }
    assert.equal(resolveAvatarUrl(uploadedPng), uploadedPng);
  } finally { db.client.close(); }
});
