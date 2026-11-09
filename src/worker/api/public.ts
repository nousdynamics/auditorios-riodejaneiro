import * as repo from '../db/repo';
import { sha256Hex } from '../lib/crypto';
import { deliverLead, hasLeadDestinations } from '../leads-webhook';
import { HttpError, assertSameOrigin, clientIp, errorJson, json, readJson } from '../lib/http';
import { validateLead } from '../validate';

/** POST /api/leads — grava a consulta no D1 e, se configurado, copia para os webhooks. */
export async function handleLead(request: Request, env: Env, ctx: ExecutionContext, base: string): Promise<Response> {
  try {
    assertSameOrigin(request);
    const input = validateLead(await readJson(request, 16_000));
    // Robôs: honeypot preenchido ou envio instantâneo. Resposta igual à de sucesso.
    if (input.website || (input.elapsedMs !== undefined && input.elapsedMs < 2500)) return json({ ok: true });

    const ip = clientIp(request);
    const ipHash = (await sha256Hex(`${ip}|${new Date().toISOString().slice(0, 10)}`)).slice(0, 32);
    const limit = await repo.hitRateLimit(env.DB, `lead:${ipHash}`, { limit: 6, windowMs: 10 * 60_000 });
    if (!limit.allowed) throw new HttpError(429, 'Recebemos várias consultas seguidas. Aguarde alguns minutos ou fale pelo WhatsApp.');

    const lead = await repo.createLead(env.DB, {
      name: input.name,
      email: input.email ?? '',
      phone: input.phone ?? '',
      space: input.space,
      activity: input.activity,
      eventDate: input.eventDate,
      people: input.people,
      modality: input.modality,
      schedule: input.schedule,
      details: input.details ?? '',
      channel: input.channel,
      utm: input.utm ?? {},
      page: input.page ?? '',
      ipHash,
      userAgent: request.headers.get('User-Agent') ?? '',
    });

    // Cópia para n8n / traffic engine em segundo plano (com uma nova tentativa em falha temporária).
    if (hasLeadDestinations(env)) ctx.waitUntil(deliverLead(env, lead, base));
    return json({ ok: true, id: lead.id }, { status: 201 });
  } catch (err) {
    return errorJson(err);
  }
}
