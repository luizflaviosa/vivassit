# Singulare Health

App Flutter proxy que extrai dados do Apple Health (HealthKit) e transmite ao backend do Singulare via ROOK SDK. Existe porque o app oficial da ROOK nao esta listado na App Store Brasil. Foco clinico: RPM cardiologico (heart rate, HRV, SpO2, atividade, sono).

## Stack

- Flutter `>=3.38.0` / Dart `^3.5.0`
- `rook_sdk_apple_health` (engloba core + transmission)
- iOS 14+ (HealthKit + BGTaskScheduler)

## Estrutura

```
mobile/singulare_health/
├── pubspec.yaml
├── analysis_options.yaml
├── lib/
│   ├── config.dart                  # credenciais ROOK (sandbox + dart-define)
│   ├── theme.dart                   # design tokens Singulare (cores, tipografia, spacing)
│   ├── main.dart                    # bootstrap: init SDK + bind user + roteamento
│   ├── services/
│   │   ├── rook_service.dart        # ciclo de vida ROOK (init, permissoes, sync, bg)
│   │   └── onboarding_state.dart    # persiste consent LGPD (shared_preferences)
│   ├── widgets/
│   │   ├── primary_button.dart      # botao primario (dark/accent/ghost)
│   │   └── status_card.dart         # card de status com icone tinted + pulse animado
│   └── screens/
│       ├── welcome_screen.dart      # intro com 3 beneficios + CTA Comecar
│       ├── consent_screen.dart      # consent LGPD passo a passo + checkbox
│       └── home_screen.dart         # botao "Ativar Monitoramento" + status + metricas
└── ios/Runner/Info.plist            # HealthKit + UIBackgroundModes + BGTask IDs
```

## Fluxo de usuario

```
Welcome   →   Consent   →   Home (idle)   →   Home (active)
  intro      LGPD passo       botao              status verde
  beneficios   a passo        principal          + sinais transmitidos
                              + permissoes
                              + sync inicial
```

Estado persistido em `shared_preferences` (`OnboardingState.hasConsented()`). Reabrir o app apos consent vai direto pra Home. "Revogar consentimento" (menu na Home) limpa o estado e volta pra Welcome.

## Setup local

```bash
cd mobile/singulare_health

# 1. Gerar plataforma nativa (apenas iOS, Android opcional)
flutter create --platforms=ios --org=org.singulare .

# 2. Instalar dependencias
flutter pub get

# 3. Pods iOS
cd ios && pod install && cd ..
```

> O comando `flutter create` nao sobrescreve `lib/`, `pubspec.yaml` nem `ios/Runner/Info.plist` se eles ja existirem. Confira com `git status` antes de commitar.

## Credenciais (sandbox)

Estao em `lib/config.dart` como defaults via `String.fromEnvironment`. Para o sandbox de teste atual:

| Chave | Valor |
|---|---|
| Client UUID | `b1717749-896e-4dd3-8191-150f6bc166f8` |
| Secret Key | `0gCITss03CnDhIyIO5rz5iFeX1uJw8J6CeN7` |
| Environment | `RookEnvironment.sandbox` |
| User ID teste | `singulare-pat-57` |

Em producao, sobrescrever no momento do build:

```bash
flutter run --release \
  --dart-define=ROOK_CLIENT_UUID=$ROOK_CLIENT_UUID \
  --dart-define=ROOK_SECRET=$ROOK_SECRET \
  --dart-define=ROOK_USER_ID=$ROOK_USER_ID
```

As secrets reais ficam fora do git (Vercel/GitHub Secrets). Nunca commitar Secret Key real.

## Configuracao Xcode (obrigatoria)

1. Abrir `ios/Runner.xcworkspace` no Xcode.
2. Selecionar o target `Runner` → aba `Signing & Capabilities`.
3. Clicar `+ Capability` e adicionar:
   - **HealthKit** → marcar `Clinical Health Records` se for usar, e principalmente `Background Delivery` para entrega passiva.
   - **Background Modes** → marcar `Background fetch` e `Background processing`.
