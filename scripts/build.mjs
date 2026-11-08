#!/usr/bin/env node
/**
 * Build dos assets do navegador (roda sozinho antes de `wrangler dev/deploy`, via wrangler.jsonc > build).
 *
 * - src/client/site.ts  → public/assets/app/site.<hash>.js   (ES2022, minificado)
 * - src/client/admin.ts → public/assets/app/admin.<hash>.js
 * - src/styles/*.css    → public/assets/app/<nome>.<hash>.css
 * - src/worker/generated/assets.ts com os nomes finais (o Worker importa esse manifesto)
 *
 * Nome com hash = cache imutável de 1 ano (ver public/_headers).
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public/assets/app');
const genDir = join(root, 'src/worker/generated');

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
mkdirSync(genDir, { recursive: true });

const hash = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 10);

const entries = [
  { key: 'siteJs', in: 'src/client/site.ts', ext: 'js' },
  { key: 'adminJs', in: 'src/client/admin.ts', ext: 'js' },
  { key: 'siteCss', in: 'src/styles/site.css', ext: 'css' },
  { key: 'adminCss', in: 'src/styles/admin.css', ext: 'css' },
];

const manifest = {};
for (const entry of entries) {
  const file = join(root, entry.in);
  if (!existsSync(file)) {
    console.warn(`[build] ${entry.in} não existe — ignorado`);
    manifest[entry.key] = '';
    continue;
  }
  const result = await esbuild.build({
    entryPoints: [file],
    bundle: true,
    minify: true,
    write: false,
    format: 'esm',
    target: entry.ext === 'js' ? ['es2022'] : ['chrome111', 'safari16.4', 'firefox115'],
    sourcemap: false,
    legalComments: 'none',
    logLevel: 'warning',
    // fontes e imagens referenciadas no CSS são servidas como estão em /assets
    external: ['/assets/*'],
    charset: 'utf8',
  });
  const output = result.outputFiles[0].contents;
  const name = `${entry.key.replace(/(Js|Css)$/, '').toLowerCase()}.${hash(output)}.${entry.ext}`;
  writeFileSync(join(outDir, name), output);
  manifest[entry.key] = `/assets/app/${name}`;
  console.log(`[build] ${entry.in} → ${manifest[entry.key]} (${(output.length / 1024).toFixed(1)} KB)`);
}

// Só regrava se mudou (o wrangler dev observa src/ e reconstruiria em loop)
const manifestFile = join(genDir, 'assets.ts');
const manifestSrc = `// Gerado por scripts/build.mjs — não edite.\nexport const ASSETS = ${JSON.stringify(manifest, null, 2)} as const;\n`;
if (!existsSync(manifestFile) || readFileSync(manifestFile, 'utf8') !== manifestSrc) writeFileSync(manifestFile, manifestSrc);
