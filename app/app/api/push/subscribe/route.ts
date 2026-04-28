import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenant } from '@/lib/auth-tenant';

interface SubscribeBody {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
  user_agent?: string;
}

export async function POST(req: Request) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => ({}))) as SubscribeBody;
  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ success: false, error: 'invalid_subscription' }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { error } = await admin
    .from('push_subscriptions')
    .upsert(
      {
        user_id: auth.ctx.user.id,
        tenant_id: auth.ctx.tenant.tenant_id,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth_secret: body.keys.auth,
        user_agent: body.user_agent ?? null,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    );

  if (error) {
    console.error('[push/subscribe] erro:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { endpoint?: string };
  if (!body.endpoint) {
    return NextResponse.json({ success: false, error: 'missing_endpoint' }, { status: 400 });
  }

  const admin = supabaseAdmin();
  await admin
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', body.endpoint)
    .eq('user_id', user.id);

  return NextResponse.json({ success: true });
}
