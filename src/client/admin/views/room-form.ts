import { AMENITIES, LAYOUTS, ROOM_TYPES } from '../../../shared/catalog';
import type { AmenityId, LayoutId, Layouts, Room, RoomInput } from '../../../shared/types';
import { ApiFailure, api, errorMessage } from '../api';
import { busy, checkbox, field, h, mount, pageHead, select, showFieldErrors, slugify, textArea, textInput, toNumber, toast, toggle } from '../dom';
import type { ViewCtx } from '../router';
import { createPhotoManager } from './photos';

const numStr = (n: number | null): string => (n === null ? '' : String(n).replace('.', ','));

function section(title: string, ...children: (Node | null)[]): HTMLElement {
  return h('section', { class: 'panel form-section' }, h('h2', null, title), ...children);
}

export async function roomFormView(ctx: ViewCtx): Promise<void> {
  const id = ctx.params[0];
  const isNew = !id;
  let room: Room | null = null;
  if (id) room = await api<Room>('GET', `/rooms/${encodeURIComponent(id)}`, undefined, { signal: ctx.signal });

  const form = h('form', { class: 'room-form', novalidate: true });

  // ---- Identificação
  const name = textInput(room?.name ?? '', { maxlength: '80', required: true, autocomplete: 'off' });
  const slug = textInput(room?.slug ?? '', { maxlength: '80', autocomplete: 'off', spellcheck: 'false' });
  let slugTouched = Boolean(room);
  name.addEventListener('input', () => {
    if (!slugTouched) {
      slug.value = slugify(name.value);
      updatePreview();
    }
  });
  slug.addEventListener('input', () => {
    slugTouched = true;
    updatePreview();
  });
  const roomType = select(
    ROOM_TYPES.concat(room && !ROOM_TYPES.includes(room.roomType) ? [room.roomType] : []).map((t) => ({ value: t, label: t })),
    room?.roomType ?? ROOM_TYPES[0] ?? '',
  );
  const tagline = textInput(room?.tagline ?? '', { maxlength: '120' });
  const floor = textInput(room?.floor ?? '', { maxlength: '40', placeholder: 'Ex.: 13º andar' });

  // ---- Capacidade
  const capacityMin = textInput(numStr(room?.capacityMin ?? null), { type: 'number', min: '1', max: '2000', inputmode: 'numeric' });
  const capacityMax = textInput(numStr(room?.capacityMax ?? null), { type: 'number', min: '1', max: '2000', inputmode: 'numeric', required: true });
  const areaM2 = textInput(numStr(room?.areaM2 ?? null), { inputmode: 'decimal', placeholder: 'Ex.: 60' });

  const layoutRows: { id: LayoutId; check: HTMLInputElement; cap: HTMLInputElement }[] = [];
  const layoutBox = h('div', { class: 'layouts' });
  for (const [lid, meta] of Object.entries(LAYOUTS) as [LayoutId, { label: string; hint: string }][]) {
    const has = room ? lid in room.layouts : false;
    const cur = room?.layouts[lid] ?? null;
    const c = checkbox(`${meta.label} disponível`, has);
    const cap = textInput(numStr(cur), { type: 'number', min: '1', max: '2000', name: `layouts.${lid}`, disabled: !has, 'aria-label': `Capacidade no formato ${meta.label} (opcional)`, placeholder: 'Capacidade (opcional)' });
    c.input.addEventListener('change', () => {
      cap.disabled = !c.input.checked;
      if (!c.input.checked) cap.value = '';
    });
    layoutRows.push({ id: lid, check: c.input, cap });
    layoutBox.appendChild(
      h('div', { class: 'layout-row' }, h('div', null, c.el, h('small', { class: 'hint' }, meta.hint)), h('div', { class: 'layout-cap' }, cap, h('p', { class: 'err', 'data-err': `layouts.${lid}` }))),
    );
  }

  // ---- Recursos
  const amenityInputs: { id: AmenityId; input: HTMLInputElement }[] = [];
  const amenityBox = h('div', { class: 'check-grid' });
  for (const [aid, meta] of Object.entries(AMENITIES) as [AmenityId, { label: string }][]) {
    const c = checkbox(meta.label, room?.amenities.includes(aid) ?? false);
    amenityInputs.push({ id: aid, input: c.input });
    amenityBox.appendChild(c.el);
  }

  // ---- Textos
  const summary = textArea(room?.summary ?? '', 3, { maxlength: '400' });
  const description = textArea(room?.description ?? '', 10, { maxlength: '7000' });

  // ---- Valores
  const priceHour = textInput(numStr(room?.priceHour ?? null), { inputmode: 'decimal' });
  const priceShift = textInput(numStr(room?.priceShift ?? null), { inputmode: 'decimal' });
  const priceDay = textInput(numStr(room?.priceDay ?? null), { inputmode: 'decimal' });
  const showPrices = toggle("Mostrar valores no site (desligado = 'sob consulta')", room?.showPrices ?? false);
  const money = (label: string, input: HTMLInputElement, n: string) => field(label, input, { name: n, cls: 'money', hint: 'Em reais. Deixe vazio se não houver.' });

  // ---- Publicação
  const isAvailable = toggle('Publicada no site', room?.isAvailable ?? true);
  const isFeatured = toggle('Destaque na página inicial', room?.isFeatured ?? false);

  // ---- SEO
  const seoTitle = textInput(room?.seoTitle ?? '', { maxlength: '90' });
  const seoDescription = textArea(room?.seoDescription ?? '', 3, { maxlength: '220' });
  const pvTitle = h('p', { class: 'snip-title' });
  const pvUrl = h('p', { class: 'snip-url' });
  const pvDesc = h('p', { class: 'snip-desc' });
  const updatePreview = () => {
    pvTitle.textContent = (seoTitle.value.trim() || name.value.trim() || 'Nome da sala').slice(0, 70);
    pvUrl.textContent = `${location.host} › auditorios › ${slug.value || slugify(name.value) || 'nome-da-sala'}`;
    pvDesc.textContent = (seoDescription.value.trim() || summary.value.trim() || 'O resumo da sala aparece aqui quando a descrição para o Google fica em branco.').slice(0, 170);
  };
  for (const el of [seoTitle, seoDescription, summary, name]) el.addEventListener('input', updatePreview);

  // ---- Fotos
  const refreshDirty = () => {
    const d = dirty();
    flag.textContent = d ? 'Alterações não salvas' : '';
  };
  const pm = createPhotoManager(room?.photos ?? [], room?.id ?? 'nova', refreshDirty);

  // ---- Coleta
  const collect = (): RoomInput => {
    const layouts: Layouts = {};
    for (const r of layoutRows) if (r.check.checked) layouts[r.id] = toNumber(r.cap.value);
    const input: RoomInput = {
      slug: slug.value.trim(),
      name: name.value.trim(),
      tagline: tagline.value.trim(),
      summary: summary.value.trim(),
      description: description.value.trim(),
      roomType: roomType.value,
      floor: floor.value.trim(),
      capacityMin: toNumber(capacityMin.value),
      capacityMax: toNumber(capacityMax.value) ?? 0,
      areaM2: toNumber(areaM2.value),
      layouts,
      amenities: amenityInputs.filter((a) => a.input.checked).map((a) => a.id),
      photos: pm.getPhotos(),
      priceHour: toNumber(priceHour.value),
      priceShift: toNumber(priceShift.value),
      priceDay: toNumber(priceDay.value),
      showPrices: showPrices.input.checked,
      isAvailable: isAvailable.input.checked,
      isFeatured: isFeatured.input.checked,
      seoTitle: seoTitle.value.trim(),
      seoDescription: seoDescription.value.trim(),
    };
    return input;
  };
  const snap = () => JSON.stringify(collect());
  let baseline = '';
  const dirty = () => snap() !== baseline;

  const flag = h('span', { class: 'dirty-flag', role: 'status' });
  const conflict = h('div', { class: 'banner banner-error', role: 'alert', hidden: true });
  const submit = h('button', { type: 'submit', class: 'btn btn-primary' }, 'Salvar sala');

  const clientValidate = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!name.value.trim()) errs.name = 'Informe o nome da sala.';
    const max = toNumber(capacityMax.value);
    const min = toNumber(capacityMin.value);
    if (!max || max < 1 || max > 2000) errs.capacityMax = 'Informe a capacidade máxima (de 1 a 2000).';
    if (min !== null && max && min > max) errs.capacityMin = 'A mínima não pode passar da máxima.';
    if (summary.value.length > 320) errs.summary = 'O resumo passou de 320 caracteres. Encurte o texto.';
    if (description.value.length > 6000) errs.description = 'A descrição passou de 6000 caracteres. Encurte o texto.';
    if (seoTitle.value.length > 70) errs.seoTitle = 'O título para o Google passou de 70 caracteres.';
    if (seoDescription.value.length > 170) errs.seoDescription = 'A descrição para o Google passou de 170 caracteres.';
    return errs;
  };

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    conflict.hidden = true;
    const local = clientValidate();
    if (Object.keys(local).length) {
      showFieldErrors(form, local);
      toast('Revise os campos marcados e salve de novo.', 'error');
      return;
    }
    if (pm.isUploading()) {
      toast('Aguarde o fim do envio das fotos antes de salvar.', 'error');
      return;
    }
    void busy(submit, 'Salvando…', async () => {
      const body = collect();
      try {
        showFieldErrors(form, {});
        let saved: Room;
        if (isNew) saved = await api<Room>('POST', '/rooms', body);
        else {
          body.expectedUpdatedAt = room?.updatedAt;
          saved = await api<Room>('PUT', `/rooms/${encodeURIComponent(id as string)}`, body);
        }
        toast('Sala salva');
        if (isNew) {
          ctx.setGuard(null);
          ctx.navigate(`#/salas/${encodeURIComponent(saved.id)}`);
          return;
        }
        room = saved;
        slug.value = saved.slug;
        baseline = snap();
        refreshDirty();
      } catch (e) {
        const fe = e instanceof ApiFailure ? e : null;
        if (fe?.status === 409 && !fe.fields) {
          conflict.hidden = false;
          mount(
            conflict,
            h('p', null, fe.message),
            h('button', { type: 'button', class: 'btn', onclick: () => { ctx.setGuard(null); void roomFormView(ctx); } }, 'Recarregar'),
          );
          conflict.scrollIntoView({ block: 'center' });
        }
        const rest = showFieldErrors(form, fe?.fields);
        toast(errorMessage(e) + (rest.length ? ` ${rest.join(' ')}` : ''), 'error');
      }
    });
  });
  form.addEventListener('input', refreshDirty);
  form.addEventListener('change', refreshDirty);

  mount(
    form,
    conflict,
    section(
      'Identificação',
      h(
        'div',
        { class: 'grid-form' },
        field('Nome da sala', name, { name: 'name', required: true, counterMax: 80 }),
        field('Endereço na web (slug)', slug, { name: 'slug', hint: 'Gerado a partir do nome. Mude só se precisar; links antigos deixam de funcionar.' }),
        field('Tipo de espaço', roomType, { name: 'roomType' }),
        field('Frase de apresentação', tagline, { name: 'tagline', counterMax: 120, hint: 'Ex.: Para ensinar e compartilhar.' }),
        field('Andar', floor, { name: 'floor', hint: 'Deixe vazio para não exibir.' }),
      ),
    ),
    section(
      'Capacidade e espaço',
      h(
        'div',
        { class: 'grid-form' },
        field('Capacidade mínima', capacityMin, { name: 'capacityMin' }),
        field('Capacidade máxima', capacityMax, { name: 'capacityMax', required: true }),
        field('Área (m²)', areaM2, { name: 'areaM2' }),
      ),
      h('h3', null, 'Formatos de montagem'),
      h('p', { class: 'hint' }, 'Marque os formatos possíveis. Se souber, informe quantas pessoas cabem em cada um.'),
      layoutBox,
    ),
    section('Recursos', amenityBox, h('p', { class: 'err', 'data-err': 'amenities' })),
    section(
      'Textos',
      field('Resumo', summary, { name: 'summary', counterMax: 320, hint: '1 ou 2 frases. Aparece nos cards e na busca.' }),
      field('Descrição', description, { name: 'description', counterMax: 6000, hint: 'Separe parágrafos com uma linha em branco.' }),
    ),
    section(
      'Valores',
      h('div', { class: 'grid-form' }, money('Valor por hora (R$)', priceHour, 'priceHour'), money('Valor por turno (R$)', priceShift, 'priceShift'), money('Valor da diária (R$)', priceDay, 'priceDay')),
      showPrices.el,
    ),
    section('Publicação', h('div', { class: 'stack-sm' }, isAvailable.el, isFeatured.el)),
    section(
      'SEO (aparece no Google)',
      field('Título para o Google', seoTitle, { name: 'seoTitle', counterMax: 70, hint: 'Vazio = usa o nome da sala.' }),
      field('Descrição para o Google', seoDescription, { name: 'seoDescription', counterMax: 170, hint: 'Vazio = usa o resumo.' }),
      h('div', { class: 'snippet', 'aria-label': 'Prévia no Google' }, pvUrl, pvTitle, pvDesc),
    ),
    section('Fotos', pm.el),
    h(
      'div',
      { class: 'savebar' },
      h('div', { class: 'savebar-inner' }, flag, h('a', { class: 'btn', href: '#/salas' }, 'Cancelar'), submit),
    ),
  );
  updatePreview();
  mount(
    ctx.root,
    pageHead(
      isNew ? 'Nova sala' : `Editar sala`,
      room ? h('a', { class: 'btn', href: `/auditorios/${encodeURIComponent(room.slug)}`, target: '_blank', rel: 'noopener' }, 'Ver no site') : null,
    ),
    form,
  );
  baseline = snap();
  ctx.setGuard(dirty);
  name.focus();
}
