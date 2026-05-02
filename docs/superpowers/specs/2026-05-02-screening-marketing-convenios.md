# Screening: Marketing & Convênios — Viabilidade Técnica

> Documento de referência para decisões de produto. Gerado em 2026-05-02.

---

## Contexto

Singulare precisa de 2 pacotes add-on além do core (IA no WhatsApp):
1. **Singulare Marketing** — presença digital automatizada
2. **Singulare Convênios** — automação de guias TISS + documentos médicos

Este screening mapeia o que é automatizável via API, o que é semi-automático (formulário pré-preenchido), e o que é inevitavelmente manual.

---

## 1. MARKETING & PRESENÇA ONLINE

### Screening por canal

| Canal | Viabilidade | Mecanismo | Dependência Externa | Status |
|-------|------------|-----------|-------------------|--------|
| Instagram auto-post | ✅ API | Instagram Graph API — fotos, carrosséis, Reels, Stories | Meta App Review (~2-4 sem) | ⬜ Pendente |
| Facebook auto-post | ✅ API | Meta Graph API (espelha Instagram) | Mesmo approval acima | ⬜ Pendente |
| Google Business Profile posts | ✅ API | GBP API — updates, ofertas, eventos | Conta GBP verificada | ⬜ Pendente |
| Google Reviews | ⚠️ Redirect only | API é read-only. NPS 9-10 → WhatsApp link → paciente escreve | Nenhuma (Baileys) | ⬜ Pendente |
| SEO / Vitrine | ✅ Código próprio | Next.js SSR, JSON-LD, sitemap dinâmico | Nenhuma | ⬜ Pendente |
| Google Ads | ✅ API | MCC + Google Ads API — criar/pausar/reativar campanhas | Google Ads API Standard Access | ⬜ Pendente |
| NPS → Review redirect | ✅ Automático | N8N workflow existente + Baileys | Nenhuma | ⬜ Pendente |
| Recall inativos | ✅ Automático | N8N cron semanal + Baileys | Nenhuma | ⬜ Pendente |

### Referências técnicas
- N8N template Instagram/Facebook auto-post: https://n8n.io/workflows/5457
- Instagram Graph API docs: https://developers.facebook.com/docs/instagram-platform/content-publishing/
- Google Business Profile API: https://developers.google.com/my-business
- API TISS (tissxml.com.br): https://www.tissxml.com.br/api-tiss

### Proposta de valor
> "Sua presença digital no piloto automático — sem abrir app, sem postar nada, sem pensar em marketing."

---

## 2. CONVÊNIOS & DOCUMENTOS MÉDICOS

### 2A. Faturamento TISS (guias de convênio)

| Etapa | Viabilidade | Mecanismo | Realidade |
|-------|------------|-----------|-----------|
| Preencher guia TISS | ✅ Automação | Dados paciente + procedimento + TUSS → XML | API tissxml.com.br gera/valida TISS 4.02/4.03 |
| Validar XML | ✅ API | Validação contra schemas ANS + regras por operadora | Serviço pronto |
| Enviar para operadora | ❌ Portal-a-portal | Cada operadora tem portal próprio. Sem API universal | Mesmo que iClinic/Feegow/Ninsaúde |
| Acompanhar pagamento | ❌ Manual | Dashboard de cada operadora | Processo humano |
| Contestar glosa | ❌ Manual | Portal individual | Processo humano |

**Resultado:** Automatiza geração + validação (de 15min → 30seg por guia). Submissão = profissional faz upload do XML.

### 2B. Documentos médicos específicos (formulários pré-preenchidos)

| Documento | Descrição | Automação possível |
|-----------|-----------|-------------------|
| Aptidão física para atividade | Atestado de que paciente pode praticar atividade física | ✅ Pré-preenchido com dados do paciente + template por tipo de atividade |
| Relatório para vacina preferencial | Justificativa clínica para vacinação prioritária (comorbidades) | ✅ Pré-preenchido com CID + dados paciente + texto-padrão por condição |
| Relatório afastamento INSS | Laudo médico para perícia INSS (auxílio-doença, etc.) | ✅ Pré-preenchido com CID + histórico + template INSS |
| Pedido/justificativa alto custo | Solicitação de medicamento de alto custo ao SUS ou operadora | ✅ Pré-preenchido com CID + medicamento + justificativa clínica padronizada |

### Proposta de valor
> "A guia que levava 15 minutos sai em 30 segundos. Documentos pré-preenchidos com dados do paciente. Você só revisa e assina."

---

## 3. DADOS DE MERCADO (referência)

