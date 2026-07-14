import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { dbStatus } from './db.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { postsRouter } from './routes/posts.js';
import { feedRouter } from './routes/feed.js';
import { searchRouter } from './routes/search.js';
import { filesRouter } from './routes/files.js';
import { uploadsRouter } from './routes/uploads.js';
import { analyticsRouter } from './routes/analytics.js';
import { AppError, errorHandler, notFound } from './utils/errors.js';
import { findUserByIdentifier, getPostById, listSitemapEntities } from './services/store.js';
import { classifyPagePath, postPath, profilePath } from './utils/publicRoutes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../../client/dist');
const indexPath = path.join(clientDist, 'index.html');
const canonicalOrigin = config.publicUrl;
const allowedOrigins = new Set([...config.clientOrigins, canonicalOrigin]);

const escapeHtml = (value) => String(value || '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const escapeXml = (value) => String(value || '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

const absoluteUrl = (value) => value
  ? new URL(value, canonicalOrigin).toString()
  : `${canonicalOrigin}/brand/mother-og.jpg`;

export const injectMetadata = (html, metadata) => {
  const safe = {
    title: escapeHtml(metadata.title),
    description: escapeHtml(metadata.description),
    url: escapeHtml(metadata.url),
    image: escapeHtml(absoluteUrl(metadata.image)),
    imageAlt: escapeHtml(metadata.imageAlt || 'Social Media Mother'),
    video: metadata.video ? escapeHtml(absoluteUrl(metadata.video)) : '',
    videoType: escapeHtml(metadata.videoType || 'video/mp4'),
    type: escapeHtml(metadata.type || 'website'),
    robots: escapeHtml(metadata.robots || 'index, follow, max-image-preview:large')
  };
  const tags = [
    `<title>${safe.title}</title>`,
    `<meta name="description" content="${safe.description}">`,
    `<meta name="robots" content="${safe.robots}">`,
    `<link rel="canonical" href="${safe.url}">`,
    '<meta property="og:site_name" content="SocialMediaMother">',
    `<meta property="og:type" content="${safe.type}">`,
    `<meta property="og:title" content="${safe.title}">`,
    `<meta property="og:description" content="${safe.description}">`,
    `<meta property="og:url" content="${safe.url}">`,
    `<meta property="og:image" content="${safe.image}">`,
    `<meta property="og:image:alt" content="${safe.imageAlt}">`,
    ...(safe.video ? [
      `<meta property="og:video" content="${safe.video}">`,
      `<meta property="og:video:secure_url" content="${safe.video}">`,
      `<meta property="og:video:type" content="${safe.videoType}">`
    ] : []),
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${safe.title}">`,
    `<meta name="twitter:description" content="${safe.description}">`,
    `<meta name="twitter:image" content="${safe.image}">`
  ].join('\n');

  const withoutExisting = html
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, '')
    .replace(/<meta\b[^>]*(?:name=["'](?:description|robots|twitter:[^"']+)["']|property=["']og:[^"']+["'])[^>]*>/gi, '');
  return withoutExisting.replace(/<\/head>/i, `${tags}\n</head>`);
};

const baseMetadata = {
  title: 'SocialMediaMother',
  description: 'A free place where anyone from anywhere can share text, photos, videos, and short videos.',
  url: `${canonicalOrigin}/`, image: '/brand/mother-og.jpg', imageAlt: 'SocialMediaMother creators hugging', type: 'website',
  robots: 'index, follow, max-image-preview:large'
};

