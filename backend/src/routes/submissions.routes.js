import { Router } from 'express';
import { assignmentsController } from '../controllers/assignments.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { assignmentIdSchema } from '../schemas/assignments.schemas.js';
import { submissionIdSchema, gradeSubmissionSchema } from '../schemas/grades.schemas.js';
import { gradesController } from '../controllers/grades.controller.js';

const router = Router();
router.use(authenticate, requireRole('teacher', 'student'));
router.get('/:id/download', validate(assignmentIdSchema, 'params'), assignmentsController.downloadSubmission);
router.patch('/:id/grade', requireRole('teacher'), validate(submissionIdSchema, 'params'), validate(gradeSubmissionSchema), gradesController.grade);

export default router;
