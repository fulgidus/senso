import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { DecryptedMessage } from "./messagesApi";

interface InboxTabProps {
  messages: DecryptedMessage[];
  loading: boolean;
  error: string | null;
}

export function InboxTab({ messages, loading, error }: InboxTabProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">{t("messages.decrypting")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">{t("messages.noMessages")}</p>
    );
  }

  return (
    <ul className="space-y-3">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
    </ul>
  );
}

function MessageBubble({ message }: { message: DecryptedMessage }) {
  const { t } = useTranslation();
  const [showSigPanel, setShowSigPanel] = useState(false);

  return (
    <li className="rounded-xl border border-border bg-card p-4 shadow-sm">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {t("messages.fromLabel")}: {message.from}
        </span>
        <div className="flex items-center gap-1">
          {message.isAdmin && message.signatureValid && (
            <button
              onClick={() => setShowSigPanel(!showSigPanel)}
              className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
              aria-label={t("messages.verifiedBadge")}
            >
              <ShieldCheck className="h-3 w-3" />
              {t("messages.verifiedBadge")}
            </button>
          )}
          {!message.signatureValid && (
            <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
              <AlertTriangle className="h-3 w-3" />
              {t("messages.signatureInvalid")}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      {message.body ? (
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown>{message.body}</ReactMarkdown>
        </div>
      ) : (
        <p className="italic text-sm text-muted-foreground">{t("messages.decryptFailed")}</p>
      )}

      {/* Signature detail panel (expandable) */}
      {showSigPanel && (
        <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          <p className="mb-1 font-medium text-foreground">{t("messages.signaturePanel.title")}</p>
          <p>
            {t("messages.signaturePanel.senderLabel")}: {message.from}
          </p>
          {message.signerPublicKey && (
            <p>
              {t("messages.signaturePanel.keyFingerprint")}: {message.signerPublicKey.slice(0, 16)}…
            </p>
          )}
          <p>{t("messages.signaturePanel.algorithm")}: Ed25519 (libsodium)</p>
        </div>
      )}
    </li>
  );
}
