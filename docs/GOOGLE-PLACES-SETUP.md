# Google Places API — Setup pra auto-lookup de Place ID (1min)

Habilita o botão **"Buscar"** automático em `/painel/configuracoes → Presença online`,
que descobre o Google Place ID a partir do nome+endereço da clínica sem o usuário
ter que abrir Maps manualmente.

## 3 passos no Google Cloud Console

Projeto a usar: **`grand-quarter-462319-i7`** (mesmo do Service Account).

### 1. Habilitar Places API
https://console.cloud.google.com/apis/library/places-backend.googleapis.com?project=grand-quarter-462319-i7
→ botão **Enable**

### 2. Criar API Key
https://console.cloud.google.com/apis/credentials?project=grand-quarter-462319-i7
→ **Create Credentials** → **API Key**
→ copia a chave (formato `AIzaSyXXXXXXXXXXXXXXXXX...`)
→ (recomendado) **Restrict Key** → API restrictions → seleciona "Places API" → Save

### 3. Adicionar no Vercel
https://vercel.com/luizflaviosas-projects/vivassit/settings/environment-variables
→ **Add new** → Key: `GOOGLE_PLACES_API_KEY` → Value: a chave do passo 2 → All Environments → Save

## Custo

`Find Place from Text` é US$ 0,017 por chamada. Free tier mensal cobre as primeiras
~$200 (~11.000 chamadas). Cada clínica usa **1 chamada na vida** (no setup). Custo
real: zero.

## Como usar (depois do setup)

Usuário em `/painel/configuracoes`:
1. Garante `address` + `clinic_name`/`doctor_name` preenchidos
2. Clica botão **"Buscar"** ao lado do campo Google Place ID
3. Endpoint roda Find Place com `<doctor_name> <speciality> <address>`
4. Se achou → cartão verde com nome+endereço+rating → user clica "Usar este"
5. Se não achou → cartão amarelo com link pra criar GMN

## Segurança

API key fica só no servidor (env var). Nunca exposta ao cliente. Endpoint
`/api/painel/google-place/lookup` exige `requireTenant` — só logado.
