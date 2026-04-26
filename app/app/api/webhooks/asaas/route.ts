import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Webhook publico do Asaas: https://docs.asaas.com/docs/sobre-os-webhooks
// Eventos relevantes: PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_OVERDUE,
// PAYMENT_REFUNDED, etc.

export async function POST(req: NextRequest) {
  // Validacao de autenticidade: Asaas envia o token configurado no webhook
  // no header `asaas-access-token`. Se ASAAS_WEBHOOK_TOKEN estiver setado,
  // exige match. Sem env (dev local), aceita sem validar mas loga warning.
  const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;
  if (expectedToken) {
    const receivedToken = req.headers.get('asaas-access-token');
    if (receivedToken !== expectedToken) {
      console.warn('[webhook/asaas] token invalido recebido');
      return NextResponse.json(
        { success: false, message: 'unauthorized' },
        { status: 401 }
      );
    }
  } else {
    console.warn('[webhook/asaas] ASAAS_WEBHOOK_TOKEN nao configurado - aceitando sem validacao');
  }

  let payload: Record<string, unknown> | null = null;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { success: false, message: 'payload inválido' },
      { status: 400 }
    );
  }

  const supabase = supabaseAdmin();
  const event = (payload?.event as string) || 'UNKNOWN';
  const payment = (payload?.payment as Record<string, unknown> | undefined) ?? null;
  const paymentId = (payment?.id as string | undefined) ?? null;
  const externalReference = (payment?.externalReference as string | undefined) ?? null;
  const status = (payment?.status as string | undefined) ?? null;

  // Loga sempre, mesmo se for evento que nao tratamos
  await supabase.from('webhook_logs').insert({
    webhook_type: 'asaas',
    payment_id: paymentId,
    payload: payload as Record<string, unknown>,
    processing_status: 'received',
  });

  if (!event || !payment || !paymentId) {
    return NextResponse.json({ success: true, ignored: true });
  }

  // Mapeia evento -> status local
  let newPaymentStatus: string | null = null;
  let activateTenant = false;

  switch (event) {
    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED':
      newPaymentStatus = 'paid';
      activateTenant = true;
      break;
    case 'PAYMENT_OVERDUE':
      newPaymentStatus = 'overdue';
      break;
    case 'PAYMENT_REFUNDED':
      newPaymentStatus = 'refunded';
      break;
    case 'PAYMENT_DELETED':
      newPaymentStatus = 'cancelled';
      break;
    default:
      // Eventos que nao mudam status (PAYMENT_CREATED, etc)
      return NextResponse.json({ success: true, event, ignored: true });
  }

  // Atualiza saas_order
  const { data: order } = await supabase
    .from('saas_orders')
    .select('id, tenant_id, payment_status')
    .or(
      [
        `asaas_payment_id.eq.${paymentId}`,
        externalReference ? `external_reference.eq.${externalReference}` : null,
      ]
        .filter(Boolean)
        .join(',')
    )
    .limit(1)
    .maybeSingle();

  if (!order) {
    // Nao e saas_order - tenta tenant_payments (cobranca marketplace de paciente)
    const { data: tp } = await supabase
      .from('tenant_payments')
      .select('id, tenant_id, status')
      .eq('asaas_payment_id', paymentId)
      .maybeSingle();

    if (tp) {
      const tpStatusMap: Record<string, string> = {
        PAYMENT_CONFIRMED: 'approved',
        PAYMENT_RECEIVED: 'approved',
        PAYMENT_OVERDUE: 'overdue',
        PAYMENT_REFUNDED: 'refunded',
        PAYMENT_DELETED: 'cancelled',
      };
      const newStatus = tpStatusMap[event] ?? 'pending';
      await supabase
        .from('tenant_payments')
        .update({
          status: newStatus,
          approved_at: newStatus === 'approved' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tp.id);

      await supabase
        .from('webhook_logs')
        .update({
          processing_status: 'completed',
          processed_at: new Date().toISOString(),
        })
        .eq('payment_id', paymentId)
        .eq('processing_status', 'received');

      return NextResponse.json({
        success: true,
        event,
        target: 'tenant_payments',
        new_status: newStatus,
      });
    }

    // Nem saas_order nem tenant_payment: loga e segue
    await supabase
      .from('webhook_logs')
      .update({
        processing_status: 'completed',
        error_message: 'order não encontrado',
        processed_at: new Date().toISOString(),
      })
      .eq('payment_id', paymentId)
      .eq('processing_status', 'received');
    return NextResponse.json({ success: true, event, found: false });
  }

  await supabase
    .from('saas_orders')
    .update({
      payment_status: newPaymentStatus,
      asaas_payment_id: paymentId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id);

  if (activateTenant && order.tenant_id) {
    await supabase
      .from('tenants')
      .update({
        status: 'active',
        subscription_status: 'active',
        subscription_renews_at: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', order.tenant_id);
  }

  // Marca log como processado
  await supabase
    .from('webhook_logs')
    .update({
      processing_status: 'completed',
      processed_at: new Date().toISOString(),
    })
    .eq('payment_id', paymentId)
    .eq('processing_status', 'received');

  return NextResponse.json({
    success: true,
    event,
    status,
    payment_status: newPaymentStatus,
  });
}

export async function GET() {
  // Endpoint de saude / verificacao manual
  return NextResponse.json({ ok: true, webhook: 'asaas', version: '1.0' });
}
