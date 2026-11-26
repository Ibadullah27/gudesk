import { Router } from 'express';
import { adminController } from '../controllers/admin.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { bulkUsersSchema, createUserSchema, listUsersSchema, updateUserSchema, userIdSchema } from '../schemas/admin.schemas.js';

const router = Router();
router.use(authenticate, requireRole('admin'));
router.get('/users', validate(listUsersSchema, 'query'), adminController.listUsers);
router.post('/users', validate(createUserSchema), adminController.createUser);
router.post('/users/bulk', validate(bulkUsersSchema), adminController.bulkUsers);
router.patch('/users/:id', validate(userIdSchema, 'params'), validate(updateUserSchema), adminController.updateUser);
router.post('/users/:id/reset-password', validate(userIdSchema, 'params'), adminController.resetPassword);

export default router;
