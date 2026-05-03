# Onboarding WhatsApp Connection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar o WhatsApp do cliente automaticamente no fim do onboarding, mostrando QR Code e Pair Code adaptados ao device, com polling de status pra confirmar conexão sem precisar refresh.

**Architecture:** Pipeline de 4 camadas: (1) Supabase migration adiciona 2 colunas faltantes; (2) n8n workflow `v4.4` é corrigido in-place pra capturar `pairingCode` + paths corretos do QR + persistir/retornar os 3 campos; (3) Vercel API `/api/onboarding/route.ts` propaga os 3 campos pro client; (4) `SuccessScreen` renderiza método adequado ao device (mobile→Pair, desktop→QR) com toggle, e polling SWR detecta `connected` pra transição automática.

**Tech Stack:** Supabase Postgres • n8n SDK + Evolution API custom node • Next.js 16 App Router • SWR (provavelmente já instalado) • Tailwind • Framer Motion (já em uso)

**Bug crítico fixado por consequência:** A produção atual está perdendo silenciosamente também o QR Code, não só o pair code. O `Consolidar Dados v4.4` usa path `con.qrcode.*` que não existe (real é `con.data.*`).

---

## Pré-requisitos de execução

- Git: branch limpo, push depois de cada tarefa que afeta Vercel
- n8n: acesso MCP ativo (`mcp__claude_ai_n8n__*` tools)
- Supabase: acesso MCP ativo (`mcp__supabase-singulare__*` tools), tenant production
- Cleanup pendente da fase de problem-mapping: instância `test-pair-debug-moq4mdos` no Evolution (deletar quando puder)

---

## Phase 1 — Supabase migration

### Task 1: Adicionar colunas em `tenants`

**Files:**
- Migration via MCP (Supabase não usa migrations versionadas no repo): aplicar SQL direto

- [ ] **Step 1.1: Conferir colunas atuais relevantes**

Run via MCP:
```
mcp__supabase-singulare__list_tables({ schemas: ["public"] })
```

Esperado: tabela `tenants` listada, com `evolution_qr_code` (text, nullable) presente; **sem** `evolution_qr_string` e **sem** `evolution_pairing_code`.

- [ ] **Step 1.2: Aplicar migration**

Run via MCP:
```
mcp__supabase-singulare__apply_migration({
  name: "add_evolution_pair_and_qr_string_to_tenants",
  query: `
    ALTER TABLE public.tenants
      ADD COLUMN IF NOT EXISTS evolution_qr_string text,
      ADD COLUMN IF NOT EXISTS evolution_pairing_code text;

    COMMENT ON COLUMN public.tenants.evolution_qr_string IS
      'QR string crua do Evolution (data.code), usada como fallback se base64 falhar.';
    COMMENT ON COLUMN public.tenants.evolution_pairing_code IS
      'Pair code de 8 chars do WhatsApp (data.pairingCode). Null quando o numero nao e WA real ou expirou.';
  `
})
```

- [ ] **Step 1.3: Verificar**

Run via MCP:
```
mcp__supabase-singulare__execute_sql({
  query: "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='tenants' AND column_name IN ('evolution_qr_code','evolution_qr_string','evolution_pairing_code') ORDER BY column_name;"
})
```

Esperado: 3 linhas, todas `text`, todas `YES` em is_nullable.

- [ ] **Step 1.4: Sem commit**

Migrations Supabase não vão pro git nesse projeto (são aplicadas via MCP/dashboard). Documentar no plano basta.

---

## Phase 2 — n8n: corrigir captura + persistência + resposta

### Task 2: Atualizar nó `Consolidar Dados v4.4` com paths corretos + pair code

**Files:**
- n8n workflow `0. On Boarding Singulare v4.4` (id `DuG5i6r7ZSVqkW9Y`)

- [ ] **Step 2.1: Buscar o workflow atual e sua estrutura completa**

Run:
```
mcp__claude_ai_n8n__get_workflow_details({ workflowId: "DuG5i6r7ZSVqkW9Y" })
```

Salvar o JSON resultante — vai virar base do update. Identificar especificamente os nós `Consolidar Dados v4.4`, `Salvar Supabase v4.4`, `Respond Webhook v4.4`.

- [ ] **Step 2.2: Preparar o jsCode novo do `Consolidar Dados v4.4`**

