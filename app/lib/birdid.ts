// app/lib/birdid.ts
//
// BirdID Pro API client (Soluti/VaultID CESS)
// ICP-Brasil digital signature for medical documents.
//
// Env vars: BIRDID_CLIENT_ID, BIRDID_CLIENT_SECRET, BIRDID_API_URL, BIRDID_CESS_URL

const API_URL = process.env.BIRDID_API_URL || 'https://api.birdid.com.br';
const CESS_URL = process.env.BIRDID_CESS_URL || 'https://cess.vaultid.com.br';
const CLIENT_ID = process.env.BIRDID_CLIENT_ID || '';
const CLIENT_SECRET = process.env.BIRDID_CLIENT_SECRET || '';
const WEBHOOK_BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://singulare.org';

// ──────────────────────────────────────────────────────────────
// 1. OAuth2 — get access token (client_credentials)
// ──────────────────────────────────────────────────────────────

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getBirdIdToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const res = await fetch(`${API_URL}/v0/oauth/client_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`BirdID OAuth failed: ${res.status} — ${text}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000, // 60s buffer
  };

  return data.access_token;
}

// ──────────────────────────────────────────────────────────────
// 2. Start signing session — upload PDF and begin signature
// ──────────────────────────────────────────────────────────────

export interface BirdIdSignRequest {
  pdfBuffer: Buffer;
  fileName: string;
  signerCpf: string;       // Doctor's CPF (linked to BirdID account)
  docId: number;           // Our document ID for webhook callback
  reason?: string;         // e.g. "Assinatura de atestado médico"
  location?: string;       // e.g. "São Paulo, SP"
}

export interface BirdIdSignResponse {
  tcn: string;             // Transaction Control Number
  certificateAlias: string;
  status: 'WAITING' | 'SIGNED' | 'ERROR';
}

export async function startSigningSession(req: BirdIdSignRequest): Promise<BirdIdSignResponse> {
  const token = await getBirdIdToken();

  // Step 1: Create signing session
  const sessionRes = await fetch(`${CESS_URL}/signature-service`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      certificate_alias: req.signerCpf,
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
    throw new Error(`BirdID session failed: ${sessionRes.status} — ${text}`);
  }

  const session = await sessionRes.json();
  const tcn = session.tcn;

  // Step 2: Upload PDF document
  const formData = new FormData();
  const blob = new Blob([req.pdfBuffer], { type: 'application/pdf' });
  formData.append('file', blob, req.fileName);

  const uploadRes = await fetch(`${CESS_URL}/file-transfer/${tcn}/eot/default`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
    body: formData,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`BirdID upload failed: ${uploadRes.status} — ${text}`);
  }

  return {
    tcn,
    certificateAlias: session.certificate_alias || '',
    status: 'WAITING',
  };
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

export async function getSigningStatus(tcn: string): Promise<BirdIdDocStatus> {
  const token = await getBirdIdToken();

  const res = await fetch(`${CESS_URL}/signature-service/${tcn}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`BirdID status failed: ${res.status} — ${text}`);
  }

  const data = await res.json();

  // Determine overall status
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

export async function downloadSignedPdf(tcn: string, docIndex: number = 0): Promise<Buffer> {
  const token = await getBirdIdToken();

  const res = await fetch(`${CESS_URL}/file-transfer/${tcn}/${docIndex}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`BirdID download failed: ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ──────────────────────────────────────────────────────────────
// 5. Check if BirdID is configured
// ──────────────────────────────────────────────────────────────

export function isBirdIdConfigured(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET);
}
