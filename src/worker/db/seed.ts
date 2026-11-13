/**
 * Conteúdo inicial (vindo do site original da InterFISIO). É gravado no D1 uma única vez,
 * na primeira requisição; depois disso tudo é editado pelo painel (/admin).
 */
import type { Faq, Room, SiteSettings } from '../../shared/types';

export const DEFAULT_SETTINGS: SiteSettings = {
  brandName: 'Auditório Rio de Janeiro',
  brandLine: 'Locação de auditórios no Centro do Rio',
  whatsapp: '5521981860023',
  whatsappMessage: 'Olá! Gostaria de consultar a locação de um auditório.',
  email: 'cursos@interfisio.com.br',
  address: {
    street: 'Rua São Bento, 09',
    complement: '13º e 14º andares',
    neighborhood: 'Centro',
    city: 'Rio de Janeiro',
    state: 'RJ',
    postalCode: '',
    lat: -22.8984,
    lng: -43.1797,
  },
  openingHours: '',
  hero: {
    title: 'Auditórios para cursos e treinamentos no Centro do Rio de Janeiro',
    intro:
      'Realize sua próxima aula, curso ou reunião no Centro do Rio. Escolha um auditório por hora ou turno, ou reserve o andar completo com o pacote corporativo.',
    note: 'De 30 a 50 pessoas, conforme o auditório.',
  },
  stats: {
    capacityLabel: '30 a 50',
    landmark: 'Museu do Amanhã',
  },
  uses: [
    {
      title: 'Aulas e cursos',
      text: 'Planeje aulas, encontros de formação e cursos. Consulte a capacidade e os recursos disponíveis para o seu formato.',
    },
    {
      title: 'Oficinas e treinamentos',
      text: 'Informe a dinâmica da atividade e o que você precisa para conduzir seu treinamento.',
    },
    {
      title: 'Reuniões e encontros',
      text: 'Organize reuniões de equipe e encontros profissionais. Consulte horários e possibilidades de uso.',
    },
  ],
  corporate: {
    title: 'Um andar inteiro para o seu negócio',
    text: 'Reúna sua equipe, seus convidados e sua marca em um único espaço. O andar pode ser locado integralmente, com três salas/auditórios e uma recepção que pode ser adaptada e customizada para sua empresa.',
    facts: [
      { title: '3 salas / auditórios', text: 'Locação conjunta no pacote do andar completo.' },
      {
        title: 'Recepção customizável',
        text: 'Possibilidade de adaptação à identidade e às necessidades do seu negócio, conforme condições combinadas.',
      },
      { title: 'Copa para coffee break', text: 'Todos os andares contam com copa e banheiro.' },
    ],
  },
  location: {
    title: 'Um encontro no coração da cidade',
    text: 'Próximo ao Museu do Amanhã e aos restaurantes da região, para combinar seu evento com a experiência do Centro do Rio.',
    notes: [
      { title: 'Perto do Museu do Amanhã', text: 'A aproximadamente 100 metros.' },
      { title: 'Restaurantes na região', text: 'Opções próximas para os intervalos do seu encontro.' },
    ],
  },
  social: { instagram: '', facebook: '', linkedin: '' },
};

const BASE_DESCRIPTION =
  'As cadeiras podem ser organizadas em diferentes formatos, conforme a dinâmica da atividade. A sala é climatizada e o andar conta com copa para coffee break e banheiro.\n\nInforme a data, o horário e o número de participantes para a equipe confirmar disponibilidade, recursos e valores.';

type SeedRoom = Omit<Room, 'createdAt' | 'updatedAt'>;

const room = (n: number, data: Partial<SeedRoom> & Pick<SeedRoom, 'tagline' | 'summary' | 'description' | 'photos' | 'amenities'>): SeedRoom => ({
  id: `auditorio-${n}`,
  slug: `auditorio-${n}`,
  name: `Auditório ${n}`,
  roomType: 'Auditório',
  floor: '',
  capacityMin: 30,
  capacityMax: 50,
  areaM2: null,
  layouts: {},
  priceHour: null,
  priceShift: null,
  priceDay: null,
  showPrices: false,
  isAvailable: true,
  isFeatured: n <= 2,
  sortOrder: n,
  seoTitle: '',
  seoDescription: '',
  ...data,
});

const photo = (name: string, alt: string) => ({ src: `static:${name}`, alt, w: 1152, h: 1536 });

