/**
 * Wave-0 crypto test stubs - Phase 15 (task 15-01-02)
 * Updated in task 15-02-02 to import from crypto.ts module.
 *
 * Stubs for libsodium-wrappers crypto primitives used in E2E messaging:
 *  - XSalsa20-Poly1305 encrypt/decrypt via crypto_box_easy (X25519 DH)
 *  - Ed25519 sign + verify
 *  - Ed25519 seed expansion (32-byte PyNaCl seed → 64-byte libsodium keypair)
 *
 * NOTE: crypto_box_easy uses XSalsa20-Poly1305, NOT XChaCha20-Poly1305.
 * The context doc uses "XChaCha20" loosely but libsodium-wrappers standard build
 * implements XSalsa20, which is identical to PyNaCl nacl.public.Box. Do NOT use
 * the sumo build's xchacha20poly1305 variant - it breaks cross-platform compat.
 */
import { describe, expect, it, beforeAll } from "vite-plus/test";
import sodium from "libsodium-wrappers";
import {
    encryptForRecipient,
    decryptFromSender,
    signMessage,
    verifySignature,
    expandEd25519Seed,
    encryptAttachment,
    decryptAttachment,
    base64ToBytes,
    bytesToBase64,
} from "../crypto";

beforeAll(async () => {
    await sodium.ready;
});

describe("crypto_box_easy - X25519 DH + XSalsa20-Poly1305", () => {
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

// ── Tests using the crypto.ts module ─────────────────────────────────────────

describe("crypto.ts - encryptForRecipient / decryptFromSender", () => {
    it("round-trips plaintext for a recipient", () => {
        const recipientKp = sodium.crypto_box_keypair();
        const recipientPkB64 = bytesToBase64(recipientKp.publicKey);
        const message = new TextEncoder().encode("hello from crypto.ts");

        const { ciphertextB64, ephemeralPublicKeyB64, nonceB64 } = encryptForRecipient(
            message,
            recipientPkB64,
        );

        const decrypted = decryptFromSender(
            ciphertextB64,
            ephemeralPublicKeyB64,
            nonceB64,
            recipientKp.privateKey,
        );

        expect(new TextDecoder().decode(decrypted)).toBe("hello from crypto.ts");
    });

    it("throws on tampered ciphertext", () => {
        const recipientKp = sodium.crypto_box_keypair();
        const recipientPkB64 = bytesToBase64(recipientKp.publicKey);
        const message = new TextEncoder().encode("sensitive");

        const { ciphertextB64, ephemeralPublicKeyB64, nonceB64 } = encryptForRecipient(
            message,
            recipientPkB64,
        );

        // Tamper with ciphertext
        const tampered = base64ToBytes(ciphertextB64);
        tampered[0] ^= 0xff;
        const tamperedB64 = bytesToBase64(tampered);

        expect(() =>
            decryptFromSender(tamperedB64, ephemeralPublicKeyB64, nonceB64, recipientKp.privateKey),
        ).toThrow();
    });
});

describe("crypto.ts - signMessage / verifySignature", () => {
    it("signs and verifies a message", () => {
        const seed32 = sodium.randombytes_buf(32);
        const { privateKey: signingKey64, publicKey } = expandEd25519Seed(seed32);
        const pkB64 = bytesToBase64(publicKey);

        const message = new TextEncoder().encode("signed message");
        const sigB64 = signMessage(message, signingKey64);

        expect(verifySignature(message, sigB64, pkB64)).toBe(true);
    });

    it("rejects a tampered signature", () => {
        const seed32 = sodium.randombytes_buf(32);
        const { privateKey: signingKey64, publicKey } = expandEd25519Seed(seed32);
        const pkB64 = bytesToBase64(publicKey);

        const message = new TextEncoder().encode("signed message");
        const sigBytes = base64ToBytes(signMessage(message, signingKey64));
        sigBytes[0] ^= 0xff;
        const tamperedSigB64 = bytesToBase64(sigBytes);

        expect(verifySignature(message, tamperedSigB64, pkB64)).toBe(false);
    });
});

describe("crypto.ts - encryptAttachment / decryptAttachment", () => {
    it("round-trips an attachment", () => {
        const data = new TextEncoder().encode("attachment content");
        const { ciphertext, nonce, key } = encryptAttachment(data);

        expect(key.length).toBe(sodium.crypto_secretbox_KEYBYTES); // 32 bytes
        expect(nonce.length).toBe(sodium.crypto_secretbox_NONCEBYTES); // 24 bytes

        const decrypted = decryptAttachment(ciphertext, nonce, key);
        expect(new TextDecoder().decode(decrypted)).toBe("attachment content");
    });
});

describe("crypto.ts - expandEd25519Seed", () => {
    it("expands a 32-byte seed to 64-byte private key", () => {
        const seed32 = sodium.randombytes_buf(32);
        const { privateKey, publicKey } = expandEd25519Seed(seed32);

        expect(privateKey.length).toBe(64);
        expect(publicKey.length).toBe(32);
    });

    it("throws for wrong seed length", () => {
        const badSeed = new Uint8Array(16);
        expect(() => expandEd25519Seed(badSeed)).toThrow("Ed25519 seed must be 32 bytes");
    });
});
