# Problem Map: Escalar setup pra clínicas com 5+ médicos

**Data:** 2026-05-01
**Modo:** Solo (rascunho Claude, validar com Luiz)
**Origem:** Conversa após implementar `has_doctors_configured` checklist + badge ⚠ no card

---

## 1. Problem Statement

> Cadastrar e configurar 5+ médicos num único fluxo de onboarding é maçante e gera abandono — mas pular esse setup deixa o agente IA sem dados pra cotar consulta, responder horário e marcar agendamento corretamente. Precisamos de um caminho que aceite **"setup mínimo no onboarding + ajuste fino depois no painel"** sem perder qualidade do agente.

---

## 2. Users / Stakeholders

**Primary:**
- **Owner/Médica principal** (Dra. Paula): faz onboarding, paga, opera. Tem pressa.
- **Sócios/médicos da clínica** (Dr. Henrique etc): têm valores/horários/convênios diferentes. Querem entrar com seus próprios dados sem depender da Paula.
- **Recepcionista** (futuro): pode acabar fazendo o setup por conta da Dra.

**Stakeholders:**
- **Pacientes**: dependem do agente acertar valor/horário pra confiar
- **Agente IA Master Secretária**: precisa de dados completos pra não inventar
- **Equipe Singulare comercial**: vê abandono no funil

---

## 3. Success Criteria

1. Onboarding leva **≤ 7 min** mesmo com clínica de 5 médicos (hoje 1 médico já leva ~5min, escala linear quebraria UX)
2. **>80%** das clínicas de >1 médico chegam a "todos médicos configurados" no painel em **≤ 7 dias** após onboarding
3. Agente IA **nunca cota valor errado nem inventa horário** — ou tem o dado, ou diz "vou consultar e te aviso"
4. Sem regressão: clínica de 1 médico (caso Paula) continua tendo onboarding rápido como hoje

---

## 4. Constraints

**Time:** Solo dev (Luiz). Cada feature compete com NPS, confirmação, agenda, Chatwoot embed
**Resources:** Supabase free tier (sem read-replica), N8N self-hosted, Vercel hobby
**Technical:**
- `tenant_doctors` schema já tem todos campos (consultation_value, working_hours, payment_methods, address, contact_*)
- `rendered_prompt` é gerado por trigger PG (`fn_rebuild_tenant_prompt`) — limita formato
- N8N agent usa `rendered_prompt` direto no system message (sem tool de lookup ainda)
- Gemini Flash tem limite generoso de contexto, mas custo escala linear com tokens
**Business:**
- Onboarding = primeiro contato com produto. Atrito alto = perde lead
- Plano "Sob Medida" (large_clinic) já pula provisionamento — modelo aplicável

---

## 5. Assumptions (NÃO validadas — precisa testar)

- [ ] Owner/Dra **quer mesmo** preencher dados detalhados de outros médicos? Talvez o melhor fosse o próprio médico secundário receber convite por email e preencher seu cadastro
- [ ] Agente IA com placeholders ("Não sei o valor exato, vou consultar") é aceitável pro paciente? Ou ele precisa SEMPRE saber?
- [ ] Médicos da mesma clínica costumam ter **valores/horários muito parecidos** ou totalmente diferentes? Se parecidos, "copiar do médico anterior" + ajustar é o atalho ouro
- [ ] Self-service de cada médico exige login deles. Eles topam? (vs Dra preenchendo por todos)
- [ ] Quanto da info por médico **é estável** (valor, horário) vs **muda toda hora** (convênios atualizam)?

---

## 6. Pain Points

**Onboarding:**
- Form linear força preencher tudo de TODOS antes de finalizar
- Sem "pular agora" granular por seção do médico (só skip de step inteiro)
- Sem clone/template (médicos parecidos = retrabalho)

**Painel pós-onboarding:**
- Hoje resolvido em parte: badge ⚠ + checklist mostra pendência (commit `662615a`)
- Falta: convite por email pra médico secundário preencher próprio cadastro
- Falta: bulk actions (definir valor padrão pra todos, etc)

**Agente IA:**
- Se `consultation_value=null`, agente pode inventar (Gemini tende a "alucinar" números plausíveis)
- `rendered_prompt` lista TODOS médicos sempre, mesmo quando paciente pergunta de UM
- Token cost escala linear com nº médicos × nº mensagens

---

## 7. Open Questions (validar antes de implementar)

1. **Quantas clínicas reais terão 5+ médicos?** Se for <10% da base, otimizar é prematuro
2. **Caminho de convite** existe hoje? (`/painel/equipe` parece ter, mas é pra membros não-médicos?)
3. **Qual a UX preferida da Paula** — ela própria configurar todos OU mandar convite?
4. **Agente atual lida bem com "Não tenho essa info, te aviso"?** ou regride pra inventar?

---

## 8. Caminhos candidatos (NÃO decidir ainda — só listar)

### Path A — Onboarding mínimo + bulk no painel
- Onboarding: só pede dados do médico principal + nº de outros médicos
- Pós-onboarding: tela `/painel/profissionais` com **bulk add** (5 cards minimalistas em grid)
- Cada card: nome + especialidade obrigatórios, resto auto-preenche com defaults da Dra principal
- Edição fina: clica no card, modal com tudo

### Path B — Onboarding 1 médico + convite por email
- Onboarding só do principal
- Tela "Convidar médicos" no painel manda magic link pra cada um
- Cada médico recebe form pessoal pra preencher só seus próprios dados
- Vantagem: descentralizado. Desvantagem: depende dos médicos topar

### Path C — Template de médico (clone)
- Cadastra 1º médico no onboarding
- Pra próximos: botão "Duplicar médico anterior + ajustar"
- Mantém valores/horários/convênios do anterior, só muda nome/especialidade
- Híbrido com A: bulk add usando o anterior como template

### Path D — Agente IA tolerante a falta de dado
- Mantém onboarding atual
- Refatora prompt do agente: quando falta `consultation_value`, sempre responde "Vou consultar com a Dra e já te aviso"
- Adiciona tool `notify_doctor_of_question` que cria task no painel
- Vantagem: zero atrito no setup. Desvantagem: pior UX paciente

---

## Next Steps (recomendação Claude)

1. **Validar assumptions** com user real (Dra Paula): conversa de 15min sobre UX preferida
2. Se >50% das clínicas tem >1 médico → priorizar **Path C (template)** + UI bulk
3. Se modelo é Owner-driven → **Path A** + skills granulares no agente (Path D parcial)
4. Se modelo é descentralizado → **Path B** + integração com auth bypass
5. **Decisão:** quando rolar, abrir doc `docs/PLAN-multi-doctor-implementation.md`
