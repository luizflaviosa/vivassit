# Singulare — Especificação de Coleta de Dados de Saúde

Documento técnico canônico pra integração com Apple HealthKit (iOS) e Android Health Connect, mapeando todos os biomarcadores que o Singulare coleta. Use esse doc como referência pra:

- Decidir quais data types pedir permissão
- Saber unidades canônicas (pra normalizar antes de enviar pro `health_observations`)
- Configurar `Info.plist` (iOS) e `AndroidManifest.xml` (Android) corretamente
- Entender o que coleta em background vs. precisa de pull manual
- Submeter o app pra review na App Store / Play Store sem bater em rejeição

Fontes: developer.apple.com/documentation/healthkit, developer.android.com/health-and-fitness/health-connect, pub.dev/packages/health (v13.3.1+). Pesquisa fechada em 2026-05-10.

---

## 1. Tabela canônica de biomarcadores

Cada linha aqui é UM tipo de observação que pode acabar em `health_observations.loinc_code`. A coluna LOINC é a chave que o backend usa pra desambiguar.

| Biomarcador | LOINC | Unidade canônica (SI) | HealthKit (iOS) | Health Connect (Android) | Flutter `HealthDataType` |
|---|---|---|---|---|---|
| Frequência cardíaca | **8867-4** | `bpm` (count/min) | `HKQuantityTypeIdentifierHeartRate` | `HeartRateRecord` (sample.beatsPerMinute) | `HEART_RATE` |
| HRV SDNN | **80404-7** | `ms` | `HKQuantityTypeIdentifierHeartRateVariabilitySDNN` | _não disponível_ | `HEART_RATE_VARIABILITY_SDNN` (iOS only) |
| HRV RMSSD | **80404-7** (mesmo LOINC, qualificador difere) | `ms` | _via cálculo de R-R_ | `HeartRateVariabilityRmssdRecord` | `HEART_RATE_VARIABILITY_RMSSD` (Android only) |
| FC em repouso | **40443-4** | `bpm` | `HKQuantityTypeIdentifierRestingHeartRate` | `RestingHeartRateRecord` | `RESTING_HEART_RATE` |
| FC caminhando (avg) | derivar de 8867-4 + qualificador | `bpm` | `HKQuantityTypeIdentifierWalkingHeartRateAverage` | _não disponível direto_ | `WALKING_HEART_RATE` (iOS only) |
| Passos | **41950-7** | `count` (período) | `HKQuantityTypeIdentifierStepCount` | `StepsRecord` (count: Long, intervalo) | `STEPS` |
| Distância caminhada/corrida | **41953-1** | `m` | `HKQuantityTypeIdentifierDistanceWalkingRunning` | `DistanceRecord` (distance: Length) | `DISTANCE_WALKING_RUNNING` |
| Energia ativa queimada | **41981-2** | `kcal` | `HKQuantityTypeIdentifierActiveEnergyBurned` | `ActiveCaloriesBurnedRecord` (energy: Energy) | `ACTIVE_ENERGY_BURNED` |
| SpO2 | **59408-5** | `%` (0–100) | `HKQuantityTypeIdentifierOxygenSaturation` (0.0–1.0 internamente) | `OxygenSaturationRecord` (percentage: 0–100) | `BLOOD_OXYGEN` |
| Pressão arterial sistólica | **8480-6** | `mmHg` | `HKQuantityTypeIdentifierBloodPressureSystolic` | `BloodPressureRecord.systolic` | `BLOOD_PRESSURE_SYSTOLIC` |
| Pressão arterial diastólica | **8462-4** | `mmHg` | `HKQuantityTypeIdentifierBloodPressureDiastolic` | `BloodPressureRecord.diastolic` | `BLOOD_PRESSURE_DIASTOLIC` |
| Peso | **29463-7** | `kg` | `HKQuantityTypeIdentifierBodyMass` | `WeightRecord` (weight: Mass) | `WEIGHT` |
| Temperatura corporal | **8310-5** | `Cel` | `HKQuantityTypeIdentifierBodyTemperature` | `BodyTemperatureRecord` (temperature: Temperature) | `BODY_TEMPERATURE` |
| Glicemia capilar | **2339-0** | `mg/dL` | `HKQuantityTypeIdentifierBloodGlucose` | `BloodGlucoseRecord` (level: BloodGlucose) | `BLOOD_GLUCOSE` |
| R-R interval (beat-to-beat) | **80395-7** | `s` (segundos por batimento) | `HKSeriesType.heartbeatSeriesType()` → `HKHeartbeatSeriesSample` | _não exposto_ | _não exposto no package `health` — precisa channel nativo Swift_ |
| Sono — sessão | **93832-4** (sleep duration) | `s` (duração) | `HKCategoryTypeIdentifierSleepAnalysis` | `SleepSessionRecord` | `SLEEP_SESSION` |
| Sono — estágio | **93830-8** (sleep stage) | _categórico_ | category value enum (ver §3) | `SleepSessionRecord.stages` (lista de Stage) | `SLEEP_AWAKE` / `SLEEP_LIGHT` / `SLEEP_DEEP` / `SLEEP_REM` |

