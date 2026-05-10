/**
 * POST /api/painel/subscription/start
 *
 * Inicia uma assinatura SaaS Singulare pra um tenant logado a partir do
 * painel — sem precisar passar pelo /onboarding.
 *
 * Body: { plan_type: 'professional' | 'enterprise' }
 *   sob_medida nao passa por aqui (vai pra WhatsApp/equipe comercial).
 *
 * Fluxo:
 * 1. Tenant ja deve existir (logado via requireTenant)
 * 2. Cria/recupera Asaas customer com dados do tenant (cnpj/email/phone)
 * 3. Cria Asaas subscription BOLETO com nextDueDate = hoje + TRIAL_DAYS
 * 4. Insere row em saas_orders com payment_status='trial'
 * 5. Atualiza tenants.subscription_status='trial' + plan_type
 *
 * NAO substitui o checkout completo de credit_card do /onboarding — esse
 * endpoint e o caminho mais leve possivel pra ativar uma assinatura por
 * tenants ja existentes (boleto, sem form de cartao). Pra trocar pra cartao
 * depois, o tenant pode fazer no portal Asaas (link no email do boleto).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-tenant';
import { supabaseAdmin, SAAS_PLAN_AMOUNTS, TRIAL_DAYS } from '@/lib/supabase';
import { createOrFindCustomer, createSubscription, dueDatePlusDays } from '@/lib/asaas';

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
  const { data: tenant } = await supabase
    .from('tenants')
    .select('tenant_id, clinic_name, doctor_name, email, admin_email, phone, real_phone, cnpj')
    .eq('tenant_id', auth.ctx.tenant.tenant_id)
    .maybeSingle<{
      tenant_id: string;
      clinic_name: string | null;
      doctor_name: string | null;
      email: string | null;
      admin_email: string | null;
      phone: string | null;
      real_phone: string | null;
      cnpj: string | null;
    }>();

  if (!tenant) {
    return NextResponse.json({ success: false, message: 'Tenant nao encontrado' }, { status: 404 });
  }

  // Bloqueia se ja tem assinatura ativa
  const { data: existing } = await supabase
    .from('saas_orders')
    .select('id, asaas_subscription_id, payment_status')
    .eq('tenant_id', tenant.tenant_id)
    .not('asaas_subscription_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.asaas_subscription_id && !['cancelled', 'expired'].includes(existing.payment_status ?? '')) {
    return NextResponse.json(
      { success: false, message: 'Voce ja tem assinatura ativa. Use mudar de plano.' },
      { status: 409 },
    );
  }

  if (!tenant.cnpj) {
    return NextResponse.json(
      {
        success: false,
        message: 'Preencha o CNPJ/CPF da clinica em Identidade antes de assinar (necessario pra emitir nota fiscal).',
      },
      { status: 400 },
    );
  }

  const billingEmail = tenant.admin_email ?? tenant.email;
  if (!billingEmail) {
    return NextResponse.json(
      { success: false, message: 'Sem email de cobranca cadastrado.' },
      { status: 400 },
    );
  }

  const amount = SAAS_PLAN_AMOUNTS[planType];
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const nextDueDate = dueDatePlusDays(TRIAL_DAYS);

  let customerId: string;
  try {
    const customer = await createOrFindCustomer({
      name: tenant.clinic_name ?? tenant.doctor_name ?? 'Cliente Singulare',
      email: billingEmail,
      cpfCnpj: tenant.cnpj,
      mobilePhone: tenant.real_phone ?? tenant.phone ?? undefined,
      externalReference: tenant.tenant_id,
    });
    customerId = customer.id;
  } catch (e) {
    const err = e as Error;
    return NextResponse.json(
      { success: false, message: `Falhou ao criar cliente Asaas: ${err.message}` },
      { status: 502 },
    );
  }

  let subscriptionId: string;
  try {
    const sub = await createSubscription({
      customer: customerId,
      billingType: 'BOLETO',
      value: amount,
      nextDueDate,
      cycle: 'MONTHLY',
      description: `Singulare ${planType === 'enterprise' ? 'Clinica' : 'Profissional'} (mensal)`,
      externalReference: tenant.tenant_id,
    });
    subscriptionId = sub.id;
  } catch (e) {
    const err = e as Error;
    return NextResponse.json(
      { success: false, message: `Falhou ao criar assinatura Asaas: ${err.message}` },
      { status: 502 },
    );
  }

  await supabase.from('saas_orders').insert({
    external_reference: `paneluser_${tenant.tenant_id}_${Date.now()}`,
    clinic_name: tenant.clinic_name ?? tenant.doctor_name ?? tenant.tenant_id,
    plan_type: planType,
    amount,
    payment_status: 'trial',
    tenant_id: tenant.tenant_id,
    provider: 'asaas',
    asaas_customer_id: customerId,
    asaas_subscription_id: subscriptionId,
    payment_method: 'BOLETO',
    trial_ends_at: trialEndsAt,
    clinic_data: { source: 'painel_inline_subscribe' },
  });

  await supabase
    .from('tenants')
    .update({
      plan_type: planType,
      subscription_status: 'trial',
      subscription_renews_at: trialEndsAt,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenant.tenant_id);

  return NextResponse.json({
    success: true,
    message: 'Assinatura iniciada. 7 dias gratis.',
    subscription: {
      plan_type: planType,
      amount,
      asaas_subscription_id: subscriptionId,
      trial_ends_at: trialEndsAt,
      payment_method: 'BOLETO',
    },
  });
}
