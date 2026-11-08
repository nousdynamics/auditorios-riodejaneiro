/// <reference types="@cloudflare/workers-types" />

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  MEDIA: R2Bucket;
  /** URL canônica (https://dominio.com.br). Vazio = origem da requisição. */
  SITE_URL?: string;
  /** Segredo que libera a criação do primeiro administrador em /admin/setup. */
  SETUP_TOKEN?: string;
  /** Webhook opcional que recebe uma cópia de cada consulta (n8n, Make, Zapier...). */
  LEADS_WEBHOOK_URL?: string;
  LEADS_WEBHOOK_SECRET?: string;
}

declare module '*.sql' {
  const sql: string;
  export default sql;
}