### Notas de unidade

- **Sempre persistir em SI** no banco: `kg`, `m`, `Cel`, `bpm`, `mmHg`, `mg/dL` (clínico BR), `ms`, `s`. Converter na origem (Flutter), nunca depender do display do usuário.
- HealthKit retorna SpO2 como fração `0.0–1.0` — converter pra `0–100` antes de enviar.
- Glicemia: HealthKit aceita `mg/dL` ou `mmol/L`. No Brasil, `mg/dL` é o padrão clínico — fixar isso e converter de `mmol/L` se necessário (`× 18.0182`).
- Temperatura: aceitar `degF` se vier de dispositivo americano (`(F − 32) × 5/9 = Cel`).
- Peso: aceitar `lb` (1 lb = 0.4536 kg).

---

## 2. Permissões iOS (HealthKit)

### Info.plist

Apenas **dois keys** controlam o acesso (granularidade é por chamada `requestAuthorization`):

```xml
<key>NSHealthShareUsageDescription</key>
<string>O Singulare le seus dados de saude do Apple Health (frequencia cardiaca, variabilidade, passos, distancia, sono, pressao, glicemia, peso) para que sua clinica acompanhe sua evolucao clinica.</string>

<key>NSHealthUpdateUsageDescription</key>
<string>O Singulare nao escreve dados no Apple Health no momento. Esta permissao e requerida apenas pela integracao.</string>

<key>UIBackgroundModes</key>
<array>
    <string>fetch</string>
    <string>processing</string>
</array>

<key>BGTaskSchedulerPermittedIdentifiers</key>
<array>
    <string>be.tramckrijte.workmanager.singulare-cardio-sync</string>
</array>
```

### Xcode Capability

- **HealthKit** capability ativada no target Runner (gera entitlement `com.apple.developer.healthkit`).
- Quando se habilita HealthKit no Xcode moderno (Xcode 15+), o entitlement de background delivery (`com.apple.developer.healthkit.background-delivery`) é incluído automaticamente.
- Pra ler **Clinical Health Records** (FHIR de receitas etc), capability separada + key `NSHealthClinicalHealthRecordsShareUsageDescription`. **Não precisa pro MVP** — só biomarcadores agora.

### Granularidade

Apple **não revela ao app** quais data types o usuário negou em read. `authorizationStatus(for:)` só dá certeza pra write. Pra read, o sinal indireto é "query retornou vazio". Estratégia: pedir autorização de TODOS os tipos juntos no onboarding, depois verificar empiricamente quais estão chegando dados.

---

## 3. Permissões Android (Health Connect)

### AndroidManifest.xml

Cada Record corresponde a uma permissão `android.permission.health.READ_*`:

