/**
 * Dados estruturados (schema.org / JSON-LD). Uma única entidade principal (#venue) é
 * referenciada por @id em todas as páginas — isso ajuda Google, Bing e buscadores de IA
 * a entenderem que salas, FAQ e páginas pertencem ao mesmo local.
 */
import { AMENITIES } from '../../shared/catalog';
import type { Faq, Room, SiteSettings } from '../../shared/types';
import { absoluteImage, phoneE164, priceList } from '../views/ui';

export const venueId = (base: string) => `${base}/#venue`;
export const orgId = (base: string) => `${base}/#organization`;
export const websiteId = (base: string) => `${base}/#website`;
export const roomId = (base: string, r: Room) => `${base}/auditorios/${r.slug}#place`;

function postalAddress(s: SiteSettings) {
  const a = s.address;
  return {
    '@type': 'PostalAddress',
    streetAddress: [a.street, a.complement].filter(Boolean).join(', '),
    addressLocality: a.city,
    addressRegion: a.state,
    ...(a.postalCode ? { postalCode: a.postalCode } : {}),
    addressCountry: 'BR',
  };
}

function geo(s: SiteSettings) {
  const { lat, lng } = s.address;
  return lat != null && lng != null ? { geo: { '@type': 'GeoCoordinates', latitude: lat, longitude: lng } } : {};
}

function amenityFeatures(ids: string[]) {
  return ids
    .filter((id) => id in AMENITIES)
    .map((id) => ({ '@type': 'LocationFeatureSpecification', name: AMENITIES[id as keyof typeof AMENITIES].label, value: true }));
}

export function organizationGraph(base: string, s: SiteSettings, rooms: Room[]) {
  const sameAs = Object.values(s.social).filter(Boolean);
  const allAmenities = [...new Set(rooms.flatMap((r) => r.amenities))];
  const maxCapacity = Math.max(0, ...rooms.map((r) => r.capacityMax));
  return [
    {
      '@type': 'Organization',
      '@id': orgId(base),
      name: s.brandName,
      url: `${base}/`,
      logo: { '@type': 'ImageObject', url: `${base}/icon-512.png`, width: 512, height: 512 },
      email: s.email,
      telephone: phoneE164(s.whatsapp),
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        telephone: phoneE164(s.whatsapp),
        email: s.email,
        availableLanguage: ['pt-BR'],
        areaServed: 'BR',
      },
      ...(sameAs.length ? { sameAs } : {}),
    },
    {
      '@type': ['LocalBusiness', 'EventVenue'],
      '@id': venueId(base),
      name: `${s.brandName} — Auditórios no Centro do Rio`,
      alternateName: `${s.brandName} Locação de Auditórios`,
      description:
        'Locação de auditórios e salas para aulas, cursos, treinamentos e reuniões no Centro do Rio de Janeiro, por hora, por turno ou do andar completo (pacote corporativo).',
      url: `${base}/`,
      image: [`${base}/og-image.jpg`, ...rooms.slice(0, 4).map((r) => absoluteImage(r.photos[0], base))],
      logo: `${base}/icon-512.png`,
      telephone: phoneE164(s.whatsapp),
      email: s.email,
      address: postalAddress(s),
      ...geo(s),
      hasMap: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.address.street}, ${s.address.city}`)}`,
      areaServed: { '@type': 'City', name: s.address.city },
      parentOrganization: { '@id': orgId(base) },
      ...(maxCapacity ? { maximumAttendeeCapacity: maxCapacity } : {}),
      amenityFeature: amenityFeatures(allAmenities),
      containsPlace: rooms.map((r) => ({ '@id': roomId(base, r) })),
      currenciesAccepted: 'BRL',
      knowsLanguage: 'pt-BR',
      publicAccess: false,
      ...(sameAs.length ? { sameAs } : {}),
    },
    {
      '@type': 'WebSite',
      '@id': websiteId(base),
      url: `${base}/`,
      name: `${s.brandName} — Auditórios no Rio de Janeiro`,
      inLanguage: 'pt-BR',
      publisher: { '@id': orgId(base) },
    },
  ];
}

export function roomPlace(base: string, s: SiteSettings, r: Room) {
  const prices = priceList(r);
  return {
    '@type': ['EventVenue', 'Place'],
    '@id': roomId(base, r),
    name: `${r.name} — ${s.brandName}`,
    description: r.summary || r.description.slice(0, 300),
    url: `${base}/auditorios/${r.slug}`,
    image: r.photos.map((p) => absoluteImage(p, base)),
    address: postalAddress(s),
    ...geo(s),
    containedInPlace: { '@id': venueId(base) },
    maximumAttendeeCapacity: r.capacityMax,
    ...(r.areaM2 ? { floorSize: { '@type': 'QuantitativeValue', value: r.areaM2, unitCode: 'MTK' } } : {}),
    amenityFeature: amenityFeatures(r.amenities),
    ...(prices.length
      ? {
          makesOffer: prices.map((p) => ({
            '@type': 'Offer',
            name: `Locação ${p.label.toLowerCase()} — ${r.name}`,
            priceCurrency: 'BRL',
            price: p.value,
            priceSpecification: { '@type': 'UnitPriceSpecification', price: p.value, priceCurrency: 'BRL', unitText: p.unit },
            availability: r.isAvailable ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            seller: { '@id': orgId(base) },
          })),
        }
      : {}),
  };
}

export function faqPage(base: string, path: string, faqs: Faq[] | { question: string; answer: string }[]) {
  return {
    '@type': 'FAQPage',
    '@id': `${base}${path}#faq`,
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

export function breadcrumbs(base: string, items: { name: string; path: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: `${base}${it.path}` })),
  };
}

export function webPage(
  base: string,
  path: string,
  name: string,
  description: string,
  extra: Record<string, unknown> = {},
) {
  return {
    '@type': 'WebPage',
    '@id': `${base}${path}#webpage`,
    url: `${base}${path}`,
    name,
    description,
    inLanguage: 'pt-BR',
    isPartOf: { '@id': websiteId(base) },
    about: { '@id': venueId(base) },
    // Trechos ideais para respostas por voz / assistentes (AEO)
    speakable: { '@type': 'SpeakableSpecification', cssSelector: ['[data-speakable]'] },
    ...extra,
  };
}

export function roomItemList(base: string, rooms: Room[]) {
  return {
    '@type': 'ItemList',
    '@id': `${base}/auditorios#lista`,
    name: 'Auditórios para locação',
    numberOfItems: rooms.length,
    itemListElement: rooms.map((r, i) => ({ '@type': 'ListItem', position: i + 1, url: `${base}/auditorios/${r.slug}`, name: r.name })),
  };
}

export const graph = (...nodes: unknown[]) => ({ '@context': 'https://schema.org', '@graph': nodes.flat() });
