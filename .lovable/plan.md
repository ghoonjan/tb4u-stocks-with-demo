

## Clean Up Dual Lock Files

The project has both `bun.lock`/`bun.lockb` and `package-lock.json`. Lovable uses npm as its package manager, so the bun lock files are unnecessary.

### Plan

1. **Delete `bun.lock` and `bun.lockb`** from the project
2. **Add both to `.gitignore`** to prevent them from being recreated:
   - `bun.lock`
   - `bun.lockb`

This keeps `package-lock.json` as the single source of truth.

