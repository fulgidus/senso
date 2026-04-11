import { apiRequest } from "@/lib/api-client";
import { getBackendBaseUrl } from "@/lib/config";
import type { ExtractedDocument, UploadStatus } from "./types";

function getBase(): string {
  return getBackendBaseUrl();
}

/* native fetch — onUnauthorized not applicable (FormData multipart) */
export async function uploadFile(
  token: string,
  file: File,
): Promise<{ upload_id: string; status: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${getBase()}/ingestion/upload`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let message = `Upload failed (${response.status})`;
    try {
      const data = JSON.parse(text);
      message = (data as { detail?: { message?: string } })?.detail?.message ?? message;
    } catch {
      // not JSON, use text if available
      if (text) message = `${message}: ${text.slice(0, 200)}`;
    }
    console.error("[ingestion] uploadFile failed:", response.status, text.slice(0, 500));
    throw new Error(message);
  }

  return response.json() as Promise<{ upload_id: string; status: string }>;
}

export async function listUploads(token: string): Promise<UploadStatus[]> {
  return apiRequest<UploadStatus[]>(getBase(), "/ingestion/uploads", { token });
}

export async function getUpload(token: string, uploadId: string): Promise<UploadStatus> {
  return apiRequest<UploadStatus>(getBase(), `/ingestion/uploads/${uploadId}`, { token });
}

export async function getExtracted(token: string, uploadId: string): Promise<ExtractedDocument> {
  return apiRequest<ExtractedDocument>(getBase(), `/ingestion/uploads/${uploadId}/extracted`, {
    token,
  });
}

export async function confirmUpload(
  token: string,
  uploadId: string,
): Promise<{ confirmed: boolean }> {
  return apiRequest<{ confirmed: boolean }>(getBase(), `/ingestion/uploads/${uploadId}/confirm`, {
    method: "POST",
    token,
  });
}

export async function retryUpload(
  token: string,
  uploadId: string,
  hint?: string,
): Promise<{ status: string }> {
  return apiRequest<{ status: string }>(getBase(), `/ingestion/uploads/${uploadId}/retry`, {
    method: "POST",
    token,
    body: { hint: hint ?? null },
  });
}

export async function reportUpload(
  token: string,
  uploadId: string,
  note?: string,
): Promise<{ reported: boolean }> {
  return apiRequest<{ reported: boolean }>(getBase(), `/ingestion/uploads/${uploadId}/report`, {
    method: "POST",
    token,
    body: { note: note ?? null },
  });
}

/* native fetch — onUnauthorized not applicable */
export async function deleteUpload(token: string, uploadId: string): Promise<void> {
  await fetch(`${getBase()}/ingestion/uploads/${uploadId}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${token}` },
  });
}

// ── Factory (Pattern A: token as param, onUnauthorized bound at construction) ──

export type IngestionApiClient = ReturnType<typeof createIngestionApi>;

export function createIngestionApi(onUnauthorized?: () => Promise<string | null>) {
  function req<T>(path: string, opts: Record<string, unknown> = {}): Promise<T> {
    return apiRequest<T>(getBase(), path, { ...opts, onUnauthorized });
  }

  return {
    // uploadFile: excluded — uses native fetch (FormData multipart upload)
    // deleteUpload: excluded — uses native fetch

    listUploads: (token: string) => req<UploadStatus[]>("/ingestion/uploads", { token }),

    getUpload: (token: string, uploadId: string) =>
      req<UploadStatus>(`/ingestion/uploads/${uploadId}`, { token }),

    getExtracted: (token: string, uploadId: string) =>
      req<ExtractedDocument>(`/ingestion/uploads/${uploadId}/extracted`, { token }),

    confirmUpload: (token: string, uploadId: string) =>
      req<{ confirmed: boolean }>(`/ingestion/uploads/${uploadId}/confirm`, {
        method: "POST",
        token,
      }),

    retryUpload: (token: string, uploadId: string, hint?: string) =>
      req<{ status: string }>(`/ingestion/uploads/${uploadId}/retry`, {
        method: "POST",
        token,
        body: { hint: hint ?? null },
      }),

    reportUpload: (token: string, uploadId: string, note?: string) =>
      req<{ reported: boolean }>(`/ingestion/uploads/${uploadId}/report`, {
        method: "POST",
        token,
        body: { note: note ?? null },
      }),

    /** Confirm all uploads for the current user and trigger profile categorization.
     *  Replaces the raw apiRequest import in OnboardingRoutes.tsx. */
    confirmAll: (token: string) => req<void>("/ingestion/confirm-all", { method: "POST", token }),
  };
}
