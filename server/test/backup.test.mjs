import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { Store } from '../src/store.mjs';
test('online backup retains committed WAL data and can be decrypted on restore',()=>{
 const root=mkdtempSync(join(tmpdir(),'raabta-backup-')),key=randomBytes(32).toString('base64');
 const db=new Store(join(root,'live.db'),key);
 try {
  db.run("INSERT INTO users(id,handle,password,profile,created) VALUES('u','handle','hash',?,'today')",db.seal({name:'Test'}));
  execFileSync(process.execPath,[new URL('../backup.mjs',import.meta.url).pathname],{env:{...process.env,DB_PATH:join(root,'live.db'),BACKUP_DIR:join(root,'backups')}});
  const file=readdirSync(join(root,'backups'))[0],restored=new Store(join(root,'backups',file),key);
  try { assert.equal(restored.user('u').profile.name,'Test'); } finally {restored.close();}
 } finally {db.close();rmSync(root,{recursive:true,force:true});}
});
