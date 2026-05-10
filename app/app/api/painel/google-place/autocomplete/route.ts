/**
 * GET /api/painel/google-place/autocomplete?q=<query>
 *
 * Type-ahead pra escolher Google Place ID — usuario digita o nome do negocio,
 * Google sugere lugares (igual a barra do Maps).
 *
 * Provider: Google Places API (New) — POST places:autocomplete.
 * A legacy /maps/api/place/autocomplete/json foi descartada porque chaves novas
 * habilitam apenas a "Places API (New)" no Cloud Console (a legacy precisa
 * ser habilitada separadamente e esta em sunset).
 *
 * Response (shape estavel pra UI):
 *   { predictions: [{ place_id, description, main_text, secondary_text }] }
 *
 * Setup: GOOGLE_PLACES_API_KEY no Vercel + "Places API (New)" enabled.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-tenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface NewPlacePrediction {
  placePrediction?: {
    placeId: string;
    text?: { text?: string };
    structuredFormat?: {
      mainText?: { text?: string };
      secondaryText?: { text?: string };
    };
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: 'no_api_key', message: 'Places API nao configurada.' },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim() ?? '';

  if (q.length < 2) {
    return NextResponse.json({ predictions: [] });
  }

  const body = {
    input: q,
    languageCode: 'pt-BR',
    regionCode: 'BR',
    includedRegionCodes: ['br'],
  };

  const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const data = (await res.json().catch(() => null)) as
    | { suggestions?: NewPlacePrediction[]; error?: { message?: string } }
    | null;

  if (!res.ok) {
    const msg = data?.error?.message ?? `Places API ${res.status}`;
    return NextResponse.json(
      { ok: false, error: 'api_error', message: msg },
      { status: 502 },
    );
  }

  const suggestions = data?.suggestions ?? [];
  const predictions = suggestions
    .map((s) => {
      const p = s.placePrediction;
      if (!p?.placeId) return null;
      const main = p.structuredFormat?.mainText?.text ?? p.text?.text ?? '';
      const secondary = p.structuredFormat?.secondaryText?.text ?? '';
      const description = p.text?.text ?? `${main}${secondary ? `, ${secondary}` : ''}`;
      return {
        place_id: p.placeId,
        description,
        main_text: main || description,
        secondary_text: secondary,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .slice(0, 8);

  return NextResponse.json({ predictions });
}
