import type { Scenario } from '../types.js';
import { GLOBAL_BLACKLIST } from '../types.js';

export const scenarios: Scenario[] = [
  {
    id: 'C01',
    category: 'novo-paciente',
    title: 'Saudação simples',
    expected: 'Resposta acolhedora pedindo nome completo e data de nascimento',
    antiExpected: 'Pular coleta e listar slots sem ter dados do paciente',
    turns: [{ patient: 'Oi' }],
    assertions: [
      { kind: 'response_not_empty' },
      { kind: 'response_does_not_contain', strings: GLOBAL_BLACKLIST },
      { kind: 'response_contains_any', strings: ['nome', 'data', 'nascimento'] },
      { kind: 'llm_judge', criteria: 'A resposta cumprimentou de forma acolhedora e pediu nome e data de nascimento, sem listar horários ainda?' },
    ],
  },

  {
    id: 'C02',
    category: 'novo-paciente',
    title: 'Pede agendar direto',
    expected: 'Pede nome e DOB antes de listar slots',
    turns: [{ patient: 'Quero agendar com a Dra. Teste E2E' }],
    assertions: [
      { kind: 'response_not_empty' },
      { kind: 'response_does_not_contain', strings: GLOBAL_BLACKLIST },
      { kind: 'response_contains_any', strings: ['nome', 'nascimento'] },
      { kind: 'llm_judge', criteria: 'O agente pediu nome e data de nascimento ANTES de oferecer horários?' },
    ],
  },

  {
    id: 'C03',
    category: 'novo-paciente',
    title: 'Manda nome + DOB de uma vez',
    expected: 'Aceita ambos os dados, agradece e segue pro próximo passo (escolha de horário)',
    antiExpected: 'Pede DOB ou nome novamente',
    turns: [
      { patient: 'Quero agendar. Maria Silva, 15/03/1980' },
    ],
    assertions: [
      { kind: 'response_not_empty' },
      { kind: 'response_does_not_contain', strings: GLOBAL_BLACKLIST },
      { kind: 'llm_judge', criteria: 'O agente registrou nome (Maria Silva) e DOB (15/03/1980) sem pedir de novo, e seguiu adiante (ofereceu horários ou perguntou preferência)?' },
    ],
  },

  {
    id: 'C04',
    category: 'novo-paciente',
    title: 'DOB malformada (data impossível)',
    expected: 'Reconhece data inválida, pede correção',
    antiExpected: 'Aceita 32/13/1990 silenciosamente',
    turns: [
      { patient: 'Quero agendar. João Pereira, 32/13/1990' },
    ],
    assertions: [
      { kind: 'response_not_empty' },
      { kind: 'response_does_not_contain', strings: GLOBAL_BLACKLIST },
      { kind: 'llm_judge', criteria: 'O agente identificou que 32/13/1990 é uma data inválida e pediu correção do paciente? (Aceitar nome silenciosamente é OK, mas DOB precisa ser questionada.)' },
    ],
  },

  {
    id: 'C05',
    category: 'novo-paciente',
    title: 'Nome muito curto (apenas inicial)',
    expected: 'Pede nome completo',
    antiExpected: 'Aceita "M" como nome válido',
    turns: [
      { patient: 'Quero agendar' },
      { patient: 'M, 10/05/1990' },
    ],
    assertions: [
      { kind: 'response_not_empty' },
      { kind: 'response_does_not_contain', strings: GLOBAL_BLACKLIST },
      { kind: 'llm_judge', criteria: 'O agente pediu o nome completo (não aceitou só a letra M) e/ou seguiu pedindo mais detalhes, mantendo o tom acolhedor?' },
    ],
  },
];
