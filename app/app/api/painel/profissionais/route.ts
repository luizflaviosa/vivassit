import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenant');
  if (!tenantId) {
    return NextResponse.json({ success: false, message: 'tenant obrigatório' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('tenant_doctors')
    .select(
      'id, doctor_name, doctor_crm, specialty, is_primary, status, consultation_value, payment_methods, working_hours, accepts_insurance, insurance_note, followup_value, followup_window_days, consultation_duration, contact_email, contact_phone, address, calendar_id, created_at'
    )
    .eq('tenant_id', tenantId)
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
  const tenantId = req.nextUrl.searchParams.get('tenant');
  if (!tenantId) {
    return NextResponse.json({ success: false, message: 'tenant obrigatório' }, { status: 400 });
  }
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
    tenant_id: tenantId,
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

export async function DELETE(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenant');
  const id = req.nextUrl.searchParams.get('id');
  if (!tenantId || !id) {
    return NextResponse.json({ success: false, message: 'tenant e id obrigatórios' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from('tenant_doctors')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .eq('is_primary', false); // protege o profissional principal

  if (error) {
    console.error('[painel/profissionais DELETE] erro:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
