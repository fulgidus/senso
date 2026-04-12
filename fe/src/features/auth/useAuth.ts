import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import {
  bootstrapSession,
  login,
  logout,
  makeOnUnauthorized,
  signup,
  startGoogle,
} from "@/features/auth/session";
import { ApiClientError } from "@/lib/api-client";
import type { User, CryptoKeyMaterial } from "@/features/auth/types";
import { createMessagesApi, type PolledMessageDTO } from "@/features/messages/messagesApi";

type AuthMode = "signup" | "login";

type AuthState = {
  initialized: boolean;
  loading: boolean;
  mode: AuthMode;
  user: User | null;
  error: string | null;
  googleFallback: string | null;
};

const initialState: AuthState = {
  initialized: false,
  loading: false,
  mode: "login",
  user: null,
  error: null,
  googleFallback: null,
};

function loginErrorKey(err: unknown): string {
  if (err instanceof ApiClientError) {
    const code = (err.data as { code?: string } | null)?.code;
    if (err.status === 401 || code === "invalid_credentials") return "auth.errorInvalidCredentials";
    if (err.status === 429) return "auth.errorTooManyAttempts";
    if (err.status >= 500) return "auth.errorServerDown";
  }
  return "auth.errorLoginFailed";
}

function signupErrorKey(err: unknown): string {
  if (err instanceof ApiClientError) {
    const code = (err.data as { code?: string } | null)?.code;
    if (err.status === 409 || code === "email_in_use") return "auth.errorEmailInUse";
    if (err.status === 422) return "auth.errorInvalidData";
    if (err.status >= 500) return "auth.errorServerDown";
  }
  return "auth.errorSignupFailed";
}

/**
 * Derive crypto key material from the user's password and login envelope fields.
 * Returns null if the user account is pre-Phase-13 (missing envelope fields).
 * Fails silently - session continues without crypto keys if derivation fails.
 */
async function deriveCryptoKeys(password: string, user: User): Promise<CryptoKeyMaterial | null> {
  if (
    !user.naclPbkdf2Salt ||
    !user.naclKeyLoginEnvelopeB64 ||
    !user.encryptedX25519PrivateB64 ||
    !user.encryptedEd25519SigningB64
  ) {
    // Pre-Phase-13 account or missing envelope - skip silently
    return null;
  }
  try {
    // Lazy-load crypto module: argon2-browser ships a .wasm binary that must be
    // fetched at runtime.  Importing it eagerly at the top of useAuth.ts would
    // block the *entire* app if the WASM file isn't served with the correct
    // MIME type (e.g. nginx SPA fallback returning text/html).  Dynamic import
    // defers loading until a user actually logs in with a Phase-13+ account.
    const {
      deriveArgon2idWrapKey,
      derivePbkdf2WrapKey,
      unwrapLoginEnvelope,
      decryptPrivateKey,
      expandEd25519Seed,
    } = await import("@/features/messages/crypto");

    const envelope = user.naclKeyLoginEnvelopeB64;
    let naclMasterKey: Uint8Array;

    if (envelope.startsWith("v2:")) {
      // v2: use Argon2id wrap key (post-migration)
      const wrapKey = await deriveArgon2idWrapKey(password, user.naclPbkdf2Salt);
      naclMasterKey = await unwrapLoginEnvelope(envelope, wrapKey);
    } else {
      // v1: use PBKDF2 wrap key (legacy; backend migrates to v2 on next login)
      const wrapKey = await derivePbkdf2WrapKey(password, user.naclPbkdf2Salt);
      naclMasterKey = await unwrapLoginEnvelope(envelope, wrapKey);
    }
    const x25519PrivateKey = await decryptPrivateKey(user.encryptedX25519PrivateB64, naclMasterKey);
    const ed25519Seed32 = await decryptPrivateKey(user.encryptedEd25519SigningB64, naclMasterKey);
    const { privateKey: ed25519SigningKey, publicKey: ed25519PublicKey } =
      expandEd25519Seed(ed25519Seed32);
    return { naclMasterKey, x25519PrivateKey, ed25519SigningKey, ed25519PublicKey };
  } catch (err) {
    console.error("Key derivation failed - session continues without crypto keys:", err);
    return null;
  }
}

