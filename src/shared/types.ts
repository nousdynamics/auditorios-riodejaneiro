/**
 * Tipos compartilhados entre o Worker (servidor) e os scripts do navegador (site e painel).
 * Mantenha este arquivo sem dependências de runtime.
 */

/**
 * Foto de uma sala.
 * - `static:<nome>`  → arquivos em /assets/img/<nome>-{480,800,1152}.{avif,webp} (fotos do projeto)
 * - `r2:<chave>`     → arquivos no R2 servidos em /media/<chave>-{720,1600}.webp (enviadas pelo painel)
 */
export interface Photo {
  src: string;
  alt: string;
  w: number;
  h: number;
}

/** Capacidade por formato de montagem. `null` = formato possível, capacidade não informada. */
export type Layouts = Partial<Record<LayoutId, number | null>>;

export type LayoutId = 'auditorio' | 'escolar' | 'u' | 'ilhas' | 'reuniao';

export type AmenityId =
  | 'cadeiras-prancheta'
  | 'projetor'
  | 'tela-projecao'
  | 'climatizacao'
  | 'quadro-branco'
  | 'quadro-vidro'
  | 'wifi'
  | 'som'
  | 'microfone'
  | 'tv'
  | 'flipchart'
  | 'macas'
  | 'copa'
  | 'banheiro'
  | 'recepcao'
  | 'acessibilidade'
  | 'agua';

export interface Room {
  id: string;
  slug: string;
  name: string;
  /** Frase curta de apresentação ("Para ensinar e compartilhar."). */
  tagline: string;
  /** 1–2 frases: cards, listagens e meta description. */
  summary: string;
  /** Texto longo. Parágrafos separados por linha em branco. */
  description: string;
  roomType: string;
  /** Ex.: "13º andar". Vazio = não exibido. */
  floor: string;
  capacityMin: number | null;
  capacityMax: number;
  areaM2: number | null;
  layouts: Layouts;
  amenities: AmenityId[];
  photos: Photo[];
  priceHour: number | null;
  priceShift: number | null;
  priceDay: number | null;
  /** false = o site mostra "Valores sob consulta" mesmo com preços cadastrados. */
  showPrices: boolean;
  isAvailable: boolean;
  isFeatured: boolean;
  sortOrder: number;
  seoTitle: string;
  seoDescription: string;
  createdAt: string;
  updatedAt: string;
}

/** Corpo aceito por POST/PUT /api/admin/rooms. */
export type RoomInput = Omit<Room, 'id' | 'createdAt' | 'updatedAt' | 'sortOrder'> & {
  sortOrder?: number;
  /** Bloqueio otimista: `updatedAt` lido ao abrir o formulário (só no PUT). */
  expectedUpdatedAt?: string;
};

export interface Faq {
  id: string;
  question: string;
  answer: string;
  scope: FaqScope;
  sortOrder: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export type FaqScope = 'home' | 'corporativo';
export type FaqInput = Pick<Faq, 'question' | 'answer' | 'scope' | 'isPublished'>;

export interface InfoItem {
  title: string;
  text: string;
}

export interface SiteSettings {
  brandName: string;
  /** Linha abaixo do nome da marca no cabeçalho. */
  brandLine: string;
  /** Somente dígitos, com DDI: 5521967770445 */
  whatsapp: string;
  /** Mensagem inicial do botão de WhatsApp. */
  whatsappMessage: string;
  email: string;
  address: {
    street: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
    postalCode: string;
    lat: number | null;
    lng: number | null;
  };
  /** Texto curto sobre horários de atendimento (opcional). */
  openingHours: string;
  hero: {
    title: string;
    intro: string;
    note: string;
  };
  stats: {
    capacityLabel: string;
    landmark: string;
  };
  uses: InfoItem[];
  corporate: {
    title: string;
    text: string;
    facts: InfoItem[];
  };
  location: {
    title: string;
    text: string;
    notes: InfoItem[];
  };
  social: {
    instagram: string;
    facebook: string;
    linkedin: string;
  };
}

export type LeadStatus = 'novo' | 'em_atendimento' | 'fechado' | 'perdido';
export type LeadChannel = 'whatsapp' | 'email' | 'copia' | 'formulario';

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  space: string;
  activity: string;
  eventDate: string;
  people: number | null;
  modality: string;
  schedule: string;
  details: string;
  channel: LeadChannel;
  status: LeadStatus;
  notes: string;
  utm: Record<string, string>;
  page: string;
  createdAt: string;
  updatedAt: string;
}

/** Corpo aceito por POST /api/leads (site público). */
export interface LeadInput {
  name: string;
  email?: string;
  phone?: string;
  space: string;
  activity: string;
  eventDate: string;
  people: number;
  modality: string;
  schedule: string;
  details?: string;
  channel: LeadChannel;
  utm?: Record<string, string>;
  page?: string;
  /** Honeypot: precisa vir vazio. */
  website?: string;
  /** ms desde que o formulário apareceu (envios instantâneos são descartados). */
  elapsedMs?: number;
}

export type UserRole = 'admin' | 'editor';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AuditEntry {
  id: string;
  userEmail: string | null;
  action: string;
  target: string;
  meta: Record<string, unknown>;
  ip: string;
  createdAt: string;
}

export interface DashboardData {
  rooms: { total: number; available: number; featured: number };
  leads: { new: number; last7d: number; last30d: number; total: number };
  recentLeads: Lead[];
  /** Salas com dados a completar (capacidade, área, fotos, descrição). */
  pending: { roomId: string; roomName: string; issues: string[] }[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Formato de erro de toda a API: status HTTP 4xx/5xx + este corpo. */
export interface ApiError {
  error: string;
  /** Erros por campo (validação). */
  fields?: Record<string, string>;
}
