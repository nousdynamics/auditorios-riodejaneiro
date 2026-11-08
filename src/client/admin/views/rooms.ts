import type { Room } from '../../../shared/types';
import { api, errorMessage } from '../api';
import { confirmDialog, emptyState, h, icon, iconButton, moved, mount, pageHead, toast, toggle } from '../dom';
import { photoUrl } from './photos';
import type { ViewCtx } from '../router';
import { isAdmin } from '../state';

export async function roomsView(ctx: ViewCtx): Promise<void> {
  const res = await api<{ items: Room[] }>('GET', '/rooms', undefined, { signal: ctx.signal });
  let rooms = res.items;
  const list = h('ol', { class: 'rooms' });
  let dragId: string | null = null;

  const persistOrder = async (previous: Room[]) => {
    try {
      await api('POST', '/rooms/reorder', { ids: rooms.map((r) => r.id) });
      toast('Ordem salva');
    } catch (e) {
      rooms = previous;
      draw();
      toast(errorMessage(e), 'error');
    }
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= rooms.length || from === to) return;
    const previous = rooms;
    const id = rooms[from]?.id;
    rooms = moved(rooms, from, to);
    draw();
    list.querySelector<HTMLButtonElement>(`[data-id="${id}"] [data-move="${to > from ? 'down' : 'up'}"]:not([disabled])`)?.focus();
    void persistOrder(previous);
  };

  const remove = async (room: Room) => {
    const ok = await confirmDialog({
      title: `Excluir "${room.name}"?`,
      message: 'Esta ação não pode ser desfeita. A sala sai do site e todas as fotos enviadas para ela são removidas.',
      confirmLabel: 'Excluir sala',
      danger: true,
    });
    if (!ok) return;
    try {
      await api('DELETE', `/rooms/${encodeURIComponent(room.id)}`);
      rooms = rooms.filter((r) => r.id !== room.id);
      draw();
      toast('Sala excluída');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const row = (room: Room, i: number): HTMLElement => {
    const first = room.photos[0];
    const sw = toggle(room.isAvailable ? 'Publicada' : 'Oculta', room.isAvailable);
    const label = sw.el.querySelector('.switch-label') as HTMLElement;
    sw.input.setAttribute('aria-label', `Publicar ${room.name} no site`);
    sw.input.addEventListener('change', () => {
      const want = sw.input.checked;
      label.textContent = want ? 'Publicada' : 'Oculta';
      sw.input.disabled = true;
      api('PATCH', `/rooms/${encodeURIComponent(room.id)}/availability`, { isAvailable: want })
        .then(() => {
          room.isAvailable = want;
          toast(want ? 'Sala publicada' : 'Sala oculta');
        })
        .catch((e: unknown) => {
          sw.input.checked = !want;
          label.textContent = !want ? 'Publicada' : 'Oculta';
          toast(errorMessage(e), 'error');
        })
        .finally(() => {
          sw.input.disabled = false;
        });
    });
    const li = h(
      'li',
      { class: 'room-row', 'data-id': room.id, draggable: 'true' },
      h('span', { class: 'grip', 'aria-hidden': 'true' }, icon('grip')),
      first ? h('img', { class: 'thumb', src: photoUrl(first.src, 'sm'), alt: '', loading: 'lazy', width: '96', height: '64' }) : h('span', { class: 'thumb thumb-empty' }, 'Sem foto'),
      h(
        'div',
        { class: 'room-main' },
        h('a', { class: 'room-name', href: `#/salas/${encodeURIComponent(room.id)}` }, room.name),
        h('small', null, `${room.capacityMin ? `${room.capacityMin}–` : ''}${room.capacityMax} pessoas`),
        room.isFeatured ? h('span', { class: 'badge' }, 'Destaque') : null,
      ),
      sw.el,
      h(
        'div',
        { class: 'row-actions' },
        iconButton('up', `Subir ${room.name}`, () => move(i, i - 1), { 'data-move': 'up', disabled: i === 0 }),
        iconButton('down', `Descer ${room.name}`, () => move(i, i + 1), { 'data-move': 'down', disabled: i === rooms.length - 1 }),
        h('a', { class: 'btn', href: `#/salas/${encodeURIComponent(room.id)}` }, 'Editar'),
        h('a', { class: 'btn', href: `/auditorios/${encodeURIComponent(room.slug)}`, target: '_blank', rel: 'noopener' }, 'Ver no site', icon('external')),
        isAdmin() ? h('button', { type: 'button', class: 'btn btn-danger-ghost', onclick: () => void remove(room) }, 'Excluir') : null,
      ),
    );
    li.addEventListener('dragstart', (e) => {
      dragId = room.id;
      (e as DragEvent).dataTransfer?.setData('text/plain', room.id);
      li.classList.add('dragging');
    });
    li.addEventListener('dragend', () => {
      dragId = null;
      li.classList.remove('dragging');
      list.querySelectorAll('.drop-target').forEach((n) => n.classList.remove('drop-target'));
    });
    li.addEventListener('dragover', (e) => {
      if (!dragId) return;
      e.preventDefault();
      li.classList.add('drop-target');
    });
    li.addEventListener('dragleave', () => li.classList.remove('drop-target'));
    li.addEventListener('drop', (e) => {
      e.preventDefault();
      li.classList.remove('drop-target');
      if (!dragId) return;
      const from = rooms.findIndex((r) => r.id === dragId);
      move(from, i);
    });
    return li;
  };

  function draw() {
    if (!rooms.length) {
      mount(list, h('li', null, emptyState('Nenhuma sala cadastrada ainda.', h('a', { class: 'btn btn-primary', href: '#/salas/nova' }, 'Nova sala'))));
      return;
    }
    mount(list, rooms.map(row));
  }
  draw();

  mount(
    ctx.root,
    pageHead('Salas', h('a', { class: 'btn btn-primary', href: '#/salas/nova' }, icon('plus'), 'Nova sala')),
    h('p', { class: 'lead' }, 'Arraste as salas ou use as setas para mudar a ordem em que aparecem no site.'),
    list,
  );
}
