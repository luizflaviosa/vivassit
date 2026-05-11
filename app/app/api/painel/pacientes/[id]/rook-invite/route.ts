import { NextRequest, NextResponse } from 'next/server';
import { requireTenant, type MemberRole } from '@/lib/auth-tenant';
import { supabaseAdmin } from '@/lib/supabase';

const INVITE_ROLES: MemberRole[] = ['owner', 'admin', 'doctor', 'staff'];

// Convida paciente a conectar Apple Saude/Health Connect via Rook Extraction App.
// Fluxo: registra user no Rook (best-effort) -> gera connection URL ->
// envia WhatsApp via Evolution com o link curto.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  if (!INVITE_ROLES.includes(auth.ctx.member.role)) {
    return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 });
  }

  const patientId = parseInt(params.id, 10);
  if (isNaN(patientId)) {
    return NextResponse.json({ success: false, error: 'invalid_id' }, { status: 400 });
  }

  const supa = supabaseAdmin();
  const { data: patient } = await supa
    .from('patients')
    .select('id, tenant_id, name, phone, rook_user_id, rook_invited_at')
    .eq('id', patientId)
    .eq('tenant_id', auth.ctx.tenant.tenant_id)
    .maybeSingle();

  if (!patient) {
    return NextResponse.json({ success: false, error: 'patient_not_found' }, { status: 404 });
  }
  if (!patient.phone) {
    return NextResponse.json({ success: false, error: 'patient_without_phone' }, { status: 400 });
  }

  const clientUuid = process.env.ROOK_CLIENT_UUID;
  const apiKey = process.env.ROOK_API_KEY;
  if (!clientUuid || !apiKey) {
    return NextResponse.json({ success: false, error: 'rook_not_configured' }, { status: 500 });
  }

  const rookUserId = patient.rook_user_id ?? `singulare_pat_${patient.id}`;
  const apiBaseUrl = process.env.ROOK_API_URL ?? 'https://api.tryrook.io/api/v1';
  const connectionsBase = process.env.ROOK_CONNECTIONS_BASE_URL ?? 'https://connections.rook-connect.review';

  // Best-effort: registra user no Rook. Se falhar (sandbox/DNS/URL errada),
  // segue com a geracao da URL — Rook cria implicitamente quando paciente
  // hit a connection page.
  let rookRegistered = false;
  let rookError: string | null = null;
  try {
    const r = await fetch(`${apiBaseUrl}/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Api-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ client_uuid: clientUuid, user_id: rookUserId }),
      signal: AbortSignal.timeout(8000),
    });
    rookRegistered = r.ok;
    if (!r.ok) rookError = `HTTP ${r.status}`;
  } catch (e) {
    rookError = e instanceof Error ? e.message : String(e);
  }

  const connectionUrl = `${connectionsBase}/client_uuid/${clientUuid}/user_id/${rookUserId}`;

  // Envia WhatsApp via Evolution API (mesmo pattern de docs/[id]/send)
  const evoUrl = process.env.EVOLUTION_BASE_URL;
  const evoKey = process.env.EVOLUTION_API_KEY;
  const { data: tenant } = await supa
    .from('tenants')
    .select('evolution_instance_name, clinic_name')
    .eq('tenant_id', auth.ctx.tenant.tenant_id)
    .maybeSingle();
  const instance = tenant?.evolution_instance_name;

  if (!evoUrl || !evoKey || !instance) {
    return NextResponse.json({
      success: false,
      error: 'evolution_not_configured',
      connection_url: connectionUrl,
      rook_registered: rookRegistered,
      rook_error: rookError,
    }, { status: 500 });
  }

  const firstName = (patient.name ?? 'paciente').split(' ')[0];
  const clinicName = tenant?.clinic_name ?? 'Singulare';
  const text = `Olá, ${firstName}.\n\nA ${clinicName} liberou acesso ao monitoramento contínuo dos seus dados de saúde (frequência cardíaca, sono, atividade). Isso permite ao seu médico acompanhar a evolução do tratamento com dados reais.\n\nClique no link, instale o app Rook Extraction e autorize o acesso ao app Saúde:\n\n${connectionUrl}\n\nO setup leva 2 minutos. Qualquer dúvida, responda esta mensagem.`;

  let whatsappSent = false;
  let whatsappError: string | null = null;
  try {
    const r = await fetch(`${evoUrl}/message/sendText/${instance}`, {
      method: 'POST',
      headers: { 'apikey': evoKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: patient.phone, text }),
      signal: AbortSignal.timeout(10000),
    });
    whatsappSent = r.ok;
    if (!r.ok) whatsappError = `HTTP ${r.status}: ${await r.text().catch(() => '')}`;
  } catch (e) {
    whatsappError = e instanceof Error ? e.message : String(e);
  }

  // Atualiza o paciente: rook_user_id (se nao tinha) + rook_invited_at
  await supa
    .from('patients')
    .update({
      rook_user_id: rookUserId,
      rook_invited_at: new Date().toISOString(),
    })
    .eq('id', patientId);

  return NextResponse.json({
    success: whatsappSent,
    rook_user_id: rookUserId,
    connection_url: connectionUrl,
    rook_registered: rookRegistered,
    rook_error: rookError,
    whatsapp_sent: whatsappSent,
    whatsapp_error: whatsappError,
  });
}
