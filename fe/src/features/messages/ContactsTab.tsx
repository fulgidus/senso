import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { loadContacts, deleteContact, type Contact } from "./contacts";

export function ContactsTab() {
  const { t } = useTranslation();
  const [contacts, setContacts] = useState<Contact[]>([]);

  useEffect(() => {
    setContacts(loadContacts());
  }, []);

  const handleDelete = (username: string) => {
    setContacts(deleteContact(username));
  };

  if (contacts.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {t("messages.contacts.empty")}
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {contacts.map((c) => (
        <li
          key={c.username}
          className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
        >
          <div>
            <p className="text-sm font-medium">{c.label ?? c.username}</p>
            {c.label && <p className="text-xs text-muted-foreground">{c.username}</p>}
          </div>
          <button
            onClick={() => handleDelete(c.username)}
            aria-label={t("messages.contacts.deleteLabel", { username: c.username })}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}