export const metadataForRoute = async (route) => {
  if (route.kind === 'home') return baseMetadata;

  if (route.kind === 'profile') {
    const username = route.username;
    const user = /^[a-z]{1,40}$/.test(username || '') ? await findUserByIdentifier(username) : null;
    if (user?.username === username) return {
      title: `${user.fullName} (@${user.username}) | SocialMediaMother`,
      description: (user.bio || `See ${user.fullName}'s posts on Social Media Mother.`).slice(0, 240),
      url: `${canonicalOrigin}${profilePath(user.username)}`,
      image: user.profileImageFileId ? `/api/files/${user.profileImageFileId}` : '/brand/mother-og.jpg',
      imageAlt: `${user.fullName}'s profile photo`,
      type: 'profile',
      robots: 'index, follow, max-image-preview:large'
    };
  }
  if (route.kind === 'post') {
    const post = await getPostById(route.postId);
    if (post) {
      const leadingText = post.nameIt || post.text || `${post.type} post`;
      const previewImage = post.media?.find((item) => item.contentType?.startsWith('image/'));
      const previewVideo = post.media?.find((item) => item.contentType?.startsWith('video/'));
      return {
        title: `${leadingText.slice(0, 90)} — @${post.author.username} | SocialMediaMother`,
        description: (post.detail || post.text || `See this ${post.type} post on Social Media Mother.`).slice(0, 240),
        url: `${canonicalOrigin}${postPath(post.id)}`,
        image: previewImage?.fileId ? `/api/files/${previewImage.fileId}` : post.author.profileImageFileId ? `/api/files/${post.author.profileImageFileId}` : '/brand/mother-og.jpg',
        imageAlt: post.nameIt || `Post by ${post.author.fullName}`,
        video: previewVideo?.fileId ? `/api/files/${previewVideo.fileId}` : null,
        videoType: previewVideo?.contentType,
        type: 'article',
        robots: 'index, follow, max-image-preview:large'
      };
    }
  }

  if (route.kind === 'private') {
    const privateTitles = {
      createaccount: 'Create your account',
      accountin: 'Account in',
      humanbehaviour: 'Human-behaviour team',
      setting: 'Account settings',
      upload: 'Upload a post',
      'upload-format': `Upload ${String(route.format || 'post').replaceAll('-', ' ')}`
    };
    return {
      title: `${privateTitles[route.page] || 'Private page'} | SocialMediaMother`,
      description: 'A private account action on Social Media Mother.',
      url: `${canonicalOrigin}${route.path}`,
      image: '/brand/mother-og.jpg',
      imageAlt: 'SocialMediaMother creators hugging',
      type: 'website',
      robots: 'noindex, nofollow, noarchive'
    };
  }

  return {
    title: 'Page not found | SocialMediaMother',
    description: 'This Social Media Mother page could not be found.',
    url: `${canonicalOrigin}${route.path || '/'}`,
    image: '/brand/mother-og.jpg',
    imageAlt: 'SocialMediaMother creators hugging',
    type: 'website',
    robots: 'noindex, nofollow, noarchive'
  };
};

