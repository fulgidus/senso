import { useCallback, useEffect, useState } from "react"

import { Link } from "react-router-dom"
import { LogOut, Save, Shield, AtSign, Target } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useAuthContext } from "@/features/auth/AuthContext"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { updateMe } from "@/features/auth/session"
import { readAccessToken } from "@/features/auth/storage"
import { UserAvatar } from "@/components/UserAvatar"
import { getDisplayName } from "@/lib/user-avatar"
import type { VoiceGender } from "@/features/auth/types"
import { readTopbarButtons, writeTopbarButtons } from "@/components/AppShell"
import { getPersonas, type Persona } from "@/features/coaching/coachingApi"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { ConfirmDialog } from "@/components/ConfirmDialog"

type ThemeOption = "light" | "dark" | "system"

const VOICE_GENDER_OPTIONS: { value: VoiceGender; labelKey: string }[] = [
    { value: "indifferent", labelKey: "settings.voiceGenderIndifferent" },
    { value: "masculine", labelKey: "settings.voiceGenderMasculine" },
    { value: "feminine", labelKey: "settings.voiceGenderFeminine" },
    { value: "neutral", labelKey: "settings.voiceGenderNeutral" },
]

function TagInput({ items, onChange, placeholder }: {
    items: string[]; onChange: (v: string[]) => void; placeholder: string
}) {
    const [input, setInput] = useState("")
    return (
        <div>
            <div className="flex flex-wrap gap-1 mb-1">
                {items.map((item) => (
                    <span key={item} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {item}
                        <button type="button" onClick={() => onChange(items.filter(i => i !== item))} className="text-primary/60 hover:text-primary" aria-label="Remove">×</button>
                    </span>
                ))}
            </div>
            <input
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={placeholder}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && input.trim()) {
                        e.preventDefault()
                        if (!items.includes(input.trim())) {
                            onChange([...items, input.trim()])
                        }
                        setInput("")
                    }
                }}
            />
        </div>
    )
}

function PreferencesSection() {
    const { t } = useTranslation()
    const [goals, setGoals] = useState<string[]>([])
    const [dos, setDos] = useState<string[]>([])
    const [donts, setDonts] = useState<string[]>([])
    const [loaded, setLoaded] = useState(false)
    const [saved, setSaved] = useState(false)
    const token = readAccessToken() || ""

    useEffect(() => {
        if (!token) return
        fetch("/api/profile/preferences", { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data) { setGoals(data.goals || []); setDos(data.dos || []); setDonts(data.donts || []) }
                setLoaded(true)
            })
            .catch(() => setLoaded(true))
    }, [token])

    const save = useCallback((g: string[], d: string[], dn: string[]) => {
        if (!token) return
        fetch("/api/profile/preferences", {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ goals: g, dos: d, donts: dn }),
        }).then(() => { setSaved(true); setTimeout(() => setSaved(false), 2000) }).catch(() => {})
    }, [token])

    if (!loaded) return null

    return (
        <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-base font-semibold">{t("preferences.sectionTitle")}</h2>
                {saved && <span className="text-xs text-primary ml-auto">{t("preferences.saved")}</span>}
            </div>
            <div className="space-y-3">
                <div>
                    <label className="text-sm font-medium text-muted-foreground">{t("preferences.goalsLabel")}</label>
                    <TagInput items={goals} onChange={v => { setGoals(v); save(v, dos, donts) }} placeholder={t("preferences.goalsPlaceholder")} />
                </div>
                <div>
                    <label className="text-sm font-medium text-muted-foreground">{t("preferences.dosLabel")}</label>
                    <TagInput items={dos} onChange={v => { setDos(v); save(goals, v, donts) }} placeholder={t("preferences.dosPlaceholder")} />
                </div>
                <div>
                    <label className="text-sm font-medium text-muted-foreground">{t("preferences.dontsLabel")}</label>
                    <TagInput items={donts} onChange={v => { setDonts(v); save(goals, dos, v) }} placeholder={t("preferences.dontsPlaceholder")} />
                </div>
                <p className="text-xs text-muted-foreground">{t("preferences.addHint")}</p>
            </div>
        </section>
    )
}

