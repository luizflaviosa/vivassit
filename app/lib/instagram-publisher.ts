/**
 * Instagram Graph API publisher + insights helpers.
 *
 * Token vive criptografado em marketing_subscriptions.instagram_token_enc.
 * Long-lived (60 dias). Cron mensal /api/interno/instagram-token-refresh extende.
 *
 * Pré-requisitos por tenant:
 *   - OAuth concluído (/api/painel/marketing/oauth/instagram)
 *   - facebook_page_id e instagram_business_account_id populados
 *
 * API Graph version fixa: v21.0.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { encryptString, decryptString } from './crypto';

const GRAPH_BASE = 'https://graph.facebook.com/v21.0';

export class InstagramApiError extends Error {
  status: number;
  payload: unknown;
  constructor(status: number, payload: unknown, message?: string) {
    super(message ?? `IG Graph ${status}`);
    this.name = 'InstagramApiError';
    this.status = status;
    this.payload = payload;
  }
}

interface IgConnection {
  ig_business_account_id: string;
  facebook_page_id: string;
  token: string;
  expires_at: string | null;
  username: string | null;
}

export async function loadIgConnection(
  supabase: SupabaseClient,
  tenantId: string
): Promise<IgConnection> {
  const { data, error } = await supabase
    .from('marketing_subscriptions')
    .select(
      'instagram_token_enc, instagram_business_account_id, facebook_page_id, instagram_token_expires_at, instagram_username'
    )
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) throw new Error(`marketing_subscriptions read failed: ${error.message}`);
  if (!data) throw new Error(`tenant ${tenantId} sem marketing_subscriptions`);
  if (!data.instagram_token_enc) throw new Error(`tenant ${tenantId} sem instagram_token_enc`);
  if (!data.instagram_business_account_id) throw new Error(`tenant ${tenantId} sem instagram_business_account_id`);
  if (!data.facebook_page_id) throw new Error(`tenant ${tenantId} sem facebook_page_id`);

  return {
    ig_business_account_id: data.instagram_business_account_id,
    facebook_page_id: data.facebook_page_id,
    token: decryptString(data.instagram_token_enc),
    expires_at: data.instagram_token_expires_at,
    username: data.instagram_username,
  };
}

async function igFetch<T = unknown>(
  path: string,
  init: RequestInit & { token: string; query?: Record<string, string | number> }
): Promise<T> {
  const url = new URL(`${GRAPH_BASE}${path}`);
  url.searchParams.set('access_token', init.token);
  for (const [k, v] of Object.entries(init.query ?? {})) {
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), {
    method: init.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) },
    body: init.body,
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new InstagramApiError(res.status, payload, payload?.error?.message);
  return payload as T;
}

// ── Profile + insights ──────────────────────────────────────────────────

export async function getProfile(supabase: SupabaseClient, tenantId: string) {
  const conn = await loadIgConnection(supabase, tenantId);
  return igFetch<{
    id: string;
    username: string;
    name?: string;
    biography?: string;
    followers_count: number;
    follows_count: number;
    media_count: number;
    profile_picture_url?: string;
  }>(`/${conn.ig_business_account_id}`, {
    token: conn.token,
    query: { fields: 'id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url' },
  });
}

/**
 * Insights de conta. Period 'day' | 'week' | 'days_28' (varia por métrica).
 * Métricas disponíveis (v21): reach, profile_views, accounts_engaged, total_interactions,
 * follower_count (delta), website_clicks (necessita CTA configurado).
 */
export async function getAccountInsights(
  supabase: SupabaseClient,
  tenantId: string,
  metrics: string[] = ['reach', 'profile_views', 'accounts_engaged'],
  period: 'day' | 'week' | 'days_28' = 'days_28'
) {
  const conn = await loadIgConnection(supabase, tenantId);
  return igFetch<{ data: Array<{ name: string; period: string; values: Array<{ value: number; end_time?: string }>; title?: string }> }>(
    `/${conn.ig_business_account_id}/insights`,
    {
      token: conn.token,
      query: { metric: metrics.join(','), period, metric_type: 'total_value' },
    }
  );
}

