import { assignmentsService } from '../services/assignments.service.js';

export const assignmentsController = {
  async listForCourse(req, res) {
    const result = await assignmentsService.list(req.params.id, req.validated.query, req.auth.profile);
    res.json({ data: result.data, meta: result.meta });
  },
  async createForCourse(req, res) {
    const data = await assignmentsService.create(req.params.id, req.body, req.auth.profile);
    res.status(201).json({ data });
  },
  async update(req, res) {
    const data = await assignmentsService.update(req.params.id, req.body, req.auth.profile);
    res.json({ data });
  },
  async remove(req, res) {
    const data = await assignmentsService.delete(req.params.id, req.validated.query.confirm === 'true', req.auth.profile);
    res.json({ data });
  },
  async createAttachmentUploadUrl(req, res) {
    const data = await assignmentsService.createAssignmentUploadUrl(req.params.id, req.body, req.auth.profile, req.auth.accessToken);
    res.json({ data });
  },
  async createSubmissionUploadUrl(req, res) {
    const data = await assignmentsService.createSubmissionUploadUrl(req.params.id, req.body, req.auth.profile, req.auth.accessToken);
    res.json({ data });
  },
  async submit(req, res) {
    const data = await assignmentsService.submit(req.params.id, req.body, req.auth.profile, req.auth.accessToken);
    res.json({ data });
  },
  async mySubmission(req, res) {
    res.json({ data: await assignmentsService.mySubmission(req.params.id, req.auth.profile) });
  },
  async submissions(req, res) {
    const result = await assignmentsService.submissions(req.params.id, req.validated.query, req.auth.profile);
    res.json({ data: result.data, meta: result.meta });
  },
  async downloadAttachment(req, res) {
    const data = await assignmentsService.downloadAssignmentAttachment(req.params.id, req.auth.profile, req.auth.accessToken);
    res.json({ data });
  },
  async downloadSubmission(req, res) {
    const data = await assignmentsService.downloadSubmission(req.params.id, req.auth.profile, req.auth.accessToken);
    res.json({ data });
  },
};
