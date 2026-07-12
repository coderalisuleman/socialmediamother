import mongoose from 'mongoose';
import { config } from './config.js';

let connected = false;

export const connectDatabase = async () => {
  if (config.storageMode === 'memory') return { mode: 'memory' };
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongoUri, {
    // This service has no separate migration process, so startup must ensure the
    // unique, compound, and TTL indexes declared by the models exist in Atlas.
    autoIndex: true,
    serverSelectionTimeoutMS: 10_000
  });
  connected = true;
  return { mode: 'mongodb', host: mongoose.connection.host, database: mongoose.connection.name };
};

export const disconnectDatabase = async () => {
  if (connected) await mongoose.disconnect();
  connected = false;
};

export const dbStatus = () => ({
  mode: config.storageMode,
  ready: config.storageMode === 'memory' || mongoose.connection.readyState === 1
});

export const mongoConnection = () => mongoose.connection;
