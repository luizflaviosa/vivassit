import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenant } from '@/lib/auth-tenant';

export const runtime = 'edge';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const tenantId = auth.ctx.tenant.tenant_id;

  const supabase = supabaseAdmin();
  const body = await req.json();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.action === 'approve') {
    updates.status = 'approved';
    updates.approved_at = new Date().toISOString();
  } else if (body.action === 'reject') {
    updates.status = 'rejected';
    updates.rejection_reason = body.reason || '';
  } else if (body.action === 'edit') {
    if (body.post_text) updates.post_text = body.post_text;
    if (body.hashtags) updates.hashtags = body.hashtags;
  }

  const { data, error } = await supabase
    .from('tenant_posts')
    .update(updates)
    .eq('id', params.id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.action === 'approve' && data) {
    try {
      await fetch(`${process.env.N8N_BASE_URL}/webhook/publish-post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_id: data.id,
          tenant_id: tenantId,
          platform: data.platform,
          post_text: data.post_text,
          post_image_url: data.post_image_url,
          hashtags: data.hashtags,
        }),
      });
    } catch (e) {
      console.error('Failed to trigger n8n publish:', e);
    }
  }

  return NextResponse.json({ post: data });
}
