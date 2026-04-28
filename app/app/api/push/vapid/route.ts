import { NextResponse } from 'next/server';

// Retorna a public key VAPID pro client subscrever.
export async function GET() {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) {
    return NextResponse.json({ success: false, error: 'vapid_not_configured' }, { status: 503 });
  }
  return NextResponse.json({ success: true, publicKey: key });
}
