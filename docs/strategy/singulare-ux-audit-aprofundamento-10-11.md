# Singulare — Aprofundamento dos itens 10 e 11

Continuação da auditoria. Foco em **aquisição (landing)** e **viabilidade de negócio**.

---

## 10. Landing e aquisição — análise profunda

### 10.1. Funil estimado e onde estão os vazamentos

Sem analytics instalado é palpite, mas o funil típico de SaaS B2B vertical brasileiro:

| Etapa | Conversão típica | Onde otimizar |
|---|---|---|
| Visitante singulare.org | 100% | SEO, paid, indicação |
| Clica "Começar" / "Testar grátis" | 8–15% | Hero, prova social, CTA |
| Inicia o onboarding | 60–80% | Atrito do form, valor percebido |
| Completa os 5 steps | 30–55% | Tamanho dos steps, draft visível |
| Chega no checkout | 80% dos completos | — |
| Coloca cartão e paga | 25–45% do checkout | Confiança, PIX, fatura, social proof |
| Conecta WhatsApp (ativação real) | 40–70% dos pagos | UX pós-checkout |
| Continua ativo D+30 | 50–70% dos ativados | Engagement primeiro mês |
| Renova D+90 | 70–85% dos D+30 | Valor entregue, churn técnico |

Se Singulare tiver 1000 visitas/mês, isso vira ~3–8 clientes pagantes ativos D+30. Pra escalar significativamente, ataca os dois maiores gaps: chegar no onboarding (volume) e ativar (qualidade).

### 10.2. SEO orgânico — o canal mais barato e durável

O mercado de saúde brasileiro é hipersegmentado e ávido por solução técnica. Conteúdo bom posiciona rápido porque concorrência editorial é fraca.

**a) SEO local com páginas programáticas**

Gerar páginas dinâmicas por especialidade x cidade:

```
singulare.org/dentista/sao-paulo
singulare.org/psicologo/belo-horizonte
singulare.org/fisioterapeuta/curitiba
...
```

Cada página com:
- H1: "Secretária IA para [Especialidade] em [Cidade]"
- Estatística local: "Em São Paulo há ~28k dentistas cadastrados no CRO. A maioria atende fora do horário comercial."
- Depoimento (mesmo que genérico no início): "Dr. Pedro, dentista em SP, economizou 15h/semana com a Singulare."
- 3 use cases específicos da especialidade
- FAQ específica
- CTA

Custo: 1 template Next.js + JSON com lista de cidades/especialidades. ~2 dias dev. Sai do nada pra rankear em "secretária ia para dentista SP" em 30-60 dias.

**Avisos importantes:**
- Não fazer milhares de páginas duplicadas (penalização Google). Manter ~200-500 páginas com conteúdo único o suficiente.
- Usar Schema.org `MedicalOrganization` e `Service` markup.
- Sitemap dinâmico (`/app/sitemap.ts`).
- Internal linking entre páginas relacionadas.

**b) Blog editorial — autoridade + tráfego de fundo de funil**

Tópicos com volume de busca real no Brasil:

- "Como organizar agenda de consultório" — busca alta, intenção transacional
- "Como cobrar do paciente que não comparece"
- "Modelo de mensagem WhatsApp para confirmação de consulta"
- "Erros que toda secretária comete (e que IA não faz)"
- "Lei do ChatGPT para clínica médica em 2026"
- "Pode usar IA em prontuário? CFM diz que…"
- "TISS, CBHPM, prontuário eletrônico — guia para clínica pequena"
- "Como abrir clínica sem dor de cabeça"
- "WhatsApp Business vs WhatsApp comum para clínica"
- "Comparativo: secretária presencial vs remota vs IA"

Cadência sugerida: 1 post/semana, ~1500 palavras, ilustração simples, autoria por médico parceiro (se possível). Em 6 meses são 26 posts, e a maioria começa a trazer tráfego sozinha após 3-4 meses.

**Pode automatizar 70% do rascunho** com IA + prompt específico do nicho, mas precisa de revisão humana de um médico real pra não cair em "AI slop" que o Google rebaixa.

**c) Linkbuilding focado**

Trocar conteúdo / parceria com:
- Blogs de gestão de clínica (existem alguns: Conexa Saúde, Medway, iClinic blog)
- Sociedades médicas regionais (CRM-SP, CRO-SP, CFP-SP)
- Cursos online de gestão clínica
- Médicos influenciadores que escrevem sobre gestão
- Podcasts da área (ex: "Gestão Médica em 5 Minutos")

