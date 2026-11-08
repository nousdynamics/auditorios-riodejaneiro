import type { Faq, FaqInput, FaqScope } from '../../../shared/types';
import { ApiFailure, api, errorMessage } from '../api';
import { busy, confirmDialog, emptyState, field, h, iconButton, mount, pageHead, select, showFieldErrors, textArea, textInput, toast, toggle } from '../dom';
import type { ViewCtx } from '../router';

const SCOPES: { value: FaqScope; label: string }[] = [
  { value: 'home', label: 'Página inicial' },
  { value: 'corporativo', label: 'Pacote corporativo' },
];

export async function faqsView(ctx: ViewCtx): Promise<void> {
  const res = await api<{ items: Faq[] }>('GET', '/faqs', undefined, { signal: ctx.signal });
  let faqs = res.items;
  const body = h('div', { class: 'stack-lg' });
  const formHost = h('div');

  const persistOrder = async (previous: Faq[]) => {
    try {
      await api('POST', '/faqs/reorder', { ids: faqs.map((f) => f.id) });
    } catch (e) {
      faqs = previous;
      draw();
      toast(errorMessage(e), 'error');
    }
  };

  const move = (faq: Faq, dir: -1 | 1) => {
    const group = faqs.filter((f) => f.scope === faq.scope);
    const gi = group.findIndex((f) => f.id === faq.id);
    const other = group[gi + dir];
    if (!other) return;
    const previous = faqs;
    const next = faqs.slice();
    const a = next.findIndex((f) => f.id === faq.id);
    const b = next.findIndex((f) => f.id === other.id);
    next[a] = other;
    next[b] = faq;
    faqs = next;
    draw();
    body.querySelector<HTMLElement>(`[data-id="${faq.id}"] [data-move="${dir < 0 ? 'up' : 'down'}"]:not([disabled])`)?.focus();
    void persistOrder(previous);
  };

  const openForm = (faq: Faq | null, scope: FaqScope) => {
    const question = textInput(faq?.question ?? '', { maxlength: '200', required: true });
    const answer = textArea(faq?.answer ?? '', 5, { maxlength: '1500' });
    const scopeSel = select(SCOPES, faq?.scope ?? scope);
    const pub = toggle('Publicada no site', faq?.isPublished ?? true);
    const submit = h('button', { type: 'submit', class: 'btn btn-primary' }, 'Salvar pergunta');
    const form = h(
      'form',
      { class: 'panel stack', novalidate: true },
      h('h2', null, faq ? 'Editar pergunta' : 'Nova pergunta'),
      field('Pergunta', question, { name: 'question', required: true, counterMax: 200 }),
      field('Resposta', answer, { name: 'answer', required: true, counterMax: 1500 }),
      field('Onde aparece', scopeSel, { name: 'scope' }),
      pub.el,
      h('div', { class: 'form-actions' }, submit, h('button', { type: 'button', class: 'btn', onclick: () => mount(formHost) }, 'Cancelar')),
    );
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      void busy(submit, 'Salvando…', async () => {
        const input: FaqInput = { question: question.value.trim(), answer: answer.value.trim(), scope: scopeSel.value as FaqScope, isPublished: pub.input.checked };
        try {
          if (faq) {
            const upd = await api<Faq>('PUT', `/faqs/${encodeURIComponent(faq.id)}`, input);
            faqs = faqs.map((f) => (f.id === upd.id ? upd : f));
          } else {
            const created = await api<Faq>('POST', '/faqs', input);
            faqs = [...faqs, created];
          }
          toast('Pergunta salva');
          mount(formHost);
          draw();
        } catch (e) {
          const rest = showFieldErrors(form, e instanceof ApiFailure ? e.fields : undefined);
          toast(errorMessage(e) + (rest.length ? ` ${rest.join(' ')}` : ''), 'error');
        }
      });
    });
    mount(formHost, form);
    question.focus();
    form.scrollIntoView({ block: 'nearest' });
  };

  const remove = async (faq: Faq) => {
    const ok = await confirmDialog({ title: 'Excluir esta pergunta?', message: `"${faq.question}" será removida do site. Esta ação não pode ser desfeita.`, confirmLabel: 'Excluir pergunta', danger: true });
    if (!ok) return;
    try {
      await api('DELETE', `/faqs/${encodeURIComponent(faq.id)}`);
      faqs = faqs.filter((f) => f.id !== faq.id);
      draw();
      toast('Pergunta excluída');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const item = (faq: Faq, i: number, n: number): HTMLElement => {
    const sw = toggle(faq.isPublished ? 'Publicada' : 'Oculta', faq.isPublished);
    const label = sw.el.querySelector('.switch-label') as HTMLElement;
    sw.input.setAttribute('aria-label', `Publicar a pergunta "${faq.question}"`);
    sw.input.addEventListener('change', () => {
      const want = sw.input.checked;
      label.textContent = want ? 'Publicada' : 'Oculta';
      sw.input.disabled = true;
      const input: FaqInput = { question: faq.question, answer: faq.answer, scope: faq.scope, isPublished: want };
      api<Faq>('PUT', `/faqs/${encodeURIComponent(faq.id)}`, input)
        .then((upd) => {
          faq.isPublished = upd.isPublished;
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
    return h(
      'li',
      { class: 'faq-row', 'data-id': faq.id },
      h('div', { class: 'faq-main' }, h('strong', null, faq.question), h('p', null, faq.answer)),
      sw.el,
      h(
        'div',
        { class: 'row-actions' },
        iconButton('up', `Subir "${faq.question}"`, () => move(faq, -1), { 'data-move': 'up', disabled: i === 0 }),
        iconButton('down', `Descer "${faq.question}"`, () => move(faq, 1), { 'data-move': 'down', disabled: i === n - 1 }),
        h('button', { type: 'button', class: 'btn', onclick: () => openForm(faq, faq.scope) }, 'Editar'),
        h('button', { type: 'button', class: 'btn btn-danger-ghost', onclick: () => void remove(faq) }, 'Excluir'),
      ),
    );
  };

  function draw() {
    mount(
      body,
      SCOPES.map((s) => {
        const group = faqs.filter((f) => f.scope === s.value);
        return h(
          'section',
          { class: 'panel' },
          h('div', { class: 'panel-head' }, h('h2', null, s.label), h('button', { type: 'button', class: 'btn', onclick: () => openForm(null, s.value) }, 'Nova pergunta')),
          group.length ? h('ul', { class: 'faq-list' }, group.map((f, i) => item(f, i, group.length))) : emptyState('Nenhuma pergunta neste grupo ainda.'),
        );
      }),
    );
  }
  draw();
  mount(ctx.root, pageHead('Perguntas frequentes'), h('p', { class: 'lead' }, 'As perguntas aparecem no site na ordem abaixo. Use as setas para reordenar dentro de cada grupo.'), formHost, body);
}
