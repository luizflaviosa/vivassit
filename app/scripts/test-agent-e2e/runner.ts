#!/usr/bin/env tsx
// Orchestrator da suite E2E.
// Uso:
//   tsx app/scripts/test-agent-e2e/runner.ts           # roda todos
//   tsx app/scripts/test-agent-e2e/runner.ts C15        # roda um cenário
//   tsx app/scripts/test-agent-e2e/runner.ts --grep falha-tools # roda categoria

import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { sendWebhook } from './lib/webhook-client.js';
import { waitForAgentResponse } from './lib/response-watcher.js';
import { cleanupScenario } from './lib/cleanup.js';
import { evaluateAssertion } from './lib/assertions.js';
import { createScenarioContext } from './lib/fixtures.js';
import { setupChatwootForScenario } from './lib/chatwoot.js';
import { config } from './config.js';

import { scenarios as novoPaciente } from './scenarios/01-novo-paciente.js';
import { scenarios as conhecido } from './scenarios/02-conhecido.js';
import { scenarios as anexos } from './scenarios/03-anexos.js';
import { scenarios as falhaTools } from './scenarios/04-falha-tools.js';
import { scenarios as adversarial } from './scenarios/05-adversarial.js';
import { scenarios as concorrencia } from './scenarios/06-concorrencia.js';
import { scenarios as fluxosNegocio } from './scenarios/07-fluxos-negocio.js';
import { scenarios as tiposMensagem } from './scenarios/08-tipos-mensagem.js';

import type { Scenario, ScenarioResult } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ALL_SCENARIOS: Scenario[] = [
  ...novoPaciente,
  ...conhecido,
  ...anexos,
  ...falhaTools,
  ...adversarial,
  ...concorrencia,
  ...fluxosNegocio,
  ...tiposMensagem,
];

async function runScenario(s: Scenario): Promise<ScenarioResult> {
  const ctx = createScenarioContext(s.id, s.category);
  const start = Date.now();
  const turnsResults: ScenarioResult['turns'] = [];
  const agentResponses: string[] = [];

  try {
    if (s.skip) {
      return {
        id: s.id,
        category: s.category,
        title: s.title,
        passed: true,
        durationMs: 0,
        turns: [],
        assertions: [{ assertion: { kind: 'response_not_empty' }, passed: true, reason: `SKIPPED — ${s.skipReason || 'sem motivo'}` }],
      };
    }

    // Cria contact + conversation real no Chatwoot pra cenário funcionar end-to-end
    // (A05 aplica label de verdade, "Enviar texto" responde 200, etc).
    try {
      const cw = await setupChatwootForScenario(ctx.patientPhone, ctx.patientName || `E2E ${s.id}`);
      ctx.conversationId = cw.conversationId;
      ctx.chatwootContactId = cw.contactId;
      ctx.sessionId = `${config.tenant.id}_${ctx.patientPhone}`;
    } catch (err: any) {
      console.log(`    WARN: setup Chatwoot falhou (${err?.message?.slice(0, 100)}). Continuando com conv fake.`);
    }

    if (s.setup) await s.setup(ctx);

    for (let i = 0; i < s.turns.length; i++) {
      const turn = s.turns[i];
      // Delay entre turns (evita cache do P01 com mensagens muito rápidas).
      if (i > 0 && config.betweenTurnsMs > 0) {
        await new Promise(r => setTimeout(r, config.betweenTurnsMs));
      }
      const turnStart = Date.now();
      const before = new Date();
      await sendWebhook(ctx, turn);
      const response = await waitForAgentResponse(ctx, before);

      turnsResults.push({
        patient: turn.patient || turn.reaction || null,
        agentResponse: response?.content || null,
        elapsedMs: Date.now() - turnStart,
      });

      if (!response) {
        // Sem resposta — registra mas continua pra o assertion poder marcar
        agentResponses.push('');
      } else {
        agentResponses.push(response.content);
      }
    }

    const assertionResults = await Promise.all(
      s.assertions.map(a => evaluateAssertion(ctx, a, agentResponses)),
    );
    const passed = assertionResults.every(r => r.passed);

    return {
      id: s.id,
      category: s.category,
      title: s.title,
      passed,
      durationMs: Date.now() - start,
      turns: turnsResults,
      assertions: assertionResults,
    };
  } catch (err: any) {
    return {
      id: s.id,
      category: s.category,
      title: s.title,
      passed: false,
      durationMs: Date.now() - start,
      turns: turnsResults,
      assertions: [],
      error: err?.message || String(err),
    };
  } finally {
    await cleanupScenario(ctx).catch(() => {});
  }
}

function filterScenarios(args: string[]): Scenario[] {
  if (args.length === 0) return ALL_SCENARIOS;

  const grepIndex = args.indexOf('--grep');
  if (grepIndex >= 0 && args[grepIndex + 1]) {
    const term = args[grepIndex + 1].toLowerCase();
    return ALL_SCENARIOS.filter(s =>
      s.category.toLowerCase().includes(term) ||
      s.id.toLowerCase().includes(term) ||
      s.title.toLowerCase().includes(term),
    );
  }

  const ids = args.filter(a => /^C\d+$/i.test(a)).map(a => a.toUpperCase());
  if (ids.length > 0) return ALL_SCENARIOS.filter(s => ids.includes(s.id));

  return ALL_SCENARIOS;
}

function fmtDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

