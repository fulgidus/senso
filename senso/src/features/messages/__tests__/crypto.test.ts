/**
 * Wave-0 crypto test stubs — Phase 15 (task 15-01-02)
 *
 * Stubs for libsodium-wrappers crypto primitives used in E2E messaging:
 *  - XSalsa20-Poly1305 encrypt/decrypt via crypto_box_easy (X25519 DH)
 *  - Ed25519 sign + verify
 *  - Ed25519 seed expansion (32-byte PyNaCl seed → 64-byte libsodium keypair)
 *
 * NOTE: crypto_box_easy uses XSalsa20-Poly1305, NOT XChaCha20-Poly1305.
 * The context doc uses "XChaCha20" loosely but libsodium-wrappers standard build
 * implements XSalsa20, which is identical to PyNaCl nacl.public.Box. Do NOT use
 * the sumo build's xchacha20poly1305 variant — it breaks cross-platform compat.
 */
import { describe, expect, it, beforeAll } from "vite-plus/test";
import sodium from "libsodium-wrappers";

beforeAll(async () => {
  await sodium.ready;
});

describe("crypto_box_easy — X25519 DH + XSalsa20-Poly1305", () => {
  it("round-trips encrypt/decrypt between two key pairs", () => {
    const alice = sodium.crypto_box_keypair();
    const bob = sodium.crypto_box_keypair();
    const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
    const message = "test message";

    const ciphertext = sodium.crypto_box_easy(message, nonce, bob.publicKey, alice.privateKey);
    const plaintext = sodium.crypto_box_open_easy(
      ciphertext,
      nonce,
      alice.publicKey,
      bob.privateKey,
    );

    expect(sodium.to_string(plaintext)).toEqual(message);
  });

  it("rejects tampered ciphertext", () => {
    const alice = sodium.crypto_box_keypair();
    const bob = sodium.crypto_box_keypair();
    const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
    const message = "test message";

    const ciphertext = sodium.crypto_box_easy(message, nonce, bob.publicKey, alice.privateKey);
    ciphertext[0] ^= 0xff; // tamper

    expect(() =>
      sodium.crypto_box_open_easy(ciphertext, nonce, alice.publicKey, bob.privateKey),
    ).toThrow();
  });
});

describe("Ed25519 sign + verify", () => {
  it("verifies a valid signature", () => {
    const keypair = sodium.crypto_sign_keypair();
    const message = "hello world";
    const sig = sodium.crypto_sign_detached(message, keypair.privateKey);
    const valid = sodium.crypto_sign_verify_detached(sig, message, keypair.publicKey);
    expect(valid).toBe(true);
  });

  it("rejects a tampered signature", () => {
    const keypair = sodium.crypto_sign_keypair();
    const message = "hello world";
    const sig = sodium.crypto_sign_detached(message, keypair.privateKey);
    sig[0] ^= 0xff;
    const valid = sodium.crypto_sign_verify_detached(sig, message, keypair.publicKey);
    expect(valid).toBe(false);
  });

  it("expands a 32-byte PyNaCl seed to libsodium 64-byte signing key", () => {
    // PyNaCl stores 32-byte seeds; libsodium needs 64-byte expanded keys.
    // Use sodium.crypto_sign_seed_keypair(seed32) to expand.
    const seed32 = sodium.randombytes_buf(32);
    const kp = sodium.crypto_sign_seed_keypair(seed32);

    // privateKey is 64 bytes (seed + public key concatenated in libsodium)
    expect(kp.privateKey.length).toBe(64);
    expect(kp.publicKey.length).toBe(32);
  });
});
