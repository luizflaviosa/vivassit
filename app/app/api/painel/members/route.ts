import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenant } from '@/lib/auth-tenant';

// GET: lista membros do tenant ativo + convites pendentes
// POST: convida novo membro (cria row com user_id=NULL, status=invited)
// DELETE: desativa membership (soft delete)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = ['owner', 'admin', 'doctor', 'staff', 'viewer'] as const;
type Role = typeof VALID_ROLES[number];

function isOwnerOrAdmin(role: string): boolean {
  return role === 'owner' || role === 'admin';
}

export async function GET() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('tenant_members')
    .select('id, user_id, invited_email, role, doctor_id, telegram_chat_id, status, invited_at, accepted_at, created_at')
    .eq('tenant_id', auth.ctx.tenant.tenant_id)
    .neq('status', 'disabled')
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // Resolve emails dos members ativos via auth.users
  const userIds = (data ?? []).map((m) => m.user_id).filter((x): x is string => !!x);
  let userMap = new Map<string, string>();
  if (userIds.length) {
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 });
    userMap = new Map(
      (users?.users ?? [])
        .filter((u) => userIds.includes(u.id))
        .map((u) => [u.id, u.email ?? ''])
    );
  }

  const members = (data ?? []).map((m) => ({
    ...m,
    email: m.user_id ? (userMap.get(m.user_id) ?? '') : (m.invited_email ?? ''),
  }));

  return NextResponse.json({
    success: true,
    members,
    your_role: auth.ctx.member.role,
  });
}

interface InviteBody {
  email?: string;
  role?: string;
  doctor_id?: string | null;
  telegram_chat_id?: string | null;
}

export async function POST(req: NextRequest) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  if (!isOwnerOrAdmin(auth.ctx.member.role)) {
    return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as InviteBody;
  const email = body.email?.trim().toLowerCase();
  const role = (body.role ?? 'doctor') as Role;

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ success: false, error: 'invalid_email' }, { status: 400 });
  }
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ success: false, error: 'invalid_role' }, { status: 400 });
  }
  if (role === 'owner') {
    // owner é único por tenant — só transferível, não convidável
    return NextResponse.json({ success: false, error: 'cannot_invite_owner' }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // Verifica se já existe membership ou convite com esse email no tenant
  const { data: existing } = await admin
    .from('tenant_members')
    .select('id, status')
    .eq('tenant_id', auth.ctx.tenant.tenant_id)
    .eq('invited_email', email)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ success: false, error: 'already_invited' }, { status: 409 });
  }

  // Tenta resolver user_id se já existe na auth (gente que já tem conta)
  let userId: string | null = null;
  try {
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 });
    const u = (users?.users ?? []).find((x) => x.email?.toLowerCase() === email);
    if (u) userId = u.id;
  } catch {
    // ignora — convite fica pendente até user logar pela 1ª vez
  }

  const { data: created, error } = await admin
    .from('tenant_members')
    .insert({
      tenant_id: auth.ctx.tenant.tenant_id,
      user_id: userId,
      invited_email: email,
      role,
      doctor_id: body.doctor_id ?? null,
      telegram_chat_id: body.telegram_chat_id ?? null,
      status: userId ? 'active' : 'invited',
      invited_by: auth.ctx.user.id,
      invited_at: new Date().toISOString(),
      accepted_at: userId ? new Date().toISOString() : null,
    })
    .select('id, status')
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, member: created });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  if (!isOwnerOrAdmin(auth.ctx.member.role)) {
    return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const memberId = url.searchParams.get('id');
  if (!memberId) {
    return NextResponse.json({ success: false, error: 'missing_id' }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: target } = await admin
    .from('tenant_members')
    .select('id, role, user_id')
    .eq('id', memberId)
    .eq('tenant_id', auth.ctx.tenant.tenant_id)
    .maybeSingle();

  if (!target) return NextResponse.json({ success: false, error: 'not_found' }, { status: 404 });
  if (target.role === 'owner') {
    return NextResponse.json({ success: false, error: 'cannot_remove_owner' }, { status: 400 });
  }
  if (target.user_id === auth.ctx.user.id) {
    return NextResponse.json({ success: false, error: 'cannot_remove_self' }, { status: 400 });
  }

  await admin
    .from('tenant_members')
    .update({ status: 'disabled' })
    .eq('id', memberId);

  return NextResponse.json({ success: true });
}
