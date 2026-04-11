import { ApiClientError, apiRequest } from "@/lib/api-client";
import { getBackendBaseUrl } from "@/lib/config";

import { clearTokens, readAccessToken, readRefreshToken, writeTokens } from "./storage";
import type {
    AuthPayload,
    BootstrapResult,
    FallbackPayload,
    GoogleStartResult,
    MePayload,
    RefreshPayload,
    User,
    VoiceGender,
} from "./types";

const backendBaseUrl = getBackendBaseUrl();

type RawUser = {
    id: string;
    email: string;
    first_name?: string | null;
    last_name?: string | null;
    is_admin?: boolean | null;
    role?: string | null;
    voice_gender?: string | null;
    voice_auto_listen?: boolean | null;
    default_persona_id?: string | null;
    strict_privacy_mode?: boolean | null;
    username?: string | null;
    public_key_b64?: string | null;
    signing_key_b64?: string | null;
    admin_handle?: string | null;
    nacl_pbkdf2_salt?: string | null;
    nacl_key_login_envelope_b64?: string | null;
    encrypted_x25519_private_b64?: string | null;
    encrypted_ed25519_signing_b64?: string | null;
    nationalities?: string[] | null;
};

function parseUser(raw: RawUser): User {
    return {
        id: raw.id,
        email: raw.email,
        firstName: raw.first_name ?? null,
        lastName: raw.last_name ?? null,
        isAdmin: raw.is_admin ?? false,
        role: raw.role ?? "user",
        voiceGender: (raw.voice_gender as VoiceGender | null) ?? "indifferent",
        voiceAutoListen: raw.voice_auto_listen ?? false,
        defaultPersonaId: raw.default_persona_id ?? "mentore-saggio",
        strictPrivacyMode: raw.strict_privacy_mode ?? false,
        username: raw.username ?? null,
        publicKeyB64: raw.public_key_b64 ?? null,
        signingKeyB64: raw.signing_key_b64 ?? null,
        adminHandle: raw.admin_handle ?? null,
        naclPbkdf2Salt: raw.nacl_pbkdf2_salt ?? null,
        naclKeyLoginEnvelopeB64: raw.nacl_key_login_envelope_b64 ?? null,
        encryptedX25519PrivateB64: raw.encrypted_x25519_private_b64 ?? null,
        encryptedEd25519SigningB64: raw.encrypted_ed25519_signing_b64 ?? null,
        nationalities: raw.nationalities ?? ["IT"],
    };
}

export async function signup(email: string, password: string): Promise<AuthPayload> {
    const raw = await apiRequest<{
        user: RawUser;
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
        recoveryPhrase?: string | null;
    }>(backendBaseUrl, "/auth/signup", {
        method: "POST",
        body: { email, password },
    });
    const user = parseUser(raw.user);
    // recoveryPhrase is transient - only set at signup, cleared after interstitial
    if (raw.recoveryPhrase) {
        user.recoveryPhrase = raw.recoveryPhrase;
    }
    const payload: AuthPayload = {
        user,
        accessToken: raw.accessToken,
        refreshToken: raw.refreshToken,
        expiresIn: raw.expiresIn,
    };
    writeTokens(payload);
    return payload;
}

export async function login(email: string, password: string): Promise<AuthPayload> {
    const raw = await apiRequest<{
        user: RawUser;
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
    }>(backendBaseUrl, "/auth/login", {
        method: "POST",
        body: { email, password },
    });
    const payload: AuthPayload = {
        user: parseUser(raw.user),
        accessToken: raw.accessToken,
        refreshToken: raw.refreshToken,
        expiresIn: raw.expiresIn,
    };
    writeTokens(payload);
    return payload;
}

export async function signout(): Promise<void> {
    const refreshToken = readRefreshToken();
    if (refreshToken) {
        try {
            await apiRequest<undefined>(backendBaseUrl, "/auth/logout", {
                method: "POST",
                body: { refreshToken },
            });
        } catch {
            // Always clear local session even if backend logout fails.
        }
    }
    clearTokens();
}

