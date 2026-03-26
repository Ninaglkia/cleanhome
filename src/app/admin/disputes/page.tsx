import { createAdminClient } from "@/lib/supabase/admin";
import { DisputesList, type Dispute } from "./disputes-list";

export const dynamic = "force-dynamic";

export default async function AdminDisputesPage() {
  const supabase = createAdminClient();

  const { data: disputes } = await supabase
    .from("disputes")
    .select(
      `id, status, client_description, ai_suggestion, admin_decision_percentage,
       created_at, resolved_at,
       client:profiles!disputes_client_id_fkey(id, full_name, email),
       cleaner:profiles!disputes_cleaner_id_fkey(id, full_name, email),
       booking:bookings!disputes_booking_id_fkey(
         id, service_type, scheduled_date, total_price,
         photos:booking_photos(id, photo_url, type, uploaded_by)
       )`
    )
    .order("status", { ascending: true }) // open first
    .order("created_at", { ascending: false });

  const all = (disputes ?? []) as unknown as Dispute[];
  const open = all.filter((d) => d.status === "open");
  const resolved = all.filter((d) => d.status !== "open");

  return (
    <div className="p-8">
      <h1 className="font-serif text-2xl text-primary mb-1">Dispute</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Gestione dispute tra clienti e pulitori
      </p>
      <DisputesList open={open} resolved={resolved} />
    </div>
  );
}
