import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } =
      await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return json({ error: "Unauthorized" }, 401);
    }
    const callerId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => null);
    const targetUserId = body?.user_id;
    if (typeof targetUserId !== "string" || targetUserId.length < 10) {
      return json({ error: "Invalid user_id" }, 400);
    }
    if (targetUserId === callerId) {
      return json({ error: "You cannot delete your own account here." }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Verify caller is super_admin
    const { data: callerRoles, error: rolesErr } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "super_admin")
      .maybeSingle();
    if (rolesErr) return json({ error: rolesErr.message }, 500);
    if (!callerRoles) return json({ error: "Forbidden" }, 403);

    // Refuse to delete another super_admin (safety)
    const { data: targetSA } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", targetUserId)
      .eq("role", "super_admin")
      .maybeSingle();
    if (targetSA) {
      return json(
        { error: "Cannot delete another super_admin. Revoke their role first." },
        400,
      );
    }

    // Delete dependent rows. No FK to auth.users, so be explicit.
    const { data: portfolios } = await admin
      .from("portfolios")
      .select("id")
      .eq("user_id", targetUserId);
    const portfolioIds = (portfolios ?? []).map((p) => p.id);
    if (portfolioIds.length > 0) {
      await admin.from("holdings").delete().in("portfolio_id", portfolioIds);
    }

    await Promise.all([
      admin.from("trade_journal").delete().eq("user_id", targetUserId),
      admin.from("daily_briefings").delete().eq("user_id", targetUserId),
      admin.from("alerts").delete().eq("user_id", targetUserId),
      admin.from("watchlist").delete().eq("user_id", targetUserId),
      admin.from("portfolios").delete().eq("user_id", targetUserId),
      admin.from("user_roles").delete().eq("user_id", targetUserId),
      admin.from("profiles").delete().eq("id", targetUserId),
    ]);

    const { error: delErr } = await admin.auth.admin.deleteUser(targetUserId);
    if (delErr) return json({ error: delErr.message }, 500);

    return json({ ok: true });
  } catch (e) {
    console.error("admin-delete-user unexpected error:", e);
    return json({ error: "An internal error occurred" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
