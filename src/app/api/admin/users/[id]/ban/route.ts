import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin(req);
  if (guard) return guard;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const banned = Boolean(body.banned);

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({ banned })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, banned });
}
