// app/lib/birdid.ts
//
// BirdID integration via OTP (código do app do médico).
//
// Fluxo:
//   1. Médico tem app BirdID no celular → gera OTP a cada ~30s
//   2. Na hora de assinar, médico digita o OTP no modal
//   3. Backend autentica via pwd_authorize (OAuth2 Password Grant)
//   4. Usa o access_token pra criar sessão de assinatura no CESS (VaultID)
//   5. Upload do PDF → assinatura ICP-Brasil
//
// Env vars OBRIGATÓRIAS:
//   BIRDID_CLIENT_ID     — app client ID (registrado no BirdID)
//   BIRDID_CLIENT_SECRET — app client secret
//
// Env vars opcionais (defaults de sandbox):
//   BIRDID_API_URL  — auth endpoint (default: sandbox)
//   BIRDID_CESS_URL — signing service (default: sandbox)
//
// Dados por médico (armazenados em tenant_doctors):
//   birdid_account_id — CPF ou slot_alias do médico (ex: "12345678900")

const API_URL = process.env.BIRDID_API_URL || 'https://apihom.birdid.com.br';
const CESS_URL = process.env.BIRDID_CESS_URL || 'https://cesshom.vaultid.com.br';
const WEBHOOK_BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://singulare.org';
const CLIENT_ID = process.env.BIRDID_CLIENT_ID || '';
const CLIENT_SECRET = process.env.BIRDID_CLIENT_SECRET || '';

// ──────────────────────────────────────────────────────────────
// 1. Authenticate doctor via OTP (OAuth2 Password Grant — pwd_authorize)
//    Docs: https://docs.vaultid.com.br/workspace/cloud/api/autenticacao-de-usuarios/autenticacao-em-sistemas-desktop
// ──────────────────────────────────────────────────────────────

export async function authenticateWithOTP(
  accountId: string,
  otp: string,
): Promise<{ token: string; expiresIn: number }> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new BirdIdError(
      'BIRDID_CLIENT_ID e BIRDID_CLIENT_SECRET não configurados. Adicione nas variáveis de ambiente.',
      'AUTH_FAILED',
    );
  }

  const res = await fetch(`${API_URL}/v0/oauth/pwd_authorize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      username: accountId,
      password: otp,
      grant_type: 'password',
      scope: 'signature_session',
      lifetime: 600, // 10 min — enough for signing flow
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    let errorMsg = `BirdID auth failed: ${res.status}`;
    try {
      const err = JSON.parse(text);
      errorMsg = err.error_description || err.message || errorMsg;
    } catch {
      errorMsg += ` — ${text.slice(0, 200)}`;
    }
    throw new BirdIdError(errorMsg, 'AUTH_FAILED');
  }

  const data = await res.json();
  return {
    token: data.access_token,
    expiresIn: data.expires_in || 600,
  };
}

// ──────────────────────────────────────────────────────────────
// 2. Start signing session + upload PDF
// ──────────────────────────────────────────────────────────────

export interface BirdIdSignRequest {
  token: string;           // from authenticateWithOTP
  accountId: string;       // certificate_alias (BirdID ID)
  pdfBuffer: Buffer;
  fileName: string;
  docId: number;           // our document ID for webhook callback
  reason?: string;
  location?: string;
}

export interface BirdIdSignResponse {
  tcn: string;             // Transaction Control Number
  status: 'WAITING' | 'SIGNED' | 'ERROR';
}

export async function signDocument(req: BirdIdSignRequest): Promise<BirdIdSignResponse> {
  // Step 1: Create signing session
  const sessionRes = await fetch(`${CESS_URL}/signature-service`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${req.token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      certificate_alias: req.accountId,
      type: 'PDFSignature',
      hash_algorithm: 'SHA256',
      auto_fix_document: true,
      notification_callback: `${WEBHOOK_BASE}/api/webhooks/birdid?doc_id=${req.docId}`,
      signature_settings: [{
        id: 'default',
        reason: req.reason || 'Assinatura digital de documento médico',
        location: req.location || '',
        visible_signature: true,
        visible_sign_x: 48,
        visible_sign_y: 48,
        visible_sign_width: 260,
        visible_sign_height: 60,
        visible_sign_page: -1, // last page
      }],
      documents_source: 'UPLOAD_REFERENCE',
    }),
  });

  if (!sessionRes.ok) {
    const text = await sessionRes.text();
    throw new BirdIdError(`CESS session failed: ${sessionRes.status} — ${text.slice(0, 300)}`, 'SESSION_FAILED');
  }

  const session = await sessionRes.json();
  const tcn = session.tcn;

  // Step 2: Upload PDF
  const formData = new FormData();
  const blob = new Blob([req.pdfBuffer], { type: 'application/pdf' });
  formData.append('file', blob, req.fileName);

  const uploadRes = await fetch(`${CESS_URL}/file-transfer/${tcn}/eot/default`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${req.token}`,
      'Accept': 'application/json',
    },
    body: formData,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new BirdIdError(`PDF upload failed: ${uploadRes.status} — ${text.slice(0, 300)}`, 'UPLOAD_FAILED');
  }

  return { tcn, status: 'WAITING' };
}

// ──────────────────────────────────────────────────────────────
// 3. Check signing status
// ──────────────────────────────────────────────────────────────

export interface BirdIdDocStatus {
  tcn: string;
  status: 'WAITING' | 'SIGNED' | 'ERROR';
  documents: Array<{
    id: number;
    originalFileName: string;
    status: string;
    downloadUrl: string;
  }>;
}

export async function getSigningStatus(token: string, tcn: string): Promise<BirdIdDocStatus> {
  const res = await fetch(`${CESS_URL}/signature-service/${tcn}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new BirdIdError(`Status check failed: ${res.status} — ${text.slice(0, 200)}`, 'STATUS_FAILED');
  }

  const data = await res.json();
  const docs = (data.documents || []).map((d: any) => ({
    id: d.id,
    originalFileName: d.original_file_name,
    status: d.status,
    downloadUrl: d.result || `${CESS_URL}/file-transfer/${tcn}/${d.id}`,
  }));

  const allSigned = docs.length > 0 && docs.every((d: any) => d.status === 'SIGNED');
  const hasError = docs.some((d: any) => d.status === 'ERROR');

  return {
    tcn,
    status: allSigned ? 'SIGNED' : hasError ? 'ERROR' : 'WAITING',
    documents: docs,
  };
}

// ──────────────────────────────────────────────────────────────
// 4. Download signed PDF
// ──────────────────────────────────────────────────────────────

export async function downloadSignedPdf(token: string, tcn: string, docIndex = 0): Promise<Buffer> {
  const res = await fetch(`${CESS_URL}/file-transfer/${tcn}/${docIndex}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new BirdIdError(`Download failed: ${res.status}`, 'DOWNLOAD_FAILED');
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ──────────────────────────────────────────────────────────────
// 5. Error class + helpers
// ──────────────────────────────────────────────────────────────

export type BirdIdErrorCode =
  | 'AUTH_FAILED'
  | 'SESSION_FAILED'
  | 'UPLOAD_FAILED'
  | 'STATUS_FAILED'
  | 'DOWNLOAD_FAILED';

export class BirdIdError extends Error {
  code: BirdIdErrorCode;
  constructor(message: string, code: BirdIdErrorCode) {
    super(message);
    this.name = 'BirdIdError';
    this.code = code;
  }
}

/** BirdID is available if the doctor has an account ID configured */
export function isDoctorBirdIdReady(accountId: string | null | undefined): boolean {
  return !!accountId?.trim();
}
