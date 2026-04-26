import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  // Cria response que vai ser modificado conforme cookies sao definidos
  let supabaseResponse = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANTE: nao executar nenhuma logica entre createServerClient e getUser
  const { data: { user } } = await supabase.auth.getUser();

  const path = req.nextUrl.pathname;
  const isPainel = path.startsWith('/painel');
  const isLogin = path === '/login';

  // Sem session em rota protegida → /login
  if (isPainel && !user) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', path + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  // Com session em /login → painel
  if (isLogin && user) {
    const url = req.nextUrl.clone();
    url.pathname = '/painel';
    url.searchParams.delete('next');
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Aplica em todas rotas EXCETO assets e API auth callback
    '/((?!_next/static|_next/image|favicon.ico|api/auth|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
