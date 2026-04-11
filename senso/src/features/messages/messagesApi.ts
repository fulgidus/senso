/**
 * messagesApi.ts - Authenticated API client for E2E messaging endpoints.
 *
 * Endpoints:
 *   POST /messages/send                        - send encrypted message
 *   POST /messages/poll                        - pull pending encrypted messages
 *   GET  /messages/users/{username}/public-keys - fetch recipient public keys for compose
 *   POST /messages/attachments/upload          - upload encrypted attachment blob
 *
 * All payloads are encrypted on the client before reaching these functions.
 * Server never sees plaintext content.
 */

import { apiRequest } from "@/lib/api-client";
import { getBackendBaseUrl } from "@/lib/config";
import { readAccessToken } from "@/features/auth/storage";

const API_BASE = getBackendBaseUrl;

function requireToken(): string {
    const token = readAccessToken();
    if (!token) throw new Error("Not authenticated");
    return token;
}

// ── Response types ──────────────────────────────────────────────────────────

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

export interface SendMessageResponse {
    messageId: string;
    createdAt: string;
    recipientCount: number;
}

export interface SendMessageRequest {
    recipientHashes: string[]; // sha256($username) hex digests or !admin_handle
    encryptedPayload: string; // base64 ciphertext
}

// ── A decrypted message (client-side only, never persisted) ───────────────────

export interface DecryptedMessage {
    id: string;
    createdAt: string;
    from: string; // routing.from - $username or !handle (inside plaintext)
    to: string[]; // routing.to
    body: string; // Markdown body
    signatureValid: boolean; // true if Ed25519 signature verified
    isAdmin: boolean; // true if from.startsWith("!")
    signerPublicKey?: string; // signing_key_b64 of sender (for badge panel)
    frontmatter: Record<string, unknown>; // full parsed YAML frontmatter
}

export interface UploadedAttachment {
    s3Addr: string; // storage address / URL for the encrypted blob
    sizeBytes: number;
}

// ── API functions ───────────────────────────────────────────────────────────

/**
 * Fetch the X25519 and Ed25519 public keys for a recipient by $username or !handle.
 * Used by the compose flow before encrypting a message.
 */
export async function getRecipientPublicKeys(username: string): Promise<RecipientPublicKeysDTO> {
    const token = requireToken();
    // URL-encode the username ($ → %24 so path parsing works)
    const encoded = encodeURIComponent(username);
    const res = await apiRequest<{
        username: string;
        public_key_b64: string;
        signing_key_b64: string;
    }>(API_BASE(), `/messages/users/${encoded}/public-keys`, {
        method: "GET",
        token,
    });
    return {
        username: res.username,
        publicKeyB64: res.public_key_b64,
        signingKeyB64: res.signing_key_b64,
    };
}

/**
 * Send an encrypted message to one or more recipient hashes.
 * @param recipientHashes - sha256($username) hex strings or !handle cleartext
 * @param encryptedPayload - base64(JSON({ciphertextB64, ephemeralPublicKeyB64, nonceB64}))
 */
export async function sendMessage(
    recipientHashes: string[],
    encryptedPayload: string,
): Promise<SendMessageResponse> {
    const token = requireToken();
    return apiRequest<SendMessageResponse>(API_BASE(), "/messages/send", {
        method: "POST",
        token,
        body: {
            recipient_hashes: recipientHashes,
            encrypted_payload: encryptedPayload,
        },
    });
}

/**
 * Poll for pending encrypted messages addressed to the current user.
 * The server uses the authenticated user's identity to compute their recipient hash.
 */
export async function pollMessages(): Promise<PolledMessageDTO[]> {
    const token = requireToken();
    const res = await apiRequest<{ messages?: PolledMessageDTO[] }>(API_BASE(), "/messages/poll", {
        method: "POST",
        token,
        body: {},
    });
    return res.messages ?? [];
}

/**
 * Upload an encrypted attachment blob and return its storage address.
 * The blob must already be encrypted (encryptAttachment) before calling this.
 */
/* native fetch — onUnauthorized not applicable (FormData multipart attachment upload) */
export async function uploadAttachment(blob: Blob, filename: string): Promise<UploadedAttachment> {
    const token = requireToken();
    const form = new FormData();
    form.append("file", blob, filename);

    const response = await fetch(`${API_BASE()}/messages/attachments/upload`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: form,
    });

    if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as unknown;
        throw new Error(`Attachment upload failed: ${response.status} - ${JSON.stringify(data)}`);
    }

    return response.json() as Promise<UploadedAttachment>;
}

/**
 * Get a presigned URL for downloading an encrypted attachment.
 * The returned URL is valid for 1 hour. Client must decrypt after download.
 */
export async function getAttachmentDownloadUrl(
    attachmentId: string,
): Promise<{ presignedUrl: string }> {
    const result = await apiRequest<{ presigned_url: string }>(
        API_BASE(),
        `/attachments/${attachmentId}/download`,
        { token: requireToken() },
    );
    return { presignedUrl: result.presigned_url };
}

// ── Factory (Pattern B: requireToken() internal, onUnauthorized bound at construction) ──

export type MessagesApiClient = ReturnType<typeof createMessagesApi>

export function createMessagesApi(onUnauthorized?: () => Promise<string | null>) {
    function req<T>(path: string, opts: Record<string, unknown> = {}): Promise<T> {
        return apiRequest<T>(API_BASE(), path, {
            ...opts,
            token: requireToken(),
            onUnauthorized,
        })
    }

    return {
        getRecipientPublicKeys: async (username: string): Promise<RecipientPublicKeysDTO> => {
            const encoded = encodeURIComponent(username)
            const res = await req<{
                username: string
                public_key_b64: string
                signing_key_b64: string
            }>(`/messages/users/${encoded}/public-keys`, { method: "GET" })
            return {
                username: res.username,
                publicKeyB64: res.public_key_b64,
                signingKeyB64: res.signing_key_b64,
            }
        },

        sendMessage: (
            recipientHashes: string[],
            encryptedPayload: string,
        ): Promise<SendMessageResponse> =>
            req<SendMessageResponse>("/messages/send", {
                method: "POST",
                body: {
                    recipient_hashes: recipientHashes,
                    encrypted_payload: encryptedPayload,
                },
            }),

        pollMessages: async (): Promise<PolledMessageDTO[]> => {
            const res = await req<{ messages?: PolledMessageDTO[] }>("/messages/poll", {
                method: "POST",
                body: {},
            })
            return res.messages ?? []
        },

        getAttachmentDownloadUrl: async (
            attachmentId: string,
        ): Promise<{ presignedUrl: string }> => {
            const result = await req<{ presigned_url: string }>(
                `/attachments/${attachmentId}/download`,
            )
            return { presignedUrl: result.presigned_url }
        },

        // uploadAttachment: excluded — uses native fetch (FormData multipart)
    }
}
