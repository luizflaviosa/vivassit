// Server Component — faz fetch inicial e passa dados ja renderizados pro Client.
// First paint do /painel/performance agora chega com dados completos no HTML
// inicial, sem espera de useEffect+fetch no client. Preserva 100% da UX original
// (motion, state local, interatividade) atraves do PerformanceView Client.

import { headers, cookies } from 'next/headers';
import PerformanceView from './PerformanceView';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function fetchInternal(path: string): Promise<any | null> {
  const cookieStore = cookies();
  const headersList = headers();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
  const host = headersList.get('host') ?? 'singulare.org';
  const proto = headersList.get('x-forwarded-proto') ?? 'https';
  try {
    const res = await fetch(`${proto}://${host}${path}`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function PerformancePage() {
  // Paraleliza ambos os fetches no servidor — TTFB ainda alto, mas LCP do
  // dashboard cai drasticamente porque o HTML ja chega com dados.
  const [perf, fin] = await Promise.all([
    fetchInternal('/api/painel/performance'),
    fetchInternal('/api/painel/performance/financial-scenario'),
  ]);

  const initialData = perf?.success ? perf : null;
  const initialFinancial = fin?.ok ? fin : null;
  const initialError = !initialData
    ? (perf?.message as string | undefined) ?? null
    : null;

  return (
    <PerformanceView
      initialData={initialData}
      initialFinancial={initialFinancial}
      initialError={initialError}
    />
  );
}
