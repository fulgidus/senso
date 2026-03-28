/**
 * useTTS — voice output hook.
 * Primary: ElevenLabs via POST /coaching/tts → ObjectURL → HTMLAudioElement
 * Fallback: window.speechSynthesis on 503 or ElevenLabs absence
 * Manages ObjectURL lifecycle (revokeObjectURL on stop/unmount).
 */
import { useState, useRef, useCallback, useEffect } from "react"
import { fetchTTSAudio } from "./coachingApi"

interface UseTTSResult {
  canPlay: boolean
  isPlaying: boolean
  play: (text: string, locale: "it" | "en") => Promise<void>
  stop: () => void
}

export function useTTS(): UseTTSResult {
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  // canPlay = true if speechSynthesis exists (ElevenLabs is optional — fallback)
  const canPlay = typeof window !== "undefined" && "speechSynthesis" in window

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
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()
    }
    setIsPlaying(false)
  }, [])

  const play = useCallback(async (text: string, locale: "it" | "en") => {
    stop()
    setIsPlaying(true)
    try {
      // Primary: ElevenLabs via backend
      const blob = await fetchTTSAudio(text, locale)
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
        // Audio element error — fall back to speechSynthesis
        URL.revokeObjectURL(url)
        objectUrlRef.current = null
        audioRef.current = null
        _fallbackSpeak(text, locale, () => setIsPlaying(false))
      }
      await audio.play()
    } catch {
      // fetchTTSAudio threw (503 or network) — fall back to speechSynthesis
      setIsPlaying(true)  // keep playing state true for fallback
      _fallbackSpeak(text, locale, () => setIsPlaying(false))
    }
  }, [stop])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause()
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel()
    }
  }, [])

  return { canPlay, isPlaying, play, stop }
}

function _fallbackSpeak(text: string, locale: "it" | "en", onEnd: () => void): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onEnd()
    return
  }
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = locale === "it" ? "it-IT" : "en-US"
  utterance.onend = onEnd
  utterance.onerror = onEnd
  window.speechSynthesis.speak(utterance)
}