// ── Publishing ──────────────────────────────────────────────────────────

interface ContainerResponse {
  id: string;
}
interface PublishResponse {
  id: string;
}

/**
 * Publica imagem única.
 * Fluxo: cria container → publica.
 * imageUrl precisa ser pública (https) — Meta baixa a imagem por URL.
 */
export async function publishImagePost(
  supabase: SupabaseClient,
  tenantId: string,
  imageUrl: string,
  caption: string
) {
  const conn = await loadIgConnection(supabase, tenantId);
  const container = await igFetch<ContainerResponse>(
    `/${conn.ig_business_account_id}/media`,
    {
      token: conn.token,
      method: 'POST',
      query: { image_url: imageUrl, caption },
    }
  );
  return igFetch<PublishResponse>(`/${conn.ig_business_account_id}/media_publish`, {
    token: conn.token,
    method: 'POST',
    query: { creation_id: container.id },
  });
}

/**
 * Carousel (até 10 itens). Cada item pode ser image_url ou video_url.
 */
export async function publishCarousel(
  supabase: SupabaseClient,
  tenantId: string,
  items: Array<{ image_url?: string; video_url?: string }>,
  caption: string
) {
  if (items.length < 2 || items.length > 10) {
    throw new Error('Carousel precisa de 2-10 itens');
  }
  const conn = await loadIgConnection(supabase, tenantId);

  // 1. cria 1 container por item (is_carousel_item: true)
  const childIds: string[] = [];
  for (const item of items) {
    const child = await igFetch<ContainerResponse>(
      `/${conn.ig_business_account_id}/media`,
      {
        token: conn.token,
        method: 'POST',
        query: {
          ...(item.image_url ? { image_url: item.image_url } : {}),
          ...(item.video_url ? { video_url: item.video_url, media_type: 'VIDEO' } : {}),
          is_carousel_item: 'true',
        },
      }
    );
    childIds.push(child.id);
  }

  // 2. cria container do carousel
  const carousel = await igFetch<ContainerResponse>(
    `/${conn.ig_business_account_id}/media`,
    {
      token: conn.token,
      method: 'POST',
      query: { media_type: 'CAROUSEL', children: childIds.join(','), caption },
    }
  );

  // 3. publica
  return igFetch<PublishResponse>(`/${conn.ig_business_account_id}/media_publish`, {
    token: conn.token,
    method: 'POST',
    query: { creation_id: carousel.id },
  });
}

// ── Token refresh (long-lived → long-lived, extende 60d) ────────────────

interface FbTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

export async function refreshLongLivedToken(
  supabase: SupabaseClient,
  tenantId: string,
  metaAppId: string,
  metaAppSecret: string
): Promise<{ extended: boolean; expiresAt: string | null; reason?: string }> {
  const conn = await loadIgConnection(supabase, tenantId);

  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', metaAppId);
  url.searchParams.set('client_secret', metaAppSecret);
  url.searchParams.set('fb_exchange_token', conn.token);

  const res = await fetch(url.toString());
  const data = (await res.json().catch(() => ({}))) as FbTokenResponse & { error?: { message: string } };

  if (!res.ok || !data.access_token) {
    return { extended: false, expiresAt: conn.expires_at, reason: data.error?.message ?? `http ${res.status}` };
  }

  const expiresIn = Number(data.expires_in ?? 60 * 24 * 60 * 60);
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const { error: updErr } = await supabase
    .from('marketing_subscriptions')
    .update({
      instagram_token_enc: encryptString(data.access_token),
      instagram_token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId);

  if (updErr) return { extended: false, expiresAt: conn.expires_at, reason: updErr.message };

  return { extended: true, expiresAt };
}
