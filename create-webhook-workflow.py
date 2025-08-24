
#!/usr/bin/env python3
"""
Script para converter o workflow N8N de Manual Trigger para Webhook
"""
import json
import uuid

def create_webhook_workflow():
    print("🔧 CONVERTENDO WORKFLOW PARA WEBHOOK")
    
    # Ler workflow original
    with open('n8n-workflow-original.json', 'r') as f:
        workflow = json.load(f)
    
    # IDs dos nós a modificar
    manual_trigger_id = '079318df-e626-4100-bd78-cbbb9b7f8a9b'
    data_node_id = 'e0e401a6-291a-478f-8713-cb84985d7f70'
    
    # Criar novo nó webhook
    webhook_node = {
        "parameters": {
            "httpMethod": "POST",
            "path": "/vivassit-onboarding-v4",
            "options": {
                "rawBody": True
            }
        },
        "id": str(uuid.uuid4()),
        "name": "🎯 Webhook Vivassit v4",
        "type": "n8n-nodes-base.webhook",
        "typeVersion": 1,
        "position": [-10400, 3536],
        "webhookId": "vivassit-onboarding-v4"
    }
    
    # Criar nó para processar dados do webhook
    webhook_processor = {
        "parameters": {
            "jsCode": """
// Processar dados vindos do frontend Vivassit
const body = $input.first().json.body;
let data;

try {
  // Se body é string, parse JSON
  if (typeof body === 'string') {
    data = JSON.parse(body);
  } else {
    data = body;
  }
} catch (e) {
  // Se falhar, usar dados diretos
  data = $input.first().json;
}

console.log('📥 Dados recebidos do frontend:', data);

// Mapear campos do frontend para estrutura esperada
const processed = {
  real_phone: data.real_phone || data.phone || '',
  clinic_name: data.clinic_name || '',
  admin_email: data.admin_email || '',
  doctor_name: data.doctor_name || '',
  doctor_crm: data.doctor_crm || '',
  speciality: data.speciality || data.specialty || '',
  consultation_duration: (data.consultation_duration || '30').toString(),
  establishment_type: data.establishment_type || 'small_clinic',
  plan_type: data.plan_type || 'professional',
  api_key_chatwoot: 'oZy1eCh7dt3YdSthzov7YsJ9', // Manter API key fixa
  
  // Metadados extras do frontend
  tenant_id: data.tenant_id || null,
  source: data.source || 'vivassit-frontend',
  timestamp: data.timestamp || new Date().toISOString(),
  qualifications: data.qualifications || data.selected_features || []
};

console.log('✅ Dados processados:', processed);

return processed;
"""
        },
        "id": str(uuid.uuid4()),
        "name": "📝 Processar Dados Webhook",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [-10240, 3536],
        "onError": "continueRegularOutput"
    }
    
    # Remover o nó manual trigger e o nó de dados de teste
    workflow['nodes'] = [node for node in workflow['nodes'] 
                        if node.get('id') not in [manual_trigger_id, data_node_id]]
    
    # Adicionar novos nós
    workflow['nodes'].extend([webhook_node, webhook_processor])
    
    # Atualizar conexões
    if 'connections' not in workflow:
        workflow['connections'] = {}
    
    # Conectar webhook -> processor
    webhook_connections = [{
        "node": webhook_processor['name'],
        "type": "main",
        "index": 0
    }]
    
    # Conectar processor ao próximo nó (Generate Test Data v)
    processor_connections = [{
        "node": "Generate Test Data v",
        "type": "main", 
        "index": 0
    }]
    
    workflow['connections'][webhook_node['name']] = {
        "main": [webhook_connections]
    }
    
    workflow['connections'][webhook_processor['name']] = {
        "main": [processor_connections]
    }
    
    # Atualizar metadados do workflow
    workflow['name'] = "Vivassit Onboarding Webhook v4"
    workflow['settings'] = {
        "timezone": "America/Sao_Paulo"
    }
    
    # Salvar novo workflow
    with open('n8n-workflow-webhook-ready.json', 'w') as f:
        json.dump(workflow, f, indent=2, ensure_ascii=False)
    
    print("✅ Workflow webhook criado: n8n-workflow-webhook-ready.json")
    print()
    print("🔗 PRÓXIMOS PASSOS:")
    print("1. Importe 'n8n-workflow-webhook-ready.json' no seu N8N")
    print("2. Ative o workflow")
    print("3. Copie a URL do webhook gerada")
    print("4. Configure no .env: N8N_WEBHOOK_URL=sua-url-webhook")
    print()
    
    return webhook_node['id'], webhook_processor['id']

if __name__ == "__main__":
    create_webhook_workflow()