Cada link em domínio relevante vale meses de SEO. 20-30 backlinks bons em 6 meses fazem diferença significativa.

### 10.3. Conversão da landing — o que cada seção tem que entregar

**a) Above-the-fold (primeira tela, sem scroll)**

Tem que responder em 3 segundos:
1. *O que é?* — "Secretária IA para clínicas que atende no WhatsApp 24/7"
2. *Pra quem?* — "Para médicos, dentistas, psicólogos e mais"
3. *Por que é diferente?* — "Marca consulta sozinha, cobra sozinha, organiza sozinha. Sem contratar secretária."
4. *CTA único* — "Começar grátis em 5 minutos"

Erro comum: ter dois CTAs (entrar / cadastrar). Resolve com "Começar grátis" grande + "Já tenho conta" pequeno no canto.

**b) Vídeo de 30-60s acima da dobra**

Mostrar paciente mandando "oi" no WhatsApp e a IA respondendo, marcando consulta, mandando link de pagamento. Em 30s. Mais conversão que screenshot estático em 80% dos testes (Wistia/Loom benchmark).

Custo: 1 dia de gravação + edição. Pode ser tela do iPhone + voiceover. Não precisa de produtora.

**c) Prova social hierarquizada**

Em ordem decrescente de impacto:
1. **Logos de clínicas que usam** (mesmo que pequenas — "Clínica XYZ, Hospital ABC, Consultório do Dr. Bla").
2. **Quote depoimento com foto, nome, CRM** — "Reduzi 60% das ligações da minha secretária, economizei 2400 R$/mês." Dr. João, CRM-SP 123456.
3. **Métricas agregadas** — "1.247 clínicas ativas | 89mil atendimentos em abril | 96% de satisfação".
4. **Mídia** — "Citado em Veja Saúde, Folha, etc." (se já saiu em algum lugar).

Se ainda não tem isso, **comece coletando agora**. Mesmo com 3 clientes, peça depoimento e foto. Vale ouro nos primeiros 12 meses.

**d) Calculadora de ROI no meio da página**

Inputs:
- "Quantos pacientes você atende por mês?"
- "Quanto custa sua secretária hoje?" (default R$ 2200/mês)
- "Quantas mensagens você responde fora de horário comercial?"

Output em tempo real:
- "Você economiza R$ X/mês"
- "A Singulare se paga em Y semanas"
- "Em 12 meses, isso são R$ Z de economia direta"

Não tem que ser preciso — tem que ser plausível e mostrar magnitude. Conversão de 15-25% segundo benchmarks de calculadoras B2B (Cuvama, Mutiny).

**e) Demo / sandbox sem login**

Botão "Falar com a IA agora" que abre um chat in-page (não precisa do WhatsApp, faz no próprio site). Médico interage com a IA fingindo paciente:
- "Vocês atendem por convênio?"
- "Qual o valor da consulta?"
- "Tem horário amanhã?"

A IA responde no tom da Singulare. Mostra o produto antes do cadastro. Reduz o atrito mental do "será que isso funciona?" em 30-50%.

Tecnicamente: o motor de IA já existe pro produto. Só faz uma instância demo persistida em sessão de navegador.

**f) Pricing simples e visível**

Tabela 3 colunas: Starter, Professional, Enterprise. Cada uma com 5-7 bullets do que entrega. Toggle mensal/anual com desconto (10-15%).

Erro comum: esconder o preço atrás de "fale com vendas". Em B2B vertical pequeno (clínica solo), preço opaco trava decisão. Manter transparente, com "preço sob medida pra grupos +5 médicos" só pro Enterprise.

**g) FAQ no fim**

Diferente da `/bem-vindo` (que é pra cliente já dentro). Esta FAQ é pra dúvida pré-compra:
- "Vocês usam ChatGPT? É seguro?"
- "Meu paciente vai saber que tá falando com IA?"
- "E se a IA errar?"
- "Funciona sem trocar de número de WhatsApp?"
- "Posso cancelar quando quiser?"
- "Como funciona com convênio?"
- "Vocês têm certificação CFM/CRM?"

**h) CTA flutuante após 50% do scroll**

Botão que aparece quando o usuário passa metade da página, fixo no canto. "Começar grátis." Aumenta conversão 8-12%.

### 10.4. Aquisição paga — onde investir e onde não

**a) Google Ads (search) — provavelmente o melhor ROI inicial**

