// app/app/api/vitrine/profiles/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getPublishedVitrineProfiles } from '@/lib/marketing-queries';

export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get('city') ?? undefined;
  const type = req.nextUrl.searchParams.get('type') ?? undefined;

  const profiles = await getPublishedVitrineProfiles(city, type);

  return NextResponse.json({ success: true, profiles });
}
