#!/usr/bin/env node
/**
 * Cria os 2 workflows do modulo RPM/Seguimento no N8N via API REST.
 * Uso: N8N_API_KEY=<key> node scripts/create-rpm-workflows.mjs
 *
 * Nao commitar com credenciais. A key vem apenas via env var.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const API_URL = process.env.N8N_API_URL || 'https://n8n.singulare.org';
const API_KEY = process.env.N8N_API_KEY;

if (!API_KEY) {
  console.error('ERRO: N8N_API_KEY nao definida. Use: N8N_API_KEY=xxx node scripts/create-rpm-workflows.mjs');
  process.exit(1);
}

const WORKFLOWS_DIR = join(__dirname, '../n8n/workflows');

const drafts = [
  'draft-p04-seguimento-dispatch-semanal-v1-0.json',
  'draft-alert-dispatch-seguimento-v1-0.json',
];

async function createWorkflow(filePath) {
  const payload = JSON.parse(readFileSync(filePath, 'utf-8'));

  // N8N API: campos read-only no POST de criacao. Remove antes de enviar.
  // Workflow nasce inativo por default; ativar via PATCH /activate manual.
  delete payload.active;
  delete payload.id;
  delete payload.versionId;
  delete payload.tags;
  delete payload.pinData;
  delete payload.meta;

  const res = await fetch(`${API_URL}/api/v1/workflows`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': API_KEY,
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json();

  if (!res.ok) {
    console.error(`ERRO ao criar "${payload.name}":`, JSON.stringify(body, null, 2));
    return null;
  }

  console.log(`CRIADO: "${body.name}" — ID: ${body.id}`);
  console.log(`  URL: ${API_URL}/workflow/${body.id}`);
  return body;
}

async function main() {
  console.log(`N8N: ${API_URL}`);
  console.log('Criando workflows RPM/Seguimento...\n');

  const results = [];
  for (const draft of drafts) {
    const filePath = join(WORKFLOWS_DIR, draft);
    const result = await createWorkflow(filePath);
    if (result) results.push(result);
  }

  console.log(`\n${results.length}/${drafts.length} workflows criados com sucesso.`);

  if (results.length > 0) {
    console.log('\nProximos passos:');
    console.log('  1. Inspecionar cada workflow na UI do N8N');
    console.log('  2. Confirmar credenciais (Postgres account + Evolution account)');
    console.log('  3. Fazer smoke test manual (executar com "Test workflow")');
    console.log('  4. Ativar via toggle ou: PATCH /api/v1/workflows/<id>/activate');
  }
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
