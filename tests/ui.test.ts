import { describe, expect, it } from 'vitest';
import type { Room, SiteSettings } from '../src/shared/types';
import { consultForm, corporateWhatsappMessage, roomWhatsappMessage } from '../src/worker/views/ui';

describe('formulário de consulta', () => {
  const settings = {} as SiteSettings;
  const rooms = [{ name: 'Auditório 1' }] as Room[];
  const requiredOf = (markup: string) => [...markup.matchAll(/<input id="(f-[a-z]+)"[^>]*\srequired/g)].map((m) => m[1]).sort();

  it('e-mail é opcional; obrigatórios são nome, WhatsApp, participantes e consentimento', () => {
    const markup = consultForm(settings, rooms).toString();
    expect(requiredOf(markup)).toEqual(['f-consent', 'f-name', 'f-people', 'f-phone']);
    expect(markup).toContain('E-mail <span class="opt">(opcional)</span>');
  });

  it('compacto deixa à vista só os obrigatórios e mantém os IDs usados pelo GTM', () => {
    const markup = consultForm(settings, rooms, { compact: true, submitLabel: 'Receber disponibilidade no WhatsApp' }).toString();
    const [visible, more] = markup.split('<details class="consult__more');
    expect(visible).toContain('id="f-name"');
    expect(visible).toContain('id="f-phone"');
    expect(visible).toContain('id="f-people"');
    for (const id of ['f-space', 'f-email', 'f-date', 'f-activity', 'f-details']) expect(more).toContain(`id="${id}"`);
    expect(markup).toContain('id="consult-form"');
    expect(markup).toContain('id="consult-result"');
    expect(markup).toContain('Receber disponibilidade no WhatsApp');
  });
});

describe('mensagens prontas do WhatsApp', () => {
  it('traz nome e capacidade da sala', () => {
    const msg = roomWhatsappMessage({ name: 'Auditório 1', capacityMin: 30, capacityMax: 50, floor: '' }, 'https://x.com.br/auditorios/auditorio-1');
    expect(msg).toBe('Olá! Quero o Auditório 1, para 30 a 50 pessoas.\nPode me passar a disponibilidade e os valores?\nhttps://x.com.br/auditorios/auditorio-1');
  });
  it('inclui o andar e ajusta artigo e capacidade máxima', () => {
    expect(roomWhatsappMessage({ name: 'Sala Rio', capacityMin: 0, capacityMax: 20, floor: '14º andar' })).toBe(
      'Olá! Quero a Sala Rio (14º andar), para até 20 pessoas.\nPode me passar a disponibilidade e os valores?',
    );
  });
  it('pacote corporativo', () => {
    expect(corporateWhatsappMessage()).toContain('pacote corporativo, com o andar completo');
  });
});
