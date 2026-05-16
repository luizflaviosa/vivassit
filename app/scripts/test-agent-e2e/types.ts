// Tipos compartilhados pela suite.

export type Turn = {
  // Quem fala neste turno: paciente sempre. Use null pra esperar resposta do agente.
  patient?: string;
  // Anexo opcional (path local de áudio/imagem/pdf).
  attachment?: { file_type: 'audio' | 'image' | 'file'; data_url: string };
  // Reaction (emoji puro). Se setado, sobrescreve patient.
  reaction?: string;
};

export type Assertion =
  | { kind: 'response_does_not_contain'; strings: string[] }
  | { kind: 'response_contains_any'; strings: string[] }
  | { kind: 'response_contains_all'; strings: string[] }
  | { kind: 'response_not_empty' }
  | { kind: 'booking_created' }
  | { kind: 'booking_not_created' }
  | { kind: 'no_duplicated_response' }
  | { kind: 'llm_judge'; criteria: string };

export type ScenarioContext = {
  id: string;            // "C01"
  category: string;      // "novo-paciente"
  patientPhone: string;  // "+55119000XXXXX"
  patientName?: string;
  conversationId: number;
  sessionId: string;     // "singulare-e2e_+55119000XXXXX"
  startedAt: Date;
  chatwootContactId?: number; // pra cleanup
};

export type Scenario = {
  id: string;
  category: string;
  title: string;
  setup?: (ctx: ScenarioContext) => Promise<void> | void;
  turns: Turn[];
  assertions: Assertion[];
  // Anti-esperado escrito em prosa pra o LLM judge avaliar.
  antiExpected?: string;
  // Esperado escrito em prosa pra o LLM judge avaliar.
  expected?: string;
  // Skip o cenário (gera resultado "SKIPPED" sem rodar).
  skip?: boolean;
  // Razão pra skip.
  skipReason?: string;
};

export type AssertionResult = {
  assertion: Assertion;
  passed: boolean;
  reason?: string;
};

export type ScenarioResult = {
  id: string;
  category: string;
  title: string;
  passed: boolean;
  durationMs: number;
  turns: Array<{
    patient: string | null;
    agentResponse: string | null;
    elapsedMs: number;
  }>;
  assertions: AssertionResult[];
  error?: string;
};

// Black-list global aplicada a TODA resposta do agente.
export const GLOBAL_BLACKLIST: string[] = [
  'compromisso externo',
  'compromisso particular',
  'agenda externa',
  'workflow did not return',
  'invalid input syntax',
  'undefined',
  '[object Object]',
  'null',
];
