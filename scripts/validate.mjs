import { readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const required = [
  'manifest.json',
  'background.js',
  'content.js',
  'popup.html',
  'popup.css',
  'popup.js',
  'icons/icon16.png',
  'icons/icon32.png',
  'icons/icon48.png',
  'icons/icon128.png'
];

for (const path of required) {
  await access(path);
}

const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
if (manifest.manifest_version !== 3) throw new Error('manifest_version must be 3');
if (!/^\d+\.\d+\.\d+$/.test(manifest.version || '')) throw new Error('manifest version must be x.y.z');

const expectedPermissions = ['activeTab', 'scripting', 'storage', 'debugger'];
for (const permission of expectedPermissions) {
  if (!manifest.permissions?.includes(permission)) throw new Error(`missing permission: ${permission}`);
}
if (manifest.permissions?.includes('tabs')) throw new Error('unexpected tabs permission regression');
if (manifest.host_permissions?.length) throw new Error('unexpected broad host_permissions; review explicitly');

for (const file of ['background.js', 'content.js', 'popup.js']) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || '');
    throw new Error(`syntax check failed: ${file}`);
  }
}

const js = await Promise.all(['background.js', 'content.js', 'popup.js'].map(f => readFile(f, 'utf8')));
const source = js.join('\n');
const networkPatterns = [
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /\bWebSocket\b/,
  /sendBeacon\s*\(/
];
for (const pattern of networkPatterns) {
  if (pattern.test(source)) throw new Error(`network primitive detected (${pattern}); security review required`);
}

if (!source.includes('FPT51_')) throw new Error('expected FPT51 message namespace not found');

console.log(`Flow Prompt Typer v${manifest.version}: validation passed.`);