export function SettingsScreen() {
    const { user, signOut, updateUser } = useAuthContext()
    const { theme, setTheme } = useTheme()
    const { t } = useTranslation()
    const haptic = useHapticFeedback()

    const [firstName, setFirstName] = useState(user.firstName ?? "")
    const [lastName, setLastName] = useState(user.lastName ?? "")
    const [voiceGender, setVoiceGender] = useState<VoiceGender>(user.voiceGender ?? "indifferent")
    const [voiceAutoListen, setVoiceAutoListen] = useState(user.voiceAutoListen ?? false)
    const [defaultPersonaId, setDefaultPersonaId] = useState(user.defaultPersonaId ?? "mentore-saggio")
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [saveSuccess, setSaveSuccess] = useState(false)
    const [topbarButtons, setTopbarButtonsState] = useState(readTopbarButtons)
    const [personas, setPersonas] = useState<Persona[]>([])
    const [strictPrivacyMode, setStrictPrivacyMode] = useState(user.strictPrivacyMode ?? false)
    const [privacySaving, setPrivacySaving] = useState(false)
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
    const [handleInput, setHandleInput] = useState(user.adminHandle?.replace(/^!/, "") ?? "")
    const [handleSaving, setHandleSaving] = useState(false)
    const [handleError, setHandleError] = useState<string | null>(null)
    const [handleSuccess, setHandleSuccess] = useState(false)
    const isAdmin = user.isAdmin || user.role === "admin"

    const handleClaimHandle = useCallback(async () => {
        const raw = handleInput.trim().replace(/^!/, "")
        if (!raw) return
        const token = readAccessToken()
        if (!token) return
        setHandleSaving(true)
        setHandleError(null)
        setHandleSuccess(false)
        try {
            const { apiRequest } = await import("@/lib/api-client")
            const { getBackendBaseUrl } = await import("@/lib/config")
            const res = await apiRequest<{ admin_handle: string }>(getBackendBaseUrl(), "/admin/claim-handle", {
                method: "POST",
                token,
                body: { adminHandle: `!${raw}` },
            })
            updateUser({ adminHandle: res.admin_handle })
            setHandleSuccess(true)
        } catch {
            setHandleError(t("settings.handleError"))
        } finally {
            setHandleSaving(false)
        }
    }, [handleInput, t, updateUser])

    useEffect(() => {
        void getPersonas().then(setPersonas).catch(() => setPersonas([]))
    }, [])

    const isDirty =
        firstName.trim() !== (user.firstName ?? "") ||
        lastName.trim() !== (user.lastName ?? "") ||
        voiceGender !== (user.voiceGender ?? "indifferent") ||
        voiceAutoListen !== (user.voiceAutoListen ?? false) ||
        defaultPersonaId !== (user.defaultPersonaId ?? "mentore-saggio")

    const handleReset = useCallback(() => {
        setFirstName(user.firstName ?? "")
        setLastName(user.lastName ?? "")
        setVoiceGender(user.voiceGender ?? "indifferent")
        setVoiceAutoListen(user.voiceAutoListen ?? false)
        setDefaultPersonaId(user.defaultPersonaId ?? "mentore-saggio")
    }, [user])

    const handleSave = async () => {
        if (!firstName.trim()) return
        setSaving(true)
        setSaveError(null)
        setSaveSuccess(false)
        try {
            const token = readAccessToken()
            if (!token) throw new Error("Not authenticated")
            const updated = await updateMe(token, {
                firstName: firstName.trim(),
                lastName: lastName.trim() || null,
                voiceGender,
                voiceAutoListen,
                defaultPersonaId,
            })
            updateUser(updated)
            setDefaultPersonaId(updated.defaultPersonaId ?? "mentore-saggio")
            setSaveSuccess(true)
            setTimeout(() => setSaveSuccess(false), 3000)
        } catch {
            setSaveError(t("settings.saveError"))
        } finally {
            setSaving(false)
        }
    }

    const THEME_OPTIONS: { value: ThemeOption; label: string }[] = [
        { value: "light", label: t("settings.themeLight") },
        { value: "dark", label: t("settings.themeDark") },
        { value: "system", label: t("settings.themeSystem") },
    ]

    const handleTopbarToggle = (value: boolean) => {
        haptic.tap()
        writeTopbarButtons(value)
        setTopbarButtonsState(value)
        // Live-update the AppShell without reload via the window bridge
        const bridge = (window as unknown as Record<string, unknown>)["__sensoSetTopbarButtons"]
        if (typeof bridge === "function") (bridge as (v: boolean) => void)(value)
    }

    const handlePrivacyToggle = async (value: boolean) => {
        haptic.tap()
        const previous = strictPrivacyMode
        setStrictPrivacyMode(value)       // optimistic update
        setPrivacySaving(true)
        try {
            const token = readAccessToken()
            if (!token) throw new Error("Not authenticated")
            const updated = await updateMe(token, { strictPrivacyMode: value })
            updateUser(updated)
        } catch {
            setStrictPrivacyMode(previous)  // revert on error
            setSaveError(t("settings.saveError"))
        } finally {
            setPrivacySaving(false)
        }
    }

    return (
        <div className="mx-auto w-full max-w-2xl px-6 py-10 space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-foreground">{t("settings.title")}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{t("settings.subtitle")}</p>
            </div>

            {/* Account section */}
            <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
                <h2 className="text-base font-semibold text-foreground">{t("settings.account")}</h2>

                <div className="flex items-center gap-4">
                    <UserAvatar user={user} size="lg" />
                    <div>
                        <p className="text-sm font-medium text-foreground">{getDisplayName(user)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>
                    </div>
                </div>

                {/* Name fields */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                        <label className="block text-sm text-muted-foreground">
                            {t("settings.firstName")} <span className="text-destructive">{t("settings.required")}</span>
                        </label>
                        <input
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            placeholder={t("settings.firstName")}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="block text-sm text-muted-foreground">{t("settings.lastName")}</label>
                        <input
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            placeholder={t("settings.lastName")}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                </div>

                {saveError && <p className="text-sm text-destructive">{saveError}</p>}
                {saveSuccess && (
                    <p className="text-sm text-green-600 dark:text-green-400">{t("settings.saveSuccess")}</p>
                )}

                <div className="flex items-center gap-3 flex-wrap">
                    {isDirty && (
                        <span className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                            {t("settings.unsavedChanges")}
                        </span>
                    )}
                    {isDirty && (
                        <Button
                            variant="outline"
                            onClick={handleReset}
                            className="w-full sm:w-auto"
                        >
                            {t("settings.reset")}
                        </Button>
                    )}
                    <Button
                        variant="default"
                        disabled={!firstName.trim() || !isDirty || saving}
                        onClick={() => void handleSave()}
                        className="w-full sm:w-auto"
                    >
                        <Save className="h-4 w-4 mr-2" />
                        {saving ? t("settings.saving") : t("settings.save")}
                    </Button>
                </div>

                {/* Read-only email */}
                <div className="space-y-1 pt-2 border-t border-border">
                    <label className="block text-sm text-muted-foreground">{t("settings.email")}</label>
                    <input
                        type="text"
                        readOnly
                        value={user.email}
                        className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
                    />
                </div>
            </section>

            {/* Voice section */}
            <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
                <div className="pb-4 border-b border-border space-y-3">
                    <div>
                        <h2 className="text-base font-semibold text-foreground">{t("settings.defaultCoach")}</h2>
                        <p className="text-sm text-muted-foreground">{t("settings.defaultCoachHint")}</p>
                    </div>
                    <div className="space-y-2">
                        {personas.filter((persona) => persona.available).map((persona) => {
                            const selected = persona.id === defaultPersonaId
                            const theme = persona.theme?.light
                            return (
                                <button
                                    key={persona.id}
                                    type="button"
                                    onClick={() => setDefaultPersonaId(persona.id)}
                                    className="w-full rounded-xl border px-4 py-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                                    style={{
                                        borderColor: selected ? theme?.bubble_border ?? "var(--primary)" : undefined,
                                        backgroundColor: selected ? theme?.bubble_bg ?? undefined : undefined,
                                    }}
                                >
                                    <div className="flex items-start gap-3">
                                        <div
                                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base"
                                            style={{ backgroundColor: theme?.avatar_bg }}
                                        >
                                            {persona.icon}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-sm font-medium text-foreground">{persona.name}</span>
                                                {selected && <span className="text-primary">✓</span>}
                                            </div>
                                            <p className="mt-0.5 text-xs text-muted-foreground">{persona.description}</p>
                                        </div>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>

                <h2 className="text-base font-semibold text-foreground">{t("settings.voiceGender")}</h2>
                <p className="text-sm text-muted-foreground">{t("settings.voiceGenderHint")}</p>
                <div className="flex gap-2 flex-wrap">
                    {VOICE_GENDER_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => { haptic.tap(); setVoiceGender(opt.value) }}
                            className={[
                                "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                                voiceGender === opt.value
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                            ].join(" ")}
                        >
                            {t(opt.labelKey)}
                        </button>
                    ))}
                </div>

                {/* Auto-listen toggle */}
                <div className="pt-4 border-t border-border">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-foreground">{t("settings.voiceAutoListen")}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{t("settings.voiceAutoListenHint")}</p>
                        </div>
                        <button
                            role="switch"
                            aria-checked={voiceAutoListen}
                            onClick={() => { haptic.tap(); setVoiceAutoListen((v) => !v) }}
                            className={[
                                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                                voiceAutoListen ? "bg-primary" : "bg-muted",
                            ].join(" ")}
                        >
                            <span
                                className={[
                                    "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
                                    voiceAutoListen ? "translate-x-6" : "translate-x-1",
                                ].join(" ")}
                            />
                        </button>
                    </div>
                </div>
            </section>

            {/* Appearance section */}
            <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
                <h2 className="text-base font-semibold text-foreground">{t("settings.theme")}</h2>
                <div>
                    <div className="flex gap-2 flex-wrap">
                        {THEME_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => setTheme(opt.value)}
                                className={[
                                    "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                                    theme === opt.value
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                                ].join(" ")}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                        {t("settings.themeShortcutHint")} <kbd className="rounded border border-border px-1 py-0.5 font-mono text-xs">{t("settings.themeShortcutKey")}</kbd> {t("settings.themeShortcutSuffix")}
                    </p>
                </div>

                {/* Top bar navigation toggle */}
                <div className="pt-4 border-t border-border space-y-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-foreground">{t("settings.topbarButtons")}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{t("settings.topbarButtonsHint")}</p>
                        </div>
                        <button
                            role="switch"
                            aria-checked={topbarButtons}
                            onClick={() => handleTopbarToggle(!topbarButtons)}
                            className={[
                                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                                topbarButtons ? "bg-primary" : "bg-muted",
                            ].join(" ")}
                        >
                            <span
                                className={[
                                    "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
                                    topbarButtons ? "translate-x-6" : "translate-x-1",
                                ].join(" ")}
                            />
                        </button>
                    </div>
                </div>
            </section>

            {/* Financial Preferences section - Phase 20 */}
            <PreferencesSection />

            {/* Privacy section */}
            <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
                <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <h2 className="text-base font-semibold text-foreground">{t("settings.privacyTitle")}</h2>
                </div>
                <p className="text-sm text-muted-foreground">{t("settings.privacyDescription")}</p>

                <div className={["pt-4 border-t border-border", privacySaving ? "opacity-50 pointer-events-none" : ""].join(" ")}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-foreground">{t("settings.strictPrivacyMode")}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{t("settings.strictPrivacyModeHint")}</p>
                        </div>
                        <button
                            role="switch"
                            aria-checked={strictPrivacyMode}
                            onClick={() => void handlePrivacyToggle(!strictPrivacyMode)}
                            className={[
                                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                                strictPrivacyMode ? "bg-primary" : "bg-muted",
                            ].join(" ")}
                        >
                            <span
                                className={[
                                    "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
                                    strictPrivacyMode ? "translate-x-6" : "translate-x-1",
                                ].join(" ")}
                            />
                        </button>
                    </div>
                    {strictPrivacyMode && (
                        <p className="mt-2 text-xs text-primary">{t("settings.strictPrivacyModeActive")}</p>
                    )}
                </div>

                {/* About link */}
                <div className="pt-4 border-t border-border">
                    <p className="text-sm font-medium text-foreground">{t("settings.aboutTitle")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("settings.aboutHint")}</p>
                    <Link
                        to="/about"
                        className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
                    >
                        {t("settings.aboutCta")} →
                    </Link>
                </div>

                {/* Developer tools link - visible only for testers and admins */}
                {(user.role === "tester" || user.role === "admin" || user.isAdmin) && (
                    <div className="pt-4 border-t border-border">
                        <p className="text-sm font-medium text-foreground">{t("settings.devToolsTitle")}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{t("settings.devToolsHint")}</p>
                        <Link
                            to="/debug"
                            className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
                        >
                            {t("settings.devToolsCta")} →
                        </Link>
                    </div>
                )}

                {/* Admin handle claim - admin only */}
                {isAdmin && (
                    <div className="pt-4 border-t border-border">
                        <div className="flex items-center gap-2 mb-1">
                            <AtSign className="h-4 w-4 text-muted-foreground" />
                            <p className="text-sm font-medium text-foreground">{t("settings.adminHandleTitle")}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">{t("settings.adminHandleHint")}</p>
                        {user.adminHandle ? (
                            <p className="text-sm font-mono text-primary">
                                {user.adminHandle} &mdash; {t("settings.adminHandleClaimed")}
                            </p>
                        ) : (
                            <div className="flex gap-2 items-center">
                                <span className="text-sm font-mono text-muted-foreground select-none">!</span>
                                <input
                                    type="text"
                                    value={handleInput}
                                    onChange={(e) => { setHandleInput(e.target.value.replace(/[^a-z0-9-]/g, "")); setHandleSuccess(false); setHandleError(null) }}
                                    placeholder="admin"
                                    className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                                    maxLength={32}
                                />
                                <button
                                    onClick={() => void handleClaimHandle()}
                                    disabled={handleSaving || !handleInput.trim()}
                                    className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                                >
                                    {handleSaving ? "…" : t("settings.adminHandleClaim")}
                                </button>
                            </div>
                        )}
                        {handleError && <p className="mt-1 text-xs text-destructive">{handleError}</p>}
                        {handleSuccess && <p className="mt-1 text-xs text-primary">{t("settings.adminHandleSuccess")}</p>}
                    </div>
                )}
            </section>

            {/* App info */}
            <section className="rounded-2xl border border-border bg-card p-6 space-y-2">
                <h2 className="text-base font-semibold text-foreground">{t("settings.infoTitle")}</h2>
                <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">S.E.N.S.O.</strong> - Sistema Educativo per Numeri, Spese e Obiettivi
                </p>
                <p className="text-xs text-muted-foreground">
                    {t("settings.infoDescription")}
                </p>
            </section>

            {/* Sign out */}
            <section className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6">
                <h2 className="text-base font-semibold text-foreground mb-2">{t("settings.sessionTitle")}</h2>
                <p className="text-sm text-muted-foreground mb-4">
                    {t("settings.sessionDescription")}
                </p>
                <Button
                    variant="destructive"
                    onClick={() => {
                        setShowLogoutConfirm(true)
                    }}
                    className="w-full sm:w-auto"
                >
                    <LogOut className="h-4 w-4 mr-2" />
                    {t("settings.logout")}
                </Button>
            </section>

            <ConfirmDialog
                open={showLogoutConfirm}
                title={t("auth.signOutTitle")}
                description={t(`settings.logoutConfirm.${voiceGender !== "indifferent" ? (voiceGender as "masculine" | "feminine" | "neutral") : "neutral"
                    }`)}
                confirmVariant="destructive"
                onConfirm={() => { setShowLogoutConfirm(false); void signOut() }}
                onCancel={() => setShowLogoutConfirm(false)}
            />
        </div>
    )
}
