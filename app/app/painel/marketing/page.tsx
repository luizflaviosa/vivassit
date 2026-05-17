// Server Component — paraleliza 7 fetches no servidor (Promise.all),
// passa todos os dados iniciais como props. Cliente recebe HTML pronto
// pra renderizar score card, recs, posts, region demand, market trends,
// GBP insights, competitors — sem espera de useEffect+fetch.
//
// UX 100% preservada: motion, AnimatePresence, todos os refresh buttons,
// approve/reject posts, expand cards.

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
  // 7 fetches paralelos no Server — substitui o Promise.all do useEffect Client.
  const [sJson, pJson, rJson, dJson, tJson, gJson, cJson] = await Promise.all([
    fetchInternal('/api/painel/marketing/score'),
    fetchInternal('/api/painel/marketing/posts?status=pending_approval&limit=6'),
    fetchInternal('/api/painel/marketing/reviews'),
    fetchInternal('/api/painel/marketing/region-demand'),
    fetchInternal('/api/painel/marketing/market-trends'),
    fetchInternal('/api/painel/marketing/gbp-insights'),
    fetchInternal('/api/painel/marketing/competitors'),
  ]);

  // Mesma logica de extracao que o fetchData() do client tem.
  const initialScoreData = sJson?.current ?? null;
  const initialRecs = sJson?.recommendations ?? [];
  const initialPosts = pJson?.posts ?? [];
  const initialEligibleReviews = rJson?.eligible ?? 0;
  const initialRegionDemand = dJson?.success ? dJson : null;
  const initialMarketTrends = tJson?.primary_keyword ? tJson : null;
  const initialGbpInsights = gJson?.location_name ? gJson : null;
  const initialCompetitors = cJson?.search_query ? cJson : null;

  // initialLoaded=true significa Server entregou todos (incluindo nulls
  // legítimos como "ainda sem snapshot"). Client pula useEffect inicial.
  const initialLoaded =
    sJson !== null ||
    pJson !== null ||
    rJson !== null;

  return (
    <MarketingView
      initialScoreData={initialScoreData as any}
      initialRecs={initialRecs as any}
      initialPosts={initialPosts as any}
      initialEligibleReviews={initialEligibleReviews}
      initialRegionDemand={initialRegionDemand as any}
      initialMarketTrends={initialMarketTrends as any}
      initialGbpInsights={initialGbpInsights as any}
      initialCompetitors={initialCompetitors as any}
      initialLoaded={initialLoaded}
    />
  );
}
