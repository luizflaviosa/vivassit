// Landing do modulo Seguimento — lista patient_protocols do tenant ativo.
// Acesso gated pela feature flag tenants.addon_rpm = true (Server Component
// retorna redirect pra /painel se feature disabled).

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { Activity, ChevronRight, FileText, UserPlus } from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import { ACTIVE_TENANT_COOKIE } from '@/lib/auth-tenant';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface PatientLite {
  id: number;
  name: string | null;
}
interface ProtocolLite {
  slug: string;
  name: string;
  specialty: string;
}
interface PatientProtocolRow {
  id: number;
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  started_at: string;
  next_consultation_at: string | null;
  last_dispatched_at: string | null;
  notes: string | null;
  protocol: ProtocolLite | ProtocolLite[] | null;
  patient: PatientLite | PatientLite[] | null;
}

export default async function SeguimentoIndexPage() {
  const supa = createSupabaseServerClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) redirect('/login?next=/painel/seguimento');

  const tenantId = cookies().get(ACTIVE_TENANT_COOKIE)?.value;
  if (!tenantId) redirect('/painel');

  const admin = supabaseAdmin();

  // Autoriza se: tenant_member ativo OU admin_user_id OU admin_email do tenant
  // (mesma logica de resolucao do /api/painel/me).
  const [{ data: member }, { data: tenantRow }] = await Promise.all([
    admin
      .from('tenant_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .maybeSingle(),
    admin
      .from('tenants')
      .select('admin_user_id, admin_email, addon_rpm, clinic_name')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
  ]);

  if (!tenantRow) redirect('/painel');

  const isAdminOfTenant =
    tenantRow.admin_user_id === user.id ||
    (!!user.email && tenantRow.admin_email === user.email);
  if (!member && !isAdminOfTenant) redirect('/painel');

  // Feature flag.
  if (!tenantRow.addon_rpm) redirect('/painel');

  const { data: protocols } = await admin
    .from('patient_protocols')
    .select(`
      id, status, started_at, next_consultation_at, last_dispatched_at, notes,
      protocol:treatment_protocols(slug, name, specialty),
      patient:patients(id, name)
    `)
    .eq('tenant_id', tenantId)
    .order('status', { ascending: true })
    .order('next_consultation_at', { ascending: true, nullsFirst: false })
    .limit(200);

  const list: PatientProtocolRow[] = (protocols ?? []) as PatientProtocolRow[];
  const activeList = list.filter((p) => p.status === 'active');
  const otherList = list.filter((p) => p.status !== 'active');

  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-5 h-5" style={{ color: '#6E56CF' }} />
          <h1 className="text-[24px] font-medium tracking-[-0.02em] text-zinc-900 dark:text-zinc-100">Remote Patient Monitoring</h1>
        </div>
        <p className="text-[13px] text-zinc-500 dark:text-zinc-400 max-w-2xl">
          Monitoramento de pacientes entre consultas — coleta passiva (Apple Health, web) + ativa
          (WhatsApp via agente IA) + alertas clinicos automaticos. {' '}
          <strong className="font-semibold text-zinc-700 dark:text-zinc-300">
            {activeList.length} paciente{activeList.length === 1 ? '' : 's'} em seguimento ativo.
          </strong>
        </p>
      </header>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] p-12 text-center">
          <UserPlus className="w-10 h-10 mx-auto text-zinc-300 dark:text-zinc-600 mb-4" />
          <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            Nenhum paciente em seguimento
          </h2>
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mb-6">
            Pra comecar, abra um paciente em <Link href="/painel/pacientes" className="text-violet-600 hover:underline">Pacientes</Link>{' '}
            e clique em &ldquo;Atribuir&rdquo; na secao Seguimento de tratamento.
          </p>
          <Link
            href="/painel/pacientes"
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-violet-600 text-white text-[13px] font-semibold hover:opacity-90 transition-opacity"
          >
            Ir pra Pacientes
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <>
          {activeList.length > 0 && (
            <section className="mb-8">
              <h2 className="text-[10px] uppercase tracking-[0.12em] font-semibold text-zinc-500 mb-3">Ativos</h2>
              <div className="space-y-2">
                {activeList.map((pp) => <ProtocolRow key={pp.id} pp={pp} />)}
              </div>
            </section>
          )}
          {otherList.length > 0 && (
            <section>
              <h2 className="text-[10px] uppercase tracking-[0.12em] font-semibold text-zinc-500 mb-3">Historico</h2>
              <div className="space-y-2">
                {otherList.map((pp) => <ProtocolRow key={pp.id} pp={pp} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ProtocolRow({ pp }: { pp: PatientProtocolRow }) {
  const patient = Array.isArray(pp.patient) ? pp.patient[0] : pp.patient;
  const protocol = Array.isArray(pp.protocol) ? pp.protocol[0] : pp.protocol;
  const fullName = patient?.name || 'Paciente sem nome';
  const next = pp.next_consultation_at
    ? new Date(pp.next_consultation_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    : null;
  const lastSent = pp.last_dispatched_at
    ? new Date(pp.last_dispatched_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    : null;

  return (
    <Link
      href={`/painel/seguimento/briefing/${pp.id}`}
      className="block rounded-lg border border-black/[0.06] dark:border-white/[0.06] p-4 hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">{fullName}</div>
          <div className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            {protocol?.name ?? '(sem protocolo)'}
            {next ? ` · Retorno ${next}` : ''}
            {lastSent ? ` · Ultimo toque ${lastSent}` : ' · Sem toques'}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge status={pp.status} />
          <FileText className="w-4 h-4 text-zinc-400" />
        </div>
      </div>
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: '#D1FAE5', text: '#047857', label: 'Ativo' },
    paused: { bg: '#FEF3C7', text: '#92400E', label: 'Pausado' },
    completed: { bg: '#E0E7FF', text: '#3730A3', label: 'Concluido' },
    abandoned: { bg: '#FECACA', text: '#991B1B', label: 'Abandonado' },
  };
  const s = map[status] ?? { bg: '#F4F4F5', text: '#71717A', label: status };
  return (
    <span
      className="text-[10px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded"
      style={{ background: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  );
}
