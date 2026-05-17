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
