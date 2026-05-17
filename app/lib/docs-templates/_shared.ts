// Compartilhado entre todos os templates de documento médico.
// Centraliza dados do profissional, paciente, clínica e helpers de formatação
// pra evitar drift entre os 5 tipos de doc.
//
// Fonte regulatória — todos os templates seguem:
//   - Resolução CFM 2.381/2024 (atualiza emissão de atestados e declarações médicas)
//   - Resolução CFM 1.658/2002 (atestado médico — fundamentação clínica)
//   - Código de Ética Médica (Resolução CFM 2.217/2018) — Capítulo X

export interface ProfessionalSnapshot {
  name: string;            // Ex: "Paula Franzon"
  council: string;         // CRM/CRO/CREFITO/etc — só a sigla
  council_uf: string;      // SP, RJ, MG...
  council_number: string;  // Só dígitos — formatador concatena
  specialty: string;       // "Reumatologista", "Médica do Esporte"
  rqe?: string | null;     // Registro de Qualificação de Especialista
  email?: string | null;
  phone?: string | null;
  address?: string | null; // Endereço profissional (CFM 2.381/24 exige um deles)
}

export interface PatientSnapshot {
  name: string;
  cpf: string | null;        // formato 000.000.000-00
  birthdate: string | null;  // ISO YYYY-MM-DD
  rg?: string | null;
  cns?: string | null;       // Cartão Nacional de Saúde — opcional
  address?: string | null;
  insurance_provider?: string | null;
  insurance_card_number?: string | null;
}

export interface ClinicSnapshot {
  clinic_name: string;
  cnpj?: string | null;
  address: string;
  phone?: string | null;
  email?: string | null;
  cnes?: string | null;       // Cadastro Nacional de Estabelecimentos de Saúde
}

export interface TemplateContext {
  professional: ProfessionalSnapshot;
  patient: PatientSnapshot;
  clinic: ClinicSnapshot;
  issue_date: string;         // ISO timestamp; renderTemplate formata pra BRT
  city: string;               // ex: "São Paulo"
}

export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function formatDateLong(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ];
  const dia = d.getUTCDate();
  const mes = meses[d.getUTCMonth()];
  const ano = d.getUTCFullYear();
  return `${dia} de ${mes} de ${ano}`;
}

export function calcAge(birthdateIso: string | null | undefined, refIso?: string): number | null {
  if (!birthdateIso) return null;
  const birth = new Date(birthdateIso);
  if (isNaN(birth.getTime())) return null;
  const ref = refIso ? new Date(refIso) : new Date();
  let age = ref.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = ref.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getUTCDate() < birth.getUTCDate())) {
    age--;
  }
  return age;
}

export function formatCouncil(p: ProfessionalSnapshot): string {
  // Padrão CFM: "CRM/SP 123456" + opcionalmente "RQE 12345"
  const base = `${p.council}/${p.council_uf} ${p.council_number}`;
  return p.rqe ? `${base} — RQE ${p.rqe}` : base;
}

export function professionalSignatureBlock(ctx: TemplateContext): string {
  const p = ctx.professional;
  const lines = [
    '_____________________________________',
    `Dr(a). ${p.name}`,
    formatCouncil(p),
  ];
  if (p.specialty) lines.push(p.specialty);
  // CFM 2.381/24 exige contato profissional + endereço
  if (p.phone || p.email) {
    const contact = [p.phone, p.email].filter(Boolean).join(' · ');
    lines.push(contact);
  }
  if (p.address) lines.push(p.address);
  return lines.join('\n');
}

export function clinicHeaderBlock(ctx: TemplateContext): string {
  const c = ctx.clinic;
  const lines = [c.clinic_name];
  if (c.cnpj) lines.push(`CNPJ ${c.cnpj}`);
  if (c.cnes) lines.push(`CNES ${c.cnes}`);
  lines.push(c.address);
  if (c.phone) lines.push(`Tel: ${c.phone}`);
  return lines.join(' · ');
}

