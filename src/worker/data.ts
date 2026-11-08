import type { Faq, Room, SiteSettings } from '../shared/types';
import * as repo from './db/repo';

export interface SiteData {
  settings: SiteSettings;
  /** Somente salas disponíveis, já ordenadas. */
  rooms: Room[];
  faqs: Faq[];
  loadedAt: number;
}

const TTL_MS = 30_000;
let cached: SiteData | null = null;
let inflight: Promise<SiteData> | null = null;

/**
 * Conteúdo público com cache em memória do isolate (30 s).
 * Alterações feitas no painel limpam o cache do isolate que recebeu a alteração;
 * os demais isolates atualizam em até 30 s.
 */
export async function getSiteData(env: Env): Promise<SiteData> {
  if (cached && Date.now() - cached.loadedAt < TTL_MS) return cached;
  inflight ??= (async () => {
    const [settings, rooms, faqs] = await Promise.all([
      repo.getSettings(env.DB),
      repo.listRooms(env.DB, { onlyAvailable: true }),
      repo.listFaqs(env.DB, { onlyPublished: true }),
    ]);
    cached = { settings, rooms, faqs, loadedAt: Date.now() };
    return cached;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export function invalidateSiteData(): void {
  cached = null;
}
