import { config } from './config.js';
import { connectDatabase, disconnectDatabase } from './db.js';
import { createApp } from './app.js';
import { ensurePublicDemoAccount } from './services/publicDemoAccount.js';

const database = await connectDatabase();
const demoAccount = await ensurePublicDemoAccount();
const app = createApp();
const server = app.listen(config.port, config.host, () => {
  console.log(`Social Media Mother API listening on http://${config.host}:${config.port} (${database.mode})`);
  console.log(`Public demo account ${demoAccount.created ? 'created' : 'available'} as @${demoAccount.username}`);
});

const shutdown = async (signal) => {
  console.log(`${signal} received; closing server`);
  server.close(async () => {
    await disconnectDatabase();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection', error);
});
