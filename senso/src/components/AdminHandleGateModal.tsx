import { Loader2, ShieldCheck } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { readAccessToken } from "@/features/auth/storage";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface AdminHandleGateModalProps {
    /** Called with the saved handle string (including ! prefix) after successful POST */
    onSaved: (handle: string) => void;
}

export function AdminHandleGateModal({ onSaved }: AdminHandleGateModalProps) {
    const { t } = useTranslation();
    const reducedMotion = useReducedMotion();

    const [inputValue, setInputValue] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const inputRef = useRef<HTMLInputElement>(null);

    const isDisabled = saving || inputValue.trim().length < 3;

    const handleSave = useCallback(async () => {
        const raw = inputValue.trim().replace(/^!/, "");
        if (!raw || raw.length < 3) return;

        const token = readAccessToken();
        if (!token) return;

        setSaving(true);
        setError(null);

        try {
            const { apiRequest } = await import("@/lib/api-client");
            const { getBackendBaseUrl } = await import("@/lib/config");
            const res = await apiRequest<{ adminHandle: string }>(
                getBackendBaseUrl(),
                "/admin/claim-handle",
                {
                    method: "POST",
                    token,
                    body: { adminHandle: `!${raw}` },
                },
            );
            onSaved(res.adminHandle);
        } catch (err: unknown) {
            // Detect 409 (taken) vs 422 (reserved/invalid) vs other
            if (err && typeof err === "object") {
                const e = err as { status?: number; statusCode?: number };
                const status = e.status ?? e.statusCode ?? 0;
                if (status === 409) {
                    setError(t("adminHandleGate.errorTaken"));
                } else if (status === 422) {
                    setError(t("adminHandleGate.errorReserved"));
                } else {
                    setError(t("adminHandleGate.errorFallback"));
                }
            } else {
                setError(t("adminHandleGate.errorFallback"));
            }
            // Re-focus input after error
            setTimeout(() => inputRef.current?.focus(), 0);
        } finally {
            setSaving(false);
        }
    }, [inputValue, t, onSaved]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            // Suppress Escape — modal is non-dismissable
            if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
            }
            if (e.key === "Enter" && !isDisabled) {
                handleSave();
            }
        },
        [isDisabled, handleSave],
    );

    const overlayEnterClass = reducedMotion ? "" : "animate-in fade-in-0";
    const cardEnterClass = reducedMotion ? "" : "animate-in fade-in-0 zoom-in-95";

    return (
        <div
            className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm ${overlayEnterClass}`}
            // Suppress backdrop click — modal is non-dismissable
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
            role="dialog"
            aria-modal="true"
            aria-label={t("adminHandleGate.dialogLabel")}
            aria-labelledby="admin-gate-title"
            aria-describedby="admin-gate-desc"
        >
            <div
                className={`w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl ${cardEnterClass}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex flex-col gap-2 border-b border-border px-6 py-5">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                        <h2
                            id="admin-gate-title"
                            className="text-base font-semibold leading-tight"
                        >
                            {t("adminHandleGate.title")}
                        </h2>
                    </div>
                    <p
                        id="admin-gate-desc"
                        className="text-sm text-muted-foreground"
                    >
                        {t("adminHandleGate.description")}
                    </p>
                </div>

                {/* Body */}
                <div className="flex flex-col gap-4 px-6 py-5">
                    <div>
                        <label
                            htmlFor="admin-handle-input"
                            className="sr-only"
                        >
                            {t("adminHandleGate.inputLabel")}
                        </label>

                        {/* Input prefix group */}
                        <div
                            className={`flex items-center overflow-hidden rounded-md border focus-within:ring-2 focus-within:ring-ring ${
                                error ? "border-destructive focus-within:ring-destructive/20" : "border-border"
                            }`}
                        >
                            <span
                                className="select-none bg-muted px-3 py-2 text-sm font-semibold text-muted-foreground"
                                aria-hidden="true"
                            >
                                !
                            </span>
                            <input
                                id="admin-handle-input"
                                ref={inputRef}
                                type="text"
                                autoFocus
                                className="flex-1 bg-transparent px-3 py-2 text-sm outline-none"
                                placeholder={t("adminHandleGate.inputPlaceholder")}
                                value={inputValue}
                                maxLength={30}
                                autoCapitalize="none"
                                autoCorrect="off"
                                spellCheck={false}
                                disabled={saving}
                                onChange={(e) => {
                                    // Silently strip invalid characters (keep [a-z0-9-] only)
                                    const cleaned = e.target.value
                                        .toLowerCase()
                                        .replace(/[^a-z0-9-]/g, "");
                                    setInputValue(cleaned);
                                    setError(null);
                                }}
                                onKeyDown={handleKeyDown}
                            />
                        </div>

                        {/* Format hint */}
                        <p className="mt-1 text-xs text-muted-foreground">
                            {t("adminHandleGate.formatHint")}
                        </p>

                        {/* Char count */}
                        <p className="mt-0.5 text-right text-xs text-muted-foreground">
                            {t("adminHandleGate.charCount", { count: inputValue.length })}
                        </p>

                        {/* Error — always in DOM for aria-live, empty when no error */}
                        <p
                            className="mt-1 text-xs text-destructive"
                            aria-live="polite"
                        >
                            {error ?? ""}
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6">
                    <button
                        type="button"
                        className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
                        disabled={isDisabled}
                        onClick={handleSave}
                    >
                        {saving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                                {t("adminHandleGate.saving")}
                            </>
                        ) : (
                            t("adminHandleGate.cta")
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
