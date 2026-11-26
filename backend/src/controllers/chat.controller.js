import { chatService } from '../services/chat.service.js';
export const chatController = {
  async history(req, res) {
    const result = await chatService.history(req.params.id, req.validated.query.before, req.auth.profile, req.auth.accessToken);
    res.json(result);
  },
  async send(req, res) {
    res.status(201).json({ data: await chatService.send(req.params.id, req.body.body, req.auth.profile, req.auth.accessToken) });
  },
  async remove(req, res) {
    res.json({ data: await chatService.remove(req.params.messageId, req.auth.profile, req.auth.accessToken) });
  },
};
