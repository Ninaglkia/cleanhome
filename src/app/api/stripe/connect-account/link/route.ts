import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_account_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_account_id) {
    return NextResponse.json(
      { error: "No Stripe account found. Create one first." },
      { status: 404 }
    );
  }

  const accountLink = await stripe.accountLinks.create({
    account: profile.stripe_account_id,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/cleaner/settings/payments?refresh=1`,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/cleaner/settings/payments?connected=1`,
    type: "account_onboarding",
  });

  return NextResponse.json({ url: accountLink.url });
}
