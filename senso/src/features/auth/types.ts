export type VoiceGender = "masculine" | "feminine" | "neutral" | "indifferent"

export type User = {
    id: string
    email: string
    firstName: string | null
    lastName?: string | null
    isAdmin?: boolean
    role?: string
    voiceGender?: VoiceGender
    voiceAutoListen?: boolean
    defaultPersonaId?: string
    strictPrivacyMode?: boolean
}

export type AuthPayload = {
    user: User
    accessToken: string
    refreshToken: string
    expiresIn: number
}

export type RefreshPayload = {
    accessToken: string
    refreshToken: string
    expiresIn: number
}

export type MePayload = {
    user: User
}

export type FallbackPayload = {
    fallback: "email_password"
    reason?: string
}

export type BootstrapResult =
    | { status: "authenticated"; user: User }
    | { status: "unauthenticated" }

export type GoogleStartResult =
    | { kind: "redirect"; authUrl: string }
    | { kind: "fallback"; fallback: "email_password"; reason?: string }
