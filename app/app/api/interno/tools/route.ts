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
  if (!expected) {
    console.log('[verifyAuth] env N8N_TO_VERCEL_TOKEN not set');
    return false;
  }
  const auth = (req.headers.get('authorization') ?? '').trim();
  const expectedFull = `Bearer ${expected}`;
  const ok = auth === expectedFull;
  if (!ok) {
    // Loga prefixos+sufixos pra comparar sem expor o token inteiro
    console.log(
      '[verifyAuth] MISMATCH',
      JSON.stringify({
        expected_prefix: expectedFull.slice(0, 12),
        expected_suffix: expectedFull.slice(-6),
        expected_len: expectedFull.length,
        received_prefix: auth.slice(0, 12),
        received_suffix: auth.slice(-6),
        received_len: auth.length,
      })
    );
  }
  return ok;
}

function authDiag(req: NextRequest) {
  const expected = process.env.N8N_TO_VERCEL_TOKEN?.trim();
  const auth = (req.headers.get('authorization') ?? '').trim();
  const d = {
    expected_prefix12: `Bearer ${expected}`.slice(0, 12),
    expected_suffix6: `Bearer ${expected}`.slice(-6),
    expected_len: `Bearer ${expected}`.length,
    received_prefix12: auth.slice(0, 12),
    received_suffix6: auth.slice(-6),
    received_len: auth.length,
    starts_with_bearer: auth.startsWith('Bearer '),
  };
  // Persiste em tabela pra leitura via SQL (vence truncamento de logs Vercel)
  try {
    const { supabaseAdmin } = require('@/lib/supabase');
    void Promise.resolve(supabaseAdmin().from('auth_diag_log').insert(d)).catch(() => {});
  } catch {}
  return d;
}

// ── GET → manifest ───────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized', diag: authDiag(req) }, { status: 401 });
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
    return NextResponse.json({ ok: false, error: 'unauthorized', diag: authDiag(req) }, { status: 401 });
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

  const mode = body.mode ?? 'propose';

  try {
    // ── WRITE: propose vs execute ────────────────────────────
    if (tool.mode === 'write') {
      const wh = getWriteHandler(tool.name);
      if (!wh) {
        return NextResponse.json({ ok: false, error: 'handler_missing' }, { status: 500 });
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
      return NextResponse.json({ ok: false, error: 'handler_missing' }, { status: 500 });
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
    return NextResponse.json(
      { ok: false, tool: tool.name, error: 'handler_error', message: msg },
      { status: 500 }
    );
  }
}