export const SEED_ROOMS: SeedRoom[] = [
  room(1, {
    tagline: 'Para ensinar e compartilhar.',
    summary: 'Cadeiras com prancheta voltadas para a tela de projeção, com quadros brancos dos dois lados. Indicado para aulas, cursos e apresentações.',
    description: `O Auditório 1 foi montado para aulas e apresentações: as cadeiras com prancheta ficam voltadas para a tela de projeção, com quadros brancos dos dois lados e datashow.\n\n${BASE_DESCRIPTION}`,
    photos: [photo('auditorio-1', 'Auditório 1 com cadeiras com prancheta, tela de projeção e quadro branco')],
    amenities: ['cadeiras-prancheta', 'projetor', 'tela-projecao', 'quadro-branco', 'climatizacao', 'copa', 'banheiro'],
  }),
  room(2, {
    tagline: 'Para reunir e desenvolver.',
    summary: 'Tela de projeção, quadro branco e área frontal livre para demonstrações. Indicado para treinamentos e encontros com parte prática.',
    description: `O Auditório 2 tem área frontal livre diante da tela de projeção e do quadro branco, o que facilita demonstrações e atividades em que o instrutor circula pela sala.\n\n${BASE_DESCRIPTION}`,
    photos: [photo('auditorio-2', 'Auditório 2 com cadeiras com prancheta, tela de projeção, quadro branco e área frontal livre')],
    amenities: ['cadeiras-prancheta', 'projetor', 'tela-projecao', 'quadro-branco', 'climatizacao', 'copa', 'banheiro'],
  }),
  room(3, {
    tagline: 'Para novas ideias.',
    summary: 'Quadro de vidro, projetor no teto e cadeiras com prancheta. Indicado para oficinas, workshops e reuniões de trabalho.',
    description: `O Auditório 3 combina quadro de vidro e projetor instalado no teto, um bom formato para oficinas e reuniões em que as ideias vão sendo registradas ao longo do encontro.\n\n${BASE_DESCRIPTION}`,
    photos: [photo('auditorio-3', 'Auditório 3 com cadeiras com prancheta, quadro de vidro e projetor no teto')],
    amenities: ['cadeiras-prancheta', 'projetor', 'quadro-vidro', 'climatizacao', 'copa', 'banheiro'],
  }),
  room(4, {
    tagline: 'Para aprender e trocar.',
    summary: 'Tela de projeção e área frontal livre, com cadeiras com prancheta. Indicado para cursos, palestras e encontros de formação.',
    description: `O Auditório 4 tem tela de projeção e área frontal livre, adequada para palestras, cursos e encontros de formação.\n\n${BASE_DESCRIPTION}`,
    photos: [photo('auditorio-4', 'Auditório 4 com cadeiras com prancheta, tela de projeção e área frontal livre')],
    amenities: ['cadeiras-prancheta', 'projetor', 'tela-projecao', 'climatizacao', 'copa', 'banheiro'],
  }),
];

type SeedFaq = Pick<Faq, 'id' | 'question' | 'answer' | 'scope' | 'sortOrder'>;

export const SEED_FAQS: SeedFaq[] = [
  {
    id: 'faq-hora-turno',
    scope: 'home',
    sortOrder: 1,
    question: 'Posso alugar por hora ou por turno?',
    answer:
      'Sim. Você pode consultar a locação de um auditório por hora ou por turno, ou do andar completo como pacote corporativo. A disponibilidade e as condições são confirmadas pela equipe.',
  },
  {
    id: 'faq-capacidade-valor',
    scope: 'home',
    sortOrder: 2,
    question: 'Qual é a capacidade e o valor das salas?',
    answer:
      'Os auditórios recebem de 30 a 50 pessoas, conforme o espaço. Informe o número de participantes para que a equipe indique a sala adequada e confirme os recursos e os valores de locação.',
  },
  {
    id: 'faq-estrutura',
    scope: 'home',
    sortOrder: 3,
    question: 'O que faz parte da estrutura?',
    answer:
      'As salas têm cadeiras com prancheta, que podem ser organizadas em diferentes formatos, tela de projeção, climatização e datashow. Todos os andares possuem banheiro e copa para coffee break; os serviços de alimentação e o uso da copa são combinados com a equipe.',
  },
  {
    id: 'faq-andar-inteiro',
    scope: 'home',
    sortOrder: 4,
    question: 'Posso locar o andar inteiro?',
    answer:
      'Sim. O pacote corporativo inclui o andar completo, com três salas/auditórios e uma recepção que pode ser adaptada e customizada para sua empresa. Consulte disponibilidade e condições de personalização.',
  },
  {
    id: 'faq-confirmar-reserva',
    scope: 'home',
    sortOrder: 5,
    question: 'Como confirmo minha reserva?',
    answer:
      'Envie a consulta pelo formulário do site com seu nome, WhatsApp, a data e o número de participantes. A equipe verifica a disponibilidade e as condições de locação e responde no WhatsApp. A reserva fica confirmada quando vocês combinam os detalhes e agendam a sala.',
  },
  {
    id: 'faq-onde-ficam',
    scope: 'home',
    sortOrder: 6,
    question: 'Onde ficam os auditórios?',
    answer:
      'Na Rua São Bento, nº 09, 13º e 14º andares, Centro, Rio de Janeiro — RJ, perto do Museu do Amanhã e de restaurantes. Confirme com a equipe em qual andar fica o auditório reservado.',
  },
  {
    id: 'faq-corp-inclui',
    scope: 'corporativo',
    sortOrder: 1,
    question: 'O que está incluído no pacote corporativo?',
    answer:
      'A locação do andar completo: três salas/auditórios, a recepção, a copa para coffee break e o banheiro do andar. A recepção pode ser adaptada à identidade da sua empresa, conforme condições combinadas.',
  },
  {
    id: 'faq-corp-personalizar',
    scope: 'corporativo',
    sortOrder: 2,
    question: 'Posso personalizar a recepção com a minha marca?',
    answer:
      'Sim, a recepção pode ser adaptada e customizada para o seu negócio. Conte o que você precisa na consulta para a equipe avaliar as possibilidades.',
  },
  {
    id: 'faq-corp-prazo',
    scope: 'corporativo',
    sortOrder: 3,
    question: 'Com quanto tempo de antecedência devo consultar?',
    answer:
      'Quanto antes, melhor: a disponibilidade do andar completo depende da agenda das salas. Envie a data pretendida e a duração para a equipe verificar.',
  },
];
