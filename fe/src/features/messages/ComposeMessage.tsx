/**
 * ComposeMessage - compose form for E2E encrypted messages.
 *
 * Recipient input: type a $username or !handle.
 * Auto-suggest from localStorage contacts (senso:contacts).
 * Attachment: optional file picker (encrypt + upload in useEncryptAndSend).
 *
 * On submit, calls onEncryptAndSend() which:
 *   1. Fetches recipient public keys (GET /messages/users/{username}/public-keys)
 *   2. Builds YAML frontmatter + signs with user's Ed25519 key
 *   3. Encrypts with recipient's X25519 public key
 *   4. Posts to POST /messages/send
 */
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { loadContacts, type Contact } from "./contacts";

interface ComposeMessageProps {
  onClose: () => void;
  onSent: () => void;
  onEncryptAndSend: (params: {
    recipientUsername: string;
    body: string;
    attachment?: File;
  }) => Promise<void>;
}

export function ComposeMessage({ onClose, onSent, onEncryptAndSend }: ComposeMessageProps) {
  const { t } = useTranslation();
  const [recipient, setRecipient] = useState("");
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Contact[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleRecipientChange = (value: string) => {
    setRecipient(value);
    if (value.length >= 2) {
      const contacts = loadContacts();
      setSuggestions(
        contacts
          .filter(
            (c) =>
              c.username.toLowerCase().includes(value.toLowerCase()) ||
              c.label?.toLowerCase().includes(value.toLowerCase()),
          )
          .slice(0, 5),
      );
    } else {
      setSuggestions([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient.trim() || !body.trim()) return;

    // Validate recipient format: must start with $ or !
    if (!recipient.startsWith("$") && !recipient.startsWith("!")) {
      setError(t("messages.compose.invalidRecipient"));
      return;
    }

    setSending(true);
    setError(null);
    try {
      await onEncryptAndSend({
        recipientUsername: recipient.trim(),
        body: body.trim(),
        attachment: attachment ?? undefined,
      });
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("messages.compose.sendError"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t("messages.compose.dialogLabel")}
    >
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">{t("messages.compose.title")}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
            aria-label={t("common.cancel")}
          >
            ✕
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="p-4 space-y-3">
          {/* Recipient input with auto-suggest */}
          <div className="relative">
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              {t("messages.compose.recipientLabel")}
            </label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => handleRecipientChange(e.target.value)}
              placeholder={t("messages.compose.recipientPlaceholder")}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm
                         placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              autoComplete="off"
              required
            />
            {suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-card shadow-lg">
                {suggestions.map((c) => (
                  <li key={c.username}>
                    <button
                      type="button"
                      onClick={() => {
                        setRecipient(c.username);
                        setSuggestions([]);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      {c.label ? `${c.label} (${c.username})` : c.username}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Body textarea */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              {t("messages.compose.bodyLabel")}
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t("messages.compose.bodyPlaceholder")}
              rows={6}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm
                         placeholder:text-muted-foreground focus:outline-none focus:ring-2
                         focus:ring-primary/50 resize-none font-mono"
              required
            />
          </div>

          {/* Attachment picker */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-muted-foreground
                         border border-border hover:bg-muted transition-colors"
            >
              📎 {t("messages.compose.attachFile")}
            </button>
            {attachment && (
              <span className="flex items-center gap-1 text-xs text-foreground">
                {attachment.name}
                <button
                  type="button"
                  onClick={() => setAttachment(null)}
                  className="ml-0.5 text-muted-foreground hover:text-destructive"
                  aria-label="Remove attachment"
                >
                  ✕
                </button>
              </span>
            )}
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* Error */}
          {error && <p className="text-xs text-destructive">{error}</p>}

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={sending || !recipient.trim() || !body.trim()}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm
                         font-medium text-primary-foreground hover:bg-primary/90
                         disabled:pointer-events-none disabled:opacity-50"
            >
              ✉ {sending ? t("messages.compose.sending") : t("messages.compose.sendButton")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
