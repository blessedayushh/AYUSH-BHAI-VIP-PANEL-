import express from 'express';
import { apiRouter } from '../server/api.js';

const app = express();
app.use(express.json({ limit: '10mb' }));

// Mount both with and without /api prefix for maximum compatibility across Vercel configurations
app.use('/api', apiRouter);
app.use(apiRouter);

export default app;
