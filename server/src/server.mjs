import { createApp } from './app.mjs';
import { configFromEnv } from './config.mjs';
const env = process.env;
process.umask(0o077);
const { server, store } = createApp(configFromEnv());
server.listen(Number(env.PORT || 8080), env.HOST || '127.0.0.1', () => console.log('Raabta API ready'));
let closing = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  if (closing) return;
  closing = true;
  const timer = setTimeout(() => { server.closeAllConnections(); process.exit(1); }, 65000);
  timer.unref();
  server.close(() => { store.close(); clearTimeout(timer); process.exit(0); });
});
