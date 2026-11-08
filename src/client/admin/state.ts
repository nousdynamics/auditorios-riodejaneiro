import type { AdminUser, Lead } from '../../shared/types';

let current: AdminUser | null = null;
export const getUser = (): AdminUser | null => current;
export const setUser = (u: AdminUser | null): void => {
  current = u;
};
export const isAdmin = (): boolean => current?.role === 'admin';


/** Consultas já carregadas, para abrir o detalhe sem nova busca. */
export const leadCache = new Map<string, Lead>();
export const rememberLeads = (items: Lead[]): void => {
  for (const l of items) leadCache.set(l.id, l);
};
