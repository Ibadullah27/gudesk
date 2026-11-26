import { enrollmentsService } from '../services/enrollments.service.js';

export const enrollmentsController = {
  async listStudents(req, res) {
    const result = await enrollmentsService.listStudents(req.params.id, req.validated.query, req.auth.profile);
    res.json({ data: result.data, meta: result.meta });
  },
  async enrollStudents(req, res) {
    const data = await enrollmentsService.enrollStudents(req.params.id, req.body.student_ids, req.auth.profile);
    res.json({ data });
  },
  async bulkEnroll(req, res) {
    const data = await enrollmentsService.bulkEnroll(req.params.id, req.body.csv, req.auth.profile);
    res.json({ data });
  },
  async removeStudent(req, res) {
    const data = await enrollmentsService.removeStudent(req.params.id, req.params.studentId, req.auth.profile);
    res.json({ data });
  },
};
