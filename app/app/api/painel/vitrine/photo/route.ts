// app/app/api/painel/vitrine/photo/route.ts
//
// POST   - upload de foto pra vitrine_profiles.photo_url (multipart/form-data)
// DELETE - remove a foto atual do storage e zera photo_url
//
// Upload no bucket "vitrine-photos" (publico). Path: <tenant_id>/<timestamp>.<ext>.
// Client deve redimensionar pra max 800x800 antes (canvas API). Server impoe:
//   - <= 2 MB
//   - mime jpeg/png/webp

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenant } from '@/lib/auth-tenant';

const BUCKET = 'vitrine-photos';
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

function extFromMime(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'bin';
}

// Extrai o path dentro do bucket a partir de uma URL publica.
// Ex: https://qwy....supabase.co/storage/v1/object/public/vitrine-photos/abc/123.jpg
//     -> abc/123.jpg
function pathFromPublicUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length).split('?')[0];
}

export async function POST(request: NextRequest) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const tenantId = auth.ctx.tenant.tenant_id;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ success: false, message: 'Formulario invalido.' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, message: 'Arquivo nao enviado.' }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ success: false, message: 'Arquivo vazio.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { success: false, message: 'Foto acima de 2MB. Reduza a imagem e tente de novo.' },
      { status: 413 },
    );
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { success: false, message: 'Formato nao suportado. Use JPG, PNG ou WEBP.' },
      { status: 415 },
    );
  }

  const supabase = supabaseAdmin();

  // Pega profile pra remover foto antiga (se houver) ao terminar
  const { data: profile } = await supabase
    .from('vitrine_profiles')
    .select('id, photo_url')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json(
      { success: false, message: 'Pagina publica nao existe ainda. Acesse /painel/vitrine pra criar.' },
      { status: 404 },
    );
  }

  const ext = extFromMime(file.type);
  const path = `${tenantId}/${Date.now()}.${ext}`;

  const bytes = await file.arrayBuffer();
  const { error: uploadErr } = await supabase
    .storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: file.type,
      cacheControl: '31536000', // 1 ano
      upsert: false,
    });

  if (uploadErr) {
    console.error('[vitrine/photo] upload error:', uploadErr);
    return NextResponse.json({ success: false, message: 'Erro ao subir foto.' }, { status: 500 });
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = pub?.publicUrl;
  if (!publicUrl) {
    return NextResponse.json({ success: false, message: 'Foto enviada mas URL nao gerada.' }, { status: 500 });
  }

  const { data: updated, error: updErr } = await supabase
    .from('vitrine_profiles')
    .update({ photo_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', profile.id)
    .select('*')
    .single();

  if (updErr) {
    console.error('[vitrine/photo] update profile error:', updErr);
    // Tenta limpar o blob recem-subido pra nao deixar lixo
    await supabase.storage.from(BUCKET).remove([path]).catch(() => null);
    return NextResponse.json({ success: false, message: 'Erro ao salvar URL da foto.' }, { status: 500 });
  }

  // Remove a foto antiga (fire-and-forget)
  const oldPath = pathFromPublicUrl(profile.photo_url);
  if (oldPath && oldPath !== path) {
    supabase.storage.from(BUCKET).remove([oldPath]).catch((err) => {
      console.warn('[vitrine/photo] falha ao limpar foto antiga:', err);
    });
  }

  return NextResponse.json({ success: true, profile: updated, photo_url: publicUrl });
}

export async function DELETE() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const tenantId = auth.ctx.tenant.tenant_id;

  const supabase = supabaseAdmin();
  const { data: profile } = await supabase
    .from('vitrine_profiles')
    .select('id, photo_url')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ success: false, message: 'Pagina publica nao existe.' }, { status: 404 });
  }

  const oldPath = pathFromPublicUrl(profile.photo_url);

  const { data: updated, error: updErr } = await supabase
    .from('vitrine_profiles')
    .update({ photo_url: null, updated_at: new Date().toISOString() })
    .eq('id', profile.id)
    .select('*')
    .single();

  if (updErr) {
    return NextResponse.json({ success: false, message: 'Erro ao remover foto.' }, { status: 500 });
  }

  if (oldPath) {
    supabase.storage.from(BUCKET).remove([oldPath]).catch((err) => {
      console.warn('[vitrine/photo] falha ao remover blob:', err);
    });
  }

  return NextResponse.json({ success: true, profile: updated });
}
