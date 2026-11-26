import { Router } from 'express';
import { quizzesController } from '../controllers/quizzes.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { publishQuizSchema, questionsSchema, quizAnswersSchema, quizIdSchema, quizResultsQuerySchema } from '../schemas/quizzes.schemas.js';

const router = Router();
router.use(authenticate);

router.get('/:id/questions', requireRole('teacher'), validate(quizIdSchema, 'params'), quizzesController.getQuestions);
router.put('/:id/questions', requireRole('teacher'), validate(quizIdSchema, 'params'), validate(questionsSchema), quizzesController.questions);
router.patch('/:id/publish', requireRole('teacher'), validate(quizIdSchema, 'params'), validate(publishQuizSchema), quizzesController.publish);
router.post('/:id/start', requireRole('student'), validate(quizIdSchema, 'params'), quizzesController.start);
router.patch('/:id/attempt', requireRole('student'), validate(quizIdSchema, 'params'), validate(quizAnswersSchema), quizzesController.save);
router.post('/:id/submit', requireRole('student'), validate(quizIdSchema, 'params'), quizzesController.submit);
router.get('/:id/results', requireRole('teacher'), validate(quizIdSchema, 'params'), validate(quizResultsQuerySchema, 'query'), quizzesController.results);

export default router;
