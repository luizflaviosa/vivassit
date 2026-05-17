// LME — Laudo Médico Especializado para Componente Especializado da Assistência
// Farmacêutica (CEAF / Alto Custo).
//
// Base legal:
//   - Portaria GM/MS nº 1.554/2013 (Anexo V — instruções de preenchimento)
//   - Portaria de Consolidação nº 2/2017 — Anexo XXVIII (CEAF)
//   - PCDT vigente do agravo solicitado (Protocolo Clínico e Diretrizes Terapêuticas)
//
// Estrutura federal: 23 campos. Campos 1-17 são EXCLUSIVOS do médico, campos
// 18-23 são preenchidos pelo paciente (ou responsável). Validade do laudo: 90 dias
// a partir da data de preenchimento. O Singulare preenche os campos 1-17 e gera
// PDF pronto pra paciente assinar 18-23 no balcão do SUS.

import {
  TemplateContext,
  formatDateBR,
  professionalSignatureBlock,
  placeOfIssue,
  clinicHeaderBlock,
} from './_shared';

export interface LmeAltoCustoForm {
  // Campos 1-17 (médico)
  cid10: string;                           // 1. CID-10 principal
  cid10_description: string;               // descrição do CID
  anamnesis: string;                       // 2. Anamnese
  exam_findings: string;                   // 3. Exame físico
  diagnostic_exams: string;                // 4. Exames complementares (lab/imagem)
  previous_treatments: string;             // 5. Tratamentos prévios e resposta
  weight_kg: number | null;                // 6. Peso (kg)
  height_cm: number | null;                // 7. Altura (cm)
  medications: Array<{                     // 8-10. Medicamento(s) solicitado(s)
    generic_name: string;                  // nome genérico (obrigatório)
    dosage: string;                        // ex: "200 mg"
    posology: string;                      // ex: "1 comp 2x/dia"
    quantity_monthly: string;              // ex: "60 comprimidos/mês"
    treatment_duration_months: number;     // duração prevista (meses)
  }>;
  is_continuous_use: boolean;              // 11. Uso contínuo?
  pcdt_compliance_declared: boolean;       // 12. Declara seguir o PCDT vigente
  pregnancy_status?: 'na' | 'pregnant' | 'breastfeeding' | 'not_pregnant'; // 13. Condição gestacional (se aplicável)
  hospitalizations_last_12mo?: number;     // 14. Internações nos últimos 12 meses
  expected_outcome: string;                // 15. Desfecho clínico esperado
  clinical_justification: string;          // 16. Justificativa clínica (livre)
  cnes_unit?: string;                      // 17. CNES da unidade prescritora (opcional)
}

export const LME_DEFAULTS: LmeAltoCustoForm = {
  cid10: '',
  cid10_description: '',
  anamnesis: '',
  exam_findings: '',
  diagnostic_exams: '',
  previous_treatments: '',
  weight_kg: null,
  height_cm: null,
  medications: [
    {
      generic_name: '',
      dosage: '',
      posology: '',
      quantity_monthly: '',
      treatment_duration_months: 6,
    },
  ],
  is_continuous_use: true,
  pcdt_compliance_declared: true,
  pregnancy_status: 'na',
  hospitalizations_last_12mo: 0,
  expected_outcome: '',
  clinical_justification: '',
  cnes_unit: undefined,
};

