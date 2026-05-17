// Server Component — só paraleliza os 3 fetches CRÍTICOS (score, posts, reviews)
// que dominam o LCP. Os 4 nice-to-have (region/trends/gbp/competitors) são
// hidratados pelo Client em useEffect pós-paint via fetchNiceToHave.
//
// Resultado: TTFB = max(3 fetches em edge runtime) em vez de max(7 com 2 em
// nodejs + possível refresh fan-out). Cards nice-to-have aparecem 200-500ms
// depois do primeiro paint, com skeleton/null já suportado.
//
// UX 100% preservada: motion, AnimatePresence, refresh buttons, approve/reject.

import { headers, cookies } from 'next/headers';
import MarketingView from './MarketingView';

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

export default async function MarketingPage() {
  // Só os 3 críticos no path do TTFB — todos em edge runtime, queries indexadas.
  const [sJson, pJson, rJson] = await Promise.all([
    fetchInternal('/api/painel/marketing/score'),
    fetchInternal('/api/painel/marketing/posts?status=pending_approval&limit=6'),
    fetchInternal('/api/painel/marketing/reviews'),
  ]);

  const initialScoreData = sJson?.current ?? null;
  const initialRecs = sJson?.recommendations ?? [];
  const initialPosts = pJson?.posts ?? [];
  const initialEligibleReviews = rJson?.eligible ?? 0;

  // criticalLoaded=true sinaliza ao Client que pode pular o fetchData completo
  // do mount inicial e disparar apenas o fetchNiceToHave (pós-hidrato).
  const criticalLoaded = sJson !== null || pJson !== null || rJson !== null;

  return (
    <MarketingView
      initialScoreData={initialScoreData as any}
      initialRecs={initialRecs as any}
      initialPosts={initialPosts as any}
      initialEligibleReviews={initialEligibleReviews}
      initialRegionDemand={null}
      initialMarketTrends={null}
      initialGbpInsights={null}
      initialCompetitors={null}
      initialLoaded={criticalLoaded}
    />
  );
}
