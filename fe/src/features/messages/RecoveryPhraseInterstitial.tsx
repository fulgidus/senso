/**
 * RecoveryPhraseInterstitial - one-time full-screen blocker after signup.
 *
 * Displayed when user.recoveryPhrase is set (only immediately after signup).
 * Blocks all navigation until the user confirms they have saved their phrase.
 * After confirmation: calls onConfirm() which clears recoveryPhrase from state.
 *
 * Per Phase 15 decisions D-20, D-21, D-22:
 * - Full-screen overlay blocking all other UI
 * - 24 words in a 4×6 numbered grid
 * - "Copy all" button
 * - "Download as .txt" button (Review amendment #4)
 * - "I have saved my recovery phrase" checkbox gates Continue button
 * - After confirm: phrase cleared from state; no re-view path in Phase 15
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Check, ShieldCheck, Download } from "lucide-react";

interface RecoveryPhraseInterstitialProps {
  phrase: string; // Space-separated 24-word BIP-39 mnemonic
  onConfirm: () => void;
}

export function RecoveryPhraseInterstitial({ phrase, onConfirm }: RecoveryPhraseInterstitialProps) {
  const { t } = useTranslation();
  const words = phrase.trim().split(/\s+/);
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  if (words.length !== 24) {
    console.error(`RecoveryPhraseInterstitial: expected 24 words, got ${words.length}`);
  }

  const handleCopy = () => {
    void navigator.clipboard.writeText(phrase).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Review amendment #4: add download-as-text to encourage durable offline backup.
  // Creates a .txt blob and triggers browser download via a temporary anchor.
  const handleDownload = () => {
    const content = [
      "SENSO Recovery Phrase",
      "======================",
      "",
      ...words.map((w, i) => `${i + 1}. ${w}`),
      "",
      `Generated: ${new Date().toISOString()}`,
      "Store this file offline in a safe place. Never share it.",
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "senso-recovery-phrase.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("messages.recoveryPhrase.dialogLabel")}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-sm overflow-y-auto p-4"
    >
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="border-b border-border px-6 py-5">
          <div className="flex items-center gap-3 mb-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <h1 className="text-lg font-semibold">{t("messages.recoveryPhrase.title")}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("messages.recoveryPhrase.description")}
          </p>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* 24-word 4×6 grid */}
          <div
            role="list"
            aria-label={t("messages.recoveryPhrase.wordGridLabel")}
            className="grid grid-cols-3 sm:grid-cols-4 gap-2"
          >
            {words.map((word, idx) => (
              <div
                key={idx}
                role="listitem"
                className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2 py-1.5 text-xs"
              >
                <span className="text-muted-foreground w-5 text-right shrink-0 font-mono">
                  {idx + 1}.
                </span>
                <span className="font-mono font-medium text-foreground select-all">{word}</span>
              </div>
            ))}
          </div>

          {/* Copy all + Download buttons (Review amendment #4) */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors flex-1 justify-center"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-primary" />
                  {t("messages.recoveryPhrase.copied")}
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  {t("messages.recoveryPhrase.copyAll")}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors flex-1 justify-center"
            >
              <Download className="h-4 w-4" />
              {t("messages.recoveryPhrase.downloadTxt")}
            </button>
          </div>

          {/* Warning */}
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
            {t("messages.recoveryPhrase.warning")}
          </p>

          {/* Checkbox gate */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/50"
            />
            <span className="text-sm text-foreground">
              {t("messages.recoveryPhrase.savedCheckbox")}
            </span>
          </label>

          {/* Continue button */}
          <button
            type="button"
            disabled={!confirmed}
            onClick={onConfirm}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50 transition-colors"
          >
            {t("messages.recoveryPhrase.continueButton")}
          </button>
        </div>
      </div>
    </div>
  );
}
