/**
 * crypto.ts — Phase 15 client-side crypto module
 *
 * Key derivation:
 *   Argon2id(password, nacl_pbkdf2_salt) → 32-byte wrap key
 *   → unwrap nacl_key_login_envelope_b64 (AES-GCM v1 or secretbox v2)
 *   → nacl_master_key
 *   → decrypt encrypted_x25519_private_b64 → X25519 private key (32 bytes)
 *   → decrypt encrypted_ed25519_signing_b64 → Ed25519 seed (32 bytes)
 *   → expand seed to 64-byte libsodium signing key
 *
 * Message encryption:
 *   For each recipient:
 *     ephemeral_sk, ephemeral_pk = crypto_box_keypair()
 *     shared_key = crypto_box_beforenm(recipient_x25519_pk, ephemeral_sk)
 *     ciphertext = crypto_box_easy_afternm(plaintext, nonce, shared_key)
 *   → include ephemeral_pk in message frontmatter
 *
 * NOTE: crypto_box_easy uses XSalsa20-Poly1305 (NOT XChaCha20).
 * Standard libsodium-wrappers build. Compatible with PyNaCl nacl.public.Box.
 *
 * Argon2id params (RFC 9106 Low Memory — identical to Python argon2-cffi):
 *   time_cost = 3, memory_cost = 65536 KiB, parallelism = 4, hash_len = 32
 */

import sodium from "libsodium-wrappers";
import argon2 from "argon2-browser";
import { ArgonType } from "argon2-browser";

// ── Cross-realm safe conversion ─────────────────────────────────────────────
/**
 * Ensure a Uint8Array is in the current realm (fixes jsdom cross-realm instanceof).
 * libsodium-wrappers checks `instanceof Uint8Array` which can fail in test environments.
 */
function toLocalUint8Array(arr: Uint8Array): Uint8Array {
  return new Uint8Array(arr);
}

// ── Base64 helpers ────────────────────────────────────────────────────────────

export function base64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

// ── Argon2id parameters (RFC 9106 Low Memory) ────────────────────────────────
// MUST match api/tests/test_kdf_interop.py exactly.
export const ARGON2ID_PARAMS = {
  time: 3,
  mem: 65536, // 64 MiB in KiB
  parallelism: 4,
  hashLen: 32,
  type: ArgonType.Argon2id,
} as const;

// ── AES-GCM helpers (v1 envelope format) ─────────────────────────────────────
/**
 * Decrypt a v1 AES-GCM envelope.
 * Format: base64(nonce_12bytes || ciphertext_with_tag)
 * Key must be 32 bytes (AES-256-GCM).
 */
async function aesgcmDecrypt(key: Uint8Array, envelopeB64: string): Promise<Uint8Array> {
  const raw = base64ToBytes(envelopeB64);
  const nonce = raw.slice(0, 12);
  const ciphertext = raw.slice(12);

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    "raw",
    new Uint8Array(key),
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );

  const plaintext = await globalThis.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: nonce },
    cryptoKey,
    ciphertext,
  );

  return new Uint8Array(plaintext);
}

// ── secretbox helpers (v2 envelope format) ────────────────────────────────────
/**
 * Decrypt a v2 secretbox envelope.
 * Format: "v2:" + base64(nonce_24bytes || ciphertext_with_mac)
 * Key must be 32 bytes (XSalsa20-Poly1305 secretbox).
 */
function secretboxDecrypt(key: Uint8Array, envelopeWithPrefix: string): Uint8Array {
  const b64 = envelopeWithPrefix.startsWith("v2:")
    ? envelopeWithPrefix.slice(3)
    : envelopeWithPrefix;

  const raw = base64ToBytes(b64);
  const nonce = raw.slice(0, sodium.crypto_secretbox_NONCEBYTES); // 24 bytes
  const ciphertext = raw.slice(sodium.crypto_secretbox_NONCEBYTES);

  const plaintext = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);
  if (!plaintext) throw new Error("secretbox decryption failed — wrong key or tampered data");
  return plaintext;
}

