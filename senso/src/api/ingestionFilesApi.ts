/**
 * ingestionFilesApi.ts — API client for the Files tab in ProfileScreen.
 *
 * Provides typed calls to:
 *  - GET /ingestion/uploads
 *  - DELETE /ingestion/uploads/{id}
 *  - POST /ingestion/uploads/{id}/retry
 *  - GET /ingestion/uploads/{id}/extracted
 *  - GET /admin/ingestion/uploads/{id}/trace  (admin only)
 */

import { apiRequest, ApiClientError } from "@/lib/api-client"
import { getBackendBaseUrl } from "@/lib/config"

const API_BASE = getBackendBaseUrl()

// ─── Types ────────────────────────────────────────────────────────────────────

export type UploadFile = {
  id: string
  original_filename: string
  content_type: string
  size_bytes: number
  uploaded_at: string
  extraction_status: string // "pending"|"queued"|"processing"|"done"|"failed"
  extraction_method: string | null
  module_source: string | null
  confirmed: boolean
}

export type ExtractedDocumentDetail = {
  document_type: string
  module_name: string
  confidence: number
  raw_text: string
  payload_json: Record<string, unknown>
  extracted_at: string
}

export type TraceStep = {
  id: string
  step_name: string
  step_order: number
  input_summary: string | null
  output_summary: string | null
  raw_input: Record<string, unknown> | null
  raw_output: Record<string, unknown> | null
  duration_ms: number | null
  status: string // "success"|"error"|"skipped"
  created_at: string
}

// ─── API Functions ────────────────────────────────────────────────────────────

/** List all uploads for the authenticated user. */
export async function listUploads(token: string): Promise<UploadFile[]> {
  return apiRequest<UploadFile[]>(API_BASE, "/ingestion/uploads", { token })
}

/** Delete an upload by ID. */
export async function deleteUpload(token: string, uploadId: string): Promise<void> {
  await apiRequest<void>(API_BASE, `/ingestion/uploads/${uploadId}`, {
    method: "DELETE",
    token,
  })
}

/** Retry extraction for an upload. */
export async function retryUpload(
  token: string,
  uploadId: string,
): Promise<{ upload_id: string; status: string }> {
  return apiRequest<{ upload_id: string; status: string }>(
    API_BASE,
    `/ingestion/uploads/${uploadId}/retry`,
    { method: "POST", token, body: { hint: null } },
  )
}

/**
 * Get the extracted document detail for an upload.
 * Returns null if the document has not been extracted yet (404).
 */
export async function getExtracted(
  token: string,
  uploadId: string,
): Promise<ExtractedDocumentDetail | null> {
  try {
    return await apiRequest<ExtractedDocumentDetail>(
      API_BASE,
      `/ingestion/uploads/${uploadId}/extracted`,
      { token },
    )
  } catch (err) {
    if (err instanceof ApiClientError && err.status === 404) return null
    throw err
  }
}

/**
 * Get pipeline trace steps for an upload (admin only).
 * Returns [] if the user is not an admin (403/404).
 */
export async function getTrace(token: string, uploadId: string): Promise<TraceStep[]> {
  try {
    return await apiRequest<TraceStep[]>(
      API_BASE,
      `/admin/ingestion/uploads/${uploadId}/trace`,
      { token },
    )
  } catch (err) {
    if (err instanceof ApiClientError && (err.status === 403 || err.status === 404)) return []
    throw err
  }
}
