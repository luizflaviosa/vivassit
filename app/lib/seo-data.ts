// app/lib/seo-data.ts
//
// Dados estaticos pra geracao programatica das paginas de SEO local
// (/secretaria-ia/[especialidade]/[cidade] e /para/[especialidade]/[cidade]).
// Cobrimos as 12 especialidades mais procuradas em consultorios privados
// brasileiros x 30 maiores cidades (criterio: populacao IBGE + capitais
// regionais), totalizando 360 combinacoes. Mantemos abaixo do limite
// onde o Google passa a tratar como spam de paginas geradas
// (referencia: 200-500 combinacoes).
//
// As listas sao append-only — adicionar novos itens nao invalida URLs
// existentes. Renomear slug exige redirect 301 no proximo passo.

export type Specialty = {
  slug: string;
  /** Nome no singular, ex.: "Dentista". */
  name: string;
  /** Nome no plural, ex.: "Dentistas". */
  plural: string;
  /** Artigo definido masculino/feminino — usado em template "{article} {especialidade}". */
  article: 'o' | 'a';
  /** Sigla do conselho profissional, vazio quando nao se aplica. */
  councilLabel: string;
};

/**
 * Especialidade enriquecida com casos de uso especificos da profissao.
 * Usada pelas paginas programaticas pra evitar copia "doctor-centric"
 * que nao faz sentido pra dentista/psicologo/fisio/nutri/etc.
 */
export type SeoSpecialty = Specialty & {
  /**
   * Termo neutro pra referir-se a quem o profissional atende:
   * "paciente" pra medico/dentista/fisio/nutri/psicologo, "cliente" pra esteticista.
   */
  audience: 'paciente' | 'cliente';
  /**
   * Termo pro evento principal: "consulta" pra medico/psicologo/nutri,
   * "sessao" pra psicologo/fisio/terapeuta, "atendimento" generico.
   */
  appointmentTerm: 'consulta' | 'sessao' | 'atendimento' | 'procedimento';
  /**
   * 3 casos de uso reais e especificos da profissao — usados em copy
   * pra mostrar que a IA entende o fluxo daquela especialidade.
   */
  useCases: ReadonlyArray<string>;
};

export type City = {
  slug: string;
  name: string;
  /** UF — duas letras maiusculas. */
  state: string;
  /** Populacao estimada (IBGE 2022/2023) — usada em parametros do texto. */
  population: number;
  /** Regiao do IBGE — Norte | Nordeste | Centro-Oeste | Sudeste | Sul. */
  region: 'Norte' | 'Nordeste' | 'Centro-Oeste' | 'Sudeste' | 'Sul';
};

export const SPECIALTIES: ReadonlyArray<Specialty> = [
  { slug: 'medico', name: 'Médico', plural: 'Médicos', article: 'o', councilLabel: 'CRM' },
  { slug: 'dentista', name: 'Dentista', plural: 'Dentistas', article: 'o', councilLabel: 'CRO' },
  { slug: 'psicologo', name: 'Psicólogo', plural: 'Psicólogos', article: 'o', councilLabel: 'CRP' },
  { slug: 'fisioterapeuta', name: 'Fisioterapeuta', plural: 'Fisioterapeutas', article: 'o', councilLabel: 'CREFITO' },
  { slug: 'nutricionista', name: 'Nutricionista', plural: 'Nutricionistas', article: 'o', councilLabel: 'CRN' },
  { slug: 'fonoaudiologo', name: 'Fonoaudiólogo', plural: 'Fonoaudiólogos', article: 'o', councilLabel: 'CRFa' },
  { slug: 'terapeuta', name: 'Terapeuta', plural: 'Terapeutas', article: 'o', councilLabel: '' },
  { slug: 'psicanalista', name: 'Psicanalista', plural: 'Psicanalistas', article: 'o', councilLabel: '' },
  { slug: 'enfermeiro', name: 'Enfermeiro', plural: 'Enfermeiros', article: 'o', councilLabel: 'COREN' },
  { slug: 'psicopedagogo', name: 'Psicopedagogo', plural: 'Psicopedagogos', article: 'o', councilLabel: 'ABPp' },
  { slug: 'esteticista', name: 'Profissional de Estética', plural: 'Profissionais de Estética', article: 'o', councilLabel: '' },
];

/**
 * Especialidades enriquecidas com terminologia e casos de uso especificos.
 * Esta eh a lista canonica usada pelas paginas programaticas /secretaria-ia/.
 *
 * Quando adicionar nova especialidade, garantir que useCases seja
 * concreto e profissional-apropriado, nao generico.
 */
