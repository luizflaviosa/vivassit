import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  createOrFindCustomer,
  createSubscription,
  dueDatePlusDays,
  type CreditCardData,
  type CreditCardHolderInfo,
} from '@/lib/asaas';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

interface RequestBody {
  external_reference: string;
  // SaaS subscription so aceita CARTAO (PIX automatico exige config bancaria,
  // BOLETO recorrente nao auto-renova). Marketplace usa endpoint separado.
  method: 'CREDIT_CARD';
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
  // Rate limit: 10 tentativas de pagamento por IP por hora
  const ip = getClientIp(req);
  const rl = rateLimit(`checkout:${ip}`, { max: 10, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, message: `Aguarde ${rl.retryAfterSeconds}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    );
  }

  try {
    const body = (await req.json()) as RequestBody;

    if (!body?.external_reference) {
      return NextResponse.json(
        { success: false, message: 'external_reference é obrigatório' },
        { status: 400 }
      );
    }
    if (body?.method !== 'CREDIT_CARD') {
      return NextResponse.json(
        {
          success: false,
          message:
            'Assinatura mensal só aceita cartão de crédito. PIX e Boleto não permitem renovação automática.',
        },
        { status: 400 }
      );
    }
    if (!body?.payer?.cpfCnpj || !body?.payer?.name || !body?.payer?.email) {
      return NextResponse.json(
        { success: false, message: 'Dados do pagador incompletos (nome, email, CPF)' },
        { status: 400 }
      );
    }
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

    const supabase = supabaseAdmin();

    // ── Carrega o pedido ──────────────────────────────────────────────────────
    const { data: order, error: orderErr } = await supabase
      .from('saas_orders')
      .select('id, external_reference, plan_type, amount, payment_status, tenant_id, asaas_customer_id, trial_ends_at')
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

    // ── Cria SUBSCRIPTION mensal recorrente no Asaas ──────────────────────────
    // nextDueDate = fim do trial (cobranca so acontece quando trial expira)
    // ou amanha se nao tem trial
    const remoteIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      undefined;

    const trialEndDate = order.trial_ends_at
      ? new Date(order.trial_ends_at).toISOString().slice(0, 10)
      : dueDatePlusDays(1);

    const subscription = await createSubscription({
      customer: customer.id,
      billingType: 'CREDIT_CARD',
      value: Number(order.amount),
      nextDueDate: trialEndDate,
      cycle: 'MONTHLY',
      description: `Vivassit - Plano ${order.plan_type} (assinatura mensal)`,
      externalReference: order.external_reference,
      creditCard: body.card,
      creditCardHolderInfo: {
        name: body.payer.name,
        email: body.payer.email,
        cpfCnpj: body.payer.cpfCnpj,
        postalCode: body.payer.postalCode,
        addressNumber: body.payer.addressNumber,
        phone: body.payer.phone,
      } satisfies CreditCardHolderInfo,
      remoteIp,
    });

    // ── Atualiza saas_orders + ativa tenant ───────────────────────────────────
    // Subscription criada com sucesso = cartao validado. Usuario continua no
    // trial gratuito, mas com plano garantido pra renovacao automatica.
    await supabase
      .from('saas_orders')
      .update({
        asaas_customer_id: customer.id,
        asaas_subscription_id: subscription.id,
        payment_method: 'CREDIT_CARD',
        payment_status: 'subscribed', // status especifico: cartao OK, mas pagamento ainda nao cobrado
        provider: 'asaas',
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    if (order.tenant_id) {
      await supabase
        .from('tenants')
        .update({
          // status fica 'pending_payment' ate primeira cobranca confirmar
          // mas marca subscription_status pra refletir que tem plano ativo
          subscription_status: 'trialing', // ainda em trial mas com cartao
          subscription_renews_at: trialEndDate,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', order.tenant_id);
    }

    return NextResponse.json({
      success: true,
      method: 'CREDIT_CARD',
      subscription: {
        id: subscription.id,
        status: subscription.status,
        value: subscription.value,
        cycle: subscription.cycle,
        nextDueDate: subscription.nextDueDate,
      },
      // Quando trial acabar, Asaas cobra automaticamente. Webhook
      // PAYMENT_CONFIRMED dispara ativacao definitiva via /api/webhooks/asaas
      message:
        order.trial_ends_at
          ? `Cartão confirmado. Trial gratuito ativo até ${new Date(order.trial_ends_at).toLocaleDateString('pt-BR')}. Cobrança automática após.`
          : 'Cartão confirmado. Cobrança mensal recorrente ativada.',
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
