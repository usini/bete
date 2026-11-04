import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pubkey = process.env.BETE_UPDATER_PUBLIC_KEY?.trim();
if (!pubkey || !process.env.TAURI_SIGNING_PRIVATE_KEY) {
  throw new Error('Configure BETE_UPDATER_PUBLIC_KEY et TAURI_SIGNING_PRIVATE_KEY avant de construire une version publiable.');
}

const releases = 'https://github.com/usini/bete/releases';
const manifestName = 'bete-desktop-latest.json';
const { version: defaultVersion, productName } = JSON.parse(readFileSync(new URL('./src-tauri/tauri.conf.json', import.meta.url), 'utf8'));
const version = process.argv[2] ?? defaultVersion;
if (!/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(version)) {
  throw new Error('Version attendue au format X.Y.Z.');
}
const config = {
  version,
  bundle: { createUpdaterArtifacts: true },
  plugins: {
    updater: {
      pubkey,
      endpoints: [`${releases}/latest/download/${manifestName}`],
      windows: { installMode: 'passive' },
      requireSignedVersion: true,
    },
  },
};
const cli = new URL('./node_modules/@tauri-apps/cli/tauri.js', import.meta.url);
const result = spawnSync(process.execPath, [
  fileURLToPath(cli), 'build', '--target', 'x86_64-pc-windows-msvc', '--config', JSON.stringify(config),
], {
  stdio: 'inherit',
  env: { ...process.env, BETE_UPDATER_PUBLIC_KEY: pubkey },
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const built = new URL('./src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/', import.meta.url);
const installer = `${productName}_${version}_x64-setup.exe`;
const signatureFile = new URL(encodeURIComponent(installer + '.sig'), built);
const signature = readFileSync(signatureFile, 'utf8').trim();
if (!signature) throw new Error('Signature de mise à jour absente.');

const tag = `bete-desktop-v${version}`;
const asset = `Bete-Desktop-${version}-x64-setup.exe`;
const output = new URL(`./release-output/${tag}/`, import.meta.url);
mkdirSync(output, { recursive: true });
copyFileSync(new URL(encodeURIComponent(installer), built), new URL(asset, output));
copyFileSync(signatureFile, new URL(asset + '.sig', output));
const url = `${releases}/download/${tag}/${asset}`;
writeFileSync(new URL(manifestName, output), JSON.stringify({
  version,
  platforms: { 'windows-x86_64': { url, signature } },
}, null, 2) + '\n');
console.log(`Fichiers prêts pour la release ${tag} dans ${fileURLToPath(output)}`);