export const SEO_ESPECIALIDADES: ReadonlyArray<SeoSpecialty> = [
  {
    slug: 'medico',
    name: 'Médico',
    plural: 'Médicos',
    article: 'o',
    councilLabel: 'CRM',
    audience: 'paciente',
    appointmentTerm: 'consulta',
    useCases: [
      'triagem de sintomas urgentes',
      'agendamento de consulta',
      'envio de exames pré-consulta',
    ],
  },
  {
    slug: 'dentista',
    name: 'Dentista',
    plural: 'Dentistas',
    article: 'o',
    councilLabel: 'CRO',
    audience: 'paciente',
    appointmentTerm: 'procedimento',
    useCases: [
      'agendamento de procedimentos',
      'lembrete de retorno em 6 meses',
      'cobrança parcelada de tratamento',
    ],
  },
  {
    slug: 'psicologo',
    name: 'Psicólogo',
    plural: 'Psicólogos',
    article: 'o',
    councilLabel: 'CRP',
    audience: 'paciente',
    appointmentTerm: 'sessao',
    useCases: [
      'agendamento semanal de sessões',
      'reagendamento sem fricção',
      'lembrete D-1 com discrição',
    ],
  },
  {
    slug: 'fisioterapeuta',
    name: 'Fisioterapeuta',
    plural: 'Fisioterapeutas',
    article: 'o',
    councilLabel: 'CREFITO',
    audience: 'paciente',
    appointmentTerm: 'sessao',
    useCases: [
      'controle de presença em pacotes',
      'evolução pós-sessão',
      'cobrança por sessão',
    ],
  },
  {
    slug: 'nutricionista',
    name: 'Nutricionista',
    plural: 'Nutricionistas',
    article: 'o',
    councilLabel: 'CRN',
    audience: 'paciente',
    appointmentTerm: 'consulta',
    useCases: [
      'envio do plano alimentar',
      'acompanhamento semanal',
      'retorno mensal',
    ],
  },
  {
    slug: 'fonoaudiologo',
    name: 'Fonoaudiólogo',
    plural: 'Fonoaudiólogos',
    article: 'o',
    councilLabel: 'CRFa',
    audience: 'paciente',
    appointmentTerm: 'sessao',
    useCases: [
      'agendamento de sessões recorrentes',
      'envio de exercícios entre sessões',
      'acompanhamento de evolução',
    ],
  },
  {
    slug: 'terapeuta',
    name: 'Terapeuta',
    plural: 'Terapeutas',
    article: 'o',
    councilLabel: '',
    audience: 'paciente',
    appointmentTerm: 'sessao',
    useCases: [
      'agendamento de sessões individuais',
      'pacotes mensais com cobrança recorrente',
      'lembrete discreto pré-sessão',
    ],
  },
  {
    slug: 'psicanalista',
    name: 'Psicanalista',
    plural: 'Psicanalistas',
    article: 'o',
    councilLabel: '',
    audience: 'paciente',
    appointmentTerm: 'sessao',
    useCases: [
      'agendamento de sessões fixas semanais',
      'reagendamento sem expor o paciente',
      'cobrança mensal automatizada',
    ],
  },
  {
    slug: 'enfermeiro',
    name: 'Enfermeiro',
    plural: 'Enfermeiros',
    article: 'o',
    councilLabel: 'COREN',
    audience: 'paciente',
    appointmentTerm: 'atendimento',
    useCases: [
      'agendamento de procedimentos domiciliares',
      'controle de medicações e curativos',
      'follow-up pós-alta',
    ],
  },
  {
    slug: 'psicopedagogo',
    name: 'Psicopedagogo',
    plural: 'Psicopedagogos',
    article: 'o',
    councilLabel: 'ABPp',
    audience: 'paciente',
    appointmentTerm: 'sessao',
    useCases: [
      'agendamento de sessões com crianças e responsáveis',
      'envio de relatórios pra escola',
      'acompanhamento longitudinal',
    ],
  },
  {
    slug: 'esteticista',
    name: 'Profissional de Estética',
    plural: 'Profissionais de Estética',
    article: 'o',
    councilLabel: '',
    audience: 'cliente',
    appointmentTerm: 'procedimento',
    useCases: [
      'agendamento de pacotes de procedimentos',
      'lembrete de retorno por protocolo',
      'cobrança parcelada com link de pagamento',
    ],
  },
  {
    slug: 'pediatra',
    name: 'Pediatra',
    plural: 'Pediatras',
    article: 'o',
    councilLabel: 'CRM',
    audience: 'paciente',
    appointmentTerm: 'consulta',
    useCases: [
      'agendamento conforme calendário vacinal',
      'lembrete de puericultura por faixa etária',
      'orientação a pais antes da consulta',
    ],
  },
];

