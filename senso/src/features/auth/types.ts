export type VoiceGender = "masculine" | "feminine" | "neutral" | "indifferent";

export type User = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  isAdmin?: boolean;
  role?: string;
  voiceGender?: VoiceGender;
  voiceAutoListen?: boolean;
  defaultPersonaId?: string;
  strictPrivacyMode?: boolean;
  username?: string | null; // Phase 13: pseudonymous identity ($adj-noun-N or !admin)
  publicKeyB64?: string | null; // Phase 13: X25519 public key (base64)
  signingKeyB64?: string | null; // Phase 13: Ed25519 verify key (base64)
  adminHandle?: string | null; // Phase 14: !-prefixed admin handle
  recoveryPhrase?: string | null; // Phase 14: transient - only set at signup, cleared after interstitial
  naclPbkdf2Salt?: string | null; // Phase 13: base64 nacl_pbkdf2_salt for KDF
  naclKeyLoginEnvelopeB64?: string | null; // Phase 13: wrapped nacl_master_key envelope
  encryptedX25519PrivateB64?: string | null; // Phase 13: AES-GCM encrypted X25519 private key
  encryptedEd25519SigningB64?: string | null; // Phase 13: AES-GCM encrypted Ed25519 signing seed
  nationalities?: string[]; // Phase 20: ISO 3166-1/2 codes, default ["IT"]
};

/**
 * In-memory session crypto key material.
 * NEVER written to localStorage, sessionStorage, or IndexedDB.
 * Cleared on signOut or tab close.
 */
export type CryptoKeyMaterial = {
  naclMasterKey: Uint8Array; // 32 bytes - KEK for private key blobs
  x25519PrivateKey: Uint8Array; // 32 bytes - X25519 DH private key
  ed25519SigningKey: Uint8Array; // 64 bytes - libsodium expanded signing key
  ed25519PublicKey: Uint8Array; // 32 bytes - verify key (derived from seed)
};

export type AuthPayload = {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export type RefreshPayload = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export type MePayload = {
  user: User;
};

export type FallbackPayload = {
  fallback: "email_password";
  reason?: string;
};

export type BootstrapResult =
  | { status: "authenticated"; user: User }
  | { status: "unauthenticated" };

export type GoogleStartResult =
  | { kind: "redirect"; authUrl: string }
  | { kind: "fallback"; fallback: "email_password"; reason?: string };
