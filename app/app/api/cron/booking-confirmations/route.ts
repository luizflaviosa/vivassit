/**
 * Cron: dispara confirmações WhatsApp 24h antes da consulta (D-1).
 *
 * Roda a cada 30min via Vercel Cron. A cada execução:
 *   1. Lista bookings com slot_start entre NOW+23h e NOW+25h, status=booked|confirmed,
 *      e confirmation_sent_at IS NULL.
 *   2. Pra cada um: chama webhook n8n (CONFIRMATION_WEBHOOK_URL) com payload
 *      { booking_id, patient_phone, patient_name, slot_start, doctor_name, tenant_id }.
 *   3. Marca confirmation_sent_at + confirmation_status='sent' pra não duplicar.
 *
 * O n8n é responsável por:
 *   - Enviar template WhatsApp ("Sua consulta com Dr. X é amanhã às 14h. Confirma?")
 *   - Receber resposta do paciente
 *   - Atualizar confirmation_status via /api/painel/agenda/events/{id} ou tool dedicada
 *
 * Auth: Bearer CRON_SECRET (Vercel envia automaticamente) ou N8N_TO_VERCEL_TOKEN
 * (chamadas manuais).
 *
 * Janela de 23h-25h (não exatamente 24h): cron a cada 30min cobre folga sem missing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function verifyAuth(req: NextRequest): boolean {
  const auth = (req.headers.get('authorization') ?? '').trim();
  const tokens = [
    process.env.CRON_SECRET?.trim(),
    process.env.N8N_TO_VERCEL_TOKEN?.trim(),
  ].filter(Boolean) as string[];
  return tokens.some((t) => auth === `Bearer ${t}`);
}

interface BookingRow {
  id: string;
  tenant_id: string;
  doctor_id: string;
  patient_phone: string;
  patient_name: string | null;
  slot_start: string;
  slot_end: string;
}

async function handle(req: NextRequest): Promise<NextResponse> {
  if (!verifyAuth(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const webhookUrl = process.env.N8N_BOOKING_CONFIRMATION_URL?.trim();
  // Sem webhook configurado, ainda marcamos os bookings pra não acumular
  // (e logamos dry-run). Permite testar a query antes do n8n tá pronto.
  const dryRun = !webhookUrl;

  const supabase = supabaseAdmin();
  const now = new Date();
  const lower = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const upper = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  const { data: bookings, error } = await supabase
    .from('doctor_bookings')
    .select('id, tenant_id, doctor_id, patient_phone, patient_name, slot_start, slot_end')
    .in('status', ['booked', 'confirmed'])
    .is('confirmation_sent_at', null)
    .gte('slot_start', lower.toISOString())
    .lt('slot_start', upper.toISOString())
    .returns<BookingRow[]>();

  if (error) {
    console.error('[booking-confirmations] query erro:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const list = bookings ?? [];

  // Lookup nomes de doctors em batch
  const doctorIds = Array.from(new Set(list.map((b) => b.doctor_id)));
  const doctorNameById = new Map<string, string>();
  if (doctorIds.length > 0) {
    const { data: doctors } = await supabase
      .from('tenant_doctors')
      .select('id, doctor_name')
      .in('id', doctorIds);
    for (const d of doctors ?? []) doctorNameById.set(d.id, d.doctor_name);
  }

  const results: Array<{ booking_id: string; status: 'sent' | 'failed' | 'dry_run'; error?: string }> = [];

  for (const b of list) {
    const payload = {
      booking_id: b.id,
      tenant_id: b.tenant_id,
      doctor_id: b.doctor_id,
      doctor_name: doctorNameById.get(b.doctor_id) ?? 'Profissional',
      patient_phone: b.patient_phone,
      patient_name: b.patient_name,
      slot_start: b.slot_start,
      slot_end: b.slot_end,
    };

    if (dryRun) {
      results.push({ booking_id: b.id, status: 'dry_run' });
      continue;
    }

    try {
      const res = await fetch(webhookUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        results.push({ booking_id: b.id, status: 'failed', error: `n8n ${res.status}: ${txt.slice(0, 80)}` });
        continue;
      }
      // Marca como enviado pra não reenfileirar
      await supabase
        .from('doctor_bookings')
        .update({
          confirmation_sent_at: new Date().toISOString(),
          confirmation_status: 'sent',
          updated_at: new Date().toISOString(),
        })
        .eq('id', b.id);
      results.push({ booking_id: b.id, status: 'sent' });
    } catch (e) {
      results.push({ booking_id: b.id, status: 'failed', error: (e as Error).message });
    }
  }

  return NextResponse.json({
    ok: results.every((r) => r.status !== 'failed'),
    window: { lower: lower.toISOString(), upper: upper.toISOString() },
    dry_run: dryRun,
    eligible: list.length,
    counts: {
      sent: results.filter((r) => r.status === 'sent').length,
      failed: results.filter((r) => r.status === 'failed').length,
      dry_run: results.filter((r) => r.status === 'dry_run').length,
    },
    results,
  });
}

// GET pra Vercel Cron, POST pra chamada manual via n8n
export const GET = handle;
export const POST = handle;
