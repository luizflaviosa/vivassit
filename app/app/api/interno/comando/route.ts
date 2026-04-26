import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

// EDGE RUNTIME: cold start ~50ms vs 500ms+ Node. Critical pra UX
// estilo Telegram (resposta sub-segundo).
export const runtime = 'edge';

interface RequestBody {
  message: string;
  history?: Array<{ role: 'user' | 'ai'; text: string }>;
  doctor_id?: string | null;
}

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response('JSON inválido', { status: 400 });
  }

  if (!body.message?.trim()) {
    return new Response('Mensagem vazia', { status: 400 });
  }

  // ── Auth lite via session cookie (Edge-compatible) ──────────────────────
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll() {
          // no-op: Edge route response nao seta cookies aqui
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return new Response('unauthorized', { status: 401 });
  }

  // ── Lookup tenant (admin client, Edge-compatible) ───────────────────────
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: tenants } = await admin
    .from('tenants')
    .select('tenant_id, clinic_name, admin_email')
    .or(`admin_user_id.eq.${user.id},admin_email.eq.${user.email}`)
    .order('created_at', { ascending: false })
    .limit(1);

  const tenant = tenants?.[0];
  if (!tenant) {
    return new Response('tenant_not_found', { status: 404 });
  }

  // ── Encaminha pro N8N (workflow "6. Assistente Interno") ────────────────
  const n8nUrl = process.env.N8N_INTERNAL_AGENT_URL;
  if (!n8nUrl) {
    // Fallback amigavel: workflow nao configurado ainda
    const fallbackText =
      'Estou em modo manutenção. Use seu bot Telegram por enquanto. Em breve vou estar disponível por aqui.';
    return streamText(fallbackText);
  }

  // Prepara payload pro N8N
  const payload = {
    source: 'web',
    tenant_id: tenant.tenant_id,
    clinic_name: tenant.clinic_name,
    user_email: user.email,
    user_id: user.id,
    doctor_id: body.doctor_id ?? null,
    message: body.message.trim(),
    history: (body.history ?? []).slice(-10),
    timestamp: new Date().toISOString(),
  };

  // Tenta streaming response do N8N. Fallback: response completa.
  try {
    const upstream = await fetch(n8nUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream, application/json',
        'X-Vivassit-Source': 'web',
        'X-Vivassit-Tenant': tenant.tenant_id,
      },
      body: JSON.stringify(payload),
    });

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '');
      console.error('[interno/comando] N8N erro:', upstream.status, errText.slice(0, 200));
      return streamText(
        `Não consegui responder agora (${upstream.status}). Tenta de novo ou usa o Telegram.`
      );
    }

    const contentType = upstream.headers.get('content-type') ?? '';

    // Caso A: N8N retorna streaming nativo
    if (contentType.includes('text/event-stream') || contentType.includes('text/plain')) {
      return new Response(upstream.body, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    // Caso B: N8N retorna JSON { reply: "..." } ou { output: "..." } ou string
    const text = await upstream.text();
    let reply = text;
    try {
      const json = JSON.parse(text);
      reply =
        json.reply ??
        json.output ??
        json.message ??
        json.text ??
        json.response ??
        (typeof json === 'string' ? json : JSON.stringify(json));
    } catch {
      // text/plain ou raw - usa direto
    }

    return streamText(reply);
  } catch (e) {
    console.error('[interno/comando] erro:', e);
    return streamText('Tive um problema técnico. Tenta de novo em alguns segundos.');
  }
}

// Stream texto chunked pra simular typing (mesma UX do streaming real)
function streamText(text: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Quebra em palavras pra streaming visual
      const words = text.split(' ');
      for (const word of words) {
        controller.enqueue(encoder.encode(word + ' '));
        await new Promise((r) => setTimeout(r, 25)); // 25ms entre palavras (ajustavel)
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
