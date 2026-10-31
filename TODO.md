# Website TODO

Ideas for improving the site, roughly by priority within each section.
Not published: `TODO.md` is in `exclude` in `_config.yml` and `_config.dev.yml`.

## Performance and build

- [ ] **Move the blog graph layout to Rust once the blog has more than 100 posts.**
  The force layout in `_plugins/blog-graph.rb` is O(n²) per tick and runs ~1000 ticks.
  Measured in Ruby: 22 posts 0.1 s, 100 posts 0.5 s, 300 posts 3.6 s, 1000 posts 39 s.
  The layout is cached (see below), so this only costs time when posts or links change.
  Plan: the plugin writes nodes / edges as JSON to a small Rust CLI and reads back
  positions; it falls back to the Ruby layout when the binary is missing. Build the
  binary in GitHub Actions (cache `~/.cargo` and `target/`) or ship prebuilt binaries.
  Keep the force step identical in Rust and in `assets/js/related-graph.js` (drag uses it).
- [ ] Before (or instead of) Rust: Barnes–Hut approximation for the repulsion step,
  O(n log n) instead of O(n²); enough for several hundred posts in plain Ruby.
- [ ] Find mentions between posts in one pass (collect each post's links to other posts)
  instead of comparing every pair of post contents in `build_edges`.
- [ ] Persist `.jekyll-cache` between GitHub Actions runs (`actions/cache`), so the graph
  layout cache also works on deploys.
- [x] Cache the graph layout (`Jekyll::Cache`, keyed by post count + links).
- [ ] Production build is ~3 s slower than development because of `jekyll-minifier`
  (uglifier via mini_racer). Consider minifying JS with esbuild / terser in CI instead.
- [ ] Install ImageMagick locally (or switch `jekyll-imagemagick` to libvips) so local
  builds generate responsive images like CI does (`convert: command not found` today).
- [ ] Migrate Sass `@import` to `@use` (Dart Sass 3 removes `@import`; deprecation warnings
  on every build).

## Blog

- [ ] Unhide the blog: remove `blog` and `_posts` from `exclude` in `_config.yml`
  and set `blog_nav_title`.
- [ ] Replace the al-folio demo posts with real ones; they dominate the tags
  (`formatting` on 15 posts) and the graph.
- [ ] Group the post list by year once there are more than ~20–30 posts.
- [ ] Client-side tag filter on the blog page (needs all posts on one page or a JSON index,
  because pagination shows only 5 posts).
- [ ] Optional compact "Related" list of links under the graph on post pages
  (today related posts are only visible in the graph).
- [ ] Graph: tune the layout for the 280×230 box (disconnected posts end up in the corners).
- [ ] Semantic related posts (text embeddings computed at build time) in addition to
  shared tags and mentions. A good candidate for the Rust tool above.
- [ ] *(Low priority, once the blog has readers.)* Turn on the email newsletter.
  The UI is ready but hidden: "Subscribe" in the blog header and a box under every post
  (`_includes/subscribe_form.html`, posting to Buttondown). To enable: create a Buttondown
  account, set `newsletter.buttondown_username` in `_config.yml`, and in Buttondown turn on
  RSS-to-email with the site's `/feed.xml` (it polls every 30 min; send right away or as
  drafts). Check whether RSS-to-email is in the free plan (free tier: up to 100 subscribers).

## Internationalization

- [ ] Real `/ru/` URLs (e.g. `jekyll-polyglot`) instead of the JS text swap, so Russian
  pages are indexed by search engines; the language switch would link to the same page
  in the other language.
- [ ] Translate post titles / descriptions where a Russian version exists.

## Domain and deploy

- [ ] Buy `ivanzolin.com` (was free on 2026-10-31) and point it at GitHub Pages:
  A records to 185.199.108–111.153, `CNAME` file with the domain, `url` in `_config.yml`,
  verify the domain in GitHub account settings, enable "Enforce HTTPS".
- [ ] Turn on auto-renew and 2FA at the registrar.

## UX

- [ ] Cross-document view transitions work in Chrome / Edge / Safari 18.2+; check how
  blog navigation feels in Firefox (no transition, the graph simply re-appears in place).
- [ ] Verify tooltips, language switch and the header in the dark theme on a real device.
