/**
 * Google Business Profile OAuth flow.
 *
 * Fluxo:
 *   GET /api/painel/marketing/oauth/gbp           → redireciona pro Google OAuth
 *   GET /api/painel/marketing/oauth/gbp?code=…    → callback, troca code por tokens,
 *                                                   busca primeira location, persiste em
 *                                                   marketing_subscriptions (refresh_token criptografado).
 *
 * Scopes:
 *   - https://www.googleapis.com/auth/business.manage  (read+write GBP)
 *
 * Token: refresh_token long-lived (renovado em cada chamada de Performance API).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-tenant';
import { supabaseAdmin } from '@/lib/supabase';
import { encryptString } from '@/lib/crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.singulare.org';
const REDIRECT_URI = `${APP_URL}/api/painel/marketing/oauth/gbp`;
const SCOPE = 'https://www.googleapis.com/auth/business.manage';

const ACCOUNT_API = 'https://mybusinessaccountmanagement.googleapis.com/v1';
const BUSINESS_INFO_API = 'https://mybusinessbusinessinformation.googleapis.com/v1';

function configError(missing: string) {
  return NextResponse.redirect(`${APP_URL}/painel/marketing/configurar?error=${encodeURIComponent(`config_missing:${missing}`)}`);
}

export async function GET(req: NextRequest) {
  if (!GOOGLE_CLIENT_ID) return configError('GOOGLE_OAUTH_CLIENT_ID');
  if (!GOOGLE_CLIENT_SECRET) return configError('GOOGLE_OAUTH_CLIENT_SECRET');

  const code = req.nextUrl.searchParams.get('code');

  // ── Etapa 1: redirect inicial ──────────────────────────────────────────
  if (!code) {
    const auth = await requireTenant();
    if (!auth.ok) return auth.response;

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', GOOGLE_CLIENT_ID);
    url.searchParams.set('redirect_uri', REDIRECT_URI);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', SCOPE);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent'); // garante refresh_token na 1ª e em re-auth
    url.searchParams.set('state', auth.ctx.tenant.tenant_id);
    return NextResponse.redirect(url.toString());
  }

  // ── Etapa 2: callback — troca code por tokens ─────────────────────────
  const tenantId = req.nextUrl.searchParams.get('state') || '';
  if (!tenantId) {
    return NextResponse.redirect(`${APP_URL}/painel/marketing/configurar?error=missing_state`);
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
    }),
  });
  const tokenData = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenData.refresh_token) {
    console.error('[gbp-oauth] token exchange failed:', tokenData);
    return NextResponse.redirect(`${APP_URL}/painel/marketing/configurar?error=gbp_token_exchange_failed`);
  }

  const accessToken = tokenData.access_token as string;
  const refreshToken = tokenData.refresh_token as string;

  // ── Etapa 3: busca primeira account + location ────────────────────────
  const acctRes = await fetch(`${ACCOUNT_API}/accounts`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const acctData = await acctRes.json().catch(() => ({}));
  const accounts = (acctData?.accounts ?? []) as Array<{ name: string; accountName?: string }>;
  if (!acctRes.ok || accounts.length === 0) {
    console.error('[gbp-oauth] no accounts:', acctData);
    return NextResponse.redirect(`${APP_URL}/painel/marketing/configurar?error=gbp_no_accounts`);
  }

  const accountName = accounts[0].name; // formato "accounts/{id}"
  const accountId = accountName.replace(/^accounts\//, '');

  const locsRes = await fetch(
    `${BUSINESS_INFO_API}/${accountName}/locations?readMask=name,title,storefrontAddress`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const locsData = await locsRes.json().catch(() => ({}));
  const locations = (locsData?.locations ?? []) as Array<{ name: string; title?: string }>;
  if (!locsRes.ok || locations.length === 0) {
    console.error('[gbp-oauth] no locations:', locsData);
    return NextResponse.redirect(`${APP_URL}/painel/marketing/configurar?error=gbp_no_locations`);
  }

  const firstLocation = locations[0];
  const locationId = firstLocation.name.replace(/^locations\//, '');
  const locationTitle = firstLocation.title ?? firstLocation.name;

  // ── Etapa 4: persiste em marketing_subscriptions ──────────────────────
  const supabase = supabaseAdmin();
  const { error: upsertErr } = await supabase
    .from('marketing_subscriptions')
    .upsert(
      {
        tenant_id: tenantId,
        plan: 'presenca',
        status: 'active',
        gbp_refresh_token_enc: encryptString(refreshToken),
        gbp_account_id: accountId,
        gbp_location_id: locationId,
        gbp_location_name: locationTitle,
        gbp_connected_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id' }
    );

  if (upsertErr) {
    console.error('[gbp-oauth] subscription upsert failed:', upsertErr.message);
    return NextResponse.redirect(`${APP_URL}/painel/marketing/configurar?error=gbp_db_upsert_failed`);
  }

  console.log('[gbp-oauth] tenant=%s connected gbp_account=%s location=%s', tenantId, accountId, locationId);

  return NextResponse.redirect(
    `${APP_URL}/painel/marketing/configurar?connected=gbp&location=${encodeURIComponent(locationTitle)}`
  );
}
