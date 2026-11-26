// Vercel serverless entry: every request is routed here (see backend/vercel.json).
// Local development still uses src/index.js, which calls app.listen().
import { app } from '../src/app.js';

export default app;
