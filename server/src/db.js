import mongoose from 'mongoose';
import { config } from './config.js';
import { AnalyticsEvent } from './models/AnalyticsEvent.js';

let connected = false;

export const isLegacyAnalyticsExpiryIndex = (index) => (
  Boolean(index?.key)
  && Number(index.key.createdAt) === 1
  && Object.keys(index.key).length === 1
  && Number.isFinite(Number(index.expireAfterSeconds))
);

const preserveLifetimeAnalytics = async () => {
  let indexes;
  try {
    indexes = await AnalyticsEvent.collection.indexes();
  } catch (error) {
    if (error?.code === 26 || error?.codeName === 'NamespaceNotFound') return;
    throw error;
  }
  const legacyExpiryIndexes = indexes.filter(isLegacyAnalyticsExpiryIndex);
  await Promise.all(legacyExpiryIndexes.map((index) => AnalyticsEvent.collection.dropIndex(index.name)));
};

export const connectDatabase = async () => {
  if (config.storageMode === 'memory') return { mode: 'memory' };
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongoUri, {
    // This service has no separate migration process, so startup must ensure the
    // unique and compound indexes declared by the models exist in Atlas.
    autoIndex: true,
    serverSelectionTimeoutMS: 10_000
  });
  // Older releases expired analytics after 180 days. Remove that legacy TTL
  // index so the Years and Lifetime reports can retain their full history.
  await preserveLifetimeAnalytics();
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
