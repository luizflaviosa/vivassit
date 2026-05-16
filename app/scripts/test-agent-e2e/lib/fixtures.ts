// Construtor do payload Chatwoot que o webhook do P01 espera.
// Shape derivado do nó Info do workflow 1ZTMCmNUmOCx36WV.

import { config } from '../config.js';
import { supabase } from './supabase.js';
import type { ScenarioContext, Turn } from '../types.js';

const TENANT_E2E_DOCTOR_ID = '741aaa58-e9d2-4a9f-9ba1-ba3217fea0ae';

/**
 * Working days da Dra. Teste E2E: seg(1), qui(4), sex(5). 0=dom 6=sab.
 */
const WORKING_DOWS = new Set([1, 4, 5]);

/**
 * Avança/recua dias até cair em dia útil. Garante slot_start em working_hours.
 */
function snapToWorkingDay(d: Date, direction: 1 | -1): Date {
  const out = new Date(d);
  let safetyN = 14;
  while (!WORKING_DOWS.has(out.getUTCDay()) && safetyN-- > 0) {
    out.setUTCDate(out.getUTCDate() + direction);
  }
  return out;
}

/**
 * Insere booking pré-existente pra simular paciente conhecido.
 * `daysAgo` positivo = passado, negativo = futuro.
 * Garante que slot_start cai em seg/qui/sex 14h BRT (working_hours).
 */
export async function seedKnownPatient(
  ctx: ScenarioContext,
  opts: {
    name: string;
    birth: string; // YYYY-MM-DD
    daysAgo?: number; // padrão 15 (paciente recente)
    status?: 'booked' | 'confirmed' | 'completed' | 'no_show';
  },
): Promise<void> {
  const daysAgo = opts.daysAgo ?? 15;
  const now = new Date();
  let slot_start = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  // Snap pro próximo dia útil (passado: backward; futuro: forward)
  slot_start = snapToWorkingDay(slot_start, daysAgo > 0 ? -1 : 1);
  slot_start.setUTCHours(17, 0, 0, 0); // 14h BRT
  const slot_end = new Date(slot_start.getTime() + 60 * 60 * 1000);

  const { error } = await supabase.from('doctor_bookings').insert({
    tenant_id: config.tenant.id,
    doctor_id: TENANT_E2E_DOCTOR_ID,
    patient_phone: ctx.patientPhone,
    patient_name: opts.name,
    patient_birth: opts.birth,
    slot_start: slot_start.toISOString(),
    slot_end: slot_end.toISOString(),
    duration_minutes: 60,
    status: opts.status ?? 'completed',
    source: 'app',
    conversation_id: String(ctx.conversationId),
  });

  if (error) {
    throw new Error(`Erro ao seed paciente conhecido: ${error.message}`);
  }
}

let _phoneSeq = Date.now() % 100000;

export function nextPatientPhone(): string {
  _phoneSeq += 1;
  // E2E sempre usa +5511900* pra não conflitar com produção (+5511977700XXX é de smoke tests)
  const suffix = String(_phoneSeq).padStart(5, '0');
  return `+551190000${suffix}`;
}

let _convSeq = Math.floor(Date.now() / 1000) % 100000;

export function nextConversationId(): number {
  _convSeq += 1;
  // IDs altos pra não conflitar com produção Chatwoot real (que tá em ~300-500)
  return 900_000 + _convSeq;
}

// Conversation ID será sobrescrito pelo setup do Chatwoot real (quando ativo).
// Mantemos esse fallback pra cenários SKIPPED ou caso a API Chatwoot esteja off.

let _msgSeq = 0;

export function nextMessageId(): string {
  _msgSeq += 1;
  return `e2e-msg-${Date.now()}-${_msgSeq}`;
}

export function createScenarioContext(id: string, category: string): ScenarioContext {
  const patientPhone = nextPatientPhone();
  return {
    id,
    category,
    patientPhone,
    conversationId: nextConversationId(),
    sessionId: `${config.tenant.id}_${patientPhone}`,
    startedAt: new Date(),
  };
}

/**
 * Constrói payload Chatwoot que o webhook P01 aceita.
 * O P01 mapeia campos via $json.body.* — ver nó "Info" do workflow.
 */
export function buildWebhookPayload(ctx: ScenarioContext, turn: Turn) {
  const messageType = turn.reaction ? 'incoming' : 'incoming';
  const content = turn.reaction || turn.patient || '';
  const attachments = turn.attachment ? [
    {
      file_type: turn.attachment.file_type,
      data_url: turn.attachment.data_url,
    },
  ] : (turn.reaction ? [{ file_type: 'reaction' as const, data_url: '' }] : []);

  // IMPORTANTE: NÃO envelopar em `body: {...}` — o N8N webhook já cria
  // `$json.body` automaticamente. Templates do Info node leem `$json.body.account.id`
  // que mapeia pro `account.id` deste objeto que vira o body HTTP.
  return {
    id: nextMessageId(),
    account: {
      id: config.tenant.chatwootAccountId,
      name: config.tenant.id, // chave que casa com tenants.evolution_instance_name
    },
    conversation: {
      id: ctx.conversationId,
      inbox_id: config.tenant.chatwootInboxId,
      labels: [], // sem agente-off — agente deve processar
      meta: {
        sender: {
          phone_number: ctx.patientPhone,
          name: ctx.patientName || ctx.patientPhone,
        },
      },
    },
    sender: {
      type: 'contact',
      id: 9999,
      phone_number: ctx.patientPhone,
    },
    content,
    message_type: messageType,
    created_at: new Date().toISOString(),
    attachments,
    private: false,
  };
}
