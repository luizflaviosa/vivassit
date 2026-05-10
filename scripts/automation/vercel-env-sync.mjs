#!/usr/bin/env node
/**
 * vercel-env-sync.mjs — compara/sincroniza env vars entre Vercel e .env.local.
 * Comandos: diff | pull | push <NAME> <VALUE>
 * Push é mutativo: requer --apply + confirmação interativa.
 * Nunca imprime valores — apenas nomes.
 */

const fs = await import("node:fs/promises");
const path = await import("node:path");
const { execFileSync } = await import("node:child_process");
const readline = await import("node:readline/promises");

const SCOPE = process.env.VERCEL_SCOPE || "team_bt7LVA71g3zN0Brw0PV1jHk7";
const ENV_TARGET = "production";
const REPO_ROOT = path.resolve(new URL("../..", import.meta.url).pathname);
const ENV_FILE = path.join(REPO_ROOT, ".env.local");

const argv = process.argv.slice(2);
const cmd = argv[0];
const apply = argv.includes("--apply");

function vercel(args, opts = {}) {
  return execFileSync("vercel", ["--scope", SCOPE, ...args], {
    encoding: "utf8",
    stdio: opts.inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    ...opts,
  });
}

function parseVercelEnvLs(out) {
  // saída tabular: linhas começam com nome da var. Pega tokens não-vazios.
  const names = new Set();
  const lines = out.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^(name\s|Vercel CLI|>|Environment Variables)/i.test(trimmed)) continue;
    const first = trimmed.split(/\s+/)[0];
    if (/^[A-Z][A-Z0-9_]*$/.test(first)) names.add(first);
  }
  return [...names].sort();
}

async function readEnvFileNames() {
  try {
    const content = await fs.readFile(ENV_FILE, "utf8");
    const names = new Set();
    for (const line of content.split("\n")) {
      const m = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=/);
      if (m) names.add(m[1]);
    }
    return [...names].sort();
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

async function cmdDiff() {
  let out;
  try {
    out = vercel(["env", "ls", ENV_TARGET]);
  } catch (err) {
    console.error("Falha ao rodar `vercel env ls`. Logado? (`vercel login`).");
    process.exit(1);
  }
  const remote = parseVercelEnvLs(out);
  const local = await readEnvFileNames();
  const remoteSet = new Set(remote);
  const localSet = new Set(local);
  const onlyRemote = remote.filter((n) => !localSet.has(n));
  const onlyLocal = local.filter((n) => !remoteSet.has(n));
  console.log(`=== Vercel (${ENV_TARGET}): ${remote.length} vars / .env.local: ${local.length} vars ===`);
  console.log(`\nApenas no Vercel (faltam local):`);
  for (const n of onlyRemote) console.log(`  + ${n}`);
  console.log(`\nApenas no .env.local (faltam remoto):`);
  for (const n of onlyLocal) console.log(`  - ${n}`);
}

async function cmdPull() {
  console.log(`Rodando: vercel env pull ${ENV_FILE} --environment=${ENV_TARGET}`);
  vercel(["env", "pull", ENV_FILE, `--environment=${ENV_TARGET}`], { inherit: true });
  console.log("Pull concluído.");
}

async function cmdPush(name) {
  if (!name) {
    console.error("uso: push <NAME> <VALUE>  (VALUE lido do argv mas nunca printado)");
    process.exit(1);
  }
  if (!/^[A-Z][A-Z0-9_]*$/.test(name)) {
    console.error(`Nome inválido: ${name}. Use UPPER_SNAKE_CASE.`);
    process.exit(1);
  }
  // value é o segundo posicional não-flag
  const positional = argv.filter((a) => !a.startsWith("--"));
  const value = positional[2];
  if (!value) {
    console.error("Valor ausente. uso: push <NAME> <VALUE> --apply");
    process.exit(1);
  }
  if (!apply) {
    console.log(`[dry-run] adicionaria ${name} no Vercel env=${ENV_TARGET}.`);
    console.log(`[dry-run] use --apply para confirmar.`);
    return;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = await rl.question(`Confirma adicionar ${name} em Vercel env=${ENV_TARGET}? (yes/no): `);
  rl.close();
  if (ans.trim().toLowerCase() !== "yes") {
    console.log("Cancelado.");
    return;
  }
  // vercel env add NAME ENV — lê valor do stdin
  const proc = await import("node:child_process");
  const child = proc.spawn("vercel", ["--scope", SCOPE, "env", "add", name, ENV_TARGET], {
    stdio: ["pipe", "inherit", "inherit"],
  });
  child.stdin.write(value + "\n");
  child.stdin.end();
  await new Promise((resolve, reject) => {
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
  });
  console.log(`Var ${name} adicionada em ${ENV_TARGET}.`);
}

try {
  switch (cmd) {
    case "diff":
      await cmdDiff();
      break;
    case "pull":
      await cmdPull();
      break;
    case "push":
      await cmdPush(argv[1]);
      break;
    default:
      console.error("uso: vercel-env-sync.mjs <diff|pull|push <NAME> <VALUE> --apply>");
      process.exit(1);
  }
} catch (err) {
  console.error("ERRO:", err.message || err);
  process.exit(1);
}
