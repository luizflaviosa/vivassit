# Acervo Técnico — Fontes Oficiais e Reguladas

> Inventário completo de tabelas, APIs e dados oficiais necessários para o módulo de documentos médicos da Singulare. Gerado em 2026-05-02.

---

## Resumo Executivo

| Fonte | Registros (aprox.) | Formato disponível | Atualização | Usado em |
|-------|-------------------|-------------------|-------------|----------|
| CID-10 | ~12.000 subcategorias | CSV, SQL, JSON | Anual (OMS) | INSS, LME, TISS, Vacina |
| TUSS | ~6.000 procedimentos (63 tabelas) | JSON, SQL, ODS | Semestral (ANS) | TISS |
| SIGTAP | ~5.000 procedimentos + medicamentos | TXT (layout fixo), SQL | Mensal (DataSUS) | LME |
| Operadoras ANS | ~700 ativas | CSV | Trimestral (ANS) | TISS |
| TISS XSD | Schemas XML | XSD | Por versão (4.03 atual) | TISS XML |
| PCDT | ~90 protocolos | PDF (não estruturado) | Sob demanda (CONITEC) | LME justificativa |
| Vacinas CRIE/PNI | ~25 imunobiológicos | PDF (manual) | Anual (MS) | Vacina prioritária |
| CBHPM | ~6.000 procedimentos | PDF (pago) | Bianual (AMB) | Referência valores |
| BirdID API | API REST | OAuth2 + REST | Contínuo | Assinatura digital |

---

## 1. CID-10 — Classificação Internacional de Doenças

### O que é
Tabela da OMS com todos os diagnósticos médicos codificados. Obrigatório em: guias TISS, relatórios INSS, LME, vacina prioritária.

### Onde obter
| Fonte | URL | Formato | Observação |
|-------|-----|---------|------------|
| **DataSUS (oficial)** | http://www2.datasus.gov.br/cid10/V2008/download.htm | CSV (ZIP 297KB) | ISO-8859-1, separador `;` |
| **GitHub CID10-SQL** | https://github.com/lucasrafagnin/CID10-SQL | SQL (INSERT INTO) | Pronto para importar em banco relacional |
| **GitHub CidDataSus** | https://github.com/cleytonferrari/CidDataSus | CSV organizado | Capítulos, grupos, categorias, subcategorias separados |
| **API CID (comunidade)** | https://github.com/a21ns1g4ts/cid-api | REST API | Node.js, pode servir de referência |

### Estrutura dos dados

**Arquivo: CID-10-SUBCATEGORIAS.CSV** (~12.000 registros)
```
SUBCAT;DESCRICAO;DESCRABREV;CLASSIF;RESTRSEXO;CAUSAOBITO;REFER
A000;Colera devida a Vibrio cholerae 01, biotipo cholerae;Colera c/V chol 01 biot cholerae;;M;S;
A001;Colera devida a Vibrio cholerae 01, biotipo El Tor;Colera dev V chol biot El Tor;;M;S;
```

| Campo | Tipo | Descrição |
|-------|------|-----------|
| SUBCAT | text(4) | Código CID (sem ponto: `A000`) — formatamos como `A00.0` |
| DESCRICAO | text | Nome completo do diagnóstico |
| DESCRABREV | text | Nome abreviado |
| CLASSIF | text | Classificação cruz/asterisco |
| RESTRSEXO | text | `M`=ambos, `F`=feminino, `I`=masculino |
| CAUSAOBITO | text | `S`=pode ser causa de óbito |

**Arquivo: CID-10-CATEGORIAS.CSV** (~2.000 registros — agrupamentos de 3 caracteres)

**Arquivo: CID-10-CAPITULOS.CSV** (22 capítulos)

### Como importar para Supabase
```sql
-- Opção 1: Usar o repo CID10-SQL (já tem INSERTs prontos)
-- Opção 2: Script Node.js que lê CSV e faz bulk insert
-- Opção 3: Upload CSV direto via Supabase Dashboard (Import CSV)

CREATE TABLE lookup_cid10 (
  code        text PRIMARY KEY,   -- 'A00.0' (com ponto)
  name        text NOT NULL,      -- 'Cólera devida a Vibrio cholerae 01...'
  name_short  text,               -- versão abreviada
  chapter     text,               -- capítulo (I-XXII)
  sex_filter  text,               -- M/F/I
  can_cause_death boolean DEFAULT true
);
```

