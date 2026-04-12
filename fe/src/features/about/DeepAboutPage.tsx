import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowLeft, Brain, Lock, Server, Shield, Sparkles, Layers } from "lucide-react";

/**
 * Deep About page - /about/deep
 * Technical details, privacy model, architecture, innovation.
 * No auth required.
 */
export function DeepAboutPage() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10 space-y-8">
      {/* Back link */}
      <Link
        to="/about"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("aboutDeep.backToAbout")}
      </Link>

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("aboutDeep.pageTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("aboutDeep.pageSubtitle")}</p>
      </div>

      {/* Architecture */}
      <section className="rounded-2xl border border-border bg-card p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">{t("aboutDeep.archTitle")}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{t("aboutDeep.archBody")}</p>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {(
            ["archFrontend", "archBackend", "archDatabase", "archVector", "archVoice"] as const
          ).map((key) => (
            <li key={key} className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
              {t(`aboutDeep.${key}`)}
            </li>
          ))}
        </ul>
      </section>

      {/* AI & Innovation */}
      <section className="rounded-2xl border border-border bg-card p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">{t("aboutDeep.aiTitle")}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{t("aboutDeep.aiBody")}</p>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {(["aiCoaching", "aiIngestion", "aiSafety", "aiTools"] as const).map((key) => (
            <li key={key} className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
              {t(`aboutDeep.${key}`)}
            </li>
          ))}
        </ul>
      </section>

      {/* Privacy & Security */}
      <section className="rounded-2xl border border-border bg-card p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">{t("aboutDeep.privacyTitle")}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{t("aboutDeep.privacyBody")}</p>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {(["privacyE2E", "privacyMnemonic", "privacySealedBox", "privacyArgon2"] as const).map(
            (key) => (
              <li key={key} className="flex items-start gap-2">
                <Lock className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground/60" />
                {t(`aboutDeep.${key}`)}
              </li>
            ),
          )}
        </ul>
      </section>

      {/* Tech Stack */}
      <section className="rounded-2xl border border-border bg-card p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Server className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">{t("aboutDeep.stackTitle")}</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          {(
            [
              ["React 19 + Vite", "Frontend SPA"],
              ["FastAPI", "AI orchestration API"],
              ["PostgreSQL", "Relational data"],
              ["MinIO", "Object storage"],
              ["ElevenLabs", "TTS voice"],
              ["Web Speech API", "STT (browser)"],
              ["Tailwind CSS 4", "Styling"],
              ["NaCl / libsodium", "E2E encryption"],
              ["BIP-39", "Recovery phrase"],
            ] as const
          ).map(([name, desc]) => (
            <div key={name} className="rounded-lg bg-muted/40 px-3 py-2">
              <p className="font-medium text-foreground">{name}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Innovative Approaches */}
      <section className="rounded-2xl border border-border bg-card p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">
            {t("aboutDeep.innovationTitle")}
          </h2>
        </div>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {(["innovVoiceFirst", "innovSealed", "innovRAL", "innovA2UI", "innovBM25"] as const).map(
            (key) => (
              <li key={key} className="flex items-start gap-2">
                <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/60" />
                {t(`aboutDeep.${key}`)}
              </li>
            ),
          )}
        </ul>
      </section>
    </div>
  );
}
