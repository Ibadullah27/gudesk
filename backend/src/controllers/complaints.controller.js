import { complaintsService } from '../services/complaints.service.js';
export const complaintsController = {
  async create(req, res) { res.status(201).json({ data: await complaintsService.create(req.body, req.auth.profile, req.auth.accessToken) }); },
  async mine(req, res) { res.json(await complaintsService.mine(req.validated.query, req.auth.profile, req.auth.accessToken)); },
  async list(req, res) { res.json(await complaintsService.adminList(req.validated.query, req.auth.profile, req.auth.accessToken)); },
  async update(req, res) { res.json({ data: await complaintsService.update(req.params.id, req.body, req.auth.profile, req.auth.accessToken) }); },
};
