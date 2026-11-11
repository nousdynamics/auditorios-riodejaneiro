import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildLeadWebhookPayload, buildTrafficPayload, deliverLead, leadEnvironment } from '../src/worker/leads-webhook';
import type { Lead } from '../src/shared/types';

const lead: Lead = {
  id: 'abc-123',
  name: 'Maria Teste',
  email: 'maria@example.com',
  phone: '5521999998888',
  space: 'Auditório 2',
  activity: 'Curso',
  eventDate: '2026-12-10',
  people: 40,
  modality: 'Turno',
  schedule: 'Manhã',
  details: 'Precisamos de projetor.',
  channel: 'whatsapp',
  status: 'novo',
  notes: '',
  utm: { utm_source: 'google', utm_campaign: 'auditorios', gclid: 'x1' },
  page: '/auditorios/auditorio-2',
  createdAt: '2026-11-08T12:00:00.000Z',
  updatedAt: '2026-11-08T12:00:00.000Z',
} as Lead;

describe('payload do webhook de consultas', () => {
  it('gera linha plana no padrão dos leads do Yevent', () => {
    const p = buildLeadWebhookPayload(lead, 'https://www.exemplo.com.br');
    expect(p).toMatchObject({
      type: 'consulta_auditorio',
      environment: 'production',
      received_at: '2026-11-08T12:00:00.000Z',
      name: 'Maria Teste',
      phone: '5521999998888',
      whatsapp_url: 'https://wa.me/5521999998888',
      space_name: 'Auditório 2',
      event_type: 'Curso',
      preferred_date: '2026-12-10',
      guest_count: 40,
      message: 'Precisamos de projetor.',
      utm_source: 'google',
      utm_campaign: 'auditorios',
      utm_medium: '',
      gclid: 'x1',
      page_url: 'https://www.exemplo.com.br/auditorios/auditorio-2',
      admin_url: 'https://www.exemplo.com.br/admin#/consultas/abc-123',
    });
    // Nada de dados internos (IP, user agent, anotações da equipe)
    expect(Object.keys(p)).not.toContain('notes');
    expect(JSON.stringify(p)).not.toContain('ipHash');
  });

  it('sem telefone não gera link de WhatsApp', () => {
    expect(buildLeadWebhookPayload({ ...lead, phone: '' }, 'https://x.com.br').whatsapp_url).toBe('');
  });

  it('identifica o ambiente pela URL do site', () => {
    expect(leadEnvironment('http://localhost:8787')).toBe('local');
    expect(leadEnvironment('https://auditorios-riodejaneiro.conta.workers.dev')).toBe('preview');
    expect(leadEnvironment('https://www.exemplo.com.br')).toBe('production');
  });
});

describe('payload do Omini Traffic Engine', () => {
  it('leva o segredo em "web-secret" e o resumo em message', () => {
    const p = buildTrafficPayload(lead, 'https://www.exemplo.com.br', 'seg');
    expect(p['web-secret']).toBe('seg');
    expect(p.name).toBe('Maria Teste');
    expect(p.phone).toBe('5521999998888');
    expect(p.details).toBe('Precisamos de projetor.');
    expect(p.message).toContain('Espaço: Auditório 2');
    expect(p.message).toContain('Data: 10/12/2026');
    expect(p.message).toContain('Participantes: 40');
    expect(p.message).toContain('Observações: Precisamos de projetor.');
    expect(p.message).toContain('Origem: google / auditorios');
    expect(p.message).toContain('Painel: https://www.exemplo.com.br/admin#/consultas/abc-123');
  });
  it('sem segredo não manda o campo', () => {
    expect('web-secret' in buildTrafficPayload(lead, 'https://x.com.br')).toBe(false);
  });
});

describe('deliverLead', () => {
  afterEach(() => vi.unstubAllGlobals());
  const env = {
    LEADS_WEBHOOK_URL: 'https://n8n.test/hook',
    LEADS_WEBHOOK_SECRET: 'h',
    TRAFFIC_LEADS_WEBHOOK_URL: 'https://engine.test/webhook/leads/form',
    TRAFFIC_LEADS_WEBHOOK_SECRET: 'w',
  } as unknown as Env;

  it('envia para os dois destinos com o formato de cada um', async () => {
    const calls: { url: string; headers: Record<string, string>; body: Record<string, unknown> }[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
      return new Response('{}', { status: 200 });
    });
    expect(await deliverLead(env, lead, 'https://x.com.br', { retryDelayMs: 0 })).toEqual({ n8n: true, 'traffic-engine': true });
    const n8n = calls.find((c) => c.url.includes('n8n'))!;
    const engine = calls.find((c) => c.url.includes('engine'))!;
    expect(n8n.headers['X-Webhook-Secret']).toBe('h');
    expect(n8n.body.message).toBe('Precisamos de projetor.');
    expect('web-secret' in n8n.body).toBe(false);
    expect(engine.body['web-secret']).toBe('w');
    expect(String(engine.body.message)).toContain('Espaço: Auditório 2');
  });

  it('tenta de novo em erro 5xx, mas não em 4xx; um destino não derruba o outro', async () => {
    const hits: Record<string, number> = {};
    vi.stubGlobal('fetch', async (url: string) => {
      hits[url] = (hits[url] ?? 0) + 1;
      if (url.includes('n8n')) return new Response('down', { status: hits[url] === 1 ? 503 : 200 });
      return new Response('{"error":"secret inválido"}', { status: 401 });
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await deliverLead(env, lead, 'https://x.com.br', { retryDelayMs: 0 })).toEqual({ n8n: true, 'traffic-engine': false });
    expect(hits['https://n8n.test/hook']).toBe(2);
    expect(hits['https://engine.test/webhook/leads/form']).toBe(1);
  });

  it('rodando localmente não manda nada ao traffic engine (posta nos grupos de WhatsApp)', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      urls.push(url);
      return new Response('{}', { status: 200 });
    });
    const res = await deliverLead(env, lead, 'https://auditorioriodejaneiro.com.br', { origin: 'http://127.0.0.1:8787', retryDelayMs: 0 });
    expect(res).toEqual({ n8n: true });
    expect(urls).toEqual(['https://n8n.test/hook']);
  });

  it('sem destinos configurados não chama nada', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    expect(await deliverLead({} as Env, lead, 'https://x.com.br', { retryDelayMs: 0 })).toEqual({});
    expect(f).not.toHaveBeenCalled();
  });
});
