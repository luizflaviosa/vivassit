import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createCalendar, shareCalendarWith, getServiceAccountEmail } from '@/lib/google-calendar';

// POST /api/admin/backfill-doctor-calendars
//
// Self-healing: scans tenant_doctors with NULL calendar_id and auto-creates Google Calendar
// for each, sharing with contact_email.
//
// Auth: Authorization: Bearer <N8N_TO_VERCEL_TOKEN>
// Trigger: chamado por n8n cron a cada 30min OU on-demand via curl.
// Idempotente: doctors que já têm calendar_id são pulados.

interface BackfillResult {
  doctor_id: string;
  doctor_name: string;
  tenant_id: string;
  status: 'created' | 'skipped' | 'failed';
  calendar_id?: string;
  share_status?: string;
  error?: string;
}

export async function POST(req: NextRequest) {
  // Auth
  const expected = process.env.N8N_TO_VERCEL_TOKEN;
  if (!expected) {
    return NextResponse.json({ success: false, message: 'server_misconfigured' }, { status: 500 });
  }
  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${expected}`) {
    // DEBUG: retorna comparação de length sem leak do valor (remove depois)
    const sent = auth.replace(/^Bearer\s+/, '');
    return NextResponse.json({
      success: false,
      message: 'unauthorized',
      debug: {
        expected_length: expected.length,
        sent_length: sent.length,
        expected_first4: expected.slice(0, 4),
        sent_first4: sent.slice(0, 4),
        expected_last4: expected.slice(-4),
        sent_last4: sent.slice(-4),
        match: false,
      },
    }, { status: 401 });
  }

  const saEmail = getServiceAccountEmail();
  if (!saEmail) {
    return NextResponse.json({
      success: false,
      message: 'GOOGLE_SERVICE_ACCOUNT_JSON não configurado no Vercel.',
    }, { status: 500 });
  }

  const supabase = supabaseAdmin();

  // Busca doctors active sem calendar_id (sem JOIN — pega clinic_name em query separada)
  const { data: doctors, error: queryErr } = await supabase
    .from('tenant_doctors')
    .select('id, tenant_id, doctor_name, contact_email')
    .is('calendar_id', null)
    .eq('status', 'active');

  if (queryErr) {
    console.error('[backfill-calendars] erro query:', queryErr);
    return NextResponse.json({ success: false, message: queryErr.message }, { status: 500 });
  }

  if (!doctors || doctors.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'Nenhum doctor sem calendar — todos já têm.',
      processed: 0,
      results: [],
    });
  }

  // Pega clinic_name de todos tenants relevantes em 1 query
  const tenantIds = Array.from(new Set(doctors.map((d) => d.tenant_id)));
  const { data: tenants } = await supabase
    .from('tenants')
    .select('tenant_id, clinic_name')
    .in('tenant_id', tenantIds);
  const tenantNameById: Record<string, string> = {};
  for (const t of tenants ?? []) {
    tenantNameById[t.tenant_id] = t.clinic_name ?? 'Singulare';
  }

  const results: BackfillResult[] = [];

  for (const d of doctors) {
    const clinicName = tenantNameById[d.tenant_id] ?? 'Singulare';
    const summary = `${d.doctor_name} · ${clinicName}`;

    const created = await createCalendar({ summary });
    if ('error' in created) {
      results.push({
        doctor_id: d.id,
        doctor_name: d.doctor_name,
        tenant_id: d.tenant_id,
        status: 'failed',
        error: created.error,
      });
      console.error(`[backfill-calendars] falhou pra ${d.doctor_name} (${d.id}):`, created.error);
      continue;
    }

    // Salva calendar_id
    const { error: updErr } = await supabase
      .from('tenant_doctors')
      .update({ calendar_id: created.calendar_id, updated_at: new Date().toISOString() })
      .eq('id', d.id);

    if (updErr) {
      results.push({
        doctor_id: d.id,
        doctor_name: d.doctor_name,
        tenant_id: d.tenant_id,
        status: 'failed',
        calendar_id: created.calendar_id,
        error: `Calendar criado (${created.calendar_id}) mas falhou ao salvar: ${updErr.message}`,
      });
      continue;
    }

    // Compartilha com contact_email se existir
    let shareStatus = 'no_email';
    if (d.contact_email) {
      const shared = await shareCalendarWith({
        calendarId: created.calendar_id,
        email: d.contact_email,
        role: 'writer',
      });
      shareStatus = 'error' in shared
        ? `share_failed:${shared.error.slice(0, 80)}`
        : `shared_with_${d.contact_email}`;
    }

    results.push({
      doctor_id: d.id,
      doctor_name: d.doctor_name,
      tenant_id: d.tenant_id,
      status: 'created',
      calendar_id: created.calendar_id,
      share_status: shareStatus,
    });
  }

  const created_count = results.filter((r) => r.status === 'created').length;
  const failed_count = results.filter((r) => r.status === 'failed').length;

  return NextResponse.json({
    success: failed_count === 0,
    message: `Backfill concluído: ${created_count} criados, ${failed_count} falhas, ${doctors.length} processados.`,
    processed: doctors.length,
    created: created_count,
    failed: failed_count,
    sa_email: saEmail,
    results,
  });
}
