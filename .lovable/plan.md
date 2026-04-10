

## Add Test Suite for Critical Paths

Currently the project has only a placeholder `example.test.ts`. The testing infrastructure (vitest, jsdom, testing-library) is already configured. We need to add real tests.

### Tests to create

1. **`src/constants/index.test.ts`** — Unit tests for formatter functions (`fmt`, `fmtDollar`, `fmtPct`, `fmtPL`, `plColor`, `plArrow`). These are pure functions with clear expected outputs — ideal for unit testing.

2. **`src/lib/utils.test.ts`** — Unit tests for the `cn()` utility (class merging, conflict resolution, conditional classes).

3. **`src/components/AnimatedNumber.test.tsx`** — Component test verifying it renders, displays formatted output, and accepts custom format functions.

4. **`src/hooks/usePortfolioData.test.ts`** — Unit test for the `toDisplay` helper logic. We'll extract and test the pure transformation (holding + quote → display object) to verify P&L calculations, weight percentages, and edge cases (zero shares, missing quote).

### Technical details

- All tests use `vitest` + `@testing-library/react` (already installed)
- No mocking of Supabase needed for the pure-function tests
- The `toDisplay` function is not currently exported; we'll either export it or extract the calculation logic into a testable utility
- Tests will run via the existing vitest config with no changes needed

### Files changed

| File | Action |
|------|--------|
| `src/constants/index.test.ts` | Create — ~15 test cases for formatters |
| `src/lib/utils.test.ts` | Create — ~5 test cases for `cn()` |
| `src/components/AnimatedNumber.test.tsx` | Create — ~3 render tests |
| `src/hooks/portfolioUtils.ts` | Create — extract `toDisplay` as a pure exported function |
| `src/hooks/usePortfolioData.ts` | Update — import `toDisplay` from new file |
| `src/hooks/portfolioUtils.test.ts` | Create — ~8 test cases for P&L math |

