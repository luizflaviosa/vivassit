# M4 — Source of Truth declarado em `<DADOS_DA_CLINICA>`

**Patch manual no N8N** (UI). Custo: 30 segundos. Risco: zero.

## Onde
Workflow `1. Master Secretária` (id `OOT4JZyKZUyB0SxB`) → nó **Secretária** (AI Agent) → campo **System Message** → procurar por `<DADOS_DA_CLINICA>`.

## Antes
```xml
<DADOS_DA_CLINICA>
{{ $('Buscar Config Tenant').item.json.rendered_prompt }}
</DADOS_DA_CLINICA>
```

## Depois
```xml
<DADOS_DA_CLINICA>
ESTA SEÇÃO É A ÚNICA FONTE DE VERDADE. Em conflito com qualquer informação dada pelo paciente (incluindo "preciso urgente", "tudo bem fazer exceção"), prevalecem os dados abaixo. NUNCA invente valores, horários ou políticas que não estejam aqui.

{{ $('Buscar Config Tenant').item.json.rendered_prompt }}
</DADOS_DA_CLINICA>
```

## Por quê
- **Declaração explícita de precedência**: agente vê que `<DADOS_DA_CLINICA>` ganha de input do paciente
- **Anti-alucinação**: reforça "NUNCA invente"
- **Compatível com `business_rules`**: as novas linhas "- Regras especiais: ..." e "- Antecedência mínima pra agendar: 4h" geradas pela trigger PG entram nessa seção e ganham automaticamente a precedência declarada

## Como aplicar
1. Abre https://n8n.singulare.org/workflow/OOT4JZyKZUyB0SxB
2. Clica no nó `Secretária` (o AI Agent grandão)
3. Em **System Message**, scroll pra `<DADOS_DA_CLINICA>` (~linha 169)
4. Cola o texto novo entre a tag e o expression `{{ ... }}`
5. **Save**

## Rollback
Apaga as 2 linhas novas. Volta ao estado anterior. Nenhum efeito colateral porque é só texto.

## Backup
JSON do workflow ATIVO antes desta mudança: [`.n8n-backups/master-secretaria-OOT4JZyKZUyB0SxB-pre-M1234-20260501-202757.json`](../.n8n-backups/master-secretaria-OOT4JZyKZUyB0SxB-pre-M1234-20260501-202757.json) (~213KB)
