import type { Scenario } from '../types.js';
import { GLOBAL_BLACKLIST } from '../types.js';
import { seedKnownPatient } from '../lib/fixtures.js';

export const scenarios: Scenario[] = [
  {
    id: 'C06',
    category: 'conhecido',
    title: 'Volta pra agendar (saudação simples, já tem booking)',
    expected: 'Cumprimenta pelo nome, oferece opções, NÃO pede nome/DOB de novo',
    antiExpected: 'Trata como novo paciente e pede dados',
    setup: async (ctx) => {
      await seedKnownPatient(ctx, { name: 'Camila Conhecida', birth: '1985-06-10', daysAgo: 45, status: 'completed' });
    },
    turns: [{ patient: 'Oi' }],
    assertions: [
      { kind: 'response_not_empty' },
      { kind: 'response_does_not_contain', strings: GLOBAL_BLACKLIST },
      { kind: 'llm_judge', criteria: 'O agente reconheceu Camila como paciente conhecida (pelo nome ou contexto) e NÃO pediu nome/DOB de novo? Pode oferecer agendar ou perguntar como ajudar.' },
    ],
  },

  {
    id: 'C07',
    category: 'conhecido',
    title: 'Pergunta sobre próxima consulta (com booking futuro)',
    expected: 'Responde data da próxima consulta',
    setup: async (ctx) => {
      await seedKnownPatient(ctx, { name: 'Rodrigo Futuro', birth: '1979-02-20', daysAgo: -10, status: 'booked' });
    },
    turns: [{ patient: 'Quando é minha próxima consulta?' }],
    assertions: [
      { kind: 'response_not_empty' },
      { kind: 'response_does_not_contain', strings: GLOBAL_BLACKLIST },
      { kind: 'llm_judge', criteria: 'O agente respondeu com a data da próxima consulta (deve ser ~10 dias no futuro), reconhecendo Rodrigo como paciente conhecido?' },
    ],
  },

  {
    id: 'C08',
    category: 'conhecido',
    title: 'Pede remarcar consulta existente',
    expected: 'Reconhece pedido de remarcação, oferece slots ou pergunta nova preferência',
    setup: async (ctx) => {
      await seedKnownPatient(ctx, { name: 'Fernanda Remarca', birth: '1990-08-15', daysAgo: -5, status: 'booked' });
    },
    turns: [{ patient: 'Preciso remarcar minha consulta' }],
    assertions: [
      { kind: 'response_not_empty' },
      { kind: 'response_does_not_contain', strings: GLOBAL_BLACKLIST },
      { kind: 'llm_judge', criteria: 'O agente reconheceu Fernanda como paciente, entendeu o pedido de remarcação e ofereceu próximos passos (data preferida, slots disponíveis) sem pedir dados de novo?' },
    ],
  },

  {
    id: 'C09',
    category: 'conhecido',
    title: 'Pede cancelar consulta',
    expected: 'Confirma intenção antes de cancelar',
    setup: async (ctx) => {
      await seedKnownPatient(ctx, { name: 'Sergio Cancela', birth: '1971-12-03', daysAgo: -7, status: 'booked' });
    },
    turns: [{ patient: 'Quero cancelar minha consulta' }],
    assertions: [
      { kind: 'response_not_empty' },
      { kind: 'response_does_not_contain', strings: GLOBAL_BLACKLIST },
      { kind: 'llm_judge', criteria: 'O agente reconheceu o pedido de cancelamento, confirmou a intenção (pediu confirmação explícita) antes de cancelar, e mencionou a data da consulta a cancelar?' },
    ],
  },

  {
    id: 'C10',
    category: 'conhecido',
    title: 'Retorno gratuito (consulta há < 30 dias)',
    expected: 'Oferece retorno gratuito (return_is_free=true, 30 dias)',
    setup: async (ctx) => {
      await seedKnownPatient(ctx, { name: 'Patricia Retorno', birth: '1982-04-25', daysAgo: 15, status: 'completed' });
    },
    turns: [
      { patient: 'Oi, vim agendar de novo' },
    ],
    assertions: [
      { kind: 'response_not_empty' },
      { kind: 'response_does_not_contain', strings: GLOBAL_BLACKLIST },
      { kind: 'llm_judge', criteria: 'O agente reconheceu que Patricia teve consulta há 15 dias (dentro dos 30 dias de retorno gratuito) e ofereceu retorno gratuito (R$ 0, 30 minutos), em vez de cobrar consulta nova de R$ 300?' },
    ],
  },
];
