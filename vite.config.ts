import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import { apiRouter } from './server/api.ts';
import { wsManager } from './server/wsServer.ts';
import { backgroundWorker } from './server/worker.ts';

function serverApiPlugin(): Plugin {
  return {
    name: 'server-api-plugin',
    configureServer(server) {
      server.middlewares.use('/api', apiRouter);
      if (server.httpServer) {
        wsManager.init(server.httpServer);
      }
      backgroundWorker.start();
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), serverApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