export const createApp = () => {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use((req, res, next) => {
    const supplied = String(req.get('x-request-id') || '').trim();
    req.id = /^[a-zA-Z0-9_-]{8,100}$/.test(supplied) ? supplied : crypto.randomUUID();
    res.set('X-Request-ID', req.id);
    next();
  });

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: config.isProduction ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        mediaSrc: ["'self'", 'blob:', 'https:'],
        connectSrc: ["'self'", 'https:'],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        // Render is HTTPS. Keep local production smoke tests on HTTP usable.
        upgradeInsecureRequests: config.isRender ? [] : null
      }
    } : false
  }));
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin) || (!config.isProduction && /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin))) {
        return callback(null, true);
      }
      return callback(new AppError(403, 'Origin is not allowed by CORS', 'CORS_ORIGIN_DENIED'));
    },
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86_400
  }));
  app.use(compression({
    threshold: 1024,
    filter: (req, res) => req.path.startsWith('/api/files/') ? false : compression.filter(req, res)
  }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  if (!config.isProduction) app.use(morgan('dev'));
  app.use('/api', rateLimit({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: (req) => req.path === '/health' || (req.method === 'GET' && req.path.startsWith('/files/'))
  }));

  const health = (_req, res) => {
    const database = dbStatus();
    res.status(database.ready ? 200 : 503).json({
      status: database.ready ? 'ok' : 'degraded',
      storageMode: database.mode,
      databaseReady: database.ready,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    });
  };
  app.get('/health', health);
  app.get('/api/health', health);

  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/posts', postsRouter);
  app.use('/api/feed', feedRouter);
  app.use('/api/search', searchRouter);
  app.use('/api/files', filesRouter);
  app.use('/api/uploads', uploadsRouter);
  app.use('/api/analytics', analyticsRouter);

  if (config.isProduction) {
    app.get('/robots.txt', (_req, res) => {
      res.set('Cache-Control', 'public, max-age=3600');
      res.type('text').send([
        'User-agent: *',
        'Allow: /',
        'Disallow: /api/',
        'Disallow: /createaccount',
        'Disallow: /accountin',
        'Disallow: /humanbehaviour',
        'Disallow: /*/setting',
        'Disallow: /*/upload',
        `Sitemap: ${canonicalOrigin}/sitemap.xml`,
        ''
      ].join('\n'));
    });
    app.get('/sitemap.xml', async (_req, res, next) => {
      try {
        const entries = await listSitemapEntities();
        const urls = [
          { loc: `${canonicalOrigin}/`, updatedAt: new Date() },
          ...entries.users.flatMap((user) => {
            const route = profilePath(user.username);
            return route ? [{ loc: `${canonicalOrigin}${route}`, updatedAt: user.updatedAt }] : [];
          }),
          ...entries.posts.flatMap((post) => {
            const route = postPath(post.id);
            return route ? [{ loc: `${canonicalOrigin}${route}`, updatedAt: post.updatedAt }] : [];
          })
        ];
        const body = urls.map(({ loc, updatedAt }) => {
          const date = updatedAt ? new Date(updatedAt) : null;
          const lastmod = date && !Number.isNaN(date.getTime()) ? `<lastmod>${date.toISOString()}</lastmod>` : '';
          return `<url><loc>${escapeXml(loc)}</loc>${lastmod}</url>`;
        }).join('');
        res.set('Cache-Control', 'public, max-age=3600');
        res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`);
      } catch (error) {
        next(error);
      }
    });

    const requestSearch = (req) => {
      try {
        return new URL(req.originalUrl, canonicalOrigin).search;
      } catch {
        return '';
      }
    };

    app.get('/u/:username', (req, res, next) => {
      const route = profilePath(req.params.username);
      if (!route) return next();
      return res.redirect(301, `${route}${requestSearch(req)}`);
    });

    app.get('/p/:postId', (req, res, next) => {
      const route = postPath(req.params.postId);
      if (!route) return next();
      return res.redirect(301, `${route}${requestSearch(req)}`);
    });

    const renderMetadataPage = async (req, res, next, route) => {
      try {
        const html = await fs.readFile(indexPath, 'utf8');
        const metadata = await metadataForRoute(route);
        res.set('Cache-Control', 'no-cache');
        if (metadata.robots?.startsWith('noindex')) res.set('X-Robots-Tag', metadata.robots);
        return res.type('html').send(injectMetadata(html, metadata));
      } catch (error) {
        if (error.code === 'ENOENT') return next();
        return next(error);
      }
    };

    app.use((req, res, next) => {
      if (!['GET', 'HEAD'].includes(req.method) || !req.accepts('html')) return next();
      const route = classifyPagePath(req.path);
      if (route.kind === 'unknown') return next();
      if (route.path !== req.path) return res.redirect(308, `${route.path}${requestSearch(req)}`);
      return renderMetadataPage(req, res, next, route);
    });

    app.use(express.static(clientDist, {
      index: false,
      setHeaders(res, filePath) {
        const normalized = filePath.replaceAll('\\', '/');
        if (normalized.endsWith('/index.html')) res.setHeader('Cache-Control', 'no-cache');
        else if (normalized.includes('/assets/')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        else res.setHeader('Cache-Control', 'public, max-age=86400');
      }
    }));
    app.use(async (req, res, next) => {
      if (!['GET', 'HEAD'].includes(req.method) || req.path === '/api' || req.path.startsWith('/api/') || !req.accepts('html')) return next();
      return renderMetadataPage(req, res, next, { kind: 'unknown', path: req.path });
    });
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
};
