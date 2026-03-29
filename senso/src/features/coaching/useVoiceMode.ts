/**
 * useVoiceMode - orchestrates voice-to-voice conversation flow.
 *
 * Flow:
 *   1. User activates voice mode (toggle).
 *   2. User holds the mic button → STT starts (pointerDown).
 *   3. User releases the mic button → STT stops → onFinalTranscript fires → message sent.
 *   4. When the assistant reply arrives, caller calls `onAssistantMessage(text)`.
 *   5. TTS auto-plays the reply — STT is immediately stopped to prevent feedback loop.
 *   6. When TTS finishes, if `voiceAutoListen` is true → mic reopens automatically.
 *
 * STT-TTS feedback loop prevention:
 *   When TTS starts playing (isPlaying rising edge), stopRecording() is called so the
 *   microphone cannot pick up the assistant's audio and loop it as user input.
 *   When TTS stops (falling edge), startRecording() re-enables listening if voiceAutoListen.
 *
 * Hold-to-talk is implemented via pointer events (mouse + touch unified).
 */
import { useState, useRef, useCallback, useEffect } from "react"
import { useVoiceInput } from "./useVoiceInput"
import { useTTS, type TTSConfig } from "./useTTS"

export interface UseVoiceModeOptions {
    locale: "it" | "en"
    ttsConfig: TTSConfig
    voiceAutoListen: boolean
    onSend: (text: string) => void
}

export interface UseVoiceModeResult {
    /** Whether voice mode is currently active */
    isVoiceMode: boolean
    /** Toggle voice mode on/off */
    toggleVoiceMode: () => void
    /** Is the mic currently recording */
    isRecording: boolean
    /** Live transcript while recording */
    transcript: string
    /** STT availability (Web Speech API) */
    isSttAvailable: boolean
    /** STT error string or null */
    sttError: string | null
    /** TTS is generating audio */
    isGenerating: boolean
    /** TTS is playing audio */
    isPlaying: boolean
    /** Is the auto-listen (post-TTS) phase active */
    isAutoListening: boolean
    /** Stop any ongoing TTS */
    stopTTS: () => void
    /** Pointer-down handler for the hold-to-talk button */
    onMicPointerDown: (e: React.PointerEvent) => void
    /** Pointer-up handler for the hold-to-talk button */
    onMicPointerUp: (e: React.PointerEvent) => void
    /**
     * Call this after the assistant message has been appended to the UI.
     * Triggers TTS auto-play and, optionally, auto-listen.
     */
    onAssistantMessage: (text: string) => void
}

export function useVoiceMode({
    locale,
    ttsConfig,
    voiceAutoListen,
    onSend,
}: UseVoiceModeOptions): UseVoiceModeResult {
    const [isVoiceMode, setIsVoiceMode] = useState(false)
    const [isAutoListening, setIsAutoListening] = useState(false)
    // Stable ref for voiceAutoListen so the TTS onended callback doesn't go stale
    const voiceAutoListenRef = useRef(voiceAutoListen)
    voiceAutoListenRef.current = voiceAutoListen

    const onSendRef = useRef(onSend)
    onSendRef.current = onSend

    // ── STT ──────────────────────────────────────────────────────────────────

    const { isAvailable: isSttAvailable, isRecording, transcript, error: sttError, startRecording, stopRecording } =
        useVoiceInput({
            locale,
            onFinalTranscript: (text) => {
                // Final transcript received → send message
                onSendRef.current(text)
            },
        })

    // ── TTS ──────────────────────────────────────────────────────────────────

    const { isPlaying, isGenerating, play, stop: stopTTS } = useTTS(ttsConfig)

    // Track isPlaying transitions to implement STT-TTS feedback loop prevention.
    // wasPlayingRef holds the previous value of isPlaying across renders.
    const wasPlayingRef = useRef(false)

    useEffect(() => {
        const wasPlaying = wasPlayingRef.current
        wasPlayingRef.current = isPlaying

        if (!wasPlaying && isPlaying) {
            // Rising edge: TTS just started — immediately stop STT to prevent
            // the microphone from picking up the assistant's audio output.
            stopRecording()
        } else if (wasPlaying && !isPlaying) {
            // Falling edge: TTS just finished — re-enable STT if auto-listen is on.
            if (voiceAutoListenRef.current && isVoiceMode) {
                // Small delay to avoid echo / UI flash before mic reopens.
                setIsAutoListening(true)
                const timer = setTimeout(() => {
                    setIsAutoListening(false)
                    startRecording()
                }, 400)
                return () => clearTimeout(timer)
            }
        }
    }, [isPlaying, isVoiceMode, startRecording, stopRecording])

    // ── Voice mode toggle ─────────────────────────────────────────────────────

    const toggleVoiceMode = useCallback(() => {
        setIsVoiceMode((prev) => {
            if (prev) {
                // Deactivating: stop everything
                stopRecording()
                stopTTS()
                setIsAutoListening(false)
            }
            return !prev
        })
    }, [stopRecording, stopTTS])

    // Stop everything when voice mode is turned off externally or on unmount
    useEffect(() => {
        if (!isVoiceMode) {
            stopRecording()
            stopTTS()
            setIsAutoListening(false)
        }
    }, [isVoiceMode, stopRecording, stopTTS])

    useEffect(() => {
        return () => {
            stopRecording()
            stopTTS()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ── Hold-to-talk pointer handlers ─────────────────────────────────────────

    const onMicPointerDown = useCallback((e: React.PointerEvent) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        if (!isRecording) startRecording()
    }, [isRecording, startRecording])

    const onMicPointerUp = useCallback((_e: React.PointerEvent) => {
        if (isRecording) stopRecording()
    }, [isRecording, stopRecording])

    // ── Assistant message callback ────────────────────────────────────────────

    const onAssistantMessage = useCallback((text: string) => {
        if (!isVoiceMode) return
        // Auto-play TTS. STT is stopped automatically via the isPlaying rising-edge
        // effect above when useTTS sets isPlaying=true.
        void play(text, locale)
    }, [isVoiceMode, play, locale])

    return {
        isVoiceMode,
        toggleVoiceMode,
        isRecording,
        transcript,
        isSttAvailable,
        sttError,
        isGenerating,
        isPlaying,
        isAutoListening,
        stopTTS,
        onMicPointerDown,
        onMicPointerUp,
        onAssistantMessage,
    }
}
