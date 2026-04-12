import { describe, it, expect, vi } from "vite-plus/test";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MessagesPage } from "../MessagesPage";

// Minimal i18n stub
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

// Mock AuthContext - provide polledMessages + isPolling + cryptoKeys
vi.mock("@/features/auth/AuthContext", () => ({
  useAuthContext: () => ({
    cryptoKeys: null,
    polledMessages: [],
    isPolling: false,
  }),
}));

// Mock InboxTab and ContactsTab to simplify
vi.mock("../InboxTab", () => ({
  InboxTab: ({ messages, loading }: { messages: unknown[]; loading: boolean }) => (
    <div>
      {loading && <span>messages.decrypting</span>}
      {!loading && messages.length === 0 && <span>messages.noMessages</span>}
    </div>
  ),
}));

vi.mock("../ContactsTab", () => ({
  ContactsTab: () => <div>contacts-tab</div>,
}));

vi.mock("../contacts", () => ({
  loadContacts: () => [],
  populateContactsFromMessages: vi.fn(),
}));

describe("MessagesPage", () => {
  it("renders page title", () => {
    render(
      <MemoryRouter>
        <MessagesPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("messages.pageTitle")).toBeDefined();
  });

  it("renders inbox tab by default", () => {
    render(
      <MemoryRouter>
        <MessagesPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("messages.inboxTab")).toBeDefined();
  });

  it("renders contacts tab button", () => {
    render(
      <MemoryRouter>
        <MessagesPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("messages.contactsTab")).toBeDefined();
  });
});
