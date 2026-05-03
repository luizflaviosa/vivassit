import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenant_id');
  if (!tenantId || !/^[a-z0-9-]{3,80}$/.test(tenantId)) {
    return NextResponse.json(
      { error: 'invalid tenant_id' },
      { status: 400, headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      global: { fetch: (url, init) => fetch(url, { ...init, cache: 'no-store' }) },
    },
  );

  const { data, error } = await supabase
    .from('tenants')
    .select('evolution_status, evolution_pairing_code, evolution_qr_code, evolution_qr_string, evolution_phone_number, doctor_name, clinic_name')
    .eq('tenant_id', tenantId)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: 'not found' },
      { status: 404, headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  }

  return NextResponse.json(
    {
      evolution_status: data.evolution_status ?? 'unknown',
      evolution_pairing_code: data.evolution_pairing_code ?? null,
      evolution_qr_code: data.evolution_qr_code ?? null,
      evolution_qr_string: data.evolution_qr_string ?? null,
      evolution_phone_number: data.evolution_phone_number ?? null,
      doctor_name: data.doctor_name ?? null,
      clinic_name: data.clinic_name ?? null,
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'CDN-Cache-Control': 'no-store',
        'Vercel-CDN-Cache-Control': 'no-store',
      },
    },
  );
}
