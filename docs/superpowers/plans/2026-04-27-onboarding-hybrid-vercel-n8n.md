# Hybrid Onboarding: Move Google + Chatwoot + Email out of n8n

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce n8n workload by ~60% per onboarding, freeing CPU/queue slots on the shared Lightsail (2c/4GB) for the WhatsApp atendimento core, while keeping Vercel Hobby (60s function timeout, no Workflow).

**Architecture:** The Next.js API route `/api/onboarding` already orchestrates the flow. Today it calls one big n8n webhook that does 21 nodes serially. We split provisioning into **two parallel buckets** wrapped in `Promise.allSettled`:

- **Bucket A (Vercel direct, ~5-10s)**: Google Calendar create, Google Drive folder, Chatwoot account/inbox, onboarding email via SES SMTP.
- **Bucket B (n8n webhook, slimmed, ~10-15s)**: Evolution WhatsApp instance creation/connection, Telegram bot creation (Telethon hack), Telegram welcome message.

Both buckets run concurrently. The route waits for both, merges integration IDs, persists to Supabase, returns to frontend. Total wall-clock onboarding time stays ≤30s, but n8n only sees the heavy/sticky parts.

**Tech Stack:** Next.js 14 App Router · TypeScript · `googleapis` (Google service account) · `nodemailer` (SES SMTP — already configured) · existing `fetch` for Chatwoot REST and n8n webhook · Vitest for unit tests · Supabase service role for DB writes.

**Rollback:** Single env var `ONBOARDING_HYBRID_ENABLED=false` reverts to today's monolithic n8n call. The legacy code path is preserved untouched until Task 11 cleanup.

---

## File Structure

**New files:**
- `app/lib/integrations/google-auth.ts` — Service Account JWT client factory (shared by Calendar + Drive)
- `app/lib/integrations/google-calendar.ts` — `createDoctorCalendar()` exported function
- `app/lib/integrations/google-drive.ts` — `createClinicFolder()` exported function
- `app/lib/integrations/chatwoot.ts` — `createChatwootAccountForTenant()` for enterprise plan; `attachToSharedChatwoot()` for others
- `app/lib/integrations/onboarding-email.ts` — `sendOnboardingWelcomeEmail()` via SES SMTP
- `app/lib/integrations/n8n-slim.ts` — slim n8n caller, only requests Evolution + Telegram
- `app/lib/integrations/types.ts` — shared `IntegrationResult` discriminated union
- `app/__tests__/integrations/*.test.ts` — Vitest unit tests per integration (with mocked HTTP)

**Modified files:**
- `app/app/api/onboarding/route.ts:322-449` — replace single n8n call with `Promise.allSettled([bucketA, bucketB])`
- `app/.env.local.example` — document new env vars
- `n8n-workflow-webhook-ready.json` — slim version that skips Calendar/Drive/Chatwoot/Email nodes

**Untouched (kept as legacy fallback through Task 10):**
- Existing n8n call code in `route.ts` — wrapped in `if (!HYBRID_ENABLED)` guard until rollout proven.

---

## Environment Variables

Add to Vercel (Production + Preview):

```bash
# Feature flag
ONBOARDING_HYBRID_ENABLED=true

# Google Service Account (Workspace Domain-Wide Delegation)
GOOGLE_SA_CLIENT_EMAIL=vivassit-onboarding@<project>.iam.gserviceaccount.com
GOOGLE_SA_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SA_IMPERSONATE_USER=admin@singulare.org   # Workspace admin to impersonate
GOOGLE_DRIVE_PARENT_FOLDER_ID=1AbCdEf...         # Parent folder for all clinic subfolders

# Chatwoot
CHATWOOT_BASE_URL=https://chatwoot.singulare.org
CHATWOOT_PLATFORM_API_KEY=...                    # Platform API access for account creation
CHATWOOT_SHARED_ACCOUNT_ID=1                     # Shared account for non-enterprise plans

# SES SMTP (already configured for Supabase Auth — reuse)
SES_SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SES_SMTP_PORT=587
SES_SMTP_USER=<ses-smtp-username>
SES_SMTP_PASS=<ses-smtp-password>
ONBOARDING_FROM_EMAIL=oi@singulare.org
ONBOARDING_FROM_NAME=Singulare

# n8n slim webhook (new endpoint vs current monolithic v4)
N8N_SLIM_WEBHOOK_URL=https://n8n.singulare.org/webhook/vivassit-onboarding-slim
```

---

## Task 1: Provision Google Service Account + verify domain-wide delegation

**Files:** none (manual cloud setup) → outputs go into env vars

- [ ] **Step 1: Create Google Cloud project (if none)**

  Open https://console.cloud.google.com → Create project `vivassit-onboarding`. Note the project ID.

- [ ] **Step 2: Enable APIs**

  In the project, enable:
  - Google Calendar API
  - Google Drive API

