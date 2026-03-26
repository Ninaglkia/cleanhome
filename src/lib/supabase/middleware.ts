import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const publicRoutes = ["/", "/login", "/signup", "/choose-role"];
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith("/auth")
  );

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("active_role, cleaner_onboarded, role, is_banned")
      .eq("id", user.id)
      .single();

    if (profile) {
      if (profile.is_banned) {
        await supabase.auth.signOut();
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        return NextResponse.redirect(url);
      }

      if (pathname.startsWith("/admin") && profile.role !== "admin") {
        const url = request.nextUrl.clone();
        url.pathname = `/${profile.active_role}`;
        return NextResponse.redirect(url);
      }

      if (
        pathname.startsWith("/cleaner") &&
        profile.active_role === "cleaner" &&
        !profile.cleaner_onboarded &&
        !pathname.startsWith("/cleaner/onboarding")
      ) {
        const url = request.nextUrl.clone();
        url.pathname = "/cleaner/onboarding";
        return NextResponse.redirect(url);
      }

      if (isPublicRoute && pathname !== "/") {
        const url = request.nextUrl.clone();
        url.pathname = `/${profile.active_role}`;
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
