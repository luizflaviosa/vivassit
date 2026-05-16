// Avaliadores de assertions: mecânicas (string/booking) + LLM judge.

import { config } from '../config.js';
import { supabase } from './supabase.js';
import { judgeResponse } from './llm-judge.js';
import type { Assertion, AssertionResult, ScenarioContext } from '../types.js';

export async function evaluateAssertion(
  ctx: ScenarioContext,
  assertion: Assertion,
  agentResponses: string[],
): Promise<AssertionResult> {
  const lastResponse = agentResponses[agentResponses.length - 1] || '';
  const allResponses = agentResponses.join('\n---\n');

  switch (assertion.kind) {
    case 'response_does_not_contain': {
      const found = assertion.strings.filter(s => allResponses.toLowerCase().includes(s.toLowerCase()));
      if (found.length > 0) {
        return {
          assertion,
          passed: false,
          reason: `Resposta contém strings proibidas: ${found.join(', ')}`,
        };
      }
      return { assertion, passed: true };
    }

    case 'response_contains_any': {
      const found = assertion.strings.some(s => allResponses.toLowerCase().includes(s.toLowerCase()));
      return {
        assertion,
        passed: found,
        reason: found ? undefined : `Nenhuma das esperadas encontrada: ${assertion.strings.join(', ')}`,
      };
    }

    case 'response_contains_all': {
      const missing = assertion.strings.filter(s => !allResponses.toLowerCase().includes(s.toLowerCase()));
      return {
        assertion,
        passed: missing.length === 0,
        reason: missing.length === 0 ? undefined : `Faltando: ${missing.join(', ')}`,
      };
    }

    case 'response_not_empty': {
      return {
        assertion,
        passed: lastResponse.trim().length > 0,
        reason: lastResponse.trim().length > 0 ? undefined : 'Resposta vazia',
      };
    }

    case 'booking_created': {
      const { count } = await supabase
        .from('doctor_bookings')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', config.tenant.id)
        .eq('patient_phone', ctx.patientPhone);
      return {
        assertion,
        passed: (count || 0) > 0,
        reason: (count || 0) > 0 ? undefined : 'Nenhum booking encontrado',
      };
    }

    case 'booking_not_created': {
      const { count } = await supabase
        .from('doctor_bookings')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', config.tenant.id)
        .eq('patient_phone', ctx.patientPhone);
      return {
        assertion,
        passed: (count || 0) === 0,
        reason: (count || 0) === 0 ? undefined : `Esperado 0 bookings, achei ${count}`,
      };
    }

    case 'no_duplicated_response': {
      const seen = new Set<string>();
      for (const r of agentResponses) {
        const key = r.trim().slice(0, 80);
        if (seen.has(key)) {
          return {
            assertion,
            passed: false,
            reason: `Resposta duplicada detectada: ${key.slice(0, 60)}...`,
          };
        }
        seen.add(key);
      }
      return { assertion, passed: true };
    }

    case 'llm_judge': {
      if (!config.judge.apiKey) {
        return {
          assertion,
          passed: true,
          reason: 'SKIPPED — GOOGLE_API_KEY/GEMINI_API_KEY ausente no .env.local',
        };
      }
      // Contexto = TODAS as respostas EXCETO a última (que está em lastResponse).
      // Sem isso, judge vê a mesma resposta duplicada e marca como "repetida".
      const priorResponses = agentResponses.slice(0, -1);
      const context = priorResponses.length > 0
        ? priorResponses.map((r, i) => `Turn ${i + 1}: ${r}`).join('\n---\n')
        : undefined;
      const verdict = await judgeResponse(assertion.criteria, lastResponse, context);
      return {
        assertion,
        passed: verdict.passed,
        reason: verdict.reason,
      };
    }
  }
}
