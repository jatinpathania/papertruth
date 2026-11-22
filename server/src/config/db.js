import mongoose from 'mongoose';
import { env } from './env.js';

// Reused across serverless invocations so a warm container does not reconnect.
let pending = null;

export async function connectDatabase(uri = env.mongoUri, { logger = console } = {}) {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (pending) return pending;

  mongoose.set('strictQuery', true);
  pending = mongoose
    .connect(uri, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: Number(process.env.MONGO_POOL_SIZE || 5)
    })
    .then((connection) => {
      logger.log(`[db] connected to ${mongoose.connection.name}`);
      return connection.connection;
    })
    .catch((error) => {
      pending = null;
      throw error;
    });

  return pending;
}

export async function disconnectDatabase() {
  pending = null;
  await mongoose.connection.close();
}

export default connectDatabase;
