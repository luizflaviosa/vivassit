#!/usr/bin/env node
/**
 * drift-check.mjs — relatório read-only de divergências.
 * Compara: Vercel env vars vs docs/INTEGRATIONS.md, Supabase tables vs migrations,
 * N8N workflows ativos vs n8n/workflows/*.json. Não muda nada.
 * Uso: --report (default).
 */

const fs = await import("node:fs/promises");
const path = await import("node:path");
const { execFileSync } = await import("node:child_process");

const REPO_ROOT = path.resolve(new URL("../..", import.meta.url).pathname);
const SCOPE = process.env.VERCEL_SCOPE || "team_bt7LVA71g3zN0Brw0PV1jHk7";
const N8N_BASE = process.env.N8N_BASE_URL || "https://n8n.singulare.org";
const N8N_KEY = process.env.N8N_API_KEY;

const isTTY = process.stdout.isTTY;
const c = {
  red: (s) => (isTTY ? `\x1b[31m${s}\x1b[0m` : s),
  green: (s) => (isTTY ? `\x1b[32m${s}\x1b[0m` : s),
  yellow: (s) => (isTTY ? `\x1b[33m${s}\x1b[0m` : s),
  bold: (s) => (isTTY ? `\x1b[1m${s}\x1b[0m` : s),
};

function header(t) {
  console.log("\n" + c.bold(`=== ${t} ===`));
}

// ---------- Vercel ENV vs INTEGRATIONS.md ----------
function parseVercelEnvLs(out) {
  const names = new Set();
  for (const line of out.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    if (/^(name\s|Vercel CLI|>|Environment Variables)/i.test(t)) continue;
    const first = t.split(/\s+/)[0];
    if (/^[A-Z][A-Z0-9_]*$/.test(first)) names.add(first);
  }
  return [...names].sort();
}

