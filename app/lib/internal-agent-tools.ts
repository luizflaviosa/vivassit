/**
 * Catálogo de tools do agente interno do /painel.
 *
 * Cada tool tem:
 *   - description: pra prompt do agente (curto, ação)
 *   - params: schema simples pra validação (sem zod pra manter edge-friendly)
 *   - mode: 'read' (executa direto) | 'write' (propose+confirm)
 *   - min_role: viewer | staff | doctor | admin | owner (RBAC progressivo)
 *
 * O agente N8N consome este catálogo via /api/interno/tools/manifest.
 * A execução vai por /api/interno/tools (dispatch).
 */

export type AgentRole = 'owner' | 'admin' | 'doctor' | 'staff' | 'viewer';
export type ToolMode = 'read' | 'write';

const ROLE_RANK: Record<AgentRole, number> = {
  viewer: 0,
  staff: 1,
  doctor: 2,
  admin: 3,
  owner: 4,
};

export function roleHasAccess(userRole: AgentRole, minRole: AgentRole): boolean {
  return ROLE_RANK[userRole] >= ROLE_RANK[minRole];
}

export interface ParamSpec {
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum';
  required?: boolean;
  default?: unknown;
  enum?: string[];
  description: string;
}

export interface ToolDef {
  name: string;
  description: string;
  mode: ToolMode;
  min_role: AgentRole;
  params: Record<string, ParamSpec>;
}

// ─────────────────────────────────────────────────────────────────────
// Catálogo Sprint 1 — 9 reads, 6 writes
// (writes ficam declarados aqui mas só implementados em Sprint 2)
// ─────────────────────────────────────────────────────────────────────