async function writeReport(results: ScenarioResult[]): Promise<string> {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const reportDir = join(__dirname, '../../../docs/agent-test-matrix-history');
  await mkdir(reportDir, { recursive: true });
  const reportPath = join(reportDir, `${ts}.md`);

  const lines: string[] = [];
  lines.push(`# Rodada E2E — ${new Date().toISOString()}`);
  lines.push('');
  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  lines.push(`**${passed}/${results.length} cenários PASS** (${failed} FAIL)`);
  lines.push('');

  for (const r of results) {
    const icon = r.passed ? 'PASS' : 'FAIL';
    lines.push(`## ${r.id} — ${r.title} [${icon}] (${fmtDuration(r.durationMs)})`);
    lines.push(`Categoria: ${r.category}`);
    lines.push('');
    if (r.error) {
      lines.push(`**Erro:** ${r.error}`);
      lines.push('');
    }
    lines.push('### Turnos');
    for (const t of r.turns) {
      lines.push(`- Paciente: \`${t.patient || '(sem msg)'}\``);
      lines.push(`  Agente (${fmtDuration(t.elapsedMs)}): ${t.agentResponse ? t.agentResponse.slice(0, 400) : '*(sem resposta — TIMEOUT)*'}`);
    }
    if (r.assertions.length > 0) {
      lines.push('');
      lines.push('### Assertions');
      for (const a of r.assertions) {
        const tag = a.passed ? 'PASS' : 'FAIL';
        lines.push(`- [${tag}] \`${a.assertion.kind}\`${a.reason ? ` — ${a.reason}` : ''}`);
      }
    }
    lines.push('');
  }

  await writeFile(reportPath, lines.join('\n'), 'utf-8');
  return reportPath;
}

async function runOnce(targets: Scenario[]): Promise<ScenarioResult[]> {
  const results: ScenarioResult[] = [];
  for (const s of targets) {
    process.stdout.write(`  ${s.id} ${s.title} ... `);
    const r = await runScenario(s);
    results.push(r);
    console.log(`${r.passed ? 'PASS' : 'FAIL'} (${fmtDuration(r.durationMs)})`);
    if (!r.passed) {
      for (const a of r.assertions.filter(x => !x.passed)) {
        console.log(`    FAIL assertion: ${a.assertion.kind} — ${a.reason || ''}`);
      }
      if (r.error) console.log(`    ERRO: ${r.error}`);
    }
  }
  return results;
}

async function writeFlakinessReport(allRuns: ScenarioResult[][], outDir: string): Promise<string> {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const path = join(outDir, `flakiness-${ts}.md`);

  const byId: Record<string, { id: string; category: string; title: string; runs: { passed: boolean; reasons: string[] }[] }> = {};
  for (const run of allRuns) {
    for (const r of run) {
      if (!byId[r.id]) {
        byId[r.id] = { id: r.id, category: r.category, title: r.title, runs: [] };
      }
      const reasons = r.assertions.filter(a => !a.passed).map(a => `${a.assertion.kind}: ${a.reason || ''}`);
      if (r.error) reasons.push(`ERROR: ${r.error}`);
      byId[r.id].runs.push({ passed: r.passed, reasons });
    }
  }

  const lines: string[] = [];
  lines.push(`# Flakiness E2E — ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`Rodadas: ${allRuns.length}`);
  lines.push(`Cenários distintos: ${Object.keys(byId).length}`);
  lines.push('');
  lines.push('| ID | Categoria | Título | Pass Rate | Motivos de falha |');
  lines.push('|---|---|---|---:|---|');

  const sorted = Object.values(byId).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  for (const s of sorted) {
    const passes = s.runs.filter(r => r.passed).length;
    const rate = `${passes}/${s.runs.length}`;
    const allReasons = [...new Set(s.runs.flatMap(r => r.reasons))].slice(0, 3).join(' / ').replace(/\|/g, '\\|');
    lines.push(`| ${s.id} | ${s.category} | ${s.title.slice(0, 60)} | ${rate} | ${allReasons || '—'} |`);
  }

  lines.push('');
  lines.push('## Resumo por rodada');
  for (let i = 0; i < allRuns.length; i++) {
    const passed = allRuns[i].filter(r => r.passed).length;
    lines.push(`- Rodada ${i + 1}: ${passed}/${allRuns[i].length} PASS`);
  }

  await writeFile(path, lines.join('\n'), 'utf-8');
  return path;
}

async function main() {
  const args = process.argv.slice(2);

  // Parse --repeat N
  const repeatIdx = args.indexOf('--repeat');
  let repeat = 1;
  if (repeatIdx >= 0 && args[repeatIdx + 1]) {
    repeat = Math.max(1, parseInt(args[repeatIdx + 1], 10) || 1);
    args.splice(repeatIdx, 2);
  }

  const targets = filterScenarios(args);

  if (targets.length === 0) {
    console.error('Nenhum cenário casou com o filtro.');
    process.exit(1);
  }

  console.log(`Rodando ${targets.length} cenário(s)${repeat > 1 ? ` × ${repeat} rodadas` : ''}...\n`);
  const allRuns: ScenarioResult[][] = [];

  for (let run = 1; run <= repeat; run++) {
    if (repeat > 1) console.log(`\n=== Rodada ${run}/${repeat} ===\n`);
    const results = await runOnce(targets);
    allRuns.push(results);
    const passed = results.filter(r => r.passed).length;
    console.log(`Rodada ${run}: ${passed}/${results.length} PASS`);
    await writeReport(results);
  }

  const reportDir = join(__dirname, '../../../docs/agent-test-matrix-history');
  if (repeat > 1) {
    const flakPath = await writeFlakinessReport(allRuns, reportDir);
    console.log(`\nRelatório de flakiness: ${flakPath}`);
  }

  const lastRun = allRuns[allRuns.length - 1];
  const lastPassed = lastRun.filter(r => r.passed).length;
  process.exit(lastPassed === lastRun.length ? 0 : 1);
}

main().catch(err => {
  console.error('Erro fatal no runner:', err);
  process.exit(2);
});