Palavras-chave alta intenção:
- "secretária remota WhatsApp"
- "agente IA para clínica"
- "marcar consulta WhatsApp automático"
- "chatbot médico"
- "agendamento WhatsApp paciente"

CPC estimado R$ 3-8 no nicho saúde. Com CTR ~4% e conversão 3% do clique, custa R$ 200-700 por lead qualificado. Se LTV de cliente Singulare é R$ 2000+ (12 meses ativo), CAC com Google Ads sustentável.

Erros comuns:
- Palavra muito genérica ("clínica online", "saúde digital") — caro e baixa intenção.
- Sem extensões de anúncio (sitelinks, callouts, structured snippets) — perde 15-25% de CTR.
- Sem landing dedicada por keyword — vai pra home e converte mal.

**b) Meta Ads (Instagram/Facebook) — bom pra brand awareness, ruim pra direct response**

Médicos consomem muito IG (Stories de aulas, casos, dicas). Mas a compra é racional, não impulsiva. Use Meta pra:
- Awareness (vídeo de 15s mostrando produto)
- Retargeting (pixel pega visitantes da landing, mostra anúncio de "voltar")
- Lookalike audience de clientes pagantes

Direct conversion no Meta pra B2B vertical fica caro. Não é onde começar.

**c) LinkedIn — só faz sentido pro Enterprise**

Donos de clínica grande, gestores hospitalares estão lá. CPC alto (R$ 15-30) mas conversão pra Enterprise compensa. Não invista até ter caixa pra testar.

**d) Influenciadores médicos**

Médicos com 10-50k seguidores no Instagram com perfil profissional (não lifestyle). Posts patrocinados ou afiliados (R$ 200/cadastro pago).

Cuidado: muitos médicos influenciadores são ruins em conversão direta. Funciona melhor com micro-influenciadores (5-20k) muito focados em gestão / produtividade.

**e) Podcasts e newsletters de nicho**

Ex.: Anestesia em Resumo, Pintando o 7 (humor médico), Conversas Médicas. Patrocínio menor (R$ 500-2000/episódio) mas público hiper-segmentado.

### 10.5. Marketplaces e canais alternativos

**a) Doctoralia, BoaConsulta**

Eles têm milhões de visitas/mês. Não dá pra vender Singulare lá diretamente, mas dá pra:
- Anunciar com banner / patrocínio editorial
- Parceria de integração ("Singulare se integra à sua agenda Doctoralia")
- Programa de afiliados

**b) Sociedades médicas regionais**

CRM-SP, CRO-SP, CFP, COFITO, COREN têm boletins, eventos, newsletters. Patrocínio ou parceria de benefício (CRMs frequentemente oferecem desconto pra associados em ferramentas).

**c) Faculdades de medicina / pós-graduação em gestão**

Workshops gratuitos pra estudantes do último ano (que abrem consultório em 1-2 anos). Plant seeds, colhe em 12-24 meses.

**d) Programa de indicação (referral)**

"Indique 1 médico que assina, ganhe 1 mês grátis. Indique 3, ganhe 1 ano." Auto-financiado (você dá 1 mês grátis, ganha 12 meses pagos). Tem que aparecer no painel pós-ativação, não escondido.

### 10.6. Retargeting e recuperação

**a) Email recovery do onboarding incompleto**

Hoje o draft fica em localStorage e some quando a aba fecha. Adicionar:
- Salvar email no momento que ele preencher (step 2)
- Cron diário: pra cada onboarding incompleto há +24h, mandar email "Você começou mas não terminou. Aqui está seu rascunho." Com link de continuação.

Conversão de 8-20% nessas recuperações segundo benchmarks Klaviyo.

**b) Pixel pra remarketing**

Meta Pixel + Google Tag Manager. Quem visitou /pricing ou /onboarding, vê anúncio depois mostrando que você lembrou dele.

**c) Lead magnet pra capturar antes da inscrição**

Material gratuito que pede só email: "Modelo grátis: 15 mensagens prontas pra WhatsApp da sua clínica." PDF. Cliente entrega o email mesmo sem se cadastrar — vira nurturing por sequência de email.

---

## 11. Negócio e viabilidade — análise profunda

### 11.1. Pricing — por que o atual provavelmente está errado

O pricing fixo R$ 197/mês tem problema clássico de SaaS B2B vertical:

**Para o solo (1 médico, 100 pacientes/mês):**
- R$ 197/mês = R$ 1,97 por paciente atendido
- IA economiza talvez ~5h/semana de secretária
- Custo de oportunidade real: R$ 600-1500/mês
- ROI: 3-7x. **Bom valor mas o ticket é alto pra quem está começando consultório.**

