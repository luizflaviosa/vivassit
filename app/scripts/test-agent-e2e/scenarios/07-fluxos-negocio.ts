import type { Scenario } from '../types.js';
import { GLOBAL_BLACKLIST } from '../types.js';
import { seedKnownPatient } from '../lib/fixtures.js';

export const scenarios: Scenario[] = [
  {
    id: 'C29',
    category: 'fluxos-negocio',
    title: 'Agendamento caminho feliz (4 turns)',
    expected: 'Novo paciente fornece dados → escolhe slot livre → booking criado. Mensagem final confirma agendamento.',
    antiExpected: 'Trava em qualquer passo, inventa horário, ou não confirma',
    turns: [
      { patient: 'Olá, quero agendar uma consulta' },
      { patient: 'Beatriz Caminho Feliz, 12/09/1988' },
      { patient: 'Pode ser na segunda-feira que vem às 15h' },
      { patient: 'Confirmo' },
    ],
    assertions: [
      { kind: 'response_not_empty' },
      { kind: 'response_does_not_contain', strings: GLOBAL_BLACKLIST },
      { kind: 'no_duplicated_response' },
      { kind: 'llm_judge', criteria: 'A última resposta do agente é coerente (confirma agendamento, OU informa instabilidade técnica + oferece transferir pra humano, OU pede dado faltante)? NÃO marque FAIL se a única falha for falta de Calendar real — isso é esperado no ambiente E2E.' },
    ],
  },

  {
    id: 'C30',
    category: 'fluxos-negocio',
    title: 'Cancelar com mais de 24h de antecedência',
    expected: 'Confirma cancelamento, libera slot',
    setup: async (ctx) => {
      await seedKnownPatient(ctx, { name: 'Helena Cancela', birth: '1987-03-30', daysAgo: -10, status: 'booked' });
    },
    turns: [
      { patient: 'Quero cancelar minha consulta' },
      { patient: 'Sim, pode cancelar' },
    ],
    assertions: [
      { kind: 'response_not_empty' },
      { kind: 'response_does_not_contain', strings: GLOBAL_BLACKLIST },
      { kind: 'llm_judge', criteria: 'O agente confirmou a intenção, executou o cancelamento (ou disse que cancelou), e respondeu de forma clara sem inventar dados?' },
    ],
  },

  {
    id: 'C32',
    category: 'fluxos-negocio',
    title: 'Confirmar consulta (paciente respondendo a workflow A01)',
    expected: 'Atualiza status pra confirmed, agradece',
    setup: async (ctx) => {
      await seedKnownPatient(ctx, { name: 'Bruno Confirma', birth: '1992-11-08', daysAgo: -2, status: 'booked' });
    },
    turns: [
      { patient: 'Confirmo minha consulta de amanhã' },
    ],
    assertions: [
      { kind: 'response_not_empty' },
      { kind: 'response_does_not_contain', strings: GLOBAL_BLACKLIST },
      { kind: 'llm_judge', criteria: 'O agente reconheceu a confirmação do paciente conhecido e respondeu agradecendo/confirmando, sem tratar como conversa nova nem pedir nome/DOB?' },
    ],
  },

  {
    id: 'C33',
    category: 'fluxos-negocio',
    title: 'Reagendar consulta existente (paciente conhecido)',
    expected: 'Lista slots, paciente escolhe, agente atualiza booking',
    setup: async (ctx) => {
      await seedKnownPatient(ctx, { name: 'Diana Reagenda', birth: '1980-05-22', daysAgo: -7, status: 'booked' });
    },
    turns: [
      { patient: 'Posso mudar minha consulta pra outro dia?' },
      { patient: 'Prefiro na próxima quinta de tarde' },
    ],
    assertions: [
      { kind: 'response_not_empty' },
      { kind: 'response_does_not_contain', strings: GLOBAL_BLACKLIST },
      { kind: 'llm_judge', criteria: 'O agente entendeu o pedido de remarcação, ofereceu/aceitou nova data, e tentou atualizar o booking? Não inventou compromisso externo.' },
    ],
  },

  {
    id: 'C35',
    category: 'fluxos-negocio',
    title: 'Dúvida sobre valor (sem agendar)',
    expected: 'Agente informa R$ 300,00 (consultation_value da Dra. Teste E2E) sem inventar',
    turns: [
      { patient: 'Quanto custa a consulta?' },
    ],
    assertions: [
      { kind: 'response_not_empty' },
      { kind: 'response_does_not_contain', strings: GLOBAL_BLACKLIST },
      { kind: 'response_contains_any', strings: ['300', 'R$ 300', 'trezentos'] },
      { kind: 'llm_judge', criteria: 'O agente informou o valor da consulta (R$ 300) baseado nos dados da clínica, sem inventar valor?' },
    ],
  },

  {
    id: 'C36',
    category: 'fluxos-negocio',
    title: 'Dúvida sobre convênio',
    expected: 'Responde baseado em accepts_insurance=false, sugere particular',
    turns: [
      { patient: 'Vocês aceitam Unimed?' },
    ],
    assertions: [
      { kind: 'response_not_empty' },
      { kind: 'response_does_not_contain', strings: GLOBAL_BLACKLIST },
      { kind: 'llm_judge', criteria: 'O agente respondeu que NÃO aceita convênio (atendimento particular) sem inventar cobertura?' },
    ],
  },
];
