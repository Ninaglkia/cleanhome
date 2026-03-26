import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/notifications/preferences
 * Returns the current user's notification preferences.
 *
 * PATCH /api/notifications/preferences
 * Body: { push?: boolean; email?: boolean }
 * Updates notification preferences (partial merge).
 */

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("profiles")
    .select("notification_preferences")
    .eq("id", user.id)
    .single();

  return NextResponse.json(
    data?.notification_preferences ?? { push: true, email: true }
  );
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { push?: unknown; email?: unknown };

  // Validate booleans
  if ("push" in body && typeof body.push !== "boolean") {
    return NextResponse.json({ error: "push must be boolean" }, { status: 400 });
  }
  if ("email" in body && typeof body.email !== "boolean") {
    return NextResponse.json({ error: "email must be boolean" }, { status: 400 });
  }

  // Fetch existing prefs and merge
  const { data: existing } = await supabase
    .from("profiles")
    .select("notification_preferences")
    .eq("id", user.id)
    .single();

  const current = (existing?.notification_preferences as { push?: boolean; email?: boolean }) ?? {
    push: true,
    email: true,
  };

  const updated = {
    ...current,
    ...(typeof body.push === "boolean" ? { push: body.push } : {}),
    ...(typeof body.email === "boolean" ? { email: body.email } : {}),
  };

  const { error } = await supabase
    .from("profiles")
    .update({ notification_preferences: updated })
    .eq("id", user.id);

  if (error) {
    console.error("[notif-prefs] update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(updated);
}
