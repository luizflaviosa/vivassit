import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenant } from '@/lib/auth-tenant';
import { createCalendar, shareCalendarWith } from '@/lib/google-calendar';

export async function GET() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('tenant_doctors')
    .select(
      'id, doctor_name, doctor_crm, specialty, is_primary, status, consultation_value, payment_methods, working_hours, accepts_insurance, insurance_note, followup_value, followup_window_days, consultation_duration, contact_email, contact_phone, address, calendar_id, business_rules, birdid_cpf, created_at'
    )
    .eq('tenant_id', auth.ctx.tenant.tenant_id)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[painel/profissionais GET] erro:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, doctors: data ?? [] });
}

// Schema de regras de negócio por médico (todas opcionais com defaults sensatos no fn_rebuild_tenant_prompt).
// Usado pelo (futuro) sub-workflow safe_create_event como gate server-side.
interface DoctorBusinessRules {
  min_advance_hours?: number;          // mín antes da consulta (default 2)
  max_advance_days?: number;           // máx pra agendar futuro (default 60)
  appointment_buffer_minutes?: number; // espaçamento entre consultas (default 0)
  max_per_day?: number | null;         // limite/dia (null=sem limite)
  allow_emergency_fds?: boolean;       // atende emergência fim de semana
  requires_anamnese?: boolean;         // exige formulário antes da 1a
  custom_rules_text?: string;          // texto livre exibido no rendered_prompt
}

interface DoctorInput {
  doctor_name: string;
  doctor_crm?: string;
  specialty: string;
  consultation_value?: number | string | null;
  consultation_duration?: number;
  payment_methods?: string;
  working_hours?: Record<string, string>;
  accepts_insurance?: boolean;
  insurance_note?: string;
  followup_window_days?: number;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  business_rules?: DoctorBusinessRules;
  birdid_cpf?: string | null;
}

