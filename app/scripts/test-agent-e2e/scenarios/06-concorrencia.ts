// Concorrência: runner atual roda serial, então cenários que exigem race
// genuíno ficam SKIPPED. Quando o runner suportar paralelismo controlado,
// podem ser ativados.

import type { Scenario } from '../types.js';

export const scenarios: Scenario[] = [
  {
    id: 'C26',
    category: 'concorrencia',
    title: '2 pacientes pedem mesmo slot com 2s de diferença',
    skip: true,
    skipReason: 'runner serial — implementar paralelismo controlado primeiro',
    turns: [],
    assertions: [],
  },
  {
    id: 'C27',
    category: 'concorrencia',
    title: 'Paciente fala enquanto admin remarca pelo painel',
    skip: true,
    skipReason: 'feature de reschedule admin ainda não implementada',
    turns: [],
    assertions: [],
  },
  {
    id: 'C28',
    category: 'concorrencia',
    title: 'Paciente já tem booking, pede outro mesmo dia',
    skip: true,
    skipReason: 'requer setup duplo e fluxo de cancelar/manter',
    turns: [],
    assertions: [],
  },
];
