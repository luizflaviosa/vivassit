# Singulare Saude (mobile)

App Flutter de telemonitoramento cardiologico passivo. Le HR/HRV/passos/sono/PA/peso/glicemia via Apple Health (iOS) ou Health Connect (Android) e sincroniza com o backend Singulare a cada 6h.

## Estrutura entregue

Os arquivos `lib/`, `test/`, `pubspec.yaml`, `ios/Runner/Info.plist`, `android/app/src/main/AndroidManifest.xml` estao prontos. Falta o **boilerplate gerado pelo `flutter create`** (Xcode pbxproj, Gradle wrapper, AppDelegate.swift, MainActivity.kt etc).

## Setup

### 1. Instalar Flutter SDK (uma vez na sua maquina)

```bash
brew install --cask flutter
flutter doctor
```

Aceita os termos da licenca Android quando pedir:

```bash
flutter doctor --android-licenses
```

### 2. Completar o scaffolding com `flutter create`

A partir da raiz do repo:

```bash
cd mobile/singulare_health
flutter create . \
  --org org.singulare \
  --project-name singulare_health \
  --platforms ios,android \
  --description "Singulare Saude - telemonitoramento cardiologico passivo"
```

Esse comando **NAO sobrescreve** os arquivos que ja existem aqui (pubspec.yaml, lib/, test/, Info.plist, AndroidManifest.xml). Ele preenche o que falta: Xcode project, Gradle, AppDelegate, MainActivity, icones default, splash, etc.

### 3. Resolver dependencias

```bash
flutter pub get
```

### 4. iOS — habilitar HealthKit capability

```bash
open ios/Runner.xcworkspace
```

No Xcode:
1. Selecionar `Runner` target → `Signing & Capabilities`
2. Clicar `+ Capability`
3. Adicionar `HealthKit`
4. Marcar checkbox "Background Delivery" (gera o entitlement automaticamente)
5. Repetir: `+ Capability` → `Background Modes` → marcar `Background fetch` e `Background processing`
6. Verificar que o Team de signing esta correto

### 5. Android — minSdk e build

Editar `android/app/build.gradle` (gerado pelo `flutter create`) e garantir:

```gradle
android {
    defaultConfig {
        minSdkVersion 28
        targetSdkVersion 34
    }
}
```

Health Connect requer minSdk 28+.

### 6. Rodar localmente

```bash
flutter run
```

Vai abrir simulator iOS ou emulator/device Android.

## Fluxo do usuario

1. **Welcome screen**: paciente cola o link recebido da clinica (`https://singulare.org/saude/<uuid>`), ou abre direto pelo link (deep link configurado).
2. App valida o token contra `GET /api/saude/<uuid>` — se ok, salva no Keychain/EncryptedSharedPreferences.
3. **Consent screen**: paciente concorda em compartilhar saude do Apple Health / Health Connect.
4. App registra periodic task no WorkManager (a cada 6h).
5. **Home**: paciente ve "Monitoramento ativo", ultimo sync, botao "Sincronizar agora".
6. Em background: `health` package le novos dados desde `last_sync_at` (por LOINC), chama `POST /api/saude/<uuid>/ingest` com batch ate 500 obs.

## Codigo

- [lib/main.dart](lib/main.dart) — entry point + bootstrap (decide Welcome vs Home)
- [lib/config.dart](lib/config.dart) — constantes (API URL, batch size, intervalo sync, retry)
- [lib/models/observation.dart](lib/models/observation.dart) — `Observation`, `Loinc` codes, conversoes SI
- [lib/services/token_service.dart](lib/services/token_service.dart) — armazena/le token, extrai UUID de URL
- [lib/services/install_id.dart](lib/services/install_id.dart) — UUID anonimo + device info (sem IMEI)
- [lib/services/sync_cache.dart](lib/services/sync_cache.dart) — sqflite `last_sync_at` por LOINC
- [lib/services/health_data_engine.dart](lib/services/health_data_engine.dart) — Apple Health / Health Connect via `health` package
- [lib/services/ingest_client.dart](lib/services/ingest_client.dart) — batches 500 + retry exponencial
- [lib/services/background_sync.dart](lib/services/background_sync.dart) — `workmanager` periodico 6h
- [lib/screens/welcome_screen.dart](lib/screens/welcome_screen.dart) — cola/recebe link, valida token
- [lib/screens/consent_screen.dart](lib/screens/consent_screen.dart) — pede permissoes
- [lib/screens/home_screen.dart](lib/screens/home_screen.dart) — status + sync manual

## Backend referenciado

- API base: `https://singulare.org` (`AppConfig.apiBaseUrl`)
- `GET /api/saude/<token>` — valida token + retorna primeiro nome (registra consent na 1a vez)
- `POST /api/saude/<token>/ingest` — recebe batch de ate 500 observacoes, classifica outlier por LOINC, insere em `health_observations`
- Schema: `supabase/migrations/20260510212828_health_observations.sql` + `..._patients_health_collection_token.sql`
- Spec completa: [docs/health-data-spec.md](../../docs/health-data-spec.md)

## Roadmap

- [ ] Plugin nativo iOS pra `HKObserverQuery` + `enableBackgroundDelivery(.immediate)` em FC/HRV/SpO2 (substituindo polling do `health` package)
- [ ] Plugin nativo Android pra Health Connect Changes API com token persistido
- [ ] Tela de historico de medicoes recentes (mock-up dos dados que ja foram enviados)
- [ ] Notificacoes push quando clinica revoga o token (regenera link)
- [ ] OTA updates via Code Push (nao trivial em Flutter)
