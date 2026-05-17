/**
 * Documentos: documentos_listar (read) + documento_gerar / documento_assinar (writes stub).
 */
import { supabaseAdmin } from '../supabase';
import type { Handler, WriteHandler } from './shared';
import { resolveDoctorScope } from './shared';

export const documentosListar: Handler = async (params, ctx) => {
  const limit = Math.min(50, Math.max(1, Number(params.limit ?? 10)));
  const status = String(params.status ?? 'all');
  const pacienteId = params.paciente_id ? Number(params.paciente_id) : null;
  const admin = supabaseAdmin();

  const scope = await resolveDoctorScope(ctx, params.doctor_id as string | undefined);

  let q = admin
    .from('medical_documents')
    .select('id, doc_type, status, patient_id, doctor_id, pdf_url, signed_pdf_url, signed_at, sent_to_patient_at, created_at')
    .eq('tenant_id', ctx.tenant_id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status !== 'all') q = q.eq('status', status);
  if (pacienteId) q = q.eq('patient_id', pacienteId);
  if (scope.doctor_id) q = q.eq('doctor_id', scope.doctor_id);

  const { data, error } = await q;
  if (error) {
    return {
      ok: true,
      summary: 'Sem documentos ou tabela ainda não disponível.',
      data: { count: 0, items: [] },
    };
  }

  const list = data ?? [];
  const signed = list.filter((d) => d.status === 'signed').length;
  const draft = list.filter((d) => d.status === 'draft').length;

  return {
    ok: true,
    summary: `${list.length} documento(s) — ${signed} assinado(s), ${draft} rascunho(s).`,
    data: { count: list.length, signed, draft, items: list },
  };
};

// Sprint 2 stub: propose preview; execute sinaliza handoff p/ UI do painel
// (gerar/assinar docs requer template editor + BirdID modal — UX visual essencial)
export const documentoGerar: WriteHandler = {
  async propose(params, _ctx) {
    return {
      ok: true,
      summary: 'Gerar documento (precisa do painel pra preencher campos).',
      card: {
        summary: 'Gerar documento',
        detail: `Template: ${params.template_id}\nPaciente: ${params.paciente_id}\nVou abrir o editor de documentos pra você preencher e revisar antes de enviar.`,
        confirm_label: 'Abrir editor',
        cancel_label: 'Voltar',
        action: { tool: 'documento_gerar', params },
      },
    };
  },
  async execute(params, _ctx) {
    return {
      ok: true,
      summary: 'Abre o editor pra finalizar.',
      data: {
        redirect: `/painel/docs?action=new&template=${params.template_id}&paciente=${params.paciente_id}`,
      },
    };
  },
};

export const documentoAssinar: WriteHandler = {
  async propose(params, ctx) {
    const docId = Number(params.documento_id);
    const admin = supabaseAdmin();
    const { data: doc } = await admin
      .from('medical_documents')
      .select('id, doc_type, status, patient_id')
      .eq('tenant_id', ctx.tenant_id)
      .eq('id', docId)
      .maybeSingle();
    if (!doc) return { ok: false, summary: 'Documento não encontrado.' };
    if (doc.status === 'signed') return { ok: false, summary: 'Documento já assinado.' };
    return {
      ok: true,
      summary: `Enviar pra assinatura via BirdID?`,
      card: {
        summary: 'Enviar pra assinatura',
        detail: `Documento: ${doc.doc_type}\nVai abrir BirdID pra assinatura digital.`,
        confirm_label: 'Enviar pra BirdID',
        cancel_label: 'Voltar',
        action: { tool: 'documento_assinar', params: { documento_id: docId } },
      },
      data: { doc },
    };
  },
  async execute(params, _ctx) {
    return {
      ok: true,
      summary: 'Abrindo fluxo BirdID...',
      data: {
        redirect: `/painel/docs?action=sign&id=${params.documento_id}`,
      },
    };
  },
};