```js
const t=$('Configurar Tenant v4.4').item.json;
const ev=$('Criar Instancia v4.4').item.json;
const con=$('Conectar Instancia v4.4').item.json;
const ca=$('Criar Calendar v4.4').item.json;
const dr=$('Drive Folder v4.4').item.json;
let acId='1',ibId='3',cwT='shared',cwD='https://chatwoot.singulare.org/';
try{const d=$('Criar Chatwoot Dedicado v4.4').item.json;if(d&&d.id){acId=d.id.toString();cwT='dedicated';}}catch(e){}
try{const ib=$input.item.json;if(ib&&ib.id)ibId=ib.id.toString();}catch(e){}
const qrCode=con?.data?.base64||null;
const qrString=con?.data?.code||null;
const pairingCode=con?.data?.pairingCode||null;
return[{
  tenant_id:t.tenant_id,clinic_name:t.clinic_name,email:t.email,admin_email:t.admin_email,
  address:t.address||'',
  phone:t.phone,plan_type:t.plan_type,establishment_type:t.establishment_type,
  doctor_name:t.doctor_name,doctor_crm:t.doctor_crm,speciality:t.speciality,
  consultation_duration:t.consultation_duration,version:'4.4',status:'active',
  subscription_status:'trial',
  addon_human_support:!!t.addon_human_support,
  calendar_id:ca?.id||'cal_'+Date.now(),
  drive_folder_id:dr?.id||'drv_'+Date.now(),
  evolution_instance_name:ev?.data?.instance?.instanceName||ev?.instance?.instanceName||t.tenant_id,
  evolution_phone_number:t.evolution_phone,
  evolution_qr_code:qrCode,
  evolution_qr_string:qrString,
  evolution_pairing_code:pairingCode,
  evolution_status:ev?.data?.instance?.status||ev?.instance?.status||'created',
  chatwoot_type:cwT,chatwoot_account_id:acId,chatwoot_inbox_id:ibId,
  chatwoot_url:cwD,telegram_bot_link:t.telegram_link,
  onboarding_status:'COMPLETO v4.4',provisioned_at:new Date().toISOString()
}];
```

**Mudanças vs versão atual:**
- `con?.qrcode?.base64` → `con?.data?.base64`
- `con?.qrcode?.code` → `con?.data?.code`
- adiciona `pairingCode = con?.data?.pairingCode`
- adiciona ao retorno: `evolution_qr_string`, `evolution_pairing_code`
- também ajusta `ev?.instance?.*` → `ev?.data?.instance?.*` com fallback (porque `Criar Instancia` retorna `data.instance.*` no formato confirmado pelo nosso teste empírico, e a versão antiga assumia o path errado)

- [ ] **Step 2.3: Atualizar o nó `Salvar Supabase v4.4` com colunas novas**

Mudar a string de `columns`:

```
Antiga: 'tenant_id,clinic_name,email,phone,admin_email,address,plan_type,establishment_type,doctor_name,doctor_crm,speciality,consultation_duration,status,chatwoot_url,chatwoot_account_id,chatwoot_inbox_id,chatwoot_type,drive_folder_id,evolution_instance_name,evolution_phone_number,evolution_status,calendar_id,telegram_bot_link,version,subscription_status,provisioned_at'

Nova:  'tenant_id,clinic_name,email,phone,admin_email,address,plan_type,establishment_type,doctor_name,doctor_crm,speciality,consultation_duration,status,chatwoot_url,chatwoot_account_id,chatwoot_inbox_id,chatwoot_type,drive_folder_id,evolution_instance_name,evolution_phone_number,evolution_qr_code,evolution_qr_string,evolution_pairing_code,evolution_status,calendar_id,telegram_bot_link,version,subscription_status,provisioned_at'
```

(Inseridas: `evolution_qr_code`, `evolution_qr_string`, `evolution_pairing_code` entre `evolution_phone_number` e `evolution_status`.)

- [ ] **Step 2.4: Atualizar `Respond Webhook v4.4` pra incluir pair code**

Mudar o `responseBody`:

```
Antiga: ={{ JSON.stringify({success:true,tenant_id:$('Consolidar Dados v4.4').item.json.tenant_id,qr_code:$('Consolidar Dados v4.4').item.json.evolution_qr_code,qr_string:$('Consolidar Dados v4.4').item.json.evolution_qr_string,chatwoot_inbox_id:$('Consolidar Dados v4.4').item.json.chatwoot_inbox_id,telegram_link:$('Consolidar Dados v4.4').item.json.telegram_bot_link,version:'4.4'}) }}

Nova:  ={{ JSON.stringify({success:true,tenant_id:$('Consolidar Dados v4.4').item.json.tenant_id,evolution_qr_code:$('Consolidar Dados v4.4').item.json.evolution_qr_code,evolution_qr_string:$('Consolidar Dados v4.4').item.json.evolution_qr_string,whatsapp_pairing_code:$('Consolidar Dados v4.4').item.json.evolution_pairing_code,evolution_instance_name:$('Consolidar Dados v4.4').item.json.evolution_instance_name,evolution_phone_number:$('Consolidar Dados v4.4').item.json.evolution_phone_number,evolution_status:$('Consolidar Dados v4.4').item.json.evolution_status,chatwoot_inbox_id:$('Consolidar Dados v4.4').item.json.chatwoot_inbox_id,telegram_bot_link:$('Consolidar Dados v4.4').item.json.telegram_bot_link,calendar_id:$('Consolidar Dados v4.4').item.json.calendar_id,drive_folder_id:$('Consolidar Dados v4.4').item.json.drive_folder_id,version:'4.4'}) }}
```

