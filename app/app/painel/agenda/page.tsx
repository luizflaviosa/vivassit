'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar as CalendarIcon,
  ExternalLink,
  Loader2,
  RefreshCw,
  AlertCircle,
  MapPin,
  Users,
  Video,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useMe } from '@/lib/painel-context';
import Link from 'next/link';

import {
  Calendar,
  dateFnsLocalizer,
  View,
  type CalendarProps,
  type EventProps,
} from 'react-big-calendar';
import withDragAndDrop, {
  type EventInteractionArgs,
} from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import './calendar.css';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';
const ACCENT_SOFT = '#F5F3FF';

interface AgendaEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start: string | null;
  end: string | null;
  all_day: boolean;
  attendees: string[];
  status: string;
  link: string | null;
  meet_link: string | null;
}

interface DoctorOption {
  id: string;
  name: string;
  specialty: string | null;
  has_calendar: boolean;
  is_primary: boolean;
}

interface SetupIssue {
  type: 'no_doctor' | 'no_calendar' | 'no_service_account' | 'no_calendar_access';
  message: string;
  share_with?: string;
  doctor?: { id: string; name: string; calendar_id?: string };
}

// react-big-calendar event shape — we keep the original API event under `raw`
interface RBCEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  raw: AgendaEvent;
}

const locales = { 'pt-BR': ptBR };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { locale: ptBR }),
  getDay,
  locales,
});

const DnDCalendar = withDragAndDrop<RBCEvent>(
  Calendar as unknown as React.ComponentType<CalendarProps<RBCEvent, object>>,
);

const messages = {
  date: 'Data',
  time: 'Hora',
  event: 'Evento',
  allDay: 'Dia todo',
  week: 'Semana',
  work_week: 'Semana útil',
  day: 'Dia',
  month: 'Mês',
  previous: 'Anterior',
  next: 'Próximo',
  yesterday: 'Ontem',
  tomorrow: 'Amanhã',
  today: 'Hoje',
  agenda: 'Agenda',
  noEventsInRange: 'Sem eventos neste período.',
  showMore: (total: number) => `+${total} mais`,
};

