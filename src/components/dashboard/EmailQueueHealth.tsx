import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Health {
  stuck_count: number;
  oldest_pending_at: string | null;
  oldest_age_seconds: number;
}

const formatAge = (s: number) => {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

export const EmailQueueHealth = () => {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase.rpc("get_email_queue_health");
    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    const row = Array.isArray(data) ? data[0] : data;
    setHealth(row as Health);
  };

  useEffect(() => {
    void load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  if (error) return null;
  if (!health) return null;

  const isStuck = health.stuck_count > 0;

  return (
    <section
      className={`layer-modal mb-6 p-4 border ${
        isStuck ? "border-destructive/50 bg-destructive/5" : "border-border"
      }`}
    >
      <div className="flex items-center gap-3">
        {isStuck ? (
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
        ) : (
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          {isStuck ? (
            <>
              <p className="text-sm font-medium text-destructive">
                Email queue stuck — {health.stuck_count} email
                {health.stuck_count === 1 ? "" : "s"} waiting{" "}
                {formatAge(health.oldest_age_seconds)}+
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                The dispatcher cron may have lost auth (service-role key
                rotation). Ask Lovable to re-run email infrastructure setup.
              </p>
            </>
          ) : (
            <p className="text-sm text-foreground">
              Email queue healthy — no emails stuck pending.
            </p>
          )}
        </div>
        <button
          onClick={load}
          className="rounded-md border border-border bg-secondary px-2.5 py-1 text-xs text-foreground hover:bg-accent transition-colors"
        >
          Refresh
        </button>
      </div>
    </section>
  );
};

export default EmailQueueHealth;