export async function POST(req: NextRequest) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const body = (await req.json()) as DoctorInput;

  if (!body?.doctor_name?.trim()) {
    return NextResponse.json({ success: false, message: 'Nome obrigatório' }, { status: 400 });
  }
  if (!body?.specialty?.trim()) {
    return NextResponse.json({ success: false, message: 'Especialidade obrigatória' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const consultationValue =
    body.consultation_value === '' || body.consultation_value === undefined || body.consultation_value === null
      ? null
      : typeof body.consultation_value === 'string'
      ? parseFloat(body.consultation_value.replace(',', '.'))
      : body.consultation_value;

  const row = {
    tenant_id: auth.ctx.tenant.tenant_id,
    doctor_name: body.doctor_name.trim(),
    doctor_crm: body.doctor_crm?.trim() || null,
    specialty: body.specialty.trim(),
    is_primary: false,
    status: 'active',
    consultation_value: consultationValue,
    consultation_duration: body.consultation_duration ?? 30,
    payment_methods: body.payment_methods?.trim() || null,
    working_hours: body.working_hours ?? {},
    accepts_insurance: !!body.accepts_insurance,
    insurance_note: body.insurance_note?.trim() || null,
    followup_value: 0,
    followup_window_days: body.followup_window_days ?? 30,
    followup_duration: 30,
    contact_email: body.contact_email?.trim() || null,
    contact_phone: body.contact_phone?.trim() || null,
    address: body.address?.trim() || null,
    business_rules: body.business_rules ?? {},
    birdid_cpf: body.birdid_cpf?.replace(/\D/g, '').trim() || null,
  };

  const { data, error } = await supabase.from('tenant_doctors').insert(row).select('id').single();

  if (error) {
    console.error('[painel/profissionais POST] erro:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  // ─── Auto-cria Google Calendar dedicado pra este profissional ──────────────
  // OBRIGATÓRIO: profissional sem calendar é inválido. Se a criação do calendar
  // falhar, ROLLBACK do INSERT do doctor e retornamos erro claro pro usuário.
  // Sem doctor zumbi (criado mas sem calendar). Sem self-healing maluco.
  const calendarInfo: { calendar_id?: string; share_status?: string } = {};
  let createdRes;
  try {
    createdRes = await createCalendar({
      summary: `${row.doctor_name} · ${auth.ctx.tenant.clinic_name}`,
    });
  } catch (e) {
    // Rollback: deleta o doctor recém-criado
    await supabase.from('tenant_doctors').delete().eq('id', data!.id);
    console.error('[painel/profissionais POST] calendar auto-create EXCEPTION, doctor revertido:', e);
    return NextResponse.json({
      success: false,
      message: 'Falha ao criar agenda Google. Profissional NÃO foi salvo. Tente novamente em instantes ou contate suporte.',
      error: e instanceof Error ? e.message : String(e),
    }, { status: 502 });
  }

  if ('error' in createdRes) {
    // Calendar não foi criado (SA não configurado, quota, etc) → rollback doctor
    await supabase.from('tenant_doctors').delete().eq('id', data!.id);
    console.error('[painel/profissionais POST] calendar auto-create ERROR, doctor revertido:', createdRes.error);
    return NextResponse.json({
      success: false,
      message: `Falha ao criar agenda Google: ${createdRes.error}. Profissional NÃO foi salvo.`,
      code: createdRes.code,
    }, { status: 502 });
  }

  // Calendar criado OK → salva ID no doctor
  calendarInfo.calendar_id = createdRes.calendar_id;
  const { error: updErr } = await supabase
    .from('tenant_doctors')
    .update({ calendar_id: createdRes.calendar_id })
    .eq('id', data!.id);

  if (updErr) {
    console.error('[painel/profissionais POST] erro ao salvar calendar_id:', updErr);
    // Não dá rollback do calendar do Google — fica órfão lá, mas pelo menos
    // o doctor com calendar_id NULL agora tá em estado conhecido pra investigar.
    return NextResponse.json({
      success: false,
      message: `Calendar criado (${createdRes.calendar_id}) mas falhou ao salvar no banco: ${updErr.message}`,
    }, { status: 500 });
  }

  // Compartilha com contact_email (best effort, não bloqueia)
  if (row.contact_email) {
    const shared = await shareCalendarWith({
      calendarId: createdRes.calendar_id,
      email: row.contact_email,
      role: 'writer',
    });
    calendarInfo.share_status = 'ok' in shared ? `shared_with_${row.contact_email}` : `share_failed:${shared.error.slice(0, 80)}`;
  }

  return NextResponse.json({ success: true, id: data?.id, calendar: calendarInfo });
}

interface DoctorPatch {
  id: string;
  doctor_name?: string;
  doctor_crm?: string;
  specialty?: string;
  consultation_value?: number | string | null;
  consultation_duration?: number | null;
  payment_methods?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  address?: string | null;
  calendar_id?: string | null;
  followup_value?: number | string | null;
  followup_window_days?: number | null;
  followup_duration?: number | null;
  accepts_insurance?: boolean;
  insurance_note?: string | null;
  working_hours?: Record<string, string>;
  business_rules?: DoctorBusinessRules;
  birdid_cpf?: string | null;
}

export async function PATCH(req: NextRequest) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  let body: DoctorPatch;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'JSON inválido' }, { status: 400 });
  }
  if (!body.id) {
    return NextResponse.json({ success: false, message: 'id obrigatório' }, { status: 400 });
  }

  // Pega só os campos editáveis (whitelist)
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const fields: (keyof DoctorPatch)[] = [
    'doctor_name', 'doctor_crm', 'specialty', 'consultation_value', 'consultation_duration',
    'payment_methods', 'contact_email', 'contact_phone', 'address', 'calendar_id',
    'followup_value', 'followup_window_days', 'followup_duration', 'accepts_insurance',
    'insurance_note', 'working_hours', 'business_rules', 'birdid_cpf',
  ];
  for (const f of fields) {
    if (body[f] !== undefined) updates[f] = body[f];
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ success: false, message: 'nenhum campo para atualizar' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('tenant_doctors')
    .update(updates)
    .eq('tenant_id', auth.ctx.tenant.tenant_id)
    .eq('id', body.id)
    .select()
    .single();

  if (error) {
    console.error('[painel/profissionais PATCH] erro:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, doctor: data });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ success: false, message: 'id obrigatório' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from('tenant_doctors')
    .delete()
    .eq('tenant_id', auth.ctx.tenant.tenant_id)
    .eq('id', id)
    .eq('is_primary', false); // protege o profissional principal

  if (error) {
    console.error('[painel/profissionais DELETE] erro:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
