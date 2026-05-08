DO $$
DECLARE
  dup RECORD;
  keeper_id UUID;
  total_shares NUMERIC;
  total_cost NUMERIC;
  avg_cost NUMERIC;
  earliest_date TIMESTAMPTZ;
BEGIN
  FOR dup IN
    SELECT portfolio_id, ticker
    FROM holdings
    GROUP BY portfolio_id, ticker
    HAVING COUNT(*) > 1
  LOOP
    SELECT id INTO keeper_id
    FROM holdings
    WHERE portfolio_id = dup.portfolio_id AND ticker = dup.ticker
    ORDER BY date_added ASC NULLS LAST
    LIMIT 1;

    UPDATE tax_lots
    SET holding_id = keeper_id
    WHERE holding_id IN (
      SELECT id FROM holdings
      WHERE portfolio_id = dup.portfolio_id
        AND ticker = dup.ticker
        AND id != keeper_id
    );

    DELETE FROM holdings
    WHERE portfolio_id = dup.portfolio_id
      AND ticker = dup.ticker
      AND id != keeper_id;

    SELECT
      COALESCE(SUM(shares_remaining), 0),
      COALESCE(SUM(shares_remaining * cost_basis_per_share), 0)
    INTO total_shares, total_cost
    FROM tax_lots
    WHERE holding_id = keeper_id;

    IF total_shares > 0 THEN
      avg_cost := ROUND(total_cost / total_shares, 4);
    ELSE
      avg_cost := 0;
    END IF;

    SELECT MIN(purchased_at)::timestamptz INTO earliest_date
    FROM tax_lots
    WHERE holding_id = keeper_id;

    UPDATE holdings
    SET shares = total_shares,
        avg_cost_basis = avg_cost,
        date_added = COALESCE(earliest_date, date_added)
    WHERE id = keeper_id;
  END LOOP;
END $$;