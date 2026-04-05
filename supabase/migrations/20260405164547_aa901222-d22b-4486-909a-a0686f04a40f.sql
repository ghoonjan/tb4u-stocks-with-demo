
-- alerts
ALTER POLICY "Users can view own alerts" ON public.alerts TO authenticated;
ALTER POLICY "Users can insert own alerts" ON public.alerts TO authenticated;
ALTER POLICY "Users can update own alerts" ON public.alerts TO authenticated;
ALTER POLICY "Users can delete own alerts" ON public.alerts TO authenticated;

-- holdings
ALTER POLICY "Users can view own holdings" ON public.holdings TO authenticated;
ALTER POLICY "Users can insert own holdings" ON public.holdings TO authenticated;
ALTER POLICY "Users can update own holdings" ON public.holdings TO authenticated;
ALTER POLICY "Users can delete own holdings" ON public.holdings TO authenticated;

-- portfolios
ALTER POLICY "Users can view own portfolios" ON public.portfolios TO authenticated;
ALTER POLICY "Users can insert own portfolios" ON public.portfolios TO authenticated;
ALTER POLICY "Users can update own portfolios" ON public.portfolios TO authenticated;
ALTER POLICY "Users can delete own portfolios" ON public.portfolios TO authenticated;

-- profiles
ALTER POLICY "Users can view own profile" ON public.profiles TO authenticated;
ALTER POLICY "Users can insert own profile" ON public.profiles TO authenticated;
ALTER POLICY "Users can update own profile" ON public.profiles TO authenticated;

-- trade_journal
ALTER POLICY "Users can view own trades" ON public.trade_journal TO authenticated;
ALTER POLICY "Users can insert own trades" ON public.trade_journal TO authenticated;
ALTER POLICY "Users can update own trades" ON public.trade_journal TO authenticated;
ALTER POLICY "Users can delete own trades" ON public.trade_journal TO authenticated;

-- watchlist
ALTER POLICY "Users can view own watchlist" ON public.watchlist TO authenticated;
ALTER POLICY "Users can insert own watchlist" ON public.watchlist TO authenticated;
ALTER POLICY "Users can update own watchlist" ON public.watchlist TO authenticated;
ALTER POLICY "Users can delete own watchlist" ON public.watchlist TO authenticated;
