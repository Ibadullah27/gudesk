import { Router } from 'express';
import { assignmentsController } from '../controllers/assignments.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import {
  assignmentFileSchema,
  assignmentIdSchema,
  assignmentListQuerySchema,
  deleteAssignmentQuerySchema,
  submissionsQuerySchema,
  submissionSchema,
  updateAssignmentSchema,
} from '../schemas/assignments.schemas.js';

const router = Router();
router.use(authenticate, requireRole('teacher', 'student'));
router.patch('/:id', requireRole('teacher'), validate(assignmentIdSchema, 'params'), validate(updateAssignmentSchema), assignmentsController.update);
router.delete('/:id', requireRole('teacher'), validate(assignmentIdSchema, 'params'), validate(deleteAssignmentQuerySchema, 'query'), assignmentsController.remove);
router.post('/:id/attachment/upload-url', requireRole('teacher'), validate(assignmentIdSchema, 'params'), validate(assignmentFileSchema), assignmentsController.createAttachmentUploadUrl);
router.get('/:id/attachment/download', validate(assignmentIdSchema, 'params'), assignmentsController.downloadAttachment);
router.post('/:id/submission/upload-url', requireRole('student'), validate(assignmentIdSchema, 'params'), validate(assignmentFileSchema), assignmentsController.createSubmissionUploadUrl);
router.post('/:id/submit', requireRole('student'), validate(assignmentIdSchema, 'params'), validate(submissionSchema), assignmentsController.submit);
router.get('/:id/my-submission', requireRole('student'), validate(assignmentIdSchema, 'params'), assignmentsController.mySubmission);
router.get('/:id/submissions', requireRole('teacher'), validate(assignmentIdSchema, 'params'), validate(submissionsQuerySchema, 'query'), assignmentsController.submissions);

export default router;
