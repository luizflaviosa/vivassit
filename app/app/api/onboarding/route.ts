import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin, SAAS_PLAN_AMOUNTS, ADDON_HUMAN_SUPPORT_PRICE, TRIAL_DAYS } from '@/lib/supabase';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

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
  // Rate limit: 5 onboardings por IP por hora (defensa contra abuse)
  const ip = getClientIp(request);
  const rl = rateLimit(`onboarding:${ip}`, { max: 5, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json(
      {
        success: false,
        message: `Muitas tentativas. Tente novamente em ${rl.retryAfterSeconds} segundos.`,
        error_code: 'RATE_LIMITED',
      },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    );
  }

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
    const isSobMedida = planType === 'sob_medida' || body?.establishment_type === 'large_clinic';
    const addonHumanSupport: boolean = !!body?.addon_human_support;
    // Sob Medida: addon entra na proposta (sem preço fixo). Outros planos: soma R$ 297.
    const addonAmount = addonHumanSupport && !isSobMedida ? ADDON_HUMAN_SUPPORT_PRICE : 0;
    const totalAmount = planAmount + addonAmount;
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const consultationDuration = parseInt(body?.consultation_duration ?? '30', 10) || 30;
    const externalReference = `vvst-${tenantId}-${Date.now()}`;
    const qualifications: string[] = body?.qualifications ?? [];
    const professionalType: string = body?.professional_type ?? 'medico';
    const establishmentType: string = body?.establishment_type ?? 'private_practice';
    // chatwoot: 1 prof = compartilhado na conta singulare; clinicas = dedicada
    const chatwootType: 'shared' | 'dedicated' =
      establishmentType === 'private_practice' ? 'shared' : 'dedicated';
    const acceptsInsurance: boolean = !!body?.accepts_insurance;
    const insuranceListBase: string[] = Array.isArray(body?.insurance_list) ? body.insurance_list : [];
    // Mescla "outros planos" texto livre (separados por vírgula) na lista final
    const insuranceOther: string = String(body?.insurance_other ?? '').trim();
    const insuranceOtherList = insuranceOther
      ? insuranceOther.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
      : [];
    const insuranceList: string[] = [...insuranceListBase, ...insuranceOtherList];
    const paymentMethodsArr: string[] = Array.isArray(body?.payment_methods) ? body.payment_methods : [];
    const consultationValue: number | null = body?.consultation_value
      ? parseFloat(String(body.consultation_value).replace(',', '.'))
      : null;
    const followupWindowDays: number = parseInt(String(body?.followup_window_days ?? '30'), 10) || 30;
    const workingHours = body?.working_hours && typeof body.working_hours === 'object' ? body.working_hours : {};
    const assistantPrompt: string = (body?.assistant_prompt ?? '').toString().trim();
    const lgpdAccepted: boolean = !!body?.lgpd_accepted;

    const supabase = supabaseAdmin();

    // ── Persistencia: tenants ─────────────────────────────────────────────────
    const tenantRow = {
      tenant_id: tenantId,
      clinic_name: body.clinic_name,
      email: body.admin_email,
      phone: normalizedPhone,
      real_phone: normalizedPhone,
      admin_email: body.admin_email,
      address: body?.address ?? null,
      doctor_name: body.doctor_name,
      doctor_crm: body.doctor_crm,
      speciality: body.speciality,
      consultation_duration: consultationDuration,
      establishment_type: establishmentType,
      chatwoot_type: chatwootType,
      plan_type: planType,
      status: isSobMedida ? 'proposal_pending' : 'pending_payment',
      subscription_status: 'trialing',
      trial_ends_at: trialEndsAt,
      assistant_prompt: assistantPrompt || null,
      payment_info: {
        qualifications,
        source: 'vivassit-frontend',
        version: '4.2',
        professional_type: professionalType,
        accepts_insurance: acceptsInsurance,
        insurance_list: insuranceList,
        accepted_payment_methods: paymentMethodsArr,
        charge_timing: body?.charge_timing ?? 'after',
        partial_charge_pct: body?.partial_charge_pct ?? 100,
        followup_window_days: followupWindowDays,
        auto_emit_nf: !!body?.auto_emit_nf,
        accountant_email: body?.accountant_email ?? null,
        addon_human_support: addonHumanSupport,
        is_sob_medida: isSobMedida,
        sob_medida_data: isSobMedida ? {
          num_profissionais: body?.sob_medida_num_profissionais ?? null,
          num_unidades: body?.sob_medida_num_unidades ?? null,
          necessidades: body?.sob_medida_necessidades ?? null,
        } : null,
        lgpd_accepted: lgpdAccepted,
        lgpd_accepted_at: lgpdAccepted ? new Date().toISOString() : null,
        lgpd_accepted_ip:
          request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          request.headers.get('x-real-ip') ||
          null,
      },
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

    // ── Persistencia: tenant_doctors (profissional principal) ─────────────────
    // O trigger SQL `trg_tenant_onboard_doctor` (em tenants AFTER INSERT) JA
    // criou um tenant_doctor minimo. Aqui so completamos os campos restantes
    // via UPDATE para evitar duplicacao + conflito UNIQUE em doctor_crm.
    // Trigger `trg_doctor_prompt_rebuild` regenera rendered_prompt apos isso.
    const paymentMethodsString = paymentMethodsArr.length
      ? paymentMethodsArr
          .map((m) => {
            switch (m) {
              case 'pix': return 'PIX';
              case 'credit_card': return 'cartão';
              case 'boleto': return 'boleto';
              case 'cash': return 'dinheiro';
              default: return m;
            }
          })
          .join(', ')
      : null;

    const doctorUpdateData = {
      consultation_value: consultationValue,
      consultation_duration: consultationDuration,
      payment_methods: paymentMethodsString,
      working_hours: workingHours,
      accepts_insurance: acceptsInsurance,
      insurance_note: insuranceList.length ? insuranceList.join(', ') : null,
      followup_value: 0,
      followup_window_days: followupWindowDays,
      followup_duration: 30,
      contact_email: body.admin_email,
      contact_phone: normalizedPhone,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedDoctor, error: doctorErr } = await supabase
      .from('tenant_doctors')
      .update(doctorUpdateData)
      .eq('tenant_id', tenantId)
      .eq('is_primary', true)
      .select('id')
      .maybeSingle();

    if (doctorErr) {
      console.error('[onboarding] erro ao atualizar tenant_doctor:', doctorErr);
      // Nao bloqueia: o tenant ja existe e o trigger criou um doctor minimo
    } else if (!updatedDoctor) {
      // Fallback: trigger nao criou (caso doctor_name vazio?). Insere manualmente.
      const { error: insertErr } = await supabase
        .from('tenant_doctors')
        .insert({
          tenant_id: tenantId,
          doctor_name: body.doctor_name,
          doctor_crm: body.doctor_crm || null,
          specialty: body.speciality,
          is_primary: true,
          status: 'active',
          ...doctorUpdateData,
        });
      if (insertErr) {
        console.error('[onboarding] fallback INSERT tenant_doctor falhou:', insertErr);
      }
    }

    // ── Profissionais adicionais (clinica, opcional no onboarding) ────────────
    interface AdditionalDoctorIn {
      doctor_name?: string;
      doctor_crm?: string;
      specialty?: string;
    }
    const additionalDoctors: AdditionalDoctorIn[] = Array.isArray(body?.additional_doctors)
      ? body.additional_doctors
      : [];
    const validDoctors = additionalDoctors.filter(
      (d) => d?.doctor_name?.trim() && d?.specialty?.trim()
    );

    if (validDoctors.length > 0) {
      const rows = validDoctors.map((d) => ({
        tenant_id: tenantId,
        doctor_name: d.doctor_name!.trim(),
        doctor_crm: d.doctor_crm?.trim() || null,
        specialty: d.specialty!.trim(),
        is_primary: false,
        status: 'active',
        consultation_duration: 30,
        followup_value: 0,
        followup_window_days: 30,
        followup_duration: 30,
      }));

      const { error: addDocsErr } = await supabase.from('tenant_doctors').insert(rows);
      if (addDocsErr) {
        console.error('[onboarding] erro ao inserir profissionais adicionais:', addDocsErr);
        // Nao bloqueia - admin pode adicionar depois pelo painel
      }
    }

    // ── Magic link de primeiro acesso (passa para N8N enviar via email) ───────
    // Estrategia:
    //   1. Cria user no auth (idempotente; se ja existe, ignora)
    //   2. Gera magic link autenticando esse user; redirect para /painel
    //   3. Inclui URL no payload pro N8N enviar no email de boas-vindas
    let magicLinkUrl: string | null = null;
    try {
      const origin = request.nextUrl.origin || 'https://app.singulare.org';
      const redirectTo = `${origin}/auth/callback?next=/painel`;

      // Cria user pre-confirmado (silenciosa em caso de "already exists")
      await supabase.auth.admin.createUser({
        email: body.admin_email,
        email_confirm: true,
        user_metadata: { tenant_id: tenantId, clinic_name: body.clinic_name },
      }).catch(() => null);

      // Gera magic link (user agora existe garantidamente)
      const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: body.admin_email,
        options: { redirectTo },
      });

      if (linkErr) {
        console.warn('[onboarding] generateLink falhou:', linkErr.message);
      } else {
        magicLinkUrl = linkData?.properties?.action_link ?? null;
      }
    } catch (e) {
      console.error('[onboarding] erro ao gerar magic link:', e);
      // Nao bloqueia: usuario pode entrar via /login normalmente
    }

    // ── Persistencia: saas_orders (assinatura SaaS Vivassit, pendente) ────────
    // Sob Medida não vai pra checkout — fica salvo como 'proposal_pending'
    // pra equipe comercial avaliar e enviar proposta manualmente.
    const orderRow = {
      external_reference: externalReference,
      clinic_name: body.clinic_name,
      plan_type: planType,
      amount: totalAmount, // plano + addon (se aplicável)
      clinic_data: {
        doctor_name: body.doctor_name,
        doctor_crm: body.doctor_crm,
        speciality: body.speciality,
        admin_email: body.admin_email,
        real_phone: normalizedPhone,
        establishment_type: body?.establishment_type ?? 'small_clinic',
        // Breakdown do total + flags
        plan_amount: planAmount,
        addon_human_support: addonHumanSupport,
        addon_amount: addonAmount,
        is_sob_medida: isSobMedida,
        sob_medida_num_profissionais: body?.sob_medida_num_profissionais ?? null,
        sob_medida_num_unidades: body?.sob_medida_num_unidades ?? null,
        sob_medida_necessidades: body?.sob_medida_necessidades ?? null,
        address: body?.address ?? null,
        consultation_duration: consultationDuration,
        qualifications,
      },
      payment_status: isSobMedida ? 'proposal_pending' : 'pending',
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
    // Sob Medida: NÃO dispara provisionamento — fica como lead pra equipe.
    const payload = {
      real_phone: normalizedPhone,
      clinic_name: body.clinic_name,
      admin_email: body.admin_email,
      address: body?.address ?? null,
      doctor_name: body.doctor_name,
      doctor_crm: body.doctor_crm,
      speciality: body.speciality,
      professional_type: professionalType,
      consultation_duration: consultationDuration.toString(),
      establishment_type: establishmentType,
      chatwoot_type: chatwootType,
      plan_type: planType,
      qualifications,
      selected_features: qualifications,
      consultation_value: consultationValue,
      payment_methods: paymentMethodsString,
      accepts_insurance: acceptsInsurance,
      insurance_list: insuranceList,
      addon_human_support: addonHumanSupport,
      is_sob_medida: isSobMedida,
      followup_window_days: followupWindowDays,
      working_hours: workingHours,
      assistant_prompt: assistantPrompt,
      tenant_id: tenantId,
      order_id: orderId,
      external_reference: externalReference,
      trial_ends_at: trialEndsAt,
      // Magic link de primeiro acesso - inserir como CTA principal do email N8N
      magic_link_url: magicLinkUrl,
      panel_url: `${request.nextUrl.origin || 'https://app.singulare.org'}/painel`,
      checkout_url: orderId
        ? `${request.nextUrl.origin || 'https://app.singulare.org'}/checkout/${externalReference}`
        : null,
      source: 'vivassit-frontend',
      version: '4.2',
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
    // Sob Medida: pula provisionamento. Tenant fica salvo (lead) e equipe processa manual.
    if (webhookUrl && !isSobMedida) {
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

        // ── Persiste dados do N8N de volta no tenants ─────────────────────────
        // O workflow N8N retorna calendar_id, evolution_phone_number, telegram_bot_link, etc
        // mas nao salva no banco. Sem isso, o painel fica sem essas integracoes.
        if (n8nSummary) {
          const sum = n8nSummary as Record<string, unknown>;
          const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
          if (typeof sum.calendar_id === 'string') updates.calendar_id = sum.calendar_id;
          if (typeof sum.evolution_phone_number === 'string') updates.evolution_phone_number = sum.evolution_phone_number;
          if (typeof sum.evolution_instance_name === 'string') updates.evolution_instance_name = sum.evolution_instance_name;
          if (typeof sum.evolution_instance_id === 'string') updates.evolution_instance_id = sum.evolution_instance_id;
          if (typeof sum.evolution_status === 'string') updates.evolution_status = sum.evolution_status;
          if (typeof sum.evolution_qr_code === 'string') updates.evolution_qr_code = sum.evolution_qr_code;
          if (typeof sum.telegram_bot_link === 'string') updates.telegram_bot_link = sum.telegram_bot_link;
          if (typeof sum.telegram_chat_id === 'string') updates.telegram_chat_id = sum.telegram_chat_id;
          if (typeof sum.chatwoot_account_id === 'string') updates.chatwoot_account_id = sum.chatwoot_account_id;
          if (typeof sum.chatwoot_domain === 'string') updates.chatwoot_domain = sum.chatwoot_domain;
          if (typeof sum.chatwoot_type === 'string') updates.chatwoot_type = sum.chatwoot_type;
          if (typeof sum.drive_folder_id === 'string') updates.drive_folder_id = sum.drive_folder_id;
          if (sum.calendar_config && typeof sum.calendar_config === 'object') updates.calendar_config = sum.calendar_config;

          if (Object.keys(updates).length > 1) {
            const { error: updErr } = await supabase
              .from('tenants')
              .update(updates)
              .eq('tenant_id', tenantId);
            if (updErr) {
              console.error('[onboarding] falha ao salvar dados N8N no tenants:', updErr);
            } else {
              console.log('[onboarding] tenants atualizado com', Object.keys(updates).length - 1, 'campos do N8N');
            }

            // Tambem atualiza tenant_doctors do principal com calendar_id (se veio)
            if (typeof sum.calendar_id === 'string' && sum.calendar_id) {
              await supabase
                .from('tenant_doctors')
                .update({ calendar_id: sum.calendar_id, updated_at: new Date().toISOString() })
                .eq('tenant_id', tenantId)
                .eq('is_primary', true);
            }
          }
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
      message: isSobMedida
        ? 'Recebemos seus dados! Nossa equipe entrará em contato em até 1 dia útil para apresentar a proposta sob medida.'
        : 'Cadastro realizado! Confirme seu pagamento para ativar a conta.',
      data: {
        tenant_id: tenantId,
        order_id: orderId,
        external_reference: externalReference,
        clinic_name: payload.clinic_name,
        doctor_name: payload.doctor_name,
        admin_email: payload.admin_email,
        plan_type: planType,
        amount: totalAmount,
        plan_amount: planAmount,
        addon_amount: addonAmount,
        addon_human_support: addonHumanSupport,
        is_sob_medida: isSobMedida,
        trial_ends_at: trialEndsAt,
        subscription_status: 'trialing',
        next_step: isSobMedida ? 'awaiting_proposal' : 'checkout',
        // Sob Medida: SEM checkout_url. UI mostra tela de "obrigado, equipe vai contatar"
        checkout_url: !isSobMedida && orderId ? `/checkout/${externalReference}` : null,
        magic_link_url: magicLinkUrl,
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
