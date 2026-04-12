/**
 * parseMessage.ts - decrypt and parse a PolledMessageDTO into a DecryptedMessage.
 *
 * Message format (plaintext after decryption):
 *   ---
 *   signature: <Ed25519 detached sig of: version + routing + internal + attachments + body>
 *   version: YYMMDD
 *   routing:
 *     from: [$username or !handle]
 *     to: [$username, ...]
 *   internal: []
 *   attachments: []
 *   ---
 *   Markdown body
 */
import yaml from "js-yaml";
import type { PolledMessageDTO, DecryptedMessage } from "./messagesApi";
import { decryptFromSender, verifySignature } from "./crypto";
import type { CryptoKeyMaterial } from "@/features/auth/types";

interface MessageFrontmatter {
  signature?: string;
  version?: string;
  routing: {
    from: string;
    to: string[];
    cc?: string[];
  };
  internal?: unknown[];
  attachments?: unknown[];
}

/**
 * Decrypt and parse a polled message.
 *
 * The encrypted payload format is JSON encoded as base64:
 *   base64(JSON({ ciphertextB64, ephemeralPublicKeyB64, nonceB64 }))
 *
 * This matches how ComposeMessage builds the payload in Plan 15-05.
 *
 * Falls back to returning a message with signatureValid=false on any error.
 */
export async function parsePolledMessage(
  msg: PolledMessageDTO,
  cryptoKeys: CryptoKeyMaterial,
  knownSigningKeys: Map<string, string>, // username → signing_key_b64
): Promise<DecryptedMessage> {
  try {
    // Payload format: JSON({ ciphertextB64, ephemeralPublicKeyB64, nonceB64 })
    const envelope = JSON.parse(atob(msg.encryptedPayload)) as {
      ciphertextB64: string;
      ephemeralPublicKeyB64: string;
      nonceB64: string;
    };

    const plaintextBytes = decryptFromSender(
      envelope.ciphertextB64,
      envelope.ephemeralPublicKeyB64,
      envelope.nonceB64,
      cryptoKeys.x25519PrivateKey,
    );

    const plaintext = new TextDecoder().decode(plaintextBytes);

    // Split YAML frontmatter from Markdown body
    const fmMatch = plaintext.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/m);
    if (!fmMatch) throw new Error("No frontmatter found in decrypted payload");

    // Mandatory yaml.JSON_SCHEMA (Review amendment #3)
    const frontmatter = yaml.load(fmMatch[1], { schema: yaml.JSON_SCHEMA }) as MessageFrontmatter;
    const body = fmMatch[2];

    // Verify Ed25519 signature
    const { from } = frontmatter.routing;
    const signerKey = knownSigningKeys.get(from);
    let signatureValid = false;
    if (signerKey && frontmatter.signature) {
      // Signature covers: version + routing + internal + attachments + body
      // (frontmatter minus the signature line)
      const signedContent = new TextEncoder().encode(fmMatch[1].replace(/^signature:.*\n/m, ""));
      signatureValid = verifySignature(signedContent, frontmatter.signature, signerKey);
    }

    return {
      id: msg.id,
      createdAt: msg.createdAt,
      from,
      to: frontmatter.routing.to ?? [],
      body,
      signatureValid,
      isAdmin: from.startsWith("!"),
      signerPublicKey: signerKey,
      frontmatter: frontmatter as unknown as Record<string, unknown>,
    };
  } catch (err) {
    console.error("Failed to decrypt/parse message", msg.id, err);
    return {
      id: msg.id,
      createdAt: msg.createdAt,
      from: "unknown",
      to: [],
      body: "",
      signatureValid: false,
      isAdmin: false,
      frontmatter: {},
    };
  }
}
