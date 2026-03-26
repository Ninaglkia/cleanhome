import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Threshold above which the cleaner gets auto-banned (82%)
const AUTO_BAN_THRESHOLD = 82;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin(req);
  if (guard) return guard;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const refundPct = Number(body.refund_percentage ?? 0);

  if (isNaN(refundPct) || refundPct < 0 || refundPct > 100) {
    return NextResponse.json(
      { error: "refund_percentage must be between 0 and 100" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Get the admin user id for resolved_by
  const serverClient = await createClient();
  const {
    data: { user: adminUser },
  } = await serverClient.auth.getUser();

  // Fetch dispute to get cleaner_id
  const { data: dispute, error: fetchError } = await supabase
    .from("disputes")
    .select("id, status, cleaner_id, booking_id")
    .eq("id", id)
    .single();

  if (fetchError || !dispute) {
    return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
  }

  if (dispute.status !== "open") {
    return NextResponse.json(
      { error: "Dispute is already resolved" },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();

  // Resolve the dispute
  const { error: updateError } = await supabase
    .from("disputes")
    .update({
      status: "resolved",
      admin_decision_percentage: refundPct,
      resolved_by: adminUser?.id ?? null,
      resolved_at: now,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Auto-ban cleaner if refund >= 82%
  if (refundPct >= AUTO_BAN_THRESHOLD && dispute.cleaner_id) {
    await supabase
      .from("profiles")
      .update({ banned: true })
      .eq("id", dispute.cleaner_id);
  }

  return NextResponse.json({
    success: true,
    refund_percentage: refundPct,
    auto_banned: refundPct >= AUTO_BAN_THRESHOLD,
  });
}
