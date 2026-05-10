#!/usr/bin/env node
/**
 * n8n-sync.mjs — sincroniza workflows N8N ↔ git em n8n/workflows/<id>-<slug>.json.
 * Comandos: pull | push <id> | diff <id> | list
 * Mutativo (push) requer --apply; default é dry-run mostrando diff.
 * Strip de campos efêmeros (createdAt, updatedAt, versionId, meta.lastExecutionId).
 */

const fs = await import("node:fs/promises");
const path = await import("node:path");

const N8N_BASE = process.env.N8N_BASE_URL || "https://n8n.singulare.org";
const N8N_KEY = process.env.N8N_API_KEY;

if (!N8N_KEY) {
  console.error("ERRO: env var N8N_API_KEY ausente. Defina em .env.local.");
  process.exit(1);
}

const argv = process.argv.slice(2);
const cmd = argv[0];
const apply = argv.includes("--apply");

const REPO_ROOT = path.resolve(new URL("../..", import.meta.url).pathname);
const WORKFLOW_DIR = path.join(REPO_ROOT, "n8n", "workflows");

const EPHEMERAL_KEYS = ["createdAt", "updatedAt", "versionId"];

function slugify(name) {
  return String(name || "workflow")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

function stripEphemeral(wf) {
  const clone = JSON.parse(JSON.stringify(wf));
  for (const k of EPHEMERAL_KEYS) delete clone[k];
  if (clone.meta && typeof clone.meta === "object") {
    delete clone.meta.lastExecutionId;
  }
  return clone;
}

async function n8nFetch(p, init = {}) {
  const url = `${N8N_BASE}${p}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "X-N8N-API-KEY": N8N_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`N8N ${init.method || "GET"} ${p} → ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

async function listWorkflows() {
  const data = await n8nFetch("/api/v1/workflows?limit=250");
  return data.data || data;
}

async function getWorkflow(id) {
  const data = await n8nFetch(`/api/v1/workflows/${id}`);
  return data.data || data;
}

async function ensureDir(d) {
  await fs.mkdir(d, { recursive: true });
}

async function readLocal(id) {
  await ensureDir(WORKFLOW_DIR);
  const files = await fs.readdir(WORKFLOW_DIR);
  const match = files.find((f) => f.startsWith(`${id}-`) && f.endsWith(".json"));
  if (!match) return null;
  const content = await fs.readFile(path.join(WORKFLOW_DIR, match), "utf8");
  return { file: match, content: JSON.parse(content) };
}

function diffJson(a, b) {
  const sa = JSON.stringify(a, Object.keys(a || {}).sort(), 2);
  const sb = JSON.stringify(b, Object.keys(b || {}).sort(), 2);
  if (sa === sb) return null;
  // Diff resumido por contagem de linhas
  const linesA = sa.split("\n");
  const linesB = sb.split("\n");
  return { localLines: linesA.length, remoteLines: linesB.length, equal: false };
}

async function cmdList() {
  const wfs = await listWorkflows();
  console.log(`Total workflows: ${wfs.length}`);
  for (const wf of wfs) {
    const tag = wf.active ? "ACTIVE" : "inactive";
    console.log(`  [${tag}] ${wf.id}  ${wf.name}`);
  }
}

async function cmdPull() {
  await ensureDir(WORKFLOW_DIR);
  const wfs = await listWorkflows();
  let written = 0;
  for (const stub of wfs) {
    const full = await getWorkflow(stub.id);
    const stripped = stripEphemeral(full);
    const slug = slugify(full.name);
    const filename = `${full.id}-${slug}.json`;
    const target = path.join(WORKFLOW_DIR, filename);
    // remove stale dup com mesmo id mas slug diferente
    const existing = await fs.readdir(WORKFLOW_DIR);
    for (const f of existing) {
      if (f.startsWith(`${full.id}-`) && f !== filename) {
        await fs.unlink(path.join(WORKFLOW_DIR, f));
      }
    }
    const json = JSON.stringify(stripped, null, 2) + "\n";
    let prev = null;
    try {
      prev = await fs.readFile(target, "utf8");
    } catch {}
    if (prev !== json) {
      await fs.writeFile(target, json, "utf8");
      console.log(`  wrote ${filename}`);
      written++;
    }
  }
  console.log(`Pull concluído. ${written} arquivos atualizados de ${wfs.length}.`);
}

async function cmdDiff(id) {
  if (!id) {
    console.error("uso: diff <workflow_id>");
    process.exit(1);
  }
  const remote = stripEphemeral(await getWorkflow(id));
  const local = await readLocal(id);
  if (!local) {
    console.log(`Local: ausente. Remoto: ${remote.name} (${id}).`);
    return;
  }
  const d = diffJson(local.content, remote);
  if (!d) console.log(`Sem diferenças entre local (${local.file}) e remoto.`);
  else console.log(`DIFF: local=${d.localLines} linhas, remoto=${d.remoteLines} linhas.`);
}

async function cmdPush(id) {
  if (!id) {
    console.error("uso: push <workflow_id> [--apply]");
    process.exit(1);
  }
  const local = await readLocal(id);
  if (!local) {
    console.error(`Arquivo local pra workflow ${id} não encontrado em ${WORKFLOW_DIR}.`);
    process.exit(1);
  }
  const remote = stripEphemeral(await getWorkflow(id));
  const d = diffJson(local.content, remote);
  if (!d) {
    console.log("Local == remoto. Nada a fazer.");
    return;
  }
  console.log(`DIFF detectado: local=${d.localLines}L, remoto=${d.remoteLines}L.`);
  if (!apply) {
    console.log("[dry-run] use --apply para enviar PUT pro N8N.");
    return;
  }
  // monta payload mantendo apenas campos aceitos pelo PUT
  const payload = { ...local.content };
  for (const k of EPHEMERAL_KEYS) delete payload[k];
  delete payload.id;
  delete payload.active; // active é controlado por endpoint separado
  await n8nFetch(`/api/v1/workflows/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  console.log(`PUT /api/v1/workflows/${id} ok.`);
}

try {
  switch (cmd) {
    case "list":
      await cmdList();
      break;
    case "pull":
      await cmdPull();
      break;
    case "diff":
      await cmdDiff(argv[1]);
      break;
    case "push":
      await cmdPush(argv[1]);
      break;
    default:
      console.error("uso: n8n-sync.mjs <list|pull|diff <id>|push <id> [--apply]>");
      process.exit(1);
  }
} catch (err) {
  console.error("ERRO:", err.message || err);
  process.exit(1);
}
