// Registry central de templates de documentos médicos.
// Cada template exporta um objeto com { doc_type, display_name, defaults, render, required_fields }.
//
// Pra adicionar um novo tipo:
//   1. Criar app/lib/docs-templates/<slug>.ts seguindo o padrão dos existentes
//   2. Importar aqui e adicionar em DOC_TEMPLATES
//   3. Atualizar DOC_TYPES + ENABLED_DOC_TYPES em docs-types.ts
//
// Referências regulatórias usadas em cada template estão no próprio arquivo.

import { APTIDAO_FISICA_TEMPLATE } from './aptidao-fisica';
import { AFASTAMENTO_INSS_TEMPLATE } from './afastamento-inss';
import { LME_ALTO_CUSTO_TEMPLATE } from './lme-alto-custo';
import { VACINA_PRIORITARIA_TEMPLATE } from './vacina-prioritaria';
import { TISS_GUIA_TEMPLATE } from './tiss-guia';

export const DOC_TEMPLATES = {
  aptidao_fisica: APTIDAO_FISICA_TEMPLATE,
  afastamento_inss: AFASTAMENTO_INSS_TEMPLATE,
  lme_alto_custo: LME_ALTO_CUSTO_TEMPLATE,
  vacina_prioritaria: VACINA_PRIORITARIA_TEMPLATE,
  tiss_guia: TISS_GUIA_TEMPLATE,
} as const;

export type DocTemplateKey = keyof typeof DOC_TEMPLATES;

export {
  APTIDAO_FISICA_TEMPLATE,
  AFASTAMENTO_INSS_TEMPLATE,
  LME_ALTO_CUSTO_TEMPLATE,
  VACINA_PRIORITARIA_TEMPLATE,
  TISS_GUIA_TEMPLATE,
};

export * from './_shared';
export type { AptidaoFisicaForm, FitnessResult } from './aptidao-fisica';
export type { AfastamentoInssForm } from './afastamento-inss';
export type { LmeAltoCustoForm } from './lme-alto-custo';
export type { VacinaPrioritariaForm, PriorityGroup } from './vacina-prioritaria';
export type { TissGuiaForm, TissConsultaForm, TissSadtForm, TissGuiaType } from './tiss-guia';
