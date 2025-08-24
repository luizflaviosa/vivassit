
// Script para testar a API do Vivassit
// Execute com: node test-api.js

const testOnboardingAPI = async () => {
  console.log('🧪 Testando API Vivassit...\n');

  const testData = {
    real_phone: '+5511987654321',
    clinic_name: 'Clínica São Lucas',
    admin_email: 'admin@clinicasaolucas.com.br',
    doctor_name: 'Dr. Maria Silva Santos',
    doctor_crm: 'CRM/SP 145678',
    speciality: 'cardiologia',
    consultation_duration: '45',
    establishment_type: 'medium_clinic',
    plan_type: 'professional',
    qualifications: ['Telemedicina', 'Agenda Online', 'Prontuário Eletrônico'],
    source: 'api-test',
    user_timezone: 'America/Sao_Paulo'
  };

  try {
    console.log('📤 Enviando dados:');
    console.log(JSON.stringify(testData, null, 2));
    console.log('\n⏳ Aguardando resposta...\n');

    const response = await fetch('http://localhost:3000/api/onboarding', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Version': '2.0.0',
        'User-Agent': 'Vivassit-Test-Client'
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
