import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const APP_URL = 'http://localhost:3000';
const OUTPUT_DIR = path.join(process.cwd(), 'public/v2/preview');

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Log de console + erros
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('  [console.error]', msg.text().slice(0, 200));
  });
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message.slice(0, 200)));
  page.on('response', (r) => {
    if (r.status() >= 400) console.log(`  [${r.status()}]`, r.url().replace(APP_URL, ''));
  });

  console.log('🌐 Navegando /v2 (compile inicial pode demorar)...');
  await page.goto(`${APP_URL}/v2`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  console.log('   DOM carregado.');

  // 1. Espera CONTEÚDO real do hero (headline da Singulare)
  console.log('⏳ Aguardando texto "Seu consultório" aparecer...');
  try {
    await page.waitForFunction(
      () => /Seu consult[oó]rio/i.test(document.body.innerText),
      { timeout: 120000 }
    );
    console.log('   ✓ Hero renderizado.');
  } catch {
    console.log('   ⚠️ Timeout esperando hero. Capturando mesmo assim.');
  }

  // 2. Espera fontes carregarem
  await page.evaluate(() => (document as any).fonts?.ready);

  // 3. Pausa pra animações Framer Motion + 3D orb estabilizarem
  await page.waitForTimeout(4000);

  // 4. Screenshots por seção
  const captures = [
    { name: '01-hero',         y: 0 },
    { name: '02-highlights',   y: 900 },
    { name: '03-dashboard',    y: 1900 },
    { name: '04-ai',           y: 2900 },
    { name: '05-performance',  y: 3700 },
    { name: '06-themes',       y: 4700 },
    { name: '07-testimonials', y: 5700 },
    { name: '08-pricing',      y: 6500 },
    { name: '09-cta',          y: 7300 },
  ];

  for (const c of captures) {
    await page.evaluate((y) => window.scrollTo(0, y), c.y);
    await page.waitForTimeout(1200); // anima de novo a cada scroll
    const out = path.join(OUTPUT_DIR, `${c.name}.png`);
    await page.screenshot({ path: out });
    console.log(`📸 ${c.name}.png`);
  }

  console.log('📸 00-fullpage.png (página inteira)');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '00-fullpage.png'), fullPage: true });

  await browser.close();
  console.log(`\n✨ Pronto: ${OUTPUT_DIR}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
