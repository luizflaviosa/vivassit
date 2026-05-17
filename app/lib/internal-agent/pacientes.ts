/**
 * Pacientes: pacientes_count, pacientes_proximos (reads) + paciente_criar (write).
 */
import { supabaseAdmin } from '../supabase';
import type { Handler, WriteHandler } from './shared';
import { resolveDoctorScope } from './shared';

export const pacientesCount: Handler = async (params, ctx) => {
  const since = params.since ? String(params.since) : null;
  const admin = supabaseAdmin();

  let q = admin
    .from('patients')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', ctx.tenant_id);

  if (since) q = q.gte('created_at', since);

  const { count, error } = await q;
  if (error) return { ok: false, summary: 'Erro ao contar pacientes', error: error.message };

  return {
    ok: true,
    summary: since
      ? `${count ?? 0} pacientes cadastrados desde ${since}.`
      : `${count ?? 0} pacientes cadastrados ao todo.`,
    data: { count: count ?? 0, since },
  };
};

export const pacientesProximos: Handler = async (params, ctx) => {
  const weeks = Math.min(12, Math.max(1, Number(params.weeks_ahead ?? 2)));
  const now = new Date();
  const end = new Date(now.getTime() + weeks * 7 * 86_400_000);
  const admin = supabaseAdmin();

  const scope = await resolveDoctorScope(ctx, params.doctor_id as string | undefined);

  let q = admin
    .from('doctor_bookings')
    .select('id, patient_id, patient_name, slot_start, status')
    .eq('tenant_id', ctx.tenant_id)
    .gte('slot_start', now.toISOString())
    .lte('slot_start', end.toISOString())
    .neq('status', 'cancelled');

  if (scope.doctor_id) q = q.eq('doctor_id', scope.doctor_id);

  const { data, error } = await q;
  if (error) return { ok: false, summary: 'Erro ao buscar próximos', error: error.message };

  const list = data ?? [];
  const byWeek: number[] = Array(weeks).fill(0);
  list.forEach((a) => {
    const days = Math.floor((new Date(a.slot_start).getTime() - now.getTime()) / 86_400_000);
    const wk = Math.min(weeks - 1, Math.floor(days / 7));
    byWeek[wk]++;
  });

  // dedupe por patient_name, guardando primeiro slot futuro de cada um
  const seen = new Map<string, { name: string; next_slot: string; appointments: number }>();
  for (const a of list) {
    const key = (a.patient_name || a.patient_id || '').trim();
    if (!key) continue;
    const existing = seen.get(key);
    if (!existing || new Date(a.slot_start) < new Date(existing.next_slot)) {
      seen.set(key, {
        name: a.patient_name || key,
        next_slot: a.slot_start,
        appointments: (existing?.appointments ?? 0) + 1,
      });
    } else {
      existing.appointments += 1;
    }
  }
  const patients = Array.from(seen.values())
    .sort((a, b) => new Date(a.next_slot).getTime() - new Date(b.next_slot).getTime())
    .map((p) => ({
      name: p.name,
      next_slot: new Date(p.next_slot).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
      appointments: p.appointments,
    }));

  return {
    ok: true,
    summary: `${list.length} consulta(s) marcada(s) nas próximas ${weeks} semana(s) — ${patients.length} pacientes únicos.`,
    data: {
      total_appointments: list.length,
      unique_patients: patients.length,
      by_week: byWeek.map((count, i) => ({ week: i + 1, appointments: count })),
      patients,
    },
  };
};

export const pacienteCriar: WriteHandler = {
  async propose(params, _ctx) {
    const name = String(params.name ?? '').trim();
    const phone = String(params.phone ?? '').trim();
    const birthdate = params.birthdate ? String(params.birthdate) : null;
    const email = params.email ? String(params.email) : null;
    if (!name) return { ok: false, summary: 'Nome obrigatório.' };
    if (!phone.match(/^\+\d{12,14}$/)) {
      return { ok: false, summary: 'Telefone deve ser E.164 (ex: +5511999999999).' };
    }
    return {
      ok: true,
      summary: `Cadastrar ${name}?`,
      card: {
        summary: `Cadastrar paciente`,
        detail: `Nome: ${name}\nTelefone: ${phone}${birthdate ? `\nNascimento: ${birthdate}` : ''}${email ? `\nEmail: ${email}` : ''}`,
        confirm_label: 'Confirmar cadastro',
        cancel_label: 'Voltar',
        action: { tool: 'paciente_criar', params: { name, phone, birthdate, email } },
      },
      data: { name, phone, birthdate, email },
    };
  },
  async execute(params, ctx) {
    const admin = supabaseAdmin();
    const { data: existing } = await admin
      .from('patients')
      .select('id, name')
      .eq('tenant_id', ctx.tenant_id)
      .eq('phone', String(params.phone))
      .maybeSingle();
    if (existing) {
      return {
        ok: false,
        summary: `Já existe paciente com esse telefone: ${existing.name}.`,
        error: 'duplicate',
      };
    }
    const { data, error } = await admin
      .from('patients')
      .insert({
        tenant_id: ctx.tenant_id,
        name: String(params.name),
        phone: String(params.phone),
        birthdate: params.birthdate ? String(params.birthdate) : null,
        email: params.email ? String(params.email) : null,
        notes: 'Criado via agente interno',
        tags: [],
      })
      .select('id, name, phone')
      .maybeSingle();
    if (error) return { ok: false, summary: 'Falha ao cadastrar', error: error.message };
    return { ok: true, summary: `Paciente ${data?.name} cadastrado.`, data };
  },
};
