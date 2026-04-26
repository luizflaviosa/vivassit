import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenant } from '@/lib/auth-tenant';
import { cancelSubscription, getSubscription } from '@/lib/asaas';

// GET: status atual da assinatura SaaS Vivassit
export async function GET() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const supabase = supabaseAdmin();
  const { data: order } = await supabase
    .from('saas_orders')
    .select('id, plan_type, amount, payment_status, asaas_subscription_id, payment_method, created_at, updated_at, trial_ends_at')
    .eq('tenant_id', auth.ctx.tenant.tenant_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({
      success: true,
      subscription: null,
      message: 'Sem assinatura ativa',
    });
  }

  // Se tem subscription_id, busca status atual no Asaas
  let asaasStatus = null;
  if (order.asaas_subscription_id) {
    try {
      const sub = await getSubscription(order.asaas_subscription_id);
      asaasStatus = {
        status: sub.status,
        next_due_date: sub.nextDueDate,
        cycle: sub.cycle,
      };
    } catch (e) {
      console.warn('[painel/subscription GET] erro Asaas:', e);
    }
  }

  return NextResponse.json({
    success: true,
    subscription: {
      ...order,
      asaas: asaasStatus,
    },
  });
}

// DELETE: cancela assinatura no Asaas + atualiza status local
export async function DELETE() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const supabase = supabaseAdmin();
  const { data: order } = await supabase
    .from('saas_orders')
    .select('id, asaas_subscription_id')
    .eq('tenant_id', auth.ctx.tenant.tenant_id)
    .not('asaas_subscription_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!order?.asaas_subscription_id) {
    return NextResponse.json(
      { success: false, message: 'Sem assinatura ativa para cancelar' },
      { status: 404 }
    );
  }

  try {
    await cancelSubscription(order.asaas_subscription_id);
  } catch (e) {
    const err = e as Error & { status?: number };
    console.error('[painel/subscription DELETE] erro Asaas:', err.message);
    return NextResponse.json(
      { success: false, message: err.message || 'Erro ao cancelar no Asaas' },
      { status: err.status || 500 }
    );
  }

  await supabase
    .from('saas_orders')
    .update({ payment_status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', order.id);

  await supabase
    .from('tenants')
    .update({
      subscription_status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', auth.ctx.tenant.tenant_id);

  return NextResponse.json({
    success: true,
    message:
      'Assinatura cancelada. Você continua com acesso até o fim do ciclo já pago.',
  });
}
