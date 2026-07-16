# Planet Diary

A standalone public archive of 943 illustrated worlds and short stories by Rofix.

## Local preview

Run a static server from this folder, then open the printed local URL:

```sh
python3 -m http.server 8081
```

The site has no build step and no package dependencies.

## Structure

- `index.html` - site entry point
- `assets/css/` - global and Planet Diary styles
- `assets/js/` - shared interactions and the Planet Diary application
- `assets/archive/planet-diary-data.js` - source posts and image references
- `assets/archive/planet-diary-curation.js` - names, catalog properties, systems, arms, and map positions
- `assets/archive/planet-diary-translations.js` - Chinese and English story text
- `assets/archive/images/` - optimized public illustrations

## Live site

- Custom domain: <https://planetdiary.org>
- Repository: <https://github.com/renzeyu/planet-diary>
- GitHub Pages fallback: <https://renzeyu.github.io/planet-diary/>

GitHub Pages publishes directly from `main` at `/ (root)`. The site has no build step; pushing a commit to `main` updates the live site. The `.nojekyll` file tells GitHub Pages to serve the static files without Jekyll processing.

## Custom domain

The root `CNAME` file assigns `planetdiary.org` to this Pages site. At the DNS provider, the apex domain uses GitHub Pages' four `A` records and `www` points to `renzeyu.github.io` with a `CNAME` record.

## Publishing safety

Everything committed to this repository and published through GitHub Pages is public. Do not add private documents, credentials, unpublished confidential material, or source files that should not be downloadable.
