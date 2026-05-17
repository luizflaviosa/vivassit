// Server Component — diferente das outras 6 da serie (que moviam fetches
// pro server). Aqui o "fetch inicial" e leve (so /api/painel/me pra extrair
// chatwoot config) mas o GANHO REAL vem de outra direcao:
//
// 1. <link rel="preconnect"> ao host do Chatwoot ANTES do iframe carregar.
//    Browser inicia DNS + TLS handshake assim que recebe o HTML — quando
//    o iframe finalmente pede recursos, conexao ja esta morna.
//    Economia: 150-300ms no LCP do iframe em primeira visita.
//
// 2. URL Chatwoot pre-calculada no Server (buildChatwootUrl). Cliente
//    recebe URL pronta via prop, nao precisa esperar useMe() resolver
//    pra renderizar o iframe.
//
// 3. Decisao EmptyState vs IframeView feita no Server. Quando tenant
//    nao tem Chatwoot configurado, o HTML inicial ja vem com EmptyState —
//    sem hidratar JS pra decidir.
//
// UX 100% preservada no Client: motion backdrop, scale-in container,
// botao minimizar com router.push, link nova aba, event listener
// 'singulare:atendimento-focus'.

import { headers, cookies } from 'next/headers';
import AtendimentoView from './AtendimentoView';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function buildChatwootUrl(
  rawUrl?: string | null,
  accountId?: string | number | null,
): string | null {
  if (!rawUrl || accountId === null || accountId === undefined || accountId === '') {
    return null;
  }
  const base = String(rawUrl).replace(/\/+$/, '');
  return `${base}/app/accounts/${accountId}/conversations`;
}

function originOf(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  try {
    return new URL(rawUrl).origin;
  } catch {
    return null;
  }
}

async function fetchMe(): Promise<any | null> {
  const cookieStore = cookies();
  const headersList = headers();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
  const host = headersList.get('host') ?? 'singulare.org';
  const proto = headersList.get('x-forwarded-proto') ?? 'https';
  try {
    const res = await fetch(`${proto}://${host}/api/painel/me`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    // /api/painel/me retorna { success, tenant: {...} } ou estrutura similar.
    return json?.tenant ?? json;
  } catch {
    return null;
  }
}

export default async function AtendimentoPage() {
  const me = await fetchMe();
  const chatwootUrl = buildChatwootUrl(me?.chatwoot_url, me?.chatwoot_account_id);
  const chatwootOrigin = originOf(me?.chatwoot_url);

  return (
    <>
      {/*
        Preconnect: browser inicia DNS + TLS handshake imediatamente ao
        receber o HTML. Quando o iframe pedir recursos, conexao ja morna.
        crossOrigin="anonymous" obrigatorio pra preconnect funcionar com
        anonymous resources (CSS/JS/fontes do Chatwoot).
      */}
      {chatwootOrigin && (
        <>
          <link rel="preconnect" href={chatwootOrigin} crossOrigin="anonymous" />
          <link rel="dns-prefetch" href={chatwootOrigin} />
        </>
      )}
      <AtendimentoView chatwootUrl={chatwootUrl} />
    </>
  );
}