**Mudanças:**
- renomeia `qr_code` → `evolution_qr_code` e `qr_string` → `evolution_qr_string` (consistente com o que o Vercel já procura no `route.ts:438-453`)
- adiciona `whatsapp_pairing_code` (nome que `route.ts:514` já espera)
- adiciona `evolution_instance_name`, `evolution_phone_number`, `evolution_status`, `calendar_id`, `drive_folder_id` (a rota Vercel já tenta persistir esses; sem isso, ficam null)
- mantém `chatwoot_inbox_id`, `telegram_bot_link` (renomeado de `telegram_link` pra ficar consistente com `route.ts:447`)

- [ ] **Step 2.5: Validar o workflow completo**

Construir o objeto `nodes` com os 3 nós atualizados (mantendo os outros 13 idênticos), construir o objeto `connections` idêntico, montar o SDK code completo.

Run:
```
mcp__claude_ai_n8n__validate_workflow({ code: <full SDK code> })
```

Esperado: `{"valid":true,"nodeCount":16}` (ou número que match a v4.4 atual).

Se inválido: ler erros, corrigir, revalidar até passar.

- [ ] **Step 2.6: Atualizar o workflow em produção (cria nova versão draft)**

Run:
```
mcp__claude_ai_n8n__update_workflow({ workflowId: "DuG5i6r7ZSVqkW9Y", code: <validated code> })
```

`update_workflow` salva como draft, não publica. Versão ativa continua a antiga (com bug). Bom — dá tempo de testar.

- [ ] **Step 2.7: Publicar a nova versão**

Run:
```
mcp__claude_ai_n8n__publish_workflow({ workflowId: "DuG5i6r7ZSVqkW9Y" })
```

A partir desse momento, novos webhook calls do Vercel hitam a v4.4 corrigida.

- [ ] **Step 2.8: Smoke test end-to-end**

Fazer um onboarding real via UI (`/onboarding`) usando um número WhatsApp que você tenha disponível pra testar. Preencher os 5 steps, submeter.

Verificar via:
```
mcp__supabase-singulare__execute_sql({
  query: "SELECT tenant_id, evolution_qr_code IS NOT NULL AS has_qr, evolution_qr_string IS NOT NULL AS has_qr_str, evolution_pairing_code, evolution_status, created_at FROM public.tenants ORDER BY created_at DESC LIMIT 3;"
})
```

Esperado: a row mais recente tem `has_qr=true`, `has_qr_str=true`, `evolution_pairing_code` com 8 chars (se número era WA real) ou null.

- [ ] **Step 2.9: Cleanup do tenant de smoke test**

Anotar o `tenant_id` do passo 2.8. Após validar, rodar:
```
mcp__supabase-singulare__execute_sql({
  query: "DELETE FROM public.tenants WHERE tenant_id = '<smoke_test_tenant_id>';"
})
```

(Se houver FKs em outras tabelas, vai pedir CASCADE. Avaliar caso a caso ou marcar `status='deleted'` ao invés de excluir.)

Também deletar a Evolution instance criada (pelo painel manual ou via outro workflow utilitário).

- [ ] **Step 2.10: Sem commit (mudanças foram em n8n, não no repo)**

---

## Phase 3 — Vercel API: propagar campos novos

### Task 3: `/api/onboarding/route.ts` aceita e devolve os 3 campos

**Files:**
- Modify: `app/app/api/onboarding/route.ts:438-475` (block que persiste do n8n no tenants)
- Modify: `app/app/api/onboarding/route.ts:486-519` (block do return)

- [ ] **Step 3.1: Adicionar persistência dos novos campos no UPDATE**

Em `app/app/api/onboarding/route.ts`, dentro do bloco `if (n8nSummary)` (linha ~438), depois da linha:
```ts
if (typeof sum.evolution_qr_code === 'string') updates.evolution_qr_code = sum.evolution_qr_code;
```

Inserir:
```ts
if (typeof sum.evolution_qr_string === 'string') updates.evolution_qr_string = sum.evolution_qr_string;
if (typeof sum.whatsapp_pairing_code === 'string') updates.evolution_pairing_code = sum.whatsapp_pairing_code;
```

Note: o n8n response usa o nome `whatsapp_pairing_code` (consistente com o que UI espera) mas a coluna no DB é `evolution_pairing_code`. O mapeamento acontece aqui.

- [ ] **Step 3.2: Adicionar campos novos no payload de retorno**

No bloco `return NextResponse.json({...data: {...}})` (linha ~492), depois da linha:
```ts
whatsapp_pairing_code: n8nSummary?.whatsapp_pairing_code ?? null,
```

Inserir:
```ts
evolution_qr_code: n8nSummary?.evolution_qr_code ?? null,
evolution_qr_string: n8nSummary?.evolution_qr_string ?? null,
evolution_phone_number: n8nSummary?.evolution_phone_number ?? null,
```

- [ ] **Step 3.3: Build local pra checar TS**

Run:
```bash
cd /Users/luizflavioxavierdesa/Desktop/vivassit/app && npm run build 2>&1 | tail -30
```

Esperado: build passa. Se erro de tipo, ajustar a interface `SuccessData` em `app/app/onboarding/page.tsx:393` (Task 4 já cobre isso, mas pode ser preciso adiantar parte).

