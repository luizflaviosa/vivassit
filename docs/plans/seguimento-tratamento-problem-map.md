# Problem Map — Modulo Seguimento de Tratamento

**Data:** 2026-05-10
**Modo:** Solo
**Participante:** Luiz Flavio
**Status:** Problem mapping concluido; compatibilizado com Telemonitoramento Passivo; HMW em andamento
**Piloto:** Cardiologia (1 medico parceiro, 30-50 pacientes, 90 dias)
**Projeto paralelo (dependencia):** [docs/superpowers/plans/2026-05-10-telemonitoramento-cardiologico.md](../superpowers/plans/2026-05-10-telemonitoramento-cardiologico.md) — worktree `mobile-cardio`, branch `feat/mobile-cardio`

---

## Problem Statement

Entre uma consulta e o retorno (90+ dias), a clinica perde visibilidade do que o paciente esta fazendo: se tomou medicacao, se aderiu ao protocolo, se piorou. O medico volta a ver o paciente sem dados longitudinais; o paciente abandona o tratamento sem ninguem saber; a operadora (quando aplicavel) so descobre a descompensacao na internacao.

O Singulare quer fechar esse loop com **duas pontas convergentes em uma so camada de dados**:
- **Coleta passiva** (projeto paralelo): app Flutter -> Apple Health / Health Connect -> `health_observations` (FC, HRV, passos, sono, PA via device Bluetooth)
- **Coleta ativa** (este modulo): agente IA no WhatsApp (P03) -> `health_observations` com `device_provenance.source='whatsapp_active'` (adesao MMAS-8, sintomas livres, KCCQ, satisfacao — o que so o paciente sabe)

A entrega de valor pro medico = **briefing pre-retorno em PDF que funde as duas fontes**, gerado automaticamente antes da consulta agendada.

---

## Compatibilizacao com Telemonitoramento Passivo (paralelo)

A peca passiva ja resolve infraestrutura critica que NAO precisamos reinventar:

| Capacidade | Onde mora | Quem entrega |
|---|---|---|
| Auth do paciente (phone OTP) | Edge fn `link-patient` + `patients.auth_user_id` | Telemonitoramento |
| Consentimento LGPD granular | `patient_consents` (consent_type: health_monitoring, data_sharing_clinic, ai_inference) | Telemonitoramento |
| Tabela serie temporal clinica | `health_observations` (FHIR/LOINC, RLS, BRIN, dedup) | Telemonitoramento |
| Pipeline outlier + quality tag | Edge fn `ingest-vitals` + `PHYSIOLOGICAL_RANGES` em LOINC | Telemonitoramento |
| Devices Bluetooth (Kardia, oximetro, balanca) | Apple Health / Health Connect (passa automatico pro `ingest-vitals`) | Telemonitoramento |
| LOINC subset cardiologico | HR `8867-4`, HRV-SDNN `80404-7`, steps `55423-8`, sleep `93832-4`, SBP `8480-6`, DBP `8462-4`, SpO2 `59408-5`, temp `8310-5` | Telemonitoramento |

### O que este modulo (seguimento) adiciona

| Capacidade | Onde mora | Decisao |
|---|---|---|
| Coleta ativa (perguntas via WhatsApp) | N8N P03 dispara perguntas semanais por protocolo | Novo |
| Schema de protocolo por especialidade | Tabela nova `treatment_protocols` + `patient_protocols` (qual paciente segue qual protocolo) | Novo |
| Grava resposta ativa | Edge fn nova `ingest-active-survey` ou expandir `ingest-vitals` com `category='survey'` ou `category='patient-reported'` | A decidir |
| Briefing PDF pre-retorno | Edge fn `generate-briefing` consome `health_observations` (ativo + passivo) e renderiza PDF | Novo |
| Alerta critico unificado | Edge fn `trigger-alert` chamada por triggers em `health_observations` quando flag critica (passivo: FC>120 sustentado, SBP>180; ativo: sintoma critico) | Novo |
| Dedup ativo-passivo | Logica no P03 antes de perguntar: "se app sincronizou passos da semana, nao pergunto sobre atividade fisica autorrelatada" | Novo |