function fmtTime(d: Date) {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function isToday(d: Date) {
  const t = new Date();
  return (
    d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
  );
}

function toRBCEvent(ev: AgendaEvent): RBCEvent | null {
  if (!ev.start) return null;
  const start = new Date(ev.start);
  const end = ev.end ? new Date(ev.end) : new Date(start.getTime() + 60 * 60 * 1000);
  return {
    id: ev.id,
    title: ev.title || '(sem título)',
    start,
    end,
    allDay: ev.all_day,
    raw: ev,
  };
}

function AgendaInner() {
  const me = useMe();
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [setupIssue, setSetupIssue] = useState<SetupIssue | null>(null);
  const [view, setView] = useState<View>('month');
  const [date, setDate] = useState<Date>(new Date());
  const [selected, setSelected] = useState<AgendaEvent | null>(null);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [activeDoctor, setActiveDoctor] = useState<string | null>(null);

  // Carrega lista de profissionais
  useEffect(() => {
    fetch('/api/painel/agenda/doctors')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setDoctors(j.doctors ?? []);
          const primary = j.doctors?.find((d: DoctorOption) => d.is_primary && d.has_calendar);
          if (primary) setActiveDoctor(primary.id);
          else if (j.doctors?.[0]) setActiveDoctor(j.doctors[0].id);
        }
      });
  }, []);

  const fetchEvents = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const url = activeDoctor
        ? `/api/painel/agenda/events?doctor=${activeDoctor}&back=2&forward=60`
        : '/api/painel/agenda/events?back=2&forward=60';
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setEvents(json.events ?? []);
        setSetupIssue(null);
      } else if (json.requires_setup) {
        setSetupIssue({
          type: json.error,
          message: json.message,
          share_with: json.share_with,
          doctor: json.doctor,
        });
      } else if (json.error === 'no_doctor') {
        setSetupIssue({ type: 'no_doctor', message: json.message });
      } else {
        setSetupIssue({ type: 'no_service_account', message: json.message ?? 'Erro ao carregar.' });
      }
    } catch {
      setSetupIssue({ type: 'no_service_account', message: 'Erro de conexão.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDoctor]);

  const rbcEvents = useMemo<RBCEvent[]>(
    () => events.map(toRBCEvent).filter((e): e is RBCEvent => e !== null),
    [events],
  );

  const todayEvents = useMemo(
    () => rbcEvents.filter((ev) => isToday(ev.start)),
    [rbcEvents],
  );

  const handleSelectEvent = useCallback((ev: RBCEvent) => {
    setSelected(ev.raw);
  }, []);

  const handleEventDrop = useCallback(
    (args: EventInteractionArgs<RBCEvent>) => {
      // TODO: wire to PUT /api/painel/agenda/events/:id when backend write endpoint exists
      // eslint-disable-next-line no-console
      console.log('[agenda] event dropped', {
        id: args.event.id,
        title: args.event.title,
        from: { start: args.event.start, end: args.event.end },
        to: { start: args.start, end: args.end },
        isAllDay: args.isAllDay,
      });

      // Optimistic UI: update local state so the move is visible immediately
      const newStart =
        typeof args.start === 'string' ? new Date(args.start) : args.start;
      const newEnd = typeof args.end === 'string' ? new Date(args.end) : args.end;
      setEvents((prev) =>
        prev.map((e) =>
          e.id === args.event.id
            ? {
                ...e,
                start: newStart.toISOString(),
                end: newEnd.toISOString(),
                all_day: args.isAllDay ?? e.all_day,
              }
            : e,
        ),
      );
    },
    [],
  );

  const handleEventResize = useCallback(
    (args: EventInteractionArgs<RBCEvent>) => {
      // TODO: wire to PUT /api/painel/agenda/events/:id when backend write endpoint exists
      // eslint-disable-next-line no-console
      console.log('[agenda] event resized', {
        id: args.event.id,
        title: args.event.title,
        to: { start: args.start, end: args.end },
      });

      const newStart =
        typeof args.start === 'string' ? new Date(args.start) : args.start;
      const newEnd = typeof args.end === 'string' ? new Date(args.end) : args.end;
      setEvents((prev) =>
        prev.map((e) =>
          e.id === args.event.id
            ? { ...e, start: newStart.toISOString(), end: newEnd.toISOString() }
            : e,
        ),
      );
    },
    [],
  );

  const eventPropGetter = useCallback((ev: RBCEvent) => {
    if (ev.raw.status === 'cancelled') {
      return { className: 'singulare-event-cancelled' };
    }
    return {};
  }, []);

  const components = useMemo(
    () => ({
      event: ({ event }: EventProps<RBCEvent>) => (
        <span className="block truncate" title={event.title}>
          {event.title}
        </span>
      ),
    }),
    [],
  );

  if (!me?.tenant_id) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p
            className="text-[12px] uppercase tracking-[0.12em] font-semibold mb-2"
            style={{ color: ACCENT_DEEP }}
          >
            Agendamentos
          </p>
          <h1 className="text-[28px] sm:text-[32px] leading-[1.05] tracking-[-0.025em] font-medium text-zinc-900">
            Agenda
          </h1>
          <p className="text-[14px] text-zinc-500 mt-1.5 max-w-xl">
            Sincronizada em tempo real com seu Google Calendar. O agente IA cria, confirma e cancela
            eventos automaticamente.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchEvents(true)}
            disabled={refreshing}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
            title="Atualizar"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <a
            href="https://calendar.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md text-[12px] font-semibold text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
          >
            Google Calendar <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {!loading && !setupIssue && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-5 sm:p-6 border border-violet-200/60 bg-gradient-to-br from-violet-50/80 to-white"
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p
                className="text-[11px] uppercase tracking-[0.14em] font-semibold mb-1"
                style={{ color: ACCENT_DEEP }}
              >
                Hoje ·{' '}
                {new Date().toLocaleDateString('pt-BR', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long',
                })}
              </p>
              <p className="text-[24px] font-medium tracking-[-0.02em] text-zinc-900">
                {todayEvents.length === 0
                  ? 'Sem compromissos hoje'
                  : `${todayEvents.length} ${
                      todayEvents.length === 1 ? 'compromisso' : 'compromissos'
                    }`}
              </p>
            </div>
            {todayEvents.length > 0 && (
              <div className="flex flex-wrap gap-1.5 max-w-md">
                {todayEvents.slice(0, 4).map((ev) => (
                  <span
                    key={ev.id}
                    className="text-[11px] font-medium px-2 py-1 rounded-md bg-white border border-violet-200/70 text-zinc-700"
                  >
                    {!ev.allDay ? fmtTime(ev.start) + ' · ' : ''}
                    {ev.title.slice(0, 28)}
                    {ev.title.length > 28 ? '…' : ''}
                  </span>
                ))}
                {todayEvents.length > 4 && (
                  <span className="text-[11px] font-medium px-2 py-1 rounded-md text-zinc-500">
                    +{todayEvents.length - 4} mais
                  </span>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Dropdown de profissional (só aparece se >1 doctor) */}
      {doctors.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] uppercase tracking-[0.1em] font-semibold text-zinc-400">
            Profissional:
          </span>
          {doctors.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setActiveDoctor(d.id)}
              disabled={!d.has_calendar}
              className={`h-8 px-3 text-[12.5px] font-semibold rounded-md transition-all ${
                activeDoctor === d.id
                  ? 'bg-violet-100 text-violet-900'
                  : d.has_calendar
                    ? 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                    : 'text-zinc-300 cursor-not-allowed'
              }`}
              title={d.has_calendar ? '' : 'Sem calendar configurado'}
            >
              {d.name}
              {!d.has_calendar && <span className="ml-1.5 text-[9px]">(sem cal)</span>}
            </button>
          ))}
        </div>
      )}

      {/* Setup states */}
      {setupIssue && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6 sm:p-8"
        >
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-[18px] font-semibold text-zinc-900 mb-1.5">
                {setupIssue.type === 'no_service_account' &&
                  'Service Account do Google não configurado'}
                {setupIssue.type === 'no_calendar_access' &&
                  'Compartilhe o calendar com o Service Account'}
                {setupIssue.type === 'no_calendar' && 'Profissional sem calendar_id'}
                {setupIssue.type === 'no_doctor' && 'Nenhum profissional cadastrado'}
              </h2>
              <p className="text-[14px] text-zinc-600 leading-relaxed mb-3">
                {setupIssue.message}
              </p>

              {setupIssue.type === 'no_calendar_access' && setupIssue.share_with && (
                <div className="rounded-lg bg-white border border-amber-200 p-3 my-3 font-mono text-[12.5px] text-zinc-800 break-all select-all">
                  {setupIssue.share_with}
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                {setupIssue.type === 'no_doctor' && (
                  <Link
                    href="/painel/profissionais"
                    className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-white text-[13px] font-semibold transition-all hover:brightness-110"
                    style={{
                      background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP})`,
                    }}
                  >
                    Cadastrar profissional
                  </Link>
                )}
                {(setupIssue.type === 'no_calendar' ||
                  setupIssue.type === 'no_calendar_access') && (
                  <Link
                    href="/painel/profissionais"
                    className="h-9 px-4 rounded-lg border border-zinc-300 text-zinc-900 text-[13px] font-semibold inline-flex items-center hover:border-zinc-900 transition-all"
                  >
                    Editar profissional
                  </Link>
                )}
                {setupIssue.type === 'no_service_account' && (
                  <a
                    href="https://console.cloud.google.com/iam-admin/serviceaccounts"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 h-9 px-4 rounded-lg border border-zinc-300 text-zinc-900 text-[13px] font-semibold hover:border-zinc-900 transition-all"
                  >
                    Abrir Google Cloud Console
                  </a>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {loading && (
        <div className="rounded-2xl border border-black/[0.07] bg-white p-12 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
          <span className="ml-3 text-[13px] text-zinc-500">Carregando sua agenda…</span>
        </div>
      )}

      {!loading && !setupIssue && rbcEvents.length === 0 && (
        <div className="rounded-2xl border border-black/[0.07] bg-white p-10 sm:p-14 text-center">
          <div
            className="inline-flex h-14 w-14 items-center justify-center rounded-full mb-5"
            style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
          >
            <CalendarIcon className="w-6 h-6" />
          </div>
          <h2 className="text-[18px] font-semibold text-zinc-900 mb-2">
            Sem eventos nos próximos 60 dias
          </h2>
          <p className="text-[14px] text-zinc-500 max-w-md mx-auto leading-relaxed">
            Quando o agente IA marcar a primeira consulta no WhatsApp, ela aparece aqui em tempo
            real. Você também pode arrastar eventos para reagendar.
          </p>
        </div>
      )}

      {!loading && !setupIssue && (
        <div
          className={
            rbcEvents.length === 0
              ? 'hidden'
              : 'singulare-calendar-wrap h-[640px] sm:h-[720px]'
          }
        >
          <DnDCalendar
            className="singulare-calendar"
            localizer={localizer}
            culture="pt-BR"
            messages={messages}
            events={rbcEvents}
            startAccessor="start"
            endAccessor="end"
            allDayAccessor="allDay"
            titleAccessor="title"
            view={view}
            onView={(v) => setView(v)}
            date={date}
            onNavigate={(d) => setDate(d)}
            views={['month', 'week', 'day']}
            defaultView="month"
            popup
            selectable
            resizable
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
            onSelectEvent={handleSelectEvent}
            eventPropGetter={eventPropGetter}
            components={components}
            style={{ height: '100%' }}
          />
        </div>
      )}

      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
            />
            <motion.div
              className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[480px] bg-white p-6 overflow-y-auto"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 280, damping: 30 }}
            >
              <div className="flex items-start justify-between gap-3 mb-5">
                <div
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
                >
                  {selected.status === 'cancelled' ? (
                    <XCircle className="w-4 h-4" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="h-9 px-3 -mr-2 inline-flex items-center text-[13px] font-medium text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-md"
                >
                  Fechar
                </button>
              </div>
              <h2 className="text-[22px] font-medium tracking-[-0.02em] text-zinc-900 mb-1.5 leading-snug">
                {selected.title}
              </h2>
              <p className="text-[13px] text-zinc-500 mb-5">
                {selected.start && (
                  <>
                    {new Date(selected.start).toLocaleDateString('pt-BR', {
                      weekday: 'long',
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                    {!selected.all_day && (
                      <>
                        {' '}
                        · {fmtTime(new Date(selected.start))}
                        {selected.end ? ' – ' + fmtTime(new Date(selected.end)) : ''}
                      </>
                    )}
                  </>
                )}
              </p>

              {selected.location && (
                <div className="flex items-start gap-2.5 py-2.5 border-t border-black/[0.05]">
                  <MapPin className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" />
                  <span className="text-[14px] text-zinc-700">{selected.location}</span>
                </div>
              )}

              {selected.attendees.length > 0 && (
                <div className="flex items-start gap-2.5 py-2.5 border-t border-black/[0.05]">
                  <Users className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" />
                  <div className="text-[14px] text-zinc-700">
                    <div className="text-[12px] text-zinc-400 mb-1">Participantes</div>
                    {selected.attendees.map((a, i) => (
                      <div key={i}>{a}</div>
                    ))}
                  </div>
                </div>
              )}

              {selected.description && (
                <div className="py-3 border-t border-black/[0.05]">
                  <div className="text-[12px] text-zinc-400 mb-1.5">Descrição</div>
                  <p className="text-[14px] text-zinc-700 whitespace-pre-wrap leading-relaxed">
                    {selected.description}
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-2 mt-6">
                {selected.meet_link && (
                  <a
                    href={selected.meet_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-11 px-4 rounded-lg bg-emerald-600 text-white text-[14px] font-semibold inline-flex items-center justify-center gap-2 hover:brightness-110 transition-all"
                  >
                    <Video className="w-4 h-4" />
                    Entrar no Google Meet
                  </a>
                )}
                {selected.link && (
                  <a
                    href={selected.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-11 px-4 rounded-lg border border-zinc-300 text-zinc-900 text-[14px] font-semibold inline-flex items-center justify-center gap-2 hover:border-zinc-900 transition-all"
                  >
                    Abrir no Google Calendar
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AgendaPage() {
  return (
    <Suspense
      fallback={
        <div className="h-8 w-8 rounded-full border-2 border-zinc-200 border-t-zinc-900 animate-spin" />
      }
    >
      <AgendaInner />
    </Suspense>
  );
}
