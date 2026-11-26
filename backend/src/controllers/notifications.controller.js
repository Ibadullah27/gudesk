import { notificationsService } from '../services/notifications.service.js';
export const notificationsController = {
  async list(req, res) { res.json(await notificationsService.list(req.validated.query, req.auth.profile, req.auth.accessToken)); },
  async unreadCount(req, res) { res.json({ data: await notificationsService.unreadCount(req.auth.profile, req.auth.accessToken) }); },
  async markRead(req, res) { res.json({ data: await notificationsService.markRead(req.params.id, req.auth.profile, req.auth.accessToken) }); },
  async markAllRead(req, res) { res.json({ data: await notificationsService.markAllRead(req.auth.profile, req.auth.accessToken) }); },
};
