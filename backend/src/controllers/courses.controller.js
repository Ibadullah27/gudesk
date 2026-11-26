import { adminService } from '../services/admin.service.js';

export const coursesController = {
  async list(req, res) {
    const result = await adminService.listCourses(req.validated.query, req.auth.profile);
    res.json({ data: result.data, meta: result.meta });
  },
  async teachers(_req, res) {
    res.json({ data: await adminService.listTeachers() });
  },
  async create(req, res) {
    res.status(201).json({ data: await adminService.saveCourse(req.body) });
  },
  async update(req, res) {
    res.json({ data: await adminService.saveCourse(req.body, req.params.id) });
  },
};
