/**
 * Validação de tudo que entra pela API. Funções puras (testadas em tests/validate.test.ts).
 * Cada uma devolve o valor normalizado ou lança HttpError(422) com erros por campo.
 */
import { AMENITY_IDS, LAYOUT_IDS } from '../shared/catalog';
import type { AmenityId, FaqInput, LeadChannel, LeadInput, Layouts, LeadStatus, Photo, RoomInput, SiteSettings, UserRole } from '../shared/types';
import { HttpError } from './lib/http';

type Obj = Record<string, unknown>;

class Errors {
  fields: Record<string, string> = {};
  add(field: string, msg: string) {
    this.fields[field] ??= msg;
  }
  throwIfAny(message = 'Revise os campos destacados.') {
    if (Object.keys(this.fields).length) throw new HttpError(422, message, this.fields);
  }
}

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function str(o: Obj, key: string, errors: Errors, { max = 500, required = false, label = key, field = key } = {}): string {
  const v = o[key];
  key = field;
  if (v === undefined || v === null) {
    if (required) errors.add(key, `Informe ${label}.`);
    return '';
  }
  if (typeof v !== 'string') {
    errors.add(key, `${label} inválido.`);
    return '';
  }
  // remove caracteres de controle (exceto quebra de linha e tab)
  const s = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (required && !s) errors.add(key, `Informe ${label}.`);
  if (s.length > max) errors.add(key, `Use no máximo ${max} caracteres.`);
  return s.slice(0, max);
}

function num(o: Obj, key: string, errors: Errors, { min = 0, max = 1e9, integer = false, nullable = true, label = key, field = key } = {}): number | null {
  const v = o[key];
  key = field;
  if (v === undefined || v === null || v === '') {
    if (!nullable) errors.add(key, `Informe ${label}.`);
    return null;
  }
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) {
    errors.add(key, `${label}: use um número entre ${min} e ${max}.`);
    return null;
  }
  return n;
}

const bool = (o: Obj, key: string, fallback = false) => (typeof o[key] === 'boolean' ? (o[key] as boolean) : fallback);

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function validatePhotos(value: unknown, errors: Errors): Photo[] {
  if (!Array.isArray(value)) return [];
  if (value.length > 24) errors.add('photos', 'Use no máximo 24 fotos por sala.');
  const out: Photo[] = [];
  for (const p of value.slice(0, 24)) {
    if (!isObj(p) || typeof p.src !== 'string') continue;
    const src = p.src;
    const ok = /^static:[a-z0-9-]+$/.test(src) || /^r2:rooms\/[A-Za-z0-9-]+\/[A-Za-z0-9-]+$/.test(src);
    if (!ok) {
      errors.add('photos', 'Foto com endereço inválido.');
      continue;
    }
    out.push({
      src,
      alt: typeof p.alt === 'string' ? p.alt.trim().slice(0, 200) : '',
      w: Number.isFinite(p.w) ? Math.max(1, Math.round(p.w as number)) : 1600,
      h: Number.isFinite(p.h) ? Math.max(1, Math.round(p.h as number)) : 1200,
    });
  }
  return out;
}

export function validateRoom(body: unknown): RoomInput {
  if (!isObj(body)) throw new HttpError(400, 'Dados da sala inválidos.');
  const e = new Errors();
  const name = str(body, 'name', e, { max: 80, required: true, label: 'o nome da sala' });
  const slugRaw = str(body, 'slug', e, { max: 80 });
  const slug = slugify(slugRaw || name);
  if (!slug) e.add('slug', 'Informe um slug com letras ou números.');
  const capacityMax = num(body, 'capacityMax', e, { min: 1, max: 2000, integer: true, nullable: false, label: 'Capacidade máxima' }) ?? 0;
  const capacityMin = num(body, 'capacityMin', e, { min: 1, max: 2000, integer: true, label: 'Capacidade mínima' });
  if (capacityMin !== null && capacityMax && capacityMin > capacityMax) e.add('capacityMin', 'A mínima não pode passar da máxima.');

  const layouts: Layouts = {};
  if (isObj(body.layouts)) {
    for (const id of LAYOUT_IDS) {
      if (!(id in body.layouts)) continue;
      const v = body.layouts[id];
      if (v === null || v === '' || v === undefined) layouts[id] = null;
      else {
        const n = Number(v);
        if (Number.isInteger(n) && n > 0 && n <= 2000) layouts[id] = n;
        else e.add(`layouts.${id}`, 'Capacidade inválida.');
      }
    }
  }
  const amenities = Array.isArray(body.amenities)
    ? ([...new Set(body.amenities)].filter((a) => AMENITY_IDS.includes(a as AmenityId)) as AmenityId[])
    : [];

  const input: RoomInput = {
    slug,
    name,
    tagline: str(body, 'tagline', e, { max: 120 }),
    summary: str(body, 'summary', e, { max: 320 }),
    description: str(body, 'description', e, { max: 6000 }),
    roomType: str(body, 'roomType', e, { max: 60 }) || 'Auditório',
    floor: str(body, 'floor', e, { max: 40 }),
    capacityMin,
    capacityMax,
    areaM2: num(body, 'areaM2', e, { min: 1, max: 100000, label: 'Área' }),
    layouts,
    amenities,
    photos: validatePhotos(body.photos, e),
    priceHour: num(body, 'priceHour', e, { min: 0, max: 1e6, label: 'Valor por hora' }),
    priceShift: num(body, 'priceShift', e, { min: 0, max: 1e6, label: 'Valor por turno' }),
    priceDay: num(body, 'priceDay', e, { min: 0, max: 1e6, label: 'Valor da diária' }),
    showPrices: bool(body, 'showPrices'),
    isAvailable: bool(body, 'isAvailable', true),
    isFeatured: bool(body, 'isFeatured'),
    seoTitle: str(body, 'seoTitle', e, { max: 70 }),
    seoDescription: str(body, 'seoDescription', e, { max: 170 }),
  };
  if (typeof body.expectedUpdatedAt === 'string') input.expectedUpdatedAt = body.expectedUpdatedAt;
  e.throwIfAny();
  return input;
}

