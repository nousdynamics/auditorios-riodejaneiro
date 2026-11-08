import type { Photo } from '../../../shared/types';
import { api, errorMessage } from '../api';
import { h, icon, iconButton, moved, mount, toast } from '../dom';

export const MAX_PHOTOS = 24;
const MAX_INPUT_BYTES = 25 * 1024 * 1024;
const MAX_VARIANT_BYTES = 5 * 1024 * 1024;

/** URL de pré-visualização de uma foto. */
export function photoUrl(src: string, size: 'sm' | 'lg' = 'sm'): string {
  if (src.startsWith('static:')) return `/assets/img/${src.slice(7)}-${size === 'sm' ? 480 : 800}.webp`;
  if (src.startsWith('r2:')) return `/media/${src.slice(3)}-${size === 'sm' ? 720 : 1600}.webp`;
  return src;
}

interface Variant {
  blob: Blob;
  w: number;
  h: number;
}

async function renderVariant(bmp: ImageBitmap, maxWidth: number): Promise<Variant> {
  const w = Math.min(maxWidth, bmp.width);
  const hh = Math.max(1, Math.round((bmp.height * w) / bmp.width));
  let blob: Blob | null;
  if (typeof OffscreenCanvas !== 'undefined') {
    const c = new OffscreenCanvas(w, hh);
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('Seu navegador não conseguiu preparar a imagem. Tente no Chrome, Edge ou Firefox.');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, w, hh);
    blob = await c.convertToBlob({ type: 'image/webp', quality: 0.82 });
  } else {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = hh;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('Seu navegador não conseguiu preparar a imagem. Tente no Chrome, Edge ou Firefox.');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, w, hh);
    blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/webp', 0.82));
  }
  if (!blob || blob.type !== 'image/webp') {
    throw new Error('Este navegador não gera imagens WebP. Envie as fotos pelo Chrome, Edge ou Firefox.');
  }
  if (blob.size > MAX_VARIANT_BYTES) throw new Error('A foto ficou grande demais mesmo depois de reduzida (máx. 5 MB). Use uma imagem menor.');
  return { blob, w, h: hh };
}

async function uploadFile(file: File, roomId: string): Promise<Photo> {
  if (file.size > MAX_INPUT_BYTES) throw new Error('Arquivo maior que 25 MB. Reduza o tamanho da foto e tente de novo.');
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Não foi possível abrir este arquivo como imagem. Use JPG, PNG, WebP ou AVIF.');
  }
  try {
    const lg = await renderVariant(bmp, 1600);
    const sm = await renderVariant(bmp, 720);
    const form = new FormData();
    form.append('lg', lg.blob, 'x.webp');
    form.append('sm', sm.blob, 'x.webp');
    form.append('w', String(lg.w));
    form.append('h', String(lg.h));
    form.append('roomId', roomId);
    return await api<Photo>('POST', '/uploads', form);
  } finally {
    bmp.close();
  }
}

interface Pending {
  id: number;
  name: string;
  state: 'enviando' | 'erro';
  message: string;
}

export interface PhotoManager {
  el: HTMLElement;
  getPhotos(): Photo[];
  isUploading(): boolean;
}

