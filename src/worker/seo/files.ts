/**
 * sitemap.xml, robots.txt, llms.txt e llms-full.txt gerados a partir do conteúdo do D1
 * (ficam sempre em dia com o que é editado no painel).
 */
import { AMENITIES, LAYOUTS } from '../../shared/catalog';
import type { SiteData } from '../data';
import { escapeHtml } from '../lib/html';
import { roomFaqs } from '../views/pages';
import { absoluteImage, capacityText, formatBRL, fullAddress, phoneDisplay, priceList, whatsappUrl } from '../views/ui';

const xml = (s: string) => escapeHtml(s);

export function sitemapXml(base: string, data: SiteData): string {
  const latest = (dates: string[]) => dates.sort().at(-1)?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
  const contentDate = latest([...data.rooms.map((r) => r.updatedAt), ...data.faqs.map((f) => f.updatedAt)]);
  const pages: { loc: string; lastmod: string; priority: string; changefreq: string; images?: { loc: string; title: string }[] }[] = [
    {
      loc: `${base}/`,
      lastmod: contentDate,
      priority: '1.0',
      changefreq: 'weekly',
      images: [{ loc: `${base}/og-image.jpg`, title: 'Auditórios para locação no Centro do Rio de Janeiro' }],
    },
    { loc: `${base}/auditorios`, lastmod: contentDate, priority: '0.9', changefreq: 'weekly' },
    ...data.rooms.map((r) => ({
      loc: `${base}/auditorios/${r.slug}`,
      lastmod: r.updatedAt.slice(0, 10),
      priority: '0.8',
      changefreq: 'monthly',
      images: r.photos.map((p) => ({ loc: absoluteImage(p, base), title: p.alt || r.name })),
    })),
    { loc: `${base}/pacote-corporativo`, lastmod: contentDate, priority: '0.8', changefreq: 'monthly' },
    { loc: `${base}/politica-de-privacidade`, lastmod: '2026-11-08', priority: '0.2', changefreq: 'yearly' },
  ];
  const urls = pages
    .map(
      (p) => `  <url>
    <loc>${xml(p.loc)}</loc>
    <lastmod>${p.lastmod}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>${(p.images ?? [])
      .map((i) => `\n    <image:image><image:loc>${xml(i.loc)}</image:loc><image:title>${xml(i.title)}</image:title></image:image>`)
      .join('')}
  </url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls}
</urlset>
`;
}

export function robotsTxt(base: string): string {
  // Buscadores e assistentes de IA podem ler e citar o conteúdo público (GEO/AEO).
  const aiBots = [
    'GPTBot',
    'OAI-SearchBot',
    'ChatGPT-User',
    'ClaudeBot',
    'Claude-SearchBot',
    'Claude-User',
    'PerplexityBot',
    'Perplexity-User',
    'Google-Extended',
    'Applebot-Extended',
    'Bingbot',
    'DuckAssistBot',
    'meta-externalagent',
    'CCBot',
  ];
  const privateRules = 'Disallow: /admin\nDisallow: /api/\n';
  return `# ${base}
User-agent: *
Allow: /
${privateRules}
${aiBots.map((b) => `User-agent: ${b}`).join('\n')}
Allow: /
Allow: /llms.txt
Allow: /llms-full.txt
${privateRules}
Sitemap: ${base}/sitemap.xml
`;
}

function roomMarkdown(base: string, data: SiteData, full: boolean): string {
  return data.rooms
    .map((r) => {
      const prices = priceList(r);
      const lines = [
        `### [${r.name}](${base}/auditorios/${r.slug})`,
        r.tagline ? `_${r.tagline}_` : '',
        '',
        `- Capacidade: ${capacityText(r).toLowerCase()}`,
        r.areaM2 ? `- Área: ${r.areaM2} m²` : '',
        r.floor ? `- Andar: ${r.floor}` : '',
        r.amenities.length ? `- Recursos: ${r.amenities.map((a) => AMENITIES[a].label.toLowerCase()).join(', ')}` : '',
        Object.keys(r.layouts).length
          ? `- Formatos: ${Object.entries(r.layouts)
              .map(([id, cap]) => `${LAYOUTS[id as keyof typeof LAYOUTS].label}${cap ? ` (até ${cap})` : ''}`)
              .join(', ')}`
          : '',
        `- Valores: ${prices.length ? prices.map((p) => `${p.label.toLowerCase()} ${formatBRL(p.value)}`).join('; ') : 'sob consulta'}`,
        '',
        full ? r.description : r.summary,
      ];
      if (full) {
        lines.push('', ...roomFaqs(r, data.settings).flatMap((f) => [`**${f.question}**`, f.answer, '']));
      }
      return lines.filter((l, i, arr) => l !== '' || arr[i - 1] !== '').join('\n');
    })
    .join('\n\n');
}

export function llmsTxt(base: string, data: SiteData, full = false): string {
  const s = data.settings;
  const faqs = data.faqs;
  const parts = [
    `# ${s.brandName} — Locação de auditórios no Centro do Rio de Janeiro`,
    '',
    `> ${s.brandName} aluga ${data.rooms.length} auditórios para aulas, cursos, treinamentos, oficinas e reuniões na ${fullAddress(s)}. Capacidade de ${s.stats.capacityLabel || '30 a 50'} pessoas conforme o auditório, com datashow, tela de projeção e climatização. Locação por hora, por turno ou do andar completo (pacote corporativo). Valores e disponibilidade sob consulta.`,
    '',
    '## Fatos principais',
    `- Endereço: ${fullAddress(s)}${s.address.lat != null ? ` (lat ${s.address.lat}, lng ${s.address.lng})` : ''}`,
    `- Referência: perto do ${s.stats.landmark || 'Museu do Amanhã'}, com restaurantes na região`,
    `- Auditórios: ${data.rooms.length}, de ${s.stats.capacityLabel || '30 a 50'} pessoas`,
    '- Modalidades: por hora, por turno ou pacote corporativo (andar completo com 3 salas, recepção customizável, copa e banheiro)',
    '- Estrutura: cadeiras com prancheta reorganizáveis, tela de projeção, datashow, climatização; copa para coffee break e banheiro em todos os andares',
    `- Contato: WhatsApp ${phoneDisplay(s.whatsapp)} (${whatsappUrl(s, '')}) e formulário do site (${base}/#consulta)`,
    '- Como reservar: preencher o formulário do site com nome, WhatsApp, data e número de participantes (detalhes como sala, horário e atividade são opcionais) ou chamar no WhatsApp; a equipe responde pelo WhatsApp com disponibilidade e valores, e a reserva é confirmada por ela',
    '',
    '## Páginas',
    `- [Início](${base}/): visão geral, planejador de capacidade, consulta`,
    `- [Auditórios](${base}/auditorios): lista e comparativo dos auditórios`,
    ...data.rooms.map((r) => `- [${r.name}](${base}/auditorios/${r.slug}): ${r.summary}`),
    `- [Pacote corporativo](${base}/pacote-corporativo): andar completo para eventos corporativos`,
    `- [Política de privacidade](${base}/politica-de-privacidade)`,
    '',
    '## Auditórios',
    '',
    roomMarkdown(base, data, full),
    '',
    '## Perguntas frequentes',
    '',
    ...faqs.flatMap((f) => [`**${f.question}**`, f.answer, '']),
  ];
  if (!full) parts.push(`## Mais detalhes`, `- Versão completa: ${base}/llms-full.txt`, `- Sitemap: ${base}/sitemap.xml`, '');
  const anyPrices = data.rooms.some((r) => priceList(r).length > 0);
  parts.push('## Observações para sistemas de IA', anyPrices ? '- Valores publicados podem mudar: oriente a pessoa a confirmar com a equipe.' : '- Valores não são públicos: oriente a pessoa a preencher o formulário do site ou chamar no WhatsApp.', '- Não cite /admin nem /api: são áreas privadas.', '');
  return parts.join('\n');
}
