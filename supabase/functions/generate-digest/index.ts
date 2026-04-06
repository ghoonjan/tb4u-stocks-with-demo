import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FINNHUB_BASE = "https://finnhub.io/api/v1";

interface Holding {
  ticker: string;
  company_name: string | null;
  shares: number;
  avg_cost_basis: number;
  target_allocation_pct: number | null;
}

interface Quote {
  c: number;
  d: number;
  dp: number;
}

async function getQuote(symbol: string, apiKey: string): Promise<Quote | null> {
  try {
    const res = await fetch(
      `${FINNHUB_BASE}/quote?symbol=${symbol}&token=${apiKey}`
    );
    const data = await res.json();
    if (!data || data.c === 0) return null;
    return { c: data.c ?? 0, d: data.d ?? 0, dp: data.dp ?? 0 };
  } catch {
    return null;
  }
}

function generateEmailHtml(
  user: { email: string; id: string },
  holdings: Holding[],
  quotes: Map<string, Quote>,
  appUrl: string
): string {
  let totalValue = 0;
  let totalCost = 0;

  const holdingData = holdings.map((h) => {
    const q = quotes.get(h.ticker);
    const price = q?.c ?? h.avg_cost_basis;
    const posValue = h.shares * price;
    const costBasis = h.shares * h.avg_cost_basis;
    const pctChange = q?.dp ?? 0;
    totalValue += posValue;
    totalCost += costBasis;
    return { ...h, price, posValue, costBasis, pctChange };
  });

  const totalPL = totalValue - totalCost;
  const totalPLPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
  const direction = totalPL >= 0 ? "Up" : "Down";
  const subject = `TB4U Weekly: Your Portfolio ${direction} ${Math.abs(totalPLPct).toFixed(1)}% This Week`;

  // Sort for movers
  const sorted = [...holdingData].sort((a, b) => b.pctChange - a.pctChange);
  const topMovers = sorted.slice(0, 3).filter((h) => h.pctChange > 0);
  const bottomMovers = sorted
    .slice(-3)
    .reverse()
    .filter((h) => h.pctChange < 0);

  // Drift check
  const driftAlerts: string[] = [];
  holdingData.forEach((h) => {
    if (h.target_allocation_pct != null && totalValue > 0) {
      const actual = (h.posValue / totalValue) * 100;
      const diff = Math.abs(actual - Number(h.target_allocation_pct));
      if (diff > 5) {
        driftAlerts.push(
          `${h.ticker}: target ${Number(h.target_allocation_pct).toFixed(0)}% → actual ${actual.toFixed(1)}%`
        );
      }
    }
  });

  // Tax-loss opportunities
  const taxLosses = holdingData.filter(
    (h) => h.posValue < h.costBasis && h.costBasis - h.posValue > 100
  );

  const fmtDollar = (n: number) =>
    "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const gainColor = "#22c55e";
  const lossColor = "#ef4444";
  const plColor = totalPL >= 0 ? gainColor : lossColor;

  const unsubUrl = `${appUrl}?action=unsubscribe&uid=${user.id}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:0 auto;background-color:#0a0a14;color:#d4d8e8;padding:0;">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#0a0a14,#141428);padding:32px 24px;text-align:center;border-bottom:1px solid #1e1e3a;">
    <p style="margin:0;font-size:11px;letter-spacing:3px;color:#3b82f6;font-weight:700;">TB4U</p>
    <h1 style="margin:12px 0 4px;font-size:28px;font-weight:700;color:#d4d8e8;font-family:monospace;">
      ${fmtDollar(totalValue)}
    </h1>
    <p style="margin:0;font-size:16px;color:${plColor};font-weight:600;">
      ${totalPL >= 0 ? "▲" : "▼"} ${totalPL >= 0 ? "+" : "-"}${fmtDollar(totalPL)} (${totalPL >= 0 ? "+" : ""}${totalPLPct.toFixed(2)}%)
    </p>
  </div>

  <!-- Top Movers -->
  ${
    topMovers.length > 0
      ? `<div style="padding:24px;border-bottom:1px solid #1e1e3a;">
    <h2 style="margin:0 0 12px;font-size:14px;color:#3b82f6;">🚀 Top Movers</h2>
    ${topMovers
      .map(
        (h) => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #1e1e3a33;">
        <span style="font-weight:600;font-size:14px;">${h.ticker}</span>
        <span style="color:${gainColor};font-family:monospace;font-size:14px;">▲ +${h.pctChange.toFixed(2)}%</span>
      </div>`
      )
      .join("")}
    </div>`
      : ""
  }

  <!-- Bottom Movers -->
  ${
    bottomMovers.length > 0
      ? `<div style="padding:24px;border-bottom:1px solid #1e1e3a;">
    <h2 style="margin:0 0 12px;font-size:14px;color:#ef4444;">📉 Biggest Decliners</h2>
    ${bottomMovers
      .map(
        (h) => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #1e1e3a33;">
        <span style="font-weight:600;font-size:14px;">${h.ticker}</span>
        <span style="color:${lossColor};font-family:monospace;font-size:14px;">▼ ${h.pctChange.toFixed(2)}%</span>
      </div>`
      )
      .join("")}
    </div>`
      : ""
  }

  <!-- Drift Alerts -->
  ${
    driftAlerts.length > 0
      ? `<div style="padding:24px;border-bottom:1px solid #1e1e3a;">
    <h2 style="margin:0 0 12px;font-size:14px;color:#f59e0b;">⚠️ Drift Alert</h2>
    <p style="margin:0;font-size:12px;color:#9ca3af;">These positions have drifted more than 5% from target:</p>
    ${driftAlerts.map((d) => `<p style="margin:4px 0;font-size:13px;font-family:monospace;">${d}</p>`).join("")}
    </div>`
      : ""
  }

  <!-- Tax-Loss Opportunities -->
  ${
    taxLosses.length > 0
      ? `<div style="padding:24px;border-bottom:1px solid #1e1e3a;">
    <h2 style="margin:0 0 12px;font-size:14px;color:#8b5cf6;">💰 Tax-Loss Harvesting</h2>
    ${taxLosses
      .map(
        (h) => `<div style="display:flex;justify-content:space-between;padding:8px 0;">
        <span style="font-size:13px;">${h.ticker}</span>
        <span style="color:${lossColor};font-family:monospace;font-size:13px;">-${fmtDollar(h.costBasis - h.posValue)} unrealized loss</span>
      </div>`
      )
      .join("")}
    </div>`
      : ""
  }

  <!-- CTA -->
  <div style="padding:32px 24px;text-align:center;">
    <a href="${appUrl}" style="display:inline-block;background:#3b82f6;color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
      Open TB4U →
    </a>
  </div>

  <!-- Footer -->
  <div style="padding:16px 24px;text-align:center;border-top:1px solid #1e1e3a;">
    <p style="margin:0;font-size:11px;color:#6b7280;">
      You're receiving this because you enabled email digests.
      <a href="${unsubUrl}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
    </p>
  </div>
</div>
</body>
</html>`;

  return JSON.stringify({ subject, html });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const finnhubKey = Deno.env.get("FINNHUB_API_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase config" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!finnhubKey) {
      return new Response(JSON.stringify({ error: "FINNHUB_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!resendKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse optional params
    let targetFrequency = "weekly";
    let targetTime = "morning";
    try {
      const body = await req.json();
      if (body.frequency) targetFrequency = body.frequency;
      if (body.time) targetTime = body.time;
    } catch {
      // cron calls may send minimal body
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Get users with digest enabled matching this frequency + time
    const { data: users, error: usersErr } = await supabase
      .from("profiles")
      .select("id, email, email_digest_enabled, digest_frequency, digest_preferred_time")
      .eq("email_digest_enabled", true)
      .eq("digest_frequency", targetFrequency)
      .eq("digest_preferred_time", targetTime);

    if (usersErr) throw new Error(usersErr.message);
    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No users to send to" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appUrl = supabaseUrl.replace(".supabase.co", ".lovable.app").replace("https://", "https://id-preview--");
    let sent = 0;

    for (const user of users) {
      if (!user.email) continue;

      // Get user's portfolio
      const { data: portfolios } = await supabase
        .from("portfolios")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);

      if (!portfolios || portfolios.length === 0) continue;

      const { data: holdings } = await supabase
        .from("holdings")
        .select("ticker, company_name, shares, avg_cost_basis, target_allocation_pct")
        .eq("portfolio_id", portfolios[0].id);

      if (!holdings || holdings.length === 0) continue;

      // Fetch quotes with delays
      const quotes = new Map<string, Quote>();
      const tickers = [...new Set(holdings.map((h: Holding) => h.ticker))];
      for (let i = 0; i < tickers.length; i++) {
        const q = await getQuote(tickers[i], finnhubKey);
        if (q) quotes.set(tickers[i], q);
        if (i < tickers.length - 1) await new Promise((r) => setTimeout(r, 250));
      }

      const emailData = generateEmailHtml(user, holdings as Holding[], quotes, appUrl);
      const { subject, html } = JSON.parse(emailData);

      // Send via Resend
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "TB4U <digest@resend.dev>",
          to: [user.email],
          subject,
          html,
        }),
      });

      if (resendRes.ok) {
        sent++;
      } else {
        const errBody = await resendRes.text();
        console.error(`Failed to send to ${user.email}: ${errBody}`);
      }

      // Small delay between users
      await new Promise((r) => setTimeout(r, 500));
    }

    return new Response(JSON.stringify({ sent, total: users.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Digest error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