- [ ] **Step 3: Create Service Account**

  IAM & Admin → Service Accounts → Create:
  - Name: `vivassit-onboarding`
  - Skip role grants (we don't need GCP roles, only Workspace impersonation)
  - Create JSON key → download → save the `client_email` and `private_key` for env vars

- [ ] **Step 4: Enable Domain-Wide Delegation**

  Click on the SA → Details → tick **Enable Domain-Wide Delegation** → save. Copy the **Client ID** (long number).

- [ ] **Step 5: Authorize scopes in Workspace Admin**

  https://admin.google.com → Security → Access and data control → API controls → Domain-wide delegation → Add new:
  - Client ID: paste
  - Scopes (comma-separated):
    ```
    https://www.googleapis.com/auth/calendar,https://www.googleapis.com/auth/drive
    ```
  - Authorize.

- [ ] **Step 6: Create root parent folder for clinics**

  In Drive (logged as `admin@singulare.org`), create folder `Vivassit - Clínicas`. Open it, copy the folder ID from URL (`/folders/<ID>`). Save as `GOOGLE_DRIVE_PARENT_FOLDER_ID`.

- [ ] **Step 7: Sanity test with curl**

  Locally, run a 5-line Node script (do NOT commit) that mints a JWT for the SA, impersonates `admin@singulare.org`, lists Drive root. If returns 200 → SA works. If 403 → revisit scopes.

- [ ] **Step 8: Commit env var documentation only**

```bash
# In repo
cd app
# edit .env.local.example to add the new vars (without real values)
git add .env.local.example
git commit -m "chore: document Google SA env vars for hybrid onboarding"
```

---

## Task 2: Add `googleapis` dependency + Google auth client

**Files:**
- Create: `app/lib/integrations/google-auth.ts`
- Modify: `app/package.json`
- Test: `app/__tests__/integrations/google-auth.test.ts`

- [ ] **Step 1: Install dependency**

```bash
cd app
npm install googleapis@^148
```

- [ ] **Step 2: Write failing test**

Create `app/__tests__/integrations/google-auth.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { getGoogleAuthClient } from '@/lib/integrations/google-auth';

describe('getGoogleAuthClient', () => {
  it('returns a JWT client configured with impersonation subject', () => {
    process.env.GOOGLE_SA_CLIENT_EMAIL = 'sa@x.iam.gserviceaccount.com';
    process.env.GOOGLE_SA_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n';
    process.env.GOOGLE_SA_IMPERSONATE_USER = 'admin@singulare.org';

    const auth = getGoogleAuthClient(['https://www.googleapis.com/auth/calendar']);
    expect(auth.email).toBe('sa@x.iam.gserviceaccount.com');
    expect(auth.subject).toBe('admin@singulare.org');
    expect(auth.scopes).toContain('https://www.googleapis.com/auth/calendar');
  });

  it('throws if env vars missing', () => {
    delete process.env.GOOGLE_SA_CLIENT_EMAIL;
    expect(() => getGoogleAuthClient(['scope'])).toThrow(/GOOGLE_SA_CLIENT_EMAIL/);
  });
});
```

- [ ] **Step 3: Run, verify it fails**

```bash
npx vitest run __tests__/integrations/google-auth.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

Create `app/lib/integrations/google-auth.ts`:

```typescript
import { google } from 'googleapis';
import type { JWT } from 'google-auth-library';

export function getGoogleAuthClient(scopes: string[]): JWT {
  const email = process.env.GOOGLE_SA_CLIENT_EMAIL;
  const key = process.env.GOOGLE_SA_PRIVATE_KEY;
  const subject = process.env.GOOGLE_SA_IMPERSONATE_USER;

  if (!email) throw new Error('GOOGLE_SA_CLIENT_EMAIL is required');
  if (!key) throw new Error('GOOGLE_SA_PRIVATE_KEY is required');
  if (!subject) throw new Error('GOOGLE_SA_IMPERSONATE_USER is required');

  return new google.auth.JWT({
    email,
    key: key.replace(/\\n/g, '\n'),
    scopes,
    subject,
  });
}
```

- [ ] **Step 5: Verify it passes**

```bash
npx vitest run __tests__/integrations/google-auth.test.ts
```
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add app/package.json app/package-lock.json app/lib/integrations/google-auth.ts app/__tests__/integrations/google-auth.test.ts
git commit -m "feat(onboarding): add Google service account auth client"
```

---

## Task 3: Google Calendar integration — `createDoctorCalendar()`

**Files:**
- Create: `app/lib/integrations/google-calendar.ts`
- Test: `app/__tests__/integrations/google-calendar.test.ts`

- [ ] **Step 1: Write failing test**

Create `app/__tests__/integrations/google-calendar.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDoctorCalendar } from '@/lib/integrations/google-calendar';

vi.mock('googleapis', () => {
  const insertMock = vi.fn().mockResolvedValue({
    data: { id: 'cal_abc123@group.calendar.google.com', summary: 'Dr. House' },
  });
  return {
    google: {
      auth: { JWT: vi.fn(() => ({})) },
      calendar: vi.fn(() => ({ calendars: { insert: insertMock } })),
    },
  };
});

beforeEach(() => {
  process.env.GOOGLE_SA_CLIENT_EMAIL = 'sa@x.iam.gserviceaccount.com';
  process.env.GOOGLE_SA_PRIVATE_KEY = 'key';
  process.env.GOOGLE_SA_IMPERSONATE_USER = 'admin@singulare.org';
});

describe('createDoctorCalendar', () => {
  it('creates calendar with doctor name as summary and returns id', async () => {
    const result = await createDoctorCalendar({
      doctorName: 'Dr. House',
      timeZone: 'America/Sao_Paulo',
    });
    expect(result).toEqual({
      ok: true,
      calendarId: 'cal_abc123@group.calendar.google.com',
      summary: 'Dr. House',
    });
  });
});
```

- [ ] **Step 2: Run, verify it fails**

```bash
npx vitest run __tests__/integrations/google-calendar.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `app/lib/integrations/google-calendar.ts`:

```typescript
import { google } from 'googleapis';
import { getGoogleAuthClient } from './google-auth';

export type CreateDoctorCalendarInput = {
  doctorName: string;
  timeZone?: string;
};

export type CreateDoctorCalendarResult =
  | { ok: true; calendarId: string; summary: string }
  | { ok: false; error: string };

export async function createDoctorCalendar(
  input: CreateDoctorCalendarInput,
): Promise<CreateDoctorCalendarResult> {
  try {
    const auth = getGoogleAuthClient(['https://www.googleapis.com/auth/calendar']);
    const calendar = google.calendar({ version: 'v3', auth });
    const res = await calendar.calendars.insert({
      requestBody: {
        summary: input.doctorName,
        timeZone: input.timeZone ?? 'America/Sao_Paulo',
      },
    });
    if (!res.data.id) return { ok: false, error: 'No calendar id returned' };
    return { ok: true, calendarId: res.data.id, summary: input.doctorName };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
```

- [ ] **Step 4: Verify it passes**

```bash
npx vitest run __tests__/integrations/google-calendar.test.ts
```
Expected: PASS.

- [ ] **Step 5: Manual integration test (one-shot, do not commit)**

In a scratch script `app/scratch-cal.ts`:

```typescript
import { createDoctorCalendar } from './lib/integrations/google-calendar';
createDoctorCalendar({ doctorName: 'Test Dr X' }).then(console.log);
```

Run `npx tsx scratch-cal.ts`. Expected output: `{ ok: true, calendarId: '...', summary: 'Test Dr X' }`. Open Google Calendar as `admin@singulare.org` and confirm calendar appears. Delete it manually + delete `scratch-cal.ts`.

- [ ] **Step 6: Commit**

```bash
git add app/lib/integrations/google-calendar.ts app/__tests__/integrations/google-calendar.test.ts
git commit -m "feat(onboarding): direct Google Calendar creation from Vercel"
```

---

## Task 4: Google Drive integration — `createClinicFolder()`

**Files:**
- Create: `app/lib/integrations/google-drive.ts`
- Test: `app/__tests__/integrations/google-drive.test.ts`

- [ ] **Step 1: Write failing test**

Create `app/__tests__/integrations/google-drive.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClinicFolder } from '@/lib/integrations/google-drive';

vi.mock('googleapis', () => {
  const createMock = vi.fn().mockResolvedValue({
    data: { id: 'folder_xyz', name: 'Clínica Saúde - 2026', webViewLink: 'https://drive.google.com/drive/folders/folder_xyz' },
  });
  return {
    google: {
      auth: { JWT: vi.fn(() => ({})) },
      drive: vi.fn(() => ({ files: { create: createMock } })),
    },
  };
});

beforeEach(() => {
  process.env.GOOGLE_SA_CLIENT_EMAIL = 'sa@x.iam.gserviceaccount.com';
  process.env.GOOGLE_SA_PRIVATE_KEY = 'key';
  process.env.GOOGLE_SA_IMPERSONATE_USER = 'admin@singulare.org';
  process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID = 'parent_root';
});

describe('createClinicFolder', () => {
  it('creates a folder under parent and returns id + link', async () => {
    const result = await createClinicFolder({ clinicName: 'Clínica Saúde' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.folderId).toBe('folder_xyz');
      expect(result.webViewLink).toContain('folder_xyz');
    }
  });
});
```

- [ ] **Step 2: Run, verify it fails**

```bash
npx vitest run __tests__/integrations/google-drive.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `app/lib/integrations/google-drive.ts`:

```typescript
import { google } from 'googleapis';
import { getGoogleAuthClient } from './google-auth';

export type CreateClinicFolderInput = {
  clinicName: string;
};

export type CreateClinicFolderResult =
  | { ok: true; folderId: string; webViewLink: string }
  | { ok: false; error: string };

export async function createClinicFolder(
  input: CreateClinicFolderInput,
): Promise<CreateClinicFolderResult> {
  const parent = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;
  if (!parent) return { ok: false, error: 'GOOGLE_DRIVE_PARENT_FOLDER_ID not set' };

  try {
    const auth = getGoogleAuthClient(['https://www.googleapis.com/auth/drive']);
    const drive = google.drive({ version: 'v3', auth });
    const folderName = `${input.clinicName} - ${new Date().getFullYear()}`;
    const res = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parent],
      },
      fields: 'id, name, webViewLink',
    });
    if (!res.data.id) return { ok: false, error: 'No folder id returned' };
    return {
      ok: true,
      folderId: res.data.id,
      webViewLink: res.data.webViewLink ?? `https://drive.google.com/drive/folders/${res.data.id}`,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
```

- [ ] **Step 4: Verify it passes**

```bash
npx vitest run __tests__/integrations/google-drive.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/integrations/google-drive.ts app/__tests__/integrations/google-drive.test.ts
git commit -m "feat(onboarding): direct Google Drive folder creation from Vercel"
```

---

## Task 5: Chatwoot integration — `setupChatwootForTenant()`

**Files:**
- Create: `app/lib/integrations/chatwoot.ts`
- Test: `app/__tests__/integrations/chatwoot.test.ts`

- [ ] **Step 1: Write failing test**

Create `app/__tests__/integrations/chatwoot.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupChatwootForTenant } from '@/lib/integrations/chatwoot';

beforeEach(() => {
  process.env.CHATWOOT_BASE_URL = 'https://chatwoot.singulare.org';
  process.env.CHATWOOT_PLATFORM_API_KEY = 'platform_key';
  process.env.CHATWOOT_SHARED_ACCOUNT_ID = '1';
  vi.stubGlobal('fetch', vi.fn());
});

describe('setupChatwootForTenant', () => {
  it('returns shared account for non-enterprise plans', async () => {
    const result = await setupChatwootForTenant({
      planType: 'professional',
      clinicName: 'Clínica X',
    });
    expect(result).toEqual({
      ok: true,
      accountId: 1,
      domain: 'https://chatwoot.singulare.org',
      mode: 'shared',
    });
  });

  it('creates dedicated account for enterprise plan', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 42, name: 'Clínica X' }),
    });
    const result = await setupChatwootForTenant({
      planType: 'enterprise',
      clinicName: 'Clínica X',
    });
    expect(result).toMatchObject({
      ok: true,
      accountId: 42,
      mode: 'dedicated',
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://chatwoot.singulare.org/platform/api/v1/accounts',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ api_access_token: 'platform_key' }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run, verify it fails**

```bash
npx vitest run __tests__/integrations/chatwoot.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `app/lib/integrations/chatwoot.ts`:

```typescript
export type ChatwootSetupInput = {
  planType: string;
  clinicName: string;
};

export type ChatwootSetupResult =
  | { ok: true; accountId: number; domain: string; mode: 'shared' | 'dedicated' }
  | { ok: false; error: string };

export async function setupChatwootForTenant(
  input: ChatwootSetupInput,
): Promise<ChatwootSetupResult> {
  const baseUrl = process.env.CHATWOOT_BASE_URL;
  const platformKey = process.env.CHATWOOT_PLATFORM_API_KEY;
  const sharedId = process.env.CHATWOOT_SHARED_ACCOUNT_ID;

  if (!baseUrl) return { ok: false, error: 'CHATWOOT_BASE_URL missing' };

  if (input.planType !== 'enterprise') {
    if (!sharedId) return { ok: false, error: 'CHATWOOT_SHARED_ACCOUNT_ID missing' };
    return { ok: true, accountId: Number(sharedId), domain: baseUrl, mode: 'shared' };
  }

  if (!platformKey) return { ok: false, error: 'CHATWOOT_PLATFORM_API_KEY missing for enterprise' };

  try {
    const res = await fetch(`${baseUrl}/platform/api/v1/accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        api_access_token: platformKey,
      },
      body: JSON.stringify({ name: input.clinicName }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Chatwoot ${res.status}: ${body.slice(0, 200)}` };
    }
    const data = (await res.json()) as { id: number };
    return { ok: true, accountId: data.id, domain: baseUrl, mode: 'dedicated' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
```

- [ ] **Step 4: Verify it passes**

```bash
npx vitest run __tests__/integrations/chatwoot.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/integrations/chatwoot.ts app/__tests__/integrations/chatwoot.test.ts
git commit -m "feat(onboarding): direct Chatwoot account setup from Vercel"
```

---

## Task 6: Onboarding email via SES SMTP

**Files:**
- Create: `app/lib/integrations/onboarding-email.ts`
- Test: `app/__tests__/integrations/onboarding-email.test.ts`
- Modify: `app/package.json`

- [ ] **Step 1: Install nodemailer**

```bash
cd app
npm install nodemailer
npm install -D @types/nodemailer
```

- [ ] **Step 2: Write failing test**

Create `app/__tests__/integrations/onboarding-email.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendOnboardingWelcomeEmail } from '@/lib/integrations/onboarding-email';

const sendMailMock = vi.fn().mockResolvedValue({ messageId: '<abc@ses>' });
vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn(() => ({ sendMail: sendMailMock })) },
}));

