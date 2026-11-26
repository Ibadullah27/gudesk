import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { changePasswordSchema, forgotPasswordSchema, loginSchema } from '../schemas/auth.schemas.js';

const router = Router();
const authRateLimit = (limit, windowMs) => rateLimit({
  windowMs,
  limit,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({
    error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again later.', details: [] },
  }),
});

router.post('/login', authRateLimit(10, 15 * 60 * 1000), validate(loginSchema), authController.login);
router.post('/forgot-password', authRateLimit(5, 60 * 60 * 1000), validate(forgotPasswordSchema), authController.forgotPassword);
router.get('/me', authenticate, authController.me);
router.post('/change-password', authenticate, validate(changePasswordSchema), authController.changePassword);

export default router;
