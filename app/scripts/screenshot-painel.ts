/**
 * Captura screenshots reais do painel Singulare via Playwright.
 *
 * Pré-requisitos:
 *   - Tenant 'demo-singulare' + auth user demo@singulare.org criados (seed)
 *   - npm run dev rodando em :3000
 *
 * Uso:
 *   npm run screenshot:painel
 */

import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const DEMO_EMAIL = 'demo@singulare.org';
const DEMO_PASSWORD = 'SingulareDemo2026!';
const APP_URL = 'http://localhost:3000';
const OUTPUT_DIR = path.join(process.cwd(), 'public/v2/painel');

const ROUTES = [
  { name: 'home',          path: '/painel',                viewport: { width: 1440, height: 900 } },
  { name: 'agenda',        path: '/painel/agenda',         viewport: { width: 1440, height: 900 } },
  { name: 'pacientes',     path: '/painel/pacientes',      viewport: { width: 1440, height: 900 } },
  { name: 'cobrancas',     path: '/painel/cobrancas',      viewport: { width: 1440, height: 900 } },
  { name: 'configuracoes', path: '/painel/configuracoes',  viewport: { width: 1440, height: 900 } },
  { name: 'equipe',        path: '/painel/equipe',         viewport: { width: 1440, height: 900 } },
];

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('🌐 Lançando Chromium...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('🔐 Login via /api/dev-login (server-side)...');
  const loginResp = await page.request.post(`${APP_URL}/api/dev-login`, {
    data: {
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      token: process.env.DEV_LOGIN_TOKEN || 'singulare-dev-only',
    },
    timeout: 90000, // primeira compilação do route handler é lenta
  });
  if (!loginResp.ok()) {
    const text = await loginResp.text();
    console.error('❌ Login falhou:', loginResp.status(), text);
    await browser.close();
    process.exit(1);
  }
  console.log('✅ Sessão estabelecida');

  // Setar cookie singulare_active_tenant pra forçar visualizar tenant demo
  // (caso o user esteja em vários tenants)
  await context.addCookies([
    {
      name: 'singulare_active_tenant',
      value: 'demo-singulare',
      url: APP_URL,
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
  ]);

  for (const route of ROUTES) {
    console.log(`📸 ${route.path}`);
    await page.setViewportSize(route.viewport);
    try {
      await page.goto(`${APP_URL}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (e) {
      console.warn(`   ⚠️ goto failed: ${(e as Error).message}`);
    }

    if (page.url().includes('/login')) {
      console.error(`   ❌ redirecionado pra /login (cookies expiraram)`);
      await browser.close();
      process.exit(1);
    }

    // Espera spinner sumir (lucide Loader2 tem classe animate-spin)
    try {
      await page.waitForFunction(
        () => {
          const spinners = document.querySelectorAll('.animate-spin');
          // se não tiver spinner ou só tem 0px (escondido), considera carregado
          return Array.from(spinners).every((s) => {
            const el = s as HTMLElement;
            return !el.offsetParent || el.offsetWidth === 0;
          });
        },
        { timeout: 15000 }
      );
    } catch {
      console.warn(`   ⚠️ spinner não sumiu em 15s — capturando mesmo assim`);
    }

    // Aguarda networkidle pra fetches client-side terminarem
    try {
      await page.waitForLoadState('networkidle', { timeout: 10000 });
    } catch {
      /* ok, prossegue */
    }

    // Pausa final pra animações Framer Motion estabilizarem
    await page.waitForTimeout(2000);

    const out = path.join(OUTPUT_DIR, `${route.name}.png`);
    await page.screenshot({ path: out, fullPage: false });
    console.log(`   → ${out}`);
  }

  await browser.close();
  console.log('\n✨ Pronto. Screenshots em public/v2/painel/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
