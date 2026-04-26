import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  createOrFindCustomer,
  createPayment,
  getPixQrCode,
  getBoletoIdentification,
  dueDatePlusDays,
  type AsaasBillingType,
  type CreditCardData,
  type CreditCardHolderInfo,
} from '@/lib/asaas';

interface RequestBody {
  external_reference: string;
  method: AsaasBillingType; // PIX | BOLETO | CREDIT_CARD
  payer: {
    name: string;
    email: string;
    cpfCnpj: string;
    phone: string;
    postalCode?: string;
    addressNumber?: string;
  };
  card?: CreditCardData;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RequestBody;

    if (!body?.external_reference) {
      return NextResponse.json(
        { success: false, message: 'external_reference é obrigatório' },
        { status: 400 }
      );
    }
    if (!body?.method || !['PIX', 'BOLETO', 'CREDIT_CARD'].includes(body.method)) {
      return NextResponse.json(
        { success: false, message: 'method inválido (use PIX, BOLETO ou CREDIT_CARD)' },
        { status: 400 }
      );
    }
    if (!body?.payer?.cpfCnpj || !body?.payer?.name || !body?.payer?.email) {
      return NextResponse.json(
        { success: false, message: 'Dados do pagador incompletos (nome, email, CPF)' },
        { status: 400 }
      );
    }
    if (body.method === 'CREDIT_CARD') {
      if (!body.card?.number || !body.card?.ccv || !body.card?.expiryMonth || !body.card?.expiryYear || !body.card?.holderName) {
        return NextResponse.json(
          { success: false, message: 'Dados do cartão incompletos' },
          { status: 400 }
        );
      }
      if (!body.payer.postalCode || !body.payer.addressNumber) {
        return NextResponse.json(
          { success: false, message: 'CEP e número do endereço são obrigatórios para cartão de crédito' },
          { status: 400 }
        );
      }
    }

    const supabase = supabaseAdmin();

    // ── Carrega o pedido ──────────────────────────────────────────────────────
    const { data: order, error: orderErr } = await supabase
      .from('saas_orders')
      .select('id, external_reference, plan_type, amount, payment_status, tenant_id, asaas_customer_id')
      .eq('external_reference', body.external_reference)
      .single();

    if (orderErr || !order) {
      return NextResponse.json(
        { success: false, message: 'Pedido não encontrado' },
        { status: 404 }
      );
    }

    if (order.payment_status === 'paid' || order.payment_status === 'approved') {
      return NextResponse.json(
        { success: false, message: 'Este pedido já foi pago' },
        { status: 409 }
      );
    }

    // ── Cria/recupera customer no Asaas ───────────────────────────────────────
    const customer = await createOrFindCustomer({
      name: body.payer.name,
      email: body.payer.email,
      cpfCnpj: body.payer.cpfCnpj,
      mobilePhone: body.payer.phone,
      externalReference: order.tenant_id ?? undefined,
      postalCode: body.payer.postalCode,
      addressNumber: body.payer.addressNumber,
    });

    // ── Cria pagamento no Asaas ───────────────────────────────────────────────
    const remoteIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      undefined;

    const payment = await createPayment({
      customer: customer.id,
      billingType: body.method,
      value: Number(order.amount),
      dueDate: dueDatePlusDays(body.method === 'BOLETO' ? 3 : 1),
      description: `Vivassit - Plano ${order.plan_type} (mensal)`,
      externalReference: order.external_reference,
      ...(body.method === 'CREDIT_CARD' && body.card
        ? {
            creditCard: body.card,
            creditCardHolderInfo: {
              name: body.payer.name,
              email: body.payer.email,
              cpfCnpj: body.payer.cpfCnpj,
              postalCode: body.payer.postalCode!,
              addressNumber: body.payer.addressNumber!,
              phone: body.payer.phone,
            } satisfies CreditCardHolderInfo,
            remoteIp,
          }
        : {}),
    });

    // ── Atualiza saas_orders com IDs Asaas + metodo ───────────────────────────
    const isPaid = payment.status === 'CONFIRMED' || payment.status === 'RECEIVED';
    await supabase
      .from('saas_orders')
      .update({
        asaas_customer_id: customer.id,
        asaas_payment_id: payment.id,
        payment_method: body.method,
        payment_status: isPaid ? 'paid' : 'pending',
        provider: 'asaas',
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    // Se cartao foi confirmado imediatamente, ja ativa o tenant
    if (isPaid && order.tenant_id) {
      await supabase
        .from('tenants')
        .update({
          status: 'active',
          subscription_status: 'active',
          subscription_renews_at: dueDatePlusDays(30),
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', order.tenant_id);
    }

    // ── Resposta especifica por metodo ────────────────────────────────────────
    if (body.method === 'PIX') {
      const qr = await getPixQrCode(payment.id);
      return NextResponse.json({
        success: true,
        method: 'PIX',
        payment: {
          id: payment.id,
          status: payment.status,
          value: payment.value,
          dueDate: payment.dueDate,
        },
        pix: {
          qrCodeImage: qr.encodedImage,
          qrCodePayload: qr.payload,
          expirationDate: qr.expirationDate,
        },
      });
    }

    if (body.method === 'BOLETO') {
      const boleto = await getBoletoIdentification(payment.id);
      return NextResponse.json({
        success: true,
        method: 'BOLETO',
        payment: {
          id: payment.id,
          status: payment.status,
          value: payment.value,
          dueDate: payment.dueDate,
          invoiceUrl: payment.invoiceUrl,
          bankSlipUrl: payment.bankSlipUrl,
        },
        boleto: {
          identificationField: boleto.identificationField,
          nossoNumero: boleto.nossoNumero,
          barCode: boleto.barCode,
        },
      });
    }

    // CREDIT_CARD
    return NextResponse.json({
      success: true,
      method: 'CREDIT_CARD',
      payment: {
        id: payment.id,
        status: payment.status,
        value: payment.value,
      },
      approved: isPaid,
    });
  } catch (error) {
    const err = error as Error & { status?: number; body?: unknown };
    console.error('[checkout/payment] erro:', err.message, err.body);
    return NextResponse.json(
      {
        success: false,
        message: err.message || 'Erro ao processar pagamento',
        detail: err.body ?? null,
      },
      { status: err.status || 500 }
    );
  }
}