4. Verificar que o `Info.plist` (ja incluido neste repo) contem:
   - `NSHealthShareUsageDescription` e `NSHealthUpdateUsageDescription`
   - `UIBackgroundModes` com `fetch` e `processing`
   - `BGTaskSchedulerPermittedIdentifiers` com `io.tryrook.background.summaries` e `io.tryrook.background.events`
5. Definir `Bundle Identifier`: ex `org.singulare.bridge`.
6. Em `Build Settings` → `iOS Deployment Target`: `14.0` ou superior.
7. Conectar conta Apple Developer (`Team`) com perfil que tenha HealthKit habilitado no App ID.

## Tipos de dados HealthKit solicitados

O ROOK SDK abstrai os HKObjectTypes. Em uma unica sheet o app pede leitura para:

**Cardiologicos**
- Heart Rate (min/max/medio/repouso)
- Heart Rate Variability (SDNN e RMSSD)

**Fisiologicos**
- Oxygen Saturation
- VO2 Max
- Respiratory Rate

**Atividade e sono**
- Steps, Active Energy / Calories
- Distance Walking + Running
- Sleep Analysis (duracao + estagios)

## Rodando no iPhone fisico (sandbox)

1. Conectar iPhone fisico (iOS 14+) via cabo.
2. No iPhone: `Ajustes` → `Apple Account` → `Confiar neste Mac`.
3. No terminal:
   ```bash
   flutter devices            # confirma que o iPhone aparece
   flutter run --release      # release evita timeouts do BGTaskScheduler em debug
   ```
4. No app: tocar **"Ativar Monitoramento Medico"**.
5. iOS abrira a sheet do HealthKit → marcar `Permitir Todas as Categorias`.
6. Apos o consentimento, o app chama `syncAllData()` (resumos + eventos de ontem) e habilita o background sync.

## Verificando o webhook ROOK

Cada chamada de `syncAllData()` loga no console:

- Sucesso: `Data transmitted successfully: <bucket>`
- Falha: `Error enqueuing data: <bucket> -> <erro>`

Ler com:

```bash
flutter logs                      # console do device
# ou
xcrun simctl spawn booted log stream --predicate 'subsystem == "singulare_health"'
```

No dashboard ROOK (sandbox): `Logs` → filtrar por `User ID = singulare-pat-57` → conferir resumos diarios e eventos cardiacos chegando.

## Background sync

`enableBackgroundSync()` agenda dois jobs BGTaskScheduler:

- `io.tryrook.background.summaries` — resumos diarios (1x/dia)
- `io.tryrook.background.events` — eventos cardiacos granulares (~a cada 6h)

iOS decide quando rodar baseado em uso, bateria e conectividade. Para testar manualmente, em Xcode com o app pausado num breakpoint:

```
e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateLaunchForTaskWithIdentifier:@"io.tryrook.background.summaries"]
```

## Proximas integracoes (fora deste app)

- Rota `app/api/saude/rook-webhook` no `app/app/` recebe os eventos via webhook ROOK → grava em `saude_eventos` (Supabase).
- Painel medico (`app/app/dashboard/saude/...`) consome os dados.
- Onboarding gera um `ROOK_USER_ID` por paciente, vinculado em `tenant_members.rook_user_id`.

## Troubleshooting

| Sintoma | Causa provavel | Acao |
|---|---|---|
| Sheet de permissoes nao aparece | HealthKit capability nao foi adicionada no Xcode | Adicionar em `Signing & Capabilities` |
| `Error enqueuing data: 401` | Client UUID ou Secret invalidos | Conferir `--dart-define` ou `config.dart` |
| `Error enqueuing data: 404` | User ID nao registrado no ROOK | Verificar se `bindUser()` rodou e ROOK criou o usuario |
| Background sync nao dispara | Build em debug + iOS poupa bateria | Rodar em `--release` e usar o device por algumas horas |
| Logs nativos nao aparecem | `enableNativeLogs` desligado | `--dart-define=ROOK_NATIVE_LOGS=true` (default em sandbox) |
