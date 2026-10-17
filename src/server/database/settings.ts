import { and, eq } from 'drizzle-orm';
import type { Database } from './client';
import { adminAudit, globalSettings } from './schema';

export class SettingVersionConflict extends Error {}

export async function readSetting(connection: Database, key: string) {
  const [row] = await connection.db.select().from(globalSettings).where(eq(globalSettings.key, key)).limit(1);
  return row ? { value: JSON.parse(row.valueJson) as unknown, version: row.version, updatedAt: row.updatedAt } : null;
}

export async function writeSetting(connection: Database, key: string, value: unknown, expectedVersion: number, actorUid: string) {
  const now = Date.now();
  const valueJson = JSON.stringify(value);
  return connection.db.transaction(async (tx) => {
    if (expectedVersion === 0) {
      const inserted = await tx.insert(globalSettings).values({
        key, valueJson, version: 1, updatedAt: now, updatedBy: actorUid,
      }).onConflictDoNothing().returning({ version: globalSettings.version });
      if (inserted.length !== 1) throw new SettingVersionConflict('A configuração foi modificada em outra sessão.');
    } else {
      const updated = await tx.update(globalSettings).set({
        valueJson, version: expectedVersion + 1, updatedAt: now, updatedBy: actorUid,
      }).where(and(eq(globalSettings.key, key), eq(globalSettings.version, expectedVersion)))
        .returning({ version: globalSettings.version });
      if (updated.length !== 1) throw new SettingVersionConflict('A configuração foi modificada em outra sessão.');
    }
    await tx.insert(adminAudit).values({
      id: crypto.randomUUID(), settingKey: key, previousVersion: expectedVersion,
      nextVersion: expectedVersion + 1, actorUid, createdAt: now,
    });
    return { value, version: expectedVersion + 1, updatedAt: now };
  });
}
