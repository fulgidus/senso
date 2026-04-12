import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookOpen, Info } from "lucide-react";

import { Button } from "@/components/ui/button";

type AuthScreenProps = {
  mode: "signup" | "login";
  loading: boolean;
  error: string | null;
  googleFallback: string | null;
  onModeChange: (mode: "signup" | "login") => void;
  onSubmit: (email: string, password: string) => Promise<void>;
  onGoogle: () => Promise<void>;
};

export function AuthScreen({
  mode,
  loading,
  error,
  googleFallback,
  onModeChange,
  onSubmit,
}: AuthScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { t } = useTranslation();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit(email, password);
  };

  const isLogin = mode === "login";
  const heading = isLogin ? t("auth.loginHeading") : t("auth.signupHeading");
  const body = isLogin ? t("auth.loginBody") : t("auth.signupBody");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-6 py-12">
      <section className="w-full card-glow-strong p-6 md:p-8 relative overflow-hidden">
        {/* Subtle gradient accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-primary" />
        <header className="space-y-2">
          <h1 className="text-[28px] leading-[1.2] font-semibold">{heading}</h1>
          <p className="text-base leading-[1.5] text-muted-foreground">{body}</p>
        </header>

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-full bg-secondary p-1.5">
          <button
            type="button"
            className={`h-11 rounded-full text-sm font-semibold transition-all ${
              mode === "login"
                ? "bg-gradient-primary text-primary-foreground shadow-md shadow-primary/25"
                : "text-foreground hover:text-accent-foreground"
            }`}
            onClick={() => onModeChange("login")}
          >
            {t("auth.tabLogin")}
          </button>
          <button
            type="button"
            className={`h-11 rounded-full text-sm font-semibold transition-all ${
              mode === "signup"
                ? "bg-gradient-primary text-primary-foreground shadow-md shadow-primary/25"
                : "text-foreground hover:text-accent-foreground"
            }`}
            onClick={() => onModeChange("signup")}
          >
            {t("auth.tabSignup")}
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm leading-[1.5] font-semibold">{t("auth.email")}</span>
            <input
              className="h-12 w-full rounded-xl border border-input bg-background px-4 text-base transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm leading-[1.5] font-semibold">{t("auth.password")}</span>
            <input
              className="h-12 w-full rounded-xl border border-input bg-background px-4 text-base transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </label>

          <Button
            variant="gradient"
            size="lg"
            className="w-full text-base font-semibold"
            disabled={loading}
          >
            {loading
              ? isLogin
                ? t("auth.loggingIn")
                : t("auth.signingUp")
              : isLogin
                ? t("auth.loginCta")
                : t("auth.signupCta")}
          </Button>
        </form>

        <Button
          variant="outline"
          size="lg"
          className="mt-4 w-full text-base font-semibold opacity-50 cursor-not-allowed rounded-full"
          disabled
          title={t("auth.googleTitle")}
        >
          {t("auth.googleCta")}
        </Button>

        {googleFallback && (
          <p className="mt-4 rounded-md border border-amber-300/50 bg-amber-50/50 px-3 py-2 text-sm leading-[1.5] text-amber-700 dark:border-amber-700/30 dark:bg-amber-900/20 dark:text-amber-400">
            {googleFallback}
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm leading-[1.5] text-destructive">
            {error}
          </p>
        )}

        {/* Guest access links */}
        <div className="mt-6 border-t border-border pt-5">
          <p className="mb-3 text-center text-xs text-muted-foreground">{t("auth.guestPrompt")}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              to="/learn"
              className="flex flex-1 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition-all hover:bg-accent hover:text-accent-foreground hover:border-primary/30"
            >
              <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
              {t("auth.guestLearn")}
            </Link>
            <Link
              to="/about"
              className="flex flex-1 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition-all hover:bg-accent hover:text-accent-foreground hover:border-primary/30"
            >
              <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
              {t("auth.guestAbout")}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
