import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenant } from '@/lib/auth-tenant';
import { createCalendar, shareCalendarWith, ensureSAAccess, getServiceAccountEmail } from '@/lib/google-calendar';

interface Ctx { params: { id: string } }

// POST /api/painel/profissionais/[id]/calendar
//
// body: { action: 'create' | 'verify', share_with?: string }
//   - 'create': cria novo calendar (SA é owner) + opcionalmente compartilha
//      com share_with (Gmail pessoal do profissional pra ele ver no Google)
//   - 'verify': checa se o SA tem acesso ao calendar atual; retorna info diagnóstica

export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const tenantId = auth.ctx.tenant.tenant_id;
  const supabase = supabaseAdmin();

  let body: { action?: 'create' | 'verify'; share_with?: string };
  try {
    body = await req.json();
  } catch {
    body = { action: 'verify' };
  }

  // Carrega o profissional
  const { data: doctor } = await supabase
    .from('tenant_doctors')
    .select('id, doctor_name, calendar_id, contact_email')
    .eq('tenant_id', tenantId)
    .eq('id', params.id)
    .maybeSingle();

  if (!doctor) {
    return NextResponse.json({ success: false, message: 'Profissional não encontrado' }, { status: 404 });
  }

  const action = body.action ?? 'verify';
  const saEmail = getServiceAccountEmail();

  // ── VERIFY ───────────────────────────────────────────────────────────────
  if (action === 'verify') {
    if (!doctor.calendar_id) {
      return NextResponse.json({
        success: false,
        message: 'Profissional ainda não tem calendar_id. Use action=create.',
        sa_email: saEmail,
      });
    }
    const result = await ensureSAAccess(doctor.calendar_id);
    if ('error' in result) {
      return NextResponse.json({
        success: false,
        message: result.error,
        error: result.error,
        code: result.code,
        sa_email: saEmail,
        suggestion: result.code === 'no_access'
          ? `Compartilhe o calendar "${doctor.calendar_id}" manualmente com ${saEmail} (Reader access) ou crie um novo calendar com action=create.`
          : undefined,
      });
    }
    return NextResponse.json({
      success: true,
      message: 'Service Account tem acesso ao calendar.',
      calendar_id: doctor.calendar_id,
      sa_email: saEmail,
    });
  }

  // ── CREATE ───────────────────────────────────────────────────────────────
  if (action === 'create') {
    if (doctor.calendar_id) {
      return NextResponse.json({
        success: false,
        message: 'Profissional já tem calendar_id. Apague-o antes de criar outro, ou use action=verify.',
      }, { status: 400 });
    }

    // 1. Cria calendar (SA owner)
    const summary = `${doctor.doctor_name} · Singulare`;
    const created = await createCalendar({ summary });
    if ('error' in created) {
      return NextResponse.json({
        success: false,
        message: created.error,
        code: created.code,
      }, { status: 500 });
    }

    // 2. Salva calendar_id no profissional
    const { error: updateErr } = await supabase
      .from('tenant_doctors')
      .update({ calendar_id: created.calendar_id, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', params.id);

    if (updateErr) {
      console.error('[calendar/create] erro ao salvar calendar_id:', updateErr);
      return NextResponse.json({
        success: false,
        message: 'Calendar criado mas falhou ao salvar no banco. ID: ' + created.calendar_id,
      }, { status: 500 });
    }

    // 3. Compartilha com email pessoal do profissional (se fornecido)
    const shareEmail = body.share_with || doctor.contact_email;
    let shareResult: { shared: boolean; with: string | null; error?: string } = { shared: false, with: null };
    if (shareEmail) {
      const shared = await shareCalendarWith({
        calendarId: created.calendar_id,
        email: shareEmail,
        role: 'writer',
      });
      if ('error' in shared) {
        shareResult = { shared: false, with: shareEmail, error: shared.error };
      } else {
        shareResult = { shared: true, with: shareEmail };
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Calendar criado com sucesso',
      calendar_id: created.calendar_id,
      summary: created.summary,
      sa_email: saEmail,
      share: shareResult,
    });
  }

  return NextResponse.json({ success: false, message: 'action inválida' }, { status: 400 });
}