### Decisoes de compatibilizacao a tomar (proximos passos antes de codar)

1. **Categoria FHIR pra coleta ativa**: expandir `health_observations.category` CHECK pra incluir `'patient-reported'` ou `'survey'`. Vou propor migration de extensao quando saimos do problem map.
2. **`consent_type` novo**: adicionar `'whatsapp_active_collection'` em `patient_consents`, OU usar `'health_monitoring'` guarda-chuva. Recomendado: granular pra LGPD limpa.
3. **LOINC novos pra ativos**: MMAS-8 nao tem LOINC oficial — usar code custom `singulare:mmas8` ou LOINC `71799-1` (Adherence). Mapear no `loinc.ts` do projeto paralelo (a coordenar).
4. **Dependencia de ordem**: este modulo NAO pode merge antes da peca `mobile-cardio` ter `health_observations` + `patient_consents` aplicados. Coordenar.
5. **Pacientes sem app mobile**: a maioria nao vai instalar Flutter. Modulo seguimento precisa funcionar **so com coleta ativa** (WhatsApp), e ganhar precisao quando passivo existe. Nao bloquear MVP por instalacao de app.

---

## Usuarios e Stakeholders

| # | Persona | Funcao | Pagador? |
|---|---|---|---|
| 1 | Dono/gestor da clinica | Decide compra; ve dashboard agregado | Sim |
| 2 | Medico (cardio piloto) | Configura protocolo; le briefing pre-retorno; recebe alerta critico | Influencia |
| 3 | Paciente | Recebe e responde WhatsApp; opcionalmente instala app mobile pra coleta passiva | Nao |
| 4 | Secretaria/equipe | Recebe escalonamento humano via Chatwoot | Nao |
| 5 | Operadora | Stakeholder secundario; rota B2B2B fase 2 | Potencial |

Medico parceiro do piloto = dono/socio da clinica (assumido).

Paciente vem em 2 sabores:
- **Paciente app-on**: instalou Flutter, autorizou Apple Health/Health Connect, dado passivo flui
- **Paciente WhatsApp-only**: nao instalou, so responde WhatsApp; precisa funcionar bem mesmo assim

---

## Sucesso

### Camada paciente/clinica
- Taxa de retorno em 90 dias: **+15 pp** vs baseline
- Adesao medicamentosa (MMAS-8): **>= 70%**
- Tempo medio de resposta do paciente: **< 4h**

### Camada medico
- Briefing pre-retorno aberto em **>= 80%** das consultas
- NPS medico parceiro: **>= 50**
- Tempo de leitura do briefing: **< 2 min**

### Camada negocio
- Disposicao de pagamento validada: **R$ 200+/medico/mes** ou **R$ 30-80/paciente ativo/mes**
- Conversao de clinica Singulare -> modulo: **>= 30%**
- Churn 6 meses: **<= 10%**

### Camada compatibilizacao (nova)
- **% pacientes app-on no piloto** >= 30% (sinal que vale ofertar instalacao)
- **% briefings com fusao ativa+passiva** >= 50% nas consultas com pacientes app-on
- **Reducao de perguntas WhatsApp pra paciente app-on** >= 40% (dedup funciona)

**Criterio do piloto:** 3 dos 4 alvos principais batidos
- MMAS-8 >= 70%
- Briefing aberto >= 80%
- NPS medico >= 50
- Disposicao de pagamento com compromisso financeiro

---

## Restricoes

