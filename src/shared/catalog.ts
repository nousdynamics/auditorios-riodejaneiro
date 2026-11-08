import type { AmenityId, LayoutId, LeadStatus } from './types';

/** Recursos que uma sala pode oferecer. `icon` é o id do símbolo em /assets/icons.svg. */
export const AMENITIES: Record<AmenityId, { label: string; icon: string }> = {
  'cadeiras-prancheta': { label: 'Cadeiras com prancheta', icon: 'chair' },
  projetor: { label: 'Datashow', icon: 'projector' },
  'tela-projecao': { label: 'Tela de projeção', icon: 'screen' },
  climatizacao: { label: 'Climatização', icon: 'snow' },
  'quadro-branco': { label: 'Quadro branco', icon: 'board' },
  'quadro-vidro': { label: 'Quadro de vidro', icon: 'board' },
  wifi: { label: 'Wi-Fi', icon: 'wifi' },
  som: { label: 'Sistema de som', icon: 'speaker' },
  microfone: { label: 'Microfone', icon: 'mic' },
  tv: { label: 'TV / monitor', icon: 'tv' },
  flipchart: { label: 'Flipchart', icon: 'board' },
  macas: { label: 'Macas para aulas práticas', icon: 'bed' },
  copa: { label: 'Copa para coffee break', icon: 'cup' },
  banheiro: { label: 'Banheiro no andar', icon: 'door' },
  recepcao: { label: 'Recepção', icon: 'desk' },
  acessibilidade: { label: 'Acessibilidade', icon: 'access' },
  agua: { label: 'Água / filtro', icon: 'drop' },
};

export const AMENITY_IDS = Object.keys(AMENITIES) as AmenityId[];

/** Formatos de montagem das cadeiras. */
export const LAYOUTS: Record<LayoutId, { label: string; hint: string }> = {
  auditorio: { label: 'Auditório', hint: 'Fileiras voltadas para a tela' },
  escolar: { label: 'Escolar', hint: 'Fileiras com espaço para escrita' },
  u: { label: 'Em U', hint: 'Participantes de frente uns para os outros' },
  ilhas: { label: 'Ilhas', hint: 'Grupos para dinâmicas e oficinas' },
  reuniao: { label: 'Reunião', hint: 'Mesa única ou círculo' },
};

export const LAYOUT_IDS = Object.keys(LAYOUTS) as LayoutId[];

export const ROOM_TYPES = ['Auditório', 'Sala de aula', 'Sala de reunião', 'Sala de prática', 'Andar completo'];

export const ACTIVITIES = ['Aula ou curso', 'Oficina ou treinamento', 'Reunião ou encontro', 'Palestra ou evento', 'Outra atividade'];

export const MODALITIES = ['Por hora', 'Por turno', 'Diária', 'Pacote corporativo', 'Quero orientação'];

export const LEAD_STATUS: Record<LeadStatus, string> = {
  novo: 'Novo',
  em_atendimento: 'Em atendimento',
  fechado: 'Fechado',
  perdido: 'Perdido',
};

/** Rótulo do espaço "andar completo" usado no formulário e no pacote corporativo. */
export const CORPORATE_SPACE = 'Andar completo — pacote corporativo';
export const GUIDANCE_SPACE = 'Quero orientação';
