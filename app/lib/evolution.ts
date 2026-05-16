// Helper minimo pra falar com Evolution API direto do Vercel.
// Usado pra refresh do QR / pairing code via /conectar/[token].
// Pattern alinhado com app/api/painel/docs/[id]/send/route.ts (apikey header).

interface EvolutionConnectResult {
  pairing_code: string | null;
  qr_base64: string | null;
  qr_code: string | null;
}

interface EvolutionStateResult {
  state: string | null;
}

function evolutionEnv() {
  const baseUrl = process.env.EVOLUTION_BASE_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error('Evolution API nao configurada (EVOLUTION_BASE_URL/EVOLUTION_API_KEY)');
  }
  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey };
}

/**
 * Solicita um QR/pair fresh da Evolution.
 * Endpoint GET /instance/connect/{instance} retorna um QR novo se a instancia
 * estiver desconectada; se ja estiver conectada, retorna instance state.
 */
export async function evolutionConnect(
  instanceName: string,
): Promise<EvolutionConnectResult> {
  const { baseUrl, apiKey } = evolutionEnv();
  const url = `${baseUrl}/instance/connect/${encodeURIComponent(instanceName)}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      apikey: apiKey,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Evolution connect retornou ${res.status}`);
  }

  // O shape pode variar entre versoes da Evolution. Cobrimos os formatos comuns.
  const data: Record<string, unknown> = await res.json().catch(() => ({}));
  const qrcode = (data.qrcode as Record<string, unknown> | undefined) ?? null;

  return {
    pairing_code:
      (typeof data.pairingCode === 'string' && data.pairingCode) ||
      (typeof data.pair_code === 'string' && data.pair_code) ||
      (qrcode && typeof qrcode.pairingCode === 'string' && qrcode.pairingCode) ||
      null,
    qr_base64:
      (typeof data.base64 === 'string' && data.base64) ||
      (qrcode && typeof qrcode.base64 === 'string' && qrcode.base64) ||
      null,
    qr_code:
      (typeof data.code === 'string' && data.code) ||
      (qrcode && typeof qrcode.code === 'string' && qrcode.code) ||
      null,
  };
}

/** Status atual da instancia: 'open' | 'close' | 'connecting' | null */
export async function evolutionState(
  instanceName: string,
): Promise<EvolutionStateResult> {
  const { baseUrl, apiKey } = evolutionEnv();
  const url = `${baseUrl}/instance/connectionState/${encodeURIComponent(instanceName)}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      apikey: apiKey,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Evolution state retornou ${res.status}`);
  }

  const data: Record<string, unknown> = await res.json().catch(() => ({}));
  const instance = (data.instance as Record<string, unknown> | undefined) ?? null;
  return {
    state:
      (typeof data.state === 'string' && data.state) ||
      (instance && typeof instance.state === 'string' && instance.state) ||
      null,
  };
}
