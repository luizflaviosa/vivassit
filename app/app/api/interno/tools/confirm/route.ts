/**
 * Endpoint de confirmação acionado pelo chat-drawer (cookie auth).
 *
 * Recebe { tool, params } do botão "Confirmar" da ActionCard, deriva
 * tenant_id/user_id/role do session cookie + tenant_members, e executa
 * o write handler em modo 'execute'.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-tenant';
import {
  getToolDef,
  validateParams,
  roleHasAccess,
} from '@/lib/internal-agent-tools';
import { getWriteHandler } from '@/lib/internal-agent-handlers';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const { user, tenant, member } = auth.ctx;

  let body: { tool?: string; params?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const { tool: toolName, params = {} } = body;
  if (!toolName) {
    return NextResponse.json({ ok: false, error: 'missing_tool' }, { status: 400 });
  }

  const tool = getToolDef(toolName);
  if (!tool) {
    return NextResponse.json({ ok: false, error: 'tool_not_found' }, { status: 404 });
  }
  if (tool.mode !== 'write') {
    return NextResponse.json(
      { ok: false, error: 'invalid_tool_mode', message: 'Confirm só serve pra writes' },
      { status: 400 }
    );
  }

  if (!roleHasAccess(member.role, tool.min_role)) {
    return NextResponse.json(
      { ok: false, error: 'forbidden', message: `Requer role ≥ ${tool.min_role}` },
      { status: 403 }
    );
  }

  const paramErr = validateParams(tool, params);
  if (paramErr) {
    return NextResponse.json({ ok: false, error: 'invalid_params', message: paramErr }, { status: 400 });
  }

  const wh = getWriteHandler(tool.name);
  if (!wh) {
    return NextResponse.json({ ok: false, error: 'handler_missing' }, { status: 500 });
  }

  try {
    const result = await wh.execute(params, {
      tenant_id: tenant.tenant_id,
      user_id: user.id,
      role: member.role,
    });

    // Audit log
    const admin = supabaseAdmin();
    void Promise.resolve(
      admin.from('tenant_activity_logs').insert({
        tenant_id: tenant.tenant_id,
        user_id: user.id,
        action: `agent_tool:${tool.name}:execute_via_chat`,
        details: { params, ok: result.ok },
        created_at: new Date().toISOString(),
      })
    ).catch(() => {});

    return NextResponse.json({
      ok: result.ok,
      tool: tool.name,
      summary: result.summary,
      data: result.data,
      error: result.error,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, tool: tool.name, error: 'handler_error', message: (e as Error).message },
      { status: 500 }
    );
  }
}
