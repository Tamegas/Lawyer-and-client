import { createApp } from './app.js';
import { assertConfig, config } from './config.js';
import { closePool } from './db.js';

try {
  assertConfig();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const server = createApp().listen(config.port, () => {
  console.log(`HaqLink API listening on http://localhost:${config.port} (${config.env})`);
});

function shutdown() {
  server.close(async () => {
    await closePool().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
