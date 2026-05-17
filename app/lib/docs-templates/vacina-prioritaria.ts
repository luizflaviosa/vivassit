// Declaração / Relatório Médico de Pertencimento a Grupo Prioritário pra Vacinação
//
// Base operacional:
//   - Programa Nacional de Imunizações (PNI / Ministério da Saúde)
//   - Notas Técnicas estaduais sobre comorbidades prioritárias
//   - Resolução CFM 2.381/2024 — campos obrigatórios
//
// Uso típico: paciente apresenta no posto de vacinação pra comprovar
// pertencimento a grupo prioritário (comorbidades, gestantes, puérperas,
// imunossuprimidos, doenças raras, ocupações específicas etc).

import {
  TemplateContext,
  formatDateBR,
  professionalSignatureBlock,
  placeOfIssue,
  clinicHeaderBlock,
  type FormField,
} from './_shared';

export const VACCINATION_PRIORITY_GROUPS = [
  { value: 'comorbidades', label: 'Pessoa com comorbidade' },
  { value: 'gestante', label: 'Gestante' },
  { value: 'puerpera', label: 'Puérpera (até 45 dias pós-parto)' },
  { value: 'imunossuprimido', label: 'Imunossuprimido / imunocomprometido' },
  { value: 'doenca_rara', label: 'Pessoa com doença rara' },
  { value: 'transplantado', label: 'Pessoa transplantada ou aguardando transplante' },
  { value: 'oncologico', label: 'Paciente oncológico em tratamento' },
  { value: 'doenca_renal', label: 'Doença renal crônica em diálise' },
  { value: 'sindrome_down', label: 'Pessoa com síndrome de Down' },
  { value: 'idoso_acamado', label: 'Idoso(a) acamado(a) ou com mobilidade reduzida' },
  { value: 'cuidador', label: 'Cuidador formal/informal de pessoa idosa ou imunossuprimida' },
  { value: 'outro', label: 'Outro grupo prioritário (especificar na justificativa)' },
] as const;

export type PriorityGroup = typeof VACCINATION_PRIORITY_GROUPS[number]['value'];

export interface VacinaPrioritariaForm {
  priority_group: PriorityGroup;
  vaccine_name: string;            // ex: "Influenza tetravalente", "Pneumocócica 23-valente", "Hepatite B"
  cid10_primary: string;           // CID que justifica
  cid10_primary_description: string;
  cid10_secondary?: string;
  clinical_justification: string;  // descreve a condição que coloca em grupo prioritário
  in_treatment_for: string;        // "dialysis since 2022", "quimio FOLFOX semanal" etc
  current_medications?: string;    // imunossupressores, biológicos, etc
  recommended_vaccine_schedule?: string; // ex: "dose única; reforço em 5 anos"
}

export const VACINA_DEFAULTS: VacinaPrioritariaForm = {
  priority_group: 'comorbidades',
  vaccine_name: '',
  cid10_primary: '',
  cid10_primary_description: '',
  cid10_secondary: undefined,
  clinical_justification: '',
  in_treatment_for: '',
  current_medications: undefined,
  recommended_vaccine_schedule: undefined,
};

export function renderVacinaPrioritaria(
  ctx: TemplateContext,
  data: VacinaPrioritariaForm,
): string {
  const p = ctx.patient;
  const groupLabel = VACCINATION_PRIORITY_GROUPS.find(g => g.value === data.priority_group)?.label
    ?? data.priority_group;

  const cidLine = data.cid10_secondary
    ? `**${data.cid10_primary}** (${data.cid10_primary_description}); secundário: ${data.cid10_secondary}`
    : `**${data.cid10_primary}** (${data.cid10_primary_description})`;

  return `
${clinicHeaderBlock(ctx)}

# DECLARAÇÃO MÉDICA PARA VACINAÇÃO PRIORITÁRIA

Conforme Programa Nacional de Imunizações (PNI / Ministério da Saúde) e Resolução CFM nº 2.381/2024.

## Identificação do paciente

- **Nome:** ${p.name}
- **CPF:** ${p.cpf ?? '(não informado)'}
- **CNS:** ${p.cns ?? '(não informado)'}
- **Data de nascimento:** ${formatDateBR(p.birthdate)}

## Vacina pleiteada

**${data.vaccine_name}**${data.recommended_vaccine_schedule ? ` — esquema recomendado: ${data.recommended_vaccine_schedule}` : ''}

## Pertencimento a grupo prioritário

Atesto, para fins de comprovação junto à unidade de saúde, que o(a) paciente acima identificado(a) integra o grupo prioritário **"${groupLabel}"** conforme calendário de imunização vigente.

## Fundamentação clínica

- **CID-10:** ${cidLine}
- **Quadro clínico atual:** ${data.clinical_justification}
- **Em tratamento de:** ${data.in_treatment_for}${data.current_medications ? `\n- **Medicações em uso:** ${data.current_medications}` : ''}

A condição clínica descrita justifica o enquadramento do(a) paciente no grupo prioritário e a recomendação de imunização conforme protocolo do PNI.

${placeOfIssue(ctx)}

${professionalSignatureBlock(ctx)}
`.trim();
}

const VACINA_FORM_FIELDS: FormField[] = [
  {
    type: 'select',
    name: 'priority_group',
    label: 'Grupo prioritário',
    required: true,
    options: VACCINATION_PRIORITY_GROUPS.map((g) => ({ value: g.value, label: g.label })),
  },
  { type: 'text', name: 'vaccine_name', label: 'Vacina pleiteada', required: true, placeholder: 'Ex.: Influenza tetravalente (dose anual)' },
  {
    type: 'group',
    label: 'Diagnóstico (CID-10)',
    fields: [
      {
        type: 'cid-search',
        name: 'cid10_primary',
        label: 'CID-10 que justifica o grupo prioritário',
        required: true,
        descriptionField: 'cid10_primary_description',
      },
      { type: 'text', name: 'cid10_secondary', label: 'CID-10 secundário (opcional)' },
    ],
  },
  { type: 'textarea', name: 'clinical_justification', label: 'Quadro clínico atual', rows: 3, required: true },
  { type: 'textarea', name: 'in_treatment_for', label: 'Em tratamento de', rows: 2, placeholder: 'Ex.: Diálise desde 2022; quimio FOLFOX semanal etc.' },
  { type: 'textarea', name: 'current_medications', label: 'Medicações em uso (opcional)', rows: 2, placeholder: 'Imunossupressores, biológicos, citotóxicos...' },
  { type: 'text', name: 'recommended_vaccine_schedule', label: 'Esquema vacinal recomendado (opcional)', placeholder: 'Ex.: dose única; reforço em 5 anos' },
];

export const VACINA_PRIORITARIA_TEMPLATE = {
  doc_type: 'vacina_prioritaria' as const,
  display_name: 'Declaração para Vacinação Prioritária',
  defaults: VACINA_DEFAULTS,
  render: renderVacinaPrioritaria,
  required_fields: ['priority_group', 'vaccine_name', 'cid10_primary', 'clinical_justification'] as const,
  form_fields: VACINA_FORM_FIELDS,
};
