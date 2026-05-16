// app/app/api/painel/vitrine/route.ts
//
// CRUD da pagina publica /p/[slug] do medico (vitrine_profiles) a partir
// do painel. GET retorna o profile do tenant ativo; PATCH atualiza campos
// editaveis + publish toggle. Quando passa de unpublished -> published pela
// primeira vez, grava lgpd_consent_at (consentimento LGPD).

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenant } from '@/lib/auth-tenant';
import {
  slugifyVitrine,
  parseAddressForVitrine,
  normalizeProfessionalType,
  ensureUniqueVitrineSlug,
} from '@/lib/vitrine-onboarding';

const MAX_BIO_LENGTH = 500;
const MAX_DISPLAY_NAME_LENGTH = 120;
const MAX_CITY_LENGTH = 80;
const MAX_FAQS = 10;
const MAX_FAQ_Q_LENGTH = 200;
const MAX_FAQ_A_LENGTH = 600;

function sanitizeFaqs(input: unknown): { ok: true; faqs: Array<{ q: string; a: string }> } | { ok: false; error: string } {
  if (!Array.isArray(input)) return { ok: false, error: 'FAQs deve ser uma lista.' };
  if (input.length > MAX_FAQS) return { ok: false, error: `Maximo de ${MAX_FAQS} FAQs.` };
  const cleaned: Array<{ q: string; a: string }> = [];
  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const q = typeof obj.q === 'string' ? obj.q.trim().slice(0, MAX_FAQ_Q_LENGTH) : '';
    const a = typeof obj.a === 'string' ? obj.a.trim().slice(0, MAX_FAQ_A_LENGTH) : '';
    if (q && a) cleaned.push({ q, a });
  }
  return { ok: true, faqs: cleaned };
}

// Tenant pode publicar a vitrine se tem addon_marketing OU plan_type =
// 'enterprise' (enterprise inclui marketing por padrao).
function canPublishVitrine(tenant: { plan_type?: string | null; addon_marketing?: boolean | null }): boolean {
  if (tenant?.addon_marketing === true) return true;
  if (tenant?.plan_type === 'enterprise') return true;
  return false;
}

