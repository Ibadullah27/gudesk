import { adminService } from '../services/admin.service.js';

export const adminController = {
  async listUsers(req, res) {
    const result = await adminService.listUsers(req.validated.query);
    res.json({ data: result.data, meta: result.meta });
  },
  async createUser(req, res) {
    const data = await adminService.createUser(req.body);
    res.status(201).json({ data });
  },
  async updateUser(req, res) {
    const data = await adminService.updateUser(req.params.id, req.body, req.auth.profile.id);
    res.json({ data });
  },
  async resetPassword(req, res) {
    const data = await adminService.resetUserPassword(req.params.id);
    res.json({ data });
  },
  async bulkUsers(req, res) {
    const data = await adminService.bulkCreate(req.body.csv);
    res.status(data.created ? 201 : 200).json({ data });
  },
};