```xml
<!-- Dentro de <manifest>, antes de <application> -->
<uses-permission android:name="android.permission.health.READ_HEART_RATE" />
<uses-permission android:name="android.permission.health.READ_HEART_RATE_VARIABILITY" />
<uses-permission android:name="android.permission.health.READ_RESTING_HEART_RATE" />
<uses-permission android:name="android.permission.health.READ_STEPS" />
<uses-permission android:name="android.permission.health.READ_DISTANCE" />
<uses-permission android:name="android.permission.health.READ_ACTIVE_CALORIES_BURNED" />
<uses-permission android:name="android.permission.health.READ_SLEEP" />
<uses-permission android:name="android.permission.health.READ_OXYGEN_SATURATION" />
<uses-permission android:name="android.permission.health.READ_BLOOD_PRESSURE" />
<uses-permission android:name="android.permission.health.READ_WEIGHT" />
<uses-permission android:name="android.permission.health.READ_BODY_TEMPERATURE" />
<uses-permission android:name="android.permission.health.READ_BLOOD_GLUCOSE" />

<!-- Background access (Android 14+, exige aprovacao manual do usuario na tela do Health Connect) -->
<uses-permission android:name="android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND" />

<!-- Historico > 30 dias retroativo (review extra do Play) -->
<uses-permission android:name="android.permission.health.READ_HEALTH_DATA_HISTORY" />

<!-- Permissoes auxiliares -->
<uses-permission android:name="android.permission.ACTIVITY_RECOGNITION" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_HEALTH" />

<queries>
    <package android:name="com.google.android.apps.healthdata" />
</queries>
```

### Rationale Activity (obrigatória)

Todas as permissões `android.permission.health.*` são sensitive. **Sem essa activity, o Play rejeita o app na review:**

```xml
<!-- Dentro de <application> -->
<activity
    android:name=".PermissionsRationaleActivity"
    android:exported="true"
    android:permission="android.permission.health.READ_DATA">
    <intent-filter>
        <action android:name="androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" />
    </intent-filter>
    <intent-filter>
        <action android:name="android.intent.action.VIEW_PERMISSION_USAGE" />
        <category android:name="android.intent.category.HEALTH_PERMISSIONS" />
    </intent-filter>
</activity>
```

A activity deve mostrar a **política de privacidade** do Singulare (URL `https://singulare.org/privacidade/saude` — criar antes do deploy).

### Formulário Play Console

Submeter "Health Connect access form" justificando cada permissão. `READ_HEALTH_DATA_IN_BACKGROUND` e `READ_HEALTH_DATA_HISTORY` passam por review adicional (~7-14 dias). Submeter em paralelo com primeira versão pra paralelizar prazos.

### Versão mínima

- **API mínima**: 28 (Android 9).
- **Android 13 e inferior**: Health Connect é APK no Play Store (`com.google.android.apps.healthdata`). O app deve detectar via `HealthConnectClient.getSdkStatus(context)` e fazer fallback (mostrar "instale o Health Connect"). Em release builds, abrir Play Store direto com deeplink `market://details?id=com.google.android.apps.healthdata`.
- **Android 14+**: Health Connect é parte do framework, em Settings → Health Connect.

### Provider chain

Health Connect **NÃO COLETA SENSOR DIRETO** — é camada de agregação. Apps "writers" (Samsung Health, Fitbit, Garmin Connect, Mi Fit/Zepp, Oura, Whoop, Polar Flow, Withings, Google Fit legado) gravam Records; nosso app é "reader". Origem do dado em `record.metadata.dataOrigin.packageName`:

| Package | App |
|---|---|
| `com.sec.android.app.shealth` | Samsung Health |
| `com.fitbit.FitbitMobile` | Fitbit |
| `com.garmin.android.apps.connectmobile` | Garmin Connect |
| `com.mi.health` ou `com.huami.watch.hmwatchmanager` | Mi Fit / Zepp Life |
| `com.oura.oura` | Oura |
| `com.whoop.android` | Whoop |
| `com.google.android.apps.fitness` | Google Fit (deprecated) |

