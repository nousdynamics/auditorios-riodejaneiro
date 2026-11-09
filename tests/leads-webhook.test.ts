import { describe, expect, it } from 'vitest';
import { buildLeadWebhookPayload, leadEnvironment } from '../src/worker/leads-webhook';
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
