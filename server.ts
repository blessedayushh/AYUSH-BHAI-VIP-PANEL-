import express from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/api.js';
import { wsManager } from './server/wsServer.js';
import { backgroundWorker } from './server/worker.js';

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  // Mount API router FIRST
  app.use('/api', apiRouter);

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Initialize WebSocket server
  wsManager.init(server);

  // Start background prediction worker
  backgroundWorker.start();

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[ColorPredict Pro] Server running on port ${PORT}`);
  });
}

startServer();