Pra desambiguar duplicatas (vários providers gravam o mesmo HR), priorizar por confiabilidade: Apple Watch > Garmin > Oura > Fitbit > Samsung > Google Fit.

---

## 4. Background sync

**Diferença crítica entre as plataformas:**

| Aspecto | iOS HealthKit | Android Health Connect |
|---|---|---|
| Modelo | **Push** via `HKObserverQuery` + `enableBackgroundDelivery` | **Pull** via `WorkManager` (não tem push) |
| Latência mínima | `.immediate` (FC, HRV, SpO2, PA, etc) | Polling configurado (mínimo prático 15min, recomendado 2-6h) |
| Wake-up budget | ~30s por wake-up, iOS coalesce em batches | Limitado por Doze mode + App Standby Buckets (rare bucket = até 24h) |
| Anchor incremental | `HKAnchoredObjectQuery` com `HKQueryAnchor` opaco | `getChangesToken` + `getChanges(token)` — token expira em **30 dias** |
| Background permission | Auto-habilitada com capability HealthKit + entitlement | Explícita: `READ_HEALTH_DATA_IN_BACKGROUND` (user aprova em tela do HC) |

### iOS — padrão recomendado

```swift
// 1. Registrar observer pra FC (e cada outro tipo de interesse)
let hrType = HKObjectType.quantityType(forIdentifier: .heartRate)!
let observer = HKObserverQuery(sampleType: hrType, predicate: nil) { query, completionHandler, error in
    // Aqui o app foi acordado em background. ~30s de budget.
    Task {
        await syncRecentSamples(type: .heartRate)
        completionHandler()  // OBRIGATORIO chamar dentro do prazo
    }
}
healthStore.execute(observer)
healthStore.enableBackgroundDelivery(for: hrType, frequency: .immediate) { ... }

// 2. Pra cumulative (passos), iOS forca .hourly minimo:
healthStore.enableBackgroundDelivery(for: stepsType, frequency: .hourly) { ... }
```

**Limitação:** o package Flutter `health` NÃO expõe `enableBackgroundDelivery` na API pública (confirmar v13.3.1 — pode estar no master). Plano realista: escrever **plugin nativo iOS custom** (Swift) que registra observers + faz upload via `URLSession` background, e usar o package `health` só pro fetch foreground / backfill inicial.

### Android — padrão recomendado

```kotlin
// WorkManager periodic 2h
val syncWork = PeriodicWorkRequestBuilder<HealthSyncWorker>(2, TimeUnit.HOURS)
    .setConstraints(Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .build())
    .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
    .build()
WorkManager.getInstance(context).enqueueUniquePeriodicWork(
    "singulare_health_sync", ExistingPeriodicWorkPolicy.KEEP, syncWork
)

// No worker: usa Changes API
val response = healthConnectClient.getChanges(persistedToken)
response.changes.forEach { ... }
saveToken(response.nextChangesToken)
```

---

## 5. Sleep — diferenças

| iOS (`HKCategoryValueSleepAnalysis`) | Android (`SleepSessionRecord.Stage.stage`) | Tradução interna |
|---|---|---|
| `inBed` (0) | `STAGE_TYPE_AWAKE_IN_BED` (7) | `awake_in_bed` |
| `awake` (2) | `STAGE_TYPE_AWAKE` (1) | `awake` |
| `asleepCore` (3) | `STAGE_TYPE_LIGHT` (4) | `light` |
| `asleepDeep` (4) | `STAGE_TYPE_DEEP` (5) | `deep` |
| `asleepREM` (5) | `STAGE_TYPE_REM` (6) | `rem` |
| `asleepUnspecified` | `STAGE_TYPE_SLEEPING` (2) | `asleep_unspecified` |
| _N/A_ | `STAGE_TYPE_OUT_OF_BED` (3) | `out_of_bed` |
| `asleep` (1, deprecated iOS<16) | _N/A_ | `asleep_legacy` |

**Recomendação:** no `value_text` da observation gravar a string normalizada (`awake`, `light`, `deep`, `rem`, etc). LOINC 93830-8 pra sleep stage, value_text com o estágio, effective_time e effective_period_end pra delimitar o intervalo.