export const TOOL_CATALOG: ToolDef[] = [
  // ── READ — Agenda ──
  {
    name: 'agenda_hoje',
    description: 'Retorna as consultas de hoje (com nome do paciente, horário e status).',
    mode: 'read',
    min_role: 'viewer',
    params: {
      doctor_id: { type: 'string', description: 'UUID do médico (admin/owner pode filtrar; doctor é sempre filtrado pelo próprio automaticamente)' },
    },
  },
  {
    name: 'agenda_periodo',
    description: 'Lista consultas em um intervalo. Use pra "esta semana", "próximas 2 semanas", "mês que vem", etc.',
    mode: 'read',
    min_role: 'viewer',
    params: {
      start: { type: 'date', required: true, description: 'Data inicial ISO (ex: 2026-05-04)' },
      end:   { type: 'date', required: true, description: 'Data final ISO (inclusiva)' },
      status: { type: 'enum', enum: ['booked', 'confirmed', 'completed', 'cancelled', 'all'], default: 'all', description: 'Filtro de status (booked=marcada, confirmed=reconfirmada, completed=ocorreu, cancelled=cancelada)' },
      doctor_id: { type: 'string', description: 'UUID do médico (admin/owner pode filtrar; doctor é sempre filtrado pelo próprio automaticamente)' },
    },
  },
  {
    name: 'horarios_livres',
    description: 'Lista slots livres (default 30min) num intervalo, intersectando working_hours menos consultas e bloqueios. Use pra "tem vaga", "horários livres", "quando posso encaixar".',
    mode: 'read',
    min_role: 'viewer',
    params: {
      start: { type: 'date', required: true, description: 'Data inicial ISO YYYY-MM-DD' },
      end:   { type: 'date', required: true, description: 'Data final ISO YYYY-MM-DD (inclusiva, máx 28 dias após start)' },
      slot_minutes: { type: 'number', default: 30, description: 'Granularidade dos slots em minutos (default 30)' },
      doctor_id: { type: 'string', description: 'UUID do médico (admin/owner pode filtrar; doctor é sempre filtrado pelo próprio)' },
    },
  },
  {
    name: 'medicos_listar',
    description: 'Lista médicos ativos do tenant. Doctor vê apenas o próprio; admin/owner/staff vê todos. Use antes de filtrar agenda/documentos por nome de médico pra resolver doctor_id.',
    mode: 'read',
    min_role: 'viewer',
    params: {},
  },

  // ── READ — Métricas ──
  {
    name: 'pacientes_count',
    description: 'Quantos pacientes únicos atendi (ou tenho cadastrados). Aceita período.',
    mode: 'read',
    min_role: 'viewer',
    params: {
      since: { type: 'date', description: 'Conta apenas pacientes vistos desde esta data (opcional)' },
    },
  },
  {
    name: 'pacientes_proximos',
    description: 'Quantos pacientes vou atender nas próximas X semanas. Devolve total + breakdown por semana.',
    mode: 'read',
    min_role: 'viewer',
    params: {
      weeks_ahead: { type: 'number', default: 2, description: 'Número de semanas à frente (1-12)' },
      doctor_id: { type: 'string', description: 'UUID do médico (admin/owner pode filtrar; doctor é sempre filtrado pelo próprio automaticamente)' },
    },
  },

  // ── READ — Financeiro ──
  {
    name: 'pagamentos_status',
    description: 'Resumo financeiro do período: total recebido, pendente, vencido, breakdown por método.',
    mode: 'read',
    min_role: 'staff',
    params: {
      start: { type: 'date', description: 'Início do período (default: começo do mês)' },
      end:   { type: 'date', description: 'Fim do período (default: hoje)' },
    },
  },
  {
    name: 'pagamentos_pendentes',
    description: 'Lista nominal de pacientes com cobrança pendente ou vencida. Mostra valor + dias em aberto.',
    mode: 'read',
    min_role: 'staff',
    params: {
      include_overdue_only: { type: 'boolean', default: false, description: 'Se true, só retorna vencidos (>3 dias)' },
    },
  },
  {
    name: 'cobrancas_paciente',
    description: 'Extrato financeiro de UM paciente. Identifica via patient_id, patient_name (busca fuzzy) ou patient_phone (E.164). Retorna pagas/pendentes/vencidas com totais. Use pra "cobranças da Maria", "quanto X me deve", "status financeiro do paciente Y". Se nome ambiguo devolve lista pra desambiguar; se 0 matches retorna erro semantico.',
    mode: 'read',
    min_role: 'doctor',
    params: {
      patient_id:    { type: 'string', description: 'ID do paciente (preferencial se já souber)' },
      patient_name:  { type: 'string', description: 'Nome do paciente (busca ilike, fuzzy)' },
      patient_phone: { type: 'string', description: 'Telefone E.164 (+5511999999999) — match canonico em tenant_payments' },
      since:         { type: 'date',   description: 'Data inicial (default: 90 dias atras)' },
      status:        { type: 'enum', enum: ['paid','pending','overdue','all'], default: 'all', description: 'Filtra por classificação' },
    },
  },

  // ── READ — Reputação ──
  {
    name: 'nps_resumo',
    description: 'NPS interno: score médio, total de respostas, top 3 quotes positivos e negativos.',
    mode: 'read',
    min_role: 'doctor',
    params: {
      since: { type: 'date', description: 'Considera respostas desde esta data (default: 90 dias)' },
    },
  },
  {
    name: 'reviews_externos',
    description: 'O que pacientes falam fora: Google Business + Doctoralia. Rating, contagem, presença.',
    mode: 'read',
    min_role: 'doctor',
    params: {},
  },

  // ── READ — Documentos ──
  {
    name: 'documentos_listar',
    description: 'Lista documentos da clínica. Filtros: status (rascunho/assinado), paciente, médico.',
    mode: 'read',
    min_role: 'staff',
    params: {
      paciente_id: { type: 'string', description: 'UUID do paciente (opcional)' },
      status: { type: 'enum', enum: ['draft', 'sent', 'signed', 'all'], default: 'all', description: 'Filtro de status' },
      limit: { type: 'number', default: 10, description: 'Quantidade max (1-50)' },
      doctor_id: { type: 'string', description: 'UUID do médico (admin/owner pode filtrar; doctor é sempre filtrado pelo próprio automaticamente)' },
    },
  },

  // ── WRITE — declarados; handlers em Sprint 2 ──
  {
    name: 'consulta_reagendar',
    description: 'Propõe reagendar uma consulta. Retorna ActionCard pra confirmação.',
    mode: 'write',
    min_role: 'staff',
    params: {
      appointment_id: { type: 'string', required: true, description: 'UUID do appointment' },
      new_date: { type: 'date', required: true, description: 'Nova data ISO (com hora)' },
    },
  },
  {
    name: 'consulta_marcar',
    description: 'Marca nova consulta. Em propose, valida slot livre e devolve preview. Se nome ambíguo (>1 paciente match) devolve lista pra desambiguação. Se 0 matches, peça pra criar paciente antes via paciente_criar.',
    mode: 'write',
    min_role: 'doctor',
    params: {
      patient_id:       { type: 'string', description: 'UUID do paciente (preferível se já souber)' },
      patient_name:     { type: 'string', description: 'Nome do paciente (busca por nome+phone se patient_id ausente)' },
      patient_phone:    { type: 'string', description: 'Telefone E.164 (ex: +5511999999999) — opcional, ajuda desambiguar' },
      slot_start:       { type: 'string', required: true, description: 'ISO YYYY-MM-DDTHH:mm (sem timezone, assume -03:00)' },
      duration_minutes: { type: 'number', default: 60, description: 'Duração em minutos (default 60)' },
      doctor_id:        { type: 'string', description: 'UUID do médico (admin/owner; doctor é o próprio)' },
      notes:            { type: 'string', description: 'Observações livres' },
    },
  },
  {
    name: 'consulta_cancelar',
    description: 'Propõe cancelar uma consulta. Sempre exige confirmação.',
    mode: 'write',
    min_role: 'staff',
    params: {
      appointment_id: { type: 'string', required: true, description: 'UUID do appointment' },
      reason: { type: 'string', description: 'Motivo (opcional, vai em description)' },
    },
  },
  {
    name: 'paciente_criar',
    description: 'Propõe criar paciente novo. Retorna preview pra confirmação.',
    mode: 'write',
    min_role: 'staff',
    params: {
      name: { type: 'string', required: true, description: 'Nome completo' },
      phone: { type: 'string', required: true, description: 'Telefone E.164 (+55...)' },
      birthdate: { type: 'date', description: 'Data nascimento (opcional)' },
      email: { type: 'string', description: 'Email (opcional)' },
    },
  },
  {
    name: 'cobranca_avulsa',
    description: 'Gera cobrança Asaas pro paciente e prepara link de pagamento.',
    mode: 'write',
    min_role: 'admin',
    params: {
      paciente_id: { type: 'string', required: true, description: 'UUID do paciente (users.id)' },
      valor: { type: 'number', required: true, description: 'Valor em reais (ex: 280.00)' },
      descricao: { type: 'string', required: true, description: 'Descrição da cobrança' },
      metodo: { type: 'enum', enum: ['pix', 'cartao', 'boleto'], default: 'pix', description: 'Método preferencial' },
    },
  },
  {
    name: 'documento_gerar',
    description: 'Gera documento a partir de template + dados do paciente.',
    mode: 'write',
    min_role: 'doctor',
    params: {
      template_id: { type: 'string', required: true, description: 'UUID do template' },
      paciente_id: { type: 'string', required: true, description: 'UUID do paciente' },
    },
  },
  {
    name: 'documento_assinar',
    description: 'Envia documento já gerado pra assinatura via BirdID.',
    mode: 'write',
    min_role: 'doctor',
    params: {
      documento_id: { type: 'string', required: true, description: 'UUID do documento' },
    },
  },
  {
    name: 'bloquear_horario',
    description: 'Bloqueia uma janela na agenda do médico (almoço, ausência, dentista). Em propose mostra preview e lista bookings que caem dentro (apenas aviso, não recusa).',
    mode: 'write',
    min_role: 'doctor',
    params: {
      start: { type: 'string', required: true, description: 'ISO YYYY-MM-DDTHH:mm (assume -03:00 se sem TZ)' },
      end:   { type: 'string', required: true, description: 'ISO YYYY-MM-DDTHH:mm' },
      reason: { type: 'string', description: 'Motivo livre (ex: "almoço", "consulta médica")' },
      doctor_id: { type: 'string', description: 'UUID do médico (admin/owner; doctor é o próprio)' },
    },
  },
  {
    name: 'working_hours_atualizar',
    description: 'Atualiza working_hours[dia] do médico (mudança PERMANENTE da rotina semanal). Para ausência pontual use bloquear_horario. Aviso ao usuário: muda o que o agente WhatsApp informa aos pacientes.',
    mode: 'write',
    min_role: 'doctor',
    params: {
      day:    { type: 'enum', required: true, enum: ['seg','ter','qua','qui','sex','sab','dom'], description: 'Dia da semana' },
      hours:  { type: 'string', required: true, description: '"HH:MM-HH:MM" ou "fechado"' },
      doctor_id: { type: 'string', description: 'UUID (admin/owner; doctor é o próprio)' },
    },
  },
];

