import { announcementsService } from '../services/announcements.service.js';
export const announcementsController = {
  async list(req, res) { res.json(await announcementsService.list(req.validated.query, req.auth.profile, req.auth.accessToken)); },
  async create(req, res) { res.status(201).json({ data: await announcementsService.create(req.body, req.auth.profile, req.auth.accessToken) }); },
  async update(req, res) { res.json({ data: await announcementsService.update(req.params.id, req.body, req.auth.profile, req.auth.accessToken) }); },
  async delete(req, res) { res.json({ data: await announcementsService.delete(req.params.id, req.auth.profile, req.auth.accessToken) }); },
};
