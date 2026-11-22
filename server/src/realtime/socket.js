import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { verifyToken } from '../middleware/auth.js';

export { emitSubmissionReceived } from './emit.js';

export function createSocketServer(httpServer, { logger = console } = {}) {
  const io = new Server(httpServer, {
    cors: { origin: env.clientUrl.split(',').map((o) => o.trim()).filter(Boolean), methods: ['GET', 'POST'], credentials: true }
  });

  io.on('connection', (socket) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        socket.data.auth = verifyToken(token);
      } catch {
        socket.data.auth = null;
      }
    }

    socket.on('exam:watch', (examId) => {
      if (typeof examId !== 'string' || examId.length < 8) return;
      socket.join(`exam:${examId}`);
      socket.emit('exam:watching', { examId });
    });

    socket.on('exam:unwatch', (examId) => {
      if (typeof examId === 'string') socket.leave(`exam:${examId}`);
    });
  });

  logger.log('[socket] realtime server ready');
  return io;
}

export default createSocketServer;
