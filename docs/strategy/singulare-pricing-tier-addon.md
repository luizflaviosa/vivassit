# Singulare — Pricing por pacotes (tier) para o Atendimento Humano

Você tem razão. Cobrança 100% por uso (per-conversa) é a fórmula matematicamente "limpa" mas psicologicamente quebra em mercado B2B brasileiro de PME. Pacote por faixa resolve isso preservando proteção de margem se for desenhado direito.

---

## Por que usage-based puro funciona mal em SaaS B2B PME

Cinco fricções reais:

1. **Medo de "bill shock".** Cliente abre a fatura e vê R$ 1200 esse mês porque teve uma campanha viralizou. Em saúde, isso vira pesadelo — contador da clínica reclama.
2. **Trava o uso do recurso.** Cliente fica relutante de pedir IA escalar pra humano porque "cada uma custa". Acaba não usando o que pagou pra ter.
3. **Difícil de orçar.** Clínica com 5 sócios precisa apresentar custos previsíveis no orçamento anual. "Variável" é fricção administrativa.
4. **Sente predatório.** Toda conversa "cobra um pouquinho" — mesmo com preço pequeno, o gatilho psicológico é o de medidor rodando.
5. **Diluí o valor do plano base.** Cliente começa a confundir "isso aqui está incluso ou eu vou pagar a mais?" — fricção em cada interação.

Pacote resolve quase tudo isso, com um custo: você precisa **calibrar bem** e **monitorar consumo** pra não ter cliente "ruim" (que usa muito mas paga pouco).

---

## Proposta: 3 pacotes de Atendimento Humano

### Estrutura

| Pacote | Escalações humanas/mês | Janela de atendimento | SLA resposta | Preço |
|---|---|---|---|---|
| **Plus** | até 30 | Seg-Sex, 9h-18h | < 10 min | R$ 197 |
| **Premium** | até 100 | Seg-Sáb, 9h-22h | < 5 min | R$ 497 |
| **Ultra** | até 300 | 24/7 com feriados | < 2 min | R$ 1.497 |

**Overage gentil:** R$ 5 por escalação acima do limite do pacote, com aviso visual no painel quando bate 80% (sem cortar serviço). Garante que cliente nunca é surpreendido — vê a contagem subir e decide se faz upgrade.

**Reset mensal automático** no dia do faturamento.

### Por que essa estrutura funciona

**a) Cliente vê valor claro em cada degrau.**

- Plus → Premium: ganha sábado, horário noturno, SLA 2x mais rápido. Vale R$ 300/mês a mais? Sim, especialmente pra clínica com paciente que escreve à noite.
- Premium → Ultra: ganha domingo, feriados, 24h. Pra clínicas que querem responder durante feriado (cardiologia, ortopedia urgência) ou pra clínicas grandes.

Não é "mais escalações pelo mesmo preço". Cada tier compra uma **experiência diferente**.

**b) Margem fica protegida.**

Reestimei o custo operacional com premissas mais realistas:
- Atendente trabalha 8h/dia × 22 dias = ~176h/mês = 10.560 min
- Escalação média (incluindo context-switch): 5 min cada
- Capacidade por atendente: ~2.100 escalações/mês
- Custo do atendente: R$ 5.000 + overhead R$ 1.000 = R$ 6.000/mês
- **Custo por escalação: ~R$ 2,86**

Com essa premissa:

| Pacote | Escalações máx | Custo máx | Receita | Margem |
|---|---|---|---|---|
| Plus | 30 | R$ 86 | R$ 197 | 56% |
| Premium | 100 | R$ 286 | R$ 497 | 42% |
| Ultra | 300 | R$ 858 | R$ 1.497 | 43% |

Margens entre 42-56%. Considerando que poucos clientes vão usar 100% do pacote (média típica é 30-60%), margem efetiva fica em 60-75%. Saudável.

**c) Cliente é incentivado a usar (não a poupar).**

Pagou R$ 497, vai querer "extrair valor" do que pagou. Mais uso = mais valor percebido = menos churn. Per-conversa cria o efeito contrário.

**d) Overage gentil cria upsell automático.**

Cliente Plus que bate 35 escalações: pagou R$ 197 + R$ 25 de overage = R$ 222. Daqui 2 meses vai pra 50 escalações = R$ 197 + R$ 100 = R$ 297. Aí o painel sugere: "Você está usando como Premium. Upgrade salva R$ 0 esse mês mas dá horário estendido e SLA melhor."

Cliente vê racional, não pressão. Conversão tipica de overage→upgrade em SaaS é 30-50%.

---

## Aplicar o mesmo conceito no plano base

