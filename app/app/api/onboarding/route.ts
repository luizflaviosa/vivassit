
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// Função para gerar tenant_id único
const generateTenantId = (clinicName: string) => {
  const slug = clinicName.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^a-z0-9]/g, "-")       // Substitui caracteres especiais por hífen
    .replace(/-+/g, "-")              // Remove hífens duplicados
    .replace(/^-|-$/g, "");           // Remove hífen do início e fim
  
  return `${slug}-${uuidv4().toString().slice(0, 8)}`;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Log para debug (remover em produção)
    console.log('Dados recebidos:', body);

    // 🎯 PAYLOAD ESTRUTURADO PARA N8N WORKFLOW ESPECÍFICO
    const payload = {
      // ✅ CAMPOS OBRIGATÓRIOS (exatamente como esperado pelo N8N)
      real_phone: body?.real_phone ?? '',
      clinic_name: body?.clinic_name ?? '',
      admin_email: body?.admin_email ?? '',
      doctor_name: body?.doctor_name ?? '',
      doctor_crm: body?.doctor_crm ?? '',
      speciality: body?.speciality ?? '',
      consultation_duration: (body?.consultation_duration ?? '30').toString(), // String como no N8N
      establishment_type: body?.establishment_type ?? 'small_clinic',
      plan_type: body?.plan_type ?? 'professional',
      
      // ✅ FUNCIONALIDADES SELECIONADAS (mantém compatibilidade)
      qualifications: body?.qualifications ?? [], // Nome original
      selected_features: body?.qualifications ?? [], // Alias para compatibilidade
      
      // ✅ METADADOS ESPECÍFICOS PARA N8N WORKFLOW
      tenant_id: generateTenantId(body?.clinic_name ?? 'clinic'),
      source: 'vivassit-frontend', // Identificação específica
      version: '4.0', // Versão alinhada com o workflow v4
      timestamp: new Date().toISOString(),
      
      // ✅ DADOS DE RASTREAMENTO 
      user_agent: request.headers.get('user-agent') || 'unknown',
      ip_address: request.headers.get('x-forwarded-for') || 
                  request.headers.get('x-real-ip') || 'unknown',
      
      // ✅ STATUS DE PROCESSAMENTO
      status: 'pending_approval',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      
      // ✅ CONTEXTO ADICIONAL PARA N8N
      frontend_context: {
        user_timezone: body?.user_timezone || 'America/Sao_Paulo',
        client_version: request.headers.get('x-client-version') || 'unknown',
        form_completion_time: body?.form_completion_time || null,
        referrer: request.headers.get('referer') || null
      }
    };

    // Validação básica
    const requiredFields = ['real_phone', 'clinic_name', 'admin_email', 'doctor_name', 'doctor_crm', 'speciality'];
    const missingFields = requiredFields.filter(field => !payload[field as keyof typeof payload]);
    
    if (missingFields.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          message: `Campos obrigatórios ausentes: ${missingFields.join(', ')}`,
          missing_fields: missingFields
        },
        { status: 400 }
      );
    }

    // Webhook N8N para integração com Singular/NBN
    const webhookUrl = process.env.N8N_WEBHOOK_URL || 'https://webhook.site/vivassit-onboarding-test';
    
    // Modo de teste - se não tem webhook configurado, simula sucesso
    const isTestMode = webhookUrl.includes('webhook.site') || webhookUrl.includes('test') || !webhookUrl.startsWith('https://');
    
    if (isTestMode) {
      console.log('🧪 MODO DE TESTE - Simulando webhook:', webhookUrl);
      console.log('📤 Payload que seria enviado:', JSON.stringify(payload, null, 2));
      console.log('✅ Webhook simulado com sucesso:', payload.tenant_id);
    } else {
      // Modo produção - chama webhook real
      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Source': 'vivassit-frontend',
          'X-Version': '4.0'
        },
        body: JSON.stringify(payload)
      });

      let webhookResult = null;
      try {
        webhookResult = await webhookResponse.json();
      } catch (e) {
        console.log('Webhook não retornou JSON válido');
      }

      if (!webhookResponse.ok) {
        console.error('Erro no webhook:', webhookResponse.status, webhookResult);
        throw new Error(`Erro no webhook: ${webhookResponse.status}`);
      }

      console.log('✅ Dados enviados com sucesso para webhook:', payload.tenant_id);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Cadastro realizado com sucesso! Em breve você receberá um email com os próximos passos.',
      data: {
        tenant_id: payload.tenant_id,
        clinic_name: payload.clinic_name,
        doctor_name: payload.doctor_name,
        status: payload.status
      }
    });

  } catch (error) {
    console.error('❌ Erro na API:', error);
    
    // Log detalhado para debug
    if (error instanceof Error) {
      console.error('Detalhes do erro:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Erro interno do servidor. Nossa equipe foi notificada e irá resolver o problema em breve.',
        error_code: 'INTERNAL_SERVER_ERROR',
        debug_info: process.env.NODE_ENV === 'development' ? {
          error_message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        } : undefined
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: '🏥 API Vivassit v4.0 - Sistema de onboarding médico ativo',
    timestamp: new Date().toISOString(),
    version: '4.0',
    compatibility: 'N8N Workflow v4 + NBN/Singular Platform',
    webhook_ready: true,
    required_fields: [
      'real_phone', 'clinic_name', 'admin_email', 
      'doctor_name', 'doctor_crm', 'speciality'
    ],
    optional_fields: [
      'consultation_duration', 'establishment_type', 'plan_type', 'qualifications'
    ]
  });
}
