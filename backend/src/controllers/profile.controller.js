import { profileService } from '../services/profile.service.js';
import { authService } from '../services/auth.service.js';
export const profileController = {
  async view(req, res) { res.json({ data: await profileService.view(req.auth.profile, req.auth.accessToken) }); },
  async update(req, res) { res.json({ data: await profileService.update(req.body, req.auth.profile, req.auth.accessToken) }); },
  async uploadUrl(req, res) { res.json({ data: await profileService.avatarUpload(req.body, req.auth.profile, req.auth.accessToken) }); },
  async saveAvatar(req, res) { res.json({ data: await profileService.saveAvatar(req.body.file_path, req.auth.profile, req.auth.accessToken) }); },
  async removeAvatar(req, res) { res.json({ data: await profileService.removeAvatar(req.auth.profile, req.auth.accessToken) }); },
  async changePassword(req, res) { res.json({ data: await authService.changeOwnPassword(req.auth.profile, req.body.currentPassword, req.body.newPassword) }); },
};
