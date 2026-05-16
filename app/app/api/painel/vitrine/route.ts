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

export async function GET() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const tenantId = auth.ctx.tenant.tenant_id;

  const supabase = supabaseAdmin();
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

    return NextResponse.json({ success: true, profile: created });
  }

  return NextResponse.json({ success: true, profile: existing });
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

  // Publish toggle: opt-in explicito. Grava consent_at na primeira publicacao.
  if (typeof body.published === 'boolean') {
    updates.published = body.published;
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
