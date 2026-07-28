import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import {
  createS3MediaStorage,
  MEDIA_CACHE_CONTROL,
  MEDIA_MULTIPART_BYTES,
  mediaObjectKey,
  normalizeMediaPrefix,
} from './s3MediaStorage.js';
import { resolveS3Region } from '../config.js';

test('S3 media uploads stream through multipart storage with private edge-cached objects', async () => {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'mother-s3-test-'));
  const filePath = path.join(temporaryDirectory, 'video.mp4');
  const source = Buffer.from('streamed media body');
  await fs.writeFile(filePath, source);
  let uploadOptions;
  let uploadedBody;

  const storage = createS3MediaStorage({
    client: { send: async () => { throw new Error('Unexpected direct S3 request'); } },
    bucket: 'private-media-bucket',
    prefix: '/posts/public/',
    cdnBaseUrl: 'https://media.example.com/',
    cloudFrontDistributionId: 'E123EXAMPLE',
    cloudFrontClient: { send: async () => ({}) },
    uploadFactory(options) {
      uploadOptions = options;
      return {
        async done() {
          const chunks = [];
          for await (const chunk of options.params.Body) chunks.push(chunk);
          uploadedBody = Buffer.concat(chunks);
        },
      };
    },
  });

  try {
    const saved = await storage.save({
      path: filePath,
      originalname: 'A safe video.mp4',
      mimetype: 'video/mp4',
      size: source.length,
    }, { ownerId: 'owner-123', purpose: 'post' });

    assert.match(saved.fileId, /^[a-f0-9]{24}$/);
    assert.equal(saved.url, `https://media.example.com/posts/public/${saved.fileId}`);
    assert.deepEqual(uploadedBody, source);
    assert.equal(uploadOptions.params.Bucket, 'private-media-bucket');
    assert.equal(uploadOptions.params.Key, `posts/public/${saved.fileId}`);
    assert.equal(uploadOptions.params.ContentType, 'video/mp4');
    assert.equal(uploadOptions.params.ContentLength, source.length);
    assert.equal(uploadOptions.params.ContentDisposition, 'inline');
    assert.equal(MEDIA_CACHE_CONTROL, 'public, max-age=3600, s-maxage=31536000');
    assert.equal(uploadOptions.params.CacheControl, MEDIA_CACHE_CONTROL);
    assert.equal(uploadOptions.params.ServerSideEncryption, 'AES256');
    assert.equal(uploadOptions.params.ACL, undefined);
    assert.equal(uploadOptions.partSize, MEDIA_MULTIPART_BYTES);
    assert.equal(uploadOptions.queueSize, 4);
    assert.equal(uploadOptions.leavePartsOnError, false);
    assert.equal(uploadOptions.params.Metadata.ownerid, 'owner-123');
    assert.equal(uploadOptions.params.Metadata.purpose, 'post');
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test('S3 media metadata, range reads, CDN URLs, and deletion use one safe object key', async () => {
  const commands = [];
  const invalidations = [];
  const deletionOrder = [];
  const filename = 'clip name.webm';
  const client = {
    async send(command) {
      commands.push(command);
      if (command instanceof HeadObjectCommand) {
        return {
          ContentLength: 42,
          ContentType: 'video/webm',
          CacheControl: MEDIA_CACHE_CONTROL,
          ETag: '"etag"',
          LastModified: new Date('2026-07-28T10:00:00.000Z'),
          Metadata: {
            filename: Buffer.from(filename).toString('base64url'),
            ownerid: 'owner-456',
            purpose: 'post',
          },
        };
      }
      if (command instanceof GetObjectCommand) return { Body: 'body' };
      if (command instanceof DeleteObjectCommand) {
        deletionOrder.push('s3-delete');
        return {};
      }
      throw new Error('Unexpected S3 command');
    },
  };
  const storage = createS3MediaStorage({
    client,
    bucket: 'private-media-bucket',
    prefix: 'media',
    cdnBaseUrl: 'https://cdn.example.com/content',
    cloudFrontDistributionId: 'E123EXAMPLE',
    cloudFrontClient: {
      async send(command) {
        deletionOrder.push('cloudfront-invalidate');
        invalidations.push(command);
        return { Invalidation: { Id: 'I123' } };
      },
    },
  });
  const fileId = '0123456789abcdef01234567';

  const info = await storage.head(fileId);
  assert.equal(info.filename, filename);
  assert.equal(info.contentType, 'video/webm');
  assert.equal(info.size, 42);
  assert.equal(info.storage, 's3');
  assert.equal(info.url, `https://cdn.example.com/content/media/${fileId}`);

  await storage.get(fileId, { range: 'bytes=10-20' });
  await storage.delete(fileId);

  assert.deepEqual(commands.map((command) => command.constructor.name), [
    'HeadObjectCommand',
    'GetObjectCommand',
    'DeleteObjectCommand',
  ]);
  assert.equal(commands[1].input.Range, 'bytes=10-20');
  assert.equal(commands[2].input.Key, `media/${fileId}`);
  assert.equal(invalidations.length, 1);
  assert.ok(invalidations[0] instanceof CreateInvalidationCommand);
  assert.equal(invalidations[0].input.DistributionId, 'E123EXAMPLE');
  assert.deepEqual(invalidations[0].input.InvalidationBatch.Paths, {
    Quantity: 1,
    Items: [`/content/media/${fileId}`],
  });
  assert.match(
    invalidations[0].input.InvalidationBatch.CallerReference,
    new RegExp(`^media-delete-${fileId}-\\d+-[a-f0-9-]{36}$`),
  );
  assert.deepEqual(deletionOrder, ['s3-delete', 'cloudfront-invalidate']);
});

test('S3 media storage rejects unsafe IDs, normalizes prefixes, and treats missing objects as absent', async () => {
  const client = {
    async send() {
      const error = new Error('missing');
      error.name = 'NotFound';
      error.$metadata = { httpStatusCode: 404 };
      throw error;
    },
  };
  const storage = createS3MediaStorage({
    client,
    bucket: 'private-media-bucket',
    prefix: '../../post uploads/../public',
  });

  assert.equal(normalizeMediaPrefix('../../post uploads/../public'), 'post-uploads/public');
  assert.equal(mediaObjectKey('../unsafe', 'media'), null);
  assert.equal(await storage.head('0123456789abcdef01234567'), null);
  assert.equal(await storage.head('../unsafe'), null);
  assert.equal(await storage.delete('../unsafe'), false);
});

test('S3 can use a dedicated region without changing the SES and SNS region', () => {
  assert.equal(resolveS3Region({
    AWS_REGION: 'us-east-1',
    AWS_S3_REGION: 'ap-southeast-1',
  }), 'ap-southeast-1');
  assert.equal(resolveS3Region({ AWS_REGION: 'us-east-1' }), 'us-east-1');
});

test('a CDN URL cannot be enabled without deletion invalidation configuration', () => {
  assert.throws(() => createS3MediaStorage({
    client: { send: async () => ({}) },
    bucket: 'private-media-bucket',
    cdnBaseUrl: 'https://cdn.example.com',
  }), /AWS_CLOUDFRONT_DISTRIBUTION_ID/);
});
