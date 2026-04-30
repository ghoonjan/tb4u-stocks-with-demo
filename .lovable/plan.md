# Add Build Version Indicator to Footer

## Goal

Make it trivial to tell which build any device (iPad, phone, laptop) is currently running. Each production build will get a unique short hash + timestamp, displayed in the existing sticky footer next to the copyright line.

## What you'll see

The footer (already sticky at the bottom of every page) will read something like:

```text
© 2026 TechBargains4You. All rights reserved.  ·  v.a3f9c21 · 2026-04-30 14:22 UTC
```

If your iPad shows an older hash than your laptop, you'll know instantly it's a cache issue, not a deploy issue.

## Implementation

### 1. Generate version info at build time (`vite.config.ts`)

Inject two compile-time constants via Vite's `define`:

- `__BUILD_HASH__` — first 7 chars of a hash derived from build timestamp (stable across the bundle, unique per build)
- `__BUILD_TIME__` — ISO timestamp of the build

These are baked into the JS bundle when `vite build` runs, so every published deploy gets a fresh value. In `dev`, they'll show `dev` / current time so local previews are obvious.

### 2. Type declarations (`src/vite-env.d.ts`)

Add `declare const __BUILD_HASH__: string;` and `declare const __BUILD_TIME__: string;` so TypeScript is happy.

### 3. Update `CopyrightFooter.tsx`

Append a small, muted version string after the copyright. Keep it on the same line on desktop, wrapping naturally on narrow screens. Style stays subtle — same `text-xs text-muted-foreground`, separated by a middle dot.

Add a `title` tooltip on the version span showing the full build time so it's hover-readable on desktop.

### 4. No changes needed elsewhere

Footer is already mounted globally (sticky), so this single edit covers every page including `/`, `/auth`, `/admin`.

## Files touched

- `vite.config.ts` — add `define` block with build hash + time
- `src/vite-env.d.ts` — declare the two globals
- `src/components/CopyrightFooter.tsx` — render the version string

## Out of scope

- No service worker / PWA changes (you don't have one registered, which is correct).
- No git-SHA lookup — Lovable builds don't expose git in the build env reliably; a build-time hash is the robust equivalent and changes on every publish.
