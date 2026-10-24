# Dynamic content architecture

The homepage professional content (profile, experience, education, projects,
publications, achievements/patents, skills, links, blog) is **not** hard-coded
into HTML or Liquid. It is fetched at runtime, in the browser, from the public
content contract:

```
/assets/json/content.json
```

That file is generated and published by the separate **`personal-os`**
repository. This website repository owns only the presentation layer.

## Data flow

```
content.json  (published by personal-os)
      ↓  fetch("/assets/json/content.json", { cache: "no-cache" })
loadContent()        → HTTP + JSON parse + validateContent() (schema_version "1")
      ↓
renderAll(doc, data, lang)   → normalizeLang → per-section renderers
      ↓
DOM (safe: textContent / createElement, validated URLs, sanitized markdown)
```

## Files

| File | Role |
|------|------|
| `assets/js/content-loader.js` | Fetch, validate, normalize language, and render every section. Contains the pure helpers, the DOM renderers, and the browser bootstrap. Also exported for Node tests. |
| `_includes/dynamic_content.html` | HTML shell: loading state, error state, `#site-content` target. Resolves the JSON URL via `relative_url` (respects `baseurl`). |
| `_pages/about.md` | Homepage. Hosts the shell via `{% include dynamic_content.html %}`; al-folio news/posts/bib/config-social blocks disabled so the page has a single runtime source of truth. |
| `_sass/_dynamic-content.scss` | Styling, using the theme's CSS custom properties so light/dark mode work automatically. Imported from `assets/css/main.scss`. |
| `tests/content-loader.test.js` | Node built-in test-runner tests (no dependencies). |

## Editing content

Do **not** edit professional facts here. Change them in `personal-os`, which
regenerates and republishes `assets/json/content.json`. On the next push to
`master`, GitHub Pages redeploys and the browser picks up the new file.

## Language

`EN` / `RU` toggle: a language icon button in the site header (shown only on pages with dynamic content). Choice is persisted in `localStorage` and the
initial value is derived from that or the browser language. Missing localized
values (e.g. `"ru": null`) are **omitted**, never machine-translated or
back-filled from English.

## Caching

The fetch uses `cache: "no-cache"`: the browser may cache the file but must
revalidate it (conditional request) on each load, so a freshly published
`content.json` appears without any HTML rebuild, with no aggressive polling.

## Security

All text is inserted via `textContent` / text nodes. Markdown (project
descriptions) is rendered into DOM nodes through a safe subset renderer — no
`innerHTML`. URLs are validated (`http(s)`/`mailto` only) before becoming
links, so hostile strings such as `<script>…</script>` or
`[x](javascript:…)` cannot execute.

## Tests

```
node --test        # or: npm test
```

## Recent news and selected papers (start page)

- **Recent news** comes from the Jekyll `_news/` collection (one file per item,
  `date:` in front matter, optional `ru:` translation, English text as the body).
  `news.json` publishes it at `/assets/json/news.json`; the loader fetches it
  alongside `content.json`. A missing `ru:` falls back to the English text.
- **Selected papers** are chosen by publication id in `_pages/about.md`
  (`selected="tridefusion-v1,tridefusion-v2"`); the cards come from `content.json`.
