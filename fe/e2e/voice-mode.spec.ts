/**
 * voice-mode.spec.ts - Playwright UI tests for voice mode functionality.
 *
 * These tests cover:
 *   - Voice mode toggle (button states)
 *   - sttError display in VoiceModeBar during voice mode (D-01, D-02)
 *   - Voice mode transitions: idle → voice active → exit
 *   - Regression: Chromium audio contention fix (no micStreamRef held) — D-11
 *
 * All microphone and STT/TTS backend calls are mocked:
 *   - navigator.mediaDevices.getUserMedia → resolves immediately (no permission dialog)
 *   - POST /coaching/stt → JSON { text: "..." }
 *   - POST /coaching/tts → fake audio/mpeg bytes
 *
 * Playwright does not have a real microphone; the Web Speech API is also
 * mocked via addInitScript to prevent "not available in this browser" errors.
 */

import { test, expect } from "@playwright/test";
import {
  setupAuthenticatedSession,
  mockAllCoaching,
  mockCoachingSTT,
  mockCoachingTTS,
} from "./support/api-mocks";

// ── Shared browser API injection ──────────────────────────────────────────────

/**
 * Inject getUserMedia + SpeechRecognition mocks before page load.
 * Must be called BEFORE page.goto() so scripts are injected on load.
 */
async function setupVoiceMocks(page: Parameters<typeof mockAllCoaching>[0]): Promise<void> {
  // Mock getUserMedia so toggleVoiceMode completes permission prime without a dialog.
  // The stream is released immediately by toggleVoiceMode (micStreamRef removal fix).
  await page.addInitScript(() => {
    const fakeTrack = {
      kind: "audio",
      stop: () => {
        /* no-op */
      },
      enabled: true,
      id: "fake-track-id",
    } as unknown as MediaStreamTrack;

    const fakeStream = {
      getTracks: () => [fakeTrack],
      getAudioTracks: () => [fakeTrack],
    } as unknown as MediaStream;

    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: () => Promise.resolve(fakeStream),
        enumerateDevices: () => Promise.resolve([]),
      },
      writable: true,
      configurable: true,
    });
  });

  // Mock Web Speech API so the app thinks STT is available and mic button is enabled.
  await page.addInitScript(() => {
    class MockSpeechRecognition extends EventTarget {
      lang = "";
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onresult: ((e: Event) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((e: Event) => void) | null = null;
      start() {
        /* no-op: test controls when onend fires */
      }
      stop() {
        this.onend?.();
      }
      abort() {
        this.onend?.();
      }
    }
    (window as Window & { SpeechRecognition?: unknown }).SpeechRecognition = MockSpeechRecognition;
  });
}

// ── Tests: button states and toggle ──────────────────────────────────────────

test.describe("Voice mode — button states and toggle", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedSession(page);
    mockAllCoaching(page);
    mockCoachingSTT(page);
    mockCoachingTTS(page);
    await setupVoiceMocks(page);
    await page.goto("/chat");
    await page.waitForSelector('[aria-label="Voice mode"]', { timeout: 10_000 });
  });

  test("voice mode toggle button is visible and labelled correctly", async ({ page }) => {
    const toggleBtn = page.getByRole("button", { name: "Voice mode" });
    await expect(toggleBtn).toBeVisible();
    await expect(toggleBtn).toBeEnabled();
  });

  test("clicking voice mode button shows VoiceModeBar and hides text input", async ({ page }) => {
    const toggleBtn = page.getByRole("button", { name: "Voice mode" });
    await toggleBtn.click();

    // VoiceModeBar mic button appears
    const micBtn = page.getByRole("button", { name: /Start voice recording|Avvia/i });
    await expect(micBtn).toBeVisible({ timeout: 5_000 });

    // Text textarea is hidden
    await expect(page.locator("textarea")).toHaveCount(0);
  });

  test(
    "exit voice mode button hides VoiceModeBar and restores text input — " +
      "regression: Chromium audio contention fix (no micStreamRef held)",
    async ({ page }) => {
      // Enter voice mode
      await page.getByRole("button", { name: "Voice mode" }).click();
      await page.waitForSelector('[aria-label="Exit voice mode"]', { timeout: 5_000 });

      // Exit voice mode
      await page.getByRole("button", { name: "Exit voice mode" }).click();

      // VoiceModeBar is gone, text input is back
      await expect(page.locator("textarea")).toBeVisible({ timeout: 5_000 });
      await expect(page.getByRole("button", { name: "Exit voice mode" })).toHaveCount(0);

      // Regression note: if micStreamRef were still held (the old bug),
      // entering voice mode again would cause audio device contention.
      // Verify re-entry works cleanly:
      await page.getByRole("button", { name: "Voice mode" }).click();
      await expect(page.getByRole("button", { name: /Start voice recording|Avvia/i })).toBeVisible({
        timeout: 5_000,
      });
    },
  );
});

// ── Tests: sttError display (D-01, D-02) ─────────────────────────────────────