function infoItems(value: unknown, field: string, e: Errors, max = 8) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, max)
    .filter(isObj)
    .map((it, i) => ({
      title: str(it, 'title', e, { max: 80, label: 'o título', field: `${field}.${i}.title` }),
      text: str(it, 'text', e, { max: 400, label: 'o texto', field: `${field}.${i}.text` }),
    }))
    .filter((it) => it.title || it.text);
}

export function validateSettings(body: unknown): SiteSettings {
  if (!isObj(body)) throw new HttpError(400, 'Configurações inválidas.');
  const e = new Errors();
  const address = isObj(body.address) ? body.address : {};
  const hero = isObj(body.hero) ? body.hero : {};
  const stats = isObj(body.stats) ? body.stats : {};
  const corporate = isObj(body.corporate) ? body.corporate : {};
  const location = isObj(body.location) ? body.location : {};
  const social = isObj(body.social) ? body.social : {};

  const whatsapp = str(body, 'whatsapp', e, { max: 20, required: true, label: 'o WhatsApp' }).replace(/\D/g, '');
  if (whatsapp && (whatsapp.length < 12 || whatsapp.length > 13)) e.add('whatsapp', 'Use DDI + DDD + número, ex.: 5521967770445.');
  const email = str(body, 'email', e, { max: 120, required: true, label: 'o e-mail' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.add('email', 'E-mail inválido.');

  const url = (o: Obj, key: string) => {
    const v = str(o, key, e, { max: 200, field: `social.${key}` });
    if (v && !/^https:\/\/[^\s]+$/.test(v)) e.add(`social.${key}`, 'Use um link completo começando com https://');
    return v;
  };
  const coord = (key: 'lat' | 'lng', limit: number) => {
    const v = num(address, key, e, { min: -limit, max: limit, label: key === 'lat' ? 'Latitude' : 'Longitude', field: `address.${key}` });
    return v;
  };

  const settings: SiteSettings = {
    brandName: str(body, 'brandName', e, { max: 60, required: true, label: 'o nome da marca' }),
    brandLine: str(body, 'brandLine', e, { max: 80 }),
    whatsapp,
    whatsappMessage: str(body, 'whatsappMessage', e, { max: 300 }),
    email,
    address: {
      street: str(address, 'street', e, { field: 'address.street', max: 120, required: true, label: 'o endereço' }),
      complement: str(address, 'complement', e, { field: 'address.complement', max: 120 }),
      neighborhood: str(address, 'neighborhood', e, { field: 'address.neighborhood', max: 80 }),
      city: str(address, 'city', e, { field: 'address.city', max: 80, required: true, label: 'a cidade' }),
      state: str(address, 'state', e, { field: 'address.state', max: 2 }).toUpperCase(),
      postalCode: str(address, 'postalCode', e, { field: 'address.postalCode', max: 9 }),
      lat: coord('lat', 90),
      lng: coord('lng', 180),
    },
    openingHours: str(body, 'openingHours', e, { max: 160 }),
    hero: {
      title: str(hero, 'title', e, { field: 'hero.title', max: 140, required: true, label: 'o título principal' }),
      intro: str(hero, 'intro', e, { field: 'hero.intro', max: 400 }),
      note: str(hero, 'note', e, { field: 'hero.note', max: 160 }),
    },
    stats: {
      capacityLabel: str(stats, 'capacityLabel', e, { field: 'stats.capacityLabel', max: 20 }),
      landmark: str(stats, 'landmark', e, { field: 'stats.landmark', max: 60 }),
    },
    uses: infoItems(body.uses, 'uses', e, 6),
    corporate: {
      title: str(corporate, 'title', e, { field: 'corporate.title', max: 120 }),
      text: str(corporate, 'text', e, { field: 'corporate.text', max: 800 }),
      facts: infoItems(corporate.facts, 'corporate.facts', e, 6),
    },
    location: {
      title: str(location, 'title', e, { field: 'location.title', max: 120 }),
      text: str(location, 'text', e, { field: 'location.text', max: 600 }),
      notes: infoItems(location.notes, 'location.notes', e, 6),
    },
    social: { instagram: url(social, 'instagram'), facebook: url(social, 'facebook'), linkedin: url(social, 'linkedin') },
  };
  e.throwIfAny();
  return settings;
}

export function validateFaq(body: unknown): FaqInput {
  if (!isObj(body)) throw new HttpError(400, 'Pergunta inválida.');
  const e = new Errors();
  const faq: FaqInput = {
    question: str(body, 'question', e, { max: 200, required: true, label: 'a pergunta' }),
    answer: str(body, 'answer', e, { max: 1500, required: true, label: 'a resposta' }),
    scope: body.scope === 'corporativo' ? 'corporativo' : 'home',
    isPublished: bool(body, 'isPublished', true),
  };
  e.throwIfAny();
  return faq;
}

const CHANNELS: LeadChannel[] = ['whatsapp', 'email', 'copia', 'formulario'];

export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits.slice(0, 15);
}

export function validateLead(body: unknown, today = new Date()): LeadInput {
  if (!isObj(body)) throw new HttpError(400, 'Dados da consulta inválidos.');
  const e = new Errors();
  const name = str(body, 'name', e, { max: 100, required: true, label: 'seu nome' });
  if (name && name.length < 2) e.add('name', 'Informe seu nome.');
  const email = str(body, 'email', e, { max: 120 });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.add('email', 'E-mail inválido.');
  const phone = normalizePhone(str(body, 'phone', e, { max: 30 }));
  if (phone && phone.length < 12) e.add('phone', 'Telefone incompleto: inclua o DDD.');
  const eventDate = str(body, 'eventDate', e, { max: 10, required: true, label: 'a data pretendida' });
  if (eventDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || Number.isNaN(Date.parse(eventDate))) e.add('eventDate', 'Data inválida.');
    else {
      const todayStr = today.toISOString().slice(0, 10);
      // tolera fuso: aceita até 1 dia antes de "hoje" em UTC
      const min = new Date(Date.parse(todayStr) - 864e5).toISOString().slice(0, 10);
      if (eventDate < min) e.add('eventDate', 'Escolha uma data a partir de hoje.');
    }
  }
  const people = num(body, 'people', e, { min: 1, max: 2000, integer: true, nullable: false, label: 'Número de participantes' }) ?? 0;
  const channel = CHANNELS.includes(body.channel as LeadChannel) ? (body.channel as LeadChannel) : 'formulario';
  const utm: Record<string, string> = {};
  if (isObj(body.utm)) {
    for (const [k, v] of Object.entries(body.utm).slice(0, 8)) {
      if (/^(utm_[a-z]+|gclid|fbclid|ref)$/.test(k) && typeof v === 'string') utm[k] = v.slice(0, 120);
    }
  }
  const lead: LeadInput = {
    name,
    email,
    phone,
    space: str(body, 'space', e, { max: 80, required: true, label: 'o espaço de interesse' }),
    activity: str(body, 'activity', e, { max: 80 }),
    eventDate,
    people,
    modality: str(body, 'modality', e, { max: 60 }),
    schedule: str(body, 'schedule', e, { max: 80, required: true, label: 'o horário e a duração' }),
    details: str(body, 'details', e, { max: 1500 }),
    channel,
    utm,
    page: str(body, 'page', e, { max: 200 }),
    website: typeof body.website === 'string' ? body.website : '',
    elapsedMs: typeof body.elapsedMs === 'number' ? body.elapsedMs : undefined,
  };
  e.throwIfAny();
  return lead;
}