### Burnout administrativo
- 49% do dia do médico = tarefas administrativas (prontuários, guias, atestados)
- 62% dos médicos brasileiros com sintomas de burnout (Afya, 2022)
- 500 mil afastamentos por saúde mental em 2024 — recorde em 10 anos (Min. Previdência)
- Tarefas administrativas = fator #1 ou #2 de burnout (Medscape Brazil)

### No-show e automação
- 20-30% de no-show sem automação no Brasil
- Lembretes automáticos reduzem faltas em 30-50%
- ROI de 300-500% em AI scheduling (Medozai)

### Google Reviews
- 72-84% dos pacientes consultam reviews antes de escolher profissional
- Práticas com nota alta faturam 37% mais
- 83% exigem mínimo 4 estrelas

### Instagram para profissionais de saúde
- 84% pesquisam Instagram antes de escolher serviço (IPSOS)
- Conflito ético real: conteúdo que atrai (antes/depois) é proibido pelo CFO
- Profissionais não sabem fazer marketing dentro das regras

---

## 4. MAPA VISUAL

```
TOTALMENTE AUTOMÁTICO (API)          SEMI-AUTOMÁTICO (pré-preenchido)       MANUAL (inevitável)
─────────────────────────            ─────────────────────────────          ──────────────────
✅ Instagram auto-post               ⚠️ Guia TISS (gera XML, upload manual) ❌ Enviar lote portal
✅ Facebook auto-post                ⚠️ Aptidão física (template + dados)   ❌ Acompanhar glosas
✅ Google Business posts             ⚠️ Relatório vacina (template + CID)   ❌ Contestar glosas
✅ Google Ads campaigns              ⚠️ Afastamento INSS (template + hist.) ❌ Perícia INSS
✅ SEO / Vitrine pages               ⚠️ Alto custo (template + justif.)
✅ NPS → Review redirect             ⚠️ Google Review (redirect, paciente
✅ Recall inativos                       decide)
✅ Confirmação agenda
✅ NFS-e automática
```

---

## 5. DOCUMENTOS MÉDICOS — ESPECIFICAÇÃO DETALHADA

### 5A. Atestado de Aptidão Física para Atividade

**O que é:** Documento que atesta que o paciente está apto para praticar atividade física/esportiva.

**Quem solicita:** Academias, clubes, competições esportivas, concursos públicos (TAF).

**Campos obrigatórios:**
| Campo | Fonte do dado | Auto-preenchível? |
|-------|--------------|-------------------|
| Nome completo do paciente | Cadastro paciente | ✅ |
| CPF | Cadastro paciente | ✅ |
| Data de nascimento | Cadastro paciente | ✅ |
| Resultado da avaliação (apto/inapto/restrições) | Médico decide | ❌ (input médico) |
| Tipo de atividade autorizada | Médico decide | ⚠️ (dropdown com opções comuns) |
| Restrições (se houver) | Médico decide | ❌ (texto livre) |
| CRM + assinatura do médico | Cadastro profissional | ✅ |
| Data de emissão | Automático | ✅ |
| Validade (geralmente 12 meses) | Default 12 meses | ✅ |

**Automação:** ~70% pré-preenchido. Médico só precisa: marcar apto/inapto, selecionar tipo de atividade, adicionar restrições se houver, assinar.

