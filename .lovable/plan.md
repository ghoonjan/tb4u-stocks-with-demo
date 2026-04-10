

## SEO & Performance Audit Results

### Current State

| Check | Status | Details |
|-------|--------|---------|
| **Title tag** | ✅ Good | `TB4U — Portfolio Dashboard` |
| **Meta description** | ✅ Good | `TB4U — Stock Portfolio Command Center` |
| **Open Graph tags** | ⚠️ Needs cleanup | OG title/description present, but there's a stale `TODO` comment and the OG image URL uses a time-limited signed URL that will expire |
| **Twitter cards** | ⚠️ Needs update | `twitter:site` still says `@Lovable` instead of your brand |
| **Favicon** | ✅ Good | `/favicon.png` is set |
| **Image alt texts** | ⚠️ Minor | 2 `<img>` tags in modals have empty `alt=""` — should use descriptive alt like `${ticker} logo` |
| **Lazy loading** | ✅ N/A | Only 2 small logo images in the app — lazy loading not needed |
| **Responsive design** | ✅ Good | Mobile components exist (`MobileHoldingCard`, `useIsMobile` hook) |
| **Accessibility** | ✅ Mostly good | Using shadcn/ui which has built-in a11y; minor alt text fix needed |
| **`lang` attribute** | ✅ Good | `<html lang="en">` is set |
| **Author meta** | ⚠️ | Still says `Lovable` — should be `TechBargains4You` |

### Plan — Fix SEO Issues

1. **Clean up `index.html`**:
   - Remove the `TODO` comment and duplicate blank lines
   - Update `meta author` from `Lovable` to `TechBargains4You`
   - Update `twitter:site` from `@Lovable` to your Twitter handle (or remove if none)
   - Add `og:url` meta tag pointing to `https://dawnlight-folio.lovable.app`
   - Note: The OG image uses a signed URL with an expiration date — consider hosting a permanent OG image in `public/`

2. **Fix image alt texts** in `HoldingModal.tsx` and `WatchlistModal.tsx`:
   - Change `alt=""` to `alt={`${ticker} logo`}` for the ticker logo images

3. **Add `theme-color` meta tag** for mobile browser chrome styling

### Technical Details

| File | Change |
|------|--------|
| `index.html` | Clean up meta tags, update author/twitter, add og:url and theme-color |
| `src/components/dashboard/HoldingModal.tsx` | Fix img alt text |
| `src/components/dashboard/WatchlistModal.tsx` | Fix img alt text |

### Out of Scope (Manual Steps)

- **Lighthouse audit**: Run after deployment via Chrome DevTools → Lighthouse tab
- **OG image**: Consider uploading a permanent branded OG image to `public/og-image.png` to replace the expiring signed URL — you would need to provide the image