### Frequência de atualização
Anual. A CID-10 é estável. A CID-11 já existe mas o Brasil **ainda não adotou** — continua CID-10.

---

## 2. TUSS — Terminologia Unificada da Saúde Suplementar

### O que é
Tabela da ANS com códigos padronizados de procedimentos para saúde suplementar (convênios). Obrigatório em guias TISS.

### Onde obter
| Fonte | URL | Formato | Observação |
|-------|-----|---------|------------|
| **Portal Dados Abertos (oficial)** | https://dados.gov.br/dados/conjuntos-dados/terminologia-unificada-da-saude-suplementar-tuss | CSV (ZIP) | Download direto, atualizado |
| **FTP ANS** | http://ftp.dadosabertos.ans.gov.br/FTP/PDA/terminologia_unificada_saude_suplementar_TUSS/TUSS.zip | ZIP | Arquivo único compactado |
| **GitHub tabelas-ans** | https://github.com/charlesfgarcia/tabelas-ans | **JSON + SQL** | ⭐ Melhor opção: já formatado em JSON e SQL por tabela |
| **ANS site** | https://www.gov.br/ans/pt-br/assuntos/operadoras/compromissos-e-interacoes-com-a-ans-1/padroes-e-schemas | ODS | Formato planilha livre |

### Estrutura (63 tabelas de domínio)
As tabelas mais relevantes para nós:

| Tabela TUSS | Conteúdo | Nº registros (aprox.) |
|-------------|----------|----------------------|
| Tabela 18 | Terminologia de diárias e taxas | ~200 |
| Tabela 19 | Terminologia de materiais e OPME | ~3.000 |
| Tabela 20 | Terminologia de medicamentos | ~2.000 |
| Tabela 22 | **Terminologia de procedimentos e eventos em saúde** | ~5.000 ⭐ |
| Tabela 98 | Tipo de consulta | ~20 |

**Formato JSON (via GitHub tabelas-ans):**
```json
{
  "codigo": "10101012",
  "termo": "CONSULTA EM CONSULTORIO (NO HORARIO NORMAL OU PREESTABELECIDO)",
  "dt_inicio_vigencia": "2016-01-01",
  "dt_fim_vigencia": null,
  "dt_implantacao": "2010-02-01"
}
```

### Como importar para Supabase
```sql
CREATE TABLE lookup_tuss (
  code          text PRIMARY KEY,     -- '10101012'
  name          text NOT NULL,        -- 'Consulta em consultório...'
  table_number  int,                  -- 22 (tabela de procedimentos)
  valid_from    date,
  valid_until   date,                 -- null = vigente
  active        boolean GENERATED ALWAYS AS (valid_until IS NULL) STORED
);
```

**Script**: Usar JSON do repo `charlesfgarcia/tabelas-ans`, parsear e inserir via bulk insert.

### Frequência de atualização
Semestral. A ANS publica atualizações da TUSS ~2x/ano.

---

## 3. SIGTAP — Tabela de Procedimentos do SUS

### O que é
Tabela do DataSUS com todos os procedimentos financiados pelo SUS, incluindo **medicamentos do componente especializado** (alto custo). Necessário para LME.

### Onde obter
| Fonte | URL | Formato | Observação |
|-------|-----|---------|------------|
| **DataSUS (oficial)** | http://sigtap.datasus.gov.br/tabela-unificada/app/download.jsp | TXT (layout fixo, ~80 arquivos) | Mensal por competência |
| **Wiki SIGTAP** | https://wiki.saude.gov.br/sigtap/index.php/Download | TXT + manuais | Inclui documentação do layout |
| **GitHub rdsilva/SIGTAP** | https://github.com/rdsilva/SIGTAP | Documentação + scripts | Organiza os ~80 arquivos com descrições |
| **GitHub importSIGTAPTables** | https://github.com/ricmed/importSIGTAPTables | **PHP scripts para importação** | Scripts prontos para importar em banco relacional |
| **iClinic SIGTAP** | https://sigtap.iclinic.com.br/ | Interface web de consulta | Referência para UX de busca |

### Estrutura
O SIGTAP tem ~80 arquivos TXT com layout de posição fixa (sem separador). Os principais:

| Arquivo | Conteúdo | Relevância |
|---------|----------|-----------|
| `tb_procedimento.txt` | Procedimentos (código, nome, complexidade) | ⭐ Alta — base dos procedimentos SUS |
| `tb_grupo.txt` | Grupos de procedimentos | Hierarquia |
| `tb_sub_grupo.txt` | Subgrupos | Hierarquia |
| `tb_forma_organizacao.txt` | Forma de organização | Hierarquia |
| `rl_procedimento_cid.txt` | **Relação procedimento ↔ CID** | ⭐ Alta — saber quais CIDs justificam qual procedimento |
| `tb_medicamento.txt` | **Medicamentos SUS** | ⭐ Alta — lista para LME |

### Layout de posição fixa (exemplo tb_procedimento.txt)
```
Posição 01-10: Código do procedimento
Posição 11-260: Nome do procedimento
Posição 261-264: Complexidade
...
```

### Como importar para Supabase

Opção mais prática: usar o script PHP do `importSIGTAPTables` como referência e reescrever em Node.js/TypeScript.

```sql
CREATE TABLE lookup_sigtap (
  code          text PRIMARY KEY,     -- '0301010072'
  name          text NOT NULL,
  group_code    text,
  subgroup_code text,
  complexity    text,                 -- 'AB'=atenção básica, 'MC'=média, 'AC'=alta
  tuss_code     text,                 -- mapeamento SIGTAP↔TUSS (se disponível)
  is_medication boolean DEFAULT false -- flag para medicamentos
);

-- Tabela auxiliar: relação procedimento ↔ CID
CREATE TABLE lookup_sigtap_cid (
  sigtap_code text REFERENCES lookup_sigtap(code),
  cid_code    text REFERENCES lookup_cid10(code),
  PRIMARY KEY (sigtap_code, cid_code)
);
```

### Frequência de atualização
**Mensal.** O DataSUS publica nova competência todo mês. Para nosso uso (LME), atualizar trimestralmente é suficiente.

---

## 4. Operadoras ANS — Lista de Planos de Saúde

### O que é
Registro oficial de todas as operadoras de planos de saúde ativas no Brasil. Necessário para guia TISS (campo "operadora").

### Onde obter
| Fonte | URL | Formato | Observação |
|-------|-----|---------|------------|
| **Portal Dados Abertos** | https://dados.gov.br/dados/conjuntos-dados/operadoras-de-planos-de-saude-ativas | **CSV** | ⭐ Download direto, ~700 registros |
| **ANS Consulta** | https://www.ans.gov.br/planos-de-saude-e-operadoras/informacoes-e-avaliacoes-de-operadoras/consultar-dados | Web | Interface de consulta individual |

### Estrutura esperada
```sql
CREATE TABLE lookup_operadoras (
  registro_ans  text PRIMARY KEY,    -- '000000' (6 dígitos)
  razao_social  text NOT NULL,
  nome_fantasia text,
  cnpj          text,
  modalidade    text,                -- cooperativa, autogestão, etc.
  uf            text,
  active        boolean DEFAULT true
);
```

### Frequência de atualização
Trimestral. Operadoras raramente mudam.

---

## 5. TISS XSD — Schemas XML para Guias

### O que é
Definições XML Schema (XSD) que validam o formato das guias TISS. Necessário para gerar XML TISS válido.

### Onde obter
| Fonte | URL | Formato | Observação |
|-------|-----|---------|------------|
| **ANS (oficial)** | https://www.gov.br/ans/pt-br/assuntos/operadoras/compromissos-e-interacoes-com-a-ans-1/padroes-e-schemas | XSD (ZIP) | Versão 4.03.00 atual |
| **GitHub tiss-php** | https://github.com/JoseAurelianoJR/tiss-php | XSD + PHP | Schemas 3.x com referência útil |
| **ValidadorTISS** | https://www.validadortiss.com.br/ | Web tool | Validação online grátis de XML |

### Versão atual: TISS 4.03.00

Componentes do schema:
- `tissV4_03_00.xsd` — schema principal
- `tissComplexTypesV4_03_00.xsd` — tipos complexos
- `tissSimpleTypesV4_03_00.xsd` — tipos simples
- `tissGuiasV4_03_00.xsd` — estrutura das guias

