import fs from 'node:fs/promises';
import path from 'node:path';
import { getDatabase } from '../src/server/database/client';

const connection = getDatabase();
if (!connection) throw new Error('Defina TURSO_DATABASE_URL e TURSO_AUTH_TOKEN antes do backup.');

const tables = ['media', 'media_external_ids', 'episodes', 'global_settings', 'admin_audit'] as const;
const backup: Record<string, unknown[]> = {};
for (const table of tables) {
  const result = await connection.client.execute(`SELECT * FROM ${table}`);
  backup[table] = result.rows.map(row => ({ ...row }));
}

const outputDir = path.resolve('backups');
await fs.mkdir(outputDir, { recursive: true });
const filename = `zapitv-database-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
const outputPath = path.join(outputDir, filename);
await fs.writeFile(outputPath, JSON.stringify({ format: 1, createdAt: new Date().toISOString(), tables: backup }, null, 2), { flag: 'wx', mode: 0o600 });
console.log(`Backup gravado em ${outputPath}. Guarde uma cópia fora do projeto.`);
connection.client.close();
