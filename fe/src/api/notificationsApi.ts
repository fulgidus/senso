/**
 * notificationsApi.ts - Authenticated API client for user notifications.
 *
 * All endpoints hit /notifications/* and require Bearer token.
 */

import { apiRequest } from "@/lib/api-client";
import { getBackendBaseUrl } from "@/lib/config";
import { readAccessToken } from "@/features/auth/storage";

const API_BASE = getBackendBaseUrl();

export interface NotificationDTO {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  action_url: string | null;
  created_at: string;
}

export interface NotificationsListDTO {
  items: NotificationDTO[];
  unread_count: number;
}

function requireToken(): string {
  const token = readAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

export async function getNotifications(limit = 20): Promise<NotificationsListDTO> {
  return apiRequest<NotificationsListDTO>(API_BASE, `/notifications?limit=${limit}`, {
    token: requireToken(),
  });
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await apiRequest<void>(API_BASE, `/notifications/${notificationId}/read`, {
    method: "POST",
    token: requireToken(),
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiRequest<void>(API_BASE, "/notifications/read-all", {
    method: "POST",
    token: requireToken(),
  });
}

// ── Factory (Pattern B: requireToken() internal, onUnauthorized bound at construction) ──

export type NotificationsApiClient = ReturnType<typeof createNotificationsApi>;

export function createNotificationsApi(onUnauthorized?: () => Promise<string | null>) {
  function req<T>(path: string, opts: Record<string, unknown> = {}): Promise<T> {
    return apiRequest<T>(API_BASE, path, {
      ...opts,
      token: requireToken(),
      onUnauthorized,
    });
  }

  return {
    getNotifications: (limit = 20) => req<NotificationsListDTO>(`/notifications?limit=${limit}`),

    markNotificationRead: (notificationId: string) =>
      req<void>(`/notifications/${notificationId}/read`, { method: "POST" }),

    markAllNotificationsRead: () => req<void>("/notifications/read-all", { method: "POST" }),
  };
}
