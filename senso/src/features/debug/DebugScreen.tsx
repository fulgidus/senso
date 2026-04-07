import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { apiRequest } from "@/lib/api-client"
import { getBackendBaseUrl } from "@/lib/config"
import { readAccessToken } from "@/features/auth/storage"
import { useAuth } from "@/features/auth/useAuth"
import { ConfirmDialog } from "@/components/ConfirmDialog"

export function DebugScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { onUnauthorized, user } = useAuth()
  const [results, setResults] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [showNukeConfirm, setShowNukeConfirm] = useState(false)
  const [showNukeAllConfirm, setShowNukeAllConfirm] = useState(false)
  const isAdmin = user?.isAdmin || user?.role === "admin"

  const callDebug = async (
    action: string,
    method: "POST" | "DELETE",
    path: string,
  ) => {
    setLoading((prev) => ({ ...prev, [action]: true }))
    try {
      const data = await apiRequest<Record<string, unknown>>(
        getBackendBaseUrl(),
        path,
        { method, token: readAccessToken() ?? "", onUnauthorized },
      )
      setResults((prev) => ({ ...prev, [action]: JSON.stringify(data) }))
      // After restart-ingestion succeeds, navigate to /profile after 1s so user
      // can see ingestion progress in the profile monitoring section.
      if (action === "restart") {
        setTimeout(() => void navigate("/profile"), 1000)
      }
    } catch {
      setResults((prev) => ({ ...prev, [action]: t("debug.error") }))
    } finally {
      setLoading((prev) => ({ ...prev, [action]: false }))
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10 space-y-8">
      <h1 className="text-2xl font-bold text-foreground">{t("debug.title")}</h1>

      {/* Warning banner */}
      <div className="rounded-xl border border-amber-400/40 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
        {t("debug.warning")}
      </div>

      {/* Section 1 — Restart ingestion */}
      <section className="rounded-2xl border border-border bg-card p-6 space-y-3">
        <h2 className="text-base font-semibold text-foreground">
          {t("debug.restartTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("debug.restartDesc")}</p>
        <button
          disabled={loading["restart"]}
          onClick={() => void callDebug("restart", "POST", "/debug/restart-ingestion")}
          className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading["restart"] ? t("debug.loading") : t("debug.restartCta")}
        </button>
        {results["restart"] && (
          <p className="text-xs font-mono text-muted-foreground break-all">
            {results["restart"]}
          </p>
        )}
      </section>

      {/* Section 2 — Purge coaching history */}
      <section className="rounded-2xl border border-border bg-card p-6 space-y-3">
        <h2 className="text-base font-semibold text-foreground">
          {t("debug.purgeTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("debug.purgeDesc")}</p>
        <button
          disabled={loading["purge"]}
          onClick={() => void callDebug("purge", "POST", "/debug/purge-coaching")}
          className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading["purge"] ? t("debug.loading") : t("debug.purgeCta")}
        </button>
        {results["purge"] && (
          <p className="text-xs font-mono text-muted-foreground break-all">
            {results["purge"]}
          </p>
        )}
      </section>

      {/* Section 3 — Nuclear option */}
      <section className="rounded-2xl border border-destructive/30 bg-card p-6 space-y-3">
        <h2 className="text-base font-semibold text-foreground">
          {t("debug.nukeTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("debug.nukeDesc")}</p>
        <button
          disabled={loading["nuke"]}
          onClick={() => {
            setShowNukeConfirm(true)
          }}
          className="rounded-lg border border-destructive bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading["nuke"] ? t("debug.loading") : t("debug.nukeCta")}
        </button>
        {results["nuke"] && (
          <p className="text-xs font-mono text-muted-foreground break-all">
            {results["nuke"]}
          </p>
        )}
      </section>

      <ConfirmDialog
        open={showNukeConfirm}
        title={t("debug.nukeTitle")}
        description={t("debug.nukeConfirm")}
        confirmVariant="destructive"
        confirmLabel={t("debug.nukeCta")}
        onConfirm={() => { setShowNukeConfirm(false); void callDebug("nuke", "DELETE", "/debug/nuke") }}
        onCancel={() => setShowNukeConfirm(false)}
      />

      {/* Section 4 — Nuke ALL users (admin only) */}
      {isAdmin && (
        <section className="rounded-2xl border-2 border-destructive bg-card p-6 space-y-3">
          <h2 className="text-base font-semibold text-destructive">
            {t("debug.nukeAllTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("debug.nukeAllDesc")}</p>
          <button
            disabled={loading["nukeAll"]}
            onClick={() => setShowNukeAllConfirm(true)}
            className="rounded-lg border-2 border-destructive bg-destructive px-4 py-2 text-sm font-bold text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading["nukeAll"] ? t("debug.loading") : t("debug.nukeAllCta")}
          </button>
          {results["nukeAll"] && (
            <p className="text-xs font-mono text-muted-foreground break-all">
              {results["nukeAll"]}
            </p>
          )}
        </section>
      )}

      <ConfirmDialog
        open={showNukeAllConfirm}
        title={t("debug.nukeAllTitle")}
        description={t("debug.nukeAllConfirm")}
        confirmVariant="destructive"
        confirmLabel={t("debug.nukeAllCta")}
        onConfirm={() => { setShowNukeAllConfirm(false); void callDebug("nukeAll", "DELETE", "/debug/nuke-all") }}
        onCancel={() => setShowNukeAllConfirm(false)}
      />
    </div>
  )
}
