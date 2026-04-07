---
created: "2026-03-31T19:25:24.480Z"
updated: "2026-04-01T00:00:00.000Z"
title: E2E Encrypted Messaging, Identity & Crypto Architecture
area: architecture
supersedes: "Original symmetric envelope scheme (flawed - can't encrypt for someone without their key in a symmetric model)"
files:
  - api/app/db/crypto.py
  - api/app/db/models.py
  - api/app/services/admin_service.py
  - api/app/routers/admin.py
  - "(new) api/app/messaging/"
  - "(new) api/app/identity/"
---

## Problem

`_obfuscate_email()` (cosmetic `u****@domain.com` in admin merchant mapping) is a half-measure. The original todo proposed a symmetric admin-envelope scheme, but that approach is **fundamentally flawed**: you cannot encrypt data for a specific recipient without their key in a purely symmetric model. The real solution is a full asymmetric key-pair architecture that also enables E2E encrypted messaging as a new product capability.

## Vision

Transition all app-level crypto to a PGP-style asymmetric model. Every user gets a permanent key pair at signup. Contact data (email, phone) becomes PII encrypted with admin access only in emergencies. A new E2E encrypted messaging system allows users to communicate without the server reading message content.

## Design Decisions (Confirmed)

### Identity

- **Key pair**: Every user gets a permanent asymmetric key pair at signup.
- **Username format**: `$adjective-noun-digits` (e.g. `$witty-otter-42`). Prefix is `$` (on-brand for fintech).
- **Username purpose**: Internal messaging only, NOT login.
- **Username generation**: Brute-force uniqueness check at creation time. Add entropy (longer digit suffix, larger word pools) if collision rate grows. No pre-generated pool.
- **Login email**: Kept as a "necessary evil" for auth. Goal: eliminate eventually.
- **Contact methods** (email, phone): PII - encrypted at rest, admin-readable only in emergencies.

### Key Management

- **Private key wrapping**: Multiple recovery envelopes - email+password, passkey, BIP39-style recovery phrase, SSO-derived key.
- **Key permanence**: Key pair is permanent until algorithm obsolescence forces migration.
- **No server-side recovery**: Lose all envelopes = lose all private data (by design).
- **No revocation**: Server cannot link messages to users, so revocation is not possible.

### Crypto Stack (NaCl/libsodium)

| Layer           | Algorithm          | Library (Python)      | Library (Browser)     |
| --------------- | ------------------ | --------------------- | --------------------- |
| Key exchange    | X25519             | PyNaCl / cryptography | libsodium-wrappers    |
| Bulk encryption | XChaCha20-Poly1305 | PyNaCl                | libsodium-wrappers    |
| Signatures      | Ed25519            | PyNaCl / cryptography | libsodium-wrappers    |
| Key derivation  | Argon2id           | argon2-cffi           | argon2-browser (WASM) |

Rationale: Misuse-resistant APIs, constant-time by design, X25519+Ed25519 share Curve25519 family (one key pair derives both via `crypto_sign_ed25519_sk_to_curve25519`). Used by Signal, WireGuard, age. Existing PBKDF2 in `crypto.py` must be hardened.

### Message Routing

- **Table**: `undelivered_messages` with `recipient_hashes: string[]`.
- **Delivery**: Pull-on-login, poll (for now, wrap the method so we can transition to websockets ASAP). Client checks if user's hash appears in any undelivered entries.
- **Cleanup**: When a recipient pulls their copy, remove their hash from the entry. When last recipient pulls, delete the entry entirely. Each user has their own inbox to store messages (and preserve them from the purge).
- **Chatrooms**: Same mechanism with hash of room IDs (decoupling the messages delivery statuses from the room participant ids). Per-recipient hash removal ensures all members receive before purge.
- **TTL**: 30-day purge on undelivered messages. Cron job or startup sweep.

### Message Format

- Sender identity is **inside** the encrypted payload (not cleartext metadata).
- Server only knows: "this blob is addressed to these recipient hashes."
- Client never persists plaintext to disk.
- Format: Markdown + frontmatter.

```
---
signature: <Ed25519 signature of `version` + `routing` + `internal` + `attachments` + `body`>
version: YYMMDD
routing:
  - from:
    - user: $witty-otter-42
  - to:
    - user: $clever-fox-17
    - user: $brave-hawk-93
  - cc:
    - user: $calm-deer-08
  - ccn:
    - user: $shy-wolf-55
internal:
  - name: logo.png
    addr: s3://bucket/key
    key: <per-attachment symmetric key, encrypted for all recipients>
    hash: <sha256-of-decrypted-content>
attachments:
  - name: logo.psd
    addr: s3://bucket/key
    key: <per-attachment symmetric key, encrypted for all recipients>
    hash: <sha256-of-decrypted-content>
    comments:
      - from: $witty-otter-42
        text: "Original PSD with layers, you shouldn't need to see this but here it is if you do. If you need help, $calm-deer-08 is good with Photoshop"
---

Message body in **Markdown**.

You can include in the markdown only allowed internal references to attachments (e.g. `![Our beautiful logo](internal:logo.png)`), but the actual attachment data is never inlined as base64. The client fetches attachments separately using the S3 refs and decrypts them with the provided keys.

The main differences between `internal` and `attachments` blocks are:
- `internal` is for structured data that the client can reference (e.g. images to embed in the markdown body). These are not "attachments" per se, but auxiliary data that supports the message content.
- `attachments` are for files that the user explicitly attaches to the message, which may or may not be actually downloaded by the recipient. They are more like traditional email attachments, whereas `internal` items are more like embedded resources. Both are encrypted with per-attachment keys that are wrapped for all recipients, but they serve different semantic purposes in the message structure.

```

