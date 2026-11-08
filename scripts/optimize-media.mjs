#!/usr/bin/env node
/**
 * Gera as versões web de todas as mídias a partir de `media-src/`.
 *
 *   npm run media
 *
 * - Fotos: AVIF + WebP em 480/800/1152 px, sem EXIF (o layout usa <picture> + srcset).
 * - OG image 1200x630 e ícones (favicon SVG, PNG 180/192/512, maskable).
 * - Vídeo: tour curto (Ken Burns) feito com as fotos, VP9 (WebM) + H.264 (MP4, faststart) + poster.
 * - Fontes: subset Latin-1 + pontuação dos WOFF2 variáveis do @fontsource (Português completo).
 *
 * Requer: sharp (devDependency), ffmpeg no PATH (opcional, pula o vídeo se faltar)
 * e Python com fontTools + brotli (opcional, copia a fonte inteira se faltar).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'media-src');
const OUT_IMG = join(root, 'public/assets/img');
const OUT_VIDEO = join(root, 'public/assets/video');
const OUT_FONTS = join(root, 'public/assets/fonts');
const PUBLIC = join(root, 'public');

for (const dir of [OUT_IMG, OUT_VIDEO, OUT_FONTS]) mkdirSync(dir, { recursive: true });

const WIDTHS = [480, 800, 1152];
const PHOTOS = ['auditorio-1', 'auditorio-2', 'auditorio-3', 'auditorio-4'];
const INK = '#123441';
const TEAL = '#2BB3BD';
const GOLD = '#E5BB65';

const kb = (file) => `${(statSync(file).size / 1024).toFixed(1)} KB`;
const log = (msg) => console.log(`  ${msg}`);

async function photos() {
  console.log('Fotos');
  const sources = [
    ...PHOTOS.map((name) => ({ name, file: `${name}.jpeg` })),
    { name: 'encontro-profissional', file: 'encontro-profissional.webp' },
  ];
  for (const { name, file } of sources) {
    const input = join(SRC, file);
    const meta = await sharp(input).metadata();
    for (const w of WIDTHS) {
      if (w > meta.width) continue;
      const base = sharp(input).rotate().resize({ width: w, withoutEnlargement: true });
      const avif = join(OUT_IMG, `${name}-${w}.avif`);
      const webp = join(OUT_IMG, `${name}-${w}.webp`);
      await base.clone().avif({ quality: 52, effort: 6, chromaSubsampling: '4:2:0' }).toFile(avif);
      await base.clone().webp({ quality: 74, effort: 6, smartSubsample: true }).toFile(webp);
      log(`${name}-${w}: avif ${kb(avif)} | webp ${kb(webp)}`);
    }
    // largura máxima disponível quando a original é menor que 1152
    if (meta.width < WIDTHS.at(-1)) {
      const w = meta.width;
      const base = sharp(input).rotate();
      await base.clone().avif({ quality: 52, effort: 6 }).toFile(join(OUT_IMG, `${name}-${w}.avif`));
      await base.clone().webp({ quality: 74, effort: 6 }).toFile(join(OUT_IMG, `${name}-${w}.webp`));
      log(`${name}-${w}: (largura original)`);
    }
  }
  // Placeholder borrado (LQIP) em base64 para o worker embutir no HTML
  const lqip = {};
  for (const name of [...PHOTOS, 'encontro-profissional']) {
    const file = name === 'encontro-profissional' ? `${name}.webp` : `${name}.jpeg`;
    const buf = await sharp(join(SRC, file)).resize(12).blur(0.6).webp({ quality: 40 }).toBuffer();
    lqip[name] = `data:image/webp;base64,${buf.toString('base64')}`;
  }
  writeFileSync(join(root, 'src/worker/lqip.json'), JSON.stringify(lqip, null, 2) + '\n');
  log('LQIP -> src/worker/lqip.json');
}

async function ogImage() {
  console.log('OG image');
  const photo = await sharp(join(SRC, 'auditorio-2.jpeg'))
    .rotate()
    .resize(1200, 630, { fit: 'cover', position: 'attention' })
    .modulate({ saturation: 0.9 })
    .toBuffer();
  const overlay = Buffer.from(`
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="${INK}" stop-opacity="0.96"/>
      <stop offset="0.55" stop-color="${INK}" stop-opacity="0.82"/>
      <stop offset="1" stop-color="${INK}" stop-opacity="0.15"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <rect x="72" y="84" width="120" height="10" rx="3" fill="${GOLD}"/>
  <g fill="${TEAL}">
    ${[0, 1, 2].map((r) => [0, 1, 2, 3, 4].map((c) => `<circle cx="${82 + c * 26}" cy="${124 + r * 24}" r="6"/>`).join('')).join('')}
  </g>
  <text x="72" y="300" font-family="Georgia, 'Times New Roman', serif" font-size="62" fill="#F2F5F4">Auditórios para cursos</text>
  <text x="72" y="374" font-family="Georgia, 'Times New Roman', serif" font-size="62" fill="#F2F5F4">e treinamentos no</text>
  <text x="72" y="448" font-family="Georgia, 'Times New Roman', serif" font-size="62" fill="#F2F5F4">Centro do Rio</text>
  <text x="72" y="540" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="${GOLD}" font-weight="700">InterFISIO</text>
  <text x="232" y="540" font-family="Arial, Helvetica, sans-serif" font-size="26" fill="#C9D8DA">Rua São Bento, 09 — 13º e 14º andares</text>
</svg>`);
  const out = join(PUBLIC, 'og-image.jpg');
  await sharp(photo).composite([{ input: overlay }]).jpeg({ quality: 82, mozjpeg: true }).toFile(out);
  await sharp(out).webp({ quality: 80 }).toFile(join(PUBLIC, 'og-image.webp'));
  log(`og-image.jpg ${kb(out)}`);
}

function markSvg({ size = 64, radius = 14, padding = 0 } = {}) {
  const s = 64;
  const scale = (s - padding * 2) / s;
  const dots = [0, 1, 2]
    .map((r) => [0, 1, 2, 3].map((c) => `<circle cx="${17 + c * 10}" cy="${31 + r * 9.5}" r="3.3"/>`).join(''))
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" width="${size}" height="${size}">
<rect width="${s}" height="${s}" rx="${radius}" fill="${INK}"/>
<g transform="translate(${padding} ${padding}) scale(${scale})">
<rect x="13" y="13" width="38" height="7" rx="2" fill="${GOLD}"/>
<g fill="${TEAL}">${dots}</g>
</g>
</svg>`;
}

async function icons() {
  console.log('Ícones');
  writeFileSync(join(PUBLIC, 'favicon.svg'), markSvg());
  const png = async (file, size, opts) => {
    await sharp(Buffer.from(markSvg({ size, ...opts }))).resize(size, size).png({ compressionLevel: 9 }).toFile(join(PUBLIC, file));
    log(`${file}`);
  };
  await png('apple-touch-icon.png', 180, { radius: 0 });
  await png('icon-192.png', 192);
  await png('icon-512.png', 512);
  await png('icon-maskable-512.png', 512, { radius: 0, padding: 10 });
  // favicon.ico (PNG embutido, aceito por todos os navegadores atuais)
  const ico48 = await sharp(Buffer.from(markSvg({ size: 48 }))).resize(48, 48).png().toBuffer();
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header.writeUInt8(48, 6);
  header.writeUInt8(48, 7);
  header.writeUInt8(0, 8);
  header.writeUInt8(0, 9);
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(ico48.length, 14);
  header.writeUInt32LE(22, 18);
  writeFileSync(join(PUBLIC, 'favicon.ico'), Buffer.concat([header, ico48]));
  log('favicon.ico');
}

function hasBin(bin) {
  return spawnSync(bin, ['-version'], { stdio: 'ignore' }).status === 0;
}

function video() {
  console.log('Vídeo');
  if (!hasBin('ffmpeg')) {
    log('ffmpeg não encontrado — vídeo ignorado');
    return;
  }
  const per = 3.4; // segundos por foto
  const fade = 0.7;
  const fps = 24;
  const frames = Math.round(per * fps);
  const order = ['auditorio-2', 'auditorio-1', 'auditorio-4', 'auditorio-3'];
  const inputs = order.flatMap((n) => ['-i', join(SRC, `${n}.jpeg`)]);
  const zoom = order
    .map((_, i) => {
      // recorte 16:9 na faixa central (cadeiras + tela), zoom lento alternando o sentido
      const z = i % 2 === 0 ? `min(zoom+0.0007,1.07)` : `if(eq(on,1),1.07,max(zoom-0.0007,1.0))`;
      return `[${i}:v]crop=1152:648:0:ih*0.34,scale=1920:-1,zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=960x540:fps=${fps},setsar=1,format=yuv420p[v${i}]`;
    })
    .join(';');
  let chain = '';
  let last = 'v0';
  for (let i = 1; i < order.length; i++) {
    const offset = (per - fade) * i;
    const out = `x${i}`;
    chain += `;[${last}][v${i}]xfade=transition=fade:duration=${fade}:offset=${offset.toFixed(2)}[${out}]`;
    last = out;
  }
  const filter = zoom + chain;
  const webm = join(OUT_VIDEO, 'tour-auditorios.webm');
  const mp4 = join(OUT_VIDEO, 'tour-auditorios.mp4');
  const common = ['-hide_banner', '-loglevel', 'error', '-y', ...inputs, '-filter_complex', filter, '-map', `[${last}]`, '-an'];
  execFileSync('ffmpeg', [...common, '-c:v', 'libvpx-vp9', '-crf', '42', '-b:v', '520k', '-maxrate', '640k', '-bufsize', '1280k', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', webm], { stdio: 'inherit' });
  log(`tour-auditorios.webm ${kb(webm)}`);
  execFileSync('ffmpeg', [...common, '-c:v', 'libx264', '-crf', '29', '-maxrate', '700k', '-bufsize', '1400k', '-preset', 'slow', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], { stdio: 'inherit' });
  log(`tour-auditorios.mp4 ${kb(mp4)}`);
  // poster = primeiro quadro, em AVIF/WebP
  const posterPng = join(OUT_VIDEO, 'poster.png');
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', mp4, '-frames:v', '1', posterPng]);
  return sharp(posterPng)
    .webp({ quality: 70 })
    .toFile(join(OUT_VIDEO, 'tour-poster.webp'))
    .then(() => sharp(posterPng).avif({ quality: 48 }).toFile(join(OUT_VIDEO, 'tour-poster.avif')))
    .then(() => {
      execFileSync(process.platform === 'win32' ? 'cmd' : 'rm', process.platform === 'win32' ? ['/c', 'del', posterPng] : [posterPng]);
      log('tour-poster.avif/.webp');
    });
}

function fonts() {
  console.log('Fontes');
  const list = [
    ['@fontsource-variable/newsreader/files/newsreader-latin-wght-normal.woff2', 'newsreader-var.woff2'],
    ['@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-normal.woff2', 'hanken-grotesk-var.woff2'],
  ];
  const py = spawnSync('python', ['-c', 'import fontTools, brotli'], { stdio: 'ignore' }).status === 0;
  for (const [from, to] of list) {
    const src = join(root, 'node_modules', from);
    const dest = join(OUT_FONTS, to);
    if (!existsSync(src)) throw new Error(`Fonte não encontrada: ${src} (rode npm install)`);
    if (py) {
      execFileSync('python', [
        '-m',
        'fontTools.subset',
        src,
        `--output-file=${dest}`,
        '--flavor=woff2',
        // Latin-1 (todo o português), aspas tipográficas, travessões, reticências, €, ™, setas, sinal de menos
        '--unicodes=U+0020-007E,U+00A0-00FF,U+0152-0153,U+2013-2014,U+2018-201E,U+2022,U+2026,U+2032-2033,U+20AC,U+2122,U+2190-2193,U+2212',
        '--layout-features=kern,liga,calt,ccmp,locl,mark,mkmk,lnum,onum,tnum,pnum,case',
        '--no-hinting',
        '--desubroutinize',
      ]);
    } else {
      copyFileSync(src, dest);
    }
    log(`${to}: ${kb(src)} -> ${kb(dest)}`);
  }
}

await photos();
await ogImage();
await icons();
fonts();
await video();
console.log('Pronto.');
