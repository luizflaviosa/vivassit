// Cliente Chatwoot pra criar/deletar conversa real durante testes E2E.
// Inbox 13 (singulare-e2e-tests) criado especificamente pra esse fim.

import { config } from '../config.js';

const baseUrl = () => config.chatwoot.baseUrl.replace(/\/$/, '');
const accountUrl = () => `${baseUrl()}/api/v1/accounts/${config.chatwoot.accountId}`;
const headers = () => ({
  'Content-Type': 'application/json',
  api_access_token: config.chatwoot.token,
});

export type ChatwootContact = { id: number; sourceId: string; identifier?: string };
export type ChatwootConversation = { id: number; contact_id: number };

export async function createContact(
  name: string,
  phoneNumber: string,
): Promise<ChatwootContact> {
  // Usa identifier único pra evitar conflito; Chatwoot dedup por phone_number+inbox
  const res = await fetch(`${accountUrl()}/contacts`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      inbox_id: Number(config.chatwoot.inboxId),
      name,
      phone_number: phoneNumber,
      identifier: phoneNumber,
    }),
  });
  if (!res.ok && res.status !== 422) {
    throw new Error(`createContact HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data: any = await res.json();
  // Quando dup, Chatwoot retorna 422 com payload contendo o contato existente
  const contact = data?.payload?.contact ?? data?.contact ?? data;
  // source_id é o UUID por inbox que o Chatwoot gera (precisa pra criar conversation)
  const inboxes = contact?.contact_inboxes || [];
  const sourceId = inboxes[0]?.source_id;
  if (!sourceId) {
    throw new Error(`createContact: sem source_id no contact_inboxes — resposta: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return { id: contact.id, sourceId, identifier: contact.identifier };
}

export async function createConversation(
  contactId: number,
  sourceId: string,
): Promise<ChatwootConversation> {
  const res = await fetch(`${accountUrl()}/conversations`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      source_id: sourceId,
      inbox_id: Number(config.chatwoot.inboxId),
      contact_id: contactId,
    }),
  });
  if (!res.ok) {
    throw new Error(`createConversation HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data: any = await res.json();
  return { id: data.id, contact_id: data.contact_id };
}

export async function deleteConversation(conversationId: number): Promise<void> {
  await fetch(`${accountUrl()}/conversations/${conversationId}`, {
    method: 'DELETE',
    headers: headers(),
  }).catch(() => {});
}

export async function deleteContact(contactId: number): Promise<void> {
  await fetch(`${accountUrl()}/contacts/${contactId}`, {
    method: 'DELETE',
    headers: headers(),
  }).catch(() => {});
}

/** Setup completo: cria contact + conversation real, retorna ids pra contexto. */
export async function setupChatwootForScenario(
  patientPhone: string,
  patientName: string,
): Promise<{ contactId: number; conversationId: number }> {
  if (!config.chatwoot.token) {
    throw new Error('CHATWOOT_API_ACCESS_TOKEN ausente — não consigo criar conversa real');
  }
  const contact = await createContact(patientName, patientPhone);
  const conv = await createConversation(contact.id, contact.sourceId);
  return { contactId: contact.id, conversationId: conv.id };
}

export async function teardownChatwootForScenario(
  conversationId: number,
  contactId?: number,
): Promise<void> {
  await deleteConversation(conversationId);
  if (contactId) await deleteContact(contactId);
}
