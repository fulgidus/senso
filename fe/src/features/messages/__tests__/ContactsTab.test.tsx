import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { render, screen } from "@testing-library/react";
import { ContactsTab } from "../ContactsTab";

// Minimal i18n stub
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

// Mock contacts module
const mockLoadContacts = vi.fn();
const mockDeleteContact = vi.fn();

vi.mock("../contacts", () => ({
  loadContacts: () => mockLoadContacts(),
  deleteContact: (username: string) => mockDeleteContact(username),
}));

describe("ContactsTab", () => {
  beforeEach(() => {
    mockLoadContacts.mockReturnValue([]);
    mockDeleteContact.mockReturnValue([]);
  });

  it('renders "contacts.empty" when list is empty', () => {
    render(<ContactsTab />);
    expect(screen.getByText("messages.contacts.empty")).toBeDefined();
  });

  it("renders contacts when list has items", () => {
    mockLoadContacts.mockReturnValue([
      { username: "$test-user", lastSeen: "2026-04-05T10:00:00Z" },
    ]);
    render(<ContactsTab />);
    expect(screen.getByText("$test-user")).toBeDefined();
  });
});
