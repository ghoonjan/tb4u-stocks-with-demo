

## Config Files Review — Results

### Summary

| File | Status | Notes |
|------|--------|-------|
| `tsconfig.json` | ✅ Clean | Standard project references setup |
| `tsconfig.app.json` | ✅ Clean | Proper path aliases, vitest types |
| `tsconfig.node.json` | ✅ Clean | Node-specific config |
| `vite.config.ts` | ✅ Clean | Correct aliases, HMR overlay disabled, lovable-tagger in dev only |
| `postcss.config.js` | ✅ Clean | Standard Tailwind setup |
| `components.json` | ✅ Clean | shadcn/ui config |
| **`tailwind.config.ts`** | **⚠️ Minor cleanup needed** | See below |

### Tailwind Config Issues

1. **Stale content paths**: The config scans `./pages/**`, `./components/**`, and `./app/**` at the project root — but no such directories exist. All source files are under `./src/**`. These extra globs are harmless (no false matches) but are misleading dead config. They should be removed, keeping only `./src/**/*.{ts,tsx}` and `./index.html`.

2. **Unused theme tokens**: `surface` and `elevated` color tokens are defined but never used anywhere in the codebase. `overlay` is used in exactly one place. These are fine to keep as part of the design system, but worth noting — no action needed unless you want a leaner config.

### Plan

**File: `tailwind.config.ts`** — Remove the three unused content globs:

```
// Before
content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"]

// After
content: ["./index.html", "./src/**/*.{ts,tsx}"]
```

That is the only change needed. Everything else in the config files is clean and correct.

