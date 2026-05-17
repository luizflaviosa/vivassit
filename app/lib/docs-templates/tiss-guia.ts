// Guia TISS — padrão ANS 4.01.00 (Componente de Conteúdo e Estrutura).
//
// Base regulatória:
//   - Padrão TISS (Troca de Informação em Saúde Suplementar) — ANS
//   - Resolução Normativa ANS nº 305/2012 (origem) + atualizações 2023+
//   - Versão atual em produção: 4.01.00 (vigor desde 01/05/2023)
//
// Cobertura deste template: Guia de Consulta + SP/SADT (os 2 tipos mais
// usados pelo prestador). Outras guias TISS (autorização, internação,
// honorário) ficam pra fase 2.
//
// Geração via XML real (pra envio à operadora) é responsabilidade do
// integrador. Este template renderiza a guia em formato HUMANO LEGÍVEL —
// pra paciente assinar e clínica arquivar.

import {
  TemplateContext,
  formatDateBR,
  professionalSignatureBlock,
  placeOfIssue,
  clinicHeaderBlock,
  formatCouncil,
} from './_shared';

export type TissGuiaType = 'consulta' | 'sp_sadt';

export interface TissConsultaForm {
  guia_type: 'consulta';
  numero_guia_prestador: string;       // ID interno da clínica
  numero_guia_operadora?: string;      // só após autorização
  data_atendimento: string;             // ISO YYYY-MM-DD
  hora_inicio: string;                  // HH:MM
  hora_fim?: string;
  tipo_consulta: '1' | '2' | '3' | '4'; // 1=Primeira, 2=Retorno, 3=Pré-natal, 4=Por encaminhamento
  cobertura: '1' | '2' | '3' | '4';     // 1=Saúde, 2=Odonto, 3=Co-participação, 4=Outras
  procedimento_tuss: string;            // ex: "10101012" (consulta em consultório)
  procedimento_descricao: string;        // ex: "Consulta em consultório"
  cid10_principal?: string;
  observacoes?: string;
}

export interface TissSadtForm {
  guia_type: 'sp_sadt';
  numero_guia_prestador: string;
  numero_guia_operadora?: string;
  numero_guia_principal?: string;       // se associada a outra guia
  data_atendimento: string;
  hora_inicio: string;
  hora_fim?: string;
  tipo_atendimento:                      // tabela 50 ANS
    | '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10';
  indicacao_clinica: string;
  procedimentos_executados: Array<{
    tuss_code: string;
    descricao: string;
    quantidade: number;
    via_acesso?: string;
    tecnica?: string;
    valor_unitario?: number;
  }>;
  cid10_principal?: string;
  observacoes?: string;
}

export type TissGuiaForm = TissConsultaForm | TissSadtForm;

export const TISS_CONSULTA_DEFAULTS: TissConsultaForm = {
  guia_type: 'consulta',
  numero_guia_prestador: '',
  numero_guia_operadora: undefined,
  data_atendimento: new Date().toISOString().slice(0, 10),
  hora_inicio: '00:00',
  hora_fim: undefined,
  tipo_consulta: '1',
  cobertura: '1',
  procedimento_tuss: '10101012',
  procedimento_descricao: 'Consulta em consultório (no horário normal ou preestabelecido)',
  cid10_principal: undefined,
  observacoes: undefined,
};

export const TISS_SADT_DEFAULTS: TissSadtForm = {
  guia_type: 'sp_sadt',
  numero_guia_prestador: '',
  numero_guia_operadora: undefined,
  numero_guia_principal: undefined,
  data_atendimento: new Date().toISOString().slice(0, 10),
  hora_inicio: '00:00',
  hora_fim: undefined,
  tipo_atendimento: '01',
  indicacao_clinica: '',
  procedimentos_executados: [
    { tuss_code: '', descricao: '', quantidade: 1, via_acesso: undefined, tecnica: undefined, valor_unitario: undefined },
  ],
  cid10_principal: undefined,
  observacoes: undefined,
};

const TIPO_CONSULTA_LABEL: Record<TissConsultaForm['tipo_consulta'], string> = {
  '1': '1 — Primeira consulta',
  '2': '2 — Retorno',
  '3': '3 — Pré-natal',
  '4': '4 — Por encaminhamento',
};

const COBERTURA_LABEL: Record<TissConsultaForm['cobertura'], string> = {
  '1': '1 — Saúde',
  '2': '2 — Odontológica',
  '3': '3 — Co-participação',
  '4': '4 — Outras',
};

const TIPO_ATENDIMENTO_LABEL: Record<TissSadtForm['tipo_atendimento'], string> = {
  '01': '01 — Remoção',
  '02': '02 — Pequena cirurgia',
  '03': '03 — Terapias',
  '04': '04 — Consulta',
  '05': '05 — Exames',
  '06': '06 — Atendimento domiciliar',
  '07': '07 — SADT internado',
  '08': '08 — Quimioterapia',
  '09': '09 — Radioterapia',
  '10': '10 — Terapia renal substitutiva',
};