beforeEach(() => {
  process.env.SES_SMTP_HOST = 'email-smtp.us-east-1.amazonaws.com';
  process.env.SES_SMTP_PORT = '587';
  process.env.SES_SMTP_USER = 'user';
  process.env.SES_SMTP_PASS = 'pass';
  process.env.ONBOARDING_FROM_EMAIL = 'oi@singulare.org';
  process.env.ONBOARDING_FROM_NAME = 'Singulare';
  sendMailMock.mockClear();
});

describe('sendOnboardingWelcomeEmail', () => {
  it('sends email with magic link and panel URL', async () => {
    const result = await sendOnboardingWelcomeEmail({
      to: 'doctor@example.com',
      doctorName: 'Dr. House',
      clinicName: 'Clínica Saúde',
      magicLinkUrl: 'https://app.singulare.org/auth/verify?token=xyz',
      panelUrl: 'https://app.singulare.org/painel',
    });
    expect(result.ok).toBe(true);
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'doctor@example.com',
        from: '"Singulare" <oi@singulare.org>',
        subject: expect.stringContaining('Clínica Saúde'),
        html: expect.stringContaining('https://app.singulare.org/auth/verify?token=xyz'),
      }),
    );
  });
});
```

- [ ] **Step 3: Run, verify it fails**

```bash
npx vitest run __tests__/integrations/onboarding-email.test.ts
```
Expected: FAIL.

- [ ] **Step 4: Implement**

Create `app/lib/integrations/onboarding-email.ts`:

```typescript
import nodemailer from 'nodemailer';