**Para clínica 5 médicos, 500 pacientes/mês:**
- R$ 197/mês = R$ 0,39 por paciente
- IA economiza 1-2 secretárias humanas
- Custo de oportunidade: R$ 4400-8800/mês
- ROI: 22-44x. **Singulare está deixando R$ 2000-6000/mês na mesa.**

**Para hospital pequeno 20+ médicos:**
- R$ 197/mês é simplesmente irrelevante.
- Eles esperariam pagar R$ 2000-5000/mês.
- Mas como o plano "sob medida" não tem nada explicado, viram lead morto.

**Solução: modelo híbrido base + uso (recomendado)**

| Plano | Base mensal | Inclui | Excedente |
|---|---|---|---|
| Starter | R$ 97 | 1 médico, 200 conversas/mês | R$ 0,50/conversa |
| Professional | R$ 297 | 5 médicos, 1000 conversas/mês | R$ 0,30/conversa |
| Enterprise | R$ 997+ | 20 médicos, conversas ilimitadas, dedicado | sob medida |

Por que isso funciona melhor:
- **Starter mais barato** baixa o atrito de entrada (catch-22: precisa de mais clientes pra ter dados, mas dado caro afasta cliente novo). R$ 97 é ponto psicológico — "preço de Netflix Premium pra empresa".
- **Cobra mais de quem usa mais** — clínica de 5 médicos paga 3x e está super satisfeita.
- **Captura valor de Enterprise** sem ter SDR humano vendendo (até R$ 997 self-service, acima disso pessoa).
- **Métricas alinham incentivo** — quanto mais conversas o cliente tem, mais ele paga, mais a IA precisa funcionar bem, mais você investe na IA.

**Add-on Atendimento Humano R$ 297 — precisa repensar margens**

Se um humano da Singulare atende 20-30 conversas/dia (~600/mês) e custa R$ 4000/mês ao contratante, cada conversa atendida custa R$ 6,67 ao operador. Cobrando R$ 297 por cliente pra atender "indefinido", a margem só fecha se o cliente médio escalar pouco (3-5 conversas/dia).

Sugestão: tornar o add-on por uso também. R$ 9 por escalação humana resolvida. Cliente sente que é controlável, Singulare protege margem.

### 11.2. Unit economics — cálculo de cabeça

Premissas estimadas:

| Métrica | Valor estimado |
|---|---|
| Plano Professional médio | R$ 197/mês |
| Ticket médio | R$ 250/mês (com add-ons) |
| Margem bruta | 75% (depois de hosting, APIs OpenAI, Evolution) |
| Receita mensal por cliente | R$ 187 |
| Churn mensal | 5-8% (estimativa SaaS B2B PME) |
| LTV (1/churn × ARPU × margem) | R$ 2300–3700 |
| CAC sustentável (1/3 do LTV) | R$ 770–1230 |

Implicações:
- **Pode investir até R$ 1000 por cliente novo** em marketing pago e ainda fechar conta.
- Google Ads bem otimizado deve ficar em R$ 200-400 por cliente pago. Sobra dinheiro pra outros canais.
- **Reduzir churn é mais alavancável que aumentar conversão.** De 8% pra 5% de churn mensal dobra o LTV. Cada melhoria de ativação (item 3 da auditoria principal) é gigante aqui.

### 11.3. Expansion revenue — land & expand vertical

Princípio: começar pequeno na clínica e crescer com ela.

**Land:** clínica solo entra no Starter R$ 97.

**Expand sequencial:**
1. **Mais médicos** — eles contratam, viram Professional automaticamente.
2. **Mais funcionalidades:**
   - Painel financeiro completo (substitui Conta Azul) — +R$ 80/mês
   - NF integrada com contador — +R$ 50/mês
   - Prontuário eletrônico (TISS, CFM-compliant) — +R$ 150/mês
   - Telemedicina (videoconsulta integrada) — +R$ 100/mês
   - Marketing automatizado (campanhas pra base) — +R$ 70/mês
3. **Mais especialidades** dentro da mesma clínica.
4. **Mais clínicas do mesmo dono** (grupo de clínicas) — desconto + multi-tenant.

ARPU pode crescer de R$ 97 (entrada) pra R$ 600-1500 (expandido) por cliente em 18-24 meses. Isso melhora drasticamente o LTV.

**Cuidado:** virar Frankenstein. Cada módulo precisa ser bom sozinho ou cliente comparativo com solução dedicada vai trocar. Foco no que IA potencializa especialmente bem (atendimento, cobrança, agendamento, marketing).