export function renderTissGuia(
  ctx: TemplateContext,
  data: TissGuiaForm,
): string {
  return data.guia_type === 'consulta'
    ? renderConsulta(ctx, data)
    : renderSadt(ctx, data);
}

function renderConsulta(ctx: TemplateContext, d: TissConsultaForm): string {
  const p = ctx.patient;
  return `
${clinicHeaderBlock(ctx)}

# GUIA DE CONSULTA — PADRÃO TISS 4.01.00

(Resolução Normativa ANS nº 305/2012 e atualizações)

## Identificação

- **Nº guia prestador:** ${d.numero_guia_prestador}${d.numero_guia_operadora ? `\n- **Nº guia operadora:** ${d.numero_guia_operadora}` : ''}
- **Data do atendimento:** ${formatDateBR(d.data_atendimento)} às ${d.hora_inicio}${d.hora_fim ? ` (término ${d.hora_fim})` : ''}
- **Tipo de consulta:** ${TIPO_CONSULTA_LABEL[d.tipo_consulta]}
- **Cobertura:** ${COBERTURA_LABEL[d.cobertura]}

## Beneficiário

- **Nome:** ${p.name}
- **CPF:** ${p.cpf ?? '(não informado)'}
- **Data de nascimento:** ${formatDateBR(p.birthdate)}
- **Plano:** ${p.insurance_provider ?? '(não informado)'}${p.insurance_card_number ? `\n- **Carteira:** ${p.insurance_card_number}` : ''}

## Procedimento executado

- **Código TUSS:** ${d.procedimento_tuss}
- **Descrição:** ${d.procedimento_descricao}${d.cid10_principal ? `\n- **CID-10 principal:** ${d.cid10_principal}` : ''}

${d.observacoes ? `## Observações\n\n${d.observacoes}\n` : ''}
## Prestador executante

- **Profissional:** Dr(a). ${ctx.professional.name}
- **Registro:** ${formatCouncil(ctx.professional)}
- **Especialidade:** ${ctx.professional.specialty}

${placeOfIssue(ctx)}

---

**Assinatura do beneficiário:**

_____________________________________
(Assinatura confirma o recebimento do atendimento descrito acima.)

---

${professionalSignatureBlock(ctx)}
`.trim();
}

function renderSadt(ctx: TemplateContext, d: TissSadtForm): string {
  const p = ctx.patient;
  const procRows = d.procedimentos_executados.map((proc, i) =>
    `${i + 1}. ${proc.tuss_code} — ${proc.descricao} (qtd ${proc.quantidade}${proc.via_acesso ? `, via ${proc.via_acesso}` : ''}${proc.tecnica ? `, técnica ${proc.tecnica}` : ''})`
  ).join('\n');

  return `
${clinicHeaderBlock(ctx)}

# GUIA DE SERVIÇO PROFISSIONAL / SADT — PADRÃO TISS 4.01.00

(Resolução Normativa ANS nº 305/2012 e atualizações)

## Identificação

- **Nº guia prestador:** ${d.numero_guia_prestador}${d.numero_guia_operadora ? `\n- **Nº guia operadora:** ${d.numero_guia_operadora}` : ''}${d.numero_guia_principal ? `\n- **Guia principal associada:** ${d.numero_guia_principal}` : ''}
- **Data do atendimento:** ${formatDateBR(d.data_atendimento)} às ${d.hora_inicio}${d.hora_fim ? ` (término ${d.hora_fim})` : ''}
- **Tipo de atendimento:** ${TIPO_ATENDIMENTO_LABEL[d.tipo_atendimento]}

## Beneficiário

- **Nome:** ${p.name}
- **CPF:** ${p.cpf ?? '(não informado)'}
- **Data de nascimento:** ${formatDateBR(p.birthdate)}
- **Plano:** ${p.insurance_provider ?? '(não informado)'}${p.insurance_card_number ? `\n- **Carteira:** ${p.insurance_card_number}` : ''}

## Indicação clínica

${d.indicacao_clinica}${d.cid10_principal ? `\n\n**CID-10 principal:** ${d.cid10_principal}` : ''}

## Procedimentos executados

${procRows}

${d.observacoes ? `## Observações\n\n${d.observacoes}\n` : ''}
## Prestador executante

- **Profissional:** Dr(a). ${ctx.professional.name}
- **Registro:** ${formatCouncil(ctx.professional)}
- **Especialidade:** ${ctx.professional.specialty}

${placeOfIssue(ctx)}

---

**Assinatura do beneficiário:**

_____________________________________

---

${professionalSignatureBlock(ctx)}
`.trim();
}

export const TISS_GUIA_TEMPLATE = {
  doc_type: 'tiss_guia' as const,
  display_name: 'Guia TISS (Consulta / SP-SADT)',
  defaults: TISS_CONSULTA_DEFAULTS, // default: consulta. UI permite trocar pra sp_sadt.
  defaults_sadt: TISS_SADT_DEFAULTS,
  render: renderTissGuia,
  required_fields: ['numero_guia_prestador', 'data_atendimento', 'procedimento_tuss'] as const,
};
