import { Router } from 'express';
import { gradesController } from '../controllers/grades.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { gradebookQuerySchema } from '../schemas/grades.schemas.js';

const router = Router();
router.use(authenticate, requireRole('teacher'));
router.get('/courses/:id/gradebook.csv', validate(gradebookQuerySchema, 'query'), gradesController.gradebookCsv);
router.get('/courses/:id/gradebook', validate(gradebookQuerySchema, 'query'), gradesController.gradebook);
export default router;
