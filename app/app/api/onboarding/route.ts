
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

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

    const tenantId = generateTenantId(body.clinic_name);

    const payload = {
      real_phone: normalizedPhone,
      clinic_name: body.clinic_name,
      admin_email: body.admin_email,
      doctor_name: body.doctor_name,
      doctor_crm: body.doctor_crm,
      speciality: body.speciality,
      consultation_duration: (body?.consultation_duration ?? '30').toString(),
      establishment_type: body?.establishment_type ?? 'small_clinic',
      plan_type: body?.plan_type ?? 'professional',

      qualifications: body?.qualifications ?? [],
      selected_features: body?.qualifications ?? [],

      tenant_id: tenantId,
      source: 'vivassit-frontend',
      version: '4.0',
      timestamp: new Date().toISOString(),

      user_agent: request.headers.get('user-agent') || 'unknown',
      ip_address:
        request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown',

      status: 'pending_approval',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),

      frontend_context: {
        user_timezone: body?.user_timezone || 'America/Sao_Paulo',
        client_version: request.headers.get('x-client-version') || 'unknown',
        form_completion_time: body?.form_completion_time || null,
        referrer: request.headers.get('referer') || null,
      },
    };

    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    if (!webhookUrl) {
      console.error('N8N_WEBHOOK_URL não configurada');
      return NextResponse.json(
        { success: false, message: 'Serviço temporariamente indisponível.', error_code: 'WEBHOOK_NOT_CONFIGURED' },
        { status: 503 }
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    let webhookResult: Record<string, unknown> | null = null;
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
        webhookResult = await webhookResponse.json();
      } catch {
        // N8N pode não retornar JSON em alguns casos
      }

      if (!webhookResponse.ok) {
        console.error('Webhook retornou erro:', webhookResponse.status, webhookResult);
        throw new Error(`Webhook status ${webhookResponse.status}`);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      console.error(isTimeout ? 'Webhook timeout' : 'Webhook error:', err);
      throw new Error(isTimeout ? 'Timeout na comunicação com o serviço' : 'Falha ao contatar o serviço de onboarding');
    }

    const n8nSummary = webhookResult as Record<string, unknown> | null;

    return NextResponse.json({
      success: true,
      message: 'Cadastro realizado com sucesso! Em breve você receberá um email com os próximos passos.',
      data: {
        tenant_id: tenantId,
        clinic_name: payload.clinic_name,
        doctor_name: payload.doctor_name,
        admin_email: payload.admin_email,
        status: payload.status,
        calendar_link: n8nSummary?.calendar_access_link ?? null,
        telegram_link: n8nSummary?.telegram_bot_link ?? null,
        whatsapp_pairing_code: n8nSummary?.whatsapp_pairing_code ?? null,
        automation_status: n8nSummary?.final_status ?? 'Em configuração',
        ready_for_appointments: n8nSummary?.ready_for_appointments ?? false,
        drive_link: n8nSummary?.drive_folder_link ?? null,
      },
    });
  } catch (error) {
    console.error('Erro na API de onboarding:', error);
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
  });
}