test.describe("Voice mode — sttError display in VoiceModeBar (D-01, D-02)", () => {
  test("soft STT error (no-speech) shows inline in VoiceModeBar status area", async ({ page }) => {
    await setupAuthenticatedSession(page);
    mockAllCoaching(page);
    mockCoachingTTS(page);

    // Inject SpeechRecognition mock that fires "no-speech" on start
    await page.addInitScript(() => {
      const fakeStream = {
        getTracks: () => [
          {
            stop: () => {
              /* no-op */
            },
          } as unknown as MediaStreamTrack,
        ],
        getAudioTracks: () => [],
      } as unknown as MediaStream;
      Object.defineProperty(navigator, "mediaDevices", {
        value: { getUserMedia: () => Promise.resolve(fakeStream) },
        writable: true,
        configurable: true,
      });

      class MockSpeechRecognitionNoSpeech extends EventTarget {
        lang = "";
        continuous = false;
        interimResults = false;
        maxAlternatives = 1;
        onresult: ((e: Event) => void) | null = null;
        onend: (() => void) | null = null;
        onerror: ((e: { error: string; message: string }) => void) | null = null;
        start() {
          setTimeout(() => {
            this.onerror?.({ error: "no-speech", message: "" });
            this.onend?.();
          }, 50);
        }
        stop() {
          this.onend?.();
        }
        abort() {
          this.onend?.();
        }
      }
      (window as Window & { SpeechRecognition?: unknown }).SpeechRecognition =
        MockSpeechRecognitionNoSpeech;
    });

    await page.goto("/chat");
    await page.waitForSelector('[aria-label="Voice mode"]', { timeout: 10_000 });

    await page.getByRole("button", { name: "Voice mode" }).click();
    await page.waitForSelector('[aria-label="Start voice recording"]', { timeout: 5_000 });

    const micBtn = page.getByRole("button", { name: "Start voice recording" });
    await micBtn.dispatchEvent("pointerdown");
    await micBtn.dispatchEvent("pointerup");

    // Soft error should appear inline in VoiceModeBar status paragraph
    await expect(page.locator(".flex.flex-col.items-center p").first()).toContainText(
      /rilevato|No audio/i,
      { timeout: 3_000 },
    );
  });

  test("hard STT error (not-allowed) does NOT show inline in VoiceModeBar", async ({ page }) => {
    await setupAuthenticatedSession(page);
    mockAllCoaching(page);
    mockCoachingTTS(page);

    await page.addInitScript(() => {
      const fakeStream = {
        getTracks: () => [
          {
            stop: () => {
              /* no-op */
            },
          } as unknown as MediaStreamTrack,
        ],
        getAudioTracks: () => [],
      } as unknown as MediaStream;
      Object.defineProperty(navigator, "mediaDevices", {
        value: { getUserMedia: () => Promise.resolve(fakeStream) },
        writable: true,
        configurable: true,
      });

      class MockSpeechRecognitionNotAllowed extends EventTarget {
        lang = "";
        continuous = false;
        interimResults = false;
        maxAlternatives = 1;
        onresult: ((e: Event) => void) | null = null;
        onend: (() => void) | null = null;
        onerror: ((e: { error: string; message: string }) => void) | null = null;
        start() {
          setTimeout(() => {
            this.onerror?.({ error: "not-allowed", message: "" });
            this.onend?.();
          }, 50);
        }
        stop() {
          this.onend?.();
        }
        abort() {
          this.onend?.();
        }
      }
      (window as Window & { SpeechRecognition?: unknown }).SpeechRecognition =
        MockSpeechRecognitionNotAllowed;
    });

    await page.goto("/chat");
    await page.waitForSelector('[aria-label="Voice mode"]', { timeout: 10_000 });

    await page.getByRole("button", { name: "Voice mode" }).click();
    await page.waitForSelector('[aria-label="Start voice recording"]', { timeout: 5_000 });

    const micBtn = page.getByRole("button", { name: "Start voice recording" });
    await micBtn.dispatchEvent("pointerdown");
    await micBtn.dispatchEvent("pointerup");

    // Wait for any error to propagate
    await page.waitForTimeout(500);

    // VoiceModeBar status text must NOT show the hard error inline
    // (hard errors go to toast, not inline in VoiceModeBar)
    const statusText = page.locator(".flex.flex-col.items-center p").first();
    await expect(statusText).not.toContainText(/negato|denied|not-allowed/i);
  });
});

// ── Tests: state transitions (D-06) ──────────────────────────────────────────

test.describe("Voice mode — state transitions (D-06)", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedSession(page);
    mockAllCoaching(page);
    mockCoachingSTT(page);
    mockCoachingTTS(page);
    await setupVoiceMocks(page);
    await page.goto("/chat");
    await page.waitForSelector('[aria-label="Voice mode"]', { timeout: 10_000 });
  });

  test("voice mode shows idle status text on activation", async ({ page }) => {
    await page.getByRole("button", { name: "Voice mode" }).click();
    const statusPara = page.locator(".flex.flex-col.items-center p").first();
    await expect(statusPara).toContainText(/Hold to speak|Tieni premuto/i, { timeout: 5_000 });
  });

  test("mic button animates during recording state while held", async ({ page }) => {
    await page.getByRole("button", { name: "Voice mode" }).click();
    await page.waitForSelector('[aria-label="Start voice recording"]', { timeout: 5_000 });

    const micBtn = page.getByRole("button", { name: "Start voice recording" });
    await micBtn.dispatchEvent("pointerdown");

    // Recording state: button gets animate-pulse class
    await expect(micBtn).toHaveClass(/animate-pulse/, { timeout: 2_000 });

    await micBtn.dispatchEvent("pointerup");
    await expect(micBtn).not.toHaveClass(/animate-pulse/, { timeout: 2_000 });
  });
});
