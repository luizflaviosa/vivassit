// app/app/api/painel/vitrine/regenerate/route.ts
//
// POST { kind: 'bio' | 'faqs' | 'both' }
// Regenera bio e/ou FAQs do vitrine_profile do tenant ativo usando o helper
// app/lib/vitrine-ai.ts. Atualiza ai_generated_at apenas se algo for gerado
// com sucesso. NAO publica nem despublica — so reescreve o conteudo.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenant } from '@/lib/auth-tenant';
import { generateVitrineBio, generateVitrineFaqs, aiAvailable } from '@/lib/vitrine-ai';

type Kind = 'bio' | 'faqs' | 'both';

export async function POST(request: NextRequest) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const tenantId = auth.ctx.tenant.tenant_id;

  if (!aiAvailable()) {
    return NextResponse.json(
      {
        success: false,
        message: 'IA nao configurada no servidor. Avise o suporte.',
        error_code: 'no_ai_key',
      },
      { status: 503 },
    );
  }

  let body: { kind?: Kind };
  try {
    body = (await request.json()) as { kind?: Kind };
  } catch {
    body = {};
  }
  const kind: Kind = body.kind === 'bio' || body.kind === 'faqs' || body.kind === 'both' ? body.kind : 'both';

  const supabase = supabaseAdmin();
  const { data: profile, error: loadErr } = await supabase
    .from('vitrine_profiles')
    .select('id, display_name, specialty, professional_type, city, state')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (loadErr) {
    console.error('[regenerate] load profile error:', loadErr);
    return NextResponse.json({ success: false, message: 'Erro ao carregar pagina publica.' }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json(
      { success: false, message: 'Pagina publica nao existe. Acesse /painel/vitrine pra criar.' },
      { status: 404 },
    );
  }

  // establishment_type vem do tenants (a vitrine nao guarda)
  const { data: tenantRow } = await supabase
    .from('tenants')
    .select('establishment_type')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const aiInput = {
    doctor_name: profile.display_name,
    specialty: profile.specialty,
    professional_type: profile.professional_type,
    city: profile.city,
    state: profile.state,
    establishment_type: tenantRow?.establishment_type ?? null,
  };

  const tasks: Array<Promise<unknown>> = [];
  if (kind === 'bio' || kind === 'both') tasks.push(generateVitrineBio(aiInput));
  if (kind === 'faqs' || kind === 'both') tasks.push(generateVitrineFaqs(aiInput));

  const results = await Promise.allSettled(tasks);

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  let bioOk = false;
  let faqsOk = false;
  const errors: string[] = [];

  let idx = 0;
  if (kind === 'bio' || kind === 'both') {
    const r = results[idx++];
    if (r.status === 'fulfilled') {
      const v = r.value as Awaited<ReturnType<typeof generateVitrineBio>>;
      if (v.data) {
        updates.bio = v.data;
        bioOk = true;
      } else if (v.error) {
        errors.push(`bio: ${v.error}`);
      }
    } else {
      errors.push(`bio: ${r.reason instanceof Error ? r.reason.message : 'erro desconhecido'}`);
    }
  }
  if (kind === 'faqs' || kind === 'both') {
    const r = results[idx++];
    if (r.status === 'fulfilled') {
      const v = r.value as Awaited<ReturnType<typeof generateVitrineFaqs>>;
      if (v.data) {
        updates.faqs = v.data;
        faqsOk = true;
      } else if (v.error) {
        errors.push(`faqs: ${v.error}`);
      }
    } else {
      errors.push(`faqs: ${r.reason instanceof Error ? r.reason.message : 'erro desconhecido'}`);
    }
  }

  if (!bioOk && !faqsOk) {
    return NextResponse.json(
      {
        success: false,
        message: 'IA falhou ao gerar conteudo. Tente novamente em alguns instantes.',
        errors,
      },
      { status: 502 },
    );
  }

  updates.ai_generated_at = new Date().toISOString();

  const { data: updated, error: updErr } = await supabase
    .from('vitrine_profiles')
    .update(updates)
    .eq('id', profile.id)
    .select('*')
    .single();

  if (updErr) {
    console.error('[regenerate] update error:', updErr);
    return NextResponse.json({ success: false, message: 'Erro ao salvar conteudo gerado.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    profile: updated,
    generated: { bio: bioOk, faqs: faqsOk },
    errors,
  });
}
