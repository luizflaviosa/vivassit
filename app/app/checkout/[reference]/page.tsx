import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import CheckoutClient from './CheckoutClient';

interface PageProps {
  params: { reference: string };
}

interface OrderRow {
  id: number;
  external_reference: string;
  clinic_name: string;
  plan_type: string;
  amount: number | string;
  payment_status: string;
  tenant_id: string | null;
  trial_ends_at: string | null;
  clinic_data: {
    doctor_name?: string;
    admin_email?: string;
    real_phone?: string;
    plan_amount?: number;
    addon_amount?: number;
    addon_human_support?: boolean;
  } | null;
}

async function loadOrder(reference: string): Promise<OrderRow | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('saas_orders')
    .select(
      'id, external_reference, clinic_name, plan_type, amount, payment_status, tenant_id, trial_ends_at, clinic_data'
    )
    .eq('external_reference', reference)
    .maybeSingle();
  if (error || !data) return null;
  return data as OrderRow;
}

export default async function CheckoutPage({ params }: PageProps) {
  const ref = decodeURIComponent(params.reference);
  const order = await loadOrder(ref);
  if (!order) notFound();

  const payer = {
    name: order.clinic_data?.doctor_name ?? '',
    email: order.clinic_data?.admin_email ?? '',
    phone: order.clinic_data?.real_phone ?? '',
  };

  return (
    <CheckoutClient
      reference={order.external_reference}
      tenantId={order.tenant_id}
      planType={order.plan_type}
      clinicName={order.clinic_name}
      amount={Number(order.amount)}
      planAmount={
        order.clinic_data?.plan_amount != null
          ? Number(order.clinic_data.plan_amount)
          : undefined
      }
      addonAmount={
        order.clinic_data?.addon_amount != null
          ? Number(order.clinic_data.addon_amount)
          : 0
      }
      addonHumanSupport={!!order.clinic_data?.addon_human_support}
      trialEndsAt={order.trial_ends_at}
      paymentStatus={order.payment_status}
      defaultPayer={payer}
    />
  );
}

export const dynamic = 'force-dynamic';