Apple iOS 16+ + Apple Watch Series 4+/watchOS 9 grava estágios reais. iOS <16 só tem `asleep` flat.
No Android, qualidade depende do writer: Samsung/Fitbit/Oura grava direito, Garmin tem inconsistências em REM/Deep, Whoop foca em HR/HRV.

---

## 6. HRV — gap entre plataformas

| Plataforma | Métrica nativa | Como obter equivalente |
|---|---|---|
| **iOS HealthKit** | SDNN (`HKQuantityTypeIdentifierHeartRateVariabilitySDNN`) | Direto, em ms, coletado automaticamente pelo Apple Watch durante repouso/sono. Não tem API pra forçar coleta. |
| **Android Health Connect** | RMSSD (`HeartRateVariabilityRmssdRecord`) | Direto, em ms, escrito por Garmin/Samsung/Wear OS/Oura. Não tem SDNN nativo. |

**Impacto:** se o objetivo for ML pra arritmia, SDNN e RMSSD são correlacionados mas não idênticos. Estratégia:

1. **MVP**: gravar ambos como `loinc_code = 80404-7` mas adicionar coluna `unit` (`ms`) + `display_name` distinto (`HRV SDNN` vs `HRV RMSSD`) e/ou um qualifier em `device_provenance.metric_type`. Modelo de IA aprende com qual subset tem.

2. **Avançado**: calcular HRV próprio a partir de R-R intervals (só iOS via `HKHeartbeatSeriesSample`). Android não expõe RR — só BPM por sample. Precisaria escrever channel custom Kotlin acessando Wear OS Health Services pra wear device direto, o que mata multi-dispositivo.

3. **Cuidado clínico**: nunca apresentar SDNN e RMSSD lado-a-lado pro médico sem diferenciar visualmente — risco de interpretação errada.

---

## 7. R-R intervals (beat-to-beat raw)

- **iOS**: `HKSeriesType.heartbeatSeriesType()` retorna `HKHeartbeatSeriesSample`. Extrair com `HKHeartbeatSeriesQuery` que entrega `timeSinceSeriesStart: TimeInterval` por batimento. Disponível em iOS 13+ / watchOS 6+. Coleta automática durante medições ECG do Apple Watch.
- **Android**: NÃO existe. `HeartRateRecord.samples` dá `beatsPerMinute` agregado (não RR raw).

**Decisão:** R-R não vai pro MVP. Adicionar como Fase 2 quando justificar custo (channel nativo iOS Swift + extração + upload de séries densas que rapidamente excedem 500 obs por batch).

---

## 8. Limitações e armadilhas conhecidas

### iOS

- Sem Apple Watch: nem HR contínuo, nem HRV, nem RestingHR, nem WalkingHR avg, nem SpO2, nem sleep stages, nem R-R. Sobra só passos/distância (sensores M-series do iPhone) e o que paciente entra manualmente ou via dispositivos Bluetooth (BP cuff, balança, glicosímetro).
- `enableBackgroundDelivery` PARA silenciosamente se user "Force Stop" o app ou desinstala/reinstala. Re-registrar em `didFinishLaunchingWithOptions`.
- Quando user desliga `Health → Sharing`, queries continuam executando mas retornam vazio. Implementar heartbeat verificando `authorizationStatus(for:)`.

### Android

- "Always-on background" wakeup automático **NÃO EXISTE**. Sempre polling via WorkManager.
- Doze mode + App Standby Buckets podem deslocar polling pra janelas longas (rare bucket: até 24h). Sem solução fora de pedir user "remover otimização de bateria" pro app — fricção real.
- Provider chain: se o user não tem app writer (Fitbit, Samsung, Garmin) escrevendo no Health Connect, **não há dado pra ler**. Health Connect sozinho não coleta nada.
- `HeartRateVariabilityRmssdRecord` foi adicionado em `connect-client:1.0.0-alpha08`. Apps antigos do user podem não estar escrevendo.