export function getToolDef(name: string): ToolDef | null {
  return TOOL_CATALOG.find((t) => t.name === name) ?? null;
}

// Aliases PT → schema EN. Defensivo contra LLM que traduz nomes de param
// (ex: Gemini chamou agenda_periodo com data_inicio/data_fim em vez de start/end).
// O fix de 1ª linha é o system prompt do N8N; este mapa é segurança em profundidade.
const PARAM_ALIASES: Record<string, Record<string, string>> = {
  agenda_periodo:    { data_inicio: 'start', data_fim: 'end', inicio: 'start', fim: 'end' },
  pagamentos_status: { data_inicio: 'start', data_fim: 'end', inicio: 'start', fim: 'end' },
  pacientes_count:   { desde: 'since' },
  nps_resumo:        { desde: 'since' },
  pacientes_proximos:{ semanas: 'weeks_ahead', proximas_semanas: 'weeks_ahead' },
  pagamentos_pendentes: { apenas_vencidos: 'include_overdue_only', somente_vencidos: 'include_overdue_only' },
  cobrancas_paciente:{ paciente_id: 'patient_id', paciente: 'patient_name', nome: 'patient_name', telefone: 'patient_phone', desde: 'since' },
  consulta_reagendar:{ nova_data: 'new_date', data_nova: 'new_date' },
  consulta_marcar:   { paciente_id: 'patient_id', paciente: 'patient_name', nome: 'patient_name', telefone: 'patient_phone', inicio: 'slot_start', duracao: 'duration_minutes', notas: 'notes' },
  consulta_cancelar: { motivo: 'reason' },
  paciente_criar:    { nome: 'name', telefone: 'phone', data_nascimento: 'birthdate', nascimento: 'birthdate' },
  cobranca_avulsa:   { valor_reais: 'valor', metodo_pagamento: 'metodo' },
  bloquear_horario:  { inicio: 'start', fim: 'end', motivo: 'reason' },
  working_hours_atualizar: { dia: 'day', horario: 'hours', horarios: 'hours' },
};

