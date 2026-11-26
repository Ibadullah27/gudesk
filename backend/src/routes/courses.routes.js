import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { coursesController } from '../controllers/courses.controller.js';
import { enrollmentsController } from '../controllers/enrollments.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { resourcesController } from '../controllers/resources.controller.js';
import { assignmentsController } from '../controllers/assignments.controller.js';
import { gradesController } from '../controllers/grades.controller.js';
import { quizzesController } from '../controllers/quizzes.controller.js';
import { chatController } from '../controllers/chat.controller.js';
import { gradebookQuerySchema } from '../schemas/grades.schemas.js';
import { createResourceSchema, resourceUploadUrlSchema, resourcesQuerySchema } from '../schemas/resources.schemas.js';
import { assignmentListQuerySchema, courseIdSchema as assignmentCourseIdSchema, createAssignmentSchema } from '../schemas/assignments.schemas.js';
import { createQuizSchema, listQuizzesQuerySchema, quizIdSchema } from '../schemas/quizzes.schemas.js';
import { chatHistoryQuerySchema, courseChatParamsSchema, createChatMessageSchema } from '../schemas/chat.schemas.js';
import {
  bulkEnrollSchema,
  courseIdSchema,
  courseSchema,
  courseStudentsQuerySchema,
  enrollStudentsSchema,
  enrollmentParamsSchema,
  listCoursesSchema,
  updateCourseSchema,
} from '../schemas/admin.schemas.js';

const router = Router();
router.use(authenticate, requireRole('admin', 'teacher', 'student'));

const sendLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => req.auth.profile.id,
  handler: (_req, res) => res.status(429).json({ error: { code: 'CHAT_RATE_LIMITED', message: 'You are sending messages too quickly. Please wait a moment.', details: [] } }),
});

router.get('/', validate(listCoursesSchema, 'query'), coursesController.list);
router.get('/teachers', requireRole('admin'), coursesController.teachers);
router.post('/', requireRole('admin'), validate(courseSchema), coursesController.create);
router.patch('/:id', requireRole('admin'), validate(courseIdSchema, 'params'), validate(updateCourseSchema), coursesController.update);
router.get('/:id/students', requireRole('admin', 'teacher'), validate(courseIdSchema, 'params'), validate(courseStudentsQuerySchema, 'query'), enrollmentsController.listStudents);
router.post('/:id/enroll/bulk', requireRole('admin', 'teacher'), validate(courseIdSchema, 'params'), validate(bulkEnrollSchema), enrollmentsController.bulkEnroll);
router.post('/:id/enroll', requireRole('admin', 'teacher'), validate(courseIdSchema, 'params'), validate(enrollStudentsSchema), enrollmentsController.enrollStudents);
router.delete('/:id/enroll/:studentId', requireRole('admin', 'teacher'), validate(enrollmentParamsSchema, 'params'), enrollmentsController.removeStudent);
router.post('/:id/resources/upload-url', requireRole('teacher'), validate(courseIdSchema, 'params'), validate(resourceUploadUrlSchema), resourcesController.createUploadUrl);
router.post('/:id/resources', requireRole('teacher'), validate(courseIdSchema, 'params'), validate(createResourceSchema), resourcesController.create);
router.get('/:id/resources', validate(courseIdSchema, 'params'), validate(resourcesQuerySchema, 'query'), resourcesController.list);
router.get('/:id/assignments', requireRole('teacher', 'student'), validate(assignmentCourseIdSchema, 'params'), validate(assignmentListQuerySchema, 'query'), assignmentsController.listForCourse);
router.post('/:id/assignments', requireRole('teacher'), validate(assignmentCourseIdSchema, 'params'), validate(createAssignmentSchema), assignmentsController.createForCourse);
router.get('/:id/gradebook.csv', requireRole('teacher'), validate(courseIdSchema, 'params'), validate(gradebookQuerySchema, 'query'), gradesController.gradebookCsv);
router.get('/:id/gradebook', requireRole('teacher'), validate(courseIdSchema, 'params'), validate(gradebookQuerySchema, 'query'), gradesController.gradebook);
router.get('/:id/quizzes', validate(quizIdSchema, 'params'), validate(listQuizzesQuerySchema, 'query'), quizzesController.list);
router.post('/:id/quizzes', requireRole('teacher'), validate(quizIdSchema, 'params'), validate(createQuizSchema), quizzesController.create);
router.get('/:id/chat', validate(courseChatParamsSchema, 'params'), validate(chatHistoryQuerySchema, 'query'), chatController.history);
router.post('/:id/chat', requireRole('teacher', 'student'), sendLimiter, validate(courseChatParamsSchema, 'params'), validate(createChatMessageSchema), chatController.send);

export default router;
