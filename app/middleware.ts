import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const path = req.nextUrl.pathname;
  const isPainel = path.startsWith('/painel');
  const isLogin = path === '/login' || path.startsWith('/auth/');

  // Sem session em rota protegida → /login
  if (isPainel && !user) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', path + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  // Com session em /login → painel
  if (isLogin && user && path === '/login') {
    const url = req.nextUrl.clone();
    url.pathname = '/painel';
    url.searchParams.delete('next');
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ['/painel/:path*', '/login', '/auth/:path*'],
};
