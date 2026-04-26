import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getPayment } from '@/lib/asaas';

interface Params {
  params: { reference: string };
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const ref = decodeURIComponent(params.reference || '');
    if (!ref) {
      return NextResponse.json(
        { success: false, message: 'reference obrigatório' },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();
    const { data: order, error } = await supabase
      .from('saas_orders')
      .select('id, payment_status, asaas_payment_id, tenant_id, plan_type, amount')
      .eq('external_reference', ref)
      .single();

    if (error || !order) {
      return NextResponse.json(
        { success: false, message: 'Pedido não encontrado' },
        { status: 404 }
      );
    }

    // Se ja esta pago no banco, retorna direto
    if (order.payment_status === 'paid' || order.payment_status === 'approved') {
      return NextResponse.json({
        success: true,
        paid: true,
        local_status: order.payment_status,
      });
    }

    // Se ainda nao tem pagamento Asaas associado, ainda esta na etapa de criar
    if (!order.asaas_payment_id) {
      return NextResponse.json({
        success: true,
        paid: false,
        local_status: order.payment_status,
        asaas_status: null,
      });
    }

    // Consulta o Asaas em tempo real
    const payment = await getPayment(order.asaas_payment_id);
    const isPaid = payment.status === 'CONFIRMED' || payment.status === 'RECEIVED';

    // Se mudou e nao foi atualizado ainda, sincroniza
    if (isPaid && order.payment_status !== 'paid') {
      await supabase
        .from('saas_orders')
        .update({
          payment_status: 'paid',
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (order.tenant_id) {
        await supabase
          .from('tenants')
          .update({
            status: 'active',
            subscription_status: 'active',
            subscription_renews_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('tenant_id', order.tenant_id);
      }
    }

    return NextResponse.json({
      success: true,
      paid: isPaid,
      asaas_status: payment.status,
      local_status: isPaid ? 'paid' : order.payment_status,
    });
  } catch (error) {
    const err = error as Error & { status?: number };
    console.error('[checkout/status] erro:', err.message);
    return NextResponse.json(
      { success: false, message: err.message || 'Erro ao consultar status' },
      { status: err.status || 500 }
    );
  }
}
