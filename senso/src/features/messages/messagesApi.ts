/**
 * messagesApi.ts — Authenticated API client for E2E messaging endpoints.
 *
 * Endpoints:
 *   POST /messages/poll               — pull pending encrypted messages for current user
 *   GET  /messages/users/{username}/public-keys — fetch recipient public keys for compose
 *   POST /messages/send               — send encrypted message
 *   POST /attachments/upload          — upload encrypted attachment blob
 *
 * All payloads are encrypted on the client before reaching these functions.
 * Server never sees plaintext content.
 */

import { apiRequest } from "@/lib/api-client";
import { getBackendBaseUrl } from "@/lib/config";
import { readAccessToken } from "@/features/auth/storage";

const API_BASE = getBackendBaseUrl();

function requireToken(): string {
  const token = readAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

// ── Response types ────────────────────────────────────────────────────────────

export interface PolledMessageDTO {
  id: string;
  encryptedPayload: string; // base64 ciphertext blob
  payloadSizeBytes: number;
  createdAt: string; // ISO datetime
}

export interface RecipientPublicKeysDTO {
  username: string;
  publicKeyB64: string; // X25519 public key (base64, 32 bytes)
  signingKeyB64: string; // Ed25519 verify key (base64, 32 bytes)
}

export interface SendMessageRequest {
  recipientHashes: string[]; // sha256($username) hex digests or !admin_handle
  encryptedPayload: string; // base64 ciphertext
}

export interface SendMessageResponse {
  messageId: string;
  createdAt: string;
  recipientCount: number;
}

// ── A decrypted message (client-side only, never persisted) ───────────────────

export interface DecryptedMessage {
  id: string;
  createdAt: string;
  from: string; // routing.from — $username or !handle (inside plaintext)
  to: string[]; // routing.to
  body: string; // Markdown body
  signatureValid: boolean; // true if Ed25519 signature verified
  isAdmin: boolean; // true if from.startsWith("!")
  signerPublicKey?: string; // signing_key_b64 of sender (for badge panel)
  frontmatter: Record<string, unknown>; // full parsed YAML frontmatter
}

// ── API functions ─────────────────────────────────────────────────────────────

/**
 * Pull all pending encrypted messages from the server.
 * Server marks them as delivered after this call.
 * Returns raw encrypted blobs — decrypt in the inbox component.
 */
export async function pollMessages(): Promise<PolledMessageDTO[]> {
  return apiRequest<PolledMessageDTO[]>(API_BASE, "/messages/poll", {
    method: "POST",
    token: requireToken(),
  });
}

/**
 * Fetch X25519 + Ed25519 public keys for a recipient before compose.
 *
 * @param username — $adjective-noun-NNNN or !admin_handle (URL-encode if needed)
 */
export async function getRecipientPublicKeys(username: string): Promise<RecipientPublicKeysDTO> {
  const encoded = encodeURIComponent(username);
  return apiRequest<RecipientPublicKeysDTO>(API_BASE, `/messages/users/${encoded}/public-keys`, {
    token: requireToken(),
  });
}

/**
 * Send an encrypted message payload to one or more recipients.
 *
 * @param recipientHashes — array of sha256($username) hex digests or !admin_handles
 * @param encryptedPayload — base64 ciphertext (encrypt before calling this)
 */
export async function sendMessage(
  recipientHashes: string[],
  encryptedPayload: string,
): Promise<SendMessageResponse> {
  return apiRequest<SendMessageResponse>(API_BASE, "/messages/send", {
    method: "POST",
    token: requireToken(),
    body: {
      recipient_hashes: recipientHashes, // snake_case for FastAPI
      encrypted_payload: encryptedPayload,
    },
  });
}

/**
 * Upload an encrypted attachment ciphertext to MinIO.
 * Returns the s3:// address for embedding in message frontmatter.
 */
export async function uploadAttachment(
  encryptedBlob: Blob,
  filename: string,
): Promise<{ attachmentId: string; s3Addr: string; sizeBytes: number }> {
  const token = requireToken();
  const formData = new FormData();
  formData.append("file", encryptedBlob, filename);

  const response = await fetch(`${API_BASE}/attachments/upload`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error((data as { detail?: string })?.detail ?? `Upload failed (${response.status})`);
  }

  const result = (await response.json()) as {
    attachment_id: string;
    s3_addr: string;
    size_bytes: number;
  };

  return {
    attachmentId: result.attachment_id,
    s3Addr: result.s3_addr,
    sizeBytes: result.size_bytes,
  };
}
