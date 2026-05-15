# Singulare — Unit economics, LTV e CAC explicados

Aprofundamento das premissas e contas do item 11. O objetivo aqui é deixar transparente cada número que usei, mostrar a sensibilidade dele a mudanças, e explicar por que a relação LTV/CAC é o tabuleiro estratégico mais importante de SaaS B2B.

---

## 1. O que é LTV (Lifetime Value)

LTV é quanto dinheiro a Singulare ganha, em média, com cada cliente durante todo o tempo em que ele fica assinando.

A fórmula mais usada em SaaS recorrente:

```
LTV = ARPU × Margem Bruta / Churn Mensal
```

Onde:
- **ARPU** (Average Revenue Per User) = receita média por cliente por mês
- **Margem Bruta** = % da receita que sobra depois de descontar custos diretos (hosting, APIs de IA, gateway de pagamento, etc.)
- **Churn Mensal** = % de clientes que cancelam por mês

O resultado é o valor presente médio que cada cliente gera ao longo da vida útil dele como cliente.

### Por que essa fórmula?

Intuição rápida: se cada cliente paga R$ 187 de margem por mês (R$ 250 × 75%), e a probabilidade dele continuar mês a mês é 95% (churn de 5%), então o número médio de meses que ele fica é `1 / 0.05 = 20 meses`. E o LTV total é `R$ 187 × 20 = R$ 3.740`.

A fórmula `1/churn` vem da soma de uma série geométrica (P × (1 + (1-c) + (1-c)² + …)) que converge pra `P / c` quando c é pequeno. É uma aproximação razoável; pra clientes que ficam anos, é precisa.

### Limitações dessa fórmula

- Assume churn constante. Na vida real, churn é maior nos primeiros 90 dias e cai depois (a "cliff" de ativação).
- Não considera expansion revenue (cliente que aumenta de plano ao longo do tempo). Pra capturar isso usa-se *Net Dollar Retention*.
- Assume margem constante. Conforme produto evolui, margem pode subir (mais eficiência) ou cair (mais funcionalidades caras).

Pra Singulare na fase atual (sem dados próprios ainda), a fórmula simples é boa o suficiente pra tomar decisão. Vamos refinar quando tiver 100+ clientes.

---

## 2. O que é CAC (Customer Acquisition Cost)

CAC é quanto dinheiro a Singulare gasta, em média, pra conquistar 1 novo cliente.

```
CAC = (Gasto total em marketing + Vendas) / Número de clientes novos no período
```

Dois tipos comuns:

- **CAC Pago (Paid CAC):** só conta o que foi gasto em mídia paga (Google Ads, Meta Ads, etc.) dividido pelos clientes vindos desses canais.
- **CAC Blended (misturado):** total de gasto comercial dividido por todos os clientes novos, mesmo os que vieram orgânicos. É o número mais honesto pra avaliar saúde do negócio.

### Composição típica do CAC

| Item | % do CAC típico |
|---|---|
| Mídia paga (Ads) | 40-60% |
| Conteúdo/SEO (amortizado) | 10-20% |
| Ferramentas (CRM, automation, analytics) | 5-15% |
| Salário de marketing | 15-30% |
| Salário de vendas (se houver) | 0-40% (mais em Enterprise) |
| Eventos, parcerias | 5-15% |

Pra Singulare em fase inicial, sem time de vendas, CAC blended deve girar entre **R$ 300 e R$ 900** dependendo do mix de canais.

---

## 3. A relação LTV/CAC — o número mais importante

A razão `LTV / CAC` é o indicador-chave de saúde de SaaS.

| LTV/CAC | Significado | Ação típica |
|---|---|---|
| < 1 | Você perde dinheiro em cada cliente | Para tudo, repensa modelo |
| 1 a 2 | Empata sem margem | Insustentável, otimiza urgente |
| **3** | **Healthy. Cada R$ gasto traz R$ 3 ao longo da vida do cliente** | Padrão da indústria |
| 4 a 5 | Muito bom, com folga | Pode acelerar crescimento |
| > 5 | Provavelmente está subinvestindo em marketing | Aumenta budget pra crescer mais rápido |

A regra "3:1" não é divina — vem de observação empírica de que SaaS sustentáveis têm essa proporção. Veio de David Skok (Matrix Partners) que estudou centenas de SaaS dos EUA.

Por que não miramos 10:1?
- Significa que está deixando crescimento na mesa.
- Concorrente vai aparecer e investir mais agressivamente que você.
- O dinheiro "extra" que economiza não rende tanto quanto reinvestir em pegar mais clientes.