### 11.4. Plano "sob medida" / Enterprise — onde está o dinheiro grande

Hoje o plano sob medida quebra silenciosamente no onboarding (vimos isso: vira tenant com `is_sob_medida=true` e n8n pula provisionamento). Cliente fica como lead morto.

**Fluxo recomendado:**

1. Onboarding detecta "Clínica grande +5 profissionais" no step 2.
2. Step 5 mostra: "Pra clínicas do seu tamanho, fazemos uma proposta personalizada. Vamos marcar 30 min?"
3. Botão abre Calendly com agenda do time comercial.
4. Cliente agenda call.
5. Receba email pra você + admin com info da clínica.
6. Faz call de discovery (15 min), apresentação (10 min), pricing (5 min).
7. Pricing customizado por:
   - número de médicos
   - volume de conversas estimado
   - integrações específicas (TISS, prontuário existente)
   - SLA (uptime, suporte)
   - LGPD/segurança avançada (DPA, audit log)
8. Contrato anual com desconto (15-20%) e onboarding humano dedicado (1 semana).

Enterprise representa 10-20% dos clientes mas frequentemente 40-60% da receita. Não investir nesse canal é deixar dinheiro na mesa.

### 11.5. Posicionamento competitivo

**Quem é concorrente, na cabeça do cliente:**

| Categoria | Exemplos | O que oferece | Diferencial Singulare |
|---|---|---|---|
| Gestão de clínica | iClinic, ProDoctor, Carepass, Doctoralia | Agenda, prontuário, financeiro | Singulare = atendimento, não gestão; complementar |
| Marketplace | Doctoralia, BoaConsulta | Vitrine + agenda | Singulare = atende no SEU WhatsApp, não no marketplace; cliente fica SEU |
| WhatsApp Business | Meta WhatsApp Business API + Twilio | API ChatBot DIY | Singulare = pronto, vertical, sem dev |
| Chatbot genérico | Botpress, ManyChat, Take Blip | Plataforma horizontal | Singulare = especialista em saúde, com integrações específicas |
| AI assistente | Speak, Voiceflow, OpenAI Assistant | Plataforma DIY | Singulare = ready-to-use pro nicho |
| Secretária humana | — | Atendimento real | Singulare = 10x mais barato, 24/7, escala |
| Secretária terceirizada | Get a Secretary, telebooking | Humano remoto | Singulare = sem horário fixo, sem treinamento |

**Posicionamento sugerido:**

> *"Singulare é a secretária IA da sua clínica. Funciona dentro do seu WhatsApp atual, atende 24/7, marca consulta, cobra, organiza tudo. Você foca em cuidar do paciente."*

Em uma frase: **secretária digital especializada em saúde, no canal que o paciente já usa.**

Esse posicionamento:
- Bate o concorrente direto (secretária humana) no preço e escala
- Não compete com gestão (iClinic etc.) — complementar
- Não compete com marketplace (Doctoralia) — não tira o cliente da clínica
- Foca em uma coisa que faz bem (atendimento), não tenta ser tudo

### 11.6. Riscos do modelo

**a) Meta proíbe WhatsApp Business via Evolution / Baileys (não oficial)**

Risco real. Meta tem feito ondas de banimentos em massa de números que rodam fora da API oficial. O risco depende:
- Volume de mensagens (alto volume = mais visível)
- Comportamento (mensagens em massa, mass marketing = alto risco; atendimento responsivo = baixo)
- Reputação do número (chip novo = mais risco; chip antigo = menos)

Mitigação:
- Suportar WhatsApp Business Cloud API oficial como opção (Meta + Twilio/Gupshup) — custa R$ 0,05-0,15 por conversa, repassa pro cliente.
- Documentar boas práticas pros clientes (não fazer broadcast, não mandar promoções massivas).
- Ter um "plano B" se Meta cortar: Telegram, SMS, app próprio. O bot link já é gerado, é uma fallback parcial.

**b) Regulação de IA em saúde**

CFM (Conselho Federal de Medicina) já se manifestou sobre uso de IA. Risco principal: se a IA der orientação que pareça diagnóstico/conselho médico, pode haver problema regulatório.

Mitigação:
- Prompt master deixa claro: "Não dou diagnóstico. Sempre encaminho ao médico."
- Disclaimer visível em cada conversa (primeira mensagem do bot): "Sou assistente do consultório. Para qualquer questão médica, vou agendar com o doutor."
- Auditoria periódica de conversas pra detectar drift do tom.

