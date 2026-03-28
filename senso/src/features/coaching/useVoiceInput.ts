/**
 * useVoiceInput — Web Speech API voice input hook.
 * Feature-detects on mount; hides mic button (isAvailable=false) if unavailable.
 * Calls onFinalTranscript(text) when recognition completes.
 */
import { useState, useRef, useCallback, useEffect } from "react"

interface UseVoiceInputOptions {
  locale?: string
  onFinalTranscript: (text: string) => void
}

interface UseVoiceInputResult {
  isAvailable: boolean
  isRecording: boolean
  transcript: string
  error: string | null
  startRecording: () => void
  stopRecording: () => void
}

// Web Speech API type declarations (not in all TS DOM lib versions)
interface SpeechRecognitionAlternative {
  readonly transcript: string
  readonly confidence: number
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionResultList {
  readonly length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string
  readonly message: string
}

interface ISpeechRecognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

interface ISpeechRecognitionConstructor {
  new(): ISpeechRecognition
}

// Extend Window type for webkitSpeechRecognition
declare global {
  interface Window {
    SpeechRecognition?: ISpeechRecognitionConstructor
    webkitSpeechRecognition?: ISpeechRecognitionConstructor
  }
}

export function useVoiceInput({ locale = "it", onFinalTranscript }: UseVoiceInputOptions): UseVoiceInputResult {
  const [isAvailable, setIsAvailable] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<ISpeechRecognition | null>(null)
  const finalTranscriptRef = useRef("")
  const onFinalRef = useRef(onFinalTranscript)
  onFinalRef.current = onFinalTranscript

  useEffect(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    setIsAvailable(!!SR)
  }, [])

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setIsRecording(false)
  }, [])

  const startRecording = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) return
    setError(null)
    setTranscript("")
    finalTranscriptRef.current = ""

    const recognition = new SR()
    recognition.lang = locale === "it" ? "it-IT" : "en-US"
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    recognition.continuous = false

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ""
      let final = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          final += result[0].transcript
        } else {
          interim += result[0].transcript
        }
      }
      if (final) finalTranscriptRef.current += final
      setTranscript(finalTranscriptRef.current + interim)
    }

    recognition.onend = () => {
      setIsRecording(false)
      recognitionRef.current = null
      const final = finalTranscriptRef.current.trim()
      if (final) {
        onFinalRef.current(final)
        setTranscript("")
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setIsRecording(false)
      recognitionRef.current = null
      const errorMessages: Record<string, string> = {
        "not-allowed": "Accesso al microfono negato. Controlla le impostazioni del browser.",
        "network": "Errore di rete durante il riconoscimento vocale.",
        "no-speech": "Nessun audio rilevato. Riprova.",
        "aborted": "",  // user-initiated, no message
      }
      const msg = errorMessages[event.error] ?? `Errore vocale: ${event.error}`
      if (msg) setError(msg)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsRecording(true)
  }, [locale])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
    }
  }, [])

  return { isAvailable, isRecording, transcript, error, startRecording, stopRecording }
}
