import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/notifications/register-device
 * Body: { token: string; platform: "ios" | "android" | "web" }
 *
 * Upserts the FCM device token for the authenticated user.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { token, platform } = body as {
    token?: string;
    platform?: "ios" | "android" | "web";
  };

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }
  if (!platform || !["ios", "android", "web"].includes(platform)) {
    return NextResponse.json(
      { error: "platform must be ios, android, or web" },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("device_tokens").upsert(
    { user_id: user.id, token, platform },
    { onConflict: "user_id,token", ignoreDuplicates: false }
  );

  if (error) {
    console.error("[register-device] upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