export function renderLmeAltoCusto(
  ctx: TemplateContext,
  data: LmeAltoCustoForm,
): string {
  const p = ctx.patient;
  const validityDate = (() => {
    const d = new Date(ctx.issue_date);
    d.setUTCDate(d.getUTCDate() + 90);
    return formatDateBR(d.toISOString());
  })();

  const medsBlock = data.medications.map((m, i) =>
    `**Medicamento ${i + 1}**\n` +
    `- Nome genérico: ${m.generic_name}\n` +
    `- Apresentação: ${m.dosage}\n` +
    `- Posologia: ${m.posology}\n` +
    `- Quantidade mensal: ${m.quantity_monthly}\n` +
    `- Duração prevista do tratamento: ${m.treatment_duration_months} meses`
  ).join('\n\n');

  const imc = data.weight_kg && data.height_cm
    ? (data.weight_kg / ((data.height_cm / 100) ** 2)).toFixed(1)
    : null;

  return `
${clinicHeaderBlock(ctx)}

# LAUDO PARA SOLICITAÇÃO, AVALIAÇÃO E AUTORIZAÇÃO DE MEDICAMENTOS DO COMPONENTE ESPECIALIZADO DA ASSISTÊNCIA FARMACÊUTICA (LME)

Conforme Portaria GM/MS nº 1.554/2013 — Anexo V. Validade do laudo: 90 dias (até **${validityDate}**).

---

## DADOS DO PACIENTE

- **Nome:** ${p.name}
- **CPF:** ${p.cpf ?? '(não informado)'}
- **CNS:** ${p.cns ?? '(não informado)'}
- **Data de nascimento:** ${formatDateBR(p.birthdate)}
${p.address ? `- **Endereço:** ${p.address}` : ''}

## CAMPOS DE PREENCHIMENTO MÉDICO (1–17)

**1. CID-10:** ${data.cid10} — ${data.cid10_description}

**2. Anamnese:**
${data.anamnesis}

**3. Exame físico:**
${data.exam_findings}

**4. Exames complementares:**
${data.diagnostic_exams}

**5. Tratamentos prévios e resposta:**
${data.previous_treatments}

**6/7. Antropometria:** ${data.weight_kg ? `${data.weight_kg} kg` : '(não aferido)'} · ${data.height_cm ? `${data.height_cm} cm` : '(não aferido)'}${imc ? ` · IMC ${imc} kg/m²` : ''}

**8–10. Medicamento(s) solicitado(s):**

${medsBlock}

**11. Uso contínuo:** ${data.is_continuous_use ? 'Sim' : 'Não'}

**12. Adesão ao PCDT vigente:** ${data.pcdt_compliance_declared ? 'Declaro estar em conformidade com o Protocolo Clínico e Diretrizes Terapêuticas vigente para o agravo.' : 'Não se aplica ou paciente fora do PCDT — ver justificativa no campo 16.'}

**13. Condição gestacional:** ${pregnancyLabel(data.pregnancy_status)}

**14. Internações nos últimos 12 meses:** ${data.hospitalizations_last_12mo ?? 0}

**15. Desfecho clínico esperado:**
${data.expected_outcome}

**16. Justificativa clínica:**
${data.clinical_justification}

${data.cnes_unit ? `**17. CNES da unidade prescritora:** ${data.cnes_unit}\n` : ''}
---

## CAMPOS DE PREENCHIMENTO DO PACIENTE (18–23)

Os campos abaixo devem ser preenchidos pelo paciente ou responsável legal no momento da entrega do laudo na unidade dispensadora:

- **18.** Documento de identidade apresentado: _______________________
- **19.** Endereço atualizado: _______________________
- **20.** Telefone: _______________________
- **21.** Concordância com o tratamento: ( ) Sim ( ) Não
- **22.** Termo de Consentimento Informado: ( ) Recebido ( ) Lido ( ) Assinado
- **23.** Data e assinatura do paciente/responsável: ___ /___ /______  Assinatura: ___________________________

---

${placeOfIssue(ctx)}

${professionalSignatureBlock(ctx)}
`.trim();
}

function pregnancyLabel(s: LmeAltoCustoForm['pregnancy_status']): string {
  switch (s) {
    case 'pregnant': return 'Gestante';
    case 'breastfeeding': return 'Lactante';
    case 'not_pregnant': return 'Não gestante (mulher em idade fértil)';
    default: return 'Não se aplica';
  }
}

export const LME_ALTO_CUSTO_TEMPLATE = {
  doc_type: 'lme_alto_custo' as const,
  display_name: 'LME — Componente Especializado (Alto Custo)',
  defaults: LME_DEFAULTS,
  render: renderLmeAltoCusto,
  required_fields: [
    'cid10', 'anamnesis', 'exam_findings', 'previous_treatments',
    'medications', 'clinical_justification',
  ] as const,
};