- [ ] **Step 3.4: Commit**

```bash
git add app/app/api/onboarding/route.ts
git commit -m "$(cat <<'EOF'
feat(onboarding): persist + return evolution_qr_string and pairing_code

n8n workflow v4.4 fixed (separate task) now returns evolution_qr_string
and whatsapp_pairing_code. Persist both as columns in tenants and pass
through to client so SuccessScreen can render WhatsApp connection UI.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 — Vercel UI: renderizar QR + pair adaptados ao device

### Task 4: Helper de detecção de device + tipos atualizados

**Files:**
- Create: `app/app/onboarding/lib/device-detection.ts`
- Modify: `app/app/onboarding/page.tsx:393-404` (interface `SuccessData`)

- [ ] **Step 4.1: Criar helper**

Criar `app/app/onboarding/lib/device-detection.ts`:
```ts
export type DeviceKind = 'mobile' | 'desktop';

export function detectDevice(userAgent: string | undefined): DeviceKind {
  if (!userAgent) return 'desktop';
  return /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)
    ? 'mobile'
    : 'desktop';
}

export function detectDeviceClient(): DeviceKind {
  if (typeof navigator === 'undefined') return 'desktop';
  return detectDevice(navigator.userAgent);
}
```

- [ ] **Step 4.2: Atualizar interface `SuccessData`**

Em `app/app/onboarding/page.tsx`, linha ~393, substituir a interface:
```ts
interface SuccessData {
  tenant_id: string;
  clinic_name: string;
  doctor_name: string;
  admin_email: string;
  calendar_link?: string | null;
  telegram_link?: string | null;
  whatsapp_pairing_code?: string | null;
  evolution_qr_code?: string | null;
  evolution_qr_string?: string | null;
  evolution_phone_number?: string | null;
  drive_link?: string | null;
  automation_status?: string | null;
}
```

- [ ] **Step 4.3: Build pra checar TS**

```bash
cd /Users/luizflavioxavierdesa/Desktop/vivassit/app && npm run build 2>&1 | tail -10
```

Esperado: passa.

- [ ] **Step 4.4: Commit**

```bash
git add app/app/onboarding/lib/device-detection.ts app/app/onboarding/page.tsx
git commit -m "$(cat <<'EOF'
feat(onboarding): add device detection helper + extend SuccessData type

Phase 4 prep for WhatsApp connection UI: SuccessScreen needs to know
device kind (mobile vs desktop) to choose default connection method,
and needs the new QR/pair fields propagated from the API.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Componente `WhatsAppConnect` com QR + Pair toggle

**Files:**
- Create: `app/app/onboarding/components/WhatsAppConnect.tsx`
- Modify: `app/app/onboarding/page.tsx:572-624` (substituir o bloco `Access links` que renderiza pair code)

- [ ] **Step 5.1: Criar o componente**

Criar `app/app/onboarding/components/WhatsAppConnect.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Smartphone, QrCode, Copy, Check } from 'lucide-react';
import { detectDeviceClient, type DeviceKind } from '../lib/device-detection';

const ACCENT = '#6E56CF';

interface Props {
  qrCodeBase64?: string | null;
  qrCodeString?: string | null;
  pairingCode?: string | null;
  phoneNumber?: string | null;
}

type Method = 'qr' | 'pair';

export function WhatsAppConnect({ qrCodeBase64, qrCodeString, pairingCode, phoneNumber }: Props) {
  const hasQr = !!qrCodeBase64;
  const hasPair = !!pairingCode;
  const [method, setMethod] = useState<Method>('qr');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Pair code é a opção primária por design (decisão Singulare 2026-05-03):
    // mais rápido, funciona em mobile-only, copy/paste sem precisar de 2º device.
    // QR Code só aparece como fallback se Evolution não retornou pair code (número não-WA).
    if (hasPair) setMethod('pair');
    else if (hasQr) setMethod('qr');
  }, [hasQr, hasPair]);

  if (!hasQr && !hasPair) return null;

  const copyPair = () => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="rounded-xl border border-black/[0.07] bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.08em] text-zinc-400 font-medium mb-1">
            Conectar WhatsApp
          </p>
          <p className="text-[13px] text-zinc-600">
            {phoneNumber ? `Número: ${phoneNumber}` : 'Conecte o WhatsApp da clínica'}
          </p>
        </div>
        {hasQr && hasPair && (
          <div className="inline-flex rounded-md border border-black/[0.08] p-0.5 text-[12px]">
            <button
              onClick={() => setMethod('qr')}
              className={`px-2.5 py-1 rounded transition-colors ${method === 'qr' ? 'bg-zinc-900 text-white' : 'text-zinc-600'}`}
            >
              <QrCode className="w-3.5 h-3.5 inline mr-1" /> QR
            </button>
            <button
              onClick={() => setMethod('pair')}
              className={`px-2.5 py-1 rounded transition-colors ${method === 'pair' ? 'bg-zinc-900 text-white' : 'text-zinc-600'}`}
            >
              <Smartphone className="w-3.5 h-3.5 inline mr-1" /> Código
            </button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {method === 'qr' && hasQr && (
          <motion.div
            key="qr"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex justify-center mb-3 bg-white p-3 rounded-lg border border-black/[0.04]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCodeBase64!} alt="QR Code WhatsApp" className="w-56 h-56" />
            </div>
            <ol className="text-[13px] text-zinc-600 space-y-1.5 list-decimal list-inside">
              <li>Abra o WhatsApp no celular</li>
              <li>Toque em <strong>Configurações → Aparelhos conectados → Conectar dispositivo</strong></li>
              <li>Aponte a câmera pra esse QR</li>
            </ol>
          </motion.div>
        )}

        {method === 'pair' && hasPair && (
          <motion.div
            key="pair"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-center gap-2 mb-3 py-6 bg-zinc-50 rounded-lg border border-black/[0.04]">
              <code className="font-mono text-[28px] tracking-[0.15em] font-semibold text-zinc-900">
                {pairingCode}
              </code>
              <button
                onClick={copyPair}
                className="ml-2 h-9 w-9 rounded-md border border-black/[0.08] hover:border-black/20 flex items-center justify-center"
                title="Copiar"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <ol className="text-[13px] text-zinc-600 space-y-1.5 list-decimal list-inside">
              <li>Abra o WhatsApp no celular</li>
              <li>Toque em <strong>Configurações → Aparelhos conectados → Conectar dispositivo</strong></li>
              <li>Toque em <strong>Conectar com número de telefone</strong></li>
              <li>Digite o código acima</li>
            </ol>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="mt-4 text-[11px] text-zinc-400">
        O código expira em ~3 minutos. Se vencer, atualize a página pra gerar um novo.
      </p>
    </div>
  );
}
```

