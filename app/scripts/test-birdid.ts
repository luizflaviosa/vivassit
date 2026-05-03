#!/usr/bin/env tsx
// scripts/test-birdid.ts
//
// Quick smoke test for BirdID sandbox integration.
// Usage: DOTENV_CONFIG_PATH=.env.local npx tsx scripts/test-birdid.ts
//
// Tests:
//  1. OAuth2 client_credentials → get access token
//  2. Check token info
//  3. (Optional) Start a signing session with a dummy PDF if --sign flag

import 'dotenv/config';

const API_URL = process.env.BIRDID_API_URL || 'https://apihom.birdid.com.br';
const CESS_URL = process.env.BIRDID_CESS_URL || 'https://cesshom.vaultid.com.br';
const CLIENT_ID = process.env.BIRDID_CLIENT_ID || '';
const CLIENT_SECRET = process.env.BIRDID_CLIENT_SECRET || '';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  BirdID Sandbox Integration Test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();
  console.log(`API URL:  ${API_URL}`);
  console.log(`CESS URL: ${CESS_URL}`);
  console.log(`Client ID: ${CLIENT_ID ? CLIENT_ID.slice(0, 8) + '...' : '❌ MISSING'}`);
  console.log(`Client Secret: ${CLIENT_SECRET ? '***' + CLIENT_SECRET.slice(-4) : '❌ MISSING'}`);
  console.log();

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('❌ BIRDID_CLIENT_ID e BIRDID_CLIENT_SECRET são obrigatórios.');
    console.error('   Adicione em .env.local e tente novamente.');
    process.exit(1);
  }

  // ── Step 1: OAuth2 Token ──
  console.log('1️⃣  Obtendo token OAuth2 (client_credentials)...');
  let token: string;
  try {
    const res = await fetch(`${API_URL}/v0/oauth/client_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
    });
    const text = await res.text();
    console.log(`   Status: ${res.status}`);

    if (!res.ok) {
      console.error(`   ❌ Falhou: ${text}`);
      // Try alternate endpoint format
      console.log('\n   Tentando formato alternativo de autenticação...');
      const res2 = await fetch(`${API_URL}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
        }),
      });
      const text2 = await res2.text();
      console.log(`   Status alternativo: ${res2.status}`);
      if (!res2.ok) {
        console.error(`   ❌ Também falhou: ${text2}`);

        // Try yet another format (Basic auth)
        console.log('\n   Tentando Basic Auth...');
        const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
        const res3 = await fetch(`${API_URL}/oauth/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${basic}`,
          },
          body: 'grant_type=client_credentials',
        });
        const text3 = await res3.text();
        console.log(`   Status Basic: ${res3.status}`);
        if (!res3.ok) {
          console.error(`   ❌ Todas as tentativas falharam: ${text3}`);
          process.exit(1);
        }
        const data3 = JSON.parse(text3);
        token = data3.access_token;
        console.log(`   ✅ Token obtido via Basic Auth! Expira em ${data3.expires_in}s`);
      } else {
        const data2 = JSON.parse(text2);
        token = data2.access_token;
        console.log(`   ✅ Token obtido via formato alternativo! Expira em ${data2.expires_in}s`);
      }
    } else {
      const data = JSON.parse(text);
      token = data.access_token;
      console.log(`   ✅ Token obtido! Expira em ${data.expires_in}s`);
    }
  } catch (e) {
    console.error(`   ❌ Erro de rede: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }

  console.log(`   Token: ${token!.slice(0, 20)}...`);

  // ── Step 2: Test CESS endpoint ──
  console.log('\n2️⃣  Testando conexão com CESS (VaultID)...');
  try {
    // Try to list certificates or hit a health endpoint
    const cessRes = await fetch(`${CESS_URL}/signature-service`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token!}`,
        'Accept': 'application/json',
      },
    });
    console.log(`   Status CESS: ${cessRes.status}`);
    if (cessRes.ok) {
      const cessData = await cessRes.text();
      console.log(`   ✅ CESS respondeu OK. Body (truncado): ${cessData.slice(0, 200)}`);
    } else {
      const errText = await cessRes.text();
      console.log(`   ⚠️  CESS status ${cessRes.status}: ${errText.slice(0, 200)}`);
      console.log('   (Isso pode ser normal — GET no /signature-service pode não ser um endpoint válido)');
    }
  } catch (e) {
    console.error(`   ❌ Erro de rede CESS: ${e instanceof Error ? e.message : e}`);
  }

  // ── Step 3: (optional) Create signing session with dummy PDF ──
  if (process.argv.includes('--sign')) {
    console.log('\n3️⃣  Criando sessão de assinatura de teste...');
    const testCpf = process.argv[process.argv.indexOf('--sign') + 1];
    if (!testCpf || testCpf.startsWith('-')) {
      console.error('   ❌ Passe o CPF após --sign: npx tsx scripts/test-birdid.ts --sign 12345678900');
      process.exit(1);
    }

    try {
      const callbackUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://singulare.org') + '/api/webhooks/birdid?doc_id=test-0';
      console.log(`   CPF: ${testCpf}`);
      console.log(`   Callback: ${callbackUrl}`);

      const sessionRes = await fetch(`${CESS_URL}/signature-service`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token!}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          certificate_alias: testCpf,
          type: 'PDFSignature',
          hash_algorithm: 'SHA256',
          auto_fix_document: true,
          notification_callback: callbackUrl,
          signature_settings: [{
            id: 'default',
            reason: 'Teste de integração BirdID sandbox',
            location: 'São Paulo, SP',
            visible_signature: true,
            visible_sign_x: 48,
            visible_sign_y: 48,
            visible_sign_width: 260,
            visible_sign_height: 60,
            visible_sign_page: -1,
          }],
          documents_source: 'UPLOAD_REFERENCE',
        }),
      });

      const sessionText = await sessionRes.text();
      console.log(`   Status: ${sessionRes.status}`);
      if (sessionRes.ok) {
        const session = JSON.parse(sessionText);
        console.log(`   ✅ Sessão criada! TCN: ${session.tcn}`);
        console.log(`   Response: ${JSON.stringify(session, null, 2).slice(0, 500)}`);

        // Upload a tiny dummy PDF
        console.log('\n   Fazendo upload de PDF de teste...');
        // Minimal valid PDF
        const pdfContent = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n206\n%%EOF';
        const blob = new Blob([pdfContent], { type: 'application/pdf' });
        const fd = new FormData();
        fd.append('file', blob, 'test.pdf');

        const uploadRes = await fetch(`${CESS_URL}/file-transfer/${session.tcn}/eot/default`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token!}`,
            'Accept': 'application/json',
          },
          body: fd,
        });
        const uploadText = await uploadRes.text();
        console.log(`   Upload status: ${uploadRes.status}`);
        console.log(`   Upload response: ${uploadText.slice(0, 300)}`);

        if (uploadRes.ok) {
          console.log('\n   ✅ PDF enviado! O médico agora deve receber notificação no app BirdID.');
          console.log(`   TCN para acompanhar: ${session.tcn}`);
        }
      } else {
        console.error(`   ❌ Falhou: ${sessionText.slice(0, 500)}`);
      }
    } catch (e) {
      console.error(`   ❌ Erro: ${e instanceof Error ? e.message : e}`);
    }
  } else {
    console.log('\n💡 Para testar assinatura completa, rode:');
    console.log('   DOTENV_CONFIG_PATH=.env.local npx tsx scripts/test-birdid.ts --sign SEU_CPF');
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Teste concluído');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
