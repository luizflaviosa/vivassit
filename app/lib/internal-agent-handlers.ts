/**
 * Barrel das tools do agente interno. Domínios estão em ./internal-agent/.
 *
 * Mantém a interface pública (HANDLERS, WRITE_HANDLERS, getHandler,
 * getWriteHandler + tipos) que `/api/interno/tools/route.ts` e
 * `/api/interno/tools/confirm/route.ts` consomem.
 */
export type { ToolContext, ToolResult, ProposalCard, WriteHandler } from './internal-agent/shared';

import type { Handler, WriteHandler } from './internal-agent/shared';

import {
  agendaHoje,
  agendaPeriodo,
  horariosLivres,
  consultaReagendar,
  consultaCancelar,
  consultaMarcar,
  bloquearHorario,
  workingHoursAtualizar,
} from './internal-agent/agenda';
import { pacientesCount, pacientesProximos, pacienteCriar } from './internal-agent/pacientes';
import { pagamentosStatus, pagamentosPendentes, cobrancaAvulsa } from './internal-agent/financeiro';
import { documentosListar, documentoGerar, documentoAssinar } from './internal-agent/documentos';
import { npsResumo, reviewsExternos } from './internal-agent/reputacao';
import { medicosListar } from './internal-agent/medicos';

export const HANDLERS: Record<string, Handler> = {
  agenda_hoje: agendaHoje,
  agenda_periodo: agendaPeriodo,
  horarios_livres: horariosLivres,
  pacientes_count: pacientesCount,
  pacientes_proximos: pacientesProximos,
  pagamentos_status: pagamentosStatus,
  pagamentos_pendentes: pagamentosPendentes,
  nps_resumo: npsResumo,
  reviews_externos: reviewsExternos,
  documentos_listar: documentosListar,
  medicos_listar: medicosListar,
};

export const WRITE_HANDLERS: Record<string, WriteHandler> = {
  consulta_reagendar: consultaReagendar,
  consulta_marcar: consultaMarcar,
  consulta_cancelar: consultaCancelar,
  paciente_criar: pacienteCriar,
  cobranca_avulsa: cobrancaAvulsa,
  documento_gerar: documentoGerar,
  documento_assinar: documentoAssinar,
  bloquear_horario: bloquearHorario,
  working_hours_atualizar: workingHoursAtualizar,
};

export function getHandler(name: string): Handler | null {
  return HANDLERS[name] ?? null;
}

export function getWriteHandler(name: string): WriteHandler | null {
  return WRITE_HANDLERS[name] ?? null;
}
