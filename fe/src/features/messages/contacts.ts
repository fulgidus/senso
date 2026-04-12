/**
 * contacts.ts - Contacts tab persistence (localStorage under senso:contacts)
 *
 * Contacts are auto-populated from message routing headers (from/to fields).
 * User can label or delete contacts. No backend storage - client-side only.
 */

const STORAGE_KEY = "senso:contacts";

export interface Contact {
  username: string; // $adjective-noun-NNNN or !handle
  label?: string; // user-assigned display name
  publicKeyB64?: string; // X25519 public key (cached at first message)
  signingKeyB64?: string; // Ed25519 verify key (cached at first message)
  lastSeen?: string; // ISO datetime of last message involving this contact
}

export function loadContacts(): Contact[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Contact[]) : [];
  } catch {
    return [];
  }
}

export function saveContacts(contacts: Contact[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
}

export function upsertContact(contact: Omit<Contact, "label">): Contact[] {
  const existing = loadContacts();
  const idx = existing.findIndex((c) => c.username === contact.username);
  if (idx >= 0) {
    existing[idx] = { ...existing[idx], ...contact };
  } else {
    existing.push(contact);
  }
  saveContacts(existing);
  return existing;
}

export function deleteContact(username: string): Contact[] {
  const updated = loadContacts().filter((c) => c.username !== username);
  saveContacts(updated);
  return updated;
}

export function populateContactsFromMessages(messages: { from: string; to: string[] }[]): void {
  for (const msg of messages) {
    const usernames = [msg.from, ...msg.to].filter((u) => u && u !== "unknown");
    for (const username of usernames) {
      upsertContact({ username, lastSeen: new Date().toISOString() });
    }
  }
}
