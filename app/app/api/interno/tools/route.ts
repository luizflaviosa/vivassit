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
import { getHandler, getWriteHandler } from '@/lib/internal-agent-handlers';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs'; // precisa de pg / supabase admin
export const dynamic = 'force-dynamic';

function verifyAuth(req: NextRequest): boolean {
  // .trim() defensivo: env var pode ter \n no fim por copy-paste no Vercel.
  const expected = process.env.N8N_TO_VERCEL_TOKEN?.trim();
  if (!expected) return false;
  const auth = (req.headers.get('authorization') ?? '').trim();
  return auth === `Bearer ${expected}`;
}

// Loga e retorna a resposta de erro com shape preservado.
// Sem PII: registra apenas chaves do body / nomes de params, nunca valores.
function rejectWith(
  status: number,
  error: string,
  ctx: Record<string, unknown> = {}
) {
  console.error('[interno/tools] reject:', { status, error, ...ctx });
  return NextResponse.json({ ok: false, error, ...ctx }, { status });
}

// ── GET → manifest ───────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) {
    return rejectWith(401, 'unauthorized', { route: 'GET /interno/tools' });
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
  /**
   * Para tools mode='write':
   *   - 'propose' (default) → retorna ActionCard, sem mutação
   *   - 'execute' → executa a mutação. Frontend só usa após user clicar Confirmar.
   * Reads ignoram este flag.
   */
  mode?: 'propose' | 'execute';
}

export async function POST(req: NextRequest) {
  if (!verifyAuth(req)) {
    return rejectWith(401, 'unauthorized');
  }

  let body: ExecuteBody;
  try {
    body = (await req.json()) as ExecuteBody;
  } catch {
    return rejectWith(400, 'invalid_json');
  }

  const bodyKeys = Object.keys(body ?? {});
  const { tool: toolName, params = {}, tenant_id, user_id, role } = body;
  if (!toolName) return rejectWith(400, 'missing_tool', { body_keys: bodyKeys });
  if (!tenant_id) return rejectWith(400, 'missing_tenant_id', { tool: toolName, body_keys: bodyKeys });
  if (!user_id) return rejectWith(400, 'missing_user_id', { tool: toolName });
  if (!role) return rejectWith(400, 'missing_role', { tool: toolName, tenant_id });

  const tool = getToolDef(toolName);
  if (!tool) {
    return rejectWith(404, `tool_not_found: ${toolName}`, { tool: toolName });
  }

  // RBAC
  if (!roleHasAccess(role, tool.min_role)) {
    return rejectWith(403, 'forbidden', {
      tool: tool.name,
      role,
      min_role: tool.min_role,
      message: `Tool '${tool.name}' requer role ≥ ${tool.min_role}. Você é ${role}.`,
    });
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
    return rejectWith(403, 'membership_not_found', { tool: tool.name, tenant_id });
  }

  // Validate params
  const paramErr = validateParams(tool, params);
  if (paramErr) {
    return rejectWith(400, 'invalid_params', {
      tool: tool.name,
      message: paramErr,
      params_keys: Object.keys(params ?? {}),
    });
  }

  const mode = body.mode ?? 'propose';

  try {
    // ── WRITE: propose vs execute ────────────────────────────
    if (tool.mode === 'write') {
      const wh = getWriteHandler(tool.name);
      if (!wh) {
        return rejectWith(500, 'handler_missing', { tool: tool.name, mode: 'write' });
      }
      const result =
        mode === 'execute'
          ? await wh.execute(params, { tenant_id, user_id, role })
          : await wh.propose(params, { tenant_id, user_id, role });

      // Audit log
      void Promise.resolve(
        admin.from('tenant_activity_logs').insert({
          tenant_id,
          activity_type: `agent_tool:${tool.name}:${mode}`,
          activity_data: { params, ok: result.ok, user_id, role },
          status: result.ok ? 'success' : 'failed',
          error_message: result.error ?? null,
          created_at: new Date().toISOString(),
        })
      ).catch(() => {});

      return NextResponse.json({
        ok: result.ok,
        tool: tool.name,
        mode,
        type: mode === 'propose' && (result as { card?: unknown }).card ? 'action_proposal' : 'action_result',
        summary: result.summary,
        data: result.data,
        card: (result as { card?: unknown }).card,
        error: result.error,
      });
    }

    // ── READ ────────────────────────────────────────────────
    const handler = getHandler(tool.name);
    if (!handler) {
      return rejectWith(500, 'handler_missing', { tool: tool.name, mode: 'read' });
    }
    const result = await handler(params, { tenant_id, user_id, role });

    void Promise.resolve(
      admin.from('tenant_activity_logs').insert({
        tenant_id,
        activity_type: `agent_tool:${tool.name}`,
        activity_data: { params, ok: result.ok, user_id, role },
        status: result.ok ? 'success' : 'failed',
        error_message: result.error ?? null,
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
    const msg = (e as Error).message;
    return rejectWith(500, 'handler_error', { tool: tool.name, message: msg });
  }
}