A lógica de pacote também resolve a fricção da conversa-IA na assinatura principal. Aqui a margem por conversa é menor (IA via OpenAI custa R$ 0.10-0.30 por conversa), então os limites podem ser bem maiores:

| Plano base | Conversas IA/mês | Médicos | Preço |
|---|---|---|---|
| **Starter** | até 300 | 1 | R$ 97 |
| **Pro** | até 1.500 | 5 | R$ 297 |
| **Business** | até 5.000 | 15 | R$ 797 |
| **Enterprise** | Ilimitado | Ilimitado | sob medida |

**Overage:** R$ 0,30 por conversa acima (apenas no Starter e Pro). Business e Enterprise são ilimitados.

Pra colocar em perspectiva, 1.500 conversas/mês = 50 conversas/dia. Clínica de 5 médicos com agenda cheia atende ~80 pacientes/dia e talvez metade interage por WhatsApp = 40/dia = 1.200/mês. Pro caso médio o Pro absorve sem overage.

Cliente que estoura: clínica em crescimento. Bom problema, vira upsell pra Business.

---

## Comparação visual — usage vs tier

### Cenário: cliente com 80 escalações no mês

**Modelo per-conversa puro (R$ 9/escalação):**
- Conta: 80 × R$ 9 = R$ 720
- Cliente reação: "Por que isso variou tanto? Não posso prever."

**Modelo tier Premium (R$ 497):**
- Conta: R$ 497 (incluso)
- Cliente reação: "Paguei o que combinei. Tudo certo."

**Modelo tier Plus com overage (limite 30):**
- Conta: R$ 197 + (80-30) × R$ 5 = R$ 197 + R$ 250 = R$ 447
- Cliente reação: "Ah, eu estourei o pacote. Faz sentido. Acho que vou pro Premium mês que vem que sai melhor."

O tier com overage **conta uma história clara** pro cliente. Per-conversa é só matemática invisível.

---

## Comunicação na landing e onboarding

### Como apresentar

Não chama de "pacote" (fricção). Chama de **"plano de atendimento humano"**, com nomes simples:

> **Plus** — pra clínica que escala poucas conversas pra humano. Cobertura em horário comercial.  
> **Premium** — pra quem precisa de cobertura estendida e atendimento mais rápido. Inclui sábado e noite.  
> **Ultra** — atendimento total, 24/7. Pra quem não pode perder um único paciente.

Tabela comparativa com 3 colunas + bullets do que cada uma inclui. Não destacar "preço por escalação" — destacar **o que cada plano entrega**.

### Quando oferecer

Não no onboarding inicial. Cliente que ainda nem viu a IA funcionar não compra add-on. Padrão recomendado:

1. **Mês 0:** cliente entra no plano base, sem add-on. Banner discreto no painel "Adicionar atendimento humano (opcional)".
2. **Mês 1:** após 4 semanas de uso, se a IA escalou pra humano (mesmo que via Chatwoot manual do cliente) pelo menos 5 vezes, banner mais visível: "Você teve 8 conversas que precisaram de atenção humana este mês. Que tal deixar a Singulare fazer isso?".
3. **Mês 2+:** se cliente aceitar, fica num modelo "freemium" do add-on por 7 dias (Plus grátis), depois cobra.

Isso aumenta a conversão pra add-on de ~10-15% (oferta padrão) pra ~30-40% (com prova de valor primeiro).

---

## Como migrar quem já está pagando R$ 297 hoje

Subir de R$ 297 pra R$ 497 (Premium) é aumento de 67%. Risco de churn alto se não comunicar direito.

### Caminho recomendado

1. **Grandfather** os clientes atuais por 12 meses. Eles ficam no plano antigo "Atendimento Humano R$ 297 — escalações ilimitadas" enquanto durar a assinatura.
2. **Upgrade voluntário** com benefício: "Se mudar pro Premium agora, fica em R$ 297 por 12 meses (= mesma fatura). Ganha SLA melhorado + sábado." (Aceitação típica: 30-50%).
3. **Novos clientes** entram já no modelo novo.
4. **Renovação anual** dos legados: 60 dias antes da renovação, comunicar o novo modelo, oferecer migração com incentivo (1 mês grátis ou desconto vitalício).

Em 12-18 meses todos estão no modelo novo, sem traumas. Churn induzido fica abaixo de 5% da base.

---

## Análise de risco — onde isso pode dar errado

**a) Subestimar volume real de escalações.**

Se cliente médio usar 70-90% do pacote (em vez de 30-50% que assumi), a margem cai. Mitigação: medir nos primeiros 60 dias do produto novo e ajustar antes de escalar a base.

**b) Cliente irritado com overage.**