**Referências:**
- [Modelo COLUNI/UFV](https://coluni.ufv.br/wp-content/uploads/2023/11/Modelo-de-Atestado-Medico-2024.pdf)
- [Modelo Governo PR](https://www.seguranca.pr.gov.br/sites/default/arquivos_restritos/files/documento/2019-11/guia_modelo_de_atestado_de_saude.pdf)

---

### 5B. Relatório para Vacinação Prioritária (CRIE / Comorbidades)

**O que é:** Relatório médico que justifica vacinação prioritária para paciente com comorbidade, encaminhando ao CRIE (Centro de Referência para Imunobiológicos Especiais) ou posto de vacinação.

**Quem solicita:** SUS / Secretaria de Saúde para campanhas (gripe, COVID, imunobiológicos especiais).

**Campos obrigatórios:**
| Campo | Fonte do dado | Auto-preenchível? |
|-------|--------------|-------------------|
| Nome completo do paciente | Cadastro paciente | ✅ |
| Data de nascimento | Cadastro paciente | ✅ |
| CPF / CNS (Cartão SUS) | Cadastro paciente | ✅ |
| CID-10 da comorbidade | Prontuário / CID selecionado | ⚠️ (dropdown CID) |
| Descrição da condição clínica | Texto-padrão por CID | ⚠️ (template por comorbidade) |
| Imunobiológico indicado | Médico decide | ⚠️ (dropdown vacinas) |
| Justificativa clínica | Template + CID → texto-padrão | ⚠️ (gerado por IA, médico revisa) |
| CRM + assinatura | Cadastro profissional | ✅ |
| Data de emissão | Automático | ✅ |
| Validade | Geralmente 12 meses | ✅ |

**Automação:** ~75% pré-preenchido. O diferencial é: ao selecionar o CID, o sistema já sugere a justificativa clínica padrão para aquela comorbidade. Médico revisa e assina.

**Referências:**
- [Manual CRIE - Ministério da Saúde (5ª ed.)](https://bvsms.saude.gov.br/bvs/publicacoes/manual_centros_imunobiologicos_especiais_5ed.pdf)
- [Formulário comorbidades - Goiânia](https://saude.goiania.go.gov.br/goiania-contra-o-coronavirus/formulario-para-vacinacao-do-grupo-das-comorbidades/)

---

### 5C. Relatório para Afastamento INSS (Auxílio-doença / Incapacidade)

**O que é:** Laudo médico detalhado para perícia INSS, solicitando benefício por incapacidade temporária ou permanente.

**Regulação:** Resolução CFM nº 2.381/2024 (normatiza emissão de documentos médicos). Atestmed (sistema digital INSS) aceita atestado digital.

**Campos obrigatórios:**
| Campo | Fonte do dado | Auto-preenchível? |
|-------|--------------|-------------------|
| Nome completo do paciente | Cadastro paciente | ✅ |
| CPF | Cadastro paciente | ✅ |
| Data de nascimento | Cadastro paciente | ✅ |
| Endereço | Cadastro paciente | ✅ |
| CID-10 (diagnóstico) | Prontuário | ⚠️ (dropdown CID) |
| Anamnese / histórico clínico | Prontuário + consultas anteriores | ⚠️ (compilado automático de prontuário) |
| Exames complementares realizados | Prontuário | ⚠️ (lista de exames do paciente) |
| Diagnóstico detalhado | Médico escreve | ❌ (texto livre, mas com template) |
| Limitações funcionais | Médico escreve | ⚠️ (sugestões por CID) |
| Tempo de afastamento recomendado (dias) | Médico decide | ❌ (input numérico) |
| Prognóstico | Médico decide | ⚠️ (opções: favorável/reservado/desfavorável) |
| CRM + assinatura + carimbo | Cadastro profissional | ✅ |
| Data de emissão | Automático | ✅ |

**Automação:** ~60% pré-preenchido. O grande ganho é: o sistema puxa automaticamente o histórico de consultas do paciente e compila uma anamnese resumida. Médico só ajusta o texto e define dias de afastamento.

**Detalhe importante:** O Atestmed (INSS digital) aceita PDF ou foto do laudo. Possibilidade futura: gerar PDF assinado digitalmente e o paciente envia pelo Meu INSS.

**Referências:**
- [Versatilis — Como fazer relatório INSS](https://versatilis.com.br/relatorio-medico-para-inss/)
- [MeuTudo — Campos do laudo](https://meutudo.com.br/blog/auxilio-doenca-laudo-medico/)
- [INSS — Atestmed passo a passo](https://www.gov.br/inss/pt-br/noticias/precisa-fazer-pericia-medica-confira-o-passo-a-passo-do-atestmed)
- [Protocolo Laudo Pericial Previdenciário](https://www.perspectivas.med.br/2025/05/protocolo-para-elaboracao-de-laudo-medico-pericial-previdenciario-no-requerimentode-beneficio-por-incapacidade/)

---

### 5D. Pedido e Justificativa para Medicamento de Alto Custo (LME)

**O que é:** Laudo de Solicitação, Avaliação e Autorização de Medicamento (LME) — formulário oficial do Ministério da Saúde para solicitar medicamentos do Componente Especializado da Assistência Farmacêutica (CEAF).

**Complexidade:** ALTA — formulário oficial com 21+ campos, varia por estado, validade de 90 dias.

**Campos obrigatórios (os 17 do médico):**
| Campo | Fonte do dado | Auto-preenchível? |
|-------|--------------|-------------------|
| CNES do estabelecimento | Cadastro clínica | ✅ |
| Nome completo do paciente | Cadastro paciente | ✅ |
| Nome da mãe | Cadastro paciente | ⚠️ (precisa estar no cadastro) |
| Peso (kg) | Prontuário/última consulta | ⚠️ |
| Altura (cm) | Prontuário/última consulta | ⚠️ |
| Medicamento(s) solicitado(s) | Médico seleciona | ⚠️ (tabela SIGTAP/SUS) |
| Quantidade mensal | Cálculo por posologia | ⚠️ (auto-calcula se posologia informada) |
| CID-10 | Prontuário | ⚠️ (dropdown CID) |
| Diagnóstico | Texto livre | ⚠️ (template por CID) |
| Anamnese completa | Prontuário | ⚠️ (compilado automático) |
| Tratamentos anteriores | Prontuário | ⚠️ (histórico de prescrições) |
| Justificativa para o medicamento | Médico + template | ⚠️ (IA gera draft por PCDT) |
| CRM + assinatura | Cadastro profissional | ✅ |
| Data | Automático | ✅ |
| CPF ou CNS do paciente | Cadastro paciente | ✅ |
| Telefone do paciente | Cadastro paciente | ✅ |

**Automação:** ~65% pré-preenchido. O diferencial killer: ao selecionar CID + medicamento, o sistema consulta o PCDT (Protocolo Clínico e Diretrizes Terapêuticas) e gera automaticamente a justificativa dentro do protocolo oficial — o principal motivo de indeferimento é justificativa fora do PCDT.

**Variação por estado:** O formulário LME é federal (Ministério da Saúde), mas cada estado tem processos diferentes de entrega. SP tem sistema online, outros só físico.

**Referências:**
- [LME — Ministério da Saúde (PDF oficial)](https://www.gov.br/saude/pt-br/composicao/sectics/daf/publicacoes/lme.pdf/view)
- [Documentos CEAF — DF](https://www.saude.df.gov.br/protocolos-clinicos-ter-resumos-e-formularios)
- [LME — Secretaria Saúde SP](https://saude.sp.gov.br/ses/perfil/gestor/assistencia-farmaceutica/medicamentos-dos-componentes-da-assistencia-farmaceutica/medicamentos-do-componente-especializado-da-assistencia-farmaceutica/laudo-de-solicitacao-avaliacao-e-autorizacao-de-medicamento-do-componente-especializado-da-assistencia-farmaceutica-lme)
- [LME Bahia (modelo semestral)](https://www.saude.ba.gov.br/wp-content/uploads/2022/07/LME-SEMESTRAL-frente-e-verso.pdf)

---

## 6. RESUMO: NÍVEL DE AUTOMAÇÃO POR DOCUMENTO

| Documento | % Auto-preenchível | Input do médico | Tempo manual atual | Tempo com Singulare |
|-----------|-------------------|-----------------|-------------------|-------------------|
| Guia TISS (convênio) | ~85% | Revisar + upload portal | ~15 min | ~30 seg + upload |
| Aptidão física | ~70% | Apto/inapto + restrições | ~8 min | ~1 min |
| Vacina prioritária | ~75% | Confirmar CID + assinar | ~10 min | ~1 min |
| Afastamento INSS | ~60% | Ajustar anamnese + dias | ~20-30 min | ~5 min |
| LME alto custo | ~65% | Revisar justificativa + assinar | ~25-40 min | ~5-8 min |

**Economia total estimada por profissional:** 50-80 min/dia em documentos burocráticos → 10-15 min/dia.

---

## 7. DECISÃO DE PRIORIDADE

**INICIAR AMBOS EM PARALELO:**

### Trilha A — Convênios & Documentos (PRIORIDADE OPERACIONAL FULL)
1. Guias TISS (geração XML + validação)
2. Atestado aptidão física (mais simples, quick win)
3. Relatório vacina prioritária
4. Relatório afastamento INSS
5. LME alto custo (mais complexo, última)

### Trilha B — Marketing & Presença Digital
1. Vitrine SEO (zero dependência)
2. NPS → Google Review redirect
3. Recall inativos
4. Instagram/Facebook auto-post (após Meta App Review)
5. Google Ads (após API approval)

---

## 8. OPEN QUESTIONS

- [ ] Validar com 5 profissionais: quais dos 5 documentos são mais frequentes no dia a dia?
- [ ] API tissxml.com.br: pricing, limites, SLA — ou gerar XML internamente com lib?
- [ ] Templates de documentos: precisam de revisão por advogado de saúde?
- [ ] CFM Resolução 2.381/2024: quais impactos nos templates de documentos digitais?
- [ ] LME: tabela SIGTAP/SUS disponível em API ou precisa importar manualmente?
- [ ] PCDT (Protocolos Clínicos): disponíveis em formato estruturado ou só PDF?
- [ ] Assinatura digital: ICP-Brasil obrigatória ou aceita assinatura simples?
- [ ] Atestmed INSS: aceita PDF gerado por sistema terceiro?
- [ ] Nome da mãe do paciente: já é coletado no cadastro? (necessário para LME)
- [ ] Meta App Review: submeter ASAP (2-4 semanas de espera)
- [ ] Google Ads API: submeter ASAP (semanas de espera)
