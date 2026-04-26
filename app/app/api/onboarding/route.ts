import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin, SAAS_PLAN_AMOUNTS, TRIAL_DAYS } from '@/lib/supabase';

const E164_REGEX = /^\+\d{10,15}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const generateTenantId = (clinicName: string) => {
  const slug = clinicName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug}-${uuidv4().slice(0, 8)}`;
};

const normalizePhoneToE164 = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (phone.trim().startsWith('+')) return '+' + digits;
  if (digits.startsWith('55') && digits.length >= 12) return '+' + digits;
  return '+55' + digits;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const normalizedPhone = normalizePhoneToE164(body?.real_phone ?? '');

    // ── Validacao ─────────────────────────────────────────────────────────────
    const validationErrors: Record<string, string> = {};
    if (!body?.doctor_name?.trim()) validationErrors.doctor_name = 'Obrigatório';
    if (!body?.doctor_crm?.trim()) validationErrors.doctor_crm = 'Obrigatório';
    if (!body?.speciality?.trim()) validationErrors.speciality = 'Obrigatório';
    if (!body?.clinic_name?.trim()) validationErrors.clinic_name = 'Obrigatório';

    if (!body?.admin_email?.trim()) {
      validationErrors.admin_email = 'Obrigatório';
    } else if (!EMAIL_REGEX.test(body.admin_email)) {
      validationErrors.admin_email = 'Email inválido';
    }

    if (!body?.real_phone?.trim()) {
      validationErrors.real_phone = 'Obrigatório';
    } else if (!E164_REGEX.test(normalizedPhone)) {
      validationErrors.real_phone = `Telefone inválido. Formato esperado: +5511999999999 (recebido: ${normalizedPhone})`;
    }

    if (Object.keys(validationErrors).length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Dados inválidos: ${Object.keys(validationErrors).join(', ')}`,
          missing_fields: Object.keys(validationErrors),
          validation_errors: validationErrors,
        },
        { status: 400 }
      );
    }

    // ── Setup ─────────────────────────────────────────────────────────────────
    const tenantId = generateTenantId(body.clinic_name);
    const planType = body?.plan_type ?? 'professional';
    const planAmount = SAAS_PLAN_AMOUNTS[planType] ?? SAAS_PLAN_AMOUNTS.professional;
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const consultationDuration = parseInt(body?.consultation_duration ?? '30', 10) || 30;
    const externalReference = `vvst-${tenantId}-${Date.now()}`;
    const qualifications: string[] = body?.qualifications ?? [];

    const supabase = supabaseAdmin();

    // ── Persistencia: tenants ─────────────────────────────────────────────────
    const tenantRow = {
      tenant_id: tenantId,
      clinic_name: body.clinic_name,
      email: body.admin_email,
      phone: normalizedPhone,
      real_phone: normalizedPhone,
      admin_email: body.admin_email,
      doctor_name: body.doctor_name,
      doctor_crm: body.doctor_crm,
      speciality: body.speciality,
      consultation_duration: consultationDuration,
      establishment_type: body?.establishment_type ?? 'small_clinic',
      plan_type: planType,
      status: 'pending_payment',
      subscription_status: 'trialing',
      trial_ends_at: trialEndsAt,
      payment_info: { qualifications, source: 'vivassit-frontend', version: '4.0' },
    };

    const { error: tenantErr } = await supabase
      .from('tenants')
      .insert(tenantRow);

    if (tenantErr) {
      console.error('[onboarding] erro ao inserir tenant:', tenantErr);
      return NextResponse.json(
        { success: false, message: 'Erro ao criar conta. Tente novamente.', error_code: 'TENANT_INSERT_FAILED', detail: tenantErr.message },
        { status: 500 }
      );
    }

    // ── Persistencia: saas_orders (assinatura SaaS Vivassit, pendente) ────────
    const orderRow = {
      external_reference: externalReference,
      clinic_name: body.clinic_name,
      plan_type: planType,
      amount: planAmount,
      clinic_data: {
        doctor_name: body.doctor_name,
        doctor_crm: body.doctor_crm,
        speciality: body.speciality,
        admin_email: body.admin_email,
        real_phone: normalizedPhone,
        establishment_type: body?.establishment_type ?? 'small_clinic',
        consultation_duration: consultationDuration,
        qualifications,
      },
      payment_status: 'pending',
      tenant_id: tenantId,
      provider: 'asaas',
      trial_ends_at: trialEndsAt,
    };

    const { data: orderData, error: orderErr } = await supabase
      .from('saas_orders')
      .insert(orderRow)
      .select('id, external_reference')
      .single();

    if (orderErr) {
      console.error('[onboarding] erro ao inserir saas_order:', orderErr);
      // Tenant ja foi criado: nao bloqueia o usuario, mas loga critico
    }

    const orderId = orderData?.id ?? null;

    // ── N8N webhook (provisionamento da clinica) ──────────────────────────────
    const payload = {
      real_phone: normalizedPhone,
      clinic_name: body.clinic_name,
      admin_email: body.admin_email,
      doctor_name: body.doctor_name,
      doctor_crm: body.doctor_crm,
      speciality: body.speciality,
      consultation_duration: consultationDuration.toString(),
      establishment_type: body?.establishment_type ?? 'small_clinic',
      plan_type: planType,
      qualifications,
      selected_features: qualifications,
      tenant_id: tenantId,
      order_id: orderId,
      external_reference: externalReference,
      trial_ends_at: trialEndsAt,
      source: 'vivassit-frontend',
      version: '4.0',
      timestamp: new Date().toISOString(),
      user_agent: request.headers.get('user-agent') || 'unknown',
      ip_address:
        request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown',
      status: 'trial_started',
      subscription_status: 'trialing',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      frontend_context: {
        user_timezone: body?.user_timezone || 'America/Sao_Paulo',
        client_version: request.headers.get('x-client-version') || 'unknown',
        form_completion_time: body?.form_completion_time || null,
        referrer: request.headers.get('referer') || null,
      },
    };

    let n8nSummary: Record<string, unknown> | null = null;
    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    if (webhookUrl) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000);
      try {
        const webhookResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Source': 'vivassit-frontend',
            'X-Version': '4.0',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        try {
          n8nSummary = await webhookResponse.json();
        } catch {
          // N8N pode nao retornar JSON
        }
        if (!webhookResponse.ok) {
          console.error('[onboarding] N8N retornou erro:', webhookResponse.status, n8nSummary);
        }
      } catch (err) {
        clearTimeout(timeoutId);
        const isTimeout = err instanceof Error && err.name === 'AbortError';
        console.error(isTimeout ? '[onboarding] N8N timeout' : '[onboarding] N8N error:', err);
        // Nao bloqueia: o tenant ja foi criado no Supabase, N8N pode rodar async depois
      }
    } else {
      console.warn('[onboarding] N8N_WEBHOOK_URL nao configurada, pulando provisionamento');
    }

    // ── Resposta ──────────────────────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      message: 'Cadastro realizado! Confirme seu pagamento para ativar a conta.',
      data: {
        tenant_id: tenantId,
        order_id: orderId,
        external_reference: externalReference,
        clinic_name: payload.clinic_name,
        doctor_name: payload.doctor_name,
        admin_email: payload.admin_email,
        plan_type: planType,
        amount: planAmount,
        trial_ends_at: trialEndsAt,
        subscription_status: 'trialing',
        next_step: 'checkout',
        checkout_url: orderId ? `/checkout/${orderId}` : null,
        // Dados de provisionamento N8N (se disponiveis)
        calendar_link: n8nSummary?.calendar_access_link ?? null,
        telegram_link: n8nSummary?.telegram_bot_link ?? null,
        whatsapp_pairing_code: n8nSummary?.whatsapp_pairing_code ?? null,
        automation_status: n8nSummary?.final_status ?? 'Em configuração',
        ready_for_appointments: n8nSummary?.ready_for_appointments ?? false,
        drive_link: n8nSummary?.drive_folder_link ?? null,
      },
    });
  } catch (error) {
    console.error('[onboarding] erro fatal:', error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Erro interno do servidor. Nossa equipe foi notificada.',
        error_code: 'INTERNAL_SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'API Vivassit v4.0 - Sistema de onboarding médico',
    version: '4.0',
    status: 'active',
    required_fields: ['real_phone', 'clinic_name', 'admin_email', 'doctor_name', 'doctor_crm', 'speciality'],
    phone_format: 'E.164 (+5511999999999)',
    persistence: 'supabase',
    trial_days: TRIAL_DAYS,
    plans: SAAS_PLAN_AMOUNTS,
  });
}
