import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { render, screen } from "@testing-library/react";
import { OfflineBanner } from "./OfflineBanner";

// Mock useOnlineStatus
let mockOnline = true;
vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: () => mockOnline,
}));

// Mock react-i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "it" },
  }),
}));

describe("OfflineBanner", () => {
  beforeEach(() => {
    mockOnline = true;
  });

  it("renders nothing when online", () => {
    mockOnline = true;
    const { container } = render(<OfflineBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders alert when offline", () => {
    mockOnline = false;
    render(<OfflineBanner />);
    const alert = screen.getByRole("alert");
    expect(alert).toBeDefined();
    expect(alert.textContent).toContain("app.offlineBanner");
  });
});