// ── PBKDF2 wrap key derivation (v1 envelope format fallback) ─────────────────
/**
 * Derive a 32-byte wrap key from password + nacl_pbkdf2_salt using PBKDF2-SHA256.
 *
 * Used to unwrap v1 (legacy AES-GCM) login envelopes. After the backend migrates
 * the envelope to v2 (Argon2id + secretbox), this function is no longer needed
 * for that user. Kept for backward compatibility during the migration window.
 *
 * Params: PBKDF2-SHA256, 600_000 iterations, 32-byte output.
 * MUST match api/app/db/nacl_crypto.py derive_nacl_login_wrap_key().
 *
 * @param password — plaintext password string
 * @param saltB64  — base64-encoded nacl_pbkdf2_salt from login response
 * @returns 32-byte Uint8Array wrap key
 */
export async function derivePbkdf2WrapKey(password: string, saltB64: string): Promise<Uint8Array> {
  const salt = base64ToBytes(saltB64);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt.buffer as ArrayBuffer, iterations: 600_000 },
    keyMaterial,
    256, // 32 bytes
  );
  return new Uint8Array(bits);
}

// ── Argon2id key derivation ───────────────────────────────────────────────────
/**
 * Derive a 32-byte wrap key from password + nacl_pbkdf2_salt using Argon2id.
 *
 * @param password — plaintext password string
 * @param saltB64  — base64-encoded nacl_pbkdf2_salt from the login response
 * @returns 32-byte Uint8Array wrap key
 */
export async function deriveArgon2idWrapKey(
  password: string,
  saltB64: string,
): Promise<Uint8Array> {
  const salt = base64ToBytes(saltB64);
  const result = await argon2.hash({
    pass: password,
    salt,
    ...ARGON2ID_PARAMS,
  });
  return result.hash;
}

// ── Login envelope unwrap ─────────────────────────────────────────────────────
/**
 * Unwrap the nacl_master_key from the login envelope.
 * Supports both v1 (AES-GCM + PBKDF2) and v2 (secretbox + Argon2id) formats.
 *
 * v1: envelope is raw base64(nonce+ct) — no prefix
 * v2: envelope starts with "v2:" prefix
 *
 * The wrapKey must match the envelope version:
 *  - v1: PBKDF2(password, nacl_pbkdf2_salt, 600_000, SHA-256) — 32 bytes
 *  - v2: Argon2id(password, nacl_pbkdf2_salt, time=3, mem=65536, par=4) — 32 bytes
 *
 * For the migration path (Plan 15-03), login always derives BOTH, tries v2 first,
 * then falls back to v1.
 */
export async function unwrapLoginEnvelope(
  envelopeB64: string,
  wrapKey: Uint8Array,
): Promise<Uint8Array> {
  if (envelopeB64.startsWith("v2:")) {
    // v2: libsodium secretbox
    return secretboxDecrypt(wrapKey, envelopeB64);
  }
  // v1: AES-GCM (PBKDF2 wrap key expected)
  return aesgcmDecrypt(wrapKey, envelopeB64);
}

// ── Private key decryption ────────────────────────────────────────────────────
/**
 * Decrypt a private key blob (encrypted_x25519_private_b64 or encrypted_ed25519_signing_b64)
 * using the nacl_master_key.
 *
 * v1: AES-GCM(nacl_master_key, private_key_bytes)
 * v2: secretbox — detect by "v2:" prefix
 */
export async function decryptPrivateKey(
  encryptedB64: string,
  masterKey: Uint8Array,
): Promise<Uint8Array> {
  if (encryptedB64.startsWith("v2:")) {
    return secretboxDecrypt(masterKey, encryptedB64);
  }
  return aesgcmDecrypt(masterKey, encryptedB64);
}

// ── Ed25519 seed expansion ────────────────────────────────────────────────────
/**
 * Expand a 32-byte Ed25519 seed (as stored by PyNaCl) to a libsodium 64-byte signing key.
 *
 * PyNaCl stores only the 32-byte seed. libsodium's crypto_sign_* functions expect
 * the 64-byte expanded key (seed || public_key). Use crypto_sign_seed_keypair(seed32).
 */
export function expandEd25519Seed(seed32: Uint8Array): {
  privateKey: Uint8Array; // 64 bytes
  publicKey: Uint8Array; // 32 bytes
} {
  if (seed32.length !== 32) {
    throw new Error(`Ed25519 seed must be 32 bytes, got ${seed32.length}`);
  }
  return sodium.crypto_sign_seed_keypair(seed32);
}

