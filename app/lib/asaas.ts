// Wrapper do client Asaas (https://docs.asaas.com)
// Server-side ONLY: usa ASAAS_API_KEY que so existe em process.env.

const ASAAS_URL =
  process.env.ASAAS_API_URL?.replace(/\/$/, '') ||
  'https://sandbox.asaas.com/api/v3';

function getApiKey(): string {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new Error('ASAAS_API_KEY nao configurada');
  return key;
}

async function asaasFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const url = `${ASAAS_URL}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      access_token: getApiKey(),
      'User-Agent': 'Vivassit/1.0',
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // resposta nao-json
  }

  if (!res.ok) {
    const errMsg =
      (json as { errors?: Array<{ description?: string }> })?.errors?.[0]?.description ||
      (json as { message?: string })?.message ||
      `Asaas ${path} retornou ${res.status}`;
    const err = new Error(errMsg) as Error & { status?: number; body?: unknown };
    err.status = res.status;
    err.body = json;
    throw err;
  }

  return json as T;
}

// ──────────────────────────────────────────────────────────────────────────────
// Customers
// ──────────────────────────────────────────────────────────────────────────────

export interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone?: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  province?: string;
  city?: string;
  state?: string;
  externalReference?: string;
}

export interface CreateCustomerInput {
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone?: string;
  externalReference?: string;
  postalCode?: string;
  addressNumber?: string;
}

export async function createOrFindCustomer(
  input: CreateCustomerInput
): Promise<AsaasCustomer> {
  // Tenta achar por CPF/CNPJ primeiro
  const existing = await asaasFetch<{ data: AsaasCustomer[] }>(
    `/customers?cpfCnpj=${encodeURIComponent(input.cpfCnpj.replace(/\D/g, ''))}&limit=1`
  );
  if (existing?.data?.length > 0) return existing.data[0];

  // Caso contrario, cria
  return asaasFetch<AsaasCustomer>(`/customers`, {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      cpfCnpj: input.cpfCnpj.replace(/\D/g, ''),
      mobilePhone: input.mobilePhone?.replace(/\D/g, ''),
    }),
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Payments
// ──────────────────────────────────────────────────────────────────────────────

export type AsaasBillingType = 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'UNDEFINED';
export type AsaasPaymentStatus =
  | 'PENDING'
  | 'RECEIVED'
  | 'CONFIRMED'
  | 'OVERDUE'
  | 'REFUNDED'
  | 'RECEIVED_IN_CASH'
  | 'REFUND_REQUESTED'
  | 'CHARGEBACK_REQUESTED'
  | 'CHARGEBACK_DISPUTE'
  | 'AWAITING_CHARGEBACK_REVERSAL'
  | 'DUNNING_REQUESTED'
  | 'DUNNING_RECEIVED'
  | 'AWAITING_RISK_ANALYSIS';

export interface AsaasPayment {
  id: string;
  customer: string;
  billingType: AsaasBillingType;
  value: number;
  netValue: number;
  status: AsaasPaymentStatus;
  dueDate: string;
  paymentDate?: string | null;
  description?: string;
  externalReference?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  invoiceNumber?: string;
  pixTransaction?: string | null;
}

export interface CreditCardData {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

export interface CreditCardHolderInfo {
  name: string;
  email: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
  phone: string;
}

export interface CreatePaymentInput {
  customer: string;
  billingType: AsaasBillingType;
  value: number;
  dueDate: string; // YYYY-MM-DD
  description?: string;
  externalReference?: string;
  creditCard?: CreditCardData;
  creditCardHolderInfo?: CreditCardHolderInfo;
  remoteIp?: string;
}

export async function createPayment(input: CreatePaymentInput): Promise<AsaasPayment> {
  return asaasFetch<AsaasPayment>(`/payments`, {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      creditCard: input.creditCard
        ? {
            ...input.creditCard,
            number: input.creditCard.number.replace(/\D/g, ''),
            ccv: input.creditCard.ccv.replace(/\D/g, ''),
          }
        : undefined,
      creditCardHolderInfo: input.creditCardHolderInfo
        ? {
            ...input.creditCardHolderInfo,
            cpfCnpj: input.creditCardHolderInfo.cpfCnpj.replace(/\D/g, ''),
            phone: input.creditCardHolderInfo.phone.replace(/\D/g, ''),
            postalCode: input.creditCardHolderInfo.postalCode.replace(/\D/g, ''),
          }
        : undefined,
    }),
  });
}

export async function getPayment(id: string): Promise<AsaasPayment> {
  return asaasFetch<AsaasPayment>(`/payments/${encodeURIComponent(id)}`);
}

export interface PixQrCode {
  encodedImage: string; // base64 PNG
  payload: string; // codigo PIX copia-e-cola
  expirationDate: string;
}

export async function getPixQrCode(paymentId: string): Promise<PixQrCode> {
  return asaasFetch<PixQrCode>(
    `/payments/${encodeURIComponent(paymentId)}/pixQrCode`
  );
}

export interface BoletoIdentification {
  identificationField: string; // linha digitavel
  nossoNumero: string;
  barCode: string;
}

export async function getBoletoIdentification(
  paymentId: string
): Promise<BoletoIdentification> {
  return asaasFetch<BoletoIdentification>(
    `/payments/${encodeURIComponent(paymentId)}/identificationField`
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

export function dueDatePlusDays(days: number): string {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}
