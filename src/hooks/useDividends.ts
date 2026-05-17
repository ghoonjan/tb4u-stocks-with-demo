import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Dividend {
  id: string;
  user_id: string;
  holding_id: string;
  ticker: string;
  amount_per_share: number;
  shares_at_time: number;
  total_amount: number;
  ex_date: string;
  pay_date: string | null;
  frequency: 'monthly' | 'quarterly' | 'semi-annual' | 'annual' | 'special' | 'other';
  is_reinvested: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DividendInput {
  holding_id: string;
  ticker: string;
  amount_per_share: number;
  shares_at_time: number;
  ex_date: string;
  pay_date?: string | null;
  frequency?: string;
  is_reinvested?: boolean;
  notes?: string | null;
}

export interface DividendSummary {
  totalYTD: number;
  totalAllTime: number;
  projectedAnnual: number;
  monthlyBreakdown: { month: string; total: number }[];
  byHolding: { ticker: string; total: number; count: number }[];
  averageMonthly: number;
}

export function useDividends(holdingId?: string) {
  const [dividends, setDividends] = useState<Dividend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDividends = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let query = supabase
        .from('dividends')
        .select('*')
        .eq('user_id', user.id)
        .order('pay_date', { ascending: false });

      if (holdingId) {
        query = query.eq('holding_id', holdingId);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setDividends((data || []) as Dividend[]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [holdingId]);

  useEffect(() => {
    fetchDividends();
  }, [fetchDividends]);

  const addDividend = async (input: DividendInput): Promise<Dividend | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error: insertError } = await supabase
        .from('dividends')
        .insert({
          user_id: user.id,
          holding_id: input.holding_id,
          ticker: input.ticker,
          amount_per_share: input.amount_per_share,
          shares_at_time: input.shares_at_time,
          ex_date: input.ex_date,
          pay_date: input.pay_date || null,
          frequency: input.frequency || 'quarterly',
          is_reinvested: input.is_reinvested || false,
          notes: input.notes || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      setDividends(prev => [data as Dividend, ...prev]);
      return data as Dividend;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  };

  const updateDividend = async (id: string, updates: Partial<DividendInput>): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from('dividends')
        .update(updates)
        .eq('id', id);

      if (updateError) throw updateError;
      setDividends(prev =>
        prev.map(d => (d.id === id ? { ...d, ...updates } as Dividend : d))
      );
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  };

  const deleteDividend = async (id: string): Promise<boolean> => {
    try {
      const { error: deleteError } = await supabase
        .from('dividends')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      setDividends(prev => prev.filter(d => d.id !== id));
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  };

  const getSummary = useCallback((): DividendSummary => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Safe date parser — avoids timezone issues with YYYY-MM-DD strings
    const parseDate = (dateStr: string) => {
      const parts = dateStr.split('-');
      return {
        year: parseInt(parts[0], 10),
        month: parseInt(parts[1], 10),
        day: parseInt(parts[2], 10),
      };
    };

    const totalAllTime = dividends.reduce((sum, d) => sum + Number(d.total_amount), 0);

    // Trailing 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const cutoffYear = twelveMonthsAgo.getFullYear();
    const cutoffMonth = twelveMonthsAgo.getMonth() + 1;
    const cutoffDay = twelveMonthsAgo.getDate();

    const totalYTD = dividends
      .filter(d => {
        const parsed = parseDate(d.pay_date || d.ex_date);
        if (parsed.year > cutoffYear) return true;
        if (parsed.year === cutoffYear && parsed.month > cutoffMonth) return true;
        if (parsed.year === cutoffYear && parsed.month === cutoffMonth && parsed.day >= cutoffDay) return true;
        return false;
      })
      .reduce((sum, d) => sum + Number(d.total_amount), 0);

    // Projected annual = trailing 12 months (already a full year of data)
    const projectedAnnual = totalYTD;

    const monthlyMap = new Map<string, number>();
    dividends.forEach(d => {
      const parsed = parseDate(d.pay_date || d.ex_date);
      const key = `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
      monthlyMap.set(key, (monthlyMap.get(key) || 0) + Number(d.total_amount));
    });

    const monthlyBreakdown = Array.from(monthlyMap.entries())
      .map(([month, total]) => ({ month, total }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);

    const distinctMonths = Math.max(monthlyMap.size, 1);
    const averageMonthly = totalAllTime / distinctMonths;

    const holdingMap = new Map<string, { total: number; count: number }>();
    dividends.forEach(d => {
      const existing = holdingMap.get(d.ticker) || { total: 0, count: 0 };
      holdingMap.set(d.ticker, {
        total: existing.total + Number(d.total_amount),
        count: existing.count + 1,
      });
    });

    const byHolding = Array.from(holdingMap.entries())
      .map(([ticker, data]) => ({ ticker, ...data }))
      .sort((a, b) => b.total - a.total);

    return {
      totalYTD,
      totalAllTime,
      projectedAnnual,
      monthlyBreakdown,
      byHolding,
      averageMonthly,
    };
  }, [dividends]);

  return {
    dividends,
    loading,
    error,
    addDividend,
    updateDividend,
    deleteDividend,
    fetchDividends,
    getSummary,
  };
}