Por que não miramos 1.5:1?
- Margem pequena demais pra absorver imprevistos (churn maior, custo subindo).
- Sem caixa pra reinvestir em produto, equipe, melhoria.
- Investidores não financiam.

---

## 4. As contas do documento da auditoria — destrinchadas

### Premissas que usei

Cada uma com a faixa onde está e por quê escolhi o ponto.

**a) ARPU (Receita média por cliente por mês): R$ 250**

Composição estimada por mix de planos (chute calibrado, sem dados próprios):

| Plano | Preço | % do mix esperado | Contribuição ARPU |
|---|---|---|---|
| Starter (proposto R$ 97) | R$ 97 | 30% | R$ 29 |
| Professional (atual R$ 197) | R$ 197 | 55% | R$ 108 |
| Enterprise (sob medida ~R$ 997) | R$ 997 | 15% | R$ 150 |
| **Subtotal sem add-on** | | | **R$ 287** |
| Add-on Atendimento Humano (R$ 297) com attach 25% | | | R$ 74 |
| **ARPU bruto** | | | **R$ 361** |

Hmm — esse cálculo dá R$ 361, maior que os R$ 250 que usei. Por que ajustei?

Porque o mix real provavelmente é mais conservador no início (mais Starter, menos Enterprise) e add-ons levam tempo pra atingir 25% de attach. Pra fazer projeção segura, usei R$ 250 como **ARPU realista nos 12 primeiros meses**.

Quando produto amadurece, ARPU sobe pra R$ 350-450 (com expansion revenue funcionando). Aí o LTV sobe também.

**b) Margem Bruta: 75%**

Estimativa dos custos diretos (COGS) como % da receita:

| Custo | % da receita estimado |
|---|---|
| OpenAI/Anthropic API (modelo IA) | 8-15% |
| Hosting Vercel | 2-4% |
| Banco Supabase | 2-3% |
| WhatsApp infra (Evolution self-hosted) | 1-3% |
| Asaas (taxa do gateway) | 3-5% |
| SMTP, SMS, outras APIs | 1-2% |
| **Total COGS** | **17-32%** |
| **Margem Bruta** | **68-83%** |

Escolhi 75% que está no meio da faixa. SaaS de IA tende a ter margem menor que SaaS clássico por causa do custo de inferência da OpenAI/Anthropic. Cliente que conversa muito = custo de IA proporcionalmente maior.

Se mudar pra modelos próprios (Llama, Mistral self-hosted), margem sobe pra 80-85%. Mas exige infraestrutura.

**c) Churn Mensal: 5-8%**

Faixa baseada em benchmarks SaaS B2B PME:
- **B2C/SMB sem ancoragem:** 8-12% mensal (alto)
- **B2B PME com integração média:** 5-8% mensal
- **B2B com integrações profundas:** 2-5% mensal
- **B2B Enterprise:** 0.5-2% mensal

Singulare se encaixa em "B2B PME com integração média": o cliente conecta WhatsApp, Calendar, etc., mas a integração não é tão funda quanto um ERP. Trocar custaria 1-2 semanas mas é viável.

Em ambiente Brasil, com 7 dias de trial e cobrança recorrente, churn dos primeiros 90 dias provavelmente é alto (10-15%) — clientes que não ativaram bem. Depois estabiliza em 3-5%.

Usei 5-8% como faixa segura.

### A conta do LTV faixa baixa e alta

**Cenário pessimista (churn 8%):**

```
LTV = R$ 250 × 0.75 / 0.08
LTV = R$ 187.5 / 0.08
LTV = R$ 2.344
```

**Cenário otimista (churn 5%):**

```
LTV = R$ 250 × 0.75 / 0.05
LTV = R$ 187.5 / 0.05
LTV = R$ 3.750
```

Faixa: **R$ 2.300 a R$ 3.750**. Ou seja, cada cliente gera entre R$ 2.300 e R$ 3.750 de margem total durante a vida útil dele.

### A conta do CAC sustentável

Aplicando a regra 3:1:

**Cenário pessimista:**
```
CAC max = R$ 2.344 / 3 = R$ 781
```

**Cenário otimista:**
```
CAC max = R$ 3.750 / 3 = R$ 1.250
```

Conclusão: a Singulare pode gastar **entre R$ 780 e R$ 1.250 pra adquirir cada cliente** e ainda ter um negócio saudável.

---

## 5. Payback period — quanto tempo pra recuperar o CAC

