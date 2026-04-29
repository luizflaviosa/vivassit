// Estimativa de fees Asaas para pass-through transparente ao médico (modelo B).
// Tabela oficial Asaas em https://app.asaas.com (verificada 2026-04-29).
// Promo até 2026-07-25; depois disso troca pros valores cheios.
//
// IMPORTANTE: o valor REAL vem no webhook Asaas (tenant_payments.asaas_fee_value).
// Esse helper é só pra UX antecipada (mostrar estimativa antes do paciente pagar).

export type PaymentMethod = 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'UNDEFINED';

const PROMO_DEADLINE = new Date('2026-07-25T23:59:59-03:00');

interface FeeRule {
  fixed: number;       // R$ fixo
  percent: number;     // % do valor (decimal: 0.0199 = 1,99%)
}

interface MethodConfig {
  promo: FeeRule;
  full: FeeRule;
}

// Valores conferidos no painel Asaas em 29/04/2026.
const TABLE: Record<PaymentMethod, MethodConfig> = {
  PIX: {
    promo: { fixed: 0.99, percent: 0 },
    full:  { fixed: 1.99, percent: 0 },
  },
  BOLETO: {
    promo: { fixed: 0.99, percent: 0 },
    full:  { fixed: 1.99, percent: 0 },
  },
  CREDIT_CARD: {
    // À vista. Parcelas vão escalando, mas como o Asaas não conta o número
    // de parcelas no /payments criado simples, assumimos 1× pra estimativa.
    // Quando cobrar parcelado explícito, criar variantes.
    promo: { fixed: 0.49, percent: 0.0199 },
    full:  { fixed: 0.49, percent: 0.0299 },
  },
  DEBIT_CARD: {
    promo: { fixed: 0.35, percent: 0.0189 },
    full:  { fixed: 0.35, percent: 0.0189 },
  },
  UNDEFINED: {
    // Asaas decide qual método baseado no que paciente escolher.
    // Como estimativa conservadora, usamos cartão à vista (mais caro entre os comuns).
    promo: { fixed: 0.49, percent: 0.0199 },
    full:  { fixed: 0.49, percent: 0.0299 },
  },
};

export interface FeeBreakdown {
  gross: number;       // valor cobrado do paciente
  fee: number;         // taxa Asaas estimada
  net: number;         // valor que cai no médico
  method: PaymentMethod;
  isPromo: boolean;    // se foi calculado com fees promocionais
}

export function estimateFee(
  gross: number,
  method: PaymentMethod = 'UNDEFINED',
  now: Date = new Date()
): FeeBreakdown {
  const isPromo = now <= PROMO_DEADLINE;
  const cfg = TABLE[method] ?? TABLE.UNDEFINED;
  const rule = isPromo ? cfg.promo : cfg.full;
  const fee = round2(gross * rule.percent + rule.fixed);
  const net = round2(gross - fee);
  return { gross: round2(gross), fee, net, method, isPromo };
}

// Helper pra UI: formata como "R$ 250,00 → R$ 244,53 (taxa Asaas R$ 5,47)"
export function formatFeeBreakdown(b: FeeBreakdown): string {
  return `R$ ${brl(b.gross)} → você recebe R$ ${brl(b.net)} (taxa Asaas R$ ${brl(b.fee)})`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function brl(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
