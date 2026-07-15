# Social Media Mother

Social Media Mother is a full-stack social platform for text, photo, video, and short-video posts. It uses a fast Vite + React client, an Express API, MongoDB/Mongoose for social data, MongoDB GridFS streaming for uploaded media, and optional AWS SES/SNS verification.

The public canonical address is [socialmediamother.onrender.com](https://socialmediamother.onrender.com). The creator is [Coder Ali Suleman on GitHub](https://github.com/coderalisuleman), and the owner link points to [Coder Ali Suleman on YouTube](https://youtube.com/@coderalisuleman).

## What is included

- Everyone and following feeds, with a friendly cold-start fallback
- Recommendation ranking using recency, reactions, following, content preference, and diversity
- Ranked people/post search, including precise `by @username` matching
- Username, email OTP, and phone OTP account creation plus flexible login
- Multi-photo and multi-video carousels, short video, drag/drop uploads, and text posts
- Chunked media uploads with real percentage, bytes, speed, remaining time, pause, resume, and cancel
- Private on-device post drafts under “Saved till and complete later”
- Streamed GridFS media with HTTP byte-range support for slow connections
- Hug/throw reactions, follow graph, exact follower counts, and editable profiles
- Cursor pagination, async-generator processing, compressed responses, and centralized errors
- Responsive, accessible interface with reduced-motion support
- Canonical, Open Graph, Twitter, robots, sitemap, manifest, and branded icon assets
- A single-service Render Blueprint and environment template
- First-party human-behaviour reporting and creator-facing Fans-behaviour reports

## Friendly direct links

- `/<username>` opens that person's Me/profile page, for example `/jasmine`.
- `/<username>/setting` opens the signed-in owner's settings.
- `/createaccount` and `/accountin` open the account cards.
- `/<username>/upload` opens the upload chooser.
- `/<username>/upload/text-post`, `/photo-post`, `/video-post`, and `/short-video-post` open the matching uploader directly.
- `/post/<post-id>` is the shareable post address. Older `/u/<username>` and `/p/<post-id>` links redirect permanently.
- `/humanbehaviour` is the private analytics-team report and is always excluded from search engines.

Private account, settings, and upload links are excluded from search engines. Public profile and post links receive their own canonical and social-sharing metadata.

## Run locally

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env`.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open `http://localhost:5173`.

`MONGODB_URI` is required in development and production. The server reads the root `.env` even when npm workspaces launch it from `server/`, so users, posts, follows, reactions, comments, OTP challenges, and GridFS media always use durable MongoDB storage. It fails fast instead of silently falling back to temporary demo data.

## Account verification

Username signup never needs an OTP. Email and phone verification are enabled only when the corresponding AWS environment values are present:

- Email: `AWS_REGION`, credentials, and `AWS_SES_FROM_EMAIL`
- SMS: `AWS_REGION`, credentials, and optionally `AWS_SNS_ORIGINATION_NUMBER`

Blank AWS values do not crash the app; the interface explains that the selected verification channel is not configured. AWS credentials stay on the server and are never bundled into Vite.

## Deploy to Render

1. Create a MongoDB Atlas deployment and allow connectivity from Render.
2. Push this project to GitHub, GitLab, or Bitbucket.
3. In Render, create a Blueprint from that repository; `render.yaml` defines the free Node web service.
4. Set `MONGODB_URI`. Add the optional AWS values only when email/SMS verification is wanted.
5. Set `ANALYTICS_TEAM_PASSWORD_HASH` to a bcrypt hash, never to the plain password. Generate one locally with the command shown in `.env.example`; keep the result only in Render's environment settings.
6. Apply the Blueprint and verify `https://socialmediamother.onrender.com/api/health`.

The Vite production build is served by the same Express service, keeping deployment and same-origin security simple. Render's filesystem is ephemeral, so uploads are streamed to MongoDB/GridFS rather than written to local disk.

The analytics collector deliberately stores interaction types, page paths, post IDs, durations, and safe device/network state only. It does not store passwords, OTPs, email addresses, phone numbers, search phrases, or text typed into forms. Analytics events expire automatically after 180 days. Post drafts are private to the signed-in username and the browser/device where they were saved; published posts remain durable and cross-device in MongoDB.

### If Render shows `No route matches GET /`

Use the exact environment-variable names from `render.yaml`:

- Set `NODE_ENV` to `production` (or remove the manual override and let Render provide its production default).
- Rename `PUBLIC_UR` to `PUBLIC_URL`.
- Rename `JWT_EXPIRES` to `JWT_EXPIRES_IN`.
- You can remove a manually added `PORT`; Render supplies it automatically. Keep `HOST=0.0.0.0`.

The server also detects Render through its built-in `RENDER=true` value, so a future accidental `NODE_ENV=development` override will no longer make the website disappear behind an API 404.

## Practical scaling note

GridFS honors the MongoDB-only architecture and works well for an MVP, but video can consume a free Atlas allowance quickly. Before large commercial scale, keep the post/social collections in MongoDB and consider moving media bytes to an object-storage/CDN pipeline with transcoding, posters, moderation, and signed uploads. The API's media boundary is isolated so that change can be made without redesigning accounts, feeds, or search.

## Useful commands

- `npm run dev` — client and API together
- `npm run build` — optimized Vite production bundle
- `npm start` — production Express server
- `npm run check` — backend syntax checks and frontend production build

Copyright © 2026 Vibe Coder Ali Suleman. All rights reserved.
