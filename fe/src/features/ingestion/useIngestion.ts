import { useCallback, useEffect, useRef, useState } from "react";
import type { ExtractedDocument, UploadStatus } from "./types";
import * as api from "./api";

const POLL_INTERVAL_MS = 1500;
const POLL_MAX_ATTEMPTS = 40; // 60 seconds max

interface IngestionState {
  uploads: UploadStatus[];
  loading: boolean;
  uploading: boolean;
  error: string | null;
}

export function useIngestion(token: string | null) {
  const [state, setState] = useState<IngestionState>({
    uploads: [],
    loading: false,
    uploading: false,
    error: null,
  });
  const pollTimers = useRef<Map<string, number>>(new Map());

  const refresh = useCallback(async () => {
    if (!token) return;
    setState((s) => ({ ...s, loading: true }));
    try {
      const uploads = await api.listUploads(token);
      setState((s) => ({ ...s, uploads, loading: false, error: null }));
      // Start polling for any pending uploads
      uploads
        .filter((u) => u.extractionStatus === "pending")
        .forEach((u) => {
          startPoll(u.id);
        });
    } catch {
      setState((s) => ({ ...s, loading: false, error: "Failed to load uploads" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    void refresh();
    return () => {
      // Cleanup all poll timers on unmount
      pollTimers.current.forEach((timer) => clearTimeout(timer));
    };
  }, [refresh]);

  function startPoll(uploadId: string, attempt = 0) {
    if (!token) return;
    if (attempt >= POLL_MAX_ATTEMPTS) return;
    if (pollTimers.current.has(uploadId)) return; // already polling

    const timer = window.setTimeout(async () => {
      pollTimers.current.delete(uploadId);
      try {
        const upload = await api.getUpload(token, uploadId);
        setState((s) => ({
          ...s,
          uploads: s.uploads.map((u) => (u.id === uploadId ? upload : u)),
        }));
        if (upload.extractionStatus === "pending") {
          startPoll(uploadId, attempt + 1);
        }
      } catch (err) {
        console.error("[ingestion] poll failed for", uploadId, err);
        startPoll(uploadId, attempt + 1);
      }
    }, POLL_INTERVAL_MS);
    pollTimers.current.set(uploadId, timer);
  }

  const upload = useCallback(
    async (file: File) => {
      if (!token) return;
      setState((s) => ({ ...s, uploading: true, error: null }));
      try {
        const result = await api.uploadFile(token, file);
        // Refresh to get the new pending entry
        await refresh();
        startPoll(result.upload_id);
      } catch (err) {
        setState((s) => ({
          ...s,
          uploading: false,
          error: err instanceof Error ? err.message : "Upload failed",
        }));
        return;
      }
      setState((s) => ({ ...s, uploading: false }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, refresh],
  );

  const confirmOne = useCallback(
    async (uploadId: string) => {
      if (!token) return;
      await api.confirmUpload(token, uploadId);
      await refresh();
    },
    [token, refresh],
  );

  const confirmAll = useCallback(async () => {
    if (!token) return;
    const eligible = state.uploads.filter((u) => u.extractionStatus === "success" && !u.confirmed);
    await Promise.all(eligible.map((u) => api.confirmUpload(token, u.id)));
    await refresh();
  }, [token, state.uploads, refresh]);

  const retry = useCallback(
    async (uploadId: string, hint?: string) => {
      if (!token) return;
      await api.retryUpload(token, uploadId, hint);
      // Set local state to pending immediately, then start polling
      setState((s) => ({
        ...s,
        uploads: s.uploads.map((u) =>
          u.id === uploadId ? { ...u, extractionStatus: "pending" as const } : u,
        ),
      }));
      startPoll(uploadId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token],
  );

  const report = useCallback(
    async (uploadId: string, note?: string) => {
      if (!token) return;
      await api.reportUpload(token, uploadId, note);
      await refresh();
    },
    [token, refresh],
  );

  const remove = useCallback(
    async (uploadId: string) => {
      if (!token) return;
      await api.deleteUpload(token, uploadId);
      setState((s) => ({
        ...s,
        uploads: s.uploads.filter((u) => u.id !== uploadId),
      }));
    },
    [token],
  );

  const getExtracted = useCallback(
    async (uploadId: string): Promise<ExtractedDocument> => {
      if (!token) throw new Error("No token");
      return api.getExtracted(token, uploadId);
    },
    [token],
  );

  const allConfirmed =
    state.uploads.length > 0 &&
    state.uploads.every((u) => u.extractionStatus !== "success" || u.confirmed);

  return {
    ...state,
    allConfirmed,
    upload,
    confirmOne,
    confirmAll,
    retry,
    report,
    remove,
    getExtracted,
    refresh,
  };
}
