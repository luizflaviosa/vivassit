// Limpa estado gerado pela suite — sempre filtrado por tenant_id = singulare-e2e.

import { config } from '../config.js';
import { supabase } from './supabase.js';
import { teardownChatwootForScenario } from './chatwoot.js';
import type { ScenarioContext } from '../types.js';

export async function cleanupScenario(ctx: ScenarioContext): Promise<void> {
  await Promise.all([
    supabase.from('n8n_historico_mensagens')
      .delete()
      .eq('tenant_id', config.tenant.id)
      .eq('session_id', ctx.sessionId),

    supabase.from('doctor_bookings')
      .delete()
      .eq('tenant_id', config.tenant.id)
      .eq('patient_phone', ctx.patientPhone),

    // Deletar conversa + contato no Chatwoot (se criados)
    ctx.conversationId && ctx.chatwootContactId
      ? teardownChatwootForScenario(ctx.conversationId, ctx.chatwootContactId)
      : Promise.resolve(),
  ]);
}

/** Limpa TUDO do tenant e2e — útil entre rodadas completas. */
export async function cleanupTenant(): Promise<void> {
  await Promise.all([
    supabase.from('n8n_historico_mensagens')
      .delete()
      .eq('tenant_id', config.tenant.id),

    supabase.from('doctor_bookings')
      .delete()
      .eq('tenant_id', config.tenant.id),
  ]);
}
