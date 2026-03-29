/**
 * useTTS - voice output hook.
 * Primary: ElevenLabs via POST /coaching/tts → ObjectURL → HTMLAudioElement
 * Fallback: window.speechSynthesis - only when config.browserFallbackEnabled=true
 *           AND the ElevenLabs call fails (503 / network error).
 * Manages ObjectURL lifecycle (revokeObjectURL on stop/unmount).
 */
import { useState, useRef, useCallback, useEffect } from "react"
import { fetchTTSAudio } from "./coachingApi"

export interface TTSConfig {
    /** "browser" = fall back to speechSynthesis on ElevenLabs failure; "none" = hard fail */
    fallback: "browser" | "none"
    /** If false, speechSynthesis is never used even if fallback="browser" */
    browserFallbackEnabled: boolean
}

const DEFAULT_TTS_CONFIG: TTSConfig = {
    fallback: "browser",
    browserFallbackEnabled: true,
}

interface UseTTSResult {
    canPlay: boolean
    isPlaying: boolean
    isGenerating: boolean
    play: (text: string, locale: "it" | "en") => Promise<void>
    stop: () => void
}

export function useTTS(config: TTSConfig = DEFAULT_TTS_CONFIG): UseTTSResult {
    const [isPlaying, setIsPlaying] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const objectUrlRef = useRef<string | null>(null)

    // canPlay = true if ElevenLabs is the target OR if browser fallback is enabled
    const canPlay =
        typeof window !== "undefined" &&
        (config.browserFallbackEnabled ? "speechSynthesis" in window : true)

    const _cancelSpeechSynthesis = useCallback(() => {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
            window.speechSynthesis.cancel()
        }
    }, [])

    const stop = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current.src = ""
            audioRef.current = null
        }
        if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current)
            objectUrlRef.current = null
        }
        // Cancel speechSynthesis too - but only if fallback is enabled
        if (config.browserFallbackEnabled) {
            _cancelSpeechSynthesis()
        }
        setIsPlaying(false)
        setIsGenerating(false)
    }, [config.browserFallbackEnabled, _cancelSpeechSynthesis])

    const play = useCallback(async (text: string, locale: "it" | "en") => {
        // Reject re-entrant calls while generating or already playing
        if (isGenerating || isPlaying) return

        stop()
        setIsGenerating(true)

        try {
            // Primary: ElevenLabs via backend
            const blob = await fetchTTSAudio(text, locale)

            setIsGenerating(false)
            setIsPlaying(true)

            const url = URL.createObjectURL(blob)
            objectUrlRef.current = url
            const audio = new Audio(url)
            audioRef.current = audio

            audio.onended = () => {
                URL.revokeObjectURL(url)
                objectUrlRef.current = null
                audioRef.current = null
                setIsPlaying(false)
            }
            audio.onerror = () => {
                // Audio element error after we already have the blob - rare, don't fallback to
                // speechSynthesis here because we don't know if the audio partially played.
                URL.revokeObjectURL(url)
                objectUrlRef.current = null
                audioRef.current = null
                setIsPlaying(false)
            }
            await audio.play()
        } catch (err) {
            // fetchTTSAudio threw (503 or network) - fall back to speechSynthesis only when
            // explicitly permitted by config.
            console.warn("[useTTS] ElevenLabs failed, falling back to speechSynthesis:", err)
            setIsGenerating(false)
            if (
                config.fallback === "browser" &&
                config.browserFallbackEnabled &&
                typeof window !== "undefined" &&
                "speechSynthesis" in window
            ) {
                setIsPlaying(true)
                _fallbackSpeak(text, locale, () => setIsPlaying(false))
            }
            // else: hard fail - isPlaying stays false, no noise
        }
    }, [isGenerating, isPlaying, stop, config.fallback, config.browserFallbackEnabled])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) audioRef.current.pause()
            if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
            if (typeof window !== "undefined" && "speechSynthesis" in window) {
                window.speechSynthesis.cancel()
            }
        }
    }, [])

    return { canPlay, isPlaying, isGenerating, play, stop }
}

function _fallbackSpeak(text: string, locale: "it" | "en", onEnd: () => void): void {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        onEnd()
        return
    }
    // Cancel any currently speaking utterance before starting a new one
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = locale === "it" ? "it-IT" : "en-US"
    utterance.onend = onEnd
    utterance.onerror = onEnd
    window.speechSynthesis.speak(utterance)
}
