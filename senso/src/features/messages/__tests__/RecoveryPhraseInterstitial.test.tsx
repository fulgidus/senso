import { describe, it, expect, vi } from "vite-plus/test";
import { render, screen, fireEvent } from "@testing-library/react";
import { RecoveryPhraseInterstitial } from "../RecoveryPhraseInterstitial";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const PHRASE_24 = Array.from({ length: 24 }, (_, i) => `word${i + 1}`).join(" ");

describe("RecoveryPhraseInterstitial", () => {
  it("renders all 24 words", () => {
    const onConfirm = vi.fn();
    render(<RecoveryPhraseInterstitial phrase={PHRASE_24} onConfirm={onConfirm} />);
    expect(screen.getByText("word1")).toBeDefined();
    expect(screen.getByText("word24")).toBeDefined();
  });

  it("Continue button is disabled until checkbox is checked", () => {
    render(<RecoveryPhraseInterstitial phrase={PHRASE_24} onConfirm={vi.fn()} />);
    const btn = screen.getByText("messages.recoveryPhrase.continueButton");
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it("calls onConfirm when Continue is clicked after checkbox", () => {
    const onConfirm = vi.fn();
    render(<RecoveryPhraseInterstitial phrase={PHRASE_24} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByText("messages.recoveryPhrase.continueButton"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
