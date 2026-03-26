import { createAdminClient } from "@/lib/supabase/admin";
import { PayoutsTable, type Payout } from "./payouts-table";

export const dynamic = "force-dynamic";

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const supabase = createAdminClient();

  let query = supabase
    .from("payouts")
    .select(
      `id, week_start, week_end, total_gross, commission_deducted, net_amount,
       stripe_transfer_id, status, created_at,
       cleaner:profiles!payouts_cleaner_id_fkey(id, full_name, email)`
    )
    .order("created_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data: payouts } = await query;

  return (
    <div className="p-8">
      <h1 className="font-serif text-2xl text-primary mb-1">Payout</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Gestione pagamenti settimanali ai pulitori
      </p>
      <PayoutsTable payouts={(payouts ?? []) as unknown as Payout[]} currentStatus={status ?? "all"} />
    </div>
  );
}
