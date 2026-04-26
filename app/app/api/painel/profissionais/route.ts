import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenant } from '@/lib/auth-tenant';

export async function GET() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('tenant_doctors')
    .select(
      'id, doctor_name, doctor_crm, specialty, is_primary, status, consultation_value, payment_methods, working_hours, accepts_insurance, insurance_note, followup_value, followup_window_days, consultation_duration, contact_email, contact_phone, address, calendar_id, created_at'
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
  };

  const { data, error } = await supabase.from('tenant_doctors').insert(row).select('id').single();

  if (error) {
    console.error('[painel/profissionais POST] erro:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data?.id });
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
  accepts_insurance?: boolean;
  insurance_note?: string | null;
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
    'followup_value', 'followup_window_days', 'accepts_insurance', 'insurance_note',
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
