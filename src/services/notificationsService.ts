import { AppNotification } from '../types';
import { apiRequest } from './apiClient';

export interface NotificationsPage {
  notifications: AppNotification[];
  nextCursor: string | null;
}

export async function getNotifications(
  cursor?: string | null,
  limit = 30,
): Promise<NotificationsPage> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);

  const result = await apiRequest<{
    notifications: AppNotification[];
    nextCursor: string | null;
  }>(`/notifications?${params.toString()}`, { method: 'GET' });

  if (!result.ok || !result.data) {
    return { notifications: [], nextCursor: null };
  }
  return { notifications: result.data.notifications, nextCursor: result.data.nextCursor };
}

export async function getUnreadCount(): Promise<number> {
  const result = await apiRequest<{ count: number }>('/notifications/unread-count', {
    method: 'GET',
  });
  return result.ok && result.data ? result.data.count : 0;
}

export async function markRead(notificationId: string): Promise<void> {
  await apiRequest(`/notifications/${notificationId}/read`, { method: 'PATCH' });
}

export async function markAllRead(): Promise<void> {
  await apiRequest('/notifications/read-all', { method: 'PATCH' });
}
