# Problem Map: Conectar WhatsApp do cliente ao final do onboarding

**Data:** 2026-05-03
**Modo:** Solo (rascunho Claude, validar com Luiz)
**Origem:** Teste manual no Evolution mostrou que o endpoint retorna **QR Code + Pair Code**. Hoje o pipeline só extrai QR, e mesmo assim o cliente não vê nem QR nem Pair na tela final do onboarding.

---

## 1. Problem Statement

> O cliente termina o formulário de onboarding em `/onboarding`, vê uma tela de sucesso, mas **não recebe o mecanismo pra conectar o WhatsApp dele à instância Evolution recém-criada**. O QR Code chega no DB silenciosamente, o Pair Code é descartado no `Consolidar Dados` do n8n, e a UI de sucesso tem placeholder esperando um campo que o n8n nunca envia. O cliente fica num limbo até alguém (humano da equipe Singulare) intervir manualmente — ou até ele ir caçar a instância em outra área (`/painel`).

**Não é um problema de "QR vs Pair Code".** É um problema de "o último centímetro do onboarding está cortado e o cliente cai no chão".

---

## 2. Users / Stakeholders

**Primary:**
- **Owner/Médica principal** (Dra. Paula): acaba de pagar, está em "modo conclusão" — alta intenção. Cada minuto de fricção daqui derruba conversão.
- **Recepcionista/admin** (futuro): pode ser quem termina o onboarding em nome da médica.

**Stakeholders:**
- **Equipe Singulare comercial**: hoje provavelmente faz hand-holding manual nesse passo via Telegram/WhatsApp. Custo invisível.
- **Equipe técnica**: tem que diagnosticar "WhatsApp não conectou" sem ter dado nada visível ao cliente.
- **Agente IA Master Secretária**: depende de instância conectada pra começar a operar. Sem isso, tudo o resto é fachada.

---

## 3. Goals (success criteria)

1. **Tempo "submit do form → WhatsApp conectado"** abaixo de 2 minutos, sem intervenção humana da equipe Singulare.
2. **0 emails de "como conecto o WhatsApp?"** chegando na equipe nos primeiros 7 dias após onboarding (proxy de fricção).
3. **% de tenants com `evolution_status='connected'` em ≤ 5 min após criar a row** acima de 80%.
4. **Single-device path possível**: cliente consegue completar o onboarding inteiro em um único celular (sem precisar de segundo aparelho pra escanear QR).
5. Cliente que ficou no limbo recebe automaticamente um caminho de retomada (link, lembrete) sem depender de a gente notar.

---

## 4. Constraints

**Tempo:**
- Quanto antes melhor — esse é o ponto #1 de abandono observável no funil pós-pagamento.
- Mudança no n8n é trivial (um IF + extrair campo). Mudança na UI é maior.

**Recursos:**
- Solo (você + Claude). Sem QA dedicado.
- Cada deploy passa por Vercel (deploy workflow já estabelecido).

**Técnico:**
- Evolution API: já gera pair code quando `number` é passado na criação da instância (já é o caso hoje).
- Pair Code expira (~3 min na implementação WhatsApp). QR também expira (~60s).
- Webhook do n8n responde síncrono ao `/api/onboarding` (timeout 30s). Polling de status pós-resposta é responsabilidade do front.
- Cliente pode estar no celular OU desktop. Se desktop, QR funciona normal (escaneia com WhatsApp do celular). Se celular, QR é ruim (precisa de 2º aparelho ou screenshot/galeria).
- Não há `evolution_pairing_code` na tabela `tenants` hoje — vai precisar de migração (1 coluna `text nullable`).

**Negócio:**
- LGPD: pair code/QR são credenciais efêmeras de pareamento, não dados pessoais sensíveis. Sem bloqueio.
- A equipe quer reduzir CAC via conversão limpa, não via SDR puxando cliente.

---

## 5. Assumptions (precisam validação)

- ☐ Evolution **sempre** retorna pair code quando a instância é criada com `number` válido (não só "às vezes").
- ☐ Pair code do Evolution funciona em todas as versões atuais do WhatsApp (Android + iOS) sem feature-flag do lado do WA.
- ☐ Cliente médico médio entende "código de pareamento" e sabe onde colar (WhatsApp → Aparelhos Conectados → Conectar com número de telefone). **Provavelmente NÃO sabe.** Vai precisar instrução visual.
- ☐ Pair code expira em ~3min — cliente consegue digitar/colar dentro desse tempo. Se demorar, precisa botão "gerar novo".
- ☐ Maioria dos clientes faz onboarding pelo **celular** (intuição forte: SaaS B2B SMB no Brasil em 2026 = mobile-first). Se for desktop-first, QR é melhor default. **Validar via analytics de session.**
- ☐ Hoje há email enviado com QR em algum lugar (afirmação do usuário). **Não encontrei** o nó no workflow v4.4 ativo. Pode ser que (a) esteja em workflow separado, (b) seja mental model antigo da v4.1, (c) esteja off.
- ☐ Cliente confia em colar um código em "Aparelhos conectados" sem achar que é golpe. Vai precisar de copy reforçando segurança.

---

## 6. Pain Points & Challenges

### Cortes no fluxo atual (bugs de produto, não de código)

