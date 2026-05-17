// Relatório / Atestado Médico para Afastamento INSS — análise documental (Atestmed)
//
// Base legal e operacional:
//   - Portaria Conjunta MPS/INSS nº 13/2026 — Novo Atestmed (análise documental
//     até 90 dias sem perícia presencial)
//   - Resolução CFM 2.381/2024 — campos obrigatórios de atestado
//   - Lei 8.213/91 — benefícios por incapacidade temporária
//
// Campos exigidos pelo INSS pra aprovar via Atestmed:
//   1. Identificação do segurado (nome completo + CPF)
//   2. Diagnóstico OU CID-10
//   3. Tempo estimado de afastamento (até 90 dias pra ir via documental)
//   4. Data de emissão
//   5. Assinatura + identificação profissional + CRM
//   6. Documento legível, sem rasuras

import {
  TemplateContext,
  formatDateBR,
  formatDateLong,
  professionalSignatureBlock,
  placeOfIssue,
  clinicHeaderBlock,
} from './_shared';

export interface AfastamentoInssForm {
  cid_primary: string;              // ex: "M54.5"
  cid_primary_description: string;  // ex: "Dor lombar baixa"
  cid_secondary?: string;
  cid_secondary_description?: string;
  clinical_history: string;         // texto livre — quadro clínico que justifica
  exam_findings: string;            // achados de exame físico / propedêutica
  treatment_plan: string;           // conduta proposta
  days_off: number;                 // tempo de afastamento (max 90 pra Atestmed)
  rest_start_date: string;          // ISO YYYY-MM-DD
  is_retroactive: boolean;          // se rest_start_date é anterior à emissão
  occupation?: string;              // profissão do segurado (opcional, ajuda análise)
  cnis_number?: string;             // NIT/PIS — opcional
}

export const AFASTAMENTO_DEFAULTS: AfastamentoInssForm = {
  cid_primary: '',
  cid_primary_description: '',
  cid_secondary: undefined,
  cid_secondary_description: undefined,
  clinical_history: '',
  exam_findings: '',
  treatment_plan: '',
  days_off: 15,
  rest_start_date: new Date().toISOString().slice(0, 10),
  is_retroactive: false,
  occupation: undefined,
  cnis_number: undefined,
};

export function renderAfastamentoInss(
  ctx: TemplateContext,
  data: AfastamentoInssForm,
): string {
  const p = ctx.patient;
  const cidLine = data.cid_secondary
    ? `CID-10 principal: **${data.cid_primary}** (${data.cid_primary_description}); CID-10 secundário: ${data.cid_secondary} (${data.cid_secondary_description || ''})`
    : `CID-10: **${data.cid_primary}** (${data.cid_primary_description})`;

  const restStart = formatDateBR(data.rest_start_date);
  const restEnd = (() => {
    const d = new Date(data.rest_start_date);
    d.setUTCDate(d.getUTCDate() + (data.days_off ?? 0) - 1);
    return formatDateBR(d.toISOString());
  })();

  const ninetyDayWarning = data.days_off > 90
    ? `\n\n> **Atenção:** afastamento superior a 90 dias requer perícia presencial. Este documento poderá ser solicitado em complementação ao Atestmed.`
    : '';

  return `
${clinicHeaderBlock(ctx)}

# RELATÓRIO MÉDICO PARA AFASTAMENTO PREVIDENCIÁRIO

Em conformidade com a Portaria Conjunta MPS/INSS nº 13/2026 (Novo Atestmed) e a Resolução CFM nº 2.381/2024.

## Identificação do segurado

- **Nome:** ${p.name}
- **CPF:** ${p.cpf ?? '(não informado)'}
- **Data de nascimento:** ${formatDateBR(p.birthdate)}${data.occupation ? `\n- **Ocupação:** ${data.occupation}` : ''}${data.cnis_number ? `\n- **NIT/PIS:** ${data.cnis_number}` : ''}

## Diagnóstico

${cidLine}

## Quadro clínico

${data.clinical_history}

## Achados de exame

${data.exam_findings}

## Conduta proposta

${data.treatment_plan}

## Recomendação de afastamento

Tendo em vista o quadro clínico descrito, atesto que o(a) paciente acima identificado(a) **necessita afastamento de suas atividades laborais por ${data.days_off} (${numberToWord(data.days_off)}) dias**, com início em **${restStart}** e término previsto em **${restEnd}**.${data.is_retroactive ? ` Trata-se de atestado retroativo, com início do repouso anterior à data desta emissão, justificado pelo quadro clínico documentado.` : ''}${ninetyDayWarning}

${placeOfIssue(ctx)}

${professionalSignatureBlock(ctx)}
`.trim();
}

function numberToWord(n: number): string {
  // Cobertura básica pra 1-90 (limite Atestmed) — suficiente pro caso de uso.
  const tens: Record<number, string> = {
    10: 'dez', 20: 'vinte', 30: 'trinta', 40: 'quarenta',
    50: 'cinquenta', 60: 'sessenta', 70: 'setenta', 80: 'oitenta', 90: 'noventa',
  };
  const ones: Record<number, string> = {
    1: 'um', 2: 'dois', 3: 'três', 4: 'quatro', 5: 'cinco',
    6: 'seis', 7: 'sete', 8: 'oito', 9: 'nove',
    11: 'onze', 12: 'doze', 13: 'treze', 14: 'quatorze', 15: 'quinze',
    16: 'dezesseis', 17: 'dezessete', 18: 'dezoito', 19: 'dezenove',
  };
  if (n <= 19 && ones[n]) return ones[n];
  if (n % 10 === 0 && tens[n]) return tens[n];
  const t = Math.floor(n / 10) * 10;
  const o = n % 10;
  if (tens[t] && ones[o]) return `${tens[t]} e ${ones[o]}`;
  return String(n);
}

export const AFASTAMENTO_INSS_TEMPLATE = {
  doc_type: 'afastamento_inss' as const,
  display_name: 'Relatório Médico — Afastamento INSS',
  defaults: AFASTAMENTO_DEFAULTS,
  render: renderAfastamentoInss,
  required_fields: ['cid_primary', 'clinical_history', 'days_off', 'rest_start_date'] as const,
};
