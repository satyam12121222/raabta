import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
const root = dirname(fileURLToPath(import.meta.url));
process.chdir(root);
const read = p => JSON.parse(readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const configPath = join(root, 'app.json');
const current = read(configPath);
if (!current.expo.extra?.eas?.projectId) {
  const oldPath = process.argv[2] || join(homedir(), 'Downloads', 'raabta', 'mobile', 'app.json');
  if (!existsSync(oldPath)) throw new Error('Existing Expo link missing. Run: node build-preview.mjs "PATH-TO-OLD-mobile/app.json"');
  const old = read(oldPath).expo;
  if (!old.extra?.eas?.projectId || old.slug !== current.expo.slug || old.android?.package !== current.expo.android.package)
    throw new Error('Existing app.json must belong to the linked Raabta project. No new project was created.');
  const updated = structuredClone(current);
  updated.expo.extra = { ...current.expo.extra, ...old.extra };
  if (old.owner) updated.expo.owner = old.owner;
  updated.expo.android.versionCode = Math.max(current.expo.android.versionCode, old.android.versionCode || 1);
  writeFileSync(configPath + '.before-build', readFileSync(configPath), { flag: 'wx' });
  writeFileSync(configPath, JSON.stringify(updated, null, 2) + '\n');
}
const env = { ...process.env, EXPO_PUBLIC_API_URL: 'https://raabta-api-dv1u.onrender.com', EXPO_PUBLIC_PROFILE_PHOTOS_ENABLED: 'false', EXPO_PUBLIC_TEMPORARY_PILOT: 'true' };
function run(command, args) {
  const win = process.platform === 'win32';
  const r = spawnSync(win ? command + '.cmd' : command, args, { cwd: root, env, stdio: 'inherit', shell: win });
  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status || 1);
}
run('npm', ['ci']);
run('npm', ['run', 'typecheck']);
run('npm', ['run', 'lint']);
console.log('Private test APK: photos disabled; data may reset. Use existing usi_121 Expo account and Android credentials.');
run('npx', ['eas-cli@latest', 'build', '--platform', 'android', '--profile', 'preview']);
