import type { Photo } from '../shared/types';
import { newId } from './lib/crypto';
import { HttpError } from './lib/http';

/** Larguras geradas no navegador (painel) para fotos enviadas ao R2. */
export const R2_WIDTHS = { sm: 720, lg: 1600 } as const;
const MAX_BYTES = 5 * 1024 * 1024;

const isWebp = (b: Uint8Array) =>
  b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;

/** GET /media/<chave> — fotos do R2 com cache imutável (o nome do arquivo nunca é reaproveitado). */
export async function serveMedia(request: Request, env: Env, key: string): Promise<Response> {
  if (!/^rooms\/[A-Za-z0-9-]+\/[A-Za-z0-9-]+-(720|1600)\.webp$/.test(key)) return new Response('Not found', { status: 404 });
  const object = await env.MEDIA.get(key, { onlyIf: request.headers });
  if (!object) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('X-Content-Type-Options', 'nosniff');
  if (!('body' in object) || !object.body) return new Response(null, { status: 304, headers });
  return new Response(object.body, { headers });
}

/**
 * POST /api/admin/uploads (multipart): `lg` e `sm` (WebP já redimensionados no navegador),
 * `w`, `h` (dimensões da versão grande) e `roomId`.
 */
export async function handleUpload(request: Request, env: Env): Promise<Photo> {
  const len = Number(request.headers.get('Content-Length') ?? 0);
  if (len > MAX_BYTES * 2 + 10_000) throw new HttpError(413, 'Foto grande demais (máx. 5 MB por versão).');
  const form = await request.formData();
  const roomId = String(form.get('roomId') ?? 'nova').replace(/[^A-Za-z0-9-]/g, '').slice(0, 60) || 'nova';
  const w = Number(form.get('w'));
  const h = Number(form.get('h'));
  const files = { lg: form.get('lg'), sm: form.get('sm') };
  const key = `rooms/${roomId}/${newId().replace(/-/g, '')}`;
  const puts: Promise<unknown>[] = [];
  for (const [variant, file] of Object.entries(files)) {
    if (!file || typeof file === 'string') throw new HttpError(400, 'Envie as duas versões da foto.');
    if (file.size > MAX_BYTES) throw new HttpError(413, 'Foto grande demais (máx. 5 MB por versão).');
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!isWebp(bytes)) throw new HttpError(415, 'Formato inválido: o painel envia as fotos em WebP.');
    const width = R2_WIDTHS[variant as keyof typeof R2_WIDTHS];
    puts.push(
      env.MEDIA.put(`${key}-${width}.webp`, bytes, {
        httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' },
      }),
    );
  }
  await Promise.all(puts);
  return {
    src: `r2:${key}`,
    alt: '',
    w: Number.isFinite(w) && w > 0 ? Math.round(w) : 1600,
    h: Number.isFinite(h) && h > 0 ? Math.round(h) : 1200,
  };
}

/** Remove do R2 as fotos que saíram da sala. */
export async function deleteR2Photos(env: Env, photos: Photo[]): Promise<void> {
  const keys = photos
    .filter((p) => p.src.startsWith('r2:'))
    .flatMap((p) => Object.values(R2_WIDTHS).map((w) => `${p.src.slice(3)}-${w}.webp`));
  if (keys.length) await env.MEDIA.delete(keys);
}

/**
 * Vídeos estáticos com suporte a Range (206). O arquivo vem do binding ASSETS;
 * como são pequenos (~500 KB), o recorte é feito em memória.
 */
export async function serveVideo(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const asset = await env.ASSETS.fetch(new Request(url.toString(), { method: 'GET' }));
  if (!asset.ok) return asset;
  const type = url.pathname.endsWith('.webm') ? 'video/webm' : url.pathname.endsWith('.mp4') ? 'video/mp4' : asset.headers.get('Content-Type') ?? 'application/octet-stream';
  const headers = new Headers({
    'Content-Type': type,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=2592000',
    'X-Content-Type-Options': 'nosniff',
  });
  const etag = asset.headers.get('ETag');
  if (etag) headers.set('ETag', etag);
  const body = await asset.arrayBuffer();
  const size = body.byteLength;
  const range = request.headers.get('Range');
  const m = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (!m || (!m[1] && !m[2])) {
    headers.set('Content-Length', String(size));
    return new Response(request.method === 'HEAD' ? null : body, { headers });
  }
  let start = m[1] ? Number(m[1]) : size - Number(m[2]);
  let end = m[1] && m[2] ? Number(m[2]) : size - 1;
  start = Math.max(0, start);
  end = Math.min(end, size - 1);
  if (start > end || start >= size) {
    headers.set('Content-Range', `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Length', String(end - start + 1));
  return new Response(request.method === 'HEAD' ? null : body.slice(start, end + 1), { status: 206, headers });
}
