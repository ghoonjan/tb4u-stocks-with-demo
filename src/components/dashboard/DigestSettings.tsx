import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mail, Clock, CalendarDays, Loader2 } from "lucide-react";

interface DigestSettingsProps {
  open: boolean;
  onClose: () => void;
}

interface DigestPrefs {
  email_digest_enabled: boolean;
  digest_frequency: string;
  digest_preferred_time: string;
}

export function DigestSettings({ open, onClose }: DigestSettingsProps) {
  const [prefs, setPrefs] = useState<DigestPrefs>({
    email_digest_enabled: false,
    digest_frequency: "weekly",
    digest_preferred_time: "morning",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("profiles")
        .select("email_digest_enabled, digest_frequency, digest_preferred_time")
        .eq("id", session.user.id)
        .single();
      if (data) {
        setPrefs({
          email_digest_enabled: data.email_digest_enabled,
          digest_frequency: data.digest_frequency,
          digest_preferred_time: data.digest_preferred_time,
        });
      }
      setLoading(false);
    })();
  }, [open]);

  const save = async (updates: Partial<DigestPrefs>) => {
    const newPrefs = { ...prefs, ...updates };
    setPrefs(newPrefs);
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { error } = await supabase
      .from("profiles")
      .update({
        email_digest_enabled: newPrefs.email_digest_enabled,
        digest_frequency: newPrefs.digest_frequency,
        digest_preferred_time: newPrefs.digest_preferred_time,
      })
      .eq("id", session.user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: "Could not save preferences.", variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Digest preferences updated." });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Mail size={18} className="text-primary" />
            Email Digest Settings
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-2">
            {/* Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Email Digest</p>
                <p className="text-xs text-muted-foreground">
                  Receive a summary of your portfolio performance
                </p>
              </div>
              <Switch
                checked={prefs.email_digest_enabled}
                onCheckedChange={(checked) => save({ email_digest_enabled: checked })}
                aria-label="Toggle email digest"
              />
            </div>

            {prefs.email_digest_enabled && (
              <>
                {/* Frequency */}
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <CalendarDays size={14} className="text-muted-foreground" />
                    Frequency
                  </label>
                  <Select
                    value={prefs.digest_frequency}
                    onValueChange={(v) => save({ digest_frequency: v })}
                  >
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly (Monday)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Preferred Time */}
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <Clock size={14} className="text-muted-foreground" />
                    Preferred Time
                  </label>
                  <Select
                    value={prefs.digest_preferred_time}
                    onValueChange={(v) => save({ digest_preferred_time: v })}
                  >
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="morning">Morning (7 AM ET)</SelectItem>
                      <SelectItem value="evening">Evening (6 PM ET)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Digests are sent to your account email. You can unsubscribe anytime from the email footer.
                </p>
              </>
            )}

            {saving && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Loader2 size={10} className="animate-spin" /> Saving…
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
