// Cenários de anexos: pulamos por enquanto porque exige hospedagem de arquivo
// público acessível via data_url. Marcados como SKIPPED — implementar quando
// houver storage de teste (Supabase bucket ou similar).

import type { Scenario } from '../types.js';

export const scenarios: Scenario[] = [
  {
    id: 'C11',
    category: 'anexos',
    title: 'Áudio com pedido de agendamento',
    skip: true,
    skipReason: 'requer hospedar arquivo audio acessível via data_url',
    turns: [],
    assertions: [],
  },
  {
    id: 'C12',
    category: 'anexos',
    title: 'Imagem de exame (foto JPG)',
    skip: true,
    skipReason: 'requer hospedar arquivo imagem acessível via data_url',
    turns: [],
    assertions: [],
  },
  {
    id: 'C13',
    category: 'anexos',
    title: 'PDF de documento',
    skip: true,
    skipReason: 'requer hospedar PDF acessível via data_url',
    turns: [],
    assertions: [],
  },
  {
    id: 'C14',
    category: 'anexos',
    title: 'Reaction (emoji puro)',
    skip: true,
    skipReason: 'shape de payload reaction difere — requer extensão do fixtures',
    turns: [],
    assertions: [],
  },
];
