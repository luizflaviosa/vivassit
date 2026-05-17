/**
 * Tipos e helpers compartilhados entre os handlers do agente interno.
 */
import { supabaseAdmin } from '../supabase';
import type { AgentRole } from '../internal-agent-tools';

export interface ToolContext {
  tenant_id: string;
  user_id: string;
  role: AgentRole;
}

export interface ToolResult {
  ok: boolean;
  summary: string;
  data?: unknown;
  error?: string;
}

export type Handler = (params: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;

export interface ProposalCard {
  summary: string;
  detail?: string;
  confirm_label?: string;
  cancel_label?: string;
  confirmation_phrase?: string;
  action: { tool: string; params: Record<string, unknown> };
}

export interface WriteHandler {
  propose: (params: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult & { card?: ProposalCard }>;
  execute: (params: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;
}

export function fmtBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export async function getDoctorIds(tenantId: string): Promise<string[]> {
  const admin = supabaseAdmin();
  const { data } = await admin
    .from('tenant_doctors')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('status', 'active');
  return (data ?? []).map((d) => d.id);
}

export async function getDoctorCalendarId(tenantId: string, doctorId: string): Promise<string | null> {
  const admin = supabaseAdmin();
  const { data } = await admin
    .from('tenant_doctors')
    .select('calendar_id')
    .eq('tenant_id', tenantId)
    .eq('id', doctorId)
    .maybeSingle<{ calendar_id: string | null }>();
  return data?.calendar_id ?? null;
}

/**
 * Resolve o escopo de visão por médico segundo o role do usuário.
 *   - role=doctor   → INDIVIDUAL: queries filtradas pelo doctor_id de tenant_members.
 *                     Param doctor_id do request é IGNORADO.
 *   - role=admin/owner/staff → COLETIVO: aceita doctor_id opcional; sem ele = todos.
 *   - role=viewer   → coletivo (read-only).
 *
 * doctor sem doctor_id em tenant_members → scope individual + doctor_id null,
 * handler decide se retorna vazio ou erro semântico.
 */
export async function resolveDoctorScope(
  ctx: ToolContext,
  requestedDoctorId?: string | null,
): Promise<{ scope: 'individual' | 'collective'; doctor_id: string | null }> {
  if (ctx.role === 'doctor') {
    const admin = supabaseAdmin();
    const { data } = await admin
      .from('tenant_members')
      .select('doctor_id')
      .eq('tenant_id', ctx.tenant_id)
      .eq('user_id', ctx.user_id)
      .eq('status', 'active')
      .maybeSingle<{ doctor_id: string | null }>();
    return { scope: 'individual', doctor_id: data?.doctor_id ?? null };
  }
  return { scope: 'collective', doctor_id: requestedDoctorId ?? null };
}
