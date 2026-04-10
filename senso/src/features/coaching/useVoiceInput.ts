/**
 * useVoiceInput - Voice input hook with two backends:
 *
 *   1. Web Speech API (preferred) - real-time interim transcripts, zero latency.
 *      Available in Chrome, Edge, Safari. Blocked by LibreWolf and some Firefox
 *      builds for privacy reasons.
 *
 *   2. MediaRecorder + OpenAI Whisper (fallback) - records audio, POSTs to
 *      /coaching/stt when the user stops, returns final transcript. Available
 *      in ALL modern browsers (Chrome, Firefox, LibreWolf, Safari).
 *
 * `isAvailable` is true when EITHER Web Speech API OR MediaRecorder is available.
 * The hook selects the backend automatically at mount time.
 *
 * The external interface (UseVoiceInputResult) is unchanged so callers
 * (useVoiceMode, ChatScreen, VoiceModeBar) need no modification.
 */
import { useState, useRef, useCallback, useEffect } from "react"
import { readAccessToken } from "@/features/auth/storage"
import { getBackendBaseUrl } from "@/lib/config"

interface UseVoiceInputOptions {
    locale?: string
    onFinalTranscript: (text: string) => void
}

interface UseVoiceInputResult {
    isAvailable: boolean
    isRecording: boolean
    transcript: string
    error: string | null
    errorCode: string | null   // raw code: "not-allowed", "network", "no-speech", "stt_unavailable", "stt_empty_audio", "stt_failed", etc.
    startRecording: () => void
    stopRecording: () => void
}

// ── Web Speech API type declarations ─────────────────────────────────────────

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

// ── Backend detection ─────────────────────────────────────────────────────────

type VoiceBackend = "web-speech" | "media-recorder" | "none"

function detectBackend(): VoiceBackend {
    if (typeof window === "undefined") return "none"
    if (window.SpeechRecognition || window.webkitSpeechRecognition) return "web-speech"
    if (typeof MediaRecorder !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function") {
        return "media-recorder"
    }
    return "none"
}

// ── Whisper STT API call ──────────────────────────────────────────────────────

async function transcribeWithWhisper(blob: Blob, locale: string): Promise<string> {
    const token = readAccessToken()
    const formData = new FormData()
    // Use webm extension; Whisper accepts it natively
    const filename = blob.type.includes("ogg") ? "audio.ogg" : "audio.webm"
    formData.append("audio", blob, filename)

    const baseUrl = getBackendBaseUrl()
    const localeParam = locale === "it" ? "it" : "en"
    const resp = await fetch(`${baseUrl}/coaching/stt?locale=${localeParam}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
    })

    if (!resp.ok) {
        let code = "stt_failed"
        try {
            const body = await resp.json() as { detail?: { code?: string } }
            code = body?.detail?.code ?? "stt_failed"
        } catch { /* ignore */ }
        throw new Error(code)
    }

    const data = await resp.json() as { text: string }
    return data.text ?? ""
}

// ── Main hook ─────────────────────────────────────────────────────────────────

export function useVoiceInput({ locale = "it", onFinalTranscript }: UseVoiceInputOptions): UseVoiceInputResult {
    const [backend, setBackend] = useState<VoiceBackend>("none")
    const [isRecording, setIsRecording] = useState(false)
    const [transcript, setTranscript] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [errorCode, setErrorCode] = useState<string | null>(null)

    // Web Speech API refs
    const recognitionRef = useRef<ISpeechRecognition | null>(null)
    const finalTranscriptRef = useRef("")

    // MediaRecorder refs
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const isTranscribingRef = useRef(false)

    const onFinalRef = useRef(onFinalTranscript)
    onFinalRef.current = onFinalTranscript

    // Detect backend once on mount
    useEffect(() => {
        setBackend(detectBackend())
    }, [])

    // ── Web Speech API backend ────────────────────────────────────────────────

    const stopWebSpeech = useCallback(() => {
        recognitionRef.current?.stop()
        recognitionRef.current = null
        setIsRecording(false)
    }, [])

    const startWebSpeech = useCallback(() => {
        const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
        if (!SR) return
        setError(null)
        setErrorCode(null)
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
            setErrorCode(event.error)   // always set code regardless of whether msg is empty
        }

        recognitionRef.current = recognition
        recognition.start()
        setIsRecording(true)
    }, [locale])

    // ── MediaRecorder backend ────────────────────────────────────────────────

    const stopMediaRecorder = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop()
            // Transcription happens in onstop handler set during start
        }
        setIsRecording(false)
    }, [])

    const startMediaRecorder = useCallback(() => {
        if (isTranscribingRef.current) return  // Don't start a new recording while transcribing

        setError(null)
        setErrorCode(null)
        setTranscript("")
        chunksRef.current = []

        // Pick the best supported MIME type
        const mimeType = [
            "audio/webm;codecs=opus",
            "audio/webm",
            "audio/ogg;codecs=opus",
            "audio/ogg",
            "audio/mp4",
        ].find((t) => MediaRecorder.isTypeSupported(t)) ?? ""

        navigator.mediaDevices.getUserMedia({ audio: true })
            .then((stream) => {
                const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)

                recorder.ondataavailable = (e: BlobEvent) => {
                    if (e.data.size > 0) chunksRef.current.push(e.data)
                }

                recorder.onstop = () => {
                    // Stop mic tracks immediately so the browser indicator disappears
                    stream.getTracks().forEach((t) => t.stop())

                    const blob = new Blob(chunksRef.current, {
                        type: mimeType || "audio/webm",
                    })

                    if (blob.size === 0) {
                        setIsRecording(false)
                        return
                    }

                    // Send to Whisper
                    isTranscribingRef.current = true
                    setTranscript("…")  // visual feedback: transcription in progress

                    transcribeWithWhisper(blob, locale)
                        .then((text) => {
                            isTranscribingRef.current = false
                            setTranscript("")
                            if (text) onFinalRef.current(text)
                        })
                        .catch((err: Error) => {
                            isTranscribingRef.current = false
                            setTranscript("")
                            const errorMessages: Record<string, string> = {
                                "stt_unavailable": "Servizio di trascrizione non disponibile.",
                                "stt_empty_audio": "Nessun audio rilevato. Riprova.",
                                "stt_failed": "Trascrizione fallita. Riprova.",
                            }
                            setError(errorMessages[err.message] ?? "Errore durante la trascrizione.")
                            setErrorCode(err.message)   // err.message is the raw code
                        })
                }

                mediaRecorderRef.current = recorder
                recorder.start()
                setIsRecording(true)
            })
            .catch(() => {
                setError("Accesso al microfono negato. Controlla le impostazioni del browser.")
                setErrorCode("not-allowed")
            })
    }, [locale])

    // ── Unified interface ────────────────────────────────────────────────────

    const startRecording = useCallback(() => {
        if (isRecording) return // guard: already recording - no-op
        if (backend === "web-speech") startWebSpeech()
        else if (backend === "media-recorder") startMediaRecorder()
    }, [backend, isRecording, startWebSpeech, startMediaRecorder])

    const stopRecording = useCallback(() => {
        if (backend === "web-speech") stopWebSpeech()
        else if (backend === "media-recorder") stopMediaRecorder()
    }, [backend, stopWebSpeech, stopMediaRecorder])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            recognitionRef.current?.abort()
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
                mediaRecorderRef.current.stop()
            }
        }
    }, [])

    return {
        isAvailable: backend !== "none",
        isRecording,
        transcript,
        error,
        errorCode,
        startRecording,
        stopRecording,
    }
}
