import { Router } from 'express';
import { resourcesController } from '../controllers/resources.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { resourceIdSchema } from '../schemas/resources.schemas.js';

const router = Router();
router.use(authenticate, requireRole('admin', 'teacher', 'student'));
router.get('/:id/download', validate(resourceIdSchema, 'params'), resourcesController.download);
router.delete('/:id', requireRole('teacher'), validate(resourceIdSchema, 'params'), resourcesController.remove);

export default router;
