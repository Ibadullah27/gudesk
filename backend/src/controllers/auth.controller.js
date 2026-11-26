import { authService } from '../services/auth.service.js';

export const authController = {
  async login(req, res) {
    const data = await authService.login(req.body.email, req.body.password);
    res.json({ data });
  },

  async me(req, res) {
    const data = await authService.getCurrentProfile(req.auth.user.id);
    res.json({ data });
  },

  async changePassword(req, res) {
    const data = await authService.changePassword(req.auth.user.id, req.body.newPassword);
    res.json({ data });
  },

  async forgotPassword(req, res) {
    await authService.sendPasswordReset(req.body.email);
    res.json({ data: { message: 'If an account exists for that email, password reset instructions have been sent.' } });
  },
};
