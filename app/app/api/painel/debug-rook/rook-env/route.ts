import { NextResponse } from 'next/server';
import { requireTenant, type MemberRole } from '@/lib/auth-tenant';

const DEBUG_ROLES: MemberRole[] = ['owner', 'admin'];

// Diagnostico: confirma se ROOK_CLIENT_UUID e ROOK_API_KEY estao
// presentes no runtime. Nao retorna os valores - so flags booleanas.
export async function GET() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  if (!DEBUG_ROLES.includes(auth.ctx.member.role)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    ok: true,
    rook_client_uuid_set: typeof process.env.ROOK_CLIENT_UUID === 'string' && process.env.ROOK_CLIENT_UUID.length > 0,
    rook_api_key_set: typeof process.env.ROOK_API_KEY === 'string' && process.env.ROOK_API_KEY.length > 0,
    rook_api_url_set: typeof process.env.ROOK_API_URL === 'string' && process.env.ROOK_API_URL.length > 0,
    rook_connections_base_url_set: typeof process.env.ROOK_CONNECTIONS_BASE_URL === 'string' && process.env.ROOK_CONNECTIONS_BASE_URL.length > 0,
    rook_client_uuid_prefix: process.env.ROOK_CLIENT_UUID?.slice(0, 8) ?? null,
    rook_api_key_prefix: process.env.ROOK_API_KEY?.slice(0, 6) ?? null,
    evolution_base_url_set: typeof process.env.EVOLUTION_BASE_URL === 'string' && process.env.EVOLUTION_BASE_URL.length > 0,
    evolution_api_key_set: typeof process.env.EVOLUTION_API_KEY === 'string' && process.env.EVOLUTION_API_KEY.length > 0,
    evolution_base_url_prefix: process.env.EVOLUTION_BASE_URL?.slice(0, 30) ?? null,
  });
}