Se overage acontece muito (cliente passa do limite todo mês), ele acha que está sendo "obrigado a fazer upgrade". Mitigação: aviso em 80%, sugestão automática de upgrade com calculadora ("você teria pago R$ X no Premium em vez de R$ Y agora").

**c) Concorrente vem com modelo mais simples.**

"R$ 199 ilimitado" parece atraente. Mitigação: comunicar bem que Singulare entrega atendimento humano de verdade (não bot). Concorrente que oferece "ilimitado" geralmente está mentindo (limita escondido) ou tem produto pior.

**d) Plus se torna armadilha.**

Cliente entra no Plus por preço, mas usa muito, fica frustrado com overage. Mitigação: na hora da escolha do plano no checkout, calculadora "quantas conversas você acha que vai escalar?" sugere o plano certo.

---

## Comparação com concorrentes brasileiros

Pra calibrar quão "agressivo" ou "amigável" está o pricing:

| Produto | Modelo | Comentário |
|---|---|---|
| iClinic (gestão) | Tier fixo (R$ 99-399/mês) | Por usuário. Não tem add-on de atendimento. |
| Doctoralia (marketplace) | Comissão por agendamento + plano | Pega 10-20% por agendamento. Caro pra clínica grande. |
| Conexa Saúde (telemedicina) | Por consulta (R$ 35-80) | Variável puro. Reclamação comum. |
| Bot WhatsApp custom (vários) | R$ 99-299 + setup | Sem atendimento humano. Outro nicho. |
| Take Blip (B2B) | A partir de R$ 600/mês + uso | Caro, pra grandes empresas. |

Singulare com Plus R$ 197 + Premium R$ 497 + Ultra R$ 1.497 fica:
- **Mais barato no entry** (Plus) que Bot custom + secretária
- **Comparável no meio** (Premium) — diferencial é o atendimento humano
- **Premium no topo** (Ultra) — justifica com SLA 24/7

Posicionamento defensável.

---

## Recomendação final

1. **Adotar os 3 pacotes** (Plus, Premium, Ultra) pro add-on.
2. **Aplicar pacote no plano base também** (Starter, Pro, Business, Enterprise) — mas com limites generosos pra IA conversar (5x maior que o que cliente médio usa).
3. **Overage gentil** (R$ 5 escalação, R$ 0,30 conversa) com aviso em 80% e sugestão de upgrade automática.
4. **Grandfather** os clientes atuais — não force migração imediata.
5. **Apresentar o pricing** com clareza: tabela 3 colunas, bullets do que entrega, sem destaque pra "por escalação".
6. **Não vender o add-on no onboarding inicial**. Esperar 30 dias de uso pra apresentar com prova de valor.

O efeito esperado:
- ARPU sobe (do plano base + attach de add-on) ~50-80% em 12 meses
- Churn cai (porque pacote é mais previsível que per-uso)
- Conversão do upsell de pacote-pra-pacote ~30-50%
- Sentimento do cliente: "tenho controle, vejo valor, evolui comigo"

---

## Apêndice — números detalhados

### Plus com diferentes níveis de uso

| Uso real | Custo operacional | Receita | Margem $ | Margem % |
|---|---|---|---|---|
| 5 escalações | R$ 14 | R$ 197 | R$ 183 | 93% |
| 15 escalações | R$ 43 | R$ 197 | R$ 154 | 78% |
| 30 escalações (limite) | R$ 86 | R$ 197 | R$ 111 | 56% |
| 40 (overage 10) | R$ 114 | R$ 247 | R$ 133 | 54% |
| 80 (overage 50) | R$ 229 | R$ 447 | R$ 218 | 49% |

Mesmo no overage agressivo, margem positiva.

### Premium com diferentes níveis de uso

| Uso real | Custo operacional | Receita | Margem $ | Margem % |
|---|---|---|---|---|
| 30 escalações | R$ 86 | R$ 497 | R$ 411 | 83% |
| 70 escalações | R$ 200 | R$ 497 | R$ 297 | 60% |
| 100 (limite) | R$ 286 | R$ 497 | R$ 211 | 42% |
| 150 (overage 50) | R$ 429 | R$ 747 | R$ 318 | 43% |

### Ultra com diferentes níveis de uso

| Uso real | Custo operacional | Receita | Margem $ | Margem % |
|---|---|---|---|---|
| 100 | R$ 286 | R$ 1.497 | R$ 1.211 | 81% |
| 200 | R$ 572 | R$ 1.497 | R$ 925 | 62% |
| 300 (limite) | R$ 858 | R$ 1.497 | R$ 639 | 43% |
| 500 (overage 200) | R$ 1.430 | R$ 2.497 | R$ 1.067 | 43% |

Em todos os cenários, margem entre 42-93%. Mais robusto que per-conversa puro.

— Singulare pricing tier
