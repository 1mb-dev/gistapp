# Design System

Gist uses an "Editorial Craft" aesthetic — warm, restrained, and readable. The entire design system lives in CSS custom properties. No utility classes, no CSS framework.

## Tokens

All design tokens are defined in `src/styles/tokens.css` as `:root` custom properties. Dark mode overrides use `@media (prefers-color-scheme: dark)`.

### Color Palette

**Light mode:**

- Background: warm parchment (`#f6f5f0`) with raised (`#fdfcfa`) and sunken (`#eeedea`) surfaces
- Text: near-black (`#1a1816`) with secondary (`#4a4744`) and muted (`#9a968f`) levels
- Accent: deep indigo (`#3d32b0`) with hover (`#322898`) and subtle (`#eceafc`) variants
- Status: green success, warm orange warning, red error

**Dark mode:**

- Background: deep charcoal (`#121110`) with matching surface hierarchy
- Text: near-white (`#eeeded`) with matching secondary and muted
- Accent: soft indigo (`#8b94f7`) — lighter to maintain contrast on dark surfaces

### Typography

Three font families, all self-hosted:

| Family               | Role    | Usage                                 |
| -------------------- | ------- | ------------------------------------- |
| **Instrument Serif** | Display | Page headings, the "Gist" wordmark    |
| **DM Sans**          | Body    | All body text, labels, buttons        |
| **DM Mono**          | Code    | Monospace contexts, technical details |

Font sizes use fluid `clamp()` values for headings (`--text-2xl` through `--text-5xl`), scaling between mobile and desktop breakpoints. Body text uses fixed rem values (`--text-sm` through `--text-lg`).

Line heights: tight (1.1) for headings, relaxed (1.65) for body text.

### Spacing

An 8-point scale from `--space-1` (0.25rem) to `--space-24` (6rem). Use `--space-4` (1rem) as the base unit.

### Layout

- `--max-width: 680px` for content columns
- `--max-width-wide: 960px` for wider layouts
- Border radii from `--radius-sm` (6px) to `--radius-full` (pill)

### Shadows

Layered shadows for depth. Each level combines a tight shadow for definition with a diffuse shadow for atmosphere:

- `--shadow-sm` — subtle lift
- `--shadow-md` — cards and panels
- `--shadow-lg` — elevated overlays
- `--shadow-xl` — modals
- `--shadow-card` / `--shadow-card-hover` — interactive cards with accent border on hover
- `--shadow-accent` / `--shadow-accent-hover` — primary action buttons

### Motion

Three duration tiers: fast (150ms), normal (250ms), slow (500ms). Two easing curves: smooth (`--easing`) and bouncy (`--easing-bounce`).

All durations zero out under `prefers-reduced-motion: reduce`.

## Dark Mode

Dark mode is automatic — no toggle. The system respects `prefers-color-scheme` and swaps all tokens:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #121110;
    --color-text: #eeeded;
    --color-accent: #8b94f7;
    /* ... all tokens swapped */
  }
}
```

Components use token variables exclusively, so dark mode works without per-component overrides.

## Brand

- **Favicon:** Italic serif "G" on an indigo rounded-square. Dark mode variant uses lighter indigo.
- **Logo mark:** 24px inline SVG in the header, uses `--color-logo-from/to/fg` tokens for automatic theming.
- **OG image:** 1200x630 SVG with asymmetric layout — wordmark on the left, spec document mockup on the right.

## Accessibility

- All text meets WCAG AA contrast ratios (4.5:1 minimum)
- Focus states use visible outline with accent color
- Touch targets are 44px minimum
- No color-only indicators — icons and text accompany status colors