const STATUSES: LeadStatus[] = ['novo', 'em_atendimento', 'fechado', 'perdido'];

export function validateLeadPatch(body: unknown): { status?: LeadStatus; notes?: string } {
  if (!isObj(body)) throw new HttpError(400, 'Dados inválidos.');
  const e = new Errors();
  const out: { status?: LeadStatus; notes?: string } = {};
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status as LeadStatus)) e.add('status', 'Status inválido.');
    else out.status = body.status as LeadStatus;
  }
  if (body.notes !== undefined) out.notes = str(body, 'notes', e, { max: 4000 });
  e.throwIfAny();
  return out;
}

export function validatePassword(password: unknown, field = 'password'): string {
  const e = new Errors();
  if (typeof password !== 'string' || password.length < 10) e.add(field, 'Use pelo menos 10 caracteres.');
  else if (password.length > 200) e.add(field, 'Senha longa demais.');
  e.throwIfAny();
  return password as string;
}

export function validateNewUser(body: unknown): { email: string; name: string; password: string; role: UserRole } {
  if (!isObj(body)) throw new HttpError(400, 'Dados inválidos.');
  const e = new Errors();
  const email = str(body, 'email', e, { max: 120, required: true, label: 'o e-mail' }).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.add('email', 'E-mail inválido.');
  const name = str(body, 'name', e, { max: 80, required: true, label: 'o nome' });
  e.throwIfAny();
  const password = validatePassword(body.password);
  return { email, name, password, role: body.role === 'admin' ? 'admin' : 'editor' };
}