### Como usar
Duas opções:
1. **API externa** (tissxml.com.br) — gera e valida XML via API REST
2. **Gerar internamente** — montar XML seguindo o XSD + validar contra schema

**Recomendação**: Gerar internamente com uma lib XML (xmlbuilder2 em Node.js), validar contra o XSD. Evita dependência de API terceira.

### Frequência de atualização
Por versão. Mudanças na TISS são anunciadas com meses de antecedência pela ANS.

---

## 6. PCDT — Protocolos Clínicos e Diretrizes Terapêuticas

### O que é
Documentos do Ministério da Saúde que definem critérios para uso de medicamentos de alto custo no SUS. **Essenciais** para preencher a justificativa da LME (principal motivo de indeferimento é justificativa fora do PCDT).

### Onde obter
| Fonte | URL | Formato | Observação |
|-------|-----|---------|------------|
| **CONITEC (oficial)** | https://www.gov.br/conitec/pt-br/assuntos/avaliacao-de-tecnologias-em-saude/protocolos-clinicos-e-diretrizes-terapeuticas | **PDF** | ~90 protocolos individuais |
| **Ministério da Saúde** | https://www.gov.br/saude/pt-br/assuntos/pcdt | PDF | Painel interativo por CID |
| **BVS Saúde** | https://bvsms.saude.gov.br/bvs/publicacoes/protocolos_clinicos_diretrizes_terapeuticas_v1.pdf | PDF (3 volumes) | Compilação completa |

### ⚠️ Problema: formato não estruturado

Os PCDTs são **PDF narrativos** (50-100 páginas cada). Não existe versão JSON/CSV oficial. Cada PCDT contém:
- Critérios de inclusão (CID + condições)
- Medicamentos indicados (com posologia)
- Fluxograma de tratamento
- Critérios de exclusão
- Monitoramento

### Estratégia de importação

Como os PCDTs são PDF, temos 3 opções:

| Opção | Viabilidade | Esforço | Resultado |
|-------|------------|---------|-----------|
| A. Extrair manualmente os 15-20 PCDTs mais comuns | ✅ Alta | ~20h | Tabela `pcdt_templates` com CID → medicamentos → justificativa padrão |
| B. Usar IA (Gemini) para extrair de cada PDF | ⚠️ Média | ~5h + revisão | Automatizado mas precisa validação humana |
| C. Não extrair, campo de justificativa livre | ✅ Alta | 0h | Perde o diferencial de "justificativa guiada" |

**Recomendação**: Opção A para os 15-20 mais comuns. Estrutura:

```sql
CREATE TABLE pcdt_templates (
  id            serial PRIMARY KEY,
  cid_code      text REFERENCES lookup_cid10(code),
  disease_name  text NOT NULL,
  medications   jsonb NOT NULL,        -- [{sigtap_code, name, dosage_range}]
  inclusion_criteria text NOT NULL,    -- texto padrão para anamnese LME
  justification_template text NOT NULL,-- texto sugerido para justificativa
  monitoring    text,                  -- acompanhamento recomendado
  source_url    text,                  -- URL do PDF do PCDT
  version       text                   -- ex: '2024'
);
```

---

## 7. Vacinas CRIE/PNI — Imunobiológicos Especiais

### O que é
Lista de vacinas disponíveis nos Centros de Referência para Imunobiológicos Especiais (CRIE) com suas indicações por comorbidade. Necessário para relatório de vacina prioritária.

### Onde obter
| Fonte | URL | Formato | Observação |
|-------|-----|---------|------------|
| **Manual CRIE 5ª ed. (MS)** | https://bvsms.saude.gov.br/bvs/publicacoes/manual_centros_imunobiologicos_especiais_5ed.pdf | PDF | Referência completa |
| **Guia Rápido RJ** | https://epirio.svs.rio.br/wp-content/uploads/2024/05/Livro_ImunobiologicosEspeciais_PDFDigital_2024.pdf | PDF | Versão resumida 2024 |
| **SBIm** | https://sbim.org.br/images/calendarios/calend-sbim-pacientes-especiais.pdf | PDF | Calendário por condição |
| **Ministério da Saúde** | https://www.gov.br/saude/pt-br/vacinacao/grupos-especiais | Web | Lista de grupos especiais |

### Vacinas disponíveis nos CRIEs (~25)

