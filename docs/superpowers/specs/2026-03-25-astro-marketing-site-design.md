# Astro Marketing Site — Design Spec
**Date:** 2026-03-25
**Status:** Approved

## Problem

FormaNova is a React SPA. Googlebot and LLM crawlers (ChatGPT, Perplexity) receive an empty `<div id="root">` on public-facing pages and cannot index them reliably. This blocks inbound SEO and LLM citation — critical channels for SaaS growth.

The authenticated app (dashboard, studio, CAD tools) does not need SEO. The problem is limited to public-facing marketing and content pages.

## Solution

A separate Astro project (`formanova-marketing`) that builds to static HTML files and is served from the same domain (`formanova.ai`) via nginx path routing. No server required — just files on disk. All SEO authority stays pooled under `formanova.ai`.

The React SPA is untouched.

---

## Repo

**New repo:** `formanova-marketing` (separate from the main app repo)

```
formanova-marketing/
├── src/
│   ├── content/
│   │   └── blog/                  # .md files — one file = one published post
│   ├── layouts/
│   │   ├── BaseLayout.astro       # HTML shell, fonts, meta tags, OG tags
│   │   └── BlogLayout.astro       # Wraps individual blog posts
│   ├── pages/
│   │   ├── about.astro
│   │   ├── press.astro
│   │   ├── whitepaper.astro
│   │   ├── terms.astro
│   │   ├── privacy.astro
│   │   └── blog/
│   │       ├── index.astro        # Blog listing, sorted by date
│   │       └── [...slug].astro    # Individual posts, auto-generated from .md
│   └── components/
│       ├── Header.astro
│       ├── Footer.astro
│       └── BlogCard.astro
├── public/
│   ├── llms.txt                   # LLM crawler discovery file
│   └── whitepapers/               # PDF downloads
├── astro.config.mjs
└── package.json
```

---

## Pages

| URL | File | Purpose |
|---|---|---|
| `/about` | `pages/about.astro` | Company story, mission, what FormaNova is |
| `/press` | `pages/press.astro` | Partnerships, press coverage, press kit download |
| `/blog` | `pages/blog/index.astro` | Post listing, sorted by date, excerpts + tags |
| `/blog/:slug` | `pages/blog/[...slug].astro` | Individual posts, auto-generated from `.md` |
| `/whitepaper` | `pages/whitepaper.astro` | Description + PDF download CTA |
| `/terms` | `pages/terms.astro` | Terms of Service |
| `/privacy` | `pages/privacy.astro` | Privacy Policy |

---

## Astro Config

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://formanova.ai',
  integrations: [sitemap()],
  output: 'static',
});
```

Dependencies: `astro`, `@astrojs/sitemap`. Nothing else required.

`sitemap()` auto-generates `/sitemap.xml` on every build, covering all pages including new blog posts.

---

## Blog Content Schema

Every `.md` file in `src/content/blog/` must have this frontmatter. Astro validates at build time — missing required fields fail the build loudly.

```yaml
---
title: "How AI Is Changing Jewelry Photography in 2026"
description: "One sentence — used for Google snippet and LLM summaries."
date: 2026-03-25
tags: ["AI jewelry", "product photography", "e-commerce"]
author: "FormaNova Team"
image: "/blog/images/filename.webp"   # optional, used for OG image
---
```

Publishing workflow:
1. Drop a `.md` file into `src/content/blog/`
2. Fill in frontmatter
3. Write content in Markdown below the frontmatter
4. `git commit && git push`
5. SSH into VM, run `./deploy.sh`

---

## Design System

Single fixed theme — light. No theme switcher (the app's 12-theme system is a product feature, not a marketing feature).

```css
:root {
  --bg: #ffffff;
  --fg: #000000;
  --muted: #737373;
  --border: #e5e5e5;
  --gold: hsl(42 85% 38%);     /* formanova-hero-accent */
  --radius: 0;                  /* brutalist, matches app */

  --font-display: 'Bebas Neue', sans-serif;
  --font-body: 'Inter', system-ui, sans-serif;
}
```

Fonts loaded from Google Fonts in `BaseLayout.astro`. Same fonts as the app — zero visual discontinuity when users click through to the product.

Legal pages (`/terms`, `/privacy`) use `max-width: 720px` and `line-height: 1.7` for readability.

### Logo Asset

The app has two logo PNGs: `formanova-logo-black-tagline.png` (light themes) and `formanova-logo-white-tagline.png` (dark themes). Copy `formanova-logo-black-tagline.png` into the Astro `public/` folder. The marketing site uses it directly as a static `<img>` — no React context needed.

Source location in main repo: `src/assets/formanova-logo-black-tagline.png`

### Header

Matches the app header exactly:
- **Fixed**, full-width, `z-50`
- Height: `64px` mobile / `80px` desktop
- Default state: `background: #fff`
- Scrolled state (>20px): `background: rgba(255,255,255,0.95)`, `backdrop-filter: blur(12px)`, `border-bottom: 1px solid rgba(0,0,0,0.08)`, subtle `box-shadow`
- Scroll detection via a vanilla JS `scroll` event listener in a `<script>` tag in `BaseLayout.astro` — no framework needed
- Mobile: hamburger icon → full-screen overlay with `font-display` (Bebas Neue) nav links, staggered fade-in

