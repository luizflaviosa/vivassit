# Handoff — Telemonitoramento mobile

O que esta pronto e o que voce precisa fazer manualmente quando voltar.

## Estado atual (10/05/2026 noite)

### Funcionando AGORA em prod (sem voce precisar fazer nada)

- **Coleta web** via `https://singulare.org/saude/<uuid>`. Paciente abre o link no celular, preenche FC/PA/peso/glicemia/temp/SpO2, dados vao pra `health_observations` em segundos.
- **Painel da clinica** mostra os dados em `https://singulare.org/painel/pacientes` → drawer do paciente → secao "Saude cardiaca". Botao "Gerar/Copiar link de coleta" gera link unico por paciente.
- **Consentimento LGPD** registrado automaticamente em `patient_consents` na 1a vez que paciente abre o link. Tabela tem RLS pra tenant.
- **Retencao 2 anos** — pg_cron mensal apaga `health_observations` com `created_at > 24 meses`.
- **Privacidade publica** em `https://singulare.org/privacidade/saude` (LGPD).

### Pronto pra rodar, mas precisa de acao MANUAL sua

Mobile app `mobile/singulare_health/` esta com todo o codigo, mas exige operacoes externas pra entrar em loja.

---

## Itens manuais (em ordem de prioridade)

### 1. Instalar Flutter SDK (5 min, 1x)

```bash
brew install --cask flutter
flutter doctor
flutter doctor --android-licenses
```

Se ja tiver, pular.

### 2. Completar scaffolding Flutter (1 min)

```bash
cd mobile/singulare_health
flutter create . \
  --org org.singulare \
  --project-name singulare_health \
  --platforms ios,android \
  --description "Singulare Saude - telemonitoramento cardiologico passivo"
flutter pub get
```

`flutter create .` preserva os arquivos que ja existem (pubspec.yaml, lib/, Info.plist, AndroidManifest.xml).

### 3. Habilitar HealthKit no Xcode (5 min, 1x)

```bash
open mobile/singulare_health/ios/Runner.xcworkspace
```

No Xcode:
1. `Runner` (target) → `Signing & Capabilities`
2. `+ Capability` → `HealthKit` → marcar "Background Delivery"
3. `+ Capability` → `Background Modes` → marcar "Background fetch" e "Background processing"
4. Verificar Team de signing (precisa Apple Developer Account ativa — $99/ano)

Por que: o entitlement `com.apple.developer.healthkit` so e gerado dentro do Xcode, nao via arquivo. A spec [docs/health-data-spec.md](health-data-spec.md) tem todos os detalhes tecnicos.

### 4. Configurar Associated Domains (15 min, 1x)

Pra deep link `https://singulare.org/saude/<uuid>` abrir o app:

#### iOS
1. No Xcode → `Runner` target → `Signing & Capabilities` → `+ Capability` → `Associated Domains`
2. Add: `applinks:singulare.org`
3. Hospedar arquivo `https://singulare.org/.well-known/apple-app-site-association` (sem extensao, content-type `application/json`):

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAMID.org.singulare.singulare_health",
        "paths": ["/saude/*"]
      }
    ]
  }
}
```

Substituir `TEAMID` pelo Team ID do seu Apple Developer Account.

Pra servir esse arquivo no Vercel, criar `app/public/.well-known/apple-app-site-association` com o JSON acima. Vercel serve estatico automaticamente.

#### Android (App Links)
Hospedar `https://singulare.org/.well-known/assetlinks.json`:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "org.singulare.singulare_health",
      "sha256_cert_fingerprints": ["<SHA256_DA_KEYSTORE_DE_RELEASE>"]
    }
  }
]
```

Pra obter SHA-256 do keystore:
```bash
keytool -list -v -keystore <seu-keystore>.jks -alias <alias>
```

### 5. Health Connect access form (Play Console, 15 min + review 7-14d)

Quando subir a 1a release pra Play:

1. Play Console → seu app → Policy → Health Connect
2. Preencher form justificando cada `READ_*`:
   - `READ_HEART_RATE`: "Monitoramento cardiaco passivo pelo profissional de saude vinculado"
   - `READ_HEART_RATE_VARIABILITY`: "Avaliacao de risco cardiovascular pelo medico"
   - `READ_BLOOD_PRESSURE`: "Acompanhamento de hipertensos"
   - `READ_BLOOD_GLUCOSE`: "Acompanhamento de diabeticos"
   - `READ_SLEEP`: "Avaliacao de qualidade do sono em pacientes cardiacos"
   - etc — usar texto similar a cima
3. URL da politica: `https://singulare.org/privacidade/saude` (ja existe)
4. Especificar `READ_HEALTH_DATA_IN_BACKGROUND` e `READ_HEALTH_DATA_HISTORY` — esses 2 passam por review extra (~7-14 dias). Submeter o quanto antes.