export function createPhotoManager(initial: Photo[], roomId: string, onChange: () => void): PhotoManager {
  let photos: Photo[] = initial.map((p) => ({ ...p }));
  let pending: Pending[] = [];
  let pid = 0;
  let dragIndex: number | null = null;

  const grid = h('ul', { class: 'photo-grid' });
  const status = h('p', { class: 'hint', role: 'status' });
  const errSlot = h('p', { class: 'err', 'data-err': 'photos' });
  const fileInput = h('input', { type: 'file', multiple: true, accept: 'image/jpeg,image/png,image/webp,image/avif', class: 'visually-hidden', id: 'photo-file', 'aria-describedby': 'photo-help' });
  const help = h('p', { class: 'hint', id: 'photo-help' }, `Até ${MAX_PHOTOS} fotos (JPG, PNG, WebP ou AVIF, até 25 MB cada). A primeira foto é a capa da sala.`);
  const drop = h(
    'label',
    { class: 'dropzone', for: 'photo-file' },
    icon('upload'),
    h('span', null, 'Escolher fotos ou arraste os arquivos até aqui'),
  );

  const changed = () => {
    onChange();
    draw();
  };

  const moveTo = (from: number, to: number, focusAction?: string) => {
    if (to < 0 || to >= photos.length || from === to) return;
    photos = moved(photos, from, to);
    changed();
    if (focusAction) grid.querySelectorAll<HTMLElement>('li')[to]?.querySelector<HTMLElement>(`[data-act="${focusAction}"]:not([disabled])`)?.focus();
  };

  const card = (p: Photo, i: number): HTMLElement => {
    const alt = h('input', { type: 'text', value: p.alt, maxlength: '200', placeholder: 'Ex.: Auditório com 80 cadeiras voltadas para a tela', 'aria-label': `Descrição da foto ${i + 1}`, 'aria-describedby': 'alt-hint' });
    alt.addEventListener('input', () => {
      p.alt = alt.value;
      onChange();
    });
    const li = h(
      'li',
      { class: `photo-card${i === 0 ? ' cover' : ''}`, draggable: 'true' },
      h('div', { class: 'photo-frame' }, h('img', { src: photoUrl(p.src, 'sm'), alt: '', loading: 'lazy' }), i === 0 ? h('span', { class: 'badge badge-cover' }, 'Capa') : null),
      alt,
      h(
        'div',
        { class: 'photo-actions' },
        iconButton('left', `Mover foto ${i + 1} para antes`, () => moveTo(i, i - 1, 'left'), { 'data-act': 'left', disabled: i === 0 }),
        iconButton('right', `Mover foto ${i + 1} para depois`, () => moveTo(i, i + 1, 'right'), { 'data-act': 'right', disabled: i === photos.length - 1 }),
        iconButton(
          'trash',
          `Remover foto ${i + 1}`,
          () => {
            photos = photos.filter((x) => x !== p);
            changed();
          },
          { class: 'btn btn-icon btn-danger-ghost' },
        ),
      ),
    );
    li.addEventListener('dragstart', () => {
      dragIndex = i;
      li.classList.add('dragging');
    });
    li.addEventListener('dragend', () => {
      dragIndex = null;
      li.classList.remove('dragging');
    });
    li.addEventListener('dragover', (e) => {
      if (dragIndex === null) return;
      e.preventDefault();
      li.classList.add('drop-target');
    });
    li.addEventListener('dragleave', () => li.classList.remove('drop-target'));
    li.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      li.classList.remove('drop-target');
      if (dragIndex !== null) moveTo(dragIndex, i);
    });
    return li;
  };

  const pendingCard = (p: Pending): HTMLElement =>
    h(
      'li',
      { class: `photo-card pending pending-${p.state}` },
      h('div', { class: 'photo-frame photo-frame-empty' }, p.state === 'enviando' ? 'Enviando…' : 'Erro no envio'),
      h('p', { class: 'photo-name' }, p.name),
      p.state === 'erro' ? h('p', { class: 'err', role: 'alert' }, p.message) : null,
      p.state === 'erro'
        ? h('button', { type: 'button', class: 'btn', onclick: () => { pending = pending.filter((x) => x.id !== p.id); draw(); } }, 'Dispensar')
        : null,
    );

  function draw() {
    mount(grid, photos.map(card), pending.map(pendingCard));
    const n = photos.length + pending.filter((p) => p.state === 'enviando').length;
    status.textContent = `${photos.length} ${photos.length === 1 ? 'foto' : 'fotos'}${n >= MAX_PHOTOS ? ' (limite atingido)' : ''}`;
    fileInput.disabled = n >= MAX_PHOTOS;
    drop.classList.toggle('disabled', n >= MAX_PHOTOS);
  }

  const addFiles = async (list: FileList | File[]) => {
    const files = Array.from(list);
    for (const file of files) {
      const used = photos.length + pending.filter((p) => p.state === 'enviando').length;
      if (used >= MAX_PHOTOS) {
        toast(`Limite de ${MAX_PHOTOS} fotos por sala. Remova alguma antes de enviar outra.`, 'error');
        break;
      }
      if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type)) {
        toast(`"${file.name}" não é JPG, PNG, WebP ou AVIF.`, 'error');
        continue;
      }
      if (file.size > MAX_INPUT_BYTES) {
        toast(`"${file.name}" tem mais de 25 MB. Reduza o tamanho e tente de novo.`, 'error');
        continue;
      }
      const item: Pending = { id: ++pid, name: file.name, state: 'enviando', message: '' };
      pending.push(item);
      draw();
      try {
        const photo = await uploadFile(file, roomId);
        pending = pending.filter((x) => x !== item);
        photos.push(photo);
        changed();
      } catch (e) {
        item.state = 'erro';
        item.message = errorMessage(e);
        draw();
      }
    }
  };

  fileInput.addEventListener('change', () => {
    if (fileInput.files) void addFiles(fileInput.files);
    fileInput.value = '';
  });
  drop.addEventListener('dragover', (e) => {
    if (dragIndex !== null) return;
    e.preventDefault();
    drop.classList.add('over');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    const files = (e as DragEvent).dataTransfer?.files;
    if (files?.length) void addFiles(files);
  });

  draw();
  const el = h(
    'div',
    { class: 'photos' },
    h('p', { class: 'hint', id: 'alt-hint' }, 'Descreva a foto para quem usa leitor de tela e para o Google.'),
    grid,
    status,
    errSlot,
    drop,
    fileInput,
    help,
  );
  return { el, getPhotos: () => photos.map((p) => ({ ...p })), isUploading: () => pending.some((p) => p.state === 'enviando') };
}