| Categoria | Restricao |
|---|---|
| Tempo | Cabe sem competir com features-core do Singulare |
| Time | Equipe enxuta; medico parceiro = product advisor nao remunerado |
| Stack | Reusar N8N P03, Evolution, Chatwoot, Supabase, Vercel + **Flutter mobile do projeto paralelo** |
| Dependencia | NAO mergear antes de `feat/mobile-cardio` ter `health_observations` + `patient_consents` aplicados em prod |
| Regulatorio | CFM 2.314/2022, LGPD (consent_type granular), ANVISA SaMD se interpretar sintoma |
| Canal | WhatsApp Evolution (nao oficial) — risco de banimento, mitigar com rotacao |
| Pagador | Clinica obrigatoriamente (paciente nao paga no Brasil) |
| Idioma | PT-BR; PROs com traducao validada (KCCQ, MMAS-8) |

---

## Premissas a validar

| # | Premissa | Confianca | Como validar |
|---|---|---|---|
| P1 | Idoso cardio responde WhatsApp com regularidade | Media | Piloto manual 10 pacientes pre-modulo |
| P2 | Clinica paga R$ 200-500/medico/mes ou R$ 30-80/paciente ativo | Baixa | Mockup + carta de intencao em 5 clinicas |
| P3 | Medico abre briefing pre-retorno se < 2 min | Media | Piloto cardio |
| P4 | 5 templates cardio cobrem 80% dos pacientes | Media | Analise prontuario do parceiro |
| P5 | P03 interpreta resposta livre sem erro grave | Media-Alta | Logs N8N + revisao humana primeiras 200 mensagens |
| P6 | Medico e secretaria topam alerta via WhatsApp pessoal | Alta | Validar com parceiro |
| P7 | Paciente consente coleta de saude via WhatsApp | Media | Onboarding A/B no piloto |
| P8 | Agente IA conversacional > scripted (percebido pelo paciente) | Baixa | A/B no piloto |
| P9 | >= 30% dos pacientes cardio do parceiro topam instalar app mobile | Baixa | Oferta no consultorio + analytics de adocao |
| P10 | Fusao ativa+passiva no briefing eleva NPS medico vs so-ativo | Media | A/B briefing entre pacientes app-on vs WhatsApp-only |
| P11 | Dedup "nao perguntar o que app ja sabe" e percebido como qualidade pelo paciente | Media | NPS paciente + qualitativo |

---

## Pain Points

### Clinica/medico
- Volta a ver paciente sem dados longitudinais dos 90 dias
- Adesao e buraco preto; descobre que parou ao piorar
- Concorrencia cobra mesma consulta; precisa diferenciar
- Sem tempo de ligar pra paciente entre consultas

### Paciente
- Esquece medicacao
- Duvida no meio do tratamento sem a quem perguntar
- Piora entre consultas — espera o retorno?
- Atividade fisica sem orientacao
- App pede demais (bateria, permissao Health, login) — alguns nao instalam
- WhatsApp pergunta coisa que o app ja deveria saber (atrito de dedup)

### Operadora (secundario)
- Sem visibilidade de adesao ate virar internacao
- Paga consulta sem desfecho mensurado

### Produto Singulare
- Expansao pra clinica longitudinal aumenta superficie regulatoria
- WhatsApp Evolution = risco de banimento
- Cada especialidade demanda protocolo proprio
- Dedup ativa-passiva = logica nova no P03, risco de complexidade
- Dois fluxos de paciente (app-on vs WhatsApp-only) = surface de teste

---

## Decisoes de produto (consolidadas)