O payback é o tempo (em meses) pra recuperar o que gastou pra adquirir o cliente.

```
Payback (meses) = CAC / (ARPU × Margem Bruta)
Payback (meses) = CAC / Contribuição Mensal
```

Onde *contribuição mensal* é o quanto cada cliente "deposita" em margem por mês.

Pra Singulare:

```
Contribuição Mensal = R$ 250 × 0.75 = R$ 187/cliente/mês
```

| CAC | Payback |
|---|---|
| R$ 300 | 1.6 meses |
| R$ 500 | 2.7 meses |
| R$ 800 | 4.3 meses |
| R$ 1.000 | 5.3 meses |
| R$ 1.200 | 6.4 meses |

**Por que isso importa:**

- Payback < 6 meses = negócio com fluxo de caixa saudável (você recupera antes do cliente potencialmente churnar)
- Payback 6-12 meses = sustentável mas exige caixa
- Payback 12-18 meses = típico de SaaS B2B SMB
- Payback > 18 meses = exige investidor + paciência

Singulare está num espaço excepcional: payback de 4-6 meses é **muito bom**, melhor que a maioria dos SaaS brasileiros do mesmo segmento. Isso porque o ticket médio é razoável (R$ 250) e o produto é altamente ROI-comprovável pro cliente.

---

## 6. CAC estimado por canal — onde investir

Cada canal tem CAC diferente. Aqui está minha estimativa pra Singulare:

### a) Google Ads (search, alta intenção)

Cálculo de funil:
- CPC médio: R$ 5
- Conversão Visit→Trial (registro): 3-5%
- Conversão Trial→Pago: 25-35%

Pra 1000 cliques:
- Custo: R$ 5.000
- Trials: 30-50
- Pagantes: 7-17

**CAC Google Ads: R$ 290-715**

Ótimo canal. Recomendo começar aqui.

### b) Meta Ads (Instagram/Facebook)

Pra B2B vertical, direct conversion é fraca:
- CPC: R$ 1-3 (mais barato que Google)
- Conversão Visit→Trial: 0.5-1.5% (intenção mais fraca)
- Conversão Trial→Pago: similar (25-35%)

**CAC Meta direct: R$ 1.000-2.500** — fora da faixa sustentável

Mas funciona muito bem pra:
- **Retargeting** (gente que já visitou): CAC R$ 200-400, eficiente
- **Awareness** (subir reconhecimento de marca): não cobrar CAC, é investimento de longo prazo

### c) Conteúdo orgânico / SEO

Custo concentrado no início (escrever artigos, montar SEO), tráfego cresce sozinho.

Estimativa:
- Custo de produção: R$ 500-1500 por artigo (com IA + revisão médica)
- Tráfego médio por artigo após 6 meses: 200-2000 visitas/mês
- Conversão médio Visit→Pago: 1-3% (combinado entre trial e direct conversion)

Pra um portfólio de 50 artigos publicados em 1 ano:
- Custo total: R$ 30.000
- Tráfego mensal acumulado em 18 meses: ~50.000 visitas/mês
- Clientes/mês via conteúdo: 500-1500
- CAC amortizado em 18 meses: R$ 30.000 / (somatório de clientes) ≈ R$ 50-150

**CAC conteúdo amortizado em 18 meses: R$ 50-200** — extremamente eficiente, mas demora.

### d) Programa de indicação

Custo: 1 mês grátis (R$ 197) por indicação bem-sucedida.

- Quem indica: cliente atual satisfeito (custo zero pra adquirir)
- Quem aceita: cliente novo motivado (alta conversão)

**CAC referral: R$ 200-400** (counting o desconto + atrito de processo)

Excelente canal. Difícil escalar pra centenas/mês mas pega 10-30% dos clientes novos com pouco esforço.

### e) Parcerias com sociedades médicas

Custo: 1 evento + 1 brinde + tempo de fundador.

- Conversão variável (depende da força da parceria)
- Tipicamente: R$ 5.000 investidos → 20-50 médicos cadastrados → 2-8 pagantes

**CAC parceria: R$ 600-2500** — caro mas alto LTV (clientes vindos de parceria validada têm churn menor).

### f) Outbound (cold outreach)

Pra Enterprise faz sentido. Pra SMB, geralmente não.

- Custo: salário de SDR (R$ 4.000-6.000/mês)
- Conversão típica: 1-3 deals/mês por SDR

**CAC outbound: R$ 1.500-5.000** — só vale pra Enterprise.