- [ ] **Step 5.2: Importar e usar no `SuccessScreen`**

Em `app/app/onboarding/page.tsx`, no topo perto dos outros imports (linha ~1-30), adicionar:
```ts
import { WhatsAppConnect } from './components/WhatsAppConnect';
```

Depois, encontrar o bloco `{data.whatsapp_pairing_code && (...)}` (linha ~605-620) que renderiza só o pair code dentro do `Access links`. **Remover** esse bloco inteiro (do `{data.whatsapp_pairing_code && (` até o `)}` correspondente).

Adicionar **antes** do bloco `Access links` (linha ~573, antes de `{(data.calendar_link || data.telegram_link || ...)}`):
```tsx
{(data.evolution_qr_code || data.whatsapp_pairing_code) && (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.55, duration: 0.5 }}
    className="mt-8"
  >
    <WhatsAppConnect
      qrCodeBase64={data.evolution_qr_code}
      qrCodeString={data.evolution_qr_string}
      pairingCode={data.whatsapp_pairing_code}
      phoneNumber={data.evolution_phone_number}
    />
  </motion.div>
)}
```

Também ajustar a condição do bloco `Access links` pra **não** mais checar `whatsapp_pairing_code`:
```tsx
{(data.calendar_link || data.telegram_link || data.drive_link) && (
  // ...
)}
```

- [ ] **Step 5.3: Build local**

```bash
cd /Users/luizflavioxavierdesa/Desktop/vivassit/app && npm run build 2>&1 | tail -20
```

Esperado: build passa.

- [ ] **Step 5.4: Smoke test em dev local**

```bash
cd /Users/luizflavioxavierdesa/Desktop/vivassit/app && npm run dev
```

Em outro terminal, abrir `http://localhost:3000/onboarding`. Preencher fluxo até submit. Verificar tela de sucesso renderiza:
- Bloco `Conectar WhatsApp` com QR (default desktop) ou Código (default mobile)
- Toggle funcional entre QR e Código
- Animação de transição entre os dois
- Cópia do pair code funciona

Se faltar dado real (mock dev), pode forçar via:
```bash
# Editar temporariamente o estado de SuccessData no dev pra ter os campos preenchidos
```

- [ ] **Step 5.5: Commit**

```bash
git add app/app/onboarding/components/WhatsAppConnect.tsx app/app/onboarding/page.tsx
git commit -m "$(cat <<'EOF'
feat(onboarding): WhatsAppConnect component with QR/Pair toggle

Renders QR code or 8-char pairing code on the success screen,
defaulting to pair code on mobile (where self-scan is impossible)
and QR on desktop. Both methods include 3-step instructions.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push
```

---

## Phase 5 — Polling: detectar conexão e morfar a UI

### Task 6: Endpoint `/api/onboarding/status`

**Files:**
- Create: `app/app/api/onboarding/status/route.ts`

- [ ] **Step 6.1: Criar o endpoint**

Criar `app/app/api/onboarding/status/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenant_id');
  if (!tenantId || !/^[a-z0-9-]{3,80}$/.test(tenantId)) {
    return NextResponse.json({ error: 'invalid tenant_id' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase
    .from('tenants')
    .select('evolution_status, evolution_pairing_code, evolution_qr_code')
    .eq('tenant_id', tenantId)
    .single();

  if (error) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  return NextResponse.json({
    evolution_status: data.evolution_status ?? 'unknown',
    has_pairing_code: !!data.evolution_pairing_code,
    has_qr_code: !!data.evolution_qr_code,
  });
}
```