export async function GET() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const tenantId = auth.ctx.tenant.tenant_id;

  const supabase = supabaseAdmin();

  // Carrega flags de billing pra UI saber se pode publicar
  const { data: tenantBilling } = await supabase
    .from('tenants')
    .select('plan_type, addon_marketing, subscription_status')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const billing = {
    plan_type: tenantBilling?.plan_type ?? null,
    addon_marketing: tenantBilling?.addon_marketing ?? false,
    subscription_status: tenantBilling?.subscription_status ?? null,
    can_publish: canPublishVitrine(tenantBilling ?? {}),
  };

  const { data: existing } = await supabase
    .from('vitrine_profiles')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  // Se o tenant nao tem vitrine ainda (criado antes desse feature), cria on-demand.
  if (!existing) {
    const { data: tenantRow } = await supabase
      .from('tenants')
      .select('doctor_name, speciality, address')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (!tenantRow?.doctor_name || !tenantRow?.speciality) {
      return NextResponse.json({
        success: false,
        message: 'Dados do tenant incompletos pra criar pagina publica. Complete o cadastro primeiro.',
      }, { status: 422 });
    }

    const { city, state } = parseAddressForVitrine(tenantRow.address);
    const slugBase = slugifyVitrine(
      [tenantRow.doctor_name, tenantRow.speciality, city].filter(Boolean).join(' ')
    );
    const finalSlug = await ensureUniqueVitrineSlug(supabase, slugBase);

    const { data: created, error } = await supabase
      .from('vitrine_profiles')
      .insert({
        tenant_id: tenantId,
        slug: finalSlug,
        display_name: tenantRow.doctor_name,
        professional_type: 'medico',
        specialty: tenantRow.speciality,
        city: city || 'Sao Paulo',
        state: state || 'SP',
        bio: null,
        photo_url: null,
        published: false,
      })
      .select('*')
      .single();

    if (error) {
      console.error('[painel/vitrine] erro ao criar profile on-demand:', error);
      return NextResponse.json({ success: false, message: 'Erro ao criar pagina publica.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, profile: created, billing });
  }

  return NextResponse.json({ success: true, profile: existing, billing });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const tenantId = auth.ctx.tenant.tenant_id;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'JSON invalido.' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data: current, error: loadErr } = await supabase
    .from('vitrine_profiles')
    .select('id, published, lgpd_consent_at, slug')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (loadErr) {
    console.error('[painel/vitrine] erro ao carregar profile:', loadErr);
    return NextResponse.json({ success: false, message: 'Erro ao carregar pagina.' }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ success: false, message: 'Pagina nao existe ainda. Faca GET primeiro.' }, { status: 404 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.display_name === 'string') {
    const v = body.display_name.trim();
    if (!v) return NextResponse.json({ success: false, message: 'Nome nao pode ser vazio.' }, { status: 400 });
    updates.display_name = v.slice(0, MAX_DISPLAY_NAME_LENGTH);
  }
  if (typeof body.bio === 'string') {
    updates.bio = body.bio.trim().slice(0, MAX_BIO_LENGTH) || null;
  }
  if (typeof body.photo_url === 'string') {
    const v = body.photo_url.trim();
    if (v && !/^https?:\/\//i.test(v)) {
      return NextResponse.json({ success: false, message: 'URL da foto deve comecar com http(s)://' }, { status: 400 });
    }
    updates.photo_url = v || null;
  }
  if (typeof body.specialty === 'string') {
    const v = body.specialty.trim();
    if (!v) return NextResponse.json({ success: false, message: 'Especialidade nao pode ser vazia.' }, { status: 400 });
    updates.specialty = v;
  }
  if (typeof body.professional_type === 'string') {
    updates.professional_type = normalizeProfessionalType(body.professional_type);
  }
  if (typeof body.city === 'string') {
    const v = body.city.trim();
    if (!v) return NextResponse.json({ success: false, message: 'Cidade nao pode ser vazia.' }, { status: 400 });
    updates.city = v.slice(0, MAX_CITY_LENGTH);
  }
  if (typeof body.state === 'string') {
    const v = body.state.trim().toUpperCase().slice(0, 2);
    if (v.length === 2) updates.state = v;
  }

  // FAQs editaveis. Aceita array vazio (limpar).
  if ('faqs' in body) {
    const r = sanitizeFaqs(body.faqs);
    if (!r.ok) return NextResponse.json({ success: false, message: r.error }, { status: 400 });
    updates.faqs = r.faqs;
  }

  // Publish toggle: opt-in explicito. Grava consent_at na primeira publicacao.
  // Gate: publicacao exige addon_marketing OU plan_type=enterprise.
  if (typeof body.published === 'boolean') {
    if (body.published) {
      const { data: tenantBilling } = await supabase
        .from('tenants')
        .select('plan_type, addon_marketing')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (!canPublishVitrine(tenantBilling ?? {})) {
        return NextResponse.json(
          {
            success: false,
            error: 'addon_marketing_required',
            message: 'Ative o add-on de Marketing pra publicar sua pagina e ranquear no Google.',
            upsell_url: '/painel/planos',
          },
          { status: 402 },
        );
      }
    }
    updates.published = body.published;
    // Ao re-publicar, limpa o motivo da despublicacao automatica anterior
    if (body.published) {
      updates.unpublished_reason = null;
    }
    if (body.published && !current.lgpd_consent_at) {
      updates.lgpd_consent_at = new Date().toISOString();
      updates.lgpd_consent_ip =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        null;
    }
  }

  const { data: updated, error: updErr } = await supabase
    .from('vitrine_profiles')
    .update(updates)
    .eq('id', current.id)
    .select('*')
    .single();

  if (updErr) {
    console.error('[painel/vitrine] erro ao atualizar profile:', updErr);
    return NextResponse.json({ success: false, message: 'Erro ao salvar.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, profile: updated });
}
