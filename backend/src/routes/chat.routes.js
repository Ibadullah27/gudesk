import { Router } from 'express';
import { chatController } from '../controllers/chat.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { chatMessageParamsSchema } from '../schemas/chat.schemas.js';

const router = Router();
router.use(authenticate);

router.delete('/:messageId', requireRole('teacher', 'admin'), validate(chatMessageParamsSchema, 'params'), chatController.remove);

export default router;
