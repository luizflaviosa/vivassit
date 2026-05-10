/**
 * Instagram OAuth flow via Facebook Login for Business.
 *
 * Fluxo:
 *   GET /api/painel/marketing/oauth/instagram          → redireciona pro Meta OAuth
 *   GET /api/painel/marketing/oauth/instagram?code=… → callback, troca code por token,
 *                                                      busca página FB + IG Business Account,
 *                                                      criptografa e salva em marketing_subscriptions
 *
 * Permissions solicitadas: instagram_business_basic, instagram_business_content_publish,
 * pages_show_list, pages_read_engagement, pages_manage_posts, business_management.
 *
 * Token: long-lived (60 dias). Próxima rotação manual ou via cron.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-tenant';
import { supabaseAdmin } from '@/lib/supabase';
import { encryptString } from '@/lib/crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const META_APP_ID = process.env.META_APP_ID || '';
const META_APP_SECRET = process.env.META_APP_SECRET || '';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.singulare.org';
const REDIRECT_URI = `${APP_URL}/api/painel/marketing/oauth/instagram`;

const SCOPES = [
  'instagram_business_basic',
  'instagram_business_content_publish',
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'business_management',
].join(',');

function configError(missing: string) {
  return NextResponse.redirect(`${APP_URL}/painel/marketing/configurar?error=${encodeURIComponent(`config_missing:${missing}`)}`);
}

export async function GET(req: NextRequest) {
  if (!META_APP_ID) return configError('META_APP_ID');
  if (!META_APP_SECRET) return configError('META_APP_SECRET');

  const code = req.nextUrl.searchParams.get('code');

  // ── Etapa 1: redirect inicial pro Meta OAuth ────────────────────────────
  if (!code) {
    const auth = await requireTenant();
    if (!auth.ok) return auth.response;

    const authUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth');
    authUrl.searchParams.set('client_id', META_APP_ID);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('scope', SCOPES);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', auth.ctx.tenant.tenant_id);

    return NextResponse.redirect(authUrl.toString());
  }

  // ── Etapa 2: callback — troca code por short-lived token ────────────────
  const tenantId = req.nextUrl.searchParams.get('state') || '';
  if (!tenantId) {
    return NextResponse.redirect(`${APP_URL}/painel/marketing/configurar?error=missing_state`);
  }

  const tokenUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
  tokenUrl.searchParams.set('client_id', META_APP_ID);
  tokenUrl.searchParams.set('client_secret', META_APP_SECRET);
  tokenUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  tokenUrl.searchParams.set('code', code);

  const tokenRes = await fetch(tokenUrl.toString());
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    console.error('[ig-oauth] short-lived token exchange failed:', tokenData);
    return NextResponse.redirect(`${APP_URL}/painel/marketing/configurar?error=token_exchange_failed`);
  }

  // ── Etapa 3: troca short-lived → long-lived (60 dias) ───────────────────
  const llUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
  llUrl.searchParams.set('grant_type', 'fb_exchange_token');
  llUrl.searchParams.set('client_id', META_APP_ID);
  llUrl.searchParams.set('client_secret', META_APP_SECRET);
  llUrl.searchParams.set('fb_exchange_token', tokenData.access_token);

  const llRes = await fetch(llUrl.toString());
  const llData = await llRes.json();
  const longLivedToken = llData.access_token ?? tokenData.access_token;
  const expiresIn = Number(llData.expires_in ?? tokenData.expires_in ?? 60 * 24 * 60 * 60);

  // ── Etapa 4: busca primeira Página com Instagram Business linkado ───────
  const pagesRes = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${longLivedToken}`
  );
  const pagesData = await pagesRes.json();
  if (!pagesRes.ok || !Array.isArray(pagesData.data)) {
    console.error('[ig-oauth] me/accounts failed:', pagesData);
    return NextResponse.redirect(`${APP_URL}/painel/marketing/configurar?error=pages_fetch_failed`);
  }

  const pageWithIg = pagesData.data.find((p: { instagram_business_account?: { id: string } }) => p.instagram_business_account?.id);
  if (!pageWithIg) {
    return NextResponse.redirect(`${APP_URL}/painel/marketing/configurar?error=no_instagram_business_account_linked`);
  }

  const igAccount = pageWithIg.instagram_business_account as { id: string; username?: string };
  const pageId = pageWithIg.id as string;

  // ── Etapa 5: criptografa e persiste em marketing_subscriptions ──────────
  const supabase = supabaseAdmin();
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const { error: upsertErr } = await supabase
    .from('marketing_subscriptions')
    .upsert({
      tenant_id: tenantId,
      plan: 'social',
      status: 'active',
      instagram_token_enc: encryptString(longLivedToken),
      facebook_page_id: pageId,
      instagram_business_account_id: igAccount.id,
      instagram_username: igAccount.username ?? null,
      instagram_token_expires_at: expiresAt,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id' });

  if (upsertErr) {
    console.error('[ig-oauth] subscription upsert failed:', upsertErr.message);
    return NextResponse.redirect(`${APP_URL}/painel/marketing/configurar?error=db_upsert_failed`);
  }

  console.log('[ig-oauth] tenant=%s connected ig=@%s page=%s', tenantId, igAccount.username, pageId);

  return NextResponse.redirect(`${APP_URL}/painel/marketing/configurar?connected=instagram&username=${encodeURIComponent(igAccount.username ?? '')}`);
}
