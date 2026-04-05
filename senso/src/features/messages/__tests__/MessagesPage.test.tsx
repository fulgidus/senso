import { describe, it, expect, vi } from "vite-plus/test";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MessagesPage } from "../MessagesPage";

// Minimal i18n stub
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

describe("MessagesPage", () => {
  it("renders without crashing", () => {
    render(
      <MemoryRouter>
        <MessagesPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("messages.loading")).toBeDefined();
  });
});
