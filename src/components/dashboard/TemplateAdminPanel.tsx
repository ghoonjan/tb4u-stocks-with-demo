import { Link } from "react-router-dom";
import { Settings } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

interface Props {
  userId: string;
}

export function TemplateAdminPanel({ userId: _userId }: Props) {
  const { loading, isSuperAdmin } = useUserRole();
  if (loading || !isSuperAdmin) return null;

  return (
    <div className="mx-auto w-full max-w-[1600px] px-2 sm:px-4 pt-3">
      <div className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Super admin · manage what new users receive on first login.
        </p>
        <Link
          to="/admin/templates"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1 text-xs font-medium text-foreground hover:bg-accent transition-colors"
        >
          <Settings size={12} /> Manage templates
        </Link>
      </div>
    </div>
  );
}
