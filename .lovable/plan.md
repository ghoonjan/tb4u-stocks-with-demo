
I have not given up. The previous fixes focused on widths, but the code now points to a different root cause.

Problem I can see in the current code:
1. The body rows use `row-accent-border` on the `<tr>`, and in `src/index.css` that class adds a `::before` pseudo-element to the table row itself.
2. The header also uses `sticky top-0` on the `<tr>` instead of on each `<th>`.
3. Both of those are fragile in real table layout engines, especially on Safari/WebKit, and can make the body behave like it has an extra leading cell or make the header and body calculate widths differently.
4. That matches your screenshot much better than a simple width problem: the data appears visually shifted even though the number of `<th>` and `<td>` cells is correct.

Plan to fix it properly

1. Remove layout-affecting styling from table rows
- In `src/components/dashboard/HoldingsTable.tsx`, remove `row-accent-border` from the main holding `<tr>`.
- Keep the hover background, cursor, and transition classes on the row, but stop using any pseudo-element on `<tr>`.

2. Move the left accent into the first cell instead of the row
- In `HoldingRow`, add the accent to the first ticker cell only, using a wrapper inside the first `<td>` or a first-cell class.
- This preserves the visual blue accent without letting table layout treat the row like it has an extra generated box.

3. Fix sticky header implementation
- In `src/components/dashboard/HoldingsTable.tsx`, remove `sticky top-0 z-10` from the header `<tr>`.
- Apply sticky positioning to each `<th>` instead, with `sticky top-0 z-10 bg-card`.
- This is the safer pattern for table headers and should keep header/body columns using the same layout rules.

4. Keep one width strategy only
- Keep the current `<colgroup>` as the single source of desktop column widths.
- Do not reintroduce per-cell width classes on `<th>` or `<td>`.
- Keep the ticker text truncation separate from layout so company name width does not affect column placement.

5. Verify against the exact failure you described
- Confirm the first visible value under `TICKER` is `CSCO`.
- Confirm `16.2917` sits under `SHARES`, `$71.82` under `AVG COST`, and the rest follow correctly.
- Check desktop with the sidebar visible and with horizontal scroll, since that is where the bug is most likely to show up.

Files to update
- `src/components/dashboard/HoldingsTable.tsx`
- `src/index.css`

Technical note
The strongest suspect is the `::before` pseudo-element on `.row-accent-border` applied to a `<tr>`. In table layout, generated content on row boxes is unreliable and can create the exact “everything shifted one column” symptom you are seeing. The sticky header on `<tr>` is the second likely contributor. I would treat those as the real fix target, not column math alone.
