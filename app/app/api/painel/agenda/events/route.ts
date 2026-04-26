import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

// Busca eventos do Google Calendar do usuario logado.
//
// Estrategia: usa o `provider_token` da sessao Supabase (vem do OAuth Google)
// pra chamar a API do Google Calendar. Se o token nao tem scope de calendar
// (ex: usuario logou com Google ANTES da gente pedir o scope), retorna
// requires_reauth=true e o front exibe CTA pra relogar.

interface GoogleEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: Array<{ email?: string; displayName?: string; responseStatus?: string }>;
  status?: string;
  htmlLink?: string;
  hangoutLink?: string;
  colorId?: string;
}

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !session) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }

  const providerToken = session.provider_token;
  if (!providerToken) {
    return NextResponse.json(
      {
        success: false,
        error: 'no_google_token',
        requires_reauth: true,
        message: 'Sua sessão não tem token do Google. Saia e entre de novo com "Continuar com Google" pra liberar acesso à agenda.',
      },
      { status: 200 }
    );
  }

  // Janela: 7 dias atrás → 60 dias à frente (ajustável via querystring)
  const url = new URL(req.url);
  const daysBack = parseInt(url.searchParams.get('back') ?? '7', 10);
  const daysForward = parseInt(url.searchParams.get('forward') ?? '60', 10);
  const calendarId = url.searchParams.get('calendar') ?? 'primary';

  const timeMin = new Date(Date.now() - daysBack * 86_400_000).toISOString();
  const timeMax = new Date(Date.now() + daysForward * 86_400_000).toISOString();

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    maxResults: '250',
    singleEvents: 'true',
    orderBy: 'startTime',
  });

  const apiUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;

  try {
    const res = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${providerToken}` },
      cache: 'no-store',
    });

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json(
        {
          success: false,
          error: 'google_token_expired_or_no_scope',
          requires_reauth: true,
          message:
            'Token expirou ou não tem permissão de leitura da agenda. Saia e entre de novo com "Continuar com Google".',
        },
        { status: 200 }
      );
    }

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('[agenda/events] google api erro', res.status, txt.slice(0, 200));
      return NextResponse.json({ success: false, error: 'google_api_error', status: res.status }, { status: 502 });
    }

    const data = await res.json();
    const events = (data.items as GoogleEvent[]) ?? [];

    return NextResponse.json({
      success: true,
      events: events.map((ev) => ({
        id: ev.id,
        title: ev.summary ?? '(sem título)',
        description: ev.description ?? null,
        location: ev.location ?? null,
        start: ev.start?.dateTime ?? ev.start?.date ?? null,
        end: ev.end?.dateTime ?? ev.end?.date ?? null,
        all_day: !ev.start?.dateTime,
        attendees: ev.attendees?.map((a) => a.displayName ?? a.email).filter(Boolean) ?? [],
        status: ev.status ?? 'confirmed',
        link: ev.htmlLink ?? null,
        meet_link: ev.hangoutLink ?? null,
      })),
      window: { from: timeMin, to: timeMax },
    });
  } catch (e) {
    console.error('[agenda/events] erro', e);
    return NextResponse.json({ success: false, error: 'fetch_error' }, { status: 500 });
  }
}
