/**
 * attachmentUtils.ts - download and decrypt message attachments.
 *
 * Attachment frontmatter structure (from parseMessage.ts):
 *   name: filename.pdf
 *   addr: s3://attachments/{user_id}/{attachment_id}
 *   key: <base64 - per-attachment symmetric key wrapped with recipient X25519 key>
 *   nonce: <base64 - wrapping nonce>
 *   hash: <hex sha256 of plaintext - for integrity check>
 *
 * The "key" field is JSON({ ciphertextB64, ephemeralPublicKeyB64, nonceB64 })
 * encrypted with encryptForRecipient - must be decrypted with decryptFromSender
 * using the receiver's X25519 private key.
 */
import { decryptFromSender, decryptAttachment, base64ToBytes } from "./crypto";
import { getAttachmentDownloadUrl } from "./messagesApi";
import type { CryptoKeyMaterial } from "@/features/auth/types";

export interface AttachmentEntry {
  name: string;
  addr: string; // s3://attachments/{user_id}/{attachment_id}
  key: string; // base64 JSON({ ciphertextB64, ephemeralPublicKeyB64, nonceB64 })
  nonce: string; // base64 secretbox nonce (for decryptAttachment)
  hash?: string; // hex sha256 of plaintext
}

/**
 * Extract the attachment_id from an s3:// address.
 * Format: s3://attachments/{user_id}/{attachment_id}
 */
function extractAttachmentId(addr: string): string {
  const parts = addr.replace("s3://attachments/", "").split("/");
  return parts[parts.length - 1];
}

/**
 * Download, decrypt, and return a Blob for a message attachment.
 *
 * Steps:
 *   1. Get presigned download URL from backend
 *   2. Fetch encrypted blob from MinIO via presigned URL
 *   3. Unwrap per-attachment key using receiver's X25519 private key
 *   4. Decrypt blob with secretbox using unwrapped key + nonce
 *   5. Return plaintext Blob for browser download trigger
 */
export async function downloadAndDecryptAttachment(
  attachment: AttachmentEntry,
  cryptoKeys: CryptoKeyMaterial,
): Promise<Blob> {
  // Step 1: Get presigned URL
  const attachmentId = extractAttachmentId(attachment.addr);
  const { presignedUrl } = await getAttachmentDownloadUrl(attachmentId);

  // Step 2: Fetch encrypted blob
  const resp = await fetch(presignedUrl);
  if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
  const encryptedBytes = new Uint8Array(await resp.arrayBuffer());

  // Step 3: Unwrap per-attachment key
  // The key field is base64(JSON({ ciphertextB64, ephemeralPublicKeyB64, nonceB64 }))
  // produced by encryptForRecipient(attachmentKey, recipientX25519PublicKey)
  const keyBundle = JSON.parse(atob(attachment.key)) as {
    ciphertextB64: string;
    ephemeralPublicKeyB64: string;
    nonceB64: string;
  };
  const attachmentKeyBytes = decryptFromSender(
    keyBundle.ciphertextB64,
    keyBundle.ephemeralPublicKeyB64,
    keyBundle.nonceB64,
    cryptoKeys.x25519PrivateKey,
  );

  // Step 4: Decrypt blob with secretbox
  const nonce = base64ToBytes(attachment.nonce);
  const plaintext = decryptAttachment(encryptedBytes, nonce, attachmentKeyBytes);

  return new Blob([plaintext.buffer as ArrayBuffer], { type: "application/octet-stream" });
}

/**
 * Trigger a browser download for a Blob with the given filename.
 */
export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
