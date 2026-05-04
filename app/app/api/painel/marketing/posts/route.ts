import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenant } from '@/lib/auth-tenant';

export const runtime = 'edge';

export async function GET(req: Request) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const tenantId = auth.ctx.tenant.tenant_id;

  const supabase = supabaseAdmin();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'pending_approval';
  const platform = searchParams.get('platform');
  const limit = parseInt(searchParams.get('limit') || '20');

  let query = supabase
    .from('tenant_posts')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status !== 'all') query = query.eq('status', status);
  if (platform) query = query.eq('platform', platform);

  const { data: posts, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ posts: posts || [], total: posts?.length || 0 });
}
