import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ai_not_configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const body = await req.json();
    const regenerate = Boolean(body?.regenerate);
    const rawCtx = body?.portfolioContext;

    // Validate portfolioContext: strict shape, types, and length limits.
    // This prevents prompt injection by ensuring fields cannot contain
    // arbitrarily long or structured payloads designed to override the system prompt.
    if (!rawCtx || typeof rawCtx !== "object") {
      return new Response(JSON.stringify({ error: "Invalid portfolioContext" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const REQUIRED_FIELDS = [
      "totalValue",
      "todayPL",
      "holdings",
      "upcomingEvents",
      "biggestMovers",
      "spyChange",
      "taxOpportunities",
      "driftStatus",
    ] as const;

    // Strip control characters, collapse whitespace/newlines, and clamp length.
    // Newlines are the primary vector for injecting fake "system:" turns into the prompt.
    const sanitize = (v: unknown, maxLen: number): string => {
      if (typeof v !== "string") return "";
      return v
        .replace(/[\u0000-\u001F\u007F]/g, " ") // control chars incl. newlines/tabs
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxLen);
    };

    const FIELD_LIMITS: Record<(typeof REQUIRED_FIELDS)[number], number> = {
      totalValue: 40,
      todayPL: 60,
      holdings: 2000,
      upcomingEvents: 500,
      biggestMovers: 300,
      spyChange: 20,
      taxOpportunities: 500,
      driftStatus: 100,
    };

    const portfolioContext: Record<string, string> = {};
    for (const field of REQUIRED_FIELDS) {
      portfolioContext[field] = sanitize(rawCtx[field], FIELD_LIMITS[field]);
    }

    // Check for existing briefing today
    const today = new Date().toISOString().slice(0, 10);
    const { data: existing } = await supabase
      .from("daily_briefings")
      .select("*")
      .eq("user_id", userId)
      .eq("briefing_date", today)
      .maybeSingle();

    if (existing && !regenerate) {
      return new Response(JSON.stringify({ briefing: existing }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit: max 3 regenerations per day
    if (existing && existing.generation_count >= 3) {
      return new Response(
        JSON.stringify({ error: "max_regenerations", briefing: existing }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build prompt
    const prompt = `You are a professional portfolio analyst giving a morning briefing. Be concise, specific, and actionable. Use the following portfolio data to write a 4-6 sentence morning briefing:

Portfolio Value: ${portfolioContext.totalValue}
Today's P&L: ${portfolioContext.todayPL}
Holdings: ${portfolioContext.holdings}
Upcoming Events: ${portfolioContext.upcomingEvents}
Biggest Movers: ${portfolioContext.biggestMovers}
S&P 500: ${portfolioContext.spyChange}
Tax Opportunities: ${portfolioContext.taxOpportunities}
Drift Status: ${portfolioContext.driftStatus}

Format: Start with a one-line summary of the portfolio's status. Then cover the most important 2-3 things the investor should know today. End with one actionable suggestion. Keep total response under 150 words. Do not use bullet points — write in natural flowing sentences.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a professional portfolio analyst. Be concise and actionable." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content ?? "Unable to generate briefing.";

    // Upsert briefing
    if (existing) {
      const { data: updated, error } = await supabase
        .from("daily_briefings")
        .update({
          content,
          generation_count: existing.generation_count + 1,
          created_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        console.error("Update error:", error);
        return new Response(JSON.stringify({ error: "Failed to save briefing" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ briefing: updated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      const { data: created, error } = await supabase
        .from("daily_briefings")
        .insert({
          user_id: userId,
          content,
          briefing_date: today,
          generation_count: 1,
        })
        .select()
        .single();

      if (error) {
        console.error("Insert error:", error);
        return new Response(JSON.stringify({ error: "Failed to save briefing" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ briefing: created }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("Briefing error:", e);
    return new Response(
      JSON.stringify({ error: "An internal error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
