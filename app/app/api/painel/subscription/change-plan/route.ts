/**
 * POST /api/painel/subscription/change-plan
 *
 * Troca o plano da assinatura ativa do tenant logado, sem perder histórico.
 *
 * Body: { plan_type: 'professional' | 'enterprise' }
 *
 * Fluxo:
 * 1. Busca saas_orders mais recente com asaas_subscription_id != null
 * 2. Cancela a subscription atual no Asaas (preserva pagamentos passados)
 * 3. Cria nova subscription no Asaas com novo valor + mesma billingType +
 *    nextDueDate herdada do ciclo atual (pra nao cobrar duplicado)
 * 4. Insere novo saas_orders refletindo o novo plano
 * 5. Atualiza tenants.plan_type
 *
 * Se nao tiver assinatura ativa, devolve 404.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-tenant';
import { supabaseAdmin, SAAS_PLAN_AMOUNTS } from '@/lib/supabase';
import {
  cancelSubscription,
  createSubscription,
  getSubscription,
  AsaasBillingType,
  dueDatePlusDays,
} from '@/lib/asaas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_PLANS = ['professional', 'enterprise'] as const;
type AllowedPlan = (typeof ALLOWED_PLANS)[number];

export async function POST(req: NextRequest) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  let body: { plan_type?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'JSON invalido' }, { status: 400 });
  }

  const planType = body.plan_type as AllowedPlan;
  if (!ALLOWED_PLANS.includes(planType)) {
    return NextResponse.json(
      { success: false, message: 'plan_type invalido (use professional ou enterprise)' },
      { status: 400 },
    );
  }

  const supabase = supabaseAdmin();
  const { data: order } = await supabase
    .from('saas_orders')
    .select('id, asaas_customer_id, asaas_subscription_id, payment_method, plan_type, clinic_name')
    .eq('tenant_id', auth.ctx.tenant.tenant_id)
    .not('asaas_subscription_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{
      id: number;
      asaas_customer_id: string | null;
      asaas_subscription_id: string;
      payment_method: string | null;
      plan_type: string;
      clinic_name: string | null;
    }>();

  if (!order || !order.asaas_customer_id) {
    return NextResponse.json(
      { success: false, message: 'Sem assinatura ativa pra mudar' },
      { status: 404 },
    );
  }

  if (order.plan_type === planType) {
    return NextResponse.json(
      { success: false, message: 'Voce ja esta nesse plano' },
      { status: 409 },
    );
  }

  // Pega next_due_date do Asaas pra preservar o ciclo (nao cobrar duplicado)
  let nextDueDate = dueDatePlusDays(30);
  try {
    const current = await getSubscription(order.asaas_subscription_id);
    if (current.nextDueDate) nextDueDate = current.nextDueDate;
  } catch (e) {
    console.warn('[change-plan] erro lendo subscription atual:', (e as Error).message);
  }

  const newAmount = SAAS_PLAN_AMOUNTS[planType];
  const billingType: AsaasBillingType =
    (order.payment_method as AsaasBillingType) === 'CREDIT_CARD' ? 'CREDIT_CARD' : 'BOLETO';

  // Cancela atual
  try {
    await cancelSubscription(order.asaas_subscription_id);
  } catch (e) {
    return NextResponse.json(
      { success: false, message: `Falhou ao cancelar assinatura atual: ${(e as Error).message}` },
      { status: 502 },
    );
  }

  // Cria nova com mesmo billingType e proxima cobranca preservada
  let newSubId: string;
  try {
    const sub = await createSubscription({
      customer: order.asaas_customer_id,
      billingType: billingType === 'CREDIT_CARD' ? 'BOLETO' : billingType,
      // Switch de credit_card precisa de novo cartao tokenizado — fora de escopo aqui.
      // Cai pra BOLETO temporariamente; tenant pode trocar via portal Asaas depois.
      value: newAmount,
      nextDueDate,
      cycle: 'MONTHLY',
      description: `Singulare ${planType === 'enterprise' ? 'Clinica' : 'Profissional'} (mensal)`,
      externalReference: auth.ctx.tenant.tenant_id,
    });
    newSubId = sub.id;
  } catch (e) {
    return NextResponse.json(
      { success: false, message: `Falhou ao criar nova assinatura: ${(e as Error).message}` },
      { status: 502 },
    );
  }

  // Marca order antigo como migrated, insere novo
  await supabase
    .from('saas_orders')
    .update({ payment_status: 'migrated', updated_at: new Date().toISOString() })
    .eq('id', order.id);

  await supabase.from('saas_orders').insert({
    external_reference: `change_${auth.ctx.tenant.tenant_id}_${Date.now()}`,
    clinic_name: order.clinic_name,
    plan_type: planType,
    amount: newAmount,
    payment_status: 'pending',
    tenant_id: auth.ctx.tenant.tenant_id,
    provider: 'asaas',
    asaas_customer_id: order.asaas_customer_id,
    asaas_subscription_id: newSubId,
    payment_method: billingType === 'CREDIT_CARD' ? 'BOLETO' : billingType,
    clinic_data: {
      source: 'painel_change_plan',
      from_plan: order.plan_type,
      from_subscription_id: order.asaas_subscription_id,
    },
  });

  await supabase
    .from('tenants')
    .update({
      plan_type: planType,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', auth.ctx.tenant.tenant_id);

  return NextResponse.json({
    success: true,
    message: 'Plano atualizado',
    subscription: {
      plan_type: planType,
      amount: newAmount,
      asaas_subscription_id: newSubId,
      next_due_date: nextDueDate,
      payment_method: billingType === 'CREDIT_CARD' ? 'BOLETO' : billingType,
    },
  });
}
