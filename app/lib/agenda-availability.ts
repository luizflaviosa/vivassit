/**
 * Calculo de slots livres a partir de working_hours menos ocupacoes
 * (doctor_bookings + doctor_schedule_blocks). Usado por horarios_livres,
 * consulta_marcar (validacao), bloquear_horario (preview de conflitos).
 *
 * working_hours esperado em tenant_doctors: { seg: "HH:MM-HH:MM"|"fechado", ter: ..., ... dom: ... }
 */

export interface TimeRange {
  start: Date;
  end: Date;
}

export type DayKey = 'dom' | 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab';

const DAY_KEYS: DayKey[] = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

export function dayKeyOf(d: Date): DayKey {
  return DAY_KEYS[d.getDay()];
}

/**
 * Parse "14:00-18:00" -> {startMin: 840, endMin: 1080} (em minutos do dia).
 * "fechado" ou invalido -> null.
 */
export function parseDayWindow(spec: unknown): { startMin: number; endMin: number } | null {
  if (typeof spec !== 'string') return null;
  const s = spec.trim().toLowerCase();
  if (!s || s === 'fechado') return null;
  const m = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const startMin = Number(m[1]) * 60 + Number(m[2]);
  const endMin = Number(m[3]) * 60 + Number(m[4]);
  if (endMin <= startMin) return null;
  return { startMin, endMin };
}

/**
 * Gera slots de `slotMinutes` cobrindo a janela [startMin, endMin) do dia `date` (na TZ do servidor).
 * Retorna lista de TimeRange.
 */
export function generateDaySlots(date: Date, startMin: number, endMin: number, slotMinutes: number): TimeRange[] {
  const slots: TimeRange[] = [];
  const baseY = date.getFullYear();
  const baseM = date.getMonth();
  const baseD = date.getDate();
  for (let m = startMin; m + slotMinutes <= endMin; m += slotMinutes) {
    const sh = Math.floor(m / 60);
    const sm = m % 60;
    const eh = Math.floor((m + slotMinutes) / 60);
    const em = (m + slotMinutes) % 60;
    slots.push({
      start: new Date(baseY, baseM, baseD, sh, sm, 0, 0),
      end: new Date(baseY, baseM, baseD, eh, em, 0, 0),
    });
  }
  return slots;
}

/**
 * True se r1 e r2 se sobrepoem (qualquer minuto em comum).
 */
export function overlaps(r1: TimeRange, r2: TimeRange): boolean {
  return r1.start < r2.end && r2.start < r1.end;
}

/**
 * Retorna os slots de `slots` que NAO se sobrepoem a NENHUM ocupado em `busy`.
 */
export function subtractBusy(slots: TimeRange[], busy: TimeRange[]): TimeRange[] {
  if (busy.length === 0) return slots;
  return slots.filter((s) => !busy.some((b) => overlaps(s, b)));
}

/**
 * Itera dias entre `start` e `end` (inclusive), pra cada dia consulta
 * working_hours[diaSemana] e gera slots de `slotMinutes`. Retorna o conjunto
 * resultante apos subtrair `busy`.
 */
export function calcAvailableSlots(args: {
  start: Date;
  end: Date;
  workingHours: Record<string, unknown>;
  busy: TimeRange[];
  slotMinutes: number;
}): TimeRange[] {
  const out: TimeRange[] = [];
  const cursor = new Date(args.start.getFullYear(), args.start.getMonth(), args.start.getDate());
  const endDay = new Date(args.end.getFullYear(), args.end.getMonth(), args.end.getDate());
  while (cursor <= endDay) {
    const win = parseDayWindow(args.workingHours[dayKeyOf(cursor)]);
    if (win) {
      const daySlots = generateDaySlots(cursor, win.startMin, win.endMin, args.slotMinutes);
      out.push(...subtractBusy(daySlots, args.busy));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}
