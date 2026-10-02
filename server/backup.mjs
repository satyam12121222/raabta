import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync, readdirSync, statSync, unlinkSync, chmodSync } from 'node:fs';
import { resolve, join } from 'node:path';
// SQLite's online backup includes committed WAL records, unlike a plain file copy.
process.umask(0o077);
const folder = resolve(process.env.BACKUP_DIR || 'backups');
mkdirSync(folder, { recursive: true });
const db = new DatabaseSync(process.env.DB_PATH || 'data/raabta.db', { readOnly: true });
const target = join(folder, `raabta-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
try {
  await backup(db, target);
  chmodSync(target, 0o600);
  const check = new DatabaseSync(target, { readOnly: true });
  try {
    if (check.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw Error('Backup integrity check failed.');
  } finally { check.close(); }
  const cutoff = Date.now() - 7 * 86400000;
  for (const name of readdirSync(folder))
    if (/^raabta-.*\.db$/.test(name) && statSync(join(folder,name)).mtimeMs < cutoff) unlinkSync(join(folder,name));
  console.log(`Backup verified: ${target}. Keep DATA_KEY separately; this snapshot retains account metadata.`);
} finally { db.close(); }
