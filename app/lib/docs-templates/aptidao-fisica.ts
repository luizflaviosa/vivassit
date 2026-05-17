// Atestado de Aptidão Física pra prática esportiva / academia.
//
// Base legal:
//   - Resolução CFM 1.658/2002 (estrutura geral de atestado)
//   - Resolução CFM 2.381/2024 (campos obrigatórios atualizados)
//   - Lei SP 10.848/2001 (PAR-Q em academias paulistas; opcional na clínica)
//   - Diretriz SBC/SBME de Cardiologia do Esporte (2013) — anamnese + exame
//     físico minucioso + pelo menos um exame complementar (ECG)
//
// Validade padrão: 12 meses a partir da emissão (prática consolidada de academias).

import {
  TemplateContext,
  formatDateBR,
  calcAge,
  formatCouncil,
  professionalSignatureBlock,
  placeOfIssue,
  clinicHeaderBlock,
  type FormField,
} from './_shared';

export const ACTIVITY_TYPES = [
  'Musculação',
  'Corrida',
  'Natação',
  'Esporte coletivo (futebol, vôlei, basquete)',
  'Artes marciais',
  'CrossFit / treinamento funcional',
  'Pilates',
  'Yoga',
  'Ciclismo',
  'Atividade física regular sem modalidade específica',
  'Outro',
] as const;

export type FitnessResult = 'apto' | 'inapto' | 'apto_restricoes';

export interface AptidaoFisicaForm {
  activity_type: string;
  result: FitnessResult;
  restrictions: string;       // só preenchido quando result = apto_restricoes
  exams_performed: string[];  // ex: ['Anamnese', 'Exame físico geral', 'PA aferida', 'ECG de repouso']
  observations: string;       // texto livre opcional
  validity_months: number;    // default 12
}

export const APTIDAO_DEFAULTS: AptidaoFisicaForm = {
  activity_type: 'Atividade física regular sem modalidade específica',
  result: 'apto',
  restrictions: '',
  exams_performed: ['Anamnese dirigida', 'Exame físico geral', 'Aferição de PA e FC'],
  observations: '',
  validity_months: 12,
};

const RESULT_LABEL: Record<FitnessResult, string> = {
  apto: 'APTO',
  inapto: 'INAPTO',
  apto_restricoes: 'APTO COM RESTRIÇÕES',
};

export function renderAptidaoFisica(
  ctx: TemplateContext,
  data: AptidaoFisicaForm,
): string {
  const p = ctx.patient;
  const age = calcAge(p.birthdate, ctx.issue_date);
  const validityDate = (() => {
    const d = new Date(ctx.issue_date);
    d.setUTCMonth(d.getUTCMonth() + (data.validity_months ?? 12));
    return formatDateBR(d.toISOString());
  })();

  const patientLine =
    `${p.name}` +
    (p.cpf ? `, CPF ${p.cpf}` : '') +
    (age !== null ? `, ${age} anos` : '') +
    (p.birthdate ? ` (nascido(a) em ${formatDateBR(p.birthdate)})` : '');

  const resultBlock = (() => {
    if (data.result === 'apto') {
      return `está **APTO(A)** à prática de **${data.activity_type}**, sem restrições, devendo respeitar a progressão de carga orientada pelo profissional de educação física.`;
    }
    if (data.result === 'inapto') {
      return `está **INAPTO(A)** à prática de **${data.activity_type}** no momento. Recomenda-se avaliação médica adicional antes do início da atividade.`;
    }
    return `está **APTO(A) COM RESTRIÇÕES** à prática de **${data.activity_type}**, observadas as seguintes orientações: ${data.restrictions || '(a preencher)'}`;
  })();

  const examsLine = data.exams_performed.length
    ? `Foram realizados: ${data.exams_performed.join(', ')}.`
    : '';

  const obsLine = data.observations ? `\n\nObservações: ${data.observations}` : '';

  return `
${clinicHeaderBlock(ctx)}

# ATESTADO DE APTIDÃO FÍSICA

Atesto, para os devidos fins e em conformidade com a Resolução CFM nº 2.381/2024, que o(a) paciente ${patientLine} foi submetido(a) nesta data a avaliação clínica em consultório.

${examsLine}

Após a avaliação, concluo que o(a) paciente ${resultBlock}${obsLine}

Este atestado tem validade de ${data.validity_months} meses, expirando em ${validityDate}.

${placeOfIssue(ctx)}

${professionalSignatureBlock(ctx)}
`.trim();
}

const APTIDAO_FORM_FIELDS: FormField[] = [
  {
    type: 'select',
    name: 'activity_type',
    label: 'Tipo de atividade',
    required: true,
    options: ACTIVITY_TYPES.map((a) => ({ value: a, label: a })),
  },
  {
    type: 'radio',
    name: 'result',
    label: 'Resultado da avaliação',
    required: true,
    orientation: 'horizontal',
    options: [
      { value: 'apto', label: 'Apto' },
      { value: 'inapto', label: 'Inapto' },
      { value: 'apto_restricoes', label: 'Apto com restrições' },
    ],
  },
  {
    type: 'textarea',
    name: 'restrictions',
    label: 'Restrições / orientações',
    rows: 3,
    placeholder: 'Ex.: evitar carga axial elevada por 90 dias...',
    show: (f) => f.result === 'apto_restricoes',
  },
  {
    type: 'tag-list',
    name: 'exams_performed',
    label: 'Exames realizados',
    allowCustom: true,
    options: [
      'Anamnese dirigida',
      'Exame físico geral',
      'Aferição de PA e FC',
      'ECG de repouso 12 derivações',
      'Teste ergométrico',
      'Espirometria',
    ],
  },
  {
    type: 'textarea',
    name: 'observations',
    label: 'Observações',
    rows: 2,
    placeholder: 'Texto livre opcional',
  },
  {
    type: 'number',
    name: 'validity_months',
    label: 'Validade (meses)',
    min: 1,
    max: 24,
    step: 1,
  },
  {
    type: 'derived',
    name: 'validity_date_computed',
    label: 'Validade calculada',
    tone: 'info',
    compute: (form) => {
      const months = Number(form.validity_months ?? 12);
      if (!months || months < 1) return null;
      const d = new Date();
      d.setMonth(d.getMonth() + months);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `Atestado válido até ${dd}/${mm}/${d.getFullYear()}`;
    },
  },
];

export const APTIDAO_FISICA_TEMPLATE = {
  doc_type: 'aptidao_fisica' as const,
  display_name: 'Atestado de Aptidão Física',
  defaults: APTIDAO_DEFAULTS,
  render: renderAptidaoFisica,
  required_fields: ['activity_type', 'result'] as const,
  form_fields: APTIDAO_FORM_FIELDS,
};
