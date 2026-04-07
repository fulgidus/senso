/**
 * useEncryptAndSend — E2E message send crypto pipeline (Phase 15 — task 15-05-02)
 *
 * Pipeline (per D-07, D-08, D-09, D-10, D-18):
 *   1. Fetch recipient public keys
 *   2. Compute sha256($username) for routing hash — $ prefix included (Phase 14 D-01)
 *      !handle sent as cleartext, NOT hashed (Phase 14 D-03)
 *   3. If attachment: encrypt + upload + build frontmatter entries
 *   4. Build YAML frontmatter WITHOUT signature
 *   5. Ed25519 sign (frontmatter-without-sig + body) with user's 64-byte signing key
 *   6. Assemble full plaintext: ---\n{sig+frontmatter}\n---\n{body}
 *   7. X25519 DH encrypt with recipient's public key (XSalsa20-Poly1305 via crypto_box_easy)
 *   8. POST /messages/send — retry once on failure with fresh keys (review amendment #2)
 *   9. upsertContact after success
 *
 * Crypto: XSalsa20-Poly1305 (crypto_box_easy) — NOT XChaCha20.
 * Standard libsodium-wrappers. Compatible with PyNaCl nacl.public.Box.
 */
import { useCallback } from "react";
import { useAuthContext } from "@/features/auth/AuthContext";
import { getRecipientPublicKeys, sendMessage, uploadAttachment } from "./messagesApi";
import { encryptForRecipient, signMessage, encryptAttachment, bytesToBase64 } from "./crypto";
import { upsertContact } from "./contacts";

/**
 * Compute sha256($username) as a hex string.
 * Input MUST include the $ prefix (Phase 14 D-01).
 * !handle is NOT hashed — passed as cleartext (Phase 14 D-03).
 */
async function computeRecipientHash(username: string): Promise<string> {
  const data = new TextEncoder().encode(username);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Build YYMMDD version string from current date. */
function getVersionString(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

export interface EncryptAndSendParams {
  recipientUsername: string; // $username or !handle
  body: string; // Markdown body
  attachment?: File; // optional file (encrypted + uploaded before send)
}

export function useEncryptAndSend() {
  const { user, cryptoKeys } = useAuthContext();

  const encryptAndSend = useCallback(
    async ({ recipientUsername, body, attachment }: EncryptAndSendParams): Promise<void> => {
      if (!cryptoKeys) throw new Error("Crypto keys not available — please log in again.");
      if (!user?.username) throw new Error("User identity not available.");

      // Step 1: Fetch recipient public keys (also refreshes contact cache)
      let recipientKeys = await getRecipientPublicKeys(recipientUsername);
      upsertContact({
        username: recipientUsername,
        publicKeyB64: recipientKeys.publicKeyB64,
        signingKeyB64: recipientKeys.signingKeyB64,
      });

      // Step 2: Routing hash
      const routingHash = recipientUsername.startsWith("!")
        ? recipientUsername // !handle: cleartext per D-03
        : await computeRecipientHash(recipientUsername); // $username: sha256 including $

      // Step 3: Attachment (if present) — encrypt + upload + build frontmatter entry
      interface AttachmentEntry {
        name: string;
        addr: string;
        keyB64: string;
        nonceB64: string;
        hash: string;
      }
      const attachmentEntries: AttachmentEntry[] = [];

      if (attachment) {
        const plainBytes = new Uint8Array(await attachment.arrayBuffer());
        const { ciphertext, key, nonce } = encryptAttachment(plainBytes);

        const hashBuf = await crypto.subtle.digest("SHA-256", plainBytes);
        const hash = Array.from(new Uint8Array(hashBuf))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        const uploaded = await uploadAttachment(
          new Blob([ciphertext.buffer as ArrayBuffer], { type: "application/octet-stream" }),
          attachment.name,
        );

        // Wrap per-attachment key for recipient (X25519 bundle stored as base64 JSON)
        const wrappedKey = encryptForRecipient(key, recipientKeys.publicKeyB64);

        attachmentEntries.push({
          name: attachment.name,
          addr: uploaded.s3Addr,
          keyB64: btoa(JSON.stringify(wrappedKey)),
          nonceB64: bytesToBase64(nonce),
          hash,
        });
      }

      // Step 4: Build frontmatter WITHOUT signature
      const version = getVersionString();
      const attachmentYaml =
        attachmentEntries.length > 0
          ? attachmentEntries
              .map(
                (a) =>
                  `  - name: ${a.name}\n    addr: ${a.addr}\n    key: ${a.keyB64}\n    nonce: ${a.nonceB64}\n    hash: ${a.hash}`,
              )
              .join("\n")
          : "  []";

      const frontmatterWithoutSig = [
        `version: ${version}`,
        `routing:`,
        `  from: ${user.username}`,
        `  to:`,
        `    - ${recipientUsername}`,
        `internal: []`,
        `attachments:`,
        attachmentYaml,
      ].join("\n");

      // Step 5: Sign (frontmatter-without-sig + body)
      const signedContent = new TextEncoder().encode(frontmatterWithoutSig + "\n" + body);
      const signature = signMessage(signedContent, cryptoKeys.ed25519SigningKey);

      // Step 6: Assemble full plaintext
      const fullFrontmatter = `signature: ${signature}\n${frontmatterWithoutSig}`;
      const fullPlaintext = `---\n${fullFrontmatter}\n---\n${body}`;
      const plaintextBytes = new TextEncoder().encode(fullPlaintext);

      // Step 7: Encrypt for recipient (X25519 DH + XSalsa20-Poly1305)
      const encrypt = (keys: typeof recipientKeys) => {
        const { ciphertextB64, ephemeralPublicKeyB64, nonceB64 } = encryptForRecipient(
          plaintextBytes,
          keys.publicKeyB64,
        );
        return btoa(JSON.stringify({ ciphertextB64, ephemeralPublicKeyB64, nonceB64 }));
      };

      // Step 8: Send with one retry on failure (review amendment #2 — key refresh-on-fail)
      let sendError: Error | null = null;
      try {
        await sendMessage([routingHash], encrypt(recipientKeys));
      } catch (err) {
        sendError = err instanceof Error ? err : new Error(String(err));
        // Re-fetch keys in case they rotated since last cache, then retry once
        try {
          recipientKeys = await getRecipientPublicKeys(recipientUsername);
          await sendMessage([routingHash], encrypt(recipientKeys));
          sendError = null; // retry succeeded
        } catch {
          // Retry also failed — surface original error
        }
      }
      if (sendError) throw sendError;

      // Step 9: Update contact cache with latest keys + lastSeen timestamp
      upsertContact({
        username: recipientUsername,
        publicKeyB64: recipientKeys.publicKeyB64,
        signingKeyB64: recipientKeys.signingKeyB64,
        lastSeen: new Date().toISOString(),
      });
    },
    [cryptoKeys, user],
  );

  return { encryptAndSend };
}