export const logout = signout;

export async function bootstrapSession(): Promise<BootstrapResult> {
    const accessToken = readAccessToken();
    const refreshToken = readRefreshToken();

    if (!accessToken || !refreshToken) {
        return { status: "unauthenticated" };
    }

    try {
        const me = await getMe(accessToken);
        return { status: "authenticated", user: me.user };
    } catch (error: unknown) {
        const authError =
            error instanceof ApiClientError ? error : new ApiClientError("Unknown", 500, null);
        if (authError.status !== 401) {
            clearTokens();
            return { status: "unauthenticated" };
        }

        try {
            const refreshed = await refresh(refreshToken);
            const me = await getMe(refreshed.accessToken);
            return { status: "authenticated", user: me.user };
        } catch {
            clearTokens();
            return { status: "unauthenticated" };
        }
    }
}

export async function startGoogle(): Promise<GoogleStartResult> {
    try {
        const payload = await apiRequest<{ authUrl: string }>(backendBaseUrl, "/auth/google/start");
        return { kind: "redirect", authUrl: payload.authUrl };
    } catch (error: unknown) {
        const authError =
            error instanceof ApiClientError ? error : new ApiClientError("Unknown", 500, null);
        if (authError.status === 503) {
            const fallback = authError.data as FallbackPayload;
            if (fallback?.fallback === "email_password") {
                return {
                    kind: "fallback",
                    fallback: "email_password",
                    reason: fallback.reason,
                };
            }
        }
        throw error;
    }
}

export async function updateMe(
    accessToken: string,
    data: {
        firstName?: string | null;
        lastName?: string | null;
        voiceGender?: VoiceGender | null;
        voiceAutoListen?: boolean | null;
        defaultPersonaId?: string | null;
        strictPrivacyMode?: boolean | null;
    },
): Promise<User> {
    /* no onUnauthorized — auth primitive */
    const raw = await apiRequest<RawUser>(backendBaseUrl, "/auth/me", {
        method: "PATCH",
        token: accessToken,
        body: {
            first_name: data.firstName,
            last_name: data.lastName,
            voice_gender: data.voiceGender,
            voice_auto_listen: data.voiceAutoListen,
            default_persona_id: data.defaultPersonaId,
            strict_privacy_mode: data.strictPrivacyMode,
        },
    });
    return parseUser(raw);
}

async function refresh(refreshToken: string): Promise<RefreshPayload> {
    const payload = await apiRequest<RefreshPayload>(backendBaseUrl, "/auth/refresh", {
        method: "POST",
        body: { refreshToken },
    /* no onUnauthorized — auth primitive, 401 here means refresh loop; see makeOnUnauthorized */
    });
    writeTokens(payload);
    return payload;
}

/**
 * Factory that returns an `onUnauthorized` callback suitable for passing to
 * `apiRequest`. On a 401 the callback will:
 *  1. Read the stored refresh token.
 *  2. Call `refresh()` to obtain a new access token.
 *  3. Return the new token string so `apiRequest` can retry.
 *  4. On any failure (no refresh token, or refresh 401): clear local tokens,
 *     navigate to `/auth`, and return `null`.
 */
export function makeOnUnauthorized(navigate?: (to: string) => void): () => Promise<string | null> {
    return async () => {
        const storedRefreshToken = readRefreshToken();
        if (!storedRefreshToken) {
            clearTokens();
            navigate?.("/auth");
            return null;
        }
        try {
            const payload = await refresh(storedRefreshToken);
            return payload.accessToken;
        } catch {
            clearTokens();
            navigate?.("/auth");
            return null;
        }
    };
}

async function getMe(accessToken: string): Promise<MePayload> {
    /* no onUnauthorized — auth primitive */
    const raw = await apiRequest<{ user: RawUser }>(backendBaseUrl, "/auth/me", {
        token: accessToken,
    });
    return {
        user: parseUser(raw.user),
    };
}
