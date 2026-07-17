# Planet Diary

A standalone public archive of 943 illustrated worlds and short stories by Rofix.

## Local preview

Run a static server from this folder, then open the printed local URL:

```sh
python3 -m http.server 8081
```

The website has no build step. Cloudflare Worker dependencies are isolated inside `worker/` and are not needed for a normal site preview.

## Structure

- `index.html` - site entry point
- `assets/css/` - global and Planet Diary styles
- `assets/js/` - shared interactions and the Planet Diary application
- `assets/archive/planet-diary-data.js` - source posts and image references
- `assets/archive/planet-diary-curation.js` - names, catalog properties, systems, arms, and map positions
- `assets/archive/planet-diary-translations.js` - Chinese and English story text
- `assets/archive/images/` - optimized public illustrations
- `worker/` - Cloudflare Worker and D1 migrations for anonymous public likes

## Live site

- Custom domain: <https://planetdiary.org>
- Repository: <https://github.com/renzeyu/planet-diary>
- GitHub Pages fallback: <https://renzeyu.github.io/planet-diary/>

GitHub Pages publishes directly from `main` at `/ (root)`. The site has no build step; pushing a commit to `main` updates the live site. The `.nojekyll` file tells GitHub Pages to serve the static files without Jekyll processing.

## Public likes

Detail pages read and write public like counts through the `planet-diary-likes` Cloudflare Worker:

- API: <https://planet-diary-likes.bitsai-zeyu.workers.dev>
- Database: Cloudflare D1 `planet-diary-likes`
- Browser identity: a random local token; only its HMAC hash is stored remotely
- Limits: one like per anonymous browser and planet, with write throttling

The website remains usable if the API is temporarily unavailable, but the public count displays an unavailable state and no like change is claimed as saved. See `worker/README.md` for local testing, migrations, and deployment commands.

## Custom domain

The root `CNAME` file assigns `planetdiary.org` to this Pages site. At the DNS provider, the apex domain uses GitHub Pages' four `A` records and `www` points to `renzeyu.github.io` with a `CNAME` record.

## Publishing safety

Everything committed to this repository and published through GitHub Pages is public. Do not add private documents, credentials, unpublished confidential material, or source files that should not be downloadable.
