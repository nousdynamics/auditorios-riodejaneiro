import { describe, expect, it } from 'vitest';
import { HttpError } from '../src/worker/lib/http';
import { normalizePhone, slugify, validateLead, validateRoom, validateSettings } from '../src/worker/validate';
import { DEFAULT_SETTINGS } from '../src/worker/db/seed';

const fieldsOf = (fn: () => unknown): Record<string, string> => {
  try {
    fn();
  } catch (err) {
    if (err instanceof HttpError) return err.fields ?? {};
    throw err;
  }
  throw new Error('esperava erro de validação');
};

describe('slugify', () => {
  it('remove acentos e símbolos', () => {
    expect(slugify('Auditório São Bento — 14º andar!')).toBe('auditorio-sao-bento-14-andar');
  });
});

describe('normalizePhone', () => {
  it('acrescenta o DDI 55 em números brasileiros', () => {
    expect(normalizePhone('(21) 96777-0445')).toBe('5521967770445');
    expect(normalizePhone('21 3333-4444')).toBe('552133334444');
  });
  it('mantém números que já têm DDI', () => {
    expect(normalizePhone('+55 21 96777-0445')).toBe('5521967770445');
  });
  it('vazio continua vazio', () => {
    expect(normalizePhone('')).toBe('');
  });
});

describe('validateLead', () => {
  const today = new Date('2026-11-08T12:00:00Z');
  const base = {
    name: 'Maria',
    email: 'maria@example.com',
    space: 'Auditório 1',
    activity: 'Aula ou curso',
    eventDate: '2026-12-01',
    people: 30,
    modality: 'Por hora',
    schedule: '9h às 13h',
    channel: 'formulario',
  };

  it('aceita uma consulta válida e normaliza o telefone', () => {
    const lead = validateLead({ ...base, phone: '(21) 99999-0000' }, today);
    expect(lead.phone).toBe('5521999990000');
    expect(lead.people).toBe(30);
  });

  it('exige e-mail válido', () => {
    expect(fieldsOf(() => validateLead({ ...base, email: '' }, today)).email).toBe('Informe seu e-mail.');
    expect(fieldsOf(() => validateLead({ ...base, email: 'maria@' }, today)).email).toBeDefined();
  });

  it('aponta os campos obrigatórios', () => {
    const fields = fieldsOf(() => validateLead({ channel: 'formulario' }, today));
    expect(Object.keys(fields)).toEqual(expect.arrayContaining(['name', 'email', 'space', 'eventDate', 'people', 'schedule']));
  });

  it('recusa data no passado', () => {
    expect(fieldsOf(() => validateLead({ ...base, eventDate: '2026-01-10' }, today)).eventDate).toBeDefined();
  });

  it('descarta UTM desconhecido e canal inválido', () => {
    const lead = validateLead({ ...base, channel: 'fax', utm: { utm_source: 'google', hack: '<script>' } }, today);
    expect(lead.channel).toBe('formulario');
    expect(lead.utm).toEqual({ utm_source: 'google' });
  });

  it('remove caracteres de controle', () => {
    expect(validateLead({ ...base, name: 'Ana\u0000 Paula' }, today).name).toBe('Ana Paula');
  });
});

describe('validateRoom', () => {
  const room = { name: 'Auditório 5', capacityMax: 40, photos: [], amenities: ['projetor', 'inexistente'] };

  it('gera slug a partir do nome e filtra recursos desconhecidos', () => {
    const input = validateRoom(room);
    expect(input.slug).toBe('auditorio-5');
    expect(input.amenities).toEqual(['projetor']);
    expect(input.isAvailable).toBe(true);
  });

  it('recusa capacidade mínima maior que a máxima', () => {
    expect(fieldsOf(() => validateRoom({ ...room, capacityMin: 60 })).capacityMin).toBeDefined();
  });

  it('só aceita fotos do projeto ou do R2', () => {
    const fields = fieldsOf(() => validateRoom({ ...room, photos: [{ src: 'https://evil.example/x.jpg', alt: '' }] }));
    expect(fields.photos).toBeDefined();
    const ok = validateRoom({ ...room, photos: [{ src: 'r2:rooms/sala-1/abc123', alt: 'Sala', w: 1600, h: 1200 }] });
    expect(ok.photos).toHaveLength(1);
  });

  it('formatos: vazio vira null (disponível sem capacidade)', () => {
    const input = validateRoom({ ...room, layouts: { auditorio: '', u: 20, banquete: 99 } });
    expect(input.layouts).toEqual({ auditorio: null, u: 20 });
  });
});

describe('validateSettings', () => {
  it('aceita as configurações padrão', () => {
    expect(validateSettings(DEFAULT_SETTINGS).whatsapp).toBe('5521967770445');
  });

  it('usa chaves com caminho para erros aninhados', () => {
    const fields = fieldsOf(() =>
      validateSettings({ ...DEFAULT_SETTINGS, hero: { ...DEFAULT_SETTINGS.hero, title: '' }, social: { instagram: 'http://x', facebook: '', linkedin: '' } }),
    );
    expect(fields['hero.title']).toBeDefined();
    expect(fields['social.instagram']).toBeDefined();
  });
});
