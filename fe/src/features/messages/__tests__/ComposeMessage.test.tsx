import { describe, it, expect, vi, beforeAll } from "vite-plus/test";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import sodium from "libsodium-wrappers";
import { ComposeMessage } from "../ComposeMessage";

beforeAll(async () => {
  await sodium.ready;
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../contacts", () => ({
  loadContacts: vi.fn(() => []),
}));

const mockEncryptAndSend = vi.fn().mockResolvedValue(undefined);
const mockOnClose = vi.fn();
const mockOnSent = vi.fn();

function renderCompose() {
  return render(
    <MemoryRouter>
      <ComposeMessage
        onClose={mockOnClose}
        onSent={mockOnSent}
        onEncryptAndSend={mockEncryptAndSend}
      />
    </MemoryRouter>,
  );
}

describe("ComposeMessage", () => {
  it("renders recipient input and body textarea", () => {
    renderCompose();
    expect(screen.getByPlaceholderText("messages.compose.recipientPlaceholder")).toBeDefined();
    expect(screen.getByPlaceholderText("messages.compose.bodyPlaceholder")).toBeDefined();
  });

  it("send button is disabled when fields are empty", () => {
    renderCompose();
    const btn = screen.getByRole("button", { name: /sendButton/ });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows validation error for recipient without $ or ! prefix", async () => {
    renderCompose();
    fireEvent.change(screen.getByPlaceholderText("messages.compose.recipientPlaceholder"), {
      target: { value: "no-prefix-user" },
    });
    fireEvent.change(screen.getByPlaceholderText("messages.compose.bodyPlaceholder"), {
      target: { value: "Hello" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sendButton/ }));
    await waitFor(() => {
      expect(screen.getByText("messages.compose.invalidRecipient")).toBeDefined();
    });
    expect(mockEncryptAndSend).not.toHaveBeenCalled();
  });

  it("calls onEncryptAndSend with valid $username and body", async () => {
    mockEncryptAndSend.mockClear();
    mockOnSent.mockClear();
    renderCompose();
    fireEvent.change(screen.getByPlaceholderText("messages.compose.recipientPlaceholder"), {
      target: { value: "$witty-otter-42" },
    });
    fireEvent.change(screen.getByPlaceholderText("messages.compose.bodyPlaceholder"), {
      target: { value: "Test message body" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sendButton/ }));
    await waitFor(() => {
      expect(mockEncryptAndSend).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientUsername: "$witty-otter-42",
          body: "Test message body",
        }),
      );
    });
    await waitFor(() => {
      expect(mockOnSent).toHaveBeenCalled();
    });
  });
});
