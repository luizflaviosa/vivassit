/**
 * Seed fake events no Google Calendar de um doctor pra fins de demo.
 *
 * Usado pro tenant 'demo-singulare' que serve de showcase pra futuros clientes.
 * Cria N consultas + retornos + bloqueios de almoço realistas, espalhados pelos
 * próximos `days_forward` dias respeitando o working_hours do doctor.
 *
 * O webhook do Google Calendar sincroniza tudo pra tenant_calendar_events em
 * <5s, então `/painel/agenda` mostra os eventos sem precisar refresh manual.
 *
 * Auth: Bearer N8N_TO_VERCEL_TOKEN
 *
 * Body:
 *   {
 *     doctor_id: string (required)
 *     days_forward?: number (default 14, max 30)
 *     fill_rate?: number (0..1, default 0.55)
 *     dry_run?: boolean (default false — true só lista o que seria criado)
 *   }
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createEvent } from '@/lib/google-calendar';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const FAKE_PATIENTS = [
  'Ana Beatriz Silva',
  'João Pedro Santos',
  'Maria Clara Oliveira',
  'Pedro Henrique Costa',
  'Camila Rodrigues',
  'Lucas Almeida Mendes',
  'Júlia Ferreira',
  'Felipe Souza Lima',
  'Isabela Cardoso',
  'Rafael Pereira',
  'Beatriz Castro',
  'Bruno Martins',
  'Larissa Ribeiro',
  'Diego Nunes',
  'Patricia Freitas',
  'Gabriel Barros',
  'Mariana Rocha',
  'Thiago Dias',
  'Carolina Vieira',
  'Vinícius Cunha',
  'Renata Moreira',
  'Eduardo Moraes',
  'Fernanda Pinto',
  'Marcelo Borges',
];

const TYPES = ['Consulta', 'Retorno', 'Avaliação', 'Acompanhamento'];

interface WorkingHours {
  [dow: string]: string; // 'fechado' | '08:00-12:00' | '08:00-12:00,14:00-18:00'
}

function dowKey(d: Date): string {
  const map = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
  return map[d.getDay()];
}

function parseWindows(spec: string): Array<[string, string]> {
  if (!spec || spec === 'fechado' || spec.toLowerCase().startsWith('fechad')) return [];
  return spec
    .split(',')
    .map((w) => w.trim())
    .map((w) => {
      const m = w.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
      return m ? ([m[1], m[2]] as [string, string]) : null;
    })
    .filter((x): x is [string, string] => x !== null);
}

function combineDateAndTime(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  // America/Sao_Paulo é UTC-3 fixo. Construir o instante UTC = local + 3h.
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), h + 3, m, 0);
  return new Date(utc);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

interface SeedResult {
  created: number;
  skipped_existing: number;
  failed: number;
  events: Array<{ start: string; title: string; status: 'created' | 'failed'; error?: string }>;
}

export async function POST(req: NextRequest) {
  const expected = process.env.N8N_TO_VERCEL_TOKEN?.trim();
  if (!expected) {
    return NextResponse.json({ ok: false, error: 'server_misconfigured' }, { status: 500 });
  }
  const auth = (req.headers.get('authorization') ?? '').trim();
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: {
    doctor_id?: string;
    days_forward?: number;
    fill_rate?: number;
    dry_run?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const doctorId = body.doctor_id;
  if (!doctorId) {
    return NextResponse.json({ ok: false, error: 'missing_doctor_id' }, { status: 400 });
  }
  const daysForward = Math.min(Math.max(body.days_forward ?? 14, 1), 30);
  const fillRate = Math.min(Math.max(body.fill_rate ?? 0.55, 0), 1);
  const dryRun = body.dry_run ?? false;

  const supabase = supabaseAdmin();
  const { data: doctor, error: dErr } = await supabase
    .from('tenant_doctors')
    .select('id, doctor_name, calendar_id, working_hours, consultation_duration, tenant_id')
    .eq('id', doctorId)
    .maybeSingle<{
      id: string;
      doctor_name: string;
      calendar_id: string | null;
      working_hours: WorkingHours | null;
      consultation_duration: number | null;
      tenant_id: string;
    }>();

  if (dErr || !doctor) {
    return NextResponse.json({ ok: false, error: 'doctor_not_found', detail: dErr?.message }, { status: 404 });
  }
  if (!doctor.calendar_id) {
    return NextResponse.json(
      { ok: false, error: 'no_calendar_id', message: 'Doctor sem calendar configurado.' },
      { status: 422 },
    );
  }
  if (!doctor.working_hours) {
    return NextResponse.json(
      { ok: false, error: 'no_working_hours', message: 'Doctor sem working_hours configurado.' },
      { status: 422 },
    );
  }

  const duration = doctor.consultation_duration ?? 30;

  // Gera plano de eventos
  const now = new Date();
  const plan: Array<{ start: Date; end: Date; title: string; description: string; allDay: boolean }> = [];

  for (let dayOffset = 1; dayOffset <= daysForward; dayOffset++) {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    const dow = dowKey(d);
    const spec = doctor.working_hours[dow];
    if (!spec) continue;
    const windows = parseWindows(spec);
    if (windows.length === 0) continue;

    // Bloqueio almoço se tiver janela manhã + tarde
    if (windows.length >= 2) {
      const morningEnd = windows[0][1];
      const afternoonStart = windows[1][0];
      const lunchStart = combineDateAndTime(d, morningEnd);
      const lunchEnd = combineDateAndTime(d, afternoonStart);
      // Só adiciona se houver gap real (não janela contínua)
      if (lunchEnd.getTime() - lunchStart.getTime() >= 30 * 60 * 1000) {
        plan.push({
          start: lunchStart,
          end: lunchEnd,
          title: 'Almoço',
          description: '',
          allDay: false,
        });
      }
    }

    // Slots dentro de cada janela
    for (const [openHHMM, closeHHMM] of windows) {
      const winStart = combineDateAndTime(d, openHHMM);
      const winEnd = combineDateAndTime(d, closeHHMM);
      let slotStart = winStart;
      while (slotStart.getTime() + duration * 60_000 <= winEnd.getTime()) {
        const slotEnd = new Date(slotStart.getTime() + duration * 60_000);
        if (Math.random() < fillRate) {
          const patient = pick(FAKE_PATIENTS);
          const type = pick(TYPES);
          plan.push({
            start: slotStart,
            end: slotEnd,
            title: `${type} ${patient}`,
            description: `${type} agendada via demo · ${doctor.doctor_name}`,
            allDay: false,
          });
        }
        slotStart = new Date(slotStart.getTime() + duration * 60_000);
      }
    }
  }

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      doctor: { id: doctor.id, name: doctor.doctor_name, tenant_id: doctor.tenant_id },
      planned: plan.length,
      sample: plan.slice(0, 10).map((p) => ({
        start: p.start.toISOString(),
        title: p.title,
      })),
    });
  }

  // Executa em série pra não bater rate limit do Google
  const result: SeedResult = { created: 0, skipped_existing: 0, failed: 0, events: [] };
  for (const ev of plan) {
    const r = await createEvent({
      calendarId: doctor.calendar_id,
      summary: ev.title,
      description: ev.description,
      start: ev.start,
      end: ev.end,
      allDay: ev.allDay,
    });
    if ('error' in r) {
      result.failed++;
      result.events.push({ start: ev.start.toISOString(), title: ev.title, status: 'failed', error: r.error });
    } else {
      result.created++;
      result.events.push({ start: ev.start.toISOString(), title: ev.title, status: 'created' });
    }
  }

  return NextResponse.json({
    ok: result.failed === 0,
    doctor: { id: doctor.id, name: doctor.doctor_name, tenant_id: doctor.tenant_id },
    summary: {
      planned: plan.length,
      created: result.created,
      failed: result.failed,
    },
    events: result.events.slice(0, 30),
  });
}
