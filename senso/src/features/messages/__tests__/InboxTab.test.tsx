import { describe, it, expect, vi } from "vite-plus/test";
import { render, screen } from "@testing-library/react";
import { InboxTab } from "../InboxTab";
import type { DecryptedMessage } from "../messagesApi";

// Minimal i18n stub
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

// ReactMarkdown renders children as text (simplified for test)
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => <p>{children}</p>,
}));

const baseMessage: DecryptedMessage = {
  id: "msg-1",
  createdAt: "2026-04-05T10:00:00Z",
  from: "$test-user",
  to: ["$recipient"],
  body: "Hello **world**",
  signatureValid: false,
  isAdmin: false,
  frontmatter: {},
};

describe("InboxTab", () => {
  it('renders "noMessages" when list is empty', () => {
    render(<InboxTab messages={[]} loading={false} error={null} />);
    expect(screen.getByText("messages.noMessages")).toBeDefined();
  });

  it("renders message with ReactMarkdown", () => {
    render(<InboxTab messages={[baseMessage]} loading={false} error={null} />);
    expect(screen.getByText("Hello **world**")).toBeDefined();
  });

  it("shows verifiedBadge for admin messages with valid signature", () => {
    const adminMsg: DecryptedMessage = {
      ...baseMessage,
      id: "msg-2",
      from: "!admin",
      isAdmin: true,
      signatureValid: true,
      signerPublicKey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    };
    render(<InboxTab messages={[adminMsg]} loading={false} error={null} />);
    expect(screen.getByText("messages.verifiedBadge")).toBeDefined();
  });

  it("shows loading state when loading=true", () => {
    render(<InboxTab messages={[]} loading={true} error={null} />);
    expect(screen.getByText("messages.decrypting")).toBeDefined();
  });

  it("shows error state when error is set", () => {
    render(<InboxTab messages={[]} loading={false} error="messages.errorLoading" />);
    expect(screen.getByText("messages.errorLoading")).toBeDefined();
  });
});