### Mix recomendado pros primeiros 12 meses

| Canal | % do orçamento | CAC esperado | Volume esperado |
|---|---|---|---|
| Google Ads | 40% | R$ 400 | 25-35 clientes/mês |
| Conteúdo/SEO | 25% | R$ 100 (amortizado) | 10-20 clientes/mês (cresce) |
| Indicação | 10% | R$ 300 | 5-15 clientes/mês |
| Meta Ads (retargeting) | 10% | R$ 350 | 3-8 clientes/mês |
| Parcerias | 15% | R$ 1.000 | 5-10 clientes/mês |
| **Blended esperado** | | **R$ 400-500** | **50-90 clientes/mês** |

CAC blended R$ 450 contra LTV R$ 3.000 (médio) = LTV/CAC ratio **6.7:1**. Ratio alto signaliza que **pode investir mais agressivamente** pra crescer mais rápido (aumentar CAC pra 800-1000 e dobrar volume de clientes adquiridos).

---

## 7. Sensibilidade — o que mais move o jogo

Pra entender qual variável é mais alavancada, sensibilizamos cada uma mantendo as outras constantes:

### Cenário base
- ARPU: R$ 250
- Margem: 75%
- Churn: 6%
- LTV: R$ 3.125
- CAC sustentável (3:1): R$ 1.042

### Sensibilidade 1: ARPU sobe 40% (R$ 250 → R$ 350)

Por upsell de planos + add-ons + Enterprise crescendo.

- LTV: R$ 4.375 (+40%)
- CAC sustentável: R$ 1.458 (+40%)

ARPU é proporcional. Cada R$ 1 a mais de ARPU mensal vale ~R$ 12.5 a mais de LTV (com 6% churn e 75% margem).

### Sensibilidade 2: Churn cai 50% (6% → 3%)

Por melhor ativação + onboarding + retenção.

- LTV: R$ 6.250 (+100%)
- CAC sustentável: R$ 2.083 (+100%)

**Churn é a variável mais alavancada.** Cair 50% no churn dobra o LTV. Por isso a auditoria principal enfatizou tanto checklist de ativação, sandbox, etc. — toda melhoria de retenção compounds.

### Sensibilidade 3: Margem sobe 13% (75% → 85%)

Por mover IA pra modelos próprios ou otimizar custos de API.

- LTV: R$ 3.542 (+13%)
- CAC sustentável: R$ 1.181 (+13%)

Margem é proporcional, mas tem teto natural (custos não chegam a zero).

### Sensibilidade 4: Todas melhorando juntas (cenário ótimo realista)

ARPU R$ 350, Churn 4%, Margem 80%:

- LTV: R$ 350 × 0.80 / 0.04 = **R$ 7.000**
- CAC sustentável: R$ 2.333

Esse é o cenário pra ano 2-3 se tudo for executado bem. Mais que dobra o jogo financeiro.

### Sensibilidade 5: Pior cenário (degradação)

ARPU R$ 200, Churn 10%, Margem 65%:

- LTV: R$ 200 × 0.65 / 0.10 = **R$ 1.300**
- CAC sustentável: R$ 433

Aqui a Singulare ainda funciona mas com margem operacional bem mais apertada. Crescimento lento, dependência de canal orgânico.

---

## 8. Erros comuns que destruem unit economics em SaaS

**a) Subestimar custos de servir (CAC operacional)**

CAC não inclui custos de servir o cliente depois (suporte, sucesso, customização). Esses ficam no "CES" (Customer Engagement Spend). Pra SaaS PME, CES costuma ser 10-20% da receita. Pra Enterprise, 30-50%.

Pro plano Enterprise da Singulare com onboarding humano, calcular esse CES é crítico. Se sua equipe gasta 10h em onboarding por Enterprise client (R$ 1.500 em hora-empresa), o Enterprise tem que cobrir isso no primeiro mês.

**b) Aceitar margem ruim no Add-on Atendimento Humano**

Já mencionei na auditoria principal mas vale matemática:

Se um atendente humano custa R$ 5.000/mês full-time e atende ~600 conversas/mês:
- Custo por conversa: R$ 8.33

Cobrando R$ 297 fixo, cliente médio com 50 conversas/mês:
- Custo do operador: R$ 417
- Receita: R$ 297
- **Margem negativa de R$ 120/mês**

Mesmo se cliente tem 30 conversas/mês:
- Custo: R$ 250
- Receita: R$ 297
- Margem: R$ 47 (16%) — muito apertada

