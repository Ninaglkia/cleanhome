import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NotificationList } from "@/components/notifications/notification-list";

export const dynamic = "force-dynamic";

export default async function CleanerNotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-lg">
      <div className="sticky top-0 z-10 border-b border-border bg-card px-4 py-4">
        <h2 className="font-serif text-2xl text-primary">Notifiche</h2>
      </div>
      <NotificationList userId={user.id} />
    </div>
  );
}
