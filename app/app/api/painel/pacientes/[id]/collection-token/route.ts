import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenant } from '@/lib/auth-tenant';
import { randomUUID } from 'crypto';

interface RouteContext {
  params: { id: string };
}

// POST: gera (ou regenera) o health_collection_token do paciente.
// Retorna o token + URL pronta pra clinica copiar e enviar via WhatsApp.
export async function POST(_req: Request, { params }: RouteContext) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const tenantId = auth.ctx.tenant.tenant_id;
  const supabase = supabaseAdmin();

  const patientId = parseInt(params.id, 10);
  if (isNaN(patientId)) {
    return NextResponse.json({ success: false, error: 'invalid_id' }, { status: 400 });
  }

  // Confirma que paciente pertence ao tenant antes de mexer.
  const { data: patient, error: pErr } = await supabase
    .from('patients')
    .select('id, tenant_id, name')
    .eq('id', patientId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (pErr || !patient) {
    return NextResponse.json({ success: false, error: 'not_found' }, { status: 404 });
  }

  const token = randomUUID();
  const { error: uErr } = await supabase
    .from('patients')
    .update({ health_collection_token: token })
    .eq('id', patient.id);
  if (uErr) {
    return NextResponse.json({ success: false, error: 'update_failed', detail: uErr.message }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://singulare.org';
  const url = `${baseUrl}/saude/${token}`;

  return NextResponse.json({ success: true, token, url });
}

// DELETE: revoga o token (nulifica), invalidando o link existente.
export async function DELETE(_req: Request, { params }: RouteContext) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const tenantId = auth.ctx.tenant.tenant_id;
  const supabase = supabaseAdmin();

  const patientId = parseInt(params.id, 10);
  if (isNaN(patientId)) {
    return NextResponse.json({ success: false, error: 'invalid_id' }, { status: 400 });
  }

  const { error } = await supabase
    .from('patients')
    .update({ health_collection_token: null })
    .eq('id', patientId)
    .eq('tenant_id', tenantId);
  if (error) {
    return NextResponse.json({ success: false, error: 'revoke_failed', detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
