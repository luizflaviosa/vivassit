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
  Plus,
} from 'lucide-react';
import { useMe } from '@/lib/painel-context';
import Link from 'next/link';
import { toast } from 'sonner';

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
  color_id: string | null;
  color_hex: string | null;
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
  calendar_id?: string;
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

// <input type="datetime-local"> usa horário local sem timezone — converter ida/volta.
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInputValue(s: string): Date {
  // s vem como "2026-05-09T14:30" — interpretar como local time
  return new Date(s);
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
  const [view, setView] = useState<View>('week');
  const [date, setDate] = useState<Date>(new Date());
  const [selected, setSelected] = useState<AgendaEvent | null>(null);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [activeDoctor, setActiveDoctor] = useState<string | null>(null);
  // Drawer pra criar novo evento. Quando setado, abre painel lateral.
  const [creating, setCreating] = useState<{ start: Date; end: Date; allDay: boolean } | null>(null);
  const [createForm, setCreateForm] = useState({ title: '', description: '', location: '' });
  const [createSaving, setCreateSaving] = useState(false);
  // Edição inline do evento selecionado: quando true, troca read-only por form.
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<{
    title: string;
    description: string;
    location: string;
    start: Date;
    end: Date;
    allDay: boolean;
  } | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
          calendar_id: json.calendar_id ?? json.doctor?.calendar_id,
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
    setEditing(false);
    setEditForm(null);
  }, []);

  const startEdit = useCallback(() => {
    if (!selected) return;
    setEditForm({
      title: selected.title || '',
      description: selected.description || '',
      location: selected.location || '',
      start: selected.start ? new Date(selected.start) : new Date(),
      end: selected.end ? new Date(selected.end) : new Date(),
      allDay: selected.all_day,
    });
    setEditing(true);
  }, [selected]);

  const handleEditSave = useCallback(async () => {
    if (!selected || !editForm) return;
    if (!editForm.title.trim()) {
      toast.error('Título é obrigatório');
      return;
    }
    setEditSaving(true);
    try {
      const res = await fetch(`/api/painel/agenda/events/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title.trim(),
          description: editForm.description.trim() || null,
          location: editForm.location.trim() || null,
          start: editForm.start.toISOString(),
          end: editForm.end.toISOString(),
          allDay: editForm.allDay,
          doctorId: activeDoctor ?? undefined,
        }),
      });
      const json = await res.json().catch(() => ({ success: false, message: 'Erro' }));
      if (!json.success) {
        toast.error('Não foi possível salvar', { description: json.message });
        return;
      }
      toast.success('Evento atualizado');
      setEditing(false);
      setSelected(null);
      void fetchEvents(true);
    } catch (e) {
      toast.error('Erro de conexão', { description: (e as Error).message });
    } finally {
      setEditSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, editForm, activeDoctor]);

  const handleDelete = useCallback(async () => {
    if (!selected) return;
    if (!confirm(`Excluir "${selected.title}"?`)) return;
    setDeleting(true);
    try {
      const url = activeDoctor
        ? `/api/painel/agenda/events/${selected.id}?doctorId=${activeDoctor}`
        : `/api/painel/agenda/events/${selected.id}`;
      const res = await fetch(url, { method: 'DELETE' });
      const json = await res.json().catch(() => ({ success: false, message: 'Erro' }));
      if (!json.success) {
        toast.error('Não foi possível excluir', { description: json.message });
        return;
      }
      toast.success('Evento excluído');
      setSelected(null);
      void fetchEvents(true);
    } catch (e) {
      toast.error('Erro de conexão', { description: (e as Error).message });
    } finally {
      setDeleting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, activeDoctor]);

  // Clique em slot vazio (ou drag-select) → abre drawer de criação
  const handleSelectSlot = useCallback(
    (slot: { start: Date; end: Date; slots: Date[]; action: string }) => {
      const start = typeof slot.start === 'string' ? new Date(slot.start) : slot.start;
      let end = typeof slot.end === 'string' ? new Date(slot.end) : slot.end;
      // No view 'month' o react-big-calendar passa slots de 1 dia inteiro;
      // no day/week o end é o próximo slot. Garantimos pelo menos 30min default.
      if (end.getTime() - start.getTime() < 30 * 60 * 1000) {
        end = new Date(start.getTime() + 30 * 60 * 1000);
      }
      const allDay = slot.action === 'click' && view === 'month';
      setCreating({ start, end, allDay });
      setCreateForm({ title: '', description: '', location: '' });
    },
    [view],
  );

  const handleCreateEvent = useCallback(async () => {
    if (!creating) return;
    if (!createForm.title.trim()) {
      toast.error('Título é obrigatório');
      return;
    }
    setCreateSaving(true);
    try {
      const res = await fetch('/api/painel/agenda/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: createForm.title.trim(),
          description: createForm.description.trim() || undefined,
          location: createForm.location.trim() || undefined,
          start: creating.start.toISOString(),
          end: creating.end.toISOString(),
          allDay: creating.allDay,
          doctorId: activeDoctor ?? undefined,
        }),
      });
      const json = await res.json().catch(() => ({ success: false, message: 'Erro ao parsear resposta' }));
      if (!json.success) {
        toast.error('Não foi possível criar o evento', {
          description: json.message ?? 'Tenta de novo.',
        });
        return;
      }
      toast.success('Evento criado');
      setCreating(null);
      // Refetch — em ~5s o webhook do Google também sincroniza pro tenant_calendar_events
      void fetchEvents(true);
    } catch (e) {
      toast.error('Erro de conexão', { description: (e as Error).message });
    } finally {
      setCreateSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creating, createForm, activeDoctor]);

  const saveEventUpdate = useCallback(
    async (
      eventId: string,
      prevEvent: AgendaEvent,
      newStart: Date,
      newEnd: Date,
      allDay: boolean,
    ) => {
      const res = await fetch(`/api/painel/agenda/events/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: newStart.toISOString(),
          end: newEnd.toISOString(),
          allDay,
          doctorId: activeDoctor ?? undefined,
        }),
      });
      const json = await res.json().catch(() => ({ success: false }));
      if (!json.success) {
        // Rollback optimistic update
        setEvents((prev) =>
          prev.map((e) => (e.id === eventId ? prevEvent : e)),
        );
        toast.error('Não foi possível salvar o reagendamento', {
          description: json.message ?? 'Verifique sua conexão e tente novamente.',
        });
      }
    },
    [activeDoctor],
  );

  const handleEventDrop = useCallback(
    (args: EventInteractionArgs<RBCEvent>) => {
      const newStart = typeof args.start === 'string' ? new Date(args.start) : args.start;
      const newEnd = typeof args.end === 'string' ? new Date(args.end) : args.end;
      const allDay = args.isAllDay ?? args.event.raw.all_day;
      const prev = args.event.raw;

      // Optimistic update
      setEvents((prevEvents) =>
        prevEvents.map((e) =>
          e.id === args.event.id
            ? { ...e, start: newStart.toISOString(), end: newEnd.toISOString(), all_day: allDay }
            : e,
        ),
      );

      saveEventUpdate(args.event.id, prev, newStart, newEnd, allDay);
    },
    [saveEventUpdate],
  );

  const handleEventResize = useCallback(
    (args: EventInteractionArgs<RBCEvent>) => {
      const newStart = typeof args.start === 'string' ? new Date(args.start) : args.start;
      const newEnd = typeof args.end === 'string' ? new Date(args.end) : args.end;
      const prev = args.event.raw;

      // Optimistic update
      setEvents((prevEvents) =>
        prevEvents.map((e) =>
          e.id === args.event.id
            ? { ...e, start: newStart.toISOString(), end: newEnd.toISOString() }
            : e,
        ),
      );

      saveEventUpdate(args.event.id, prev, newStart, newEnd, prev.all_day);
    },
    [saveEventUpdate],
  );

  const eventPropGetter = useCallback((ev: RBCEvent) => {
    if (ev.raw.status === 'cancelled') {
      return { className: 'singulare-event-cancelled' };
    }
    // Preserva a cor que o profissional definiu no Google Calendar (colorId).
    // Sem colorId, react-big-calendar usa o default do CSS (violeta Singulare).
    if (ev.raw.color_hex) {
      return {
        style: {
          backgroundColor: ev.raw.color_hex,
          borderColor: ev.raw.color_hex,
          color: '#ffffff',
        },
      };
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
            onClick={() => {
              const start = new Date();
              start.setMinutes(0, 0, 0);
              start.setHours(start.getHours() + 1);
              const end = new Date(start.getTime() + 60 * 60 * 1000);
              setCreating({ start, end, allDay: false });
              setCreateForm({ title: '', description: '', location: '' });
            }}
            disabled={!!setupIssue}
            className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md text-[12px] font-semibold text-white hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: ACCENT }}
          >
            <Plus className="w-3.5 h-3.5" /> Novo
          </button>
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
                <div className="space-y-3 my-3">
                  <div className="rounded-lg bg-white border border-amber-200 p-3 font-mono text-[12.5px] text-zinc-800 break-all flex items-center justify-between gap-3">
                    <span className="select-all flex-1 min-w-0">{setupIssue.share_with}</span>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(setupIssue.share_with!);
                          toast.success('Email copiado pra área de transferência');
                        } catch {
                          toast.error('Não consegui copiar — selecione manualmente');
                        }
                      }}
                      className="shrink-0 h-7 px-2.5 rounded-md text-[11.5px] font-semibold border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 transition-colors"
                    >
                      Copiar
                    </button>
                  </div>
                  <div className="text-[12.5px] text-zinc-600 leading-relaxed">
                    <strong className="text-zinc-800">3 cliques no Google:</strong>{' '}
                    abre o calendar → "Compartilhar com pessoas e grupos específicos" → cola este email com permissão "Ver todos os detalhes do evento".
                  </div>
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
                {setupIssue.type === 'no_calendar_access' && setupIssue.calendar_id && (
                  <a
                    href={`https://calendar.google.com/calendar/u/0/r/settings/calendar/${btoa(setupIssue.calendar_id).replace(/=/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-white text-[13px] font-semibold transition-all hover:brightness-110"
                    style={{
                      background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP})`,
                    }}
                  >
                    Abrir Google Calendar
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                {setupIssue.type === 'no_calendar_access' && (
                  <button
                    type="button"
                    onClick={() => {
                      toast.loading('Verificando acesso…', { id: 'verify-cal' });
                      fetchEvents().then(() => {
                        toast.dismiss('verify-cal');
                        if (!setupIssue) toast.success('Acesso concedido — agenda carregada!');
                      });
                    }}
                    className="h-9 px-4 rounded-lg border border-zinc-300 text-zinc-900 text-[13px] font-semibold inline-flex items-center gap-1.5 hover:border-zinc-900 transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Já compartilhei — verificar
                  </button>
                )}
                {setupIssue.type === 'no_calendar' && (
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

      {!loading && !setupIssue && (
        <div className="singulare-calendar-wrap h-[calc(100vh-320px)] min-h-[640px]">
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
            defaultView="week"
            min={new Date(1970, 0, 1, 7, 0, 0)}
            max={new Date(1970, 0, 1, 20, 0, 0)}
            step={30}
            timeslots={2}
            scrollToTime={new Date(1970, 0, 1, 8, 0, 0)}
            popup
            selectable
            resizable
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
            onSelectEvent={handleSelectEvent}
            onSelectSlot={handleSelectSlot}
            eventPropGetter={eventPropGetter}
            components={components}
            style={{ height: '100%' }}
          />
        </div>
      )}

      <AnimatePresence>
        {creating && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !createSaving && setCreating(null)}
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
                  <Plus className="w-4 h-4" />
                </div>
                <button
                  type="button"
                  onClick={() => setCreating(null)}
                  disabled={createSaving}
                  className="h-9 px-3 -mr-2 inline-flex items-center text-[13px] font-medium text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-md disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
              <h2 className="text-[22px] font-medium tracking-[-0.02em] text-zinc-900 mb-1.5 leading-snug">
                Novo evento
              </h2>
              <p className="text-[13px] text-zinc-500 mb-5">
                {creating.start.toLocaleDateString('pt-BR', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long',
                })}
                {!creating.allDay && (
                  <>
                    {' '}
                    · {fmtTime(creating.start)} – {fmtTime(creating.end)}
                  </>
                )}
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-[12px] font-semibold text-zinc-500 uppercase tracking-[0.08em] mb-1.5">
                    Título
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={createForm.title}
                    onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Bloqueio almoço, Consulta João, Folga..."
                    className="w-full h-11 px-3 text-[14px] border border-zinc-300 rounded-lg focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-zinc-500 uppercase tracking-[0.08em] mb-1.5">
                    Início
                  </label>
                  <input
                    type="datetime-local"
                    value={toLocalInputValue(creating.start)}
                    onChange={(e) =>
                      setCreating((c) =>
                        c ? { ...c, start: fromLocalInputValue(e.target.value) } : c,
                      )
                    }
                    className="w-full h-11 px-3 text-[14px] border border-zinc-300 rounded-lg focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-zinc-500 uppercase tracking-[0.08em] mb-1.5">
                    Fim
                  </label>
                  <input
                    type="datetime-local"
                    value={toLocalInputValue(creating.end)}
                    onChange={(e) =>
                      setCreating((c) =>
                        c ? { ...c, end: fromLocalInputValue(e.target.value) } : c,
                      )
                    }
                    className="w-full h-11 px-3 text-[14px] border border-zinc-300 rounded-lg focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-zinc-500 uppercase tracking-[0.08em] mb-1.5">
                    Descrição (opcional)
                  </label>
                  <textarea
                    value={createForm.description}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, description: e.target.value }))
                    }
                    rows={3}
                    className="w-full px-3 py-2.5 text-[14px] border border-zinc-300 rounded-lg focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-zinc-500 uppercase tracking-[0.08em] mb-1.5">
                    Local (opcional)
                  </label>
                  <input
                    type="text"
                    value={createForm.location}
                    onChange={(e) => setCreateForm((f) => ({ ...f, location: e.target.value }))}
                    placeholder="Sala 1, online, endereço..."
                    className="w-full h-11 px-3 text-[14px] border border-zinc-300 rounded-lg focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleCreateEvent}
                disabled={createSaving || !createForm.title.trim()}
                className="mt-6 w-full h-11 px-4 rounded-lg text-white text-[14px] font-semibold inline-flex items-center justify-center gap-2 hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: ACCENT }}
              >
                {createSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Criando...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" /> Criar evento
                  </>
                )}
              </button>
              <p className="text-[12px] text-zinc-400 mt-3 leading-relaxed">
                Vai ser criado no Google Calendar do profissional. Em ~5s o sistema sincroniza
                automaticamente — o assistente passa a respeitar o bloqueio.
              </p>
            </motion.div>
          </>
        )}
        {selected && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !editSaving && !deleting && setSelected(null)}
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
                  disabled={editSaving || deleting}
                  className="h-9 px-3 -mr-2 inline-flex items-center text-[13px] font-medium text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-md disabled:opacity-50"
                >
                  Fechar
                </button>
              </div>

              {!editing ? (
                <>
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
                    <button
                      type="button"
                      onClick={startEdit}
                      className="h-11 px-4 rounded-lg text-white text-[14px] font-semibold inline-flex items-center justify-center gap-2 hover:brightness-110 transition-all"
                      style={{ background: ACCENT }}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="h-11 px-4 rounded-lg border border-red-200 text-red-700 text-[14px] font-semibold inline-flex items-center justify-center gap-2 hover:bg-red-50 transition-all disabled:opacity-50"
                    >
                      {deleting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Excluindo...
                        </>
                      ) : (
                        'Excluir'
                      )}
                    </button>
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
                        className="h-11 px-4 rounded-lg border border-zinc-300 text-zinc-700 text-[13px] font-medium inline-flex items-center justify-center gap-2 hover:border-zinc-900 transition-all"
                      >
                        Abrir no Google Calendar
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-[22px] font-medium tracking-[-0.02em] text-zinc-900 mb-5 leading-snug">
                    Editar evento
                  </h2>
                  {editForm && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[12px] font-semibold text-zinc-500 uppercase tracking-[0.08em] mb-1.5">
                          Título
                        </label>
                        <input
                          type="text"
                          autoFocus
                          value={editForm.title}
                          onChange={(e) =>
                            setEditForm((f) => (f ? { ...f, title: e.target.value } : f))
                          }
                          className="w-full h-11 px-3 text-[14px] border border-zinc-300 rounded-lg focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                        />
                      </div>

                      <div>
                        <label className="block text-[12px] font-semibold text-zinc-500 uppercase tracking-[0.08em] mb-1.5">
                          Início
                        </label>
                        <input
                          type="datetime-local"
                          value={toLocalInputValue(editForm.start)}
                          onChange={(e) =>
                            setEditForm((f) =>
                              f ? { ...f, start: fromLocalInputValue(e.target.value) } : f,
                            )
                          }
                          className="w-full h-11 px-3 text-[14px] border border-zinc-300 rounded-lg focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                        />
                      </div>
                      <div>
                        <label className="block text-[12px] font-semibold text-zinc-500 uppercase tracking-[0.08em] mb-1.5">
                          Fim
                        </label>
                        <input
                          type="datetime-local"
                          value={toLocalInputValue(editForm.end)}
                          onChange={(e) =>
                            setEditForm((f) =>
                              f ? { ...f, end: fromLocalInputValue(e.target.value) } : f,
                            )
                          }
                          className="w-full h-11 px-3 text-[14px] border border-zinc-300 rounded-lg focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                        />
                      </div>

                      <div>
                        <label className="block text-[12px] font-semibold text-zinc-500 uppercase tracking-[0.08em] mb-1.5">
                          Descrição
                        </label>
                        <textarea
                          value={editForm.description}
                          onChange={(e) =>
                            setEditForm((f) => (f ? { ...f, description: e.target.value } : f))
                          }
                          rows={3}
                          className="w-full px-3 py-2.5 text-[14px] border border-zinc-300 rounded-lg focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 resize-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[12px] font-semibold text-zinc-500 uppercase tracking-[0.08em] mb-1.5">
                          Local
                        </label>
                        <input
                          type="text"
                          value={editForm.location}
                          onChange={(e) =>
                            setEditForm((f) => (f ? { ...f, location: e.target.value } : f))
                          }
                          className="w-full h-11 px-3 text-[14px] border border-zinc-300 rounded-lg focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 mt-6">
                    <button
                      type="button"
                      onClick={handleEditSave}
                      disabled={editSaving || !editForm?.title.trim()}
                      className="h-11 px-4 rounded-lg text-white text-[14px] font-semibold inline-flex items-center justify-center gap-2 hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ background: ACCENT }}
                    >
                      {editSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Salvando...
                        </>
                      ) : (
                        'Salvar alterações'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(false);
                        setEditForm(null);
                      }}
                      disabled={editSaving}
                      className="h-11 px-4 rounded-lg border border-zinc-300 text-zinc-700 text-[14px] font-semibold inline-flex items-center justify-center hover:border-zinc-900 transition-all disabled:opacity-50"
                    >
                      Cancelar edição
                    </button>
                  </div>
                </>
              )}
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
