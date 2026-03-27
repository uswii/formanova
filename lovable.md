# Formanova — Lovable Instructions

## UI & Design Principles

Follow UX best practices as established by designers like Don Norman:

- **Alignment**: Parallel elements (canvases, containers, cards) must align top and bottom. Never let siblings sit at different vertical positions.
- **Consistent sizing**: Buttons or controls sitting side-by-side must be the same size and height — no mismatched siblings. Example: "New Photoshoot" and "Regenerate" buttons must always be equal size.
- **Justified text**: Use justified text alignment for body copy and descriptive text.
- **No cramped text**: Give text breathing room. Avoid tight padding or lines that feel compressed.
- **No overflowing text**: Text must never overflow its container. Truncate or wrap as needed.
- **Button inner padding**: Button content must never touch the button's outer edge. Always use sufficient horizontal padding (`px-4` minimum, `px-6` for larger buttons) so text and icons have breathing room.
- **Button text centered**: Text or icons inside buttons must always be perfectly centered horizontally and vertically.
- **Dominant CTAs**: For main upload actions, use striking, dominant buttons — not subtle or secondary-styled ones.
- **Popups centered**: Any modal, popup, or dialog must appear centered on screen.
- **Icon consistency**: New icons must match the existing theme — standard, unique, meaningful. Don't introduce random icon styles.
- **New UI must fit the theme**: Anything newly designed must be visually consistent with the rest of the app — colors, spacing, typography, component style.
- **Equidistant grid spacing**: In image grids (e.g. upload guide panels), vertical and horizontal gaps must be equal for uniform spacing.
- **Inline rename UX (Don Norman)**: Editable names must have clear signifiers (pencil icon + hover highlight), explicit Save/Cancel buttons (not silent blur-save), a brief "Saved!" confirmation with a checkmark, and keyboard support (Enter to save, Escape to cancel). The pattern must be consistent across all cards (ModelCard, AssetCard). Never use tiny cramped icons or rely on auto-save without feedback.
- **Cursor affordance (NNG standard)**: `cursor-pointer` (hand) is reserved for links and navigation elements only. Buttons and action controls use the default cursor — their visual design is their affordance. Drop zones and drag targets may use `cursor-pointer`. Never add `cursor-pointer` to `<button>` elements or the base Button component.
- **Cross-device & cross-browser compatibility**: Every UI element must be designed mobile-first using responsive prefixes (`sm:`, `md:`, `lg:`). All layouts must be functional across all screen sizes, all major browsers (Chrome, Firefox, Safari, Edge), and all device types (mobile, tablet, desktop). No layout, interaction, or feature may break at any viewport size.

## Engineering Rules

- **Minimal blast radius**: Before fixing a bug or adding a feature, check if it can be done with the smallest possible change. Avoid touching unrelated code. Prefer surgical edits to avoid regressions.

## PostHog Rules

- **Do not touch `src/main.tsx`'s PostHog block**: The eager init with `bootstrap` is intentional — it fixes returning users appearing as anonymous UUIDs in session replay. Do not revert to lazy loading or remove the bootstrap option.
- **Never call `posthog.capture()` directly in components**: All tracking must go through `src/lib/posthog-events.ts`. Add new events there if needed.