export function normalizeParams(
  toolName: string,
  input: Record<string, unknown>
): Record<string, unknown> {
  const aliases = PARAM_ALIASES[toolName];
  if (!aliases) return input;
  const out: Record<string, unknown> = { ...input };
  for (const [alias, canonical] of Object.entries(aliases)) {
    if (alias in out && !(canonical in out)) {
      out[canonical] = out[alias];
      delete out[alias];
    }
  }
  return out;
}

/**
 * Validação leve de params contra schema. Retorna null se ok, ou mensagem de erro.
 */
export function validateParams(tool: ToolDef, input: Record<string, unknown>): string | null {
  for (const [key, spec] of Object.entries(tool.params)) {
    const v = input[key];
    if (spec.required && (v === undefined || v === null || v === '')) {
      return `Param obrigatório ausente: ${key}`;
    }
    if (v !== undefined && v !== null) {
      if (spec.type === 'number' && typeof v !== 'number') {
        return `Param ${key} deve ser número`;
      }
      if (spec.type === 'boolean' && typeof v !== 'boolean') {
        return `Param ${key} deve ser boolean`;
      }
      if (spec.type === 'enum' && !spec.enum?.includes(String(v))) {
        return `Param ${key} deve ser um de: ${spec.enum?.join(', ')}`;
      }
    }
  }
  return null;
}
