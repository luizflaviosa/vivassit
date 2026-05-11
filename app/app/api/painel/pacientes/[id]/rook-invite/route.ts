import { NextRequest, NextResponse } from 'next/server';
import { requireTenant, type MemberRole } from '@/lib/auth-tenant';
import { supabaseAdmin } from '@/lib/supabase';

const INVITE_ROLES: MemberRole[] = ['owner', 'admin', 'doctor', 'staff'];

// Convida paciente a conectar Apple Saude/Health Connect via Rook Extraction App.
// Fluxo:
// 1. Registra user no Rook (best-effort, sandbox)
// 2. Gera connection URL: connections.rook-connect.review/client_uuid/<>/user_id/<>
// 3. Envia WhatsApp via Chatwoot API:
//    a) busca/cria contato pelo phone
//    b) cria conversation no inbox configurado
//    c) POST message
// 4. Marca patients.rook_user_id + rook_invited_at
//
// Chatwoot -> Evolution -> WhatsApp (transparente).

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

  // user_id format: regex Rook ^[a-zA-Z0-9\-]{1,50}$ — so hifens, no underscores.
  const desiredUserId = `singulare-pat-${patient.id}`;
  const rookUserId = patient.rook_user_id && /^[a-zA-Z0-9-]{1,50}$/.test(patient.rook_user_id)
    ? patient.rook_user_id
    : desiredUserId;
  const apiBaseUrl = process.env.ROOK_API_URL ?? 'https://api.rook-connect.review/api/v1';
  const connectionsBase = process.env.ROOK_CONNECTIONS_BASE_URL ?? 'https://connections.rook-connect.review';

  // Best-effort: registra user no Rook via POST /users (Basic auth).
  const basicAuth = `Basic ${Buffer.from(`${clientUuid}:${apiKey}`).toString('base64')}`;
  let rookRegistered = false;
  let rookError: string | null = null;
  try {
    const r = await fetch(`${apiBaseUrl}/users`, {
      method: 'POST',
      headers: {
        'Authorization': basicAuth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ client_uuid: clientUuid, user_id: rookUserId }),
      signal: AbortSignal.timeout(8000),
    });
    rookRegistered = r.ok;
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      rookError = `HTTP ${r.status}: ${txt.slice(0, 200)}`;
    }
  } catch (e) {
    rookError = e instanceof Error ? e.message : String(e);
  }

  const connectionUrl = `${connectionsBase}/client_uuid/${clientUuid}/user_id/${rookUserId}`;

  // Carrega config Chatwoot do tenant
  const { data: tenant } = await supa
    .from('tenants')
    .select('clinic_name, chatwoot_url, chatwoot_account_id, chatwoot_inbox_id')
    .eq('tenant_id', auth.ctx.tenant.tenant_id)
    .maybeSingle();

  const chatwootKey = process.env.CHATWOOT_API_KEY;
  const chatwootUrl = tenant?.chatwoot_url?.replace(/\/$/, '');
  const accountId = tenant?.chatwoot_account_id;
  const inboxId = tenant?.chatwoot_inbox_id;

  if (!chatwootKey || !chatwootUrl || !accountId || !inboxId) {
    return NextResponse.json({
      success: false,
      error: 'chatwoot_not_configured',
      missing: {
        api_key: !chatwootKey,
        chatwoot_url: !chatwootUrl,
        account_id: !accountId,
        inbox_id: !inboxId,
      },
      connection_url: connectionUrl,
    }, { status: 500 });
  }

  const firstName = (patient.name ?? 'paciente').split(' ')[0];
  const clinicName = tenant?.clinic_name ?? 'Singulare';
  const messageText = `Olá, ${firstName}.\n\nA ${clinicName} liberou acesso ao monitoramento contínuo dos seus dados de saúde (frequência cardíaca, sono, atividade). Isso permite ao seu médico acompanhar a evolução do tratamento com dados reais.\n\nClique no link, instale o app Rook Extraction e autorize o acesso ao app Saúde:\n\n${connectionUrl}\n\nO setup leva 2 minutos. Qualquer dúvida, responda esta mensagem.`;

  // Normaliza phone (Chatwoot espera E.164 com +)
  const phone = patient.phone.startsWith('+') ? patient.phone : `+${patient.phone}`;
  const chatwootHeaders = {
    'api_access_token': chatwootKey,
    'Content-Type': 'application/json',
  };

  let chatwootSent = false;
  let chatwootError: string | null = null;
  let conversationId: number | null = null;
  let contactId: number | null = null;

  try {
    // 1. Search contact by phone
    const searchRes = await fetch(`${chatwootUrl}/api/v1/accounts/${accountId}/contacts/search?q=${encodeURIComponent(phone)}&include=contact_inboxes`, {
      headers: chatwootHeaders,
      signal: AbortSignal.timeout(10000),
    });
    if (searchRes.ok) {
      const sj = await searchRes.json() as { payload?: Array<{ id: number; phone_number?: string | null }> };
      const match = sj.payload?.find((c) => c.phone_number === phone);
      if (match) contactId = match.id;
    }

    // 2. Create contact if not found
    if (!contactId) {
      const createRes = await fetch(`${chatwootUrl}/api/v1/accounts/${accountId}/contacts`, {
        method: 'POST',
        headers: chatwootHeaders,
        body: JSON.stringify({
          inbox_id: inboxId,
          name: patient.name ?? firstName,
          phone_number: phone,
          identifier: `singulare_pat_${patient.id}`,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!createRes.ok) {
        const txt = await createRes.text().catch(() => '');
        throw new Error(`contact_create_failed: HTTP ${createRes.status} ${txt.slice(0, 200)}`);
      }
      const cj = await createRes.json() as { payload?: { contact?: { id?: number } } };
      contactId = cj.payload?.contact?.id ?? null;
      if (!contactId) throw new Error('contact_create_no_id');
    }

    // 3. Create new conversation (Chatwoot dedup nao funciona via API simples;
    //    cria nova - paciente recebe na thread, secretaria humana ve normal)
    const convRes = await fetch(`${chatwootUrl}/api/v1/accounts/${accountId}/conversations`, {
      method: 'POST',
      headers: chatwootHeaders,
      body: JSON.stringify({
        source_id: phone,
        inbox_id: inboxId,
        contact_id: contactId,
        message: { content: messageText },
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!convRes.ok) {
      const txt = await convRes.text().catch(() => '');
      throw new Error(`conversation_create_failed: HTTP ${convRes.status} ${txt.slice(0, 200)}`);
    }
    const cv = await convRes.json() as { id?: number };
    conversationId = cv.id ?? null;
    chatwootSent = true;
  } catch (e) {
    chatwootError = e instanceof Error ? e.message : String(e);
  }

  // Atualiza paciente (mesmo se falhou - marca tentativa)
  await supa
    .from('patients')
    .update({
      rook_user_id: rookUserId,
      rook_invited_at: new Date().toISOString(),
    })
    .eq('id', patientId);

  return NextResponse.json({
    success: chatwootSent,
    rook_user_id: rookUserId,
    connection_url: connectionUrl,
    rook_registered: rookRegistered,
    rook_error: rookError,
    chatwoot_sent: chatwootSent,
    chatwoot_error: chatwootError,
    chatwoot_contact_id: contactId,
    chatwoot_conversation_id: conversationId,
  });
}
