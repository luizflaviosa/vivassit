import type { Scenario } from '../types.js';
import { GLOBAL_BLACKLIST } from '../types.js';

export const scenarios: Scenario[] = [
  {
    id: 'C37',
    category: 'tipos-mensagem',
    title: 'Mensagem ambígua "Tanto faz"',
    expected: 'Tenant singulare-e2e só tem 1 médica (Dra. Teste E2E). Pelo PASSO 2 do SOP, agente deve ASSUMIR essa profissional quando o paciente diz "tanto faz" e seguir o fluxo de agendamento.',
    turns: [
      { patient: 'Quero agendar' },
      { patient: 'João Teste, 10/01/1990' },
      { patient: 'Qual dia tem?' },
      { patient: 'Tanto faz' },
    ],
    assertions: [
      { kind: 'response_not_empty' },
      { kind: 'response_does_not_contain', strings: GLOBAL_BLACKLIST },
      { kind: 'llm_judge', criteria: 'A clínica tem apenas UMA profissional (Dra. Teste E2E). O agente assumiu corretamente a Dra. Teste E2E e seguiu pro próximo passo (pedir data/horário ou listar slots)? Pelo SOP do prompt, assumir o único profissional quando o paciente diz "tanto faz" é o comportamento ESPERADO. Considere PASS se o agente confirmou a Dra. Teste E2E e perguntou data ou ofereceu slots.' },
    ],
  },

  {
    id: 'C38',
    category: 'tipos-mensagem',
    title: 'Mensagem longa com 3 perguntas no mesmo turno',
    expected: 'Agente responde TODAS as 3 perguntas em ordem, sem pular nenhuma',
    turns: [
      { patient: 'Oi, tudo bem? Queria saber: vocês atendem por convênio? Qual o valor da consulta? E onde é o consultório?' },
    ],
    assertions: [
      { kind: 'response_not_empty' },
      { kind: 'response_does_not_contain', strings: GLOBAL_BLACKLIST },
      { kind: 'llm_judge', criteria: 'O agente respondeu às TRÊS perguntas (convênio, valor, endereço)? Pular qualquer uma é FAIL.' },
    ],
  },

  {
    id: 'C39',
    category: 'tipos-mensagem',
    title: 'Mensagem com gírias coloquiais',
    expected: 'Agente mantém tom acolhedor e profissional, normaliza linguagem sem imitar gírias',
    turns: [
      { patient: 'Eae mano, posso marcar uma consulta aí?' },
    ],
    assertions: [
      { kind: 'response_not_empty' },
      { kind: 'response_does_not_contain', strings: [...GLOBAL_BLACKLIST, 'mano', 'eae'] },
      { kind: 'llm_judge', criteria: 'O agente manteve tom profissional e acolhedor sem imitar a gíria do paciente, e progrediu pedindo dados pra agendamento?' },
    ],
  },

  {
    id: 'C42',
    category: 'tipos-mensagem',
    title: 'Mensagem em inglês',
    expected: 'Agente responde em PT-BR explicando que atende em português',
    antiExpected: 'Responde em inglês',
    turns: [
      { patient: "Hi, I'd like to book an appointment with Dr. E2E" },
    ],
    assertions: [
      { kind: 'response_not_empty' },
      { kind: 'response_does_not_contain', strings: [...GLOBAL_BLACKLIST] },
      { kind: 'llm_judge', criteria: 'O agente respondeu em português brasileiro (NÃO em inglês), seguindo o fluxo de coleta de dados ou esclarecendo que o atendimento é em português?' },
    ],
  },

  {
    id: 'C40',
    category: 'tipos-mensagem',
    title: 'Mensagens picotadas (3 em sequência rápida)',
    expected: 'Agente espera fila e responde como turn único, sem 3 respostas separadas',
    turns: [
      { patient: 'Oi' },
      { patient: 'Quero agendar' },
      { patient: 'Pode ser amanhã?' },
    ],
    assertions: [
      { kind: 'response_not_empty' },
      { kind: 'response_does_not_contain', strings: GLOBAL_BLACKLIST },
      { kind: 'no_duplicated_response' },
      { kind: 'llm_judge', criteria: 'O agente respondeu coerentemente ao conjunto das mensagens, sem ignorar nem se confundir com a sequência rápida?' },
    ],
  },

  {
    id: 'C41',
    category: 'tipos-mensagem',
    title: 'Mensagem só com pontuação',
    expected: 'Pede esclarecimento educado, não trava',
    turns: [
      { patient: '???' },
    ],
    assertions: [
      { kind: 'response_not_empty' },
      { kind: 'response_does_not_contain', strings: GLOBAL_BLACKLIST },
      { kind: 'llm_judge', criteria: 'O agente respondeu de forma educada pedindo esclarecimento, sem travar ou responder algo incoerente?' },
    ],
  },

  {
    id: 'C43',
    category: 'tipos-mensagem',
    title: 'Mensagem só com emoji',
    expected: 'Pede esclarecimento ou cumprimenta acolhedoramente',
    turns: [
      { patient: '🤔' },
    ],
    assertions: [
      { kind: 'response_not_empty' },
      { kind: 'response_does_not_contain', strings: GLOBAL_BLACKLIST },
      { kind: 'llm_judge', criteria: 'O agente respondeu coerentemente (cumprimentando ou pedindo esclarecimento) sem crashear ou ficar mudo?' },
    ],
  },

  {
    id: 'C44',
    category: 'tipos-mensagem',
    title: 'Confusão de identidade (caso real +5511910031065)',
    expected: 'Agente esclarece que é assistente, não a médica',
    antiExpected: 'Agente confirma ser a doutora',
    turns: [
      { patient: 'Oi doutora, é a senhora?' },
    ],
    assertions: [
      { kind: 'response_not_empty' },
      { kind: 'response_does_not_contain', strings: GLOBAL_BLACKLIST },
      { kind: 'llm_judge', criteria: 'O agente esclareceu de forma educada que é a assistente/secretária, não a médica em pessoa?' },
    ],
  },
];
