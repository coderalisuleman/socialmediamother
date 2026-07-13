# Social Media Mother

Social Media Mother is a full-stack social platform for text, photo, video, and short-video posts. It uses a fast Vite + React client, an Express API, MongoDB/Mongoose for social data, MongoDB GridFS streaming for uploaded media, and optional AWS SES/SNS verification.

The public canonical address is [socialmediamother.onrender.com](https://socialmediamother.onrender.com), and the owner link points to [Coder Ali Suleman on YouTube](https://youtube.com/@coderalisuleman).

## What is included

- Everyone and following feeds, with a friendly cold-start fallback
- Recommendation ranking using recency, reactions, following, content preference, and diversity
- Ranked people/post search, including precise `by @username` matching
- Username, email OTP, and phone OTP account creation plus flexible login
- Multi-photo and multi-video carousels, short video, drag/drop uploads, and text posts
- Streamed GridFS media with HTTP byte-range support for slow connections
- Hug/throw reactions, follow graph, exact follower counts, and editable profiles
- Cursor pagination, async-generator processing, compressed responses, and centralized errors
- Responsive, accessible interface with reduced-motion support
- Canonical, Open Graph, Twitter, robots, sitemap, manifest, and branded icon assets
- A single-service Render Blueprint and environment template

## Friendly direct links

- `/<username>` opens that person's Me/profile page, for example `/jasmine`.
- `/<username>/setting` opens the signed-in owner's settings.
- `/createaccount` and `/accountin` open the account cards.
- `/<username>/upload` opens the upload chooser.
- `/<username>/upload/text-post`, `/photo-post`, `/video-post`, and `/short-video-post` open the matching uploader directly.
- `/post/<post-id>` is the shareable post address. Older `/u/<username>` and `/p/<post-id>` links redirect permanently.

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
5. Apply the Blueprint and verify `https://socialmediamother.onrender.com/api/health`.

The Vite production build is served by the same Express service, keeping deployment and same-origin security simple. Render's filesystem is ephemeral, so uploads are streamed to MongoDB/GridFS rather than written to local disk.

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

e ->
mabs ....
problems to fix after 21 july token reset
1. if user want to delete there any post format then also show to the on thier own post format only the trash icon on which when they click they see the delete and cancel button on delete they can delete it
2. when they are uploading so if they want to pasue it or cancel it so allow them ( as now users are facing problem of they cant able to do it )
3. the short videos, videos and images so there controls like the pause and play and the mute and unmute and full screen and exit screen so they are disturbing the user full watching like they appear in there video or photo so make them as below the all format and also on click they appear as like on YouTube and on click again they go away as like on YouTube and further make this as the play and stop icon in center of photo, video and short video and on click it shows and on click it goes away to avoid users watching disturbance and the full screen and exit screen also where it is, it is good and further one mistake as I said from his hand he stretch the rope when full screen is and when screen is not full then he is not stretching and make it right and realistic animation as now problem is his hands are below and rop is going which is not real world like and further the video and short video time period as people know how much total there time is and how much they watched so that time period in numbers and with a line as of my three colors style going on center just below the pause and play button as my new style instead of copying YouTube and further they can drag it to play as where time period they want and further also give them option of hour, minute and seconds as they can manually write to play also for more accurately time period playing and further this manually make so much simpler and easier for users 
4. whole website make as on a back touch of there phone it go one step back instead of full web close ( for example I am on a form and filling data so if on mobile I touch back so this form close and I reach the homage and if one more back then the web closed so like this way ) as problem is when one touch back happen so full website closed 
5. further on sensitive page means where users are filling something like forms filling or uploading or writing something so if there a back touch happen or they are accediently closing so ask them if it closed then data will be deleted and no don't close I want to complete this so these two buttons and as it whole this text on all devices ( bcz sometimes users are filling data or uploading something or something or writing there text or title etcs so this accendiently hack happen so they then again write everything )
6. saved till and complete later so this option add also in all things in web where users fill and do something and then they think they have very emergency work to do so they are closing and winding up so they can click on this option so it is like a draft as of YouTube and Instagram so it saved and later when they open it as a new option as saved till and complete later your things show so where they can complete them so then they becomes completed and further this make organized and must be only for all format of posts only like for text-post, photo-post, video-post and short video post bcz for other anything this two options are meaningless and further in users profile a one more button as before four buttons as four formats now this is fifth button which is saved till and complete later your things where they can finish them so they are completed and when they complete they removed from this and gone into there format portion for organizing and also lived for others to watch it and when they are not completed no one can watch it except the owner
7. in send your thought which is comments so add a number as a bubble of thought up it so your knows how much comments are to the post 
8. so when user are closing there web so ask them I want to close it and no mistakenly clicked I want to use it as like if they accidently click or intentionally click so for to exit or remain on web 
9. analytics so a analytics as when a user fines and where he go and what he watch and what time period he watch and how he reacts and when he leaves so this all data save to server like in database and also make it as a analytics and in /analytics page they are so a web team can view it and for to viewing it set a analytics team email and password so when they enter then only they cns view it and the email is: businessalisuleman@gmail.com and password is: Kingsolomon100 and further make it as analytics team can understand the users and make a report which lewd to make web more best and profilable as business and further this analytics is must be as a continuous sending to the server with user continuous interaction and when he leaves the window then remaining also sended to the server
10. and a analytics option also add a analytics button as 5 buttons in user profile so noe sixth button this add where they see the analytics of there account like how the other users interactions to there account like so they can understand like which there post format is doing good and which is not doing good and further he can see this as a number of seers report on there all post-formats and the numbers of hugs on all post-formats and number of throws on all post-formats, and number of send thoughts on all post-formats and number of watching time period on all post formats, number of there followers on all post formats gained ( so make it as collective and a individual thing based so the creator will know which thing is doing good like which post gained folowre morez like more, comments more and time period watch more so they can make like that more and which not worforming good so they avoid that and they also see a export this report as a animation cartoon reading interesting style so they can export it which as in pdf format go and they can read it later ) and further this analytics name make as fans-behaviour so don't show a analytics text button show as fans-behaviour and also for the analytics team /analytics don't show so show as /humanbehaviour
11. search have issue like if I am searching and press space on keyboard so it is not applying space and second problem is what I am writing it is showing above in url as %20 means very awkward not good thing there and third problem is what search is matched it is not look good as you describe below as search matched or not make it more interactive and easy for users just fmy format button and default all and what is watching with it that show and further I face a problem if I search for example a office girl so it show me that in all but it also show me that in other photo format means the other thing which is not it so fix it what is exactly is for more user accurate experience 
12. in change remove the below things which are in me thing like the all format button and there thing here just we can change the profile photo or change over name or username or phone number or email only and further of someone change it then there all data also shift to that there account instead of loss or in-short I want when they change then there data is not deleted all as to avoid there hard work waste
13. and in phone number the country flag is not showing I tell your country flag in animation cartoon style images show and further in phone number enter when country code is settled then a mistake for example my country code is +92 then in phone number is why 03254695657 for example it is wrong so write is 3254695657 so correct it where you added as placeholder and also like that way working and other way if people write so show them red text line as error if they do wrong 
14. when people are login in so then @ is written so there a select option add where fist people chosse by user name or phone number or email then if they choose username then default @ is written and they have to write there username and if they write @ then it will not be written bcz it is already written in this way it becomes more understanding for users