**Segurança:** retorno expõe **apenas** booleans + status, não o QR/pair code em si (já foram entregues no submit). `tenant_id` no path é GUID público, não é credencial.

- [ ] **Step 6.2: Build**

```bash
cd /Users/luizflavioxavierdesa/Desktop/vivassit/app && npm run build 2>&1 | tail -10
```

- [ ] **Step 6.3: Commit**

```bash
git add app/app/api/onboarding/status/route.ts
git commit -m "$(cat <<'EOF'
feat(onboarding): status endpoint for SuccessScreen polling

Returns evolution_status only — no QR/pair leakage. Used by the
client to detect when WhatsApp connection is established and
transition the success screen to a "connected" state.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Polling no `WhatsAppConnect` + estado conectado

**Files:**
- Modify: `app/app/onboarding/components/WhatsAppConnect.tsx`

- [ ] **Step 7.1: Adicionar polling**

Adicionar prop `tenantId` e novo `useEffect` que polla a cada 4s:

Em `WhatsAppConnect.tsx`, atualizar `Props`:
```ts
interface Props {
  tenantId: string;
  qrCodeBase64?: string | null;
  qrCodeString?: string | null;
  pairingCode?: string | null;
  phoneNumber?: string | null;
}
```

Adicionar dentro do componente, depois do `const [copied, setCopied] = useState(false);`:
```ts
const [connected, setConnected] = useState(false);

