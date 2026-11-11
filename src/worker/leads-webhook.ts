import type { Lead } from '../shared/types';

/**
 * Cópia de cada consulta para os destinos externos. A consulta já está gravada no D1
 * antes do envio: falha num destino nunca afeta o visitante nem os outros destinos.
 *
 * - n8n (LEADS_WEBHOOK_URL): linha plana em snake_case, no mesmo padrão dos leads do
 *   Yevent (name, phone, space_name, event_type, guest_count, preferred_date, utm_*...).
 * - Omini Traffic Engine (TRAFFIC_LEADS_WEBHOOK_URL): mesmo corpo, mas `message` traz o
 *   resumo da consulta (o template padrão do engine só mostra nome, e-mail, telefone e
 *   mensagem no WhatsApp) e o segredo vai no campo "web-secret" do corpo.
 */

export type LeadEnvironment = 'production' | 'preview' | 'local';

export function leadEnvironment(base: string): LeadEnvironment {
  const host = (() => {
    try {
      return new URL(base).hostname;
    } catch {
      return '';
    }
  })();
  if (!host || host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.localhost')) return 'local';
  if (host.endsWith('.workers.dev')) return 'preview';
  return 'production';
}

export function buildLeadWebhookPayload(lead: Lead, base: string, environment: LeadEnvironment = leadEnvironment(base)) {
  const utm = (key: string) => lead.utm[key] ?? '';
  return {
    type: 'consulta_auditorio',
    source: 'site-auditorios-rio',
    environment,
    received_at: lead.createdAt,
    id: lead.id,
    name: lead.name,
    email: lead.email,
    // 55 + DDD + número, pronto para WhatsApp/Evolution API (vazio se não informado)
    phone: lead.phone,
    whatsapp_url: lead.phone ? `https://wa.me/${lead.phone}` : '',
    space_name: lead.space,
    event_type: lead.activity,
    preferred_date: lead.eventDate,
    guest_count: lead.people,
    modality: lead.modality,
    schedule: lead.schedule,
    message: lead.details,
    /** Como o visitante seguiu depois de enviar: whatsapp, email, copia (copiou o texto) ou formulario. */
    channel: lead.channel,
    utm_source: utm('utm_source'),
    utm_medium: utm('utm_medium'),
    utm_campaign: utm('utm_campaign'),
    utm_term: utm('utm_term'),
    utm_content: utm('utm_content'),
    gclid: utm('gclid'),
    fbclid: utm('fbclid'),
    page_url: lead.page.startsWith('/') ? base + lead.page : lead.page,
    admin_url: `${base}/admin#/consultas/${encodeURIComponent(lead.id)}`,
    site_url: base,
  };
}

/** 2026-12-15 → 15/12/2026 (outros formatos passam como vieram). */
function dateBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Resumo em texto da consulta, para notificações (WhatsApp do traffic engine). */
export function leadSummary(lead: Lead, base: string): string {
  const lines: [string, string | number | null][] = [
    ['Espaço', lead.space],
    ['Atividade', lead.activity],
    ['Data', dateBR(lead.eventDate)],
    ['Participantes', lead.people],
    ['Modalidade', lead.modality],
    ['Horário', lead.schedule],
    ['Observações', lead.details],
    ['Origem', [lead.utm.utm_source, lead.utm.utm_campaign].filter(Boolean).join(' / ')],
    ['Painel', `${base}/admin#/consultas/${encodeURIComponent(lead.id)}`],
  ];
  return '\n' + lines.filter(([, v]) => v !== null && v !== '').map(([k, v]) => `${k}: ${v}`).join('\n');
}

export function buildTrafficPayload(lead: Lead, base: string, secret?: string, environment?: LeadEnvironment) {
  return {
    ...(secret ? { 'web-secret': secret } : {}),
    ...buildLeadWebhookPayload(lead, base, environment),
    message: leadSummary(lead, base),
    details: lead.details,
  };
}

interface Target {
  label: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

function targets(env: Env, lead: Lead, base: string, environment: LeadEnvironment): Target[] {
  const list: Target[] = [];
  const n8n = env.LEADS_WEBHOOK_URL?.trim();
  if (n8n) {
    list.push({
      label: 'n8n',
      url: n8n,
      headers: env.LEADS_WEBHOOK_SECRET ? { 'X-Webhook-Secret': env.LEADS_WEBHOOK_SECRET } : {},
      body: buildLeadWebhookPayload(lead, base, environment),
    });
  }
  const traffic = env.TRAFFIC_LEADS_WEBHOOK_URL?.trim();
  // O engine posta direto nos grupos de WhatsApp: testes locais nunca vão para lá.
  if (traffic && environment !== 'local') {
    list.push({
      label: 'traffic-engine',
      url: traffic,
      headers: {},
      body: buildTrafficPayload(lead, base, env.TRAFFIC_LEADS_WEBHOOK_SECRET?.trim(), environment),
    });
  }
  return list;
}

type Attempt = 'ok' | 'retry' | 'fail';

async function post(t: Target, leadId: string): Promise<Attempt> {
  try {
    const res = await fetch(t.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'auditorios-riodejaneiro-worker', ...t.headers },
      body: JSON.stringify(t.body),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return 'ok';
    console.error(`[leads-webhook:${t.label}] respondeu ${res.status}`, leadId, (await res.text().catch(() => '')).slice(0, 200));
    // 4xx (segredo errado, formulário inexistente...) não melhora com nova tentativa
    return res.status >= 500 || res.status === 429 ? 'retry' : 'fail';
  } catch (err) {
    console.error(`[leads-webhook:${t.label}] falha ao enviar`, leadId, err);
    return 'retry';
  }
}

/**
 * Envia a consulta a todos os destinos configurados, em paralelo. Nunca lança.
 * `origin` é a origem real da requisição: define o ambiente (production/preview/local),
 * já que `base` pode ser o domínio canônico (SITE_URL) mesmo rodando localmente.
 */
export async function deliverLead(
  env: Env,
  lead: Lead,
  base: string,
  { origin, retryDelayMs = 3000 }: { origin?: string; retryDelayMs?: number } = {},
): Promise<Record<string, boolean>> {
  const list = targets(env, lead, base, leadEnvironment(origin ?? base));
  const results = await Promise.all(
    list.map(async (t) => {
      let r = await post(t, lead.id);
      if (r === 'retry') {
        await new Promise((ok) => setTimeout(ok, retryDelayMs));
        r = await post(t, lead.id);
      }
      return [t.label, r === 'ok'] as const;
    }),
  );
  return Object.fromEntries(results);
}

export const hasLeadDestinations = (env: Env): boolean => Boolean(env.LEADS_WEBHOOK_URL?.trim() || env.TRAFFIC_LEADS_WEBHOOK_URL?.trim());
