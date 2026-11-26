import { Router } from 'express';
import { announcementsController } from '../controllers/announcements.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { announcementIdSchema, announcementListSchema, createAnnouncementSchema, updateAnnouncementSchema } from '../schemas/announcements.schemas.js';

const router = Router();
router.use(authenticate, requireRole('admin', 'teacher', 'student'));
router.get('/', validate(announcementListSchema, 'query'), announcementsController.list);
router.post('/', requireRole('admin', 'teacher'), validate(createAnnouncementSchema), announcementsController.create);
router.patch('/:id', requireRole('admin', 'teacher'), validate(announcementIdSchema, 'params'), validate(updateAnnouncementSchema), announcementsController.update);
router.delete('/:id', requireRole('admin', 'teacher'), validate(announcementIdSchema, 'params'), announcementsController.delete);
export default router;