**c) Concorrentes copiando rapidamente**

Stack envolve OpenAI + WhatsApp + DB + agenda. Não é defensável tecnicamente. Defensabilidade vem de:
- Velocidade de iteração e foco vertical (saúde Brasil)
- Marca + relacionamento com sociedades médicas
- Dados (quanto mais clientes, melhor a IA fica no nicho específico)
- Integrações (NF com contadores brasileiros, TISS, Asaas, etc.)

Trabalhar nessas dimensões desde o início. Não esperar competidor aparecer.

**d) Dependência de fornecedores**

- Evolution / Baileys (WhatsApp não-oficial)
- Asaas (pagamento)
- OpenAI / Anthropic (IA)
- Chatwoot (CRM/handoff)
- Supabase (DB)
- Vercel (hosting)

Cada um é ponto único de falha. Mitigações:
- Camada de abstração (lib) pra que troca seja viável (Evolution → API oficial; Asaas → Iugu/MercadoPago).
- Backup periódico do DB pra storage independente.
- Monitorar SLA dos fornecedores; ter plano B documentado.

### 11.7. Métricas que importam

A North Star (única métrica que importa acima de tudo): **conversas resolvidas pela IA por mês** (em vez de "MRR" ou "clientes ativos"). Por quê:

- Mede o valor real entregue, não o pagamento.
- Cliente que paga e não usa vai churnar.
- Cliente que tem muitas conversas resolvidas vê valor concreto.
- Alinha incentivo (vocês investem em melhorar a IA, não em vender pra qualquer um).

Métricas secundárias:

| Categoria | Métrica | Target inicial |
|---|---|---|
| Aquisição | Visitas/mês | 5k → 20k em 12 meses |
| Conversão | Visit → trial | 2-4% |
| Ativação | Trial → ativo (WA conectado + 1ª conversa) | 60% |
| Retenção | Ativo D+30 | 80% |
| Retenção | Ativo D+90 | 65% |
| Engagement | Conversas/cliente/mês | 200+ |
| Receita | MRR | R$ 30k em 6 meses |
| Receita | ARPU | R$ 250+ |
| Churn | Churn mensal | <6% |
| Expansão | Net Dollar Retention | 105%+ |
| NPS | NPS médio | 40+ |

Instrumentar agora com Posthog ou Mixpanel, mesmo que com 10 usuários. Custa R$ 0 no início, vira ouro pra decisão.

### 11.8. Onde colocar foco nos próximos 90 dias

Se Singulare tem 1 fundador + 1 engenheiro + caixa apertado (cenário típico), priorização brutal:

**Mês 1 — fundação de ativação e dados**
- Checklist de ativação no painel
- Modo sandbox (testar com paciente fake)
- Sentry + Posthog instalados
- Email D+5 com métricas
- Calendly pra Enterprise no onboarding sob medida

**Mês 2 — começar a aquisição com baixo custo**
- Páginas SEO programáticas (10 especialidades × 5 cidades = 50 páginas)
- Blog editorial (4 posts publicados)
- Google Ads piloto com R$ 1500/mês em 5 keywords
- Programa de indicação rolando

**Mês 3 — pricing novo + Enterprise**
- Migração pra modelo híbrido base+uso
- Plano Enterprise estruturado (deck, Calendly, contrato modelo)
- Status page + transparência operacional
- Primeira parceria com sociedade médica regional

Se três meses fluirem bem, no quarto mês começa expansão de produto (NF integrada, prontuário, telemedicina) pra subir ARPU.

---

## Resumo prático

**Item 10 — Aquisição:** o trio que mais multiplica em 90 dias é (a) SEO programático por especialidade x cidade, (b) calculadora de ROI + demo sandbox na landing, (c) Google Ads cirúrgico em 5-10 keywords de alta intenção. Conteúdo orgânico (blog) é fundo de funil que rende daqui 6 meses — começar agora.

**Item 11 — Negócio:** pricing fixo R$ 197 está perdendo dinheiro na clínica grande e travando entrada da clínica pequena. Mover pra híbrido base + uso com 3 planos (R$ 97, R$ 297, R$ 997+). Plano Enterprise tem que ter fluxo humano explícito (Calendly + call). Foco nos primeiros 12 meses: reduzir churn (alavanca maior que conversão) e aumentar ARPU via expansion sequencial (mais médicos → mais módulos → mais clínicas do mesmo dono).

— Análise complementar Singulare audit