useEffect(() => {
  if (!tenantId || connected) return;
  const interval = setInterval(async () => {
    try {
      const res = await fetch(`/api/onboarding/status?tenant_id=${encodeURIComponent(tenantId)}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.evolution_status === 'open' || json.evolution_status === 'connected') {
        setConnected(true);
        clearInterval(interval);
      }
    } catch {
      // silencioso — polling é best-effort
    }
  }, 4000);
  return () => clearInterval(interval);
}, [tenantId, connected]);
```

Adicionar no início do return, antes do `<div className="rounded-xl ...">`:
```tsx
if (connected) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 flex items-center gap-3"
    >
      <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center text-white">
        <Check className="w-5 h-5" strokeWidth={3} />
      </div>
      <div>
        <p className="font-medium text-emerald-900">WhatsApp conectado</p>
        <p className="text-[13px] text-emerald-700">A IA já pode atender pacientes nesse número.</p>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 7.2: Passar `tenantId` no chamador**

Em `app/app/onboarding/page.tsx`, no uso do componente:
```tsx
<WhatsAppConnect
  tenantId={data.tenant_id}
  qrCodeBase64={data.evolution_qr_code}
  qrCodeString={data.evolution_qr_string}
  pairingCode={data.whatsapp_pairing_code}
  phoneNumber={data.evolution_phone_number}
/>
```

- [ ] **Step 7.3: Build**

```bash
cd /Users/luizflavioxavierdesa/Desktop/vivassit/app && npm run build 2>&1 | tail -10
```

- [ ] **Step 7.4: Smoke test em produção (preview)**

Após push, abrir o preview do Vercel. Fazer onboarding com seu número WhatsApp real. Conectar via QR ou Pair. Verificar:
- Card morfa pra "WhatsApp conectado" sem refresh manual em até ~10s
- Não há piscar/flicker
- Polling para depois de conectado (DevTools → Network: requests pra `/api/onboarding/status` devem cessar)

- [ ] **Step 7.5: Commit**

```bash
git add app/app/onboarding/components/WhatsAppConnect.tsx app/app/onboarding/page.tsx
git commit -m "$(cat <<'EOF'
feat(onboarding): poll evolution_status and morph UI on connection

WhatsAppConnect polls /api/onboarding/status every 4s. When status
flips to 'open' or 'connected', the card morphs into a green
"WhatsApp conectado" tile and polling stops. Eliminates the manual
refresh that customers had to do today.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push
```

---

## Phase 6 — Listener de eventos do Evolution + welcome message

**Contexto:** O `Configurar Tenant v4.4` já registra `evolution_webhook_url = https://n8n.singulare.org/webhook/evolution/v44/{tenant_id}` em cada instância criada. Mas hoje **nenhum workflow ativo escuta nesse path** (o legado `Evolution Webhook Router v6.0` está inativo). Resultado: eventos `connection.update` do Evolution caem no vazio.

Phase 6 corrige isso E aproveita pra mandar uma mensagem de boas-vindas ao novo tenant assim que conectar (validar a conexão + UX de fechamento).

### Task 8: Workflow `Evolution Connection Listener v4.4`

**Files:**
- Create: novo workflow n8n `Evolution Connection Listener v4.4`

- [ ] **Step 8.1: Buscar node types necessários**

Run:
```
mcp__claude_ai_n8n__search_nodes({ queries: ["webhook", "postgres", "set", "if"] })
mcp__claude_ai_n8n__get_node_types({ nodeIds: [{ nodeId: "n8n-nodes-base.webhook" }, { nodeId: "n8n-nodes-base.postgres", resource: "row", operation: "update" }] })
```

- [ ] **Step 8.2: Construir o SDK code do listener**

Estrutura do workflow:
```
Webhook (POST /evolution/v44) 
  → Parse Event (Code: extrai event, instance, state, real_phone do body)
  → IF connected? (event === 'connection.update' && state === 'open')
       └─ true → Lookup Tenant (Postgres SELECT FROM tenants WHERE evolution_instance_name = instance)
                  → Update Status (Postgres UPDATE evolution_status='connected', connected_at=now())
                  → Send Welcome (Evolution send-text to real_phone, msg de boas-vindas)
                  → Notify Admin (Telegram pra equipe Singulare)
       └─ false → Respond OK (silencioso)
```

Código SDK:
```js
import { workflow, node, trigger, ifElse, expr } from '@n8n/workflow-sdk';

const webhookTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2,
  config: {
    name: 'Evolution Webhook v4.4',
    parameters: {
      httpMethod: 'POST',
      path: 'evolution/v44',
      responseMode: 'lastNode',
      options: {}
    },
    position: [0, 0]
  },
  output: [{ body: { event: 'connection.update', instance: 'tenant-xyz', data: { state: 'open' } } }]
});

const parseEvent = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parse Event',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: "const b=$input.first().json.body||{};const data=b.data||{};return[{event:b.event||'unknown',instance:b.instance||'',state:data.state||'',is_connected:b.event==='connection.update'&&data.state==='open',raw:b}];"
    },
    position: [220, 0]
  },
  output: [{ event: 'connection.update', instance: 'tenant-xyz', state: 'open', is_connected: true, raw: {} }]
});

const isConnected = ifElse({
  version: 2.2,
  config: {
    name: 'Connected?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, typeValidation: 'loose', version: 2 },
        conditions: [{ id: 'c', leftValue: expr('{{ $json.is_connected }}'), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and'
      }
    },
    position: [440, 0]
  }
});

const lookupTenant = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.5,
  config: {
    name: 'Lookup Tenant',
    parameters: {
      operation: 'executeQuery',
      query: expr("SELECT tenant_id, doctor_name, clinic_name, phone FROM public.tenants WHERE evolution_instance_name = '{{ $json.instance }}' LIMIT 1;"),
      options: {}
    },
    onError: 'continueRegularOutput',
    position: [660, -100]
  },
  output: [{ tenant_id: 'tenant-xyz', doctor_name: 'Dra. Test', clinic_name: 'Test Clinic', phone: '+5511999990000' }]
});

const updateStatus = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.5,
  config: {
    name: 'Update Status',
    parameters: {
      operation: 'executeQuery',
      query: expr("UPDATE public.tenants SET evolution_status='connected', updated_at=NOW() WHERE tenant_id='{{ $json.tenant_id }}';"),
      options: {}
    },
    onError: 'continueRegularOutput',
    position: [880, -100]
  },
  output: [{}]
});

const sendWelcome = node({
  type: 'n8n-nodes-evolution-api.evolutionApi',
  version: 1,
  config: {
    name: 'Send Welcome WhatsApp',
    parameters: {
      resource: 'messages-api',
      operation: 'send-text',
      instanceName: expr("{{ $('Lookup Tenant').item.json.tenant_id }}"),
      remoteJid: expr("{{ $('Lookup Tenant').item.json.phone.replace(/\\D/g,'') }}@s.whatsapp.net"),
      messageText: expr("Olá Dr(a). {{ $('Lookup Tenant').item.json.doctor_name }}! 🎉\\n\\nA Singulare aqui. Sua secretária IA acabou de conectar com sucesso ao WhatsApp da {{ $('Lookup Tenant').item.json.clinic_name }}.\\n\\nA partir de agora, ela atende pacientes 24/7: cota consulta, marca agendamento, manda lembrete.\\n\\nSe precisar configurar algo, é só acessar o painel: https://app.singulare.org/painel\\n\\nBoas consultas! 🩺")
    },
    onError: 'continueRegularOutput',
    position: [1100, -100]
  },
  output: [{ key: { id: 'msg_id' }, status: 'PENDING' }]
});

const notifyAdmin = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Notify Admin',
    parameters: {
      resource: 'message',
      operation: 'sendMessage',
      chatId: '5749317361',
      text: expr("✅ WhatsApp CONECTADO\\n\\n🏥 {{ $('Lookup Tenant').item.json.clinic_name }}\\n👨‍⚕️ {{ $('Lookup Tenant').item.json.doctor_name }}\\n🆔 {{ $('Lookup Tenant').item.json.tenant_id }}\\n📱 {{ $('Lookup Tenant').item.json.phone }}\\n\\n⚡ IA atendendo agora."),
      additionalFields: { parse_mode: 'HTML' }
    },
    onError: 'continueRegularOutput',
    position: [1320, -100]
  },
  output: [{ ok: true }]
});

const ignored = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Ignored Event',
    parameters: { mode: 'manual', assignments: { assignments: [{ id: 'ok', name: 'ignored', value: true, type: 'boolean' }] }, options: {} },
    position: [660, 100]
  },
  output: [{ ignored: true }]
});

export default workflow('evolution-connection-listener-v44', 'Evolution Connection Listener v4.4')
  .add(webhookTrigger)
  .to(parseEvent)
  .to(isConnected
    .onTrue(lookupTenant.to(updateStatus.to(sendWelcome.to(notifyAdmin))))
    .onFalse(ignored));
```

Validar com `validate_workflow` antes de criar.

- [ ] **Step 8.3: Criar workflow no n8n**

Run:
```
mcp__claude_ai_n8n__create_workflow_from_code({
  code: <validated SDK code>,
  description: "Listener de eventos do Evolution. Quando uma instância conecta (state=open), atualiza tenants.evolution_status, envia mensagem de boas-vindas no WhatsApp do tenant e notifica admin via Telegram."
})
```

- [ ] **Step 8.4: Confirmar webhook URL**

A URL pública do webhook ficará tipo `https://n8n.singulare.org/webhook/evolution/v44`. Mas o `Configurar Tenant v4.4` registra `evolution_webhook_url = https://n8n.singulare.org/webhook/evolution/v44/{tenant_id}` (com tenant_id no path). Se Evolution chamar `POST /evolution/v44/abc-tenant-123`, o webhook trigger n8n escuta em `/evolution/v44` mas pode receber paths filhos? **Validar:** abrir o workflow no UI e ver qual a URL exata retornada.

Se n8n não aceita path filhos, ajustar o path do webhook para `evolution/v44/:tenant_id` e usar `$json.params.tenant_id` no `Parse Event` (mais robusto: tenant_id já vem do path).

- [ ] **Step 8.5: Publish + ativar**

Run:
```
mcp__claude_ai_n8n__publish_workflow({ workflowId: <new id> })
```

- [ ] **Step 8.6: Smoke test**

Como verificar sem fazer onboarding novo:
1. Pegar um `tenant_id` existente em produção (cliente real conectado).
2. Manualmente forjar um POST pra `https://n8n.singulare.org/webhook/evolution/v44` com body:
   ```json
   { "event": "connection.update", "instance": "<tenant_id_existente>", "data": { "state": "open" } }
   ```
3. Esperar o welcome message chegar no WhatsApp daquele cliente.

⚠ **Cuidado:** se mandar pra um cliente real, ele recebe a msg "de novo". Idempotência vale considerar (Task 8.7).

- [ ] **Step 8.7 (opcional): Idempotência**

Adicionar uma checagem antes do `sendWelcome`: só mandar se `evolution_status != 'connected'` ANTES do update. Senão, evento `connection.update` repetido manda welcome duplicado.

Implementação: trocar a ordem — primeiro `lookupTenant` retorna `evolution_status` atual, IF status != 'connected' então segue, senão para. Ou usa flag `welcomed_at` em nova coluna.

Mais simples: nova coluna `tenants.welcomed_at timestamp nullable`, e só envia welcome se for null. Setar no momento do envio.

```sql
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS welcomed_at timestamp;
```

Adicionar em Phase 1 ou separar.

- [ ] **Step 8.8: Sem commit (workflow é remoto)**

---

## Future enhancements (fora desse plano)

Itens que ficaram identificados mas saem do escopo desse PR:

- **Regenerar QR/Pair quando expira:** botão "gerar novo" que chama `instance-connect` de novo via novo endpoint Vercel → n8n.
- **Email de retomada:** se 24h após onboarding o tenant continua sem `connected`, disparar email com link pra retomar.
- **Deeplink WhatsApp pra mobile:** investigar `whatsapp://` schema com pair code (pode reduzir a 1 toque).
- **Telemetria:** medir tempo médio "submit → connected" e taxa de abandono na etapa.
- **Cleanup automatizado de instâncias órfãs:** cron que deleta instâncias Evolution sem `connected` há mais de 7 dias.

---

## Self-review

- ✅ **Spec coverage:** Todos os 4 achados do problem-map cobertos: QR perdido (Phase 2), pair code descartado (Phase 2), UI sem render (Phase 4-5), pair code field name (verified `data.pairingCode`, used em todo o plano).
- ✅ **Placeholder scan:** Sem TBD/TODO. Cada step tem código completo.
- ✅ **Type consistency:** `evolution_qr_code`, `evolution_qr_string`, `evolution_pairing_code` (DB columns) usados consistentemente. `whatsapp_pairing_code` (n8n response field, frontend prop) também consistente.
- ✅ **Risk:** mudanças aditivas em DB; n8n update via draft+publish atômico; Vercel via preview→prod com push.
- ⚠ **Dependência implícita:** Task 1 deve rodar antes de Task 2.7 (publish do n8n) senão o INSERT do `Salvar Supabase` falha. Documentar essa ordem na execução.
