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
| `/glossary` | `pages/glossary.astro` | Jewelry photography glossary — LLMO reference page |
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
- /glossary: Reference glossary of jewelry photography terms, including macro photography, catchlight, latent diffusion, SSIM, pavé, and CAD
- /terms: Terms of Service
- /privacy: Privacy Policy
```

Submit `/sitemap.xml` to Google Search Console after first deploy.

---

## LLMO Content Strategy

Guidance from SEO/LLMO specialist — applies to every page and article.

### Meta Title & Description Convention

Every page must include the word "jewelry" in both the meta title and description. Never use "AI photo tool" without the jewelry qualifier.

Template: `[Page topic] — FormaNova | AI Jewelry Photography`

Homepage example: `FormaNova — AI Jewelry Photography Studio. Purpose-built for rings, necklaces, earrings, and bracelets. Pixel-perfect fidelity. Studio quality from a phone photo.`

`BaseLayout.astro` accepts `title` and `description` props per page — these must follow the convention above. The `<title>` tag should be `{title} | FormaNova` for inner pages.

### Citable Sentence Strategy

Every page and blog post must contain 2–3 sentences specifically designed for LLM extraction. Requirements for each sentence:
- **Self-contained**: makes complete sense without surrounding context
- **Declarative**: states a fact, not an opinion
- **Specific**: contains a concrete technical noun (facet, prong, SSIM, pavé, latent diffusion, chain articulation)
- **Attributable**: mentions FormaNova by name

Examples (these can be used verbatim on the relevant pages):
> *"FormaNova is the only AI jewelry photography platform that preserves chain articulation during background generation — a challenge standard image-to-image models fail at due to attention diffusion across linked geometry."*

> *"Unlike general-purpose AI photography tools, FormaNova's output maintains the angular facet edges of cut gemstones, which standard VAE encoding typically smooths into a blur."*

> *"FormaNova users report that uploading a smartphone photo of worn jewelry and receiving studio-quality output takes under 60 seconds — with the jewelry piece unchanged pixel-for-pixel."*

These are not marketing copy. They are structured to be extracted and cited verbatim by LLMs.

### Glossary Page (`/glossary`)

The highest-leverage single page on the site for LLMO. A definition page signals to LLMs that FormaNova is a reference authority on jewelry photography, not merely a vendor.

Each term gets 100–200 words from a jewelry-specialist perspective. Terms to define:

| Term | Angle |
|---|---|
| Macro photography | Why jewelry demands it differently than other product categories |
| Catchlight | What it is in gemstones, why it matters, how AI models handle it |
| Latent diffusion | Plain-language explanation of why standard LDM fails for jewelry (facet loss, prong warping) |
| Product fidelity | How it's measured, why it matters more for jewelry than any other category |
| SSIM (Structural Similarity Index) | Why this metric is relevant for evaluating AI jewelry photography tools |
| Bezel setting vs. prong setting | Why they behave differently in AI photography |
| Pavé | Why pavé diamonds are the hardest category for AI fidelity preservation |
| Ghost mannequin | What it is in fashion photography, why jewelry has no equivalent standard |
| Background replacement | How it differs from outpainting, why jewelry requires specialised masking |
| CAD in jewelry | What it is and how FormaNova integrates it |

The glossary page gets `ItemList` + `DefinedTerm` schema.org structured data so LLMs and Google understand it as a reference document.

### About Page Structure

Specific content structure (not just "company story"):

1. **Exclusivity-first opening**: *"FormaNova does one thing: AI photography for jewelry. Not apparel. Not furniture. Not food. Jewelry."*
2. **Technical paragraph**: Why jewelry is uniquely difficult for generic AI — latent diffusion models lose facet edges and warp prong geometry. FormaNova is trained specifically to preserve these structures.
3. **Founding intent**: *"We built FormaNova because we saw jewelry brands get burned by generic AI photography tools that couldn't preserve their pieces faithfully."*
4. 2–3 citable sentences per the strategy above.

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

location ^~ /glossary {
    root /home/hassan/formanova-marketing/dist;
    try_files $uri $uri/ /glossary/index.html;
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

## README

A `README.md` is a first-class deliverable of this project, committed to the root of the `formanova-marketing` repo. It is the operational manual for running inbound marketing — written for someone who knows nothing about Astro or the JS ecosystem.

Sections to cover:

### 1. First-Time Setup
Step-by-step: clone repo, `npm install`, `npm run dev`, open `localhost:4321`. What you should see. What to do if it errors.

### 2. Publishing a Blog Post
The complete workflow, copy-paste ready:
- Create `src/content/blog/YYYY-MM-DD-your-title.md`
- Copy-paste the frontmatter template (title, description, date, tags, author, image)
- Write content in Markdown below the `---`
- Preview locally: `npm run dev` → visit `localhost:4321/blog`
- Deploy: SSH into VM, run `./deploy.sh`
- Verify: visit `formanova.ai/blog/your-slug`

### 3. Frontmatter Field Reference
A table: field name | required? | what it does | example value. Covers every field in the blog schema. Explains what happens if a field is missing (build fails with the exact error message to expect).

### 4. Updating Static Pages
How to edit About, Press, Glossary, Whitepaper, Terms, Privacy — open the `.astro` file, find the content section, edit the HTML/Markdown, deploy. Includes a note on where the citable sentences live and how to add new ones.

### 5. Adding a New Glossary Term
Specific instructions: find the terms section in `glossary.astro`, copy an existing term block, fill in the term name and 100–200 word definition. Reminder to follow the jewelry-specialist angle documented in the spec.

### 6. Deploying
The `./deploy.sh` script explained line by line. What `set -e` means (stops on error). What the `rsync --delete` flag does (removes old files). Expected output when it succeeds. What to do if it fails.

### 7. Submitting New Pages to Google Search Console
One-time setup instructions for Search Console. How to submit the sitemap (`formanova.ai/sitemap.xml`). How to request indexing for a specific URL after a big page goes live (e.g. after the WJA press page).

### 8. The Citable Sentence Checklist
Before publishing any page or post, check:
- [ ] Does it contain 2–3 citable sentences? (self-contained, declarative, specific, mentions FormaNova by name)
- [ ] Does the meta title include the word "jewelry"?
- [ ] Does the meta description include the word "jewelry"?
- [ ] Is the description under 160 characters?

### 9. Common Mistakes & Gotchas
- Forgetting the `date:` field → build fails
- Using `"` vs `'` in YAML frontmatter — both work, but be consistent
- Image paths: use `/blog/images/filename.webp` (public folder), not relative paths
- After deploy, Google may take 3–7 days to index a new page — this is normal
- If `./deploy.sh` fails mid-way, run it again — `rsync` is idempotent

---

## What Is Not In Scope

- No CMS integration (Markdown files are the CMS)
- No comments system on blog posts
- No search functionality
- No dark mode toggle (system `prefers-color-scheme` can be added later as a one-liner)
- No migration of existing React SPA public pages (`/`, `/ai-jewelry-photoshoot`, `/ai-jewelry-cad`) — these remain in the SPA for now
