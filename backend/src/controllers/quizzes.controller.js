import { quizzesService } from '../services/quizzes.service.js';
export const quizzesController = {
  async list(req, res) { const result = await quizzesService.list(req.params.id, req.validated.query, req.auth.profile); res.json(result); },
  async create(req, res) { res.status(201).json({ data: await quizzesService.create(req.params.id, req.body, req.auth.profile) }); },
  async questions(req, res) { res.json({ data: await quizzesService.saveQuestions(req.params.id, req.body.questions, req.auth.profile, req.auth.accessToken) }); },
  async getQuestions(req, res) { res.json({ data: await quizzesService.getQuestions(req.params.id, req.auth.profile) }); },
  async publish(req, res) { res.json({ data: await quizzesService.publish(req.params.id, req.body.is_published, req.auth.profile) }); },
  async start(req, res) { res.status(201).json({ data: await quizzesService.start(req.params.id, req.auth.profile, req.auth.accessToken) }); },
  async save(req, res) { res.json({ data: await quizzesService.attempt(req.params.id, req.body.answers, req.auth.profile, req.auth.accessToken) }); },
  async submit(req, res) { res.json({ data: await quizzesService.submit(req.params.id, req.auth.profile, req.auth.accessToken) }); },
  async results(req, res) { res.json(await quizzesService.results(req.params.id, req.validated.query, req.auth.profile)); },
};
