
// Script para testar a API do Vivassit v4.0 (compatível com N8N Workflow)
// Execute com: node test-api.js

const testOnboardingAPI = async () => {
  console.log('🧪 TESTE API VIVASSIT v4.0 - N8N WORKFLOW READY');
  console.log('=' * 60);
  console.log();

  const testData = {
    // ✅ CAMPOS EXATOS ESPERADOS PELO N8N WORKFLOW
    real_phone: '+5543999006713', // Mesmo formato do workflow
    clinic_name: 'Clínica Médica Teste v4',
    admin_email: 'teste@clinicav4.com.br',
    doctor_name: 'Dr. João Silva Teste',
    doctor_crm: 'CRM/SP 987654',
    speciality: 'cardiologia',
    consultation_duration: '30', // String como esperado
    establishment_type: 'small_clinic',
    plan_type: 'professional',
    qualifications: ['Telemedicina', 'Agenda Online', 'Prontuário Eletrônico'],
    
    // ✅ METADADOS ESPECÍFICOS V4.0
    source: 'vivassit-api-test-v4',
    user_timezone: 'America/Sao_Paulo',
    workflow_version: '4.0',
    form_completion_time: 120 // 2 minutos simulado
  };

  try {
    console.log('📤 Enviando dados:');
    console.log(JSON.stringify(testData, null, 2));
    console.log('\n⏳ Aguardando resposta...\n');

    const response = await fetch('http://localhost:3000/api/onboarding', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Version': '4.0.0',
        'X-Workflow-Target': 'n8n-v4',
        'User-Agent': 'Vivassit-Test-Client-v4'
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();

    console.log(`📋 Status: ${response.status} ${response.statusText}`);
    console.log('📥 Resposta da API:');
    console.log(JSON.stringify(result, null, 2));

    if (response.ok && result.success) {
      console.log('\n✅ TESTE PASSOU!');
      console.log(`🆔 Tenant ID: ${result.data?.tenant_id}`);
      console.log(`🏥 Clínica: ${result.data?.clinic_name}`);
      console.log(`👨‍⚕️ Médico: ${result.data?.doctor_name}`);
    } else {
      console.log('\n❌ TESTE FALHOU!');
      if (result.missing_fields) {
        console.log('Campos faltantes:', result.missing_fields);
      }
    }

  } catch (error) {
    console.error('🚨 Erro no teste:', error.message);
  }
};

// Executar teste
testOnboardingAPI();
