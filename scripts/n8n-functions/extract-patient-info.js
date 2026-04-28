// Extrai telefone e nome da description de um evento do Google Calendar
// criado pelo Master Secretária. Convenção:
//   Telefone: +55 11 99999-9999
//   Nome Completo: Fulano de Tal
//   Data de Nascimento: dd/mm/yyyy
//   ID da conversa: <id>
//
// Retorna: { phone: string E.164, name: string|null, first_name: string }
// ou null se telefone ausente/inválido.

function extractPatientInfo(description) {
  if (!description || typeof description !== 'string') return null;

  const phoneMatch = description.match(/Telefone:\s*([+\d][\d\s\-()+]{6,})/i);
  if (!phoneMatch) return null;

  const phone = normalizeToE164(phoneMatch[1]);
  if (!phone) return null;

  const nameMatch = description.match(/Nome\s*Completo:\s*(.+?)(?:\r?\n|$)/i);
  const name = nameMatch ? nameMatch[1].trim() : null;

  const first_name = name ? name.split(/\s+/)[0] : 'Paciente';

  return { phone, name, first_name };
}

function normalizeToE164(raw) {
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.length > 15) return null;
  if (digits.startsWith('55') && digits.length >= 12) return '+' + digits;
  if (digits.length === 10 || digits.length === 11) return '+55' + digits;
  return '+' + digits;
}

module.exports = { extractPatientInfo, normalizeToE164 };
