// Cenários que reproduzem os bugs identificados na auditoria de 2026-05-15.

import type { Scenario } from '../types.js';
import { GLOBAL_BLACKLIST } from '../types.js';

export const scenarios: Scenario[] = [
  {
    id: 'C15',
    category: 'falha-tools',
    title: 'T06 doctor_code:null — agente não deve crashar nem propagar mensagem técnica',
    expected: 'Mesmo se check_day_available falhar, agente recupera ou escala. Não fala "compromisso externo"',
    antiExpected: 'Resposta contém "compromisso externo", "workflow", "null" ou similar',
    turns: [
      { patient: 'Olá, quero agendar' },
      { patient: 'Joseli Teste E2E, 19/07/1980' },
      { patient: 'Quero pra próxima sexta às 14h' },
    ],
    assertions: [
      { kind: 'response_not_empty' },
      { kind: 'response_does_not_contain', strings: GLOBAL_BLACKLIST },
      { kind: 'no_duplicated_response' },
      { kind: 'llm_judge', criteria: 'O agente respondeu coerentemente sem mencionar erros técnicos, sem inventar motivos ("compromisso externo") e sem repetir a mesma resposta literal? Reconhecer instabilidade técnica e oferecer escalar é aceitável.' },
    ],
  },

  {
    id: 'C16',
    category: 'falha-tools',
    title: 'Dia sem slots (bug Patrícia) — agente parafraseia e oferece outro range',
    expected: 'Agente reconhece dia sem slots e oferece outro dia, sem inventar bloqueio',
    antiExpected: 'Agente diz "compromisso externo" ou similar invenção; OU ignora o dia inviável e responde vago',
    turns: [
      { patient: 'Quero agendar' },
      { patient: 'Maria Teste, 15/03/1985' },
      { patient: 'Pode ser na terça' },  // terça é "fechado" — agente deveria oferecer outro dia
    ],
    assertions: [
      { kind: 'response_not_empty' },
      { kind: 'response_does_not_contain', strings: GLOBAL_BLACKLIST },
      { kind: 'llm_judge', criteria: 'O agente identificou EXPLICITAMENTE que terça não tem atendimento e ofereceu outro dia específico (seg, qui ou sex)? Resposta vaga tipo "podemos verificar" sem mencionar terça-fechada é FAIL.' },
    ],
  },

  {
    id: 'C18',
    category: 'falha-tools',
    title: 'Tentativa em sábado/domingo (closed_day)',
    expected: 'Agente diz que fim de semana não tem atendimento e oferece outro dia',
    turns: [
      { patient: 'Quero agendar' },
      { patient: 'Carlos Teste, 22/06/1975' },
      { patient: 'Pode ser no sábado' },
    ],
    assertions: [
      { kind: 'response_not_empty' },
      { kind: 'response_does_not_contain', strings: GLOBAL_BLACKLIST },
      { kind: 'llm_judge', criteria: 'O agente reconheceu que sábado não tem atendimento e ofereceu dias da semana válidos (seg/qui/sex)?' },
    ],
  },

  {
    id: 'C19',
    category: 'falha-tools',
    title: 'Tentativa muito próxima (sem 2h de antecedência)',
    expected: 'Agente reconhece que falta antecedência mínima (2h) e oferece próximo slot válido',
    turns: [
      { patient: 'Quero agendar' },
      { patient: 'Ana Teste, 03/11/1992' },
      { patient: 'Pode ser hoje em 30 minutos' },
    ],
    assertions: [
      { kind: 'response_not_empty' },
      { kind: 'response_does_not_contain', strings: GLOBAL_BLACKLIST },
      { kind: 'llm_judge', criteria: 'O agente comunicou que não é possível agendar com tão pouca antecedência e ofereceu próximo horário válido?' },
    ],
  },

  {
    id: 'C17',
    category: 'falha-tools',
    title: 'Pedido de slot em horário antes do expediente (out_of_hours)',
    expected: 'Agente reconhece que horário está fora do expediente (14h-18h) e oferece horário válido',
    turns: [
      { patient: 'Quero agendar' },
      { patient: 'Marcos Teste, 14/02/1980' },
      { patient: 'Pode ser na sexta às 8h da manhã' },
    ],
    assertions: [
      { kind: 'response_not_empty' },
      { kind: 'response_does_not_contain', strings: GLOBAL_BLACKLIST },
      { kind: 'llm_judge', criteria: 'O agente reconheceu que 8h está fora do expediente da Dra. (14h-18h) e ofereceu horários dentro do expediente?' },
    ],
  },

  {
    id: 'C20',
    category: 'falha-tools',
    title: '2 tentativas falhas seguidas — agente deve escalar proativamente',
    expected: 'Após 2 tentativas inviáveis, agente oferece transferir pra humano',
    antiExpected: 'Loop infinito de "tente outro horário"',
    turns: [
      { patient: 'Quero agendar' },
      { patient: 'Eliana Teste, 25/07/1985' },
      { patient: 'Pode ser sábado às 9h' },  // closed_day + out_of_hours
      { patient: 'Então domingo às 7h' },     // closed_day + out_of_hours
    ],
    assertions: [
      { kind: 'response_not_empty' },
      { kind: 'response_does_not_contain', strings: GLOBAL_BLACKLIST },
      { kind: 'no_duplicated_response' },
      { kind: 'llm_judge', criteria: 'Após 2 tentativas inviáveis seguidas, o agente reconheceu o padrão e ofereceu transferir pra humano OU listou explicitamente os dias/horários válidos pra o paciente parar de adivinhar?' },
    ],
  },
];
