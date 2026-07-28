import dns from 'node:dns/promises';
import mongoose from 'mongoose';
import { config } from './config.js';
import { AnalyticsEvent } from './models/AnalyticsEvent.js';

let connected = false;

export const resolveMongoSrvSeedUri = async (
  mongoUri,
  { resolveSrv = dns.resolveSrv } = {}
) => {
  if (!String(mongoUri || '').startsWith('mongodb+srv://')) return mongoUri;

  const parsed = new URL(mongoUri.replace('mongodb+srv://', 'https://'));
  const records = await resolveSrv(`_mongodb._tcp.${parsed.hostname}`);
  if (!records.length) throw new Error('MongoDB SRV lookup returned no database hosts');

  const hosts = records
    .sort((left, right) => left.priority - right.priority)
    .map((record) => `${String(record.name).replace(/\.$/, '')}:${record.port}`)
    .join(',');
  const database = parsed.pathname.replace(/^\/+/, '');
  const options = new URLSearchParams(parsed.search);
  options.set('tls', 'true');
  if (!options.has('authSource')) options.set('authSource', 'admin');
  const credentials = parsed.username
    ? `${parsed.username}${parsed.password ? `:${parsed.password}` : ''}@`
    : '';

  return `mongodb://${credentials}${hosts}/${database}?${options}`;
};

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
  // Some Windows DNS resolvers answer Atlas SRV requests but time out on the
  // companion TXT request. Resolve the same private Atlas seed hosts ourselves
  // during local development so `npm run dev` can start without hanging.
  const connectionUri = !config.isProduction && config.mongoUri.startsWith('mongodb+srv://')
    ? await resolveMongoSrvSeedUri(config.mongoUri)
    : config.mongoUri;
  await mongoose.connect(connectionUri, {
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