export function useAuth() {
  const [state, setState] = useState<AuthState>(initialState);
  const [cryptoKeys, setCryptoKeys] = useState<CryptoKeyMaterial | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [pendingMessageCount, setPendingMessageCount] = useState(0);
  const [polledMessages, setPolledMessages] = useState<PolledMessageDTO[]>([]);
  const { t } = useTranslation();
  const navigate = useNavigate();

  const onUnauthorized = useMemo(() => makeOnUnauthorized((to) => navigate(to)), [navigate]);

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      const result = await bootstrapSession();
      if (!isMounted) return;
      setState((current) => ({
        ...current,
        initialized: true,
        user: result.status === "authenticated" ? result.user : null,
      }));
    };
    void run();
    return () => {
      isMounted = false;
    };
  }, []);

  const setMode = useCallback((mode: AuthMode) => {
    setState((current) => ({ ...current, mode, error: null, googleFallback: null }));
  }, []);

  const submit = useCallback(
    async (email: string, password: string) => {
      setState((current) => ({ ...current, loading: true, error: null }));
      try {
        const result =
          state.mode === "signup" ? await signup(email, password) : await login(email, password);
        setState((current) => ({
          ...current,
          loading: false,
          user: result.user,
          googleFallback: null,
        }));
        // Derive crypto keys after successful auth (fail silently if envelope missing)
        const keys = await deriveCryptoKeys(password, result.user);
        setCryptoKeys(keys);
        // Poll once for undelivered messages at login - results cached in context for InboxTab.
        // InboxTab must consume polledMessages from context, NOT call pollMessages() again.
        // setIsPolling wraps the call so MessagesPage shows a spinner instead of a false
        // empty state during the bootstrap window. (Review amendment #1)
        setIsPolling(true);
        createMessagesApi(onUnauthorized)
          .pollMessages()
          .then((msgs) => {
            const safe = Array.isArray(msgs) ? msgs : [];
            setPolledMessages(safe);
            setPendingMessageCount(safe.length);
          })
          .catch(() => {
            // Silent - badge stays 0, inbox shows empty state
          })
          .finally(() => {
            setIsPolling(false);
          });
      } catch (err) {
        const key = state.mode === "signup" ? signupErrorKey(err) : loginErrorKey(err);
        setState((current) => ({ ...current, loading: false, error: t(key) }));
      }
    },
    [state.mode, t, onUnauthorized],
  );

  const beginGoogle = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const result = await startGoogle();
      if (result.kind === "redirect") {
        window.location.assign(result.authUrl);
        return;
      }
      setState((current) => ({
        ...current,
        loading: false,
        googleFallback: t("auth.errorGoogleUnavailable"),
      }));
    } catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: t("auth.errorGoogleFailed"),
      }));
    }
  }, [t]);

  const updateUser = useCallback((updated: Partial<User>) => {
    setState((current) => ({
      ...current,
      user: current.user ? { ...current.user, ...updated } : current.user,
    }));
  }, []);

  const signOut = useCallback(async () => {
    await logout();
    setCryptoKeys(null);
    setIsPolling(false);
    setPendingMessageCount(0);
    setPolledMessages([]);
    setState((current) => ({
      ...current,
      user: null,
      error: null,
      googleFallback: null,
    }));
  }, []);

  return useMemo(
    () => ({
      ...state,
      setMode,
      submit,
      beginGoogle,
      signOut,
      updateUser,
      onUnauthorized,
      isAuthenticated: Boolean(state.user),
      cryptoKeys,
      setCryptoKeys,
      isPolling,
      setIsPolling,
      pendingMessageCount,
      setPendingMessageCount,
      polledMessages,
      setPolledMessages,
    }),
    [
      beginGoogle,
      onUnauthorized,
      setMode,
      signOut,
      updateUser,
      state,
      submit,
      cryptoKeys,
      isPolling,
      pendingMessageCount,
      polledMessages,
    ],
  );
}
