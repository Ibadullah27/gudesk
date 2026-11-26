import { AppError } from '../errors/AppError.js';
import { notificationsRepository } from '../repositories/notifications.repository.js';

function dbError() { return new AppError(500, 'DATABASE_ERROR', 'Notifications could not be loaded. Please try again.'); }
class NotificationsService {
  async list(filters, profile, token) {
    try {
      const [{ data, count, error }, unreadResult] = await Promise.all([
        notificationsRepository.list(profile.id, filters, token), notificationsRepository.unreadCount(profile.id, token),
      ]);
      if (error || unreadResult.error) {
        const err = error || unreadResult.error;
        if (err.message?.includes('notifications') || err.code === '42P01' || err.code === 'PGRST205') {
          return { data: [], meta: { page: filters.page, pageSize: filters.pageSize, total: 0, unread_count: 0 } };
        }
        throw dbError();
      }
      return { data: data ?? [], meta: { page: filters.page, pageSize: filters.pageSize, total: count ?? 0, unread_count: unreadResult.count ?? 0 } };
    } catch (e) {
      if (e?.message?.includes('notifications') || e?.code === '42P01' || e?.code === 'PGRST205') {
        return { data: [], meta: { page: filters.page, pageSize: filters.pageSize, total: 0, unread_count: 0 } };
      }
      throw e;
    }
  }
  async unreadCount(profile, token) {
    try {
      const { count, error } = await notificationsRepository.unreadCount(profile.id, token);
      if (error) {
        if (error.message?.includes('notifications') || error.code === '42P01' || error.code === 'PGRST205') {
          return { count: 0 };
        }
        throw dbError();
      }
      return { count: count ?? 0 };
    } catch (e) {
      if (e?.message?.includes('notifications') || e?.code === '42P01' || e?.code === 'PGRST205') {
        return { count: 0 };
      }
      throw e;
    }
  }
  async markRead(id, profile, token) {
    const { data, error } = await notificationsRepository.markRead(id, profile.id, token);
    if (error) throw dbError();
    if (!data) throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'The notification was not found or is already read.');
    return { read: true, id };
  }
  async markAllRead(profile, token) {
    const { data, error } = await notificationsRepository.markAllRead(profile.id, token);
    if (error) throw dbError();
    return { read: data?.length ?? 0 };
  }
}
export const notificationsService = new NotificationsService();
