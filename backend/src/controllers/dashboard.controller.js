import { dashboardService } from '../services/dashboard.service.js';
export const dashboardController = { async get(req, res) { res.json({ data: await dashboardService.get(req.auth.profile) }); } };
