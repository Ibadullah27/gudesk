import { Router } from 'express';
import { notificationsController } from '../controllers/notifications.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { notificationIdSchema, notificationListSchema } from '../schemas/notifications.schemas.js';

const router = Router();
router.use(authenticate, requireRole('admin', 'teacher', 'student'));
router.get('/', validate(notificationListSchema, 'query'), notificationsController.list);
router.get('/unread-count', notificationsController.unreadCount);
router.patch('/:id/read', validate(notificationIdSchema, 'params'), notificationsController.markRead);
router.post('/read-all', notificationsController.markAllRead);
export default router;