1. **Pagador:** clinica
2. **Devices/passivo:** **reuso integral** da peca `mobile-cardio` (Flutter + Apple Health / Health Connect + `ingest-vitals`). Modulo seguimento NAO cria pipeline propria de device. Coleta ativa (WhatsApp) grava na mesma `health_observations` com `device_provenance.source='whatsapp_active'`.
3. **Entrega do briefing:** **PDF anexo a consulta** (relato + analise + fusao ativa+passiva); nao dashboard no painel
4. **Frequencia:** **1 toque ativo/semana** por paciente; passivo sincroniza sozinho a cada 6h
5. **Onboarding:** **ad-hoc** no MVP; integracao com fluxo formal em fase 2
6. **Receita digital:** **fora do escopo** do MVP
7. **Configuracao:** 5 templates cardio prontos (hipertenso, pos-IAM, ICC, FA, dislipidemia) + medico edita 2-3 campos por paciente. Cada template define: perguntas semanais, LOINC esperados do passivo, score (KCCQ pra ICC etc.), thresholds de alerta
8. **Escalada de alerta critico:** secretaria + medico (ambos), com escalada temporal. Disparo unificado: trigger em `health_observations` (passivo OU ativo)
9. **Operadora:** B2B2B fase 2; nao pesa no MVP
10. **Dois sabores de paciente:** app-on (dado passivo) e WhatsApp-only (so ativo). MVP funciona pros dois; oferta de instalacao do app e opcional no consultorio
11. **Dedup ativa-passiva:** P03 verifica `health_observations` recentes antes de perguntar — se ja tem dado passivo da semana, pula pergunta correspondente

---

## Open Questions remanescentes

- Como medir adesao real sem device, dado vies do PRO? Aceitamos o trade-off no MVP (MMAS-8 + heuristicas de NLU).
- Sweet spot de horario do toque semanal — A/B teste no piloto.
- Politica de re-engajamento quando paciente para de responder (2 silencios = escalada pra secretaria?).
- Criterio clinico do alerta critico — palavras-chave/sintomas ATIVOS e thresholds PASSIVOS por protocolo.
- LOINC pra MMAS-8 e KCCQ — custom (`singulare:mmas8`, `singulare:kccq`) ou usar `71799-1`?
- Categoria FHIR pra resposta ativa — expandir `health_observations.category` CHECK constraint pra incluir `'patient-reported'`?

---

## Mercado — quem ja atua

**Globais:**
- [Memora Health](https://www.memorahealth.com/) (EUA, Commure) — concorrente conceitual mais proximo: SMS, enterprise, ingles
- KardiaPro/AliveCor — device + portal clinico
- Medisafe, MyTherapy, AdhereTech — adesao consumer/farma
- Memora/Twistle/Conversa — engagement enterprise (US hospital system)

**Brasil — nenhum cobre o stack completo (WhatsApp ativo + app passivo + IA conversacional + protocolo por especialidade + pago pela clinica):**
- Cuco Health — adesao paga por farma
- iClinic/Feegow/Doctoralia — comunicacao broadcast, sem protocolo clinico
- Conexa/Portal Telemedicina — teleconsulta, sem pos-consulta
- Operadoras (Hapvida, Unimed) — programas internos fechados

**Gap concreto reforcado pela peca passiva:** fusao ativa (WhatsApp) + passiva (mobile health) em UMA camada FHIR/LOINC + briefing pre-retorno + tier R$ 200-500/medico/mes. Ninguem ocupa.

---

## Riscos regulatorios

1. **CFM 2.314/2022 + LGPD** — consentimento explicito do canal WhatsApp + consentimento separado pra coleta passiva mobile + log auditavel vinculado ao prontuario.
2. **ANVISA SaMD (RDC 657/2022)** — agente nunca diagnostica. Coleta + triagem + alerta humano. Decisao clinica e sempre do medico.
3. **Responsabilidade clinica** — SLA de escalonamento humano via Chatwoot pra dor toracica, dispneia subita, sincope, **alem de gatilhos passivos** (FC > 120 sustentado, SBP > 180).
4. **Outliers passivos chegando antes do diagnostico** — paciente recebe dado de FC alta do app antes do medico interpretar. Politica: app nao alarma paciente, so registra; alerta vai pro corredor clinico.

---

## Proximos passos

1. HMW Affinity — converter pain points em "Como podemos..."
2. Crazy 8s sobre 5-6 HMW selecionadas
3. **Coordenar com peca `mobile-cardio`**: confirmar timeline de merge, validar expansao da `category` CHECK constraint, alinhar LOINC pra resposta ativa
4. Carta de intencao de pagamento com medico parceiro (valida P2 antes de codar muito)
5. Piloto manual de 2 semanas com 10 pacientes antes do modulo existir (valida P1)