async function readDocumentedEnvVars() {
  const docPath = path.join(REPO_ROOT, "docs", "INTEGRATIONS.md");
  let content;
  try {
    content = await fs.readFile(docPath, "utf8");
  } catch {
    return null;
  }
  // pega tokens UPPER_SNAKE_CASE (>= 4 chars, com underscore) — heurística simples
  const names = new Set();
  const re = /\b([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\b/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    if (m[1].length >= 4) names.add(m[1]);
  }
  return [...names].sort();
}

async function checkVercelDrift() {
  header("Vercel ENV drift");
  let remote = [];
  try {
    const out = execFileSync("vercel", ["--scope", SCOPE, "env", "ls", "production"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    remote = parseVercelEnvLs(out);
  } catch {
    console.log(c.yellow("  ⚠ Vercel CLI indisponível ou não autenticado. Pulando."));
    return;
  }
  const documented = await readDocumentedEnvVars();
  if (documented === null) {
    console.log(c.yellow("  ⚠ docs/INTEGRATIONS.md não encontrado. Pulando comparação."));
    return;
  }
  const docSet = new Set(documented);
  const remoteSet = new Set(remote);
  const inVercelNotDoc = remote.filter((n) => !docSet.has(n));
  const docNotInVercel = documented.filter((n) => !remoteSet.has(n));
  if (inVercelNotDoc.length === 0 && docNotInVercel.length === 0) {
    console.log(c.green("  ✓ sem drift."));
    return;
  }
  for (const n of inVercelNotDoc) console.log(c.yellow(`  + ${n} (no Vercel, não documentado)`));
  for (const n of docNotInVercel) console.log(c.red(`  - ${n} (em INTEGRATIONS.md, não no Vercel)`));
}

// ---------- Supabase schema vs migrations ----------
async function readMigrationFiles() {
  const dir = path.join(REPO_ROOT, "supabase", "migrations");
  try {
    const files = await fs.readdir(dir);
    return files.filter((f) => f.endsWith(".sql"));
  } catch {
    return [];
  }
}

async function readMigrationContent() {
  const dir = path.join(REPO_ROOT, "supabase", "migrations");
  const files = await readMigrationFiles();
  let combined = "";
  for (const f of files) {
    try {
      combined += "\n" + (await fs.readFile(path.join(dir, f), "utf8"));
    } catch {}
  }
  return combined;
}

async function checkSupabaseDrift() {
  header("Supabase schema drift");
  const migrationsContent = await readMigrationContent();
  if (!migrationsContent) {
    console.log(c.yellow("  ⚠ supabase/migrations/ vazio ou inexistente. Pulando."));
    return;
  }
  // Tabelas mencionadas em CREATE TABLE
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?["']?([a-z_][a-z0-9_]*)["']?/gi;
  const inMigrations = new Set();
  let m;
  while ((m = re.exec(migrationsContent)) !== null) inMigrations.add(m[1]);

  // Tabelas vivas: tenta supabase CLI; se não existir, avisa.
  let liveTables = null;
  try {
    const out = execFileSync(
      "supabase",
      ["db", "dump", "--schema", "public", "--data-only=false"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    const set = new Set();
    let mm;
    const rr = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?["']?([a-z_][a-z0-9_]*)["']?/gi;
    while ((mm = rr.exec(out)) !== null) set.add(mm[1]);
    liveTables = [...set];
  } catch {
    console.log(
      c.yellow(
        "  ⚠ supabase CLI indisponível. Não foi possível listar tabelas vivas — comparação parcial.",
      ),
    );
    console.log(`  Tabelas em migrations: ${inMigrations.size}`);
    return;
  }
  const liveSet = new Set(liveTables);
  const liveNotMigrated = liveTables.filter((t) => !inMigrations.has(t));
  const migratedNotLive = [...inMigrations].filter((t) => !liveSet.has(t));
  if (liveNotMigrated.length === 0 && migratedNotLive.length === 0) {
    console.log(c.green("  ✓ sem drift."));
    return;
  }
  for (const t of liveNotMigrated) console.log(c.red(`  + ${t} (no DB, sem migration)`));
  for (const t of migratedNotLive) console.log(c.yellow(`  - ${t} (em migration, ausente no DB)`));
}

// ---------- N8N workflows vs git ----------
async function n8nFetch(p) {
  const res = await fetch(`${N8N_BASE}${p}`, {
    headers: { "X-N8N-API-KEY": N8N_KEY, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`N8N ${p} → ${res.status}`);
  return res.json();
}

async function checkN8nDrift() {
  header("N8N workflows drift");
  if (!N8N_KEY) {
    console.log(c.yellow("  ⚠ N8N_API_KEY ausente. Pulando."));
    return;
  }
  let wfs;
  try {
    const data = await n8nFetch("/api/v1/workflows?limit=250");
    wfs = data.data || data;
  } catch (err) {
    console.log(c.yellow(`  ⚠ falha ao listar workflows: ${err.message}`));
    return;
  }
  const active = wfs.filter((w) => w.active);
  const dir = path.join(REPO_ROOT, "n8n", "workflows");
  let localFiles = [];
  try {
    localFiles = await fs.readdir(dir);
  } catch {
    console.log(c.yellow(`  ⚠ ${dir} não existe. Considera todos workflows como sem export local.`));
  }
  const localIds = new Set(
    localFiles.filter((f) => f.endsWith(".json")).map((f) => f.split("-")[0]),
  );
  const activeMissing = active.filter((w) => !localIds.has(String(w.id)));
  const localExtra = [...localIds].filter((id) => !wfs.some((w) => String(w.id) === id));
  if (activeMissing.length === 0 && localExtra.length === 0) {
    console.log(c.green(`  ✓ sem drift. ${active.length} workflows ativos / ${localIds.size} arquivos locais.`));
    return;
  }
  for (const w of activeMissing)
    console.log(c.red(`  + ${w.id} ${w.name} (ativo, sem export local)`));
  for (const id of localExtra)
    console.log(c.yellow(`  - ${id} (arquivo local, workflow inexistente/removido no N8N)`));
}

// ---------- main ----------
const argv = process.argv.slice(2);
if (argv.length === 0 || argv.includes("--help")) {
  console.log("uso: drift-check.mjs --report");
  if (!argv.includes("--report") && argv.length > 0) process.exit(0);
}

try {
  await checkVercelDrift();
  await checkSupabaseDrift();
  await checkN8nDrift();
  console.log("");
} catch (err) {
  console.error("ERRO:", err.message || err);
  process.exit(1);
}
