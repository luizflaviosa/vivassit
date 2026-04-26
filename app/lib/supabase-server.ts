import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Server side client (RSC, Route Handlers, Server Actions)
// Le sessao do cookie httpOnly do usuario, nao o service_role.
export function createSupabaseServerClient() {
  const cookieStore = cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // RSC nao pode setar cookies; ignorado intencionalmente.
          // Em route handlers / actions funciona normalmente.
        }
      },
    },
  });
}