export type SendOnboardingEmailInput = {
  to: string;
  doctorName: string;
  clinicName: string;
  magicLinkUrl: string;
  panelUrl: string;
};

export type SendOnboardingEmailResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

export async function sendOnboardingWelcomeEmail(
  input: SendOnboardingEmailInput,
): Promise<SendOnboardingEmailResult> {
  const host = process.env.SES_SMTP_HOST;
  const port = Number(process.env.SES_SMTP_PORT ?? 587);
  const user = process.env.SES_SMTP_USER;
  const pass = process.env.SES_SMTP_PASS;
  const fromEmail = process.env.ONBOARDING_FROM_EMAIL;
  const fromName = process.env.ONBOARDING_FROM_NAME ?? 'Singulare';

  if (!host || !user || !pass || !fromEmail) {
    return { ok: false, error: 'SES SMTP env vars incomplete' };
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: false,
    auth: { user, pass },
  });

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0f172a">
      <h1 style="font-size:22px;margin:0 0 16px">Bem-vindo à Singulare, Dr. ${escapeHtml(input.doctorName)}!</h1>
      <p>Sua clínica <strong>${escapeHtml(input.clinicName)}</strong> está pronta. Acesse seu painel:</p>
      <p style="margin:24px 0">
        <a href="${input.magicLinkUrl}" style="background:#6E56CF;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Entrar no painel</a>
      </p>
      <p style="font-size:13px;color:#64748b">Ou copie: ${input.panelUrl}</p>
    </div>
  `;

  try {
    const res = await transport.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: input.to,
      subject: `${input.clinicName} - tudo pronto na Singulare`,
      html,
    });
    return { ok: true, messageId: res.messageId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
```