---

## 9. Recomendação arquitetural pro Singulare

### Camadas

1. **Camada 0 — Web manual (já implementada)**: `/saude/<token>` recebe PA, FC, peso, glicemia, etc digitados pelo paciente. Funciona em qualquer celular sem app. **Esse é o backstop universal.**

2. **Camada 1 — Flutter foreground**: package `health` faz auth + fetch inicial (últimos 30d) + sync foreground quando paciente abre o app. Cobre 80% dos casos. Esforço: tasks 8-13 do plano [docs/superpowers/plans/2026-05-10-telemonitoramento-cardiologico.md](superpowers/plans/2026-05-10-telemonitoramento-cardiologico.md).

3. **Camada 2 — Background passivo**: plugin nativo custom (Swift pra iOS, Kotlin pra Android) registrando observers/WorkManager + upload via `URLSession`/OkHttp background. Cobre HRV/sono/FC contínuo coletados silenciosamente. Esforço: ~2 sprints separados.

### Mapeamento pra `health_observations`

Cada sample do HK/HC vira 1 linha em `health_observations`:

```js
{
  patient_id,
  tenant_id,
  category,           // 'vital-signs' | 'activity' | 'sleep' | 'laboratory'
  loinc_code,         // tabela §1
  display_name,       // human-readable PT-BR
  value_numeric,      // valor em unidade canônica
  value_text,         // pra category type (sleep stage etc)
  unit,               // canônica
  effective_time,     // startDate do sample
  effective_period_end, // endDate (pra cumulative/sleep)
  device_provenance: {
    source: 'apple_health' | 'health_connect' | 'web_manual_link',
    platform: 'ios' | 'android' | 'web',
    os_version,
    app_version,
    device_model,
    data_origin_package: 'com.fitbit...', // só Health Connect
    sample_uuid: 'UUID do HKObject'        // pra dedup persistente
  },
  data_quality_tag,   // backend classifica
  raw_payload         // metadata complementar
}
```

### Dedup

- iOS: cada `HKObject` tem `uuid` estável. Persistir como `device_provenance.sample_uuid`. UNIQUE constraint do banco `(patient_id, loinc_code, effective_time)` cobre dedup natural; adicional check em `device_provenance.sample_uuid` evita race em samples com mesmo timestamp.
- Android: Health Connect tem `metadata.id` similar.

---

## 10. Próximos passos

- [ ] Criar página `https://singulare.org/privacidade/saude` (política de privacidade focada em dados de saúde — exigida pra rationale activity do Health Connect e pra App Store review).
- [ ] Submeter Health Connect access form no Play Console quando build Android estiver pronto.
- [ ] Configurar capability HealthKit + entitlements no projeto iOS Xcode quando build estiver pronto.
- [ ] Validar empiricamente: instalar app em dispositivo de teste com Apple Watch e dispositivo Android com Fitbit/Samsung escrevendo. Conferir quais data types chegam.
- [ ] Definir política de retenção (LGPD): por quanto tempo guardar `health_observations`? `device_provenance` tem dados pessoais.
- [ ] Criar tabela `patient_consents` (já no plano) registrando consentimento granular por categoria de dado.
- [ ] Decidir SDNN vs RMSSD: aceitar ambos no MVP com qualifier ou padronizar em RMSSD (mais comum) calculando dele dos dispositivos iOS quando R-R disponível.

---

## Fontes

- developer.apple.com/documentation/healthkit
- developer.apple.com/documentation/healthkit/data_types
- developer.apple.com/documentation/healthkit/hkquantitytypeidentifier
- developer.android.com/health-and-fitness/health-connect/data-types
- developer.android.com/reference/kotlin/androidx/health/connect/client/records/package-summary
- developer.android.com/health-and-fitness/health-connect/ui/permissions
- developer.android.com/health-and-fitness/health-connect/migration/fit
- developer.android.com/jetpack/androidx/releases/health-connect
- pub.dev/packages/health
