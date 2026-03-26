import { createAdminClient } from "@/lib/supabase/admin";
import { UsersTable } from "./users-table";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; q?: string }>;
}) {
  const { role, q } = await searchParams;
  const supabase = createAdminClient();

  let query = supabase
    .from("profiles")
    .select("id, full_name, email, role, active_role, banned, created_at")
    .neq("role", "admin")
    .order("created_at", { ascending: false });

  if (role && role !== "all") {
    query = query.eq("role", role);
  }
  if (q) {
    query = query.ilike("full_name", `%${q}%`);
  }

  const { data: users } = await query;

  return (
    <div className="p-8">
      <h1 className="font-serif text-2xl text-primary mb-1">Utenti</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Gestione utenti della piattaforma
      </p>
      <UsersTable users={users ?? []} currentRole={role ?? "all"} currentQ={q ?? ""} />
    </div>
  );
}