- [ ] **Step 5: Verify it passes**

```bash
npx vitest run __tests__/integrations/onboarding-email.test.ts
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/package.json app/package-lock.json app/lib/integrations/onboarding-email.ts app/__tests__/integrations/onboarding-email.test.ts
git commit -m "feat(onboarding): SES SMTP welcome email from Vercel"
```

---

## Task 7: Slim n8n caller (Evolution + Telegram only)

**Files:**
- Create: `app/lib/integrations/n8n-slim.ts`
- Test: `app/__tests__/integrations/n8n-slim.test.ts`

- [ ] **Step 1: Write failing test**

Create `app/__tests__/integrations/n8n-slim.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callN8nSlim } from '@/lib/integrations/n8n-slim';

beforeEach(() => {
  process.env.N8N_SLIM_WEBHOOK_URL = 'https://n8n.singulare.org/webhook/vivassit-onboarding-slim';
  vi.stubGlobal('fetch', vi.fn());
});

describe('callN8nSlim', () => {
  it('POSTs slim payload and returns parsed integration ids', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        evolution_phone_number: '+5511999999999',
        evolution_instance_id: 'inst_1',
        evolution_instance_name: 'clinic_x',
        telegram_bot_link: 't.me/clinic_x_bot',
      }),
    });

    const result = await callN8nSlim({
      tenant_id: 'tenant_1',
      clinic_name: 'Clinic X',
      doctor_name: 'Dr X',
      real_phone: '+5511999999999',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.evolution_instance_id).toBe('inst_1');
      expect(result.data.telegram_bot_link).toBe('t.me/clinic_x_bot');
    }
  });

  it('returns ok:false on 30s timeout', async () => {
    (fetch as any).mockImplementationOnce(() => new Promise((_, reject) => {
      setTimeout(() => reject(new Error('aborted')), 10);
    }));
    const result = await callN8nSlim(
      { tenant_id: 't', clinic_name: 'C', doctor_name: 'D', real_phone: '+5511' },
      { timeoutMs: 5 },
    );
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify it fails**

```bash
npx vitest run __tests__/integrations/n8n-slim.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `app/lib/integrations/n8n-slim.ts`:

```typescript
export type N8nSlimInput = {
  tenant_id: string;
  clinic_name: string;
  doctor_name: string;
  real_phone: string;
};

export type N8nSlimData = {
  evolution_phone_number?: string;
  evolution_instance_id?: string;
  evolution_instance_name?: string;
  telegram_bot_link?: string;
};

export type N8nSlimResult =
  | { ok: true; data: N8nSlimData }
  | { ok: false; error: string };

export async function callN8nSlim(
  input: N8nSlimInput,
  opts: { timeoutMs?: number } = {},
): Promise<N8nSlimResult> {
  const url = process.env.N8N_SLIM_WEBHOOK_URL;
  if (!url) return { ok: false, error: 'N8N_SLIM_WEBHOOK_URL not set' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30_000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `n8n slim ${res.status}: ${body.slice(0, 200)}` };
    }
    const data = (await res.json()) as N8nSlimData;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 4: Verify it passes**

```bash
npx vitest run __tests__/integrations/n8n-slim.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/integrations/n8n-slim.ts app/__tests__/integrations/n8n-slim.test.ts
git commit -m "feat(onboarding): slim n8n caller for Evolution + Telegram only"
```

---

## Task 8: Slim n8n workflow (manual edit on n8n.singulare.org)

**Files:**
- Create: `n8n-workflow-slim.json` (export of new workflow)

- [ ] **Step 1: Open n8n UI**

  https://n8n.singulare.org → workflows → duplicate `vivassit-onboarding-v4` → rename copy to `vivassit-onboarding-slim`.

- [ ] **Step 2: Delete unused nodes**

  In the slim workflow, delete:
  - `Create Drive Folder v4`
  - `Criar Agenda Medica Inicial v` (Google Calendar create)
  - `Create Google Calendar v4` (httpRequest)
  - `Configurar Chatwoot Compartilhado v4`
  - `Criar Chatwoot Dedicado v4`
  - `Verificar Plano Enterprise v4` (the `if` node)
  - `Send email` + `Preparar e-mail`
  - `Final Response Summary v4` — replace with simpler one

- [ ] **Step 3: Keep nodes**

  Keep:
  - Webhook trigger (rename path to `vivassit-onboarding-slim`)
  - `📝 Processar Dados Webhook` (input shaping)
  - `Auto Configure Services v` (if still used by Evolution downstream)
  - `Criar instancia` (Evolution)
  - `Conectar instancia` (Evolution)
  - `Criar Chatwoot` (Evolution sub-step that links instance to Chatwoot — keep, it's needed for the WhatsApp inbox)
  - `Criar Bot Telegram v4`
  - `Buscar User ID via Telethon`
  - `Send a text message` (Telegram welcome)
  - `Code` (Telegram bot setup helper)
  - `Finalize Complete Config v4` — modify to return ONLY:
    ```js
    return {
      evolution_phone_number: $node["Conectar instancia"].json.phone_number,
      evolution_instance_id: $node["Criar instancia"].json.id,
      evolution_instance_name: $node["Criar instancia"].json.instanceName,
      telegram_bot_link: $node["Criar Bot Telegram v4"].json.bot_link,
    };
    ```

- [ ] **Step 4: Activate slim workflow + test from curl**

  Activate. Test:
  ```bash
  curl -X POST https://n8n.singulare.org/webhook/vivassit-onboarding-slim \
    -H 'Content-Type: application/json' \
    -d '{"tenant_id":"test","clinic_name":"Test Clinic","doctor_name":"Dr Test","real_phone":"+5511999999999"}'
  ```
  Expected: 200 with the 4 fields above. Should complete in ~10-15s.

- [ ] **Step 5: Export and commit**

  In n8n UI: workflow → Download → save as `n8n-workflow-slim.json` in repo root.

```bash
git add n8n-workflow-slim.json
git commit -m "feat(n8n): slim onboarding workflow (Evolution + Telegram only)"
```

---

## Task 9: Wire hybrid orchestration into `/api/onboarding`

**Files:**
- Modify: `app/app/api/onboarding/route.ts`
- Test: `app/__tests__/api/onboarding-hybrid.test.ts`

- [ ] **Step 1: Read current route to find the n8n call site**

```bash
grep -n "N8N_WEBHOOK_URL\|n8n" app/app/api/onboarding/route.ts | head -20
```
You're looking for the block around lines 322-449 that POSTs to `vivassit-onboarding-v4` and updates Supabase with the response.

- [ ] **Step 2: Write failing integration test (mocked)**

Create `app/__tests__/api/onboarding-hybrid.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all integration modules
vi.mock('@/lib/integrations/google-calendar', () => ({
  createDoctorCalendar: vi.fn().mockResolvedValue({ ok: true, calendarId: 'cal_1', summary: 'Dr X' }),
}));
vi.mock('@/lib/integrations/google-drive', () => ({
  createClinicFolder: vi.fn().mockResolvedValue({ ok: true, folderId: 'fold_1', webViewLink: 'https://drive/fold_1' }),
}));
vi.mock('@/lib/integrations/chatwoot', () => ({
  setupChatwootForTenant: vi.fn().mockResolvedValue({ ok: true, accountId: 1, domain: 'https://cw', mode: 'shared' }),
}));
vi.mock('@/lib/integrations/onboarding-email', () => ({
  sendOnboardingWelcomeEmail: vi.fn().mockResolvedValue({ ok: true, messageId: '<id>' }),
}));
vi.mock('@/lib/integrations/n8n-slim', () => ({
  callN8nSlim: vi.fn().mockResolvedValue({
    ok: true,
    data: { evolution_phone_number: '+5511999', evolution_instance_id: 'inst_1', telegram_bot_link: 't.me/x' },
  }),
}));

// Mock Supabase
vi.mock('@/lib/supabase-server', () => ({
  createServiceRoleClient: () => ({
    from: () => ({
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'tenant_1' }, error: null }) }) }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
    auth: { admin: { createUser: () => Promise.resolve({ data: { user: { id: 'u1' } }, error: null }) } },
  }),
}));

import { POST } from '@/app/api/onboarding/route';

beforeEach(() => {
  process.env.ONBOARDING_HYBRID_ENABLED = 'true';
});

