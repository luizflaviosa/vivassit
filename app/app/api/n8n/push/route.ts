import { NextRequest, NextResponse } from 'next/server';
import { sendPushToTenant, sendPushToUser, type NotificationType, type PushPayload } from '@/lib/push-server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

// Endpoint chamado pelo N8N pra disparar push notifications pros membros do tenant.
//
// Auth: header `Authorization: Bearer <N8N_TO_VERCEL_TOKEN>` (mesmo token do /marketplace/charge)
//
// Body:
//   {
//     tenant_id: 'singulare',          // obrigatório se user_id ausente
//     user_id?: 'uuid',                // opcional — push só pra um membro
//     type: 'appointment_confirmed',   // NotificationType
//     title: 'Maria confirmou ✅',
//     body: 'Consulta amanhã 14h',
//     url?: '/painel/agenda',
//     priority?: 'normal' | 'high',
//     data?: { appointment_id, patient_phone, ... }
//   }

interface NotifyBody {
  tenant_id?: string;
  user_id?: string;
  type: NotificationType;
  title: string;
  body: string;
  url?: string;
  priority?: 'low' | 'normal' | 'high';
  tag?: string;
  data?: Record<string, unknown>;
}

const ALLOWED_TYPES: NotificationType[] = [
  'new_patient',
  'appointment_booked',
  'appointment_confirmed',
  'appointment_reschedule_request',
  'appointment_cancel_request',
  'appointment_cancel',
  'payment_confirmed',
  'payment_overdue',
  'nps_received',
  'daily_summary',
  'next_day_agenda',
  'ia_handoff',
  'system',
];

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(`n8n-push:${ip}`, { max: 200, windowMs: 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, message: 'rate_limited', retry_after: rl.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    );
  }

  const expected = process.env.N8N_TO_VERCEL_TOKEN;
  if (!expected) {
    return NextResponse.json({ success: false, message: 'server_misconfigured' }, { status: 500 });
  }
  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ success: false, message: 'unauthorized' }, { status: 401 });
  }

  let body: NotifyBody;
  try {
    body = (await req.json()) as NotifyBody;
  } catch {
    return NextResponse.json({ success: false, message: 'JSON inválido' }, { status: 400 });
  }

  if (!body.type || !ALLOWED_TYPES.includes(body.type)) {
    return NextResponse.json({ success: false, message: 'type inválido' }, { status: 400 });
  }
  if (!body.title || !body.body) {
    return NextResponse.json({ success: false, message: 'title e body obrigatórios' }, { status: 400 });
  }
  if (!body.tenant_id && !body.user_id) {
    return NextResponse.json({ success: false, message: 'tenant_id ou user_id obrigatório' }, { status: 400 });
  }

  const payload: PushPayload = {
    type: body.type,
    title: body.title.slice(0, 100),
    body: body.body.slice(0, 280),
    url: body.url,
    priority: body.priority,
    tag: body.tag,
    data: body.data,
  };

  if (body.user_id) {
    const r = await sendPushToUser(body.user_id, body.tenant_id ?? null, payload);
    return NextResponse.json({ success: true, scope: 'user', ...r });
  }

  const r = await sendPushToTenant(body.tenant_id!, payload);
  return NextResponse.json({ success: true, scope: 'tenant', ...r });
}
