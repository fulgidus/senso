import { apiRequest } from "@/lib/api-client"
import { getBackendBaseUrl } from "@/lib/config"
import type { ExtractedDocument, UploadStatus } from "./types"

function getBase(): string {
  return getBackendBaseUrl()
}

export async function uploadFile(
  token: string,
  file: File,
): Promise<{ upload_id: string; status: string }> {
  const formData = new FormData()
  formData.append("file", file)

  const response = await fetch(`${getBase()}/ingestion/upload`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: formData,
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(
      (data as { detail?: { message?: string } })?.detail?.message ??
        `Upload failed (${response.status})`,
    )
  }

  return response.json() as Promise<{ upload_id: string; status: string }>
}

export async function listUploads(token: string): Promise<UploadStatus[]> {
  return apiRequest<UploadStatus[]>(getBase(), "/ingestion/uploads", { token })
}

export async function getUpload(token: string, uploadId: string): Promise<UploadStatus> {
  return apiRequest<UploadStatus>(getBase(), `/ingestion/uploads/${uploadId}`, { token })
}

export async function getExtracted(
  token: string,
  uploadId: string,
): Promise<ExtractedDocument> {
  return apiRequest<ExtractedDocument>(
    getBase(),
    `/ingestion/uploads/${uploadId}/extracted`,
    { token },
  )
}

export async function confirmUpload(
  token: string,
  uploadId: string,
): Promise<{ confirmed: boolean }> {
  return apiRequest<{ confirmed: boolean }>(
    getBase(),
    `/ingestion/uploads/${uploadId}/confirm`,
    { method: "POST", token },
  )
}

export async function retryUpload(
  token: string,
  uploadId: string,
  hint?: string,
): Promise<{ status: string }> {
  return apiRequest<{ status: string }>(
    getBase(),
    `/ingestion/uploads/${uploadId}/retry`,
    {
      method: "POST",
      token,
      body: { hint: hint ?? null },
    },
  )
}

export async function reportUpload(
  token: string,
  uploadId: string,
  note?: string,
): Promise<{ reported: boolean }> {
  return apiRequest<{ reported: boolean }>(
    getBase(),
    `/ingestion/uploads/${uploadId}/report`,
    {
      method: "POST",
      token,
      body: { note: note ?? null },
    },
  )
}

export async function deleteUpload(token: string, uploadId: string): Promise<void> {
  await fetch(`${getBase()}/ingestion/uploads/${uploadId}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${token}` },
  })
}
