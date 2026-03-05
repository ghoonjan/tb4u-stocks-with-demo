import { useState, useEffect, useCallback, useRef } from "react";
import { getCompanyNews, type NewsArticle } from "@/services/marketData";
import { NEWS_REFRESH_INTERVAL } from "@/constants";

export interface MergedNewsItem {
  id: string;
  headline: string;
  source: string;
  url: string;
  datetime: number;
  summary: string;
  image: string;
  tickers: string[];
  sentiment: "Bullish" | "Bearish" | "Neutral";
}

const BULLISH_WORDS = /surge|surges|beat|beats|upgrade|upgraded|growth|record|soar|rally|outperform|raises|exceeds|strong|boom|breakout|bullish/i;
const BEARISH_WORDS = /decline|declines|miss|misses|downgrade|downgraded|loss|losses|warning|crash|plunge|weak|cut|slash|bear|layoff|recall|lawsuit/i;

function deriveSentiment(headline: string): "Bullish" | "Bearish" | "Neutral" {
  if (BULLISH_WORDS.test(headline)) return "Bullish";
  if (BEARISH_WORDS.test(headline)) return "Bearish";
  return "Neutral";
}

export function useNewsFeed(tickers: string[]) {
  const [items, setItems] = useState<MergedNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const tickersKey = tickers.sort().join(",");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (tickers.length === 0) { setItems([]); setLoading(false); return; }
    if (isRefresh) setRefreshing(true); else setLoading(true);

    const allArticles: { article: NewsArticle; ticker: string }[] = [];

    for (let i = 0; i < tickers.length; i++) {
      try {
        const news = await getCompanyNews(tickers[i]);
        news.forEach((a) => allArticles.push({ article: a, ticker: tickers[i] }));
      } catch { /* skip */ }
      if (i < tickers.length - 1) await new Promise((r) => setTimeout(r, 300));
    }

    const headlineMap = new Map<string, MergedNewsItem>();
    for (const { article, ticker } of allArticles) {
      const key = article.headline.trim().toLowerCase();
      const existing = headlineMap.get(key);
      if (existing) {
        if (!existing.tickers.includes(ticker)) existing.tickers.push(ticker);
      } else {
        headlineMap.set(key, {
          id: `${article.id ?? article.datetime}-${ticker}`,
          headline: article.headline,
          source: article.source,
          url: article.url,
          datetime: article.datetime,
          summary: article.summary ?? "",
          image: article.image ?? "",
          tickers: [ticker],
          sentiment: deriveSentiment(article.headline),
        });
      }
    }

    const sorted = [...headlineMap.values()].sort((a, b) => b.datetime - a.datetime);
    setItems(sorted);
    setLoading(false);
    setRefreshing(false);
  }, [tickersKey]);

  useEffect(() => {
    fetchAll();
    intervalRef.current = setInterval(() => fetchAll(true), NEWS_REFRESH_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchAll]);

  return { items, loading, refreshing };
}
