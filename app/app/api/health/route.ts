import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Health check publico - usado por uptime monitors (UptimeRobot, etc)
// Retorna 200 se app+db OK, 503 se algum subsistema falhar.

export async function GET() {
  const checks: Record<string, { ok: boolean; latency_ms?: number; error?: string }> = {};

  // App responding (trivial)
  checks.app = { ok: true };

  // Supabase
  const t0 = Date.now();
  try {
    const admin = supabaseAdmin();
    const { error } = await admin.from('tenants').select('tenant_id', { count: 'exact', head: true });
    checks.supabase = error
      ? { ok: false, error: error.message, latency_ms: Date.now() - t0 }
      : { ok: true, latency_ms: Date.now() - t0 };
  } catch (e) {
    checks.supabase = {
      ok: false,
      error: e instanceof Error ? e.message : 'unknown',
      latency_ms: Date.now() - t0,
    };
  }

  // Asaas (simples ping no /finance/balance)
  const a0 = Date.now();
  try {
    const url = process.env.ASAAS_API_URL?.replace(/\/$/, '') || 'https://sandbox.asaas.com/api/v3';
    const res = await fetch(`${url}/finance/balance`, {
      headers: { access_token: process.env.ASAAS_API_KEY ?? '' },
      signal: AbortSignal.timeout(5000),
    });
    checks.asaas = {
      ok: res.ok,
      latency_ms: Date.now() - a0,
      ...(res.ok ? {} : { error: `HTTP ${res.status}` }),
    };
  } catch (e) {
    checks.asaas = {
      ok: false,
      error: e instanceof Error ? e.message : 'unknown',
      latency_ms: Date.now() - a0,
    };
  }

  const allOk = Object.values(checks).every((c) => c.ok);

  return NextResponse.json(
    {
      status: allOk ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allOk ? 200 : 503 }
  );
}
