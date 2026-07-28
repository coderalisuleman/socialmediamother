import crypto from 'node:crypto';
import fs from 'node:fs';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  CloudFrontClient,
  CreateInvalidationCommand,
} from '@aws-sdk/client-cloudfront';
import { Upload } from '@aws-sdk/lib-storage';

export const MEDIA_CACHE_CONTROL = 'public, max-age=3600, s-maxage=31536000';
export const MEDIA_MULTIPART_BYTES = 8 * 1024 * 1024;

const safeContentType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized.length <= 120 && /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(normalized)
    ? normalized
    : 'application/octet-stream';
};

const safeFilename = (value) => String(value || 'upload')
  .replace(/[\r\n"\\]/g, '_')
  .slice(0, 180);

const safeMetadata = (value, maxLength = 180) => String(value || '')
  .replace(/[^\x20-\x7e]/g, '')
  .slice(0, maxLength);

export const normalizeMediaPrefix = (value = 'media') => {
  const segments = String(value || '')
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .map((segment) => segment.replace(/[^a-zA-Z0-9_-]/g, '-'))
    .filter(Boolean);
  return segments.join('/') || 'media';
};

export const mediaObjectKey = (fileId, prefix = 'media') => {
  const id = String(fileId || '').trim().toLowerCase();
  if (!/^[a-f0-9]{24}$/.test(id)) return null;
  return `${normalizeMediaPrefix(prefix)}/${id}`;
};

const encodeFilename = (filename) => Buffer.from(safeFilename(filename), 'utf8').toString('base64url');

const decodeFilename = (value) => {
  try {
    return value ? Buffer.from(String(value), 'base64url').toString('utf8').slice(0, 180) : 'upload';
  } catch {
    return 'upload';
  }
};

const normalizeCdnBaseUrl = (value) => {
  if (!value) return '';
  const parsed = new URL(String(value).trim());
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('MEDIA_CDN_BASE_URL must use http or https');
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('MEDIA_CDN_BASE_URL cannot contain credentials, a query, or a fragment');
  }
  return parsed.toString().replace(/\/$/, '');
};

const isNotFound = (error) => (
  error?.$metadata?.httpStatusCode === 404
  || ['NotFound', 'NoSuchKey', 'NoSuchBucket'].includes(error?.name)
);

const defaultUploadFactory = (options) => new Upload(options);

export const createS3MediaStorage = ({
  client,
  bucket,
  prefix = 'media',
  cdnBaseUrl = '',
  cloudFrontClient = null,
  cloudFrontDistributionId = '',
  uploadFactory = defaultUploadFactory,
}) => {
  if (!client || typeof client.send !== 'function') throw new Error('An S3 client is required');
  if (!String(bucket || '').trim()) throw new Error('An S3 bucket is required');
  const normalizedBucket = String(bucket).trim();
  const normalizedPrefix = normalizeMediaPrefix(prefix);
  const normalizedCdnBaseUrl = normalizeCdnBaseUrl(cdnBaseUrl);
  const normalizedDistributionId = String(cloudFrontDistributionId || '').trim();
  if (normalizedCdnBaseUrl && !normalizedDistributionId) {
    throw new Error('AWS_CLOUDFRONT_DISTRIBUTION_ID is required when MEDIA_CDN_BASE_URL is configured');
  }
  if (normalizedDistributionId && !normalizedCdnBaseUrl) {
    throw new Error('MEDIA_CDN_BASE_URL is required when AWS_CLOUDFRONT_DISTRIBUTION_ID is configured');
  }
  if (normalizedDistributionId && !/^[A-Z0-9]{6,32}$/.test(normalizedDistributionId)) {
    throw new Error('AWS_CLOUDFRONT_DISTRIBUTION_ID is invalid');
  }
  if (normalizedDistributionId && (!cloudFrontClient || typeof cloudFrontClient.send !== 'function')) {
    throw new Error('A CloudFront client is required when a distribution ID is configured');
  }

  const keyFor = (fileId) => mediaObjectKey(fileId, normalizedPrefix);
  const publicUrlFor = (fileId) => {
    const key = keyFor(fileId);
    if (!normalizedCdnBaseUrl || !key) return null;
    const encodedKey = key.split('/').map(encodeURIComponent).join('/');
    return `${normalizedCdnBaseUrl}/${encodedKey}`;
  };

  return Object.freeze({
    bucket: normalizedBucket,
    prefix: normalizedPrefix,
    publicUrlFor,

    async save(file, { ownerId, purpose = 'post' } = {}) {
      if (!file?.path) throw new Error('No uploaded file path was provided');
      const fileId = crypto.randomBytes(12).toString('hex');
      const key = keyFor(fileId);
      const filename = safeFilename(file.originalname);
      const contentType = safeContentType(file.mimetype);
      const size = Number(file.size || 0);
      const body = fs.createReadStream(file.path);
      try {
        const uploader = uploadFactory({
          client,
          params: {
            Bucket: normalizedBucket,
            Key: key,
            Body: body,
            ContentLength: size,
            ContentType: contentType,
            ContentDisposition: 'inline',
            CacheControl: MEDIA_CACHE_CONTROL,
            ServerSideEncryption: 'AES256',
            Metadata: {
              filename: encodeFilename(filename),
              ownerid: safeMetadata(ownerId, 128),
              purpose: safeMetadata(purpose, 80),
            },
          },
          queueSize: 4,
          partSize: MEDIA_MULTIPART_BYTES,
          leavePartsOnError: false,
        });
        await uploader.done();
      } finally {
        body.destroy();
      }
      return {
        fileId,
        filename,
        contentType,
        size,
        url: publicUrlFor(fileId),
        storage: 's3',
      };
    },

    async head(fileId) {
      const key = keyFor(fileId);
      if (!key) return null;
      try {
        const result = await client.send(new HeadObjectCommand({
          Bucket: normalizedBucket,
          Key: key,
        }));
        return {
          id: String(fileId),
          key,
          filename: decodeFilename(result.Metadata?.filename),
          contentType: safeContentType(result.ContentType),
          size: Number(result.ContentLength || 0),
          uploadDate: result.LastModified || null,
          ownerId: result.Metadata?.ownerid || null,
          purpose: result.Metadata?.purpose || null,
          etag: result.ETag || null,
          cacheControl: result.CacheControl || MEDIA_CACHE_CONTROL,
          url: publicUrlFor(fileId),
          storage: 's3',
        };
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },

    async get(fileId, { range } = {}) {
      const key = keyFor(fileId);
      if (!key) return null;
      try {
        return await client.send(new GetObjectCommand({
          Bucket: normalizedBucket,
          Key: key,
          ...(range ? { Range: range } : {}),
        }));
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },

    async delete(fileId) {
      const key = keyFor(fileId);
      if (!key) return false;
      await client.send(new DeleteObjectCommand({
        Bucket: normalizedBucket,
        Key: key,
      }));
      if (normalizedDistributionId) {
        const url = publicUrlFor(fileId);
        const invalidationPath = new URL(url).pathname;
        await cloudFrontClient.send(new CreateInvalidationCommand({
          DistributionId: normalizedDistributionId,
          InvalidationBatch: {
            CallerReference: `media-delete-${fileId}-${Date.now()}-${crypto.randomUUID()}`,
            Paths: {
              Quantity: 1,
              Items: [invalidationPath],
            },
          },
        }));
      }
      return true;
    },
  });
};

export const createConfiguredS3MediaStorage = ({
  region,
  accessKeyId,
  secretAccessKey,
  bucket,
  prefix,
  cdnBaseUrl,
  cloudFrontDistributionId,
}) => {
  const credentials = accessKeyId && secretAccessKey
    ? { accessKeyId, secretAccessKey }
    : undefined;
  const client = new S3Client({
    region,
    ...(credentials ? { credentials } : {}),
  });
  const cloudFrontClient = cloudFrontDistributionId
    ? new CloudFrontClient({
      region: 'us-east-1',
      ...(credentials ? { credentials } : {}),
    })
    : null;
  return createS3MediaStorage({
    client,
    bucket,
    prefix,
    cdnBaseUrl,
    cloudFrontClient,
    cloudFrontDistributionId,
  });
};
