# Planet Diary Likes API

This Cloudflare Worker stores anonymous public likes for Planet Diary while the website remains on GitHub Pages.

It uses only Workers and D1 features available on Cloudflare's free plan. No paid binding or usage plan is required by this project.

## Privacy and behavior

- The browser creates a random anonymous token in local storage.
- The Worker stores only an HMAC hash of that token.
- No account, email address, raw token, or IP address is stored.
- A composite primary key allows one like per browser and planet.
- Repeated requests are idempotent, and mutations are throttled per anonymous browser.

## Local development

```sh
npm install
npm run generate:ids
npm run db:migrate:local
npx wrangler dev --var VOTER_PEPPER:local-development-secret
```

The website can point to the local Worker by setting `window.PLANET_DIARY_LIKES_API` before `planet-diary.js` loads.

## Production deployment

```sh
npm run db:migrate:remote
npm run deploy
npx wrangler secret put VOTER_PEPPER
```

Never commit `.dev.vars`, `.env`, API tokens, or the production pepper.
