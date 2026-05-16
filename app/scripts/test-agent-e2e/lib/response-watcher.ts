// Polling em n8n_historico_mensagens esperando a próxima mensagem AI surgir.

import { config } from '../config.js';
import { supabase } from './supabase.js';
import type { ScenarioContext } from '../types.js';

export type AgentMessage = {
  id: number;
  content: string;
  createdAt: string;
};

/**
 * Espera a primeira mensagem AI desta sessão criada depois de `since`.
 * Retorna a mensagem ou null se timeout.
 */
export async function waitForAgentResponse(
  ctx: ScenarioContext,
  since: Date,
): Promise<AgentMessage | null> {
  const start = Date.now();
  while (Date.now() - start < config.watcher.timeoutMs) {
    const { data, error } = await supabase
      .from('n8n_historico_mensagens')
      .select('id, message, created_at')
      .eq('session_id', ctx.sessionId)
      .gt('created_at', since.toISOString())
      .order('created_at', { ascending: true })
      .limit(20);

    if (error) {
      throw new Error(`Erro consultando histórico: ${error.message}`);
    }

    for (const row of data || []) {
      const msg = row.message as any;
      const type = msg?.type;
      const content = msg?.content || msg?.data?.content || '';
      if (type === 'ai' && typeof content === 'string' && content.trim().length > 0) {
        return {
          id: row.id,
          content,
          createdAt: row.created_at,
        };
      }
    }

    await sleep(config.watcher.pollIntervalMs);
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
