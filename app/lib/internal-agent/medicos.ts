/**
 * medicos_listar — respeita scope: doctor vê só ele mesmo,
 * admin/owner/staff vê todos os médicos do tenant.
 */
import { supabaseAdmin } from '../supabase';
import type { Handler } from './shared';
import { resolveDoctorScope } from './shared';

export const medicosListar: Handler = async (_params, ctx) => {
  const admin = supabaseAdmin();
  const scope = await resolveDoctorScope(ctx);

  let q = admin
    .from('tenant_doctors')
    .select('id, doctor_name, specialty, doctor_crm, status')
    .eq('tenant_id', ctx.tenant_id)
    .eq('status', 'active')
    .order('doctor_name', { ascending: true });

  if (scope.scope === 'individual' && scope.doctor_id) {
    q = q.eq('id', scope.doctor_id);
  }

  const { data, error } = await q;
  if (error) return { ok: false, summary: 'Erro ao buscar médicos', error: error.message };

  const list = (data ?? []).map((d) => ({
    doctor_id: d.id,
    name: d.doctor_name,
    specialty: d.specialty,
    crm: d.doctor_crm,
  }));

  if (scope.scope === 'individual' && !scope.doctor_id) {
    return {
      ok: true,
      summary: 'Seu usuário não está vinculado a um perfil de médico no tenant. Pede pra um admin configurar tenant_members.doctor_id.',
      data: { count: 0, doctors: [], scope: 'individual_unlinked' },
    };
  }

  return {
    ok: true,
    summary:
      list.length === 0
        ? 'Nenhum médico ativo cadastrado.'
        : list.length === 1
          ? `1 médico ativo: ${list[0].name} (${list[0].specialty}).`
          : `${list.length} médicos ativos: ${list.map((d) => d.name).join(', ')}.`,
    data: { count: list.length, doctors: list, scope: scope.scope },
  };
};
