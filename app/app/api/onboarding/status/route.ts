import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenant_id');
  if (!tenantId || !/^[a-z0-9-]{3,80}$/.test(tenantId)) {
    return NextResponse.json({ error: 'invalid tenant_id' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase
    .from('tenants')
    .select('evolution_status, evolution_pairing_code, evolution_qr_code')
    .eq('tenant_id', tenantId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  return NextResponse.json({
    evolution_status: data.evolution_status ?? 'unknown',
    has_pairing_code: !!data.evolution_pairing_code,
    has_qr_code: !!data.evolution_qr_code,
  });
}
