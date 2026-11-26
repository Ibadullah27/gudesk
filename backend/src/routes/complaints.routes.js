import { Router } from 'express';
import { complaintsController } from '../controllers/complaints.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { complaintIdSchema, complaintListSchema, createComplaintSchema, updateComplaintSchema } from '../schemas/complaints.schemas.js';

const router = Router();
router.use(authenticate, requireRole('student', 'teacher', 'admin'));
router.post('/', requireRole('student', 'teacher'), validate(createComplaintSchema), complaintsController.create);
router.get('/mine', requireRole('student', 'teacher'), validate(complaintListSchema, 'query'), complaintsController.mine);
router.get('/', requireRole('admin'), validate(complaintListSchema, 'query'), complaintsController.list);
router.patch('/:id', requireRole('admin'), validate(complaintIdSchema, 'params'), validate(updateComplaintSchema), complaintsController.update);
export default router;
