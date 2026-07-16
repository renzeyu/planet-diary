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

## Publish with GitHub Pages

1. Create a GitHub repository, for example `planet-diary`.
2. Add that repository as this folder's `origin` remote.
3. Push the `main` branch.
4. In the repository's **Settings > Pages**, choose **Deploy from a branch**.
5. Select `main` and `/ (root)`.

The `.nojekyll` file tells GitHub Pages to publish these static files without Jekyll processing.

## Custom domain

Configure the domain in **Settings > Pages** before changing DNS. For a subdomain, add the DNS CNAME requested by GitHub. Add a `CNAME` file here only after the final domain is chosen.

## Publishing safety

Everything committed to this repository and published through GitHub Pages is public. Do not add private documents, credentials, unpublished confidential material, or source files that should not be downloadable.