```
DT infantil, DTPa infantil, dTPa adulto, Hexavalente acelular,
Pneumocócica 10, Pneumocócica 13, Pneumocócica 23,
Hepatite A, Hepatite B, Hib, Tríplice viral, Varicela,
Febre amarela, HPV quadrivalente, Meningocócica C, ACWY,
Influenza, COVID bivalente,
IGHAR (antirrábica), IGHAT (antitetânica),
IGHAHB (anti-Hepatite B), IGHAVZ (anti-Varicela Zoster)
```

### Estratégia de importação

Similar aos PCDTs — formato é PDF narrativo. Extrair manualmente:

```sql
CREATE TABLE lookup_vaccines (
  id            serial PRIMARY KEY,
  name          text NOT NULL,         -- 'Pneumocócica 13-valente'
  short_name    text NOT NULL,         -- 'PCV13'
  type          text NOT NULL,         -- 'vaccine' | 'immunoglobulin'
  indications   jsonb NOT NULL         -- [{cid_code, condition, scheme}]
);
```

**Estimativa**: ~25 vacinas × ~5-10 indicações cada = ~200 registros. Extração manual ~4h.

---

## 8. CBHPM — Classificação Brasileira Hierarquizada de Procedimentos Médicos

### O que é
Tabela da AMB (Associação Médica Brasileira) com valores de referência para procedimentos médicos. Usada para negociação com convênios.

### Onde obter
| Fonte | URL | Formato | Observação |
|-------|-----|---------|------------|
| **AMB (oficial)** | https://amb.org.br/cbhpm/ | PDF (pago) | Última ed. 2022, ~6.000 procedimentos |

### ⚠️ Limitação
A CBHPM é **paga e protegida por direitos autorais**. Não pode ser importada e redistribuída sem licença da AMB.

**Para nosso sistema**: Não importar a CBHPM. Usar a TUSS (gratuita, oficial ANS) para procedimentos. O valor da consulta vem do cadastro do profissional (`tenant_doctors.consultation_value`).

---

## 9. BirdID API — Assinatura Digital ICP-Brasil

### O que é
API REST da Soluti/VaultID para assinatura digital com certificado ICP-Brasil em nuvem. Sem token físico.

### Documentação
| Recurso | URL |
|---------|-----|
| **API Pública (Cloud)** | https://docs.vaultid.com.br/workspace/cloud/api |
| **API CESS (Enterprise)** | https://docs.vaultid.com.br/workspace/cess/api |
| **OAuth2 Authorization Code** | https://docs.vaultid.com.br/workspace/cloud/api/autenticacao-de-usuarios/autenticacao-em-sistemas-web |
| **Endpoint de Assinatura** | https://docs.vaultid.com.br/workspace/cess/api/assinatura-de-documento-s |
| **Autenticação na API** | https://docs.vaultid.com.br/workspace/fluxo-recomendado/autenticacao-na-api-publica |
| **Swagger (API pública)** | https://api.birdid.com.br/ |
| **Parceria Soluti × CFM** | https://digital.soluti.com.br/cfm-soluti |

### Fluxo de assinatura

```
1. OAuth2 Authorization Code Flow
   GET https://[provider].vaultid.com.br/oauth/authorize
   → Redirect com code
   → POST /oauth/token (client_id, client_secret, code)
   → Recebe access_token

2. Enviar documento para assinatura
   POST /v1/documents/sign
   Body: { document: base64_pdf, certificate_alias: '...' }
   → Retorna TCN (Transaction Control Number)
   
3. Assincronamente, BirdID processa assinatura
   GET /v1/transactions/{tcn}/status
   → Quando completa: signed_document_url

4. Download do PDF assinado
   GET /v1/transactions/{tcn}/document
   → PDF com assinatura ICP-Brasil embarcada
```

### Informações pendentes de validar
- [ ] **Pricing**: Não encontrado publicamente. Contatar comercial Soluti.
- [ ] **Sandbox/Homologação**: Verificar se existe ambiente de testes.
- [ ] **Rate limits**: Não documentados publicamente.
- [ ] **Token refresh**: Verificar tempo de validade do OAuth token.
- [ ] **Formatos aceitos**: PDF, P7S, CAdES, XAdES? (verificar na doc).

---

## 10. Resumo de Viabilidade de Importação