export function placeOfIssue(ctx: TemplateContext): string {
  return `${ctx.city}, ${formatDateLong(ctx.issue_date)}`;
}

// ─────────────────────────────────────────────────────────────
// Form field descriptors — usados pelo DynamicDocForm pra
// renderizar o formulario do template sem hardcode no front.
// ─────────────────────────────────────────────────────────────

export type FieldType =
  | 'text'         // <input type=text>
  | 'textarea'     // <textarea>
  | 'date'         // <input type=date>
  | 'time'         // <input type=time>
  | 'number'       // <input type=number>
  | 'select'       // <select> com options
  | 'radio'        // grupo de botoes radio (vertical/horizontal)
  | 'checkbox'     // boolean
  | 'tag-list'     // multi-select via tags (string[])
  | 'cid-search'   // autocomplete CID-10 (preenche code + description)
  | 'tuss-search'  // autocomplete TUSS
  | 'array'        // lista de subforms (medications, procedimentos)
  | 'group'        // agrupa visualmente
  | 'derived';     // valor calculado read-only inline (validade, IMC, etc)

export interface BaseField {
  type: FieldType;
  name: string;             // nome da chave no form_data
  label: string;            // label visivel
  hint?: string;            // texto auxiliar embaixo
  required?: boolean;
  show?: (form: Record<string, unknown>) => boolean; // condicional
  placeholder?: string;
}

export interface TextField extends BaseField {
  type: 'text';
}
export interface TextareaField extends BaseField {
  type: 'textarea';
  rows?: number;
}
export interface DateField extends BaseField {
  type: 'date';
}
export interface TimeField extends BaseField {
  type: 'time';
}
export interface NumberField extends BaseField {
  type: 'number';
  min?: number;
  max?: number;
  step?: number;
}
export interface SelectField extends BaseField {
  type: 'select';
  options: ReadonlyArray<{ value: string; label: string }>;
}
export interface RadioField extends BaseField {
  type: 'radio';
  options: ReadonlyArray<{ value: string; label: string }>;
  orientation?: 'horizontal' | 'vertical';
}
export interface CheckboxField extends BaseField {
  type: 'checkbox';
}
export interface TagListField extends BaseField {
  type: 'tag-list';
  options: ReadonlyArray<string>; // sugestoes pre-definidas
  allowCustom?: boolean;
}
export interface CidSearchField extends BaseField {
  type: 'cid-search';
  descriptionField: string;   // nome do campo onde guarda a description (auto-preench)
}
export interface TussSearchField extends BaseField {
  type: 'tuss-search';
  descriptionField: string;
}
export interface ArrayField extends BaseField {
  type: 'array';
  itemLabel: string;          // ex: "Medicamento"
  itemDefault: Record<string, unknown>;
  itemFields: FormField[];
  minItems?: number;
  maxItems?: number;
}
export interface GroupField {
  type: 'group';
  label: string;
  fields: FormField[];
  show?: (form: Record<string, unknown>) => boolean;
}

// DerivedField: campo read-only que mostra ao profissional o valor calculado
// de outros campos do form (ex: validade aptidao = issue + 12m; IMC = peso/altura;
// data fim INSS = start + dias - 1). Nao persiste — apenas feedback visual.
// Para clinicas perceberem cedo um valor errado (ex: dias_off > 90 sai do Atestmed).
export interface DerivedField {
  type: 'derived';
  name: string;             // chave logica (nao salva no form_data)
  label: string;
  compute: (form: Record<string, unknown>) => string | null;
  tone?: 'neutral' | 'info' | 'warning' | 'success'; // cor do badge
  show?: (form: Record<string, unknown>) => boolean;
  hint?: string;
}

export type FormField =
  | TextField
  | TextareaField
  | DateField
  | TimeField
  | NumberField
  | SelectField
  | RadioField
  | CheckboxField
  | TagListField
  | CidSearchField
  | TussSearchField
  | ArrayField
  | GroupField
  | DerivedField;