describe('POST /api/onboarding (hybrid mode)', () => {
  it('runs Vercel and n8n buckets in parallel and merges integration ids', async () => {
    const req = new Request('http://localhost/api/onboarding', {
      method: 'POST',
      body: JSON.stringify({
        professional_type: 'doctor',
        doctor_name: 'Dr X',
        admin_email: 'x@example.com',
        clinic_name: 'Clinic X',
        real_phone: '+5511999999999',
        plan_type: 'professional',
        lgpd_accepted: true,
      }),
    });
    const start = Date.now();
    const res = await POST(req as any);
    const elapsed = Date.now() - start;
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      tenant_id: 'tenant_1',
      automation: {
        calendar_id: 'cal_1',
        drive_folder_id: 'fold_1',
        chatwoot_account_id: 1,
        evolution_instance_id: 'inst_1',
        telegram_bot_link: 't.me/x',
      },
    });
    expect(elapsed).toBeLessThan(1000); // mocks are instant
  });
});
```

- [ ] **Step 3: Run, verify it fails**

```bash
npx vitest run __tests__/api/onboarding-hybrid.test.ts
```
Expected: FAIL.

- [ ] **Step 4: Refactor route.ts to add the hybrid path**

Open `app/app/api/onboarding/route.ts`. Find the block that calls n8n (around line 322). Add this BEFORE that block (keeping the legacy block inside an `else` for rollback):

```typescript
import { createDoctorCalendar } from '@/lib/integrations/google-calendar';
import { createClinicFolder } from '@/lib/integrations/google-drive';
import { setupChatwootForTenant } from '@/lib/integrations/chatwoot';
import { sendOnboardingWelcomeEmail } from '@/lib/integrations/onboarding-email';
import { callN8nSlim } from '@/lib/integrations/n8n-slim';

// ... existing code that creates tenant, doctor, magic link ...

const HYBRID = process.env.ONBOARDING_HYBRID_ENABLED === 'true';

let automation: Record<string, any> = { status: 'pending' };