// ── X25519 DH encryption (for compose) ───────────────────────────────────────
/**
 * Encrypt plaintext for a single recipient using ephemeral X25519 DH.
 *
 * Generates a fresh ephemeral key pair per call. Caller must include the
 * returned ephemeralPublicKey in the message frontmatter for the recipient
 * to derive the shared secret.
 *
 * Uses crypto_box_easy (XSalsa20-Poly1305). Compatible with PyNaCl Box.
 */
export function encryptForRecipient(
  plaintext: Uint8Array,
  recipientPublicKeyB64: string,
): { ciphertextB64: string; ephemeralPublicKeyB64: string; nonceB64: string } {
  const recipientPk = base64ToBytes(recipientPublicKeyB64);
  const ephemeral = sodium.crypto_box_keypair();
  const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
  const ciphertext = sodium.crypto_box_easy(
    toLocalUint8Array(plaintext),
    nonce,
    recipientPk,
    ephemeral.privateKey,
  );
  return {
    ciphertextB64: bytesToBase64(ciphertext),
    ephemeralPublicKeyB64: bytesToBase64(ephemeral.publicKey),
    nonceB64: bytesToBase64(nonce),
  };
}

/**
 * Decrypt a message payload using the recipient's X25519 private key.
 */
export function decryptFromSender(
  ciphertextB64: string,
  ephemeralPublicKeyB64: string,
  nonceB64: string,
  recipientPrivateKey: Uint8Array,
): Uint8Array {
  const ciphertext = base64ToBytes(ciphertextB64);
  const ephemeralPk = base64ToBytes(ephemeralPublicKeyB64);
  const nonce = base64ToBytes(nonceB64);
  const plaintext = sodium.crypto_box_open_easy(
    ciphertext,
    nonce,
    ephemeralPk,
    recipientPrivateKey,
  );
  if (!plaintext) throw new Error("Decryption failed — wrong key or tampered ciphertext");
  return plaintext;
}

// ── Ed25519 sign / verify ─────────────────────────────────────────────────────
/**
 * Sign a message with the user's Ed25519 signing key (64-byte libsodium format).
 * Returns base64-encoded detached signature (64 bytes).
 */
export function signMessage(messageBytes: Uint8Array, signingKey64: Uint8Array): string {
  const sig = sodium.crypto_sign_detached(toLocalUint8Array(messageBytes), signingKey64);
  return bytesToBase64(sig);
}

/**
 * Verify an Ed25519 detached signature.
 * @param verifyKeyB64 — base64 Ed25519 verify key (32 bytes, from UserDTO.signing_key_b64)
 */
export function verifySignature(
  messageBytes: Uint8Array,
  signatureB64: string,
  verifyKeyB64: string,
): boolean {
  try {
    const sig = base64ToBytes(signatureB64);
    const vk = base64ToBytes(verifyKeyB64);
    return sodium.crypto_sign_verify_detached(sig, toLocalUint8Array(messageBytes), vk);
  } catch {
    return false;
  }
}

// ── secretbox for attachments ─────────────────────────────────────────────────
/**
 * Encrypt a file with a random 32-byte symmetric key (XSalsa20-Poly1305 secretbox).
 * Returns the ciphertext and the key (to be wrapped for recipients in frontmatter).
 */
export function encryptAttachment(plaintext: Uint8Array): {
  ciphertext: Uint8Array;
  key: Uint8Array; // 32-byte random symmetric key — wrap for each recipient
  nonce: Uint8Array; // 24-byte nonce — store alongside ciphertext
} {
  const key = sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES); // 32 bytes
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES); // 24 bytes
  const ciphertext = sodium.crypto_secretbox_easy(toLocalUint8Array(plaintext), nonce, key);
  return { ciphertext, key, nonce };
}

/**
 * Decrypt an attachment using its per-file symmetric key.
 */
export function decryptAttachment(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  key: Uint8Array,
): Uint8Array {
  const plaintext = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);
  if (!plaintext) throw new Error("Attachment decryption failed");
  return plaintext;
}