Header navigation: **Logo | About | Blog | Press | Pricing | Get Started →**
- "Pricing" links to `formanova.ai/pricing` (React SPA route — works fine as a standard `<a>` tag)
- "Get Started" links to `formanova.ai/login`
- Nav link style: `font-size: 14px`, `font-weight: 500`, `color: var(--muted)`, hover → `color: var(--fg)`

### Footer

The app has no footer — designing fresh for the marketing site, following the same brutalist style:
- Sharp black top border, no rounded corners
- Two columns: brand column (logo + one-line description) + links column (About, Blog, Press, Whitepaper, Terms, Privacy)
- Section labels in Bebas Neue, links in Inter 14px
- Bottom bar: `© 2026 FormaNova` left, social links right
- Background: white, foreground: black — matches light theme exactly

---

## SEO & LLM Signals

Every page:
- `<title>` and `<meta name="description">` populated per-page via `BaseLayout` props
- Open Graph tags (`og:title`, `og:description`, `og:image`)
- Canonical URL

Blog posts additionally:
- `application/ld+json` Article structured data (signals to Perplexity, ChatGPT, Google)
- Author, date, tags in structured data

Sitewide:
- `/sitemap.xml` — auto-generated by `@astrojs/sitemap` on every build
- `/rss.xml` — generated via `@astrojs/rss` (add to config when blog has first post)
- `/llms.txt` — static file in `public/`, lists all important URLs for LLM crawlers

```
# FormaNova
> AI-powered jewelry photography and 3D CAD generation for jewelry brands.

## Pages
- /about: Company background and mission
- /press: Partnership announcements and press coverage
- /blog: Articles on AI jewelry photography and the jewelry industry
- /whitepaper: Technical whitepaper on FormaNova's accuracy verification
- /terms: Terms of Service
- /privacy: Privacy Policy
```

Submit `/sitemap.xml` to Google Search Console after first deploy.

---

## Deploy Workflow

**Build output:** `formanova-marketing/dist/`
**Served from:** `/home/hassan/formanova-marketing/dist/` on the Azure VM

```bash
# deploy.sh (lives in repo root)
#!/bin/bash
set -e
git pull
npm run build
sudo rsync -a --delete dist/ /home/hassan/formanova-marketing/dist/
echo "Deployed."
```

SSH in, run `./deploy.sh`. Done.

---

## nginx Changes

Add the following blocks to the main HTTPS server block, **between the `/billing/` block and `location /`**. Zero changes to existing blocks.

```nginx
# -------------------------------------------------------
# Astro marketing site — static files
# -------------------------------------------------------

location ^~ /_astro/ {
    root /home/hassan/formanova-marketing/dist;
    add_header Cache-Control "public, max-age=31536000, immutable";
}

location ^~ /about {
    root /home/hassan/formanova-marketing/dist;
    try_files $uri $uri/ /about/index.html;
}

location ^~ /press {
    root /home/hassan/formanova-marketing/dist;
    try_files $uri $uri/ /press/index.html;
}

location ^~ /blog {
    root /home/hassan/formanova-marketing/dist;
    try_files $uri $uri/ /blog/index.html;
}

location ^~ /whitepaper {
    root /home/hassan/formanova-marketing/dist;
    try_files $uri $uri/ /whitepaper/index.html;
}

location ^~ /terms {
    root /home/hassan/formanova-marketing/dist;
    try_files $uri $uri/ /terms/index.html;
}

location ^~ /privacy {
    root /home/hassan/formanova-marketing/dist;
    try_files $uri $uri/ /privacy/index.html;
}

location = /sitemap.xml { root /home/hassan/formanova-marketing/dist; }
location = /rss.xml     { root /home/hassan/formanova-marketing/dist; }
location = /llms.txt    { root /home/hassan/formanova-marketing/dist; }
```

**Routing logic:**
- `/_astro/` — Astro's content-hashed CSS/JS assets. Cached for 1 year (`immutable`). Security headers omitted intentionally (irrelevant for assets).
- Page locations — `^~` gives them priority over `location /`. `try_files` handles sub-paths (e.g. `/blog/my-post/` → `dist/blog/my-post/index.html`). Server-level security headers inherited (no local `add_header` override).
- Exact matches — `sitemap.xml`, `rss.xml`, `llms.txt` served directly from Astro dist.
- Everything else — unchanged, falls through to `location /` and the React SPA.

---

## What Is Not In Scope

- No CMS integration (Markdown files are the CMS)
- No comments system on blog posts
- No search functionality
- No dark mode toggle (system `prefers-color-scheme` can be added later as a one-liner)
- No migration of existing React SPA public pages (`/`, `/ai-jewelry-photoshoot`, `/ai-jewelry-cad`) — these remain in the SPA for now
