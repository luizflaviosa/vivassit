
# 🧪 **GUIA COMPLETO DE TESTES E INTEGRAÇÃO N8N**

## 📋 **ÍNDICE**
1. [Testes Locais (Sem N8N)](#1-testes-locais-sem-n8n)
2. [Teste da API Isolada](#2-teste-da-api-isolada)
3. [Teste com Webhook Temporário](#3-teste-com-webhook-temporário)
4. [Configuração do N8N](#4-configuração-do-n8n)
5. [Integração Completa](#5-integração-completa)
6. [Monitoramento e Logs](#6-monitoramento-e-logs)
7. [Resolução de Problemas](#7-resolução-de-problemas)

---

## **1. TESTES LOCAIS (SEM N8N)**

### **🚀 Iniciar o servidor:**
```bash
cd app
yarn dev
```

### **🌐 URLs para testar:**
- **Landing Page**: http://localhost:3000/landing
- **Onboarding**: http://localhost:3000/onboarding
- **API Status**: http://localhost:3000/api/onboarding (GET)

### **📝 Teste manual:**
1. Acesse http://localhost:3000/landing
2. Clique em "Começar Agora"
3. Preencha o formulário de onboarding
4. Observe os logs no terminal
5. Verifique a mensagem de sucesso

### **✅ O que esperar:**
- ✅ Formulário funciona sem erros
- ✅ Logs mostram dados recebidos
- ✅ Mensagem de sucesso com tenant_id
- ✅ Redirecionamento para landing page

---

## **2. TESTE DA API ISOLADA**

### **🤖 Teste automatizado:**
```bash
node test-api.js
```

### **📞 Teste com curl:**
```bash
curl -X POST http://localhost:3000/api/onboarding \
  -H 'Content-Type: application/json' \
  -H 'X-Client-Version: 2.0.0' \
  -d '{
    "real_phone": "+5511987654321",
    "clinic_name": "Clínica Teste",
    "admin_email": "admin@teste.com",
    "doctor_name": "Dr. João Silva",
    "doctor_crm": "CRM/SP 123456",
    "speciality": "cardiologia",
    "consultation_duration": "30",
    "establishment_type": "small_clinic",
    "plan_type": "professional",
    "qualifications": ["Telemedicina", "Agenda Online"]
  }'
```

### **✅ Resposta esperada:**
```json
{
  "success": true,
  "message": "Cadastro realizado com sucesso! Em breve você receberá um email com os próximos passos.",
  "data": {
    "tenant_id": "clinica-teste-a1b2c3d4",
    "clinic_name": "Clínica Teste",
    "doctor_name": "Dr. João Silva",
    "status": "pending_approval"
  }
}
```

---

## **3. TESTE COM WEBHOOK TEMPORÁRIO**

### **🔗 Configurar webhook de teste:**
1. Vá em https://webhook.site
2. Copie a URL única gerada
3. Abra o arquivo `test-webhook.html` no navegador
4. Cole a URL do webhook.site
5. Preencha o formulário e teste

### **🎯 Configurar no código:**
```bash
# Editar arquivo .env (criar se não existir)
echo "N8N_WEBHOOK_URL=https://webhook.site/sua-url-unica" > app/.env
```

### **🧪 Executar teste:**
1. Abra `test-webhook.html` no navegador
2. Configure a URL do webhook
3. Preencha os dados de teste
4. Clique em "Testar Webhook"
5. Verifique o webhook.site para ver os dados

### **✅ Verificações:**
- ✅ Dados aparecem no webhook.site
- ✅ JSON estruturado corretamente
- ✅ Tenant_id é gerado
- ✅ Todos os campos estão presentes

---

## **4. CONFIGURAÇÃO DO N8N**

### **📦 Opção 1: N8N Local**
```bash
# Instalar N8N
npm install -g n8n

# Iniciar N8N
n8n start

# Acesse: http://localhost:5678
```

### **☁️ Opção 2: N8N Cloud**
1. Vá em https://n8n.cloud
2. Crie uma conta
3. Crie um novo workflow

### **📋 Importar Workflow:**
1. No N8N, vá em "Workflows"
2. Clique em "Import from file"
3. Selecione `n8n-workflow.json`
4. Configure as credenciais necessárias

### **🔧 Configurar Webhook:**
1. No workflow, clique no nó "Webhook Vivassit"
2. Copie a URL do webhook gerada
3. Adicione no seu `.env`:
```bash
N8N_WEBHOOK_URL=https://sua-instancia-n8n.com/webhook/vivassit-onboarding
```

---

## **5. INTEGRAÇÃO COMPLETA**

### **🔄 Fluxo completo:**
```
Frontend → API Vivassit → N8N Webhook → Singular/NBN → Email
```

### **🎛️ Configurar variáveis no N8N:**
- **Singular API**: Configurar credenciais da API Singular
- **NBN API**: Configurar credenciais da API NBN  
- **SMTP**: Configurar servidor de email

### **🧪 Teste end-to-end:**
1. Preencha o onboarding completo
2. Verifique logs do Next.js
3. Verifique execução no N8N
4. Confirme criação no Singular/NBN
5. Verifique recebimento do email

---

## **6. MONITORAMENTO E LOGS**

### **📊 Logs do Next.js:**
```bash
# No terminal onde roda yarn dev, observe:
✅ Dados enviados com sucesso para webhook: clinica-teste-a1b2c3d4
```

### **📈 Logs do N8N:**
- Acesse a aba "Executions" no N8N
- Verifique execuções bem-sucedidas
- Analise dados de entrada e saída

### **🔍 Debug no navegador:**
1. F12 → Console
2. Network → Verifique chamadas API
3. Application → LocalStorage (se houver)

### **📧 Verificar emails:**
- Confirme recebimento do email de boas-vindas
- Verifique se dados estão corretos

---

## **7. RESOLUÇÃO DE PROBLEMAS**

### **❌ Erro: "Webhook call failed"**
**Solução:**
- Verifique se N8N está rodando
- Confirme URL do webhook no .env
- Teste webhook diretamente

### **❌ Erro: "Campos obrigatórios ausentes"**
**Solução:**
- Verifique se todos os campos estão preenchidos
- Confirme validação no frontend
- Teste com dados mínimos

### **❌ Erro: "TypeScript compilation failed"**
**Solução:**
```bash
cd app
yarn tsc --noEmit
# Verifique erros e corrija
```

### **❌ Erro: "CORS blocked"**
**Solução:**
- Adicione headers CORS apropriados
- Verifique configuração do N8N

### **📞 Teste de conectividade:**
```bash
# Testar conexão com N8N
curl -X POST https://sua-url-n8n/webhook/vivassit-onboarding \
  -H 'Content-Type: application/json' \
  -d '{"test": "connection"}'
```

---

## **🎯 CHECKLIST DE VALIDAÇÃO**

### **✅ Frontend:**
- [ ] Landing page carrega sem erro
- [ ] Onboarding funciona completamente
- [ ] Validação de campos funciona
- [ ] Mensagem de sucesso aparece
- [ ] Tenant_id é exibido

### **✅ Backend API:**
- [ ] POST /api/onboarding responde 200
- [ ] Tenant_id é gerado corretamente
- [ ] Payload contém todos os campos
- [ ] Validação rejeita dados incompletos
- [ ] Webhook é chamado com sucesso

### **✅ N8N Integration:**
- [ ] Workflow está ativo
- [ ] Webhook recebe dados
- [ ] Dados são processados corretamente
- [ ] APIs Singular/NBN são chamadas
- [ ] Email de boas-vindas é enviado

### **✅ End-to-end:**
- [ ] Fluxo completo funciona
- [ ] Dados chegam nos sistemas finais
- [ ] Usuário recebe confirmação
- [ ] Logs estão funcionando
- [ ] Monitoramento está ativo

---

## **🚀 COMANDOS RÁPIDOS**

### **Iniciar tudo:**
```bash
# Terminal 1: Next.js
cd app && yarn dev

# Terminal 2: N8N (se local)
n8n start

# Terminal 3: Testes
node test-api.js
```

### **URLs importantes:**
- **App**: http://localhost:3000
- **N8N**: http://localhost:5678
- **API**: http://localhost:3000/api/onboarding
- **Teste**: file://$(pwd)/test-webhook.html

---

## **📞 SUPORTE**

Se encontrar problemas:
1. ✅ Verifique este guia primeiro
2. 🔍 Analise os logs detalhadamente
3. 🧪 Teste cada componente isoladamente
4. 📧 Entre em contato: suporte@vivassit.com.br

**🎉 Sucesso! Sua integração Vivassit + N8N está funcionando!**
