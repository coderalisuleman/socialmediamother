# Social Media Mother API

Node/Express API with MongoDB/Mongoose and GridFS. If `MONGODB_URI` is blank in development, it starts an in-memory demo store with the exact same HTTP contract. Production refuses to start without MongoDB and a strong JWT secret.

The HTTP server uses Render's `PORT` value and explicitly binds to `HOST=0.0.0.0`, so the service is reachable outside its container. Local development uses port `5000` unless overridden.

## Start

```sh
cd server
npm install
cp .env.example .env
npm run dev
```

Demo accounts use password `demo1234`: `@jasmine`, `@coderalisuleman`, and the one-letter account `@r`. Local email/phone OTP requests return a `devOtp`; production never returns it and requires AWS SES/SNS configuration.

## Main API contract

- `GET /health` or `/api/health` — readiness, including `storageMode`.
- `POST /api/auth/otp/request`, `POST /api/auth/otp/verify` — email/phone verification.
- `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/me`.
- `GET/PATCH /api/users/...` — profiles; `POST/DELETE /api/users/me/profile-image`.
- `PUT /api/users/:username/relationship` with `{ "state": "want-to-be-with" }` or `{ "state": "none" }`.
- `GET /api/users/:username/people-who-want-to-be-with-me` and `/people-i-want-to-be-with`.
- `POST /api/posts` — multipart form with `type`, `text` or required media `nameIt`, optional `detail`, JSON `links`, and repeated `files`.
- `GET /api/posts/:postId`, `DELETE /api/posts/:postId`.
- `PUT /api/posts/:postId/reaction` with `hug`, `throw`, or `null`; sending the active reaction again toggles it off.
- `POST /api/posts/:postId/view` — records a recommendation preference signal.
- `GET /api/feed?scope=everyone|following&cursor=...` — opaque cursor feed; an empty following list falls back to everyone.
- `GET /api/search?q=...&type=all|text|photo|video|short-video` — ranked people/posts with exact `by @username` boosting.
- `GET/HEAD /api/files/:fileId` — public GridFS streaming with HTTP byte ranges.

Protected routes use `Authorization: Bearer <token>`. Counts are returned as exact integers, never abbreviated.

In production the server serves `client/dist` as an SPA. Public profiles use `/:username` and posts use `/post/:postId`; both receive safely escaped canonical, Open Graph, and Twitter metadata using the configured `PUBLIC_URL` (defaulting to `https://socialmediamother.onrender.com`). The former `/u/:username` and `/p/:postId` links permanently redirect to those friendly routes.

Account actions also refresh safely as SPA routes: `/createaccount`, `/accountin`, `/:username/setting`, `/:username/upload`, and `/:username/upload/{text-post|photo-post|video-post|short-video-post}`. They receive self-canonical metadata plus `noindex, nofollow, noarchive`, and are excluded from `robots.txt` and the public sitemap. Usernames that would collide with application routes are rejected at signup.