1. **Tela de sucesso é silenciosa**: o cliente vê "✅ Tudo certo, em poucos minutos enviaremos o acesso" e nada mais. Sem QR, sem pair code, sem botão "conectar WhatsApp agora". Cria expectativa de email que não chega (ou chega tarde).
2. **n8n descarta o pair code**: o nó `Consolidar Dados v4.4` extrai `qrcode.base64` e `qrcode.code` mas ignora o campo de pair code que o Evolution retorna na resposta de `instance-connect`/`create`.
3. **QR não vai pro frontend**: `Respond Webhook v4.4` retorna `qr_code` e `qr_string` mas o success screen não renderiza imagem nenhuma (UI só procura `whatsapp_pairing_code`).
4. **DB inconsistente**: `tenants.evolution_qr_code` é gravado pela rota Vercel mas não pelo n8n (o `Salvar Supabase v4.4` não inclui essa coluna). Estado divergente.
5. **Sem polling de status**: cliente que escaneia e conecta não vê confirmação na tela. Refresh manual ou ir pro `/painel` no escuro.
6. **Sem retry/regenerar**: se o pair code/QR expirar antes do cliente conectar, não há botão pra gerar novo. Suporte manual.

### Atritos UX em qualquer caminho (QR ou Pair)

7. **Médico no celular tentando escanear QR no próprio celular**: impossível. Hoje o QR (se renderizado) seria armadilha pra esse caso.
8. **Médico que nunca conectou "Aparelhos Conectados"**: não sabe nem onde fica essa opção no WhatsApp. Sem instrução visual passo-a-passo, trava.
9. **Mensagens conflitantes**: "enviamos por email" + tela com botão de conectar = qual é o canal verdadeiro?

### Atritos operacionais (equipe Singulare)

10. **Sem visibilidade**: ninguém sabe quando um tenant entrou no limbo "criado mas nunca conectou WhatsApp". Notif Telegram do v4.4 só dispara se QR foi gerado, não se foi consumido.
11. **Hand-holding via WhatsApp**: alguém da Singulare manda passo-a-passo pra cliente perdida. Não escala.

---

## 7. Open Questions (precisam resposta antes de desenhar solução)

1. **% real de onboarding mobile vs desktop?** (analytics) — pendente
2. **Hoje, qual o tempo médio entre `tenant criado` e `evolution_status=connected`?** (query Supabase) — pendente
3. **Quantos tenants ficam mais de 24h sem conectar?** (proxy de abandono) — pendente
4. ~~**Pair Code do Evolution: qual o nome exato do campo na resposta?**~~ ✅ **RESPONDIDO 2026-05-03 via teste empírico (workflow descartável `1xRQhx3EqUBttwai`).** Path: `response.data.pairingCode`. Camelcase. Veio `null` quando o número não é WA real (esperado).
5. **WhatsApp suporta deep-link `whatsapp://accept-pair?code=XXX`?** Pendente. Se não suportar, colar código é o caminho.
6. **Tem fluxo de "regenerar conexão" hoje?** (presumido: não)
7. **Em quanto tempo o pair code expira no Evolution?** Pendente — chute: ~3min como WhatsApp nativo.

---

## 7.1 Achados empíricos (2026-05-03) — teste contra Evolution real

**Workflow de teste:** `TEST: Evolution Pair Code Discovery` (id `1xRQhx3EqUBttwai`, arquivado).

**Resposta crua de `instance-connect`:**
```json
{
  "success": true,
  "data": {
    "pairingCode": null,            // existe; null se número fake
    "code": "2@32BBlqS4LVW3...",    // QR string
    "base64": "data:image/png;...", // QR image
    "count": 1
  }
}
```

**Resposta crua de `instance-basic` (create):** **NÃO contém pair code nem QR.** Só metadados (`instanceName`, `instanceId`, `hash`, `settings`). Confirma que QR e pair code vêm SÓ do `instance-connect`.

### 🐛 Bug crítico descoberto: o QR também está se perdendo na produção

O nó `Consolidar Dados v4.4` lê:
```js
const qrCode  = con?.qrcode?.base64 || ev?.qrcode?.base64 || null;
const qrString = con?.qrcode?.code   || con?.code           || null;
```

**Path errado.** O Evolution retorna `con.data.base64` e `con.data.code`, **não** `con.qrcode.*`. Resultado: `qrCode` e `qrString` estão sempre `null` no fluxo atual. Mesmo a coluna `evolution_qr_code` (que aliás nem está no INSERT do `Salvar Supabase v4.4`) viria vazia se estivesse.

Path correto:
```js
const qrCode      = con?.data?.base64       || null;
const qrString    = con?.data?.code         || null;
const pairingCode = con?.data?.pairingCode  || null;
```

### Cleanup pendente

Instância de teste `test-pair-debug-moq4mdos` ficou no Evolution (status `close`, número fake `5511999990000`, não conectada). Deletar manualmente quando conveniente.

---

## 8. Next Steps (sugestão pra fechar problem-mapping e ir pra ideação)

1. Responder Open Questions 1-4 (consultar analytics + Supabase + payload Evolution real). Sem isso, ideação fica chutando.
2. Decidir o **canal padrão** com base em (1): pair code (se mobile-first) ou tela com QR + pair (se misto).
3. Rodar `crazy-8s` ou brainstorm focado em "qual a tela perfeita pós-submit do onboarding pra esse caso", agora com problema bem framed.
4. Implementar mudanças em ordem de risco crescente:
   - n8n: extrair pair code + adicionar coluna `evolution_pairing_code` no `Salvar Supabase` + retornar no `Respond Webhook`. (~30 min, reversível)
   - Vercel: detectar device, escolher modal QR vs Pair, polling de status com SWR. (~2-3h)
   - Fallback: botão "gerar novo código" + email de retomada se 24h sem conectar. (~1h)
