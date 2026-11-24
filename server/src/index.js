import http from 'node:http';
import { resolveConfig, env } from './config/env.js';
import { connectDatabase } from './config/db.js';
import { createApp } from './app.js';
import { createSocketServer } from './realtime/socket.js';

async function start() {
  resolveConfig();
  await connectDatabase();

  const app = createApp();
  const httpServer = http.createServer(app);
  const io = createSocketServer(httpServer);
  app.set('io', io);

  httpServer.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `[server] port ${env.port} is already in use — another PaperTruth server is probably running.`
      );
      console.error('[server] stop it with `npm run stop`, or set a different PORT in server/.env');
      process.exit(1);
    }
    throw error;
  });

  httpServer.listen(env.port, () => {
    console.log(`[server] PaperTruth API listening on http://localhost:${env.port}`);
    console.log(`[server] expecting the client at ${env.clientUrl}`);
  });

  // closeAllConnections matters here: socket.io keep-alives would otherwise keep
  // the server open long past Ctrl+C, which is what left the port held.
  let closing = false;
  const shutdown = (signal) => {
    if (closing) process.exit(0);
    closing = true;
    console.log(`\n[server] ${signal} received — shutting down`);
    const done = () => process.exit(0);
    setTimeout(done, 1500);
    try {
      io.close();
    } catch {
      /* already closed */
    }
    httpServer.closeAllConnections?.();
    httpServer.close(done);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((error) => {
  console.error('[server] failed to start:', error.message);
  if (error.message.includes('ECONNREFUSED') || error.name === 'MongooseServerSelectionError') {
    console.error('[server] is MongoDB running? Try:  net start MongoDB   (or start mongod manually)');
  }
  process.exit(1);
});