### Zero-Knowledge Recipient Routing

- Recipients are identified by hashes of their public usernames (e.g. `sha256($username)`).
- Server only sees these hashes, never the actual usernames or keys.
- Client checks for undelivered messages by matching their own hash against the recipient hashes in the `undelivered_messages` table.
- This allows the server to route messages without knowing who the recipients are, preserving user privacy and enabling E2E encryption.
- Although message interception is still possible, the server cannot decrypt or link messages to specific users, providing strong privacy guarantees.

## Migration Path

1. Add key pair generation to signup flow.
2. Add `$username` generation and assignment.
    1. Admins can also have a custom username with a special prefix (e.g. `!fulgidus`) for official messaging purposes, but it must be unique.
        - This provisions a second key pair for the admin that is used exclusively for official communications. The admin can choose which key to use when sending messages, allowing them to send both official (signed with the admin key) and private (signed with the user key) messages as needed.
        - Admin usernames can be changed by the admin, but the underlying key pair remains the same. This allows for flexibility in official communication while maintaining a consistent identity for the admin's messages.
            - Note: in the routing public_keys table, renaming will add a new entry for the new username but will not remove the previous entry.
                - The username change will be signed and added to a special table that clients can check to verify the authenticity of username changes, but the server will still have both entries in the public_keys table for routing purposes. This allows the admin to maintain their messaging capabilities even if they change their official username, while still providing a way for clients to verify the legitimacy of the change.
                    - This way if something like this happens:
                        - !admin messages $user
                        - !admin changes username to !newadmin
                        - !newadmin messages $user again
                    The client can verify that both messages are from the same admin by checking the signature against the admin's key, even though the username in the routing has changed.
                    Moreover, in this scenario:
                        - !admin messages $user
                        - !admin changes username to !newadmin
                        - $user hits reply and messages !admin (not !newadmin)
                    The client can still verify that the reply is going to the same admin by checking the signature, and even internally rename the recipient to !newadmin for display purposes, while still routing it to the same key. This allows for seamless username changes without disrupting communication or losing the ability to verify message authenticity.
        - Admin usernames are public and not hashed in the routing, since they are meant for official communication and transparency.
        - Message signing with admin keys allows clients to verify authenticity of official messages, while still keeping user-to-user messages private and unlinkable.
            - This means that in the "public_keys" table, there will be two entries in the case of an admin: one for the standard username (dollar, hashed for routing) and one for the admin username (exclamation, cleartext for routing). The admin can choose which key to use when sending messages, allowing them to send both official (signed with the admin key) and private (signed with the user key) messages as needed.
3. Replace `_obfuscate_email()` with proper at-rest encryption of contact fields, if an identifier is needed, the $username will suffice (allows the admin to message the users).
4. Build `undelivered_messages` table and pull-on-login delivery.
5. Build client-side encrypt/decrypt with libsodium-wrappers.

## Open Questions

- BIP39 wordlist: Use standard English BIP39 or create fiscal-themed wordlist?
- Admin emergency access: How does admin decrypt contact PII? Should the contact PII (just those fields) be encrypted also with a separate key that admin can access via a secure vault, while the messaging keys remain user-controlled?
- Rate limiting on message polling to prevent abuse? HTTP429? Exponential backoff on client?
- Maximum message size / attachment count? Same as email? Tiered? Admin has override ability?
    - UX for attachment addition and removal before sending? Can you add attachments after the initial send (e.g. "forgot to attach the file, let me add it now")?
- Should we allow editing/deleting messages after sending? If so, how do we handle the fact that the server can't link messages to users? Maybe a per-message edit token that the client can use to authenticate edit/delete requests without revealing user identity? We should probably add a `revision:` field to the message format to handle edits, and the client can manage edit history locally since the server can't track it. The real issue would be spoofing
- Should we offer delivery/read receipts? How would that work in an E2E encrypted model where the server can't track message delivery status per user? Maybe the client can send encrypted receipts back to the server that are only readable by the sender, but this adds complexity and potential privacy concerns.
- Build chatroom extension or defer until we have 1:1 messaging working smoothly?
- UX for key recovery and loss scenarios?
- How do we handle user support if users lose access to their keys and thus all their data? Clear communication about the risks of key loss and the importance of backup is essential, but we may also want to provide some kind of "emergency recovery" process that still respects user privacy (e.g. a time-locked recovery option that requires multiple admin approvals and still doesn't reveal message content). User should be made aware that the process is ongoing, and any user activity during this time should cancel the recovery to prevent unauthorized access. How do we securely implement this process while maintaining our zero-knowledge principles? How can we do it aven against hypotetical attackers that might alter the source code to bypass the safeguards? Maybe we can use a multi-party computation approach for recovery that requires multiple independent parties to collaborate without any single party having access to the full key or message data. This is a complex area that requires careful design and implementation to balance security, privacy, and usability.
