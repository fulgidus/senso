import { createContext, useContext } from "react";
import type { User, CryptoKeyMaterial } from "@/features/auth/types";
import type { PolledMessageDTO } from "@/features/messages/messagesApi";

export type AuthContextValue = {
  user: User;
  signOut: () => Promise<void>;
  updateUser: (updated: Partial<User>) => void;
  onUnauthorized: () => Promise<string | null>;
  cryptoKeys: CryptoKeyMaterial | null; // null until derived at login
  setCryptoKeys: (keys: CryptoKeyMaterial | null) => void;
  /** true while the bootstrap pollMessages() call is in-flight.
   * MessagesPage uses this to distinguish "not yet polled" from
   * "polled and found empty" - prevents a false empty-inbox flash.
   * (Review amendment: Gemini concern - bootstrap race condition) */
  isPolling: boolean;
  setIsPolling: (v: boolean) => void;
  /** Pending (unread) message count - drives the nav badge in AppShell. */
  pendingMessageCount: number;
  setPendingMessageCount: (n: number) => void;
  /** Raw polled messages from bootstrap poll - consumed by InboxTab without re-polling. */
  polledMessages: PolledMessageDTO[];
  setPolledMessages: (msgs: PolledMessageDTO[]) => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used inside AuthContext.Provider");
  return ctx;
}
