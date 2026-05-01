import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase';

// Bypass de OTP pra contas pré-aprovadas (demo + early adopters reais).
// Usado pra acesso direto sem precisar abrir email — útil pra demos ao vivo
// e pra usuárias que pediram explicitamente pra pular OTP (ex.: Dra. Paula).
//
// Como funciona:
//   1. Verifica que body.email está em BYPASS_USERS
//   2. Admin gera magic link → extrai hashed_token (não envia email)
//   3. verifyOtp com o token → cria sessão real
//   4. Upsert tenant_members com tenant_id+role pré-definidos (idempotente)
//   5. Seta cookies session via @supabase/ssr → middleware reconhece login
//
// Se quiser adicionar mais alguém ao bypass, edita BYPASS_USERS aqui E também
// app/login/page.tsx (BYPASS_EMAILS).

interface BypassUser {
  tenant_id: string;
  role: 'owner' | 'admin' | 'member';
}

const BYPASS_USERS: Record<string, BypassUser> = {
  'demo@singulare.org': { tenant_id: 'demo-singulare', role: 'owner' },
  'paulafranzon@yahoo.com.br': { tenant_id: 'singulare', role: 'admin' },
};

export async function POST(req: NextRequest) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !(email in BYPASS_USERS)) {
    return NextResponse.json({ error: 'Bypass não disponível pra este email' }, { status: 403 });
  }

  const cfg = BYPASS_USERS[email];
  const admin = supabaseAdmin();

  // 1. Gera magic link como admin (não envia email — só retorna o token).
  // generateLink cria o user em auth.users automaticamente se não existir.
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (linkErr || !linkData?.properties?.hashed_token || !linkData?.user?.id) {
    console.error('[bypass-login] generateLink erro:', linkErr);
    return NextResponse.json(
      { error: linkErr?.message ?? 'Falha ao gerar link bypass' },
      { status: 500 }
    );
  }

  const tokenHash = linkData.properties.hashed_token;
  const userId = linkData.user.id;

  // 2. Garante que o user é membro do tenant (idempotente)
  const { error: memberErr } = await admin
    .from('tenant_members')
    .upsert(
      {
        tenant_id: cfg.tenant_id,
        user_id: userId,
        invited_email: email,
        role: cfg.role,
        status: 'active',
        accepted_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,user_id' }
    );
  if (memberErr) {
    console.error('[bypass-login] tenant_members upsert erro:', memberErr);
    // Não falha — pode ser que o member já exista de outra forma. Continua.
  }

  // 3. Cria response que vai receber as cookies de sessão
  let response = NextResponse.json({ success: true, redirect: '/painel' });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          response = NextResponse.json({ success: true, redirect: '/painel' });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 4. Verifica o token → seta cookies de sessão
  const { error: verifyErr } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: tokenHash,
  });
  if (verifyErr) {
    console.error('[bypass-login] verifyOtp erro:', verifyErr);
    return NextResponse.json({ error: verifyErr.message }, { status: 500 });
  }

  return response;
}