export const CITIES: ReadonlyArray<City> = [
  { slug: 'sao-paulo', name: 'São Paulo', state: 'SP', population: 12300000, region: 'Sudeste' },
  { slug: 'rio-de-janeiro', name: 'Rio de Janeiro', state: 'RJ', population: 6750000, region: 'Sudeste' },
  { slug: 'brasilia', name: 'Brasília', state: 'DF', population: 3055000, region: 'Centro-Oeste' },
  { slug: 'salvador', name: 'Salvador', state: 'BA', population: 2900000, region: 'Nordeste' },
  { slug: 'fortaleza', name: 'Fortaleza', state: 'CE', population: 2700000, region: 'Nordeste' },
  { slug: 'belo-horizonte', name: 'Belo Horizonte', state: 'MG', population: 2530000, region: 'Sudeste' },
  { slug: 'manaus', name: 'Manaus', state: 'AM', population: 2230000, region: 'Norte' },
  { slug: 'curitiba', name: 'Curitiba', state: 'PR', population: 1960000, region: 'Sul' },
  { slug: 'recife', name: 'Recife', state: 'PE', population: 1660000, region: 'Nordeste' },
  { slug: 'porto-alegre', name: 'Porto Alegre', state: 'RS', population: 1490000, region: 'Sul' },
  { slug: 'goiania', name: 'Goiânia', state: 'GO', population: 1530000, region: 'Centro-Oeste' },
  { slug: 'belem', name: 'Belém', state: 'PA', population: 1500000, region: 'Norte' },
  { slug: 'guarulhos', name: 'Guarulhos', state: 'SP', population: 1410000, region: 'Sudeste' },
  { slug: 'campinas', name: 'Campinas', state: 'SP', population: 1210000, region: 'Sudeste' },
  { slug: 'sao-luis', name: 'São Luís', state: 'MA', population: 1110000, region: 'Nordeste' },
  { slug: 'sao-goncalo', name: 'São Gonçalo', state: 'RJ', population: 1080000, region: 'Sudeste' },
  { slug: 'maceio', name: 'Maceió', state: 'AL', population: 1030000, region: 'Nordeste' },
  { slug: 'duque-de-caxias', name: 'Duque de Caxias', state: 'RJ', population: 920000, region: 'Sudeste' },
  { slug: 'natal', name: 'Natal', state: 'RN', population: 890000, region: 'Nordeste' },
  { slug: 'teresina', name: 'Teresina', state: 'PI', population: 870000, region: 'Nordeste' },
  { slug: 'campo-grande', name: 'Campo Grande', state: 'MS', population: 920000, region: 'Centro-Oeste' },
  { slug: 'jundiai', name: 'Jundiaí', state: 'SP', population: 425000, region: 'Sudeste' },
  { slug: 'osasco', name: 'Osasco', state: 'SP', population: 700000, region: 'Sudeste' },
  { slug: 'ribeirao-preto', name: 'Ribeirão Preto', state: 'SP', population: 720000, region: 'Sudeste' },
  { slug: 'uberlandia', name: 'Uberlândia', state: 'MG', population: 700000, region: 'Sudeste' },
  { slug: 'sorocaba', name: 'Sorocaba', state: 'SP', population: 690000, region: 'Sudeste' },
  { slug: 'aracaju', name: 'Aracaju', state: 'SE', population: 660000, region: 'Nordeste' },
  { slug: 'contagem', name: 'Contagem', state: 'MG', population: 660000, region: 'Sudeste' },
  { slug: 'feira-de-santana', name: 'Feira de Santana', state: 'BA', population: 620000, region: 'Nordeste' },
  { slug: 'cuiaba', name: 'Cuiabá', state: 'MT', population: 620000, region: 'Centro-Oeste' },
];

export function findSpecialty(slug: string): Specialty | undefined {
  return SPECIALTIES.find((s) => s.slug === slug);
}

export function findSeoEspecialidade(slug: string): SeoSpecialty | undefined {
  return SEO_ESPECIALIDADES.find((s) => s.slug === slug);
}

export function findCity(slug: string): City | undefined {
  return CITIES.find((c) => c.slug === slug);
}

/**
 * Produto cartesiano de todas as combinacoes (especialidade x cidade)
 * pras paginas programaticas de SEO. Usado pelo sitemap.ts pra registrar
 * cada URL `/secretaria-ia/[especialidade]/[cidade]`.
 *
 * Re-exporta o mesmo conjunto que `generateStaticParams` retorna na rota
 * `secretaria-ia/[especialidade]/[cidade]/page.tsx`, mas em formato de
 * objeto com slug aninhado pra facilitar montagem da URL.
 */
export function getAllPaths(): Array<{
  especialidade: SeoSpecialty;
  cidade: City;
}> {
  const out: Array<{ especialidade: SeoSpecialty; cidade: City }> = [];
  for (const especialidade of SEO_ESPECIALIDADES) {
    for (const cidade of CITIES) {
      out.push({ especialidade, cidade });
    }
  }
  return out;
}