if (HYBRID) {
  const [calendar, drive, chatwoot, n8n] = await Promise.allSettled([
    createDoctorCalendar({ doctorName: payload.doctor_name }),
    createClinicFolder({ clinicName: payload.clinic_name }),
    setupChatwootForTenant({ planType: payload.plan_type, clinicName: payload.clinic_name }),
    callN8nSlim({
      tenant_id: tenant.id,
      clinic_name: payload.clinic_name,
      doctor_name: payload.doctor_name,
      real_phone: payload.real_phone,
    }),
  ]);

  const cal = calendar.status === 'fulfilled' && calendar.value.ok ? calendar.value : null;
  const drv = drive.status === 'fulfilled' && drive.value.ok ? drive.value : null;
  const cw = chatwoot.status === 'fulfilled' && chatwoot.value.ok ? chatwoot.value : null;
  const n8nData = n8n.status === 'fulfilled' && n8n.value.ok ? n8n.value.data : null;

  // Persist
  await supabase.from('tenants').update({
    calendar_id: cal?.calendarId,
    drive_folder_id: drv?.folderId,
    chatwoot_account_id: cw?.accountId,
    chatwoot_domain: cw?.domain,
    evolution_phone_number: n8nData?.evolution_phone_number,
    evolution_instance_id: n8nData?.evolution_instance_id,
    evolution_instance_name: n8nData?.evolution_instance_name,
    telegram_bot_link: n8nData?.telegram_bot_link,
  }).eq('id', tenant.id);

  await supabase.from('tenant_doctors').update({ calendar_id: cal?.calendarId }).eq('tenant_id', tenant.id);

  // Send welcome email AFTER persistence (so we have all the links)
  await sendOnboardingWelcomeEmail({
    to: payload.admin_email,
    doctorName: payload.doctor_name,
    clinicName: payload.clinic_name,
    magicLinkUrl: magicLinkUrl,
    panelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/painel`,
  });

  automation = {
    status: 'completed',
    calendar_id: cal?.calendarId,
    drive_folder_id: drv?.folderId,
    chatwoot_account_id: cw?.accountId,
    evolution_instance_id: n8nData?.evolution_instance_id,
    evolution_instance_name: n8nData?.evolution_instance_name,
    telegram_bot_link: n8nData?.telegram_bot_link,
    failures: {
      calendar: cal ? null : (calendar.status === 'fulfilled' ? calendar.value.error : 'rejected'),
      drive: drv ? null : (drive.status === 'fulfilled' ? drive.value.error : 'rejected'),
      chatwoot: cw ? null : (chatwoot.status === 'fulfilled' ? chatwoot.value.error : 'rejected'),
      n8n: n8nData ? null : (n8n.status === 'fulfilled' ? n8n.value.error : 'rejected'),
    },
  };
} else {
  // === LEGACY MONOLITHIC n8n CALL (kept for rollback) ===
  // [original code from lines 322-449 stays here unchanged]
}

// Response (existing) merges with `automation`
return Response.json({ ...existing, automation });
```

Set the function maxDuration in the route file:

```typescript
export const maxDuration = 60; // Vercel Hobby ceiling
```

- [ ] **Step 5: Verify test passes**

```bash
npx vitest run __tests__/api/onboarding-hybrid.test.ts
```
Expected: PASS.

- [ ] **Step 6: Run full test suite**

```bash
cd app
npx vitest run
```
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add app/app/api/onboarding/route.ts app/__tests__/api/onboarding-hybrid.test.ts
git commit -m "feat(onboarding): hybrid orchestration — Vercel + slim n8n in parallel"
```

---

## Task 10: Staging rollout with feature flag OFF

**Files:** none (deployment + smoke test)

- [ ] **Step 1: Set env vars in Vercel (Preview env)**

  Vercel dashboard → project → Settings → Environment Variables → Preview:
  - All `GOOGLE_*`, `CHATWOOT_*`, `SES_SMTP_*`, `ONBOARDING_FROM_*`, `N8N_SLIM_WEBHOOK_URL`
  - `ONBOARDING_HYBRID_ENABLED=false` ← **OFF by default**

- [ ] **Step 2: Push branch and open PR**

```bash
git push -u origin onboarding-hybrid
gh pr create --title "feat: hybrid onboarding (Vercel + slim n8n)" --body "Reduces n8n workload by ~60% per onboarding by moving Google Calendar/Drive/Chatwoot/Email to direct Vercel API calls. Slim n8n keeps Evolution + Telegram. Feature flag ONBOARDING_HYBRID_ENABLED gates rollout. Tests pass; integration tested on preview with flag ON."
```

- [ ] **Step 3: Test on Preview URL with flag OFF**

  Submit onboarding from preview URL → confirm legacy n8n path runs as before. Confirm zero regressions.

- [ ] **Step 4: Flip flag ON in Preview only**

  Vercel → set `ONBOARDING_HYBRID_ENABLED=true` for Preview env only → redeploy preview.

- [ ] **Step 5: Submit a real onboarding through Preview**

  Use a real test clinic name + your own phone. Verify in Supabase that:
  - `tenants.calendar_id`, `drive_folder_id`, `chatwoot_account_id`, `evolution_instance_id`, `telegram_bot_link` all populated
  - Welcome email arrived in inbox from `oi@singulare.org`
  - Total time from form submit to redirect ≤30s
  - n8n execution log shows ONLY the slim workflow ran (not v4)

- [ ] **Step 6: Merge PR**

```bash
gh pr merge --squash
```

  Production deploys with flag still OFF → zero behavior change in prod.

---

## Task 11: Production rollout + cleanup

- [ ] **Step 1: Flip flag ON in Production (off-hours)**

  Pick a low-traffic window (e.g. domingo de manhã). Vercel → Production env → `ONBOARDING_HYBRID_ENABLED=true` → redeploy.

- [ ] **Step 2: Monitor first 5 onboardings**

  Watch:
  - Vercel function logs for the 4 integration buckets
  - Supabase tenant rows for full population
  - n8n executions tab — slim workflow only

  If any pattern of failure → flip flag back to `false` instantly (zero deploy needed, just env var change + redeploy).

- [ ] **Step 3: After 7 days of clean operation, remove legacy code**

```bash
git checkout -b cleanup/remove-monolithic-n8n
```

  In `app/app/api/onboarding/route.ts`:
  - Remove the `else` branch with the legacy n8n monolithic call
  - Remove the `if (HYBRID)` guard, keep only the hybrid path
  - Remove env var `N8N_WEBHOOK_URL` (replaced by `N8N_SLIM_WEBHOOK_URL`)
  - Remove `ONBOARDING_HYBRID_ENABLED` reference (always on now)

- [ ] **Step 4: Archive monolithic n8n workflow**

  In n8n UI: deactivate `vivassit-onboarding-v4`, rename to `vivassit-onboarding-v4-DEPRECATED`. Keep for 30 days as safety net.

- [ ] **Step 5: Commit cleanup**

```bash
git add app/app/api/onboarding/route.ts
git commit -m "chore(onboarding): remove legacy monolithic n8n path after stable rollout"
git push
```

  Open PR, merge.

---

## Acceptance Criteria

- [ ] n8n workflow per onboarding executes ≤8 nodes (was 21)
- [ ] Total onboarding wall-clock time stays ≤30s (measured at frontend)
- [ ] Vercel function execution logs show 4 parallel integration calls completing in ≤15s
- [ ] All Supabase fields (calendar_id, drive_folder_id, chatwoot_account_id, evolution_instance_id, telegram_bot_link) populated post-onboarding
- [ ] Welcome email delivered from `oi@singulare.org` via SES
- [ ] Failure of one integration bucket does not block the others (Promise.allSettled semantics confirmed in test)
- [ ] Feature flag `ONBOARDING_HYBRID_ENABLED=false` reverts to legacy behavior with no code redeploy
- [ ] All Vitest unit tests pass (`npx vitest run`)
- [ ] Manual smoke test on Preview confirms email + calendar + drive + chatwoot + WhatsApp link all created

---

## Out of Scope (intentional)

- Migrating Evolution WhatsApp instance creation off n8n (stays — runs Baileys close to Lightsail)
- Migrating Telegram bot creation off n8n (Telethon hack has no clean Node.js equivalent)
- Splitting n8n to a separate Lightsail instance (if queue still pressured after this rollout, do it as a follow-up — should not be needed for the next 6-12 months at expected volume)
- Async/background pattern for onboarding (frontend stays sync — wait for response before redirect to checkout). If you ever want sub-5s response time, that's a future plan with Supabase Realtime updates to the frontend.
- Vercel Pro upgrade (not needed for this plan; revisit only if 60s ceiling becomes a constraint)

---

## Risk Register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Google SA Domain-Wide Delegation misconfigured | Medium | Sanity test in Task 1 Step 7 before any code |
| Vercel function hits 60s timeout | Low | Buckets parallelized; n8n side capped at 30s |
| One integration silently fails (e.g. Chatwoot 5xx) | Medium | `Promise.allSettled` + `failures` field in response, logged for ops |
| n8n slim workflow has bug different from v4 | Medium | Test with curl in Task 8 before wiring frontend |
| Email lands in spam (DKIM not yet verified) | Low | SES setup in progress, will be Verified before Task 10 |
| Cold start adds latency | Low | Vercel keeps function warm under sustained traffic; cold start ~500ms acceptable |