| Fonte | Formato | Esforço de importação | Prioridade | GitHub pronto? |
|-------|---------|----------------------|------------|----------------|
| CID-10 | CSV/SQL | ⬜ Baixo (SQL pronto) | 🔴 P0 — usado em 4/5 docs | ✅ github.com/lucasrafagnin/CID10-SQL |
| TUSS (tabela 22) | JSON/SQL | ⬜ Baixo (JSON pronto) | 🔴 P0 — TISS depende | ✅ github.com/charlesfgarcia/tabelas-ans |
| Operadoras ANS | CSV | ⬜ Baixo (CSV direto) | 🔴 P0 — TISS depende | ❌ (CSV oficial é simples) |
| TISS XSD | XSD | ⬜ Médio (parse XML schema) | 🟡 P1 — validação XML | ❌ (referência: tiss-php no GitHub) |
| SIGTAP | TXT (layout fixo) | 🟡 Médio (parser necessário) | 🟡 P1 — LME depende | ⚠️ github.com/ricmed/importSIGTAPTables (PHP) |
| Vacinas CRIE | PDF → manual | 🟡 Médio (~4h extração) | 🟢 P2 | ❌ |
| PCDT templates | PDF → manual | 🔴 Alto (~20h extração top 20) | 🟢 P2 (diferencial LME) | ❌ |
| CBHPM | PDF pago | ❌ Não importar | ⬛ Não usar | ❌ |

---

## 11. Repositórios GitHub — Atalhos Prontos

| Repo | O que tem | Licença | Link |
|------|----------|---------|------|
| **CID10-SQL** | SQL INSERTs para CID-10 completo | MIT | https://github.com/lucasrafagnin/CID10-SQL |
| **CidDataSus** | CSVs organizados (capítulos, grupos, categorias, subcategorias) | — | https://github.com/cleytonferrari/CidDataSus |
| **tabelas-ans** | TUSS 63 tabelas em **JSON + SQL** | — | https://github.com/charlesfgarcia/tabelas-ans |
| **SIGTAP** | Documentação dos ~80 arquivos + layout | — | https://github.com/rdsilva/SIGTAP |
| **importSIGTAPTables** | Scripts PHP para importação SIGTAP | — | https://github.com/ricmed/importSIGTAPTables |
| **cid-api** | API REST Node.js para CID-10 | MIT | https://github.com/a21ns1g4ts/cid-api |
| **tiss-php** | XSD schemas TISS + gerador PHP | — | https://github.com/JoseAurelianoJR/tiss-php |

---

## 12. Ordem de Importação Recomendada

```
SEMANA 1 (P0 — desbloqueia tudo):
├── 1. CID-10 → lookup_cid10 (usar CID10-SQL do GitHub)
├── 2. TUSS tabela 22 → lookup_tuss (usar tabelas-ans JSON do GitHub)
└── 3. Operadoras ANS → lookup_operadoras (CSV do Portal Dados Abertos)

SEMANA 2 (P1 — desbloqueia TISS e LME):
├── 4. TISS XSD 4.03 → referência para gerar XML (download ANS)
└── 5. SIGTAP medicamentos → lookup_sigtap (parser de TXT necessário)

SEMANA 3 (P2 — diferencial):
├── 6. Vacinas CRIE → lookup_vaccines (extração manual do manual PDF)
└── 7. PCDT top 20 → pcdt_templates (extração manual dos PDFs)

DEPOIS (opcional):
└── 8. BirdID API → integração OAuth + assinatura (após validar pricing)
```

---

## 13. Open Questions

- [ ] BirdID pricing: contatar comercial Soluti (soluti.com.br/contato)
- [ ] BirdID sandbox: existe ambiente de homologação?
- [ ] SIGTAP parser: reescrever o PHP do importSIGTAPTables em TypeScript ou usar script one-shot?
- [ ] PCDT extração: fazer manualmente ou usar Gemini para extrair dos PDFs?
- [ ] CBHPM: confirmar que não usaremos (TUSS é suficiente?)
- [ ] Licença dos repos GitHub: verificar se permite uso comercial
- [ ] Atualização mensal SIGTAP: automatizar ou atualizar manualmente?
- [ ] CID-11: monitorar adoção no Brasil (prevista para 2025-2027 mas sem data firme)
