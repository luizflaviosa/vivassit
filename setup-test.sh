
#!/bin/bash

# Script de configuração para testes Vivassit + N8N
echo "🧪 CONFIGURAÇÃO DE TESTES VIVASSIT + N8N"
echo "======================================="
echo

# Verificar se o projeto está rodando
echo "1️⃣ Iniciando servidor de desenvolvimento..."
cd app
yarn dev &
DEV_PID=$!
echo "   ✅ Servidor iniciado (PID: $DEV_PID)"
sleep 3

echo
echo "2️⃣ Testando se a aplicação está rodando..."
if curl -s http://localhost:3000 > /dev/null; then
    echo "   ✅ Aplicação rodando em http://localhost:3000"
else
    echo "   ❌ Erro: Aplicação não está respondendo"
    exit 1
fi

echo
echo "3️⃣ URLs de teste disponíveis:"
echo "   🌐 Landing Page: http://localhost:3000/landing"
echo "   📝 Onboarding: http://localhost:3000/onboarding" 
echo "   🧪 Teste Webhook: file://$(pwd)/../test-webhook.html"
echo "   🔧 API Endpoint: http://localhost:3000/api/onboarding"

echo
echo "4️⃣ Executar testes:"
echo "   🚀 Para testar a API diretamente:"
echo "      node ../test-api.js"
echo
echo "   🌐 Para testar via navegador:"
echo "      Abra: file://$(pwd)/../test-webhook.html"
echo
echo "   📞 Para testar com curl:"
echo '      curl -X POST http://localhost:3000/api/onboarding \'
echo '        -H "Content-Type: application/json" \'
echo '        -d "{\"real_phone\":\"+5511999999999\",\"clinic_name\":\"Teste\",\"admin_email\":\"teste@teste.com\",\"doctor_name\":\"Dr Teste\",\"doctor_crm\":\"123456\",\"speciality\":\"cardiologia\",\"consultation_duration\":\"30\",\"establishment_type\":\"small_clinic\",\"plan_type\":\"professional\"}"'

echo
echo "5️⃣ Configuração N8N:"
echo "   📋 Importe o workflow: n8n-workflow.json"
echo "   🔗 Configure a URL do webhook no .env:"
echo "      N8N_WEBHOOK_URL=https://sua-instancia-n8n.com/webhook/vivassit-onboarding"

echo
echo "✅ SETUP COMPLETO! Pressione CTRL+C para parar o servidor"
echo

# Esperar pelo usuário
wait $DEV_PID
