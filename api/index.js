import { resolveConfig } from '../server/src/config/env.js';
import { connectDatabase } from '../server/src/config/db.js';
import { createApp } from '../server/src/app.js';

resolveConfig();

const app = createApp();
let ready = null;

export default async function handler(req, res) {
  if (!ready) ready = connectDatabase();
  try {
    await ready;
  } catch (error) {
    ready = null;
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Database unavailable', message: error.message }));
    return;
  }
  app(req, res);
}
