/// <reference types="@cloudflare/workers-types" />

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  MEDIA: R2Bucket;
  /** URL canônica (https://dominio.com.br). Vazio = origem da requisição. */
  SITE_URL?: string;
  /** Segredo que libera a criação do primeiro administrador em /admin/setup. */
  SETUP_TOKEN?: string;
  /** Webhook do n8n que recebe uma cópia de cada consulta (segredo). */
  LEADS_WEBHOOK_URL?: string;
  /** Enviado no header X-Webhook-Secret do webhook do n8n. */
  LEADS_WEBHOOK_SECRET?: string;
  /** Omini Traffic Engine: POST /webhook/leads/{form} (segredo). */
  TRAFFIC_LEADS_WEBHOOK_URL?: string;
  /** LEAD_WEBHOOK_SECRET do engine, enviado no campo "web-secret" do corpo. */
  TRAFFIC_LEADS_WEBHOOK_SECRET?: string;
}

declare module '*.sql' {
  const sql: string;
  export default sql;
}
