/**
 * MessagesPage — /messages route (Phase 15)
 *
 * Two tabs via ?tab= URL param:
 *   - inbox   (default): consume polledMessages from AuthContext, decrypt, render
 *   - contacts: manage prior correspondents (localStorage, Plan 15-04-03)
 *
 * Compose button opens ComposeMessage modal; encryption handled by onEncryptAndSend
 * which will be wired to useEncryptAndSend() in Plan 15-05.
 *
 * CRITICAL: Do NOT call pollMessages() here.
 * Messages are polled ONCE at login bootstrap and stored in AuthContext.
 * InboxTab reads polledMessages from context — calling pollMessages() again
 * would mark messages as re-delivered and corrupt server state.
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthContext } from "@/features/auth/AuthContext";
import { parsePolledMessage } from "./parseMessage";
import { loadContacts, populateContactsFromMessages } from "./contacts";
import type { DecryptedMessage } from "./messagesApi";
import { InboxTab } from "./InboxTab";
import { ContactsTab } from "./ContactsTab";
import { ComposeMessage } from "./ComposeMessage";

type Tab = "inbox" | "contacts";

export function MessagesPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { cryptoKeys, polledMessages, isPolling } = useAuthContext();

  const tab: Tab = (searchParams.get("tab") as Tab) ?? "inbox";

  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);

  const setTab = (next: Tab) => setSearchParams({ tab: next }, { replace: true });

  useEffect(() => {
    if (tab !== "inbox" || !cryptoKeys) return;

    // isPolling: true while bootstrap poll is in-flight.
    // Guard here so InboxTab shows a spinner (loading=true) rather than
    // a false "No messages" empty state during the bootstrap window. (Review amendment #1)
    if (isPolling) {
      setLoading(true);
      return;
    }

    if (polledMessages.length === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // Build signing keys map from local contacts cache
        const contacts = loadContacts();
        const knownSigningKeys = new Map(
          contacts.filter((c) => c.signingKeyB64).map((c) => [c.username, c.signingKeyB64!]),
        );

        const decrypted = await Promise.all(
          polledMessages.map((msg) => parsePolledMessage(msg, cryptoKeys, knownSigningKeys)),
        );

        if (!cancelled) {
          setMessages(decrypted);
          populateContactsFromMessages(decrypted);
        }
      } catch {
        if (!cancelled) setError(t("messages.errorLoading"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [tab, cryptoKeys, polledMessages, isPolling, t]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Page header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("messages.pageTitle")}</h1>
        <button
          onClick={() => setShowCompose(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm
                     font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t("messages.composeButton")}
        </button>
      </div>

      {/* Tab bar */}
      <div className="mb-6 flex gap-2 border-b border-border">
        <button
          className={`px-3 pb-2 text-sm font-medium transition-colors ${
            tab === "inbox"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setTab("inbox")}
        >
          {t("messages.inboxTab")}
        </button>
        <button
          className={`px-3 pb-2 text-sm font-medium transition-colors ${
            tab === "contacts"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setTab("contacts")}
        >
          {t("messages.contactsTab")}
        </button>
      </div>

      {tab === "inbox" && <InboxTab messages={messages} loading={loading} error={error} />}
      {tab === "contacts" && <ContactsTab />}

      {/* Compose modal — encryption wired in Plan 15-05 via useEncryptAndSend */}
      {showCompose && (
        <ComposeMessage
          onClose={() => setShowCompose(false)}
          onSent={() => setShowCompose(false)}
          onEncryptAndSend={async () => {
            // TODO: Plan 15-05 will replace this with useEncryptAndSend()
            throw new Error("Compose not yet implemented");
          }}
        />
      )}
    </div>
  );
}