Solução: cobrar por conversa escalada (R$ 9-12/conversa) ou pacotes de horas.

**c) Ignorar pagamento na frente (annual prepay)**

Se cliente paga anual antecipado com 15% desconto, troca margem por caixa. Importante porque:
- Trava cliente por 12 meses (churn artificial = 0)
- Caixa imediato pra reinvestir em CAC
- Melhora cash flow do negócio

LTV "trava" no anual mas Cash LTV imediato sobe. Cada R$ 1 captado anualmente vale ~R$ 2.5 em flexibilidade operacional vs. cobrança mensal.

Recomendo oferecer anual com desconto desde o início. Mesmo poucos clientes anuais já melhoram fluxo de caixa.

**d) Não diferenciar Logo CAC de CAC blended**

"Logo CAC" é só custo dos clientes que foram cadastrados, sem peso de upsell/expansion. Quando se inclui expansion revenue, o LTV cresce mais.

Net Dollar Retention (NDR) é a métrica completa: receita atual de uma coorte 12 meses depois / receita inicial da coorte.

- NDR < 100%: coorte está encolhendo (perde mais do que expande)
- NDR = 100%: estável
- NDR > 100%: coorte está crescendo (expansion > churn)

SaaS top de mercado tem NDR 110-150%. Isso significa que **mesmo sem adquirir cliente novo, a receita cresce**. Singulare ainda não tem dados próprios, mas se executar bem a estratégia de expansion (mais médicos → mais módulos), pode chegar fácil em NDR 110-120% em 12 meses.

---

## 9. O tabuleiro estratégico — onde investir em cada fase

### Fase 1 (0-100 clientes pagantes): Provar unit economics

- Foco: provar que LTV/CAC > 3
- Canal: orgânico + Google Ads barato + indicação
- Métrica única: churn mensal cohort-by-cohort
- Decisão: se LTV/CAC < 3 nos primeiros 100 clientes, pausa aquisição e melhora produto

### Fase 2 (100-1000 clientes): Escalar canais que funcionam

- Foco: dobrar tudo o que está com CAC < LTV/3
- Canal: Google Ads + parcerias + começar Meta retargeting
- Métrica: blended CAC + payback period
- Decisão: começar a investir em conteúdo orgânico de longo prazo

### Fase 3 (1000-5000 clientes): Otimização e expansion

- Foco: reduzir churn + aumentar ARPU via expansion
- Canal: continua, mas começa outbound pra Enterprise
- Métrica: NDR (Net Dollar Retention)
- Decisão: investir em produto que aumenta ARPU (módulos, integrações)

### Fase 4 (5000+ clientes): Maturidade

- Foco: defender posição + buscar adjacências
- Canal: brand marketing + parcerias estratégicas
- Métrica: receita anual, NDR, market share
- Decisão: levantar capital pra crescer mais rápido, ou cash-cow?

Singulare está provavelmente entrando na Fase 1. As próximas decisões mais importantes:

1. Instalar Posthog + Sentry hoje pra começar a medir.
2. Definir cohorts e medir churn separadamente nos primeiros 30/60/90 dias.
3. Não investir mais de R$ 5.000/mês em paid antes de provar payback < 6 meses.
4. Coletar depoimentos e cases dos primeiros 20 clientes (vira combustível pro próximo ciclo).

---

## 10. Resumo executivo desta análise

**LTV** = quanto cada cliente vale ao longo da vida = R$ 2.300-3.750.

**CAC sustentável** = quanto pode gastar pra adquirir = R$ 770-1.250 (regra 3:1).

**Payback** = quanto tempo pra recuperar o gasto de aquisição = 4-7 meses (excelente).

**Variável mais alavancada** = churn. Cair de 8% pra 4% dobra o LTV. Por isso ativação importa mais que conversão.

**Mix de canais inicial** = Google Ads (40%) + Conteúdo (25%) + Indicação (10%) + Meta retargeting (10%) + Parcerias (15%). CAC blended esperado: R$ 450.

**Cenário 12 meses adiante** com execução boa: LTV R$ 5-7k, CAC R$ 500, ratio 10:1 — pode escalar agressivamente.

**Cenário ruim** (sem melhoria de ativação): LTV R$ 1.3k, CAC R$ 600, ratio 2:1 — sobrevive mas não escala.

A diferença entre os dois cenários é determinada principalmente por **churn e ARPU**, que dependem das melhorias listadas na auditoria principal (ativação, sandbox, expansion, pricing). É por isso que aquela lista importa tanto.

— Continuação Singulare audit
