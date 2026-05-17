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
  type FormField,
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

const LME_FORM_FIELDS: FormField[] = [
  {
    type: 'cid-search',
    name: 'cid10',
    label: 'CID-10 do agravo',
    required: true,
    descriptionField: 'cid10_description',
  },
  { type: 'textarea', name: 'anamnesis', label: 'Anamnese (campo 2)', rows: 4, required: true },
  { type: 'textarea', name: 'exam_findings', label: 'Exame físico (campo 3)', rows: 3, required: true },
  { type: 'textarea', name: 'diagnostic_exams', label: 'Exames complementares (campo 4)', rows: 3 },
  { type: 'textarea', name: 'previous_treatments', label: 'Tratamentos prévios e resposta (campo 5)', rows: 4, required: true, hint: 'PCDT exige documentar uso anterior de DMARDs/medicações de 1ª linha.' },
  {
    type: 'group',
    label: 'Antropometria',
    fields: [
      { type: 'number', name: 'weight_kg', label: 'Peso (kg)', min: 1, max: 300, step: 0.1 },
      { type: 'number', name: 'height_cm', label: 'Altura (cm)', min: 30, max: 250, step: 1 },
      {
        type: 'derived',
        name: 'imc_computed',
        label: 'IMC calculado',
        tone: 'info',
        compute: (form) => {
          const w = Number(form.weight_kg ?? 0);
          const h = Number(form.height_cm ?? 0);
          if (!w || !h) return null;
          const imc = w / Math.pow(h / 100, 2);
          let classification = '';
          if (imc < 18.5) classification = 'baixo peso';
          else if (imc < 25) classification = 'eutrófico';
          else if (imc < 30) classification = 'sobrepeso';
          else if (imc < 35) classification = 'obesidade grau I';
          else if (imc < 40) classification = 'obesidade grau II';
          else classification = 'obesidade grau III';
          return `IMC ${imc.toFixed(1)} kg/m² — ${classification}`;
        },
      },
    ],
  },
  {
    type: 'derived',
    name: 'lme_validity_computed',
    label: 'Validade do laudo',
    tone: 'info',
    compute: () => {
      const d = new Date();
      d.setDate(d.getDate() + 90);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `Laudo LME válido por 90 dias (até ${dd}/${mm}/${d.getFullYear()}) conforme Port. GM/MS 1.554/2013.`;
    },
  },
  {
    type: 'array',
    name: 'medications',
    label: 'Medicamentos solicitados (campos 8–10)',
    itemLabel: 'Medicamento',
    minItems: 1,
    maxItems: 5,
    itemDefault: { generic_name: '', dosage: '', posology: '', quantity_monthly: '', treatment_duration_months: 6 },
    itemFields: [
      { type: 'text', name: 'generic_name', label: 'Nome genérico', required: true, placeholder: 'Ex.: Adalimumabe' },
      { type: 'text', name: 'dosage', label: 'Apresentação', placeholder: 'Ex.: 40 mg/0,4 mL (seringa preenchida)' },
      { type: 'text', name: 'posology', label: 'Posologia', placeholder: 'Ex.: 40 mg SC a cada 14 dias' },
      { type: 'text', name: 'quantity_monthly', label: 'Quantidade mensal', placeholder: 'Ex.: 2 seringas/mês' },
      { type: 'number', name: 'treatment_duration_months', label: 'Duração (meses)', min: 1, max: 60, step: 1 },
    ],
  },
  { type: 'checkbox', name: 'is_continuous_use', label: 'Uso contínuo (campo 11)' },
  { type: 'checkbox', name: 'pcdt_compliance_declared', label: 'Em conformidade com o PCDT vigente (campo 12)' },
  {
    type: 'radio',
    name: 'pregnancy_status',
    label: 'Condição gestacional (campo 13)',
    orientation: 'horizontal',
    options: [
      { value: 'na', label: 'Não se aplica' },
      { value: 'pregnant', label: 'Gestante' },
      { value: 'breastfeeding', label: 'Lactante' },
      { value: 'not_pregnant', label: 'Não gestante (idade fértil)' },
    ],
  },
  { type: 'number', name: 'hospitalizations_last_12mo', label: 'Internações nos últimos 12 meses (campo 14)', min: 0, max: 50, step: 1 },
  { type: 'textarea', name: 'expected_outcome', label: 'Desfecho clínico esperado (campo 15)', rows: 3, placeholder: 'Ex.: Redução de DAS28 para faixa de remissão em 6 meses.' },
  { type: 'textarea', name: 'clinical_justification', label: 'Justificativa clínica (campo 16)', rows: 4, required: true, hint: 'Explique por que o paciente atende critérios de inclusão do PCDT.' },
  { type: 'text', name: 'cnes_unit', label: 'CNES da unidade prescritora (campo 17, opcional)' },
];

export const LME_ALTO_CUSTO_TEMPLATE = {
  doc_type: 'lme_alto_custo' as const,
  display_name: 'LME — Componente Especializado (Alto Custo)',
  defaults: LME_DEFAULTS,
  render: renderLmeAltoCusto,
  required_fields: [
    'cid10', 'anamnesis', 'exam_findings', 'previous_treatments',
    'medications', 'clinical_justification',
  ] as const,
  form_fields: LME_FORM_FIELDS,
};
