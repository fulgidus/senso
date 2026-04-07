import { useTranslation } from "react-i18next"

/**
 * Public About page - accessible at /about without authentication.
 * Wrapped in PublicShell by App.tsx (or AppShell when authenticated).
 * All strings come from i18n locales under the "about.*" namespace.
 * No API calls - purely static/informational content.
 */
export function AboutPage() {
    const { t } = useTranslation()

    return (
        <div className="mx-auto w-full max-w-2xl px-6 py-10 space-y-8">
            {/* Page header */}
            <div>
                <h1 className="text-2xl font-bold text-foreground">{t("about.pageTitle")}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{t("about.pageSubtitle")}</p>
            </div>

            {/* Section 1: What is S.E.N.S.O. */}
            <section className="rounded-2xl border border-border bg-card p-6 space-y-3">
                <h2 className="text-base font-semibold text-foreground">{t("about.whatTitle")}</h2>
                <p className="text-sm text-muted-foreground">{t("about.whatBody")}</p>
            </section>

            {/* Section 2: How it works */}
            <section className="rounded-2xl border border-border bg-card p-6 space-y-3">
                <h2 className="text-base font-semibold text-foreground">{t("about.howTitle")}</h2>
                <ol className="space-y-2 list-decimal list-inside">
                    {(["howStep1", "howStep2", "howStep3", "howStep4", "howStep5"] as const).map((key, i) => (
                        <li key={i} className="text-sm text-muted-foreground">
                            {t(`about.${key}`)}
                        </li>
                    ))}
                </ol>
            </section>

            {/* Section 3: What we store */}
            <section className="rounded-2xl border border-border bg-card p-6 space-y-3">
                <h2 className="text-base font-semibold text-foreground">{t("about.dataTitle")}</h2>
                <ul className="space-y-2">
                    {(["dataTier1", "dataTier2", "dataTier3"] as const).map((key, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary/60" aria-hidden="true" />
                            {t(`about.${key}`)}
                        </li>
                    ))}
                </ul>
            </section>

            {/* Section 4: How we use AI */}
            <section className="rounded-2xl border border-border bg-card p-6 space-y-3">
                <h2 className="text-base font-semibold text-foreground">{t("about.aiTitle")}</h2>
                <p className="text-sm text-muted-foreground">{t("about.aiBody")}</p>
                <p className="text-xs text-muted-foreground italic">{t("about.aiFootnote")}</p>
            </section>

            {/* Section 5: Safety & limits */}
            <section className="rounded-2xl border border-border bg-card p-6 space-y-3">
                <h2 className="text-base font-semibold text-foreground">{t("about.safetyTitle")}</h2>
                <p className="text-sm text-muted-foreground">{t("about.safetyBody")}</p>
                <p className="text-sm text-muted-foreground">{t("about.safetyRetention")}</p>
            </section>

            {/* Section 6: Legal notice */}
            <section className="rounded-2xl border border-border bg-card p-6 space-y-3">
                <h2 className="text-base font-semibold text-foreground">{t("about.legalTitle")}</h2>
                <p className="text-xs text-muted-foreground">{t("about.legalBody")}</p>
            </section>
        </div>
    )
}
