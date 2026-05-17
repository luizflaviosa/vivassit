// Server Component — fetch inicial doctors + events do primary doctor.
// Replica a logica do AgendaView pra escolher active doctor (primary com
// calendar, ou primeiro disponivel) e ja busca os events dele. AgendaView
// (Client) recebe tudo via props e nao precisa fazer fetch inicial. UX
// preservada: react-big-calendar, drag-and-drop, drawer create/edit,
// propose reschedule.

import { headers, cookies } from 'next/headers';
import AgendaView from './AgendaView';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Tipos minimos pra Server logic. AgendaView tem suas proprias interfaces
// completas (DoctorOption com name, specialty etc) — passamos os dados
// como any e deixamos a interface do Client tipar a recepcao.

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

export default async function AgendaPage() {
  // 1. Lista de profissionais
  const doctorsJson = await fetchInternal('/api/painel/agenda/doctors');
  const initialDoctors: any[] | null = doctorsJson?.success
    ? (doctorsJson.doctors ?? [])
    : null;

  // 2. Replica logica de escolha do active doctor
  let initialActiveDoctor: string | null = null;
  if (initialDoctors && initialDoctors.length > 0) {
    const primary = initialDoctors.find(
      (d: any) => d.is_primary && d.has_calendar,
    );
    initialActiveDoctor = primary?.id ?? initialDoctors[0].id;
  }

  // 3. Eventos do active doctor.
  let initialEvents: any[] | null = null;
  let initialSetupIssue: any | null = null;
  if (initialActiveDoctor) {
    const url = `/api/painel/agenda/events?doctor=${initialActiveDoctor}&back=2&forward=60`;
    const eventsJson = await fetchInternal(url);
    if (eventsJson?.success) {
      initialEvents = eventsJson.events ?? [];
    } else if (eventsJson?.requires_setup) {
      initialSetupIssue = {
        type: eventsJson.error,
        message: eventsJson.message,
        share_with: eventsJson.share_with,
        doctor: eventsJson.doctor,
        calendar_id:
          eventsJson.calendar_id ?? eventsJson.doctor?.calendar_id,
      };
    } else if (eventsJson?.error === 'no_doctor') {
      initialSetupIssue = { type: 'no_doctor', message: eventsJson.message };
    }
  }

  return (
    <AgendaView
      initialDoctors={initialDoctors as any}
      initialActiveDoctor={initialActiveDoctor}
      initialEvents={initialEvents as any}
      initialSetupIssue={initialSetupIssue}
    />
  );
}