### 6. Apple Health App Store review

Apple exige:
- Privacy Manifest (`PrivacyInfo.xcprivacy`) declarando todos os data types coletados
- Justificativa por API uso (UserDefaults, file timestamp, system boot time) — automatico pelo Flutter
- URL de privacidade em App Store Connect: `https://singulare.org/privacidade/saude`

Tudo isso preencher no Xcode + App Store Connect quando submeter.

### 7. Servir AASA + assetlinks no Vercel

Criar antes de submeter qualquer build:

```bash
mkdir -p app/public/.well-known
```

E os 2 arquivos descritos no passo 4. Vercel auto-serve `app/public/*`.

---

## Como testar AGORA (sem build mobile)

Voce ja consegue gerar dados reais sem app pra validar a UI:

1. Acessa `https://singulare.org/painel/pacientes`
2. Clica em qualquer paciente
3. Drawer abre — clica "Gerar link de coleta"
4. Link copiado pro clipboard
5. Cola no WhatsApp Web e manda pra um celular qualquer
6. No celular, abre o link, preenche pressao + peso
7. Volta no painel — drawer mostra os dados em "Saude cardiaca"

Paciente teste **Andreia Vieira (id 56)** ja tem 9 medicoes de teste no banco.

---

## Decisoes tomadas autonomamente (registradas no commit)

| Item | Decisao | Por que |
|---|---|---|
| Autenticacao mobile | Reusar `health_collection_token` (igual web) | Pula OTP+Twilio (custo + setup); paciente nao precisa relogar; mesmo modelo da web |
| Retencao de dados | 24 meses | Minimizacao LGPD art. 16 III; prontuario formal continua com prazo CFM (20 anos) em outras tabelas |
| HRV SDNN vs RMSSD | Aceitar ambos com qualifier em `device_provenance.metric_type` | iOS so tem SDNN, Android so tem RMSSD; nao perder dado por padronizacao prematura |
| Consent type default | `health_monitoring` (auto na 1a abertura do link) | LGPD permite consentimento por meio facil de identificar (IP+UA registrados) |
| AI inference | Consent SEPARADO (a pedir quando ativar) | Granularidade — paciente pode permitir monitoramento sem permitir IA |
| URL base do app | `https://singulare.org` hardcoded | Single env; quando tiver staging, trocar pra `--dart-define=API_BASE_URL=...` |

## Custos estimados quando entrar em prod

- Apple Developer Program: **USD 99/ano**
- Google Play Developer: **USD 25 one-time**
- Health Connect review: gratis (mas 7-14 dias de espera)
- Twilio (se mudar de mente e querer OTP): **~USD 0,05 por SMS BR** — nao usado nessa arquitetura
- Supabase: ja pago no plano atual; `health_observations` cabe no Free tier ate ~10k pacientes ativos

## Quando comecar a vender mobile real

Antes de chamar 1o cliente real pra usar o app mobile:
1. Itens 1-5 acima completos
2. Build assinada submetida em TestFlight (iOS) e Internal Testing (Play)
3. 1 medico + 1 paciente real testando end-to-end por 1 semana
4. Monitorar `health_observations` por outliers/rejected acima do esperado

Boa noite, ate amanha.
