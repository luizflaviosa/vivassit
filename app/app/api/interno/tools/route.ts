/**
 * Dispatch endpoint pras tools do agente interno.
 *
 * Auth: Bearer N8N_TO_VERCEL_TOKEN (server-to-server, mesmo padrão de /api/n8n/push).
 *
 * GET  /api/interno/tools          → retorna catálogo (manifest pro N8N descobrir tools)
 * POST /api/interno/tools          → executa tool
 *
 * Body POST:
 *   {
 *     tool: 'agenda_periodo',
 *     params: { start: '2026-05-04', end: '2026-05-11' },
 *     tenant_id: 'demo-singulare',
 *     user_id: 'uuid',
 *     role: 'owner' | 'admin' | 'doctor' | 'staff' | 'viewer'
 *   }
 *
 * Response:
 *   { ok: true, tool, summary, data } | { ok: false, error }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  TOOL_CATALOG,
  getToolDef,
  validateParams,
  roleHasAccess,
  type AgentRole,
} from '@/lib/internal-agent-tools';
import { getHandler } from '@/lib/internal-agent-handlers';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs'; // precisa de pg / supabase admin
export const dynamic = 'force-dynamic';

function verifyAuth(req: NextRequest): boolean {
  const expected = process.env.N8N_TO_VERCEL_TOKEN;
  if (!expected) return false;
  const auth = req.headers.get('authorization') ?? '';
  return auth === `Bearer ${expected}`;
}

// ── GET → manifest ───────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    tools: TOOL_CATALOG.map((t) => ({
      name: t.name,
      description: t.description,
      mode: t.mode,
      min_role: t.min_role,
      params: t.params,
    })),
  });
}

// ── POST → execute ───────────────────────────────────────────────────
interface ExecuteBody {
  tool?: string;
  params?: Record<string, unknown>;
  tenant_id?: string;
  user_id?: string;
  role?: AgentRole;
}

export async function POST(req: NextRequest) {
  if (!verifyAuth(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: ExecuteBody;
  try {
    body = (await req.json()) as ExecuteBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const { tool: toolName, params = {}, tenant_id, user_id, role } = body;
  if (!toolName) return NextResponse.json({ ok: false, error: 'missing_tool' }, { status: 400 });
  if (!tenant_id) return NextResponse.json({ ok: false, error: 'missing_tenant_id' }, { status: 400 });
  if (!user_id) return NextResponse.json({ ok: false, error: 'missing_user_id' }, { status: 400 });
  if (!role) return NextResponse.json({ ok: false, error: 'missing_role' }, { status: 400 });

  const tool = getToolDef(toolName);
  if (!tool) {
    return NextResponse.json({ ok: false, error: `tool_not_found: ${toolName}` }, { status: 404 });
  }

  // RBAC
  if (!roleHasAccess(role, tool.min_role)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'forbidden',
        message: `Tool '${tool.name}' requer role ≥ ${tool.min_role}. Você é ${role}.`,
      },
      { status: 403 }
    );
  }

  // Sanity: confirma membership ativa
  const admin = supabaseAdmin();
  const { data: member } = await admin
    .from('tenant_members')
    .select('id, status')
    .eq('tenant_id', tenant_id)
    .eq('user_id', user_id)
    .eq('status', 'active')
    .maybeSingle();
  if (!member) {
    return NextResponse.json(
      { ok: false, error: 'membership_not_found' },
      { status: 403 }
    );
  }

  // Validate params
  const paramErr = validateParams(tool, params);
  if (paramErr) {
    return NextResponse.json({ ok: false, error: 'invalid_params', message: paramErr }, { status: 400 });
  }

  // Sprint 2 placeholder: writes ainda não implementados
  if (tool.mode === 'write') {
    return NextResponse.json({
      ok: false,
      error: 'not_implemented',
      message: `Tool de escrita '${tool.name}' será disponibilizada na próxima sprint. Por enquanto, faça pelo painel.`,
    }, { status: 501 });
  }

  // Dispatch read handler
  const handler = getHandler(tool.name);
  if (!handler) {
    return NextResponse.json({ ok: false, error: 'handler_missing' }, { status: 500 });
  }

  try {
    const result = await handler(params, { tenant_id, user_id, role });

    // Audit log (opcional, best-effort)
    admin
      .from('tenant_activity_logs')
      .insert({
        tenant_id,
        user_id,
        action: `agent_tool:${tool.name}`,
        details: { params, ok: result.ok },
        created_at: new Date().toISOString(),
      })
      .then(() => {})
      .catch(() => {}); // ignore log errors

    return NextResponse.json({
      ok: result.ok,
      tool: tool.name,
      summary: result.summary,
      data: result.data,
      error: result.error,
    });
  } catch (e) {
    const msg = (e as Error).message;
    return NextResponse.json(
      { ok: false, tool: tool.name, error: 'handler_error', message: msg },
      { status: 500 }
    );
  }
}
