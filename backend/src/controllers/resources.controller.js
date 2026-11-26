import { resourcesService } from '../services/resources.service.js';

export const resourcesController = {
  async createUploadUrl(req, res) {
    const data = await resourcesService.createUploadUrl(req.params.id, req.body, req.auth.profile, req.auth.accessToken);
    res.json({ data });
  },
  async create(req, res) {
    const data = await resourcesService.createResource(req.params.id, req.body, req.auth.profile);
    res.status(201).json({ data });
  },
  async list(req, res) {
    const result = await resourcesService.list(req.params.id, req.validated.query, req.auth.profile);
    res.json({ data: result.data, meta: result.meta });
  },
  async download(req, res) {
    const data = await resourcesService.createDownloadUrl(req.params.id, req.auth.profile, req.auth.accessToken);
    res.json({ data });
  },
  async remove(req, res) {
    const data = await resourcesService.delete(req.params.id, req.auth.profile);
    res.json({ data });
  },
};
