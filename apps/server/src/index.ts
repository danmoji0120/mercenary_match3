import 'dotenv/config';
import { createMercenaryServer, parsePort, SERVER_HOST } from './server.js';

process.env.NODE_ENV ??= 'production';
const port = parsePort(process.env.PORT);
const service = createMercenaryServer({ environment: process.env.NODE_ENV });

service.httpServer.listen(port, SERVER_HOST, () => {
  const address = service.httpServer.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;
  console.log(`[mercenary-match3] environment=${service.environment} port=${actualPort} staticClient=${service.clientReady} clientDist=${service.clientDistPath} debug=${!service.production}`);
});

let signalHandled = false;
async function handleSignal(signal: NodeJS.Signals) {
  if (signalHandled) return;
  signalHandled = true; console.log(`[mercenary-match3] received ${signal}; shutting down`);
  const forcedExit = setTimeout(() => process.exit(1), 7_000); forcedExit.unref?.();
  await service.shutdown(); clearTimeout(forcedExit); process.exitCode = 0;
}

process.on('SIGTERM', () => void handleSignal('SIGTERM'));
process.on('SIGINT', () => void handleSignal('SIGINT'));
