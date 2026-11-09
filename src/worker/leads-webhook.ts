import type { Lead } from '../shared/types';

/**
 * Cópia de cada consulta para o n8n (ou Make/Zapier). Formato plano, em snake_case,
 * no mesmo padrão dos leads do Yevent (name, phone, space_name, event_type,
 * guest_count, preferred_date, utm_*, page_url...), para reaproveitar o fluxo.
 * A consulta já está gravada no D1 antes do envio: falha no webhook nunca afeta o visitante.
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

export function buildLeadWebhookPayload(lead: Lead, base: string) {
  const utm = (key: string) => lead.utm[key] ?? '';
  return {
    type: 'consulta_auditorio',
    source: 'site-auditorios-rio',
    environment: leadEnvironment(base),
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

/** Envia a consulta ao webhook configurado. Nunca lança; devolve true se o destino confirmou (2xx). */
export async function sendLeadWebhook(env: Env, lead: Lead, base: string): Promise<boolean> {
  const url = env.LEADS_WEBHOOK_URL?.trim();
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'auditorios-riodejaneiro-worker',
        ...(env.LEADS_WEBHOOK_SECRET ? { 'X-Webhook-Secret': env.LEADS_WEBHOOK_SECRET } : {}),
      },
      body: JSON.stringify(buildLeadWebhookPayload(lead, base)),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error('[leads-webhook] destino respondeu', res.status, (await res.text().catch(() => '')).slice(0, 200));
    return res.ok;
  } catch (err) {
    console.error('[leads-webhook] falha ao enviar', lead.id, err);
    return false;
  }
}
