/**
 * Tests for useVoiceInput hook
 * Focuses on feature detection and availability state - browser API mocking
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { renderHook, act } from "@testing-library/react";
import { useVoiceInput } from "./useVoiceInput";

// Local type aliases matching the hook's internal Web Speech API interfaces
interface MockSpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface MockSpeechRecognitionResultList {
  length: number;
  [index: number]: {
    isFinal: boolean;
    length: number;
    [index: number]: { transcript: string; confidence: number };
  };
}

interface MockSpeechRecognitionEvent {
  resultIndex: number;
  results: MockSpeechRecognitionResultList;
}

// Shared mock instance holder - module-level ref so tests can access callbacks
let mockInstance: {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: MockSpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: MockSpeechRecognitionErrorEvent) => void) | null;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  abort: ReturnType<typeof vi.fn>;
};

function resetMockInstance() {
  mockInstance = {
    lang: "",
    interimResults: false,
    maxAlternatives: 1,
    continuous: false,
    onresult: null,
    onend: null,
    onerror: null,
    start: vi.fn(),
    stop: vi.fn(),
    abort: vi.fn(),
  };
}

// A proper class-based mock constructor matching ISpeechRecognitionConstructor
function createMockConstructor() {
  function MockSpeechRecognition(this: typeof mockInstance) {
    // Replace the shared mock instance with this new instance
    mockInstance = this;
    mockInstance.start = vi.fn();
    mockInstance.stop = vi.fn();
    mockInstance.abort = vi.fn();
    mockInstance.onresult = null;
    mockInstance.onend = null;
    mockInstance.onerror = null;
  }

  return MockSpeechRecognition as unknown as { new (): typeof mockInstance };
}

describe("useVoiceInput - feature detection", () => {
  afterEach(() => {
    Object.defineProperty(window, "SpeechRecognition", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      value: undefined,
      configurable: true,
      writable: true,
    });
  });

  it("isAvailable is false when neither SpeechRecognition nor webkitSpeechRecognition is defined", () => {
    Object.defineProperty(window, "SpeechRecognition", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => useVoiceInput({ onFinalTranscript: vi.fn() }));

    expect(result.current.isAvailable).toBe(false);
  });

  it("isAvailable is true when SpeechRecognition is defined", () => {
    Object.defineProperty(window, "SpeechRecognition", {
      value: createMockConstructor(),
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => useVoiceInput({ onFinalTranscript: vi.fn() }));

    expect(result.current.isAvailable).toBe(true);
  });

  it("isAvailable is true when only webkitSpeechRecognition is defined", () => {
    Object.defineProperty(window, "SpeechRecognition", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      value: createMockConstructor(),
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => useVoiceInput({ onFinalTranscript: vi.fn() }));

    expect(result.current.isAvailable).toBe(true);
  });
});

describe("useVoiceInput - recording state", () => {
  beforeEach(() => {
    resetMockInstance();

    Object.defineProperty(window, "SpeechRecognition", {
      value: createMockConstructor(),
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "SpeechRecognition", {
      value: undefined,
      configurable: true,
      writable: true,
    });
  });

  it("isRecording starts as false", () => {
    const { result } = renderHook(() => useVoiceInput({ onFinalTranscript: vi.fn() }));
    expect(result.current.isRecording).toBe(false);
  });

  it("startRecording sets isRecording to true", () => {
    const { result } = renderHook(() => useVoiceInput({ onFinalTranscript: vi.fn() }));

    act(() => {
      result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(true);
    expect(mockInstance.start).toHaveBeenCalledOnce();
  });

  it("stopRecording sets isRecording to false", () => {
    const { result } = renderHook(() => useVoiceInput({ onFinalTranscript: vi.fn() }));

    act(() => {
      result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(true);

    act(() => {
      result.current.stopRecording();
    });

    expect(result.current.isRecording).toBe(false);
    expect(mockInstance.stop).toHaveBeenCalledOnce();
  });

  it("error resets to null when startRecording is called again", () => {
    const onFinalTranscript = vi.fn();
    const { result } = renderHook(() => useVoiceInput({ onFinalTranscript }));

    // Simulate starting and triggering onerror
    act(() => {
      result.current.startRecording();
    });

    act(() => {
      mockInstance.onerror?.({ error: "network" });
    });

    expect(result.current.error).toBe("Errore di rete durante il riconoscimento vocale.");

    // Start again - error should reset
    act(() => {
      result.current.startRecording();
    });

    expect(result.current.error).toBeNull();
  });

  it("onFinalTranscript is called with the final transcript when recognition ends normally", () => {
    const onFinalTranscript = vi.fn();
    const { result } = renderHook(() => useVoiceInput({ onFinalTranscript }));

    act(() => {
      result.current.startRecording();
    });

    // Simulate a final result
    act(() => {
      // Alternative (SpeechRecognitionAlternative-like)
      const alternative = { transcript: "ciao mondo", confidence: 0.9 };
      // Result (SpeechRecognitionResult-like)
      const speechResult = Object.assign([alternative], {
        isFinal: true,
        length: 1,
      });
      // ResultList (SpeechRecognitionResultList-like)
      const resultList = Object.assign([speechResult], { length: 1 });

      mockInstance.onresult?.({
        resultIndex: 0,
        results: resultList,
      });
    });

    // Trigger recognition end
    act(() => {
      mockInstance.onend?.();
    });

    expect(onFinalTranscript).toHaveBeenCalledWith("ciao mondo");
  });

  it("startRecording: guard prevents double-start — calling startRecording while isRecording does not call recognition.start() again (Chromium regression)", () => {
    const onFinal = vi.fn();
    const { result } = renderHook(() =>
      useVoiceInput({ locale: "it", onFinalTranscript: onFinal }),
    );

    // Start recording once
    act(() => {
      result.current.startRecording();
    });
    expect(result.current.isRecording).toBe(true);

    // Count how many times start() was called so far
    const callsBefore = mockInstance.start.mock.calls.length;

    // Call startRecording again while already recording — should be a no-op
    act(() => {
      result.current.startRecording();
    });

    // start() must NOT have been called a second time
    const callsAfter = mockInstance.start.mock.calls.length;
    expect(callsAfter).toBe(callsBefore);
  });
});

// ── MediaRecorder backend regression tests ───────────────────────────────────
// D-11: Regression for stt-server-side-whisper.md debug session.
// Verifies the MediaRecorder + server-side STT path works correctly.

describe("useVoiceInput - MediaRecorder backend (D-11 regression)", () => {
  beforeEach(() => {
    // Ensure Web Speech API is absent so the hook falls back to MediaRecorder
    Object.defineProperty(window, "SpeechRecognition", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    // Mock MediaRecorder as available
    const mockMediaRecorderInstance = {
      start: vi.fn(),
      stop: vi.fn(),
      state: "inactive" as "inactive" | "recording" | "paused",
      ondataavailable: null as ((e: { data: Blob }) => void) | null,
      onstop: null as (() => void) | null,
    };

    const MockMediaRecorder = vi.fn().mockImplementation(() => {
      mockMediaRecorderInstance.state = "inactive";
      return mockMediaRecorderInstance;
    }) as unknown as typeof MediaRecorder;

    (MockMediaRecorder as unknown as { isTypeSupported: (t: string) => boolean }).isTypeSupported =
      vi.fn().mockReturnValue(true);

    Object.defineProperty(window, "MediaRecorder", {
      value: MockMediaRecorder,
      configurable: true,
      writable: true,
    });

    // Mock navigator.mediaDevices.getUserMedia
    const fakeTrack = { stop: vi.fn(), kind: "audio" };
    const fakeStream = { getTracks: () => [fakeTrack] };
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(fakeStream),
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("isAvailable is true when Web Speech API is absent but MediaRecorder is available", async () => {
    const { result } = renderHook(() => useVoiceInput({ onFinalTranscript: vi.fn() }));
    // flush detectBackend useEffect
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.isAvailable).toBe(true);
  });

  it(
    "MediaRecorder path calls POST /coaching/stt on stop — " +
      "regression for stt-server-side-whisper.md debug session",
    async () => {
      const onFinalTranscript = vi.fn();
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ text: "Ciao dal MediaRecorder" }),
      } as Response);

      const { result } = renderHook(() => useVoiceInput({ locale: "it", onFinalTranscript }));

      // flush detectBackend effect
      await act(async () => {
        await Promise.resolve();
      });

      // Start recording
      await act(async () => {
        result.current.startRecording();
        await Promise.resolve();
      });

      const MockMR = window.MediaRecorder as unknown as ReturnType<typeof vi.fn>;
      const mrInstance = MockMR.mock.results[0]?.value as {
        onstop: (() => void) | null;
        ondataavailable: ((e: { data: Blob }) => void) | null;
      };

      // Simulate data arrival then stop
      act(() => {
        mrInstance.ondataavailable?.({
          data: new Blob([new Uint8Array(100)], { type: "audio/webm" }),
        });
      });

      await act(async () => {
        result.current.stopRecording();
        mrInstance.onstop?.();
        await Promise.resolve();
        await Promise.resolve(); // flush fetch promise
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/coaching/stt"),
        expect.objectContaining({ method: "POST" }),
      );
      expect(onFinalTranscript).toHaveBeenCalledWith("Ciao dal MediaRecorder");

      fetchSpy.mockRestore();
    },
  );

  it(
    "getUserMedia stream tracks are stopped after recording — " +
      "no micStreamRef held (regression: stt-hold-to-speak-chromium-no-audio.md)",
    async () => {
      const fakeTrackStop = vi.fn();
      (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockResolvedValue({
        getTracks: () => [{ stop: fakeTrackStop, kind: "audio" }],
      });

      const { result } = renderHook(() => useVoiceInput({ onFinalTranscript: vi.fn() }));

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        result.current.startRecording();
        await Promise.resolve();
      });

      const MockMR = window.MediaRecorder as unknown as ReturnType<typeof vi.fn>;
      const mrInstance = MockMR.mock.results[0]?.value as {
        onstop: (() => void) | null;
      };

      await act(async () => {
        result.current.stopRecording();
        mrInstance.onstop?.();
        await Promise.resolve();
      });

      // After onstop, stream tracks must be stopped — no live stream held
      expect(fakeTrackStop).toHaveBeenCalled();
    },
  );
});
