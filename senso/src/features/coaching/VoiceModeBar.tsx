/**
 * VoiceModeBar - replaces the text input area while voice mode is active.
 *
 * States it renders:
 *   - idle (voice mode on, not recording, not playing/generating)
 *   - recording (mic held, live transcript shown)
 *   - generating (TTS fetching audio)
 *   - playing (TTS audio playing)
 *   - auto-listening (brief pause before mic reopens)
 *
 * Hold-to-talk: pointerDown starts recording, pointerUp stops it.
 */
import { useTranslation } from "react-i18next"
import { Mic, Square, Loader2, MicOff } from "lucide-react"

interface VoiceModeBarProps {
    isRecording: boolean
    isGenerating: boolean
    isPlaying: boolean
    isAutoListening: boolean
    transcript: string
    isSttAvailable: boolean
    onMicPointerDown: (e: React.PointerEvent) => void
    onMicPointerUp: (e: React.PointerEvent) => void
    onStopTTS: () => void
    onExitVoiceMode: () => Promise<void>
    disabled?: boolean
}

export function VoiceModeBar({
    isRecording,
    isGenerating,
    isPlaying,
    isAutoListening,
    transcript,
    isSttAvailable,
    onMicPointerDown,
    onMicPointerUp,
    onStopTTS,
    onExitVoiceMode,
    disabled = false,
}: VoiceModeBarProps) {
    const { t } = useTranslation()

    const busy = isGenerating || isPlaying || isAutoListening

    // Status label shown above the mic
    let statusText = t("coaching.voiceModeIdle")
    if (isRecording) statusText = transcript || t("coaching.voiceModeListening")
    else if (isGenerating) statusText = t("coaching.ttsGenerating")
    else if (isPlaying) statusText = t("coaching.ttsPlaying")
    else if (isAutoListening) statusText = t("coaching.voiceModeAutoListen")

    return (
        <div className="flex flex-col items-center gap-3 py-2">
            {/* Status row */}
            <p
                className={[
                    "text-sm text-center min-h-[1.25rem] px-4 transition-colors",
                    isRecording ? "text-red-500 font-medium" : "text-muted-foreground",
                ].join(" ")}
            >
                {statusText}
            </p>

            {/* Controls row */}
            <div className="flex items-center gap-4">
                {/* Exit voice mode */}
                <button
                    type="button"
                    onClick={onExitVoiceMode}
                    disabled={disabled}
                    className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-40"
                    aria-label={t("coaching.voiceModeExit")}
                    title={t("coaching.voiceModeExit")}
                >
                    <MicOff className="h-5 w-5" />
                </button>

                {/* Hold-to-talk mic OR stop-TTS button */}
                {isPlaying ? (
                    <button
                        type="button"
                        onClick={onStopTTS}
                        className="rounded-full h-16 w-16 flex items-center justify-center bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
                        aria-label={t("coaching.ttsPlaying")}
                    >
                        <Square className="h-6 w-6" />
                    </button>
                ) : (
                    <button
                        type="button"
                        onPointerDown={onMicPointerDown}
                        onPointerUp={onMicPointerUp}
                        onPointerCancel={onMicPointerUp}
                        disabled={disabled || busy || !isSttAvailable}
                        className={[
                            "rounded-full h-16 w-16 flex items-center justify-center shadow-lg transition-all select-none touch-none",
                            isRecording
                                ? "bg-red-500 text-white scale-110 animate-pulse"
                                : isGenerating || isAutoListening
                                    ? "bg-muted text-muted-foreground cursor-wait"
                                    : "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95",
                            (disabled || busy || !isSttAvailable) && !isRecording ? "opacity-60" : "",
                        ].join(" ")}
                        aria-label={isRecording ? t("coaching.voiceStop") : t("coaching.voiceStart")}
                        title={isRecording ? t("coaching.voiceStop") : t("coaching.voiceStart")}
                    >
                        {isGenerating ? (
                            <Loader2 className="h-6 w-6 animate-spin" />
                        ) : isRecording ? (
                            <Mic className="h-6 w-6" />
                        ) : isAutoListening ? (
                            <Mic className="h-6 w-6 opacity-50" />
                        ) : (
                            <Mic className="h-6 w-6" />
                        )}
                    </button>
                )}

                {/* Spacer to balance the exit button */}
                <div className="w-9 h-9" aria-hidden />
            </div>

            {/* Hint */}
            <p className="text-xs text-muted-foreground">
                {isSttAvailable ? t("coaching.voiceModeHint") : t("coaching.voiceModeUnavailable")}
            </p>
        </div>
    )
}
