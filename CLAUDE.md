# Formanova — Claude Code Instructions

## UI & Design Principles

Follow UX best practices as established by designers like Don Norman:

- **Alignment**: Parallel elements (canvases, containers, cards) must align top and bottom. Never let siblings sit at different vertical positions.
- **Consistent sizing**: Buttons or controls sitting side-by-side must be the same size and height — no mismatched siblings.
- **Justified text**: Use justified text alignment for body copy and descriptive text.
- **No cramped text**: Give text breathing room. Avoid tight padding or lines that feel compressed.
- **No overflowing text**: Text must never overflow its container. Truncate or wrap as needed.
- **Button text centered**: Text or icons inside buttons must always be perfectly centered horizontally and vertically.
- **Dominant CTAs**: For main upload actions, use striking, dominant buttons — not subtle or secondary-styled ones.
- **Popups centered**: Any modal, popup, or dialog must appear centered on screen.
- **Icon consistency**: New icons must match the existing theme — standard, unique, meaningful. Don't introduce random icon styles.
- **New UI must fit the theme**: Anything newly designed must be visually consistent with the rest of the app — colors, spacing, typography, component style.

## Code & Engineering Rules

- **Minimal blast radius**: Before fixing a bug or adding a feature, check if it can be done with the smallest possible change. Avoid touching unrelated code. Prefer surgical edits to avoid regressions.

## PostHog Rules

- **Do not touch `src/main.tsx`'s PostHog block**: The eager init with `bootstrap` is intentional — it fixes returning users appearing as anonymous UUIDs in session replay. The comment in the file explains it. Do not revert to lazy loading.
- **Never import `posthog-js` directly in components**: All tracking must go through `src/lib/posthog-events.ts`. If a new event is needed, add a function there. An ESLint rule enforces this and will fail the build if violated.
