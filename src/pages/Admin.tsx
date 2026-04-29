import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { LogoMark } from "@/components/LogoMark";
import { GradientMeshBackground } from "@/components/GradientMeshBackground";
import CopyrightFooter from "@/components/CopyrightFooter";

interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
}

interface RoleRow {
  user_id: string;
  role: "super_admin" | "admin" | "user";
}

const Admin = () => {
  const navigate = useNavigate();
  const { loading: roleLoading, isSuperAdmin, email, userId } = useUserRole();

  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [listLoading, setListLoading] = useState(true);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  // Access control
  useEffect(() => {
    if (roleLoading) return;
    if (!userId) {
      navigate("/auth");
      return;
    }
    if (!isSuperAdmin) {
      navigate("/");
    }
  }, [roleLoading, userId, isSuperAdmin, navigate]);

  const loadUsers = async () => {
    setListLoading(true);
    const [{ data: profilesData }, { data: rolesData }] = await Promise.all([
      supabase.from("profiles").select("id,email,display_name,created_at").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    setProfiles((profilesData ?? []) as ProfileRow[]);
    setRoles((rolesData ?? []) as RoleRow[]);
    setListLoading(false);
  };

  useEffect(() => {
    if (isSuperAdmin) void loadUsers();
  }, [isSuperAdmin]);

  const rolesByUser = roles.reduce<Record<string, string[]>>((acc, r) => {
    (acc[r.user_id] ||= []).push(r.role);
    return acc;
  }, {});

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password updated.");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const grantSuperAdmin = async (uid: string) => {
    const { error } = await supabase.from("user_roles").insert({ user_id: uid, role: "super_admin" });
    if (error) toast.error(error.message);
    else {
      toast.success("Granted super_admin.");
      void loadUsers();
    }
  };

  const revokeSuperAdmin = async (uid: string) => {
    if (uid === userId) {
      toast.error("You can't revoke your own super_admin role.");
      return;
    }
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", uid)
      .eq("role", "super_admin");
    if (error) toast.error(error.message);
    else {
      toast.success("Revoked super_admin.");
      void loadUsers();
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (roleLoading || !isSuperAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading admin…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background relative">
      <GradientMeshBackground />
      <div className="flex-1 px-4 py-8 relative z-10">
        <div className="mx-auto w-full max-w-4xl">
          <header className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LogoMark size={40} />
              <div>
                <h1 className="text-lg font-semibold text-foreground">Admin</h1>
                <p className="text-xs text-muted-foreground">Signed in as {email}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => navigate("/")}
                className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
              >
                Dashboard
              </button>
              <button
                onClick={handleSignOut}
                className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
              >
                Sign out
              </button>
            </div>
          </header>

          {/* Change password */}
          <section className="layer-modal mb-6 p-6">
            <h2 className="mb-4 text-base font-semibold text-foreground">Change your password</h2>
            <form onSubmit={handleChangePassword} className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  required
                  className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Confirm password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  required
                  className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={pwSaving}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {pwSaving ? "Saving…" : "Update password"}
                </button>
              </div>
            </form>
          </section>

          {/* Users list */}
          <section className="layer-modal p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Users</h2>
              <button
                onClick={loadUsers}
                className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
              >
                Refresh
              </button>
            </div>

            {listLoading ? (
              <p className="text-sm text-muted-foreground">Loading users…</p>
            ) : profiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2 pr-4">Joined</th>
                      <th className="py-2 pr-4">Roles</th>
                      <th className="py-2 pr-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.map((p) => {
                      const userRoles = rolesByUser[p.id] ?? [];
                      const isSA = userRoles.includes("super_admin");
                      return (
                        <tr key={p.id} className="border-b border-border/50">
                          <td className="py-3 pr-4 text-foreground">
                            {p.email ?? "—"}
                            {p.id === userId && (
                              <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">you</span>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground text-xs">
                            {new Date(p.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 pr-4">
                            {userRoles.length === 0 ? (
                              <span className="text-xs text-muted-foreground">user</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {userRoles.map((r) => (
                                  <span
                                    key={r}
                                    className={
                                      r === "super_admin"
                                        ? "rounded bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary"
                                        : "rounded bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground"
                                    }
                                  >
                                    {r}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-right">
                            {isSA ? (
                              <button
                                onClick={() => revokeSuperAdmin(p.id)}
                                disabled={p.id === userId}
                                className="rounded-md border border-border bg-secondary px-3 py-1 text-xs text-foreground hover:bg-accent disabled:opacity-40 transition-colors"
                              >
                                Revoke admin
                              </button>
                            ) : (
                              <button
                                onClick={() => grantSuperAdmin(p.id)}
                                className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                              >
                                Make super admin
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
      <CopyrightFooter />
    </div>
  );
};

export default Admin;
