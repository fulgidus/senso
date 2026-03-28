/**
 * Tests for useVoiceInput hook
 * Focuses on feature detection and availability state — browser API mocking
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useVoiceInput } from "./useVoiceInput"

// Local type aliases matching the hook's internal Web Speech API interfaces
interface MockSpeechRecognitionErrorEvent {
  error: string
  message?: string
}

interface MockSpeechRecognitionResultList {
  length: number
  [index: number]: {
    isFinal: boolean
    length: number
    [index: number]: { transcript: string; confidence: number }
  }
}

interface MockSpeechRecognitionEvent {
  resultIndex: number
  results: MockSpeechRecognitionResultList
}

// Shared mock instance holder - module-level ref so tests can access callbacks
let mockInstance: {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  continuous: boolean
  onresult: ((e: MockSpeechRecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: ((e: MockSpeechRecognitionErrorEvent) => void) | null
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  abort: ReturnType<typeof vi.fn>
}

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
  }
}

// A proper class-based mock constructor matching ISpeechRecognitionConstructor
function createMockConstructor() {
  function MockSpeechRecognition(this: typeof mockInstance) {
    // Replace the shared mock instance with this new instance
    mockInstance = this
    mockInstance.start = vi.fn()
    mockInstance.stop = vi.fn()
    mockInstance.abort = vi.fn()
    mockInstance.onresult = null
    mockInstance.onend = null
    mockInstance.onerror = null
  }

  return MockSpeechRecognition as unknown as { new(): typeof mockInstance }
}

describe("useVoiceInput — feature detection", () => {
  afterEach(() => {
    Object.defineProperty(window, "SpeechRecognition", {
      value: undefined,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(window, "webkitSpeechRecognition", {
      value: undefined,
      configurable: true,
      writable: true,
    })
  })

  it("isAvailable is false when neither SpeechRecognition nor webkitSpeechRecognition is defined", () => {
    Object.defineProperty(window, "SpeechRecognition", {
      value: undefined,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(window, "webkitSpeechRecognition", {
      value: undefined,
      configurable: true,
      writable: true,
    })

    const { result } = renderHook(() =>
      useVoiceInput({ onFinalTranscript: vi.fn() }),
    )

    expect(result.current.isAvailable).toBe(false)
  })

  it("isAvailable is true when SpeechRecognition is defined", () => {
    Object.defineProperty(window, "SpeechRecognition", {
      value: createMockConstructor(),
      configurable: true,
      writable: true,
    })

    const { result } = renderHook(() =>
      useVoiceInput({ onFinalTranscript: vi.fn() }),
    )

    expect(result.current.isAvailable).toBe(true)
  })

  it("isAvailable is true when only webkitSpeechRecognition is defined", () => {
    Object.defineProperty(window, "SpeechRecognition", {
      value: undefined,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(window, "webkitSpeechRecognition", {
      value: createMockConstructor(),
      configurable: true,
      writable: true,
    })

    const { result } = renderHook(() =>
      useVoiceInput({ onFinalTranscript: vi.fn() }),
    )

    expect(result.current.isAvailable).toBe(true)
  })
})

describe("useVoiceInput — recording state", () => {
  beforeEach(() => {
    resetMockInstance()

    Object.defineProperty(window, "SpeechRecognition", {
      value: createMockConstructor(),
      configurable: true,
      writable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(window, "SpeechRecognition", {
      value: undefined,
      configurable: true,
      writable: true,
    })
  })

  it("isRecording starts as false", () => {
    const { result } = renderHook(() =>
      useVoiceInput({ onFinalTranscript: vi.fn() }),
    )
    expect(result.current.isRecording).toBe(false)
  })

  it("startRecording sets isRecording to true", () => {
    const { result } = renderHook(() =>
      useVoiceInput({ onFinalTranscript: vi.fn() }),
    )

    act(() => {
      result.current.startRecording()
    })

    expect(result.current.isRecording).toBe(true)
    expect(mockInstance.start).toHaveBeenCalledOnce()
  })

  it("stopRecording sets isRecording to false", () => {
    const { result } = renderHook(() =>
      useVoiceInput({ onFinalTranscript: vi.fn() }),
    )

    act(() => {
      result.current.startRecording()
    })

    expect(result.current.isRecording).toBe(true)

    act(() => {
      result.current.stopRecording()
    })

    expect(result.current.isRecording).toBe(false)
    expect(mockInstance.stop).toHaveBeenCalledOnce()
  })

  it("error resets to null when startRecording is called again", () => {
    const onFinalTranscript = vi.fn()
    const { result } = renderHook(() =>
      useVoiceInput({ onFinalTranscript }),
    )

    // Simulate starting and triggering onerror
    act(() => {
      result.current.startRecording()
    })

    act(() => {
      mockInstance.onerror?.({ error: "network" })
    })

    expect(result.current.error).toBe(
      "Errore di rete durante il riconoscimento vocale.",
    )

    // Start again — error should reset
    act(() => {
      result.current.startRecording()
    })

    expect(result.current.error).toBeNull()
  })

  it("onFinalTranscript is called with the final transcript when recognition ends normally", () => {
    const onFinalTranscript = vi.fn()
    const { result } = renderHook(() =>
      useVoiceInput({ onFinalTranscript }),
    )

    act(() => {
      result.current.startRecording()
    })

    // Simulate a final result
    act(() => {
      // Alternative (SpeechRecognitionAlternative-like)
      const alternative = { transcript: "ciao mondo", confidence: 0.9 }
      // Result (SpeechRecognitionResult-like)
      const speechResult = Object.assign([alternative], {
        isFinal: true,
        length: 1,
      })
      // ResultList (SpeechRecognitionResultList-like)
      const resultList = Object.assign([speechResult], { length: 1 })

      mockInstance.onresult?.({
        resultIndex: 0,
        results: resultList,
      })
    })

    // Trigger recognition end
    act(() => {
      mockInstance.onend?.()
    })

    expect(onFinalTranscript).toHaveBeenCalledWith("ciao mondo")
  })
})
