import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp,
  Users,
  CalendarDays,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react";

export const dynamic = "force-dynamic";

async function getDashboardStats() {
  const supabase = createAdminClient();

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    { data: allBookings },
    { count: activeUsers },
    { data: weekPayouts },
    { data: monthPayouts },
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, status, total_price")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .neq("role", "admin")
      .then((r) => ({ count: r.count })),
    supabase
      .from("payouts")
      .select("total_gross")
      .gte("created_at", weekStart.toISOString()),
    supabase
      .from("payouts")
      .select("total_gross")
      .gte("created_at", monthStart.toISOString()),
  ]);

  const bookings = allBookings ?? [];
  const total = bookings.reduce((s, b) => s + (b.total_price ?? 0), 0);
  const fatturato = total * 0.18;

  const weekGross = (weekPayouts ?? []).reduce(
    (s, p) => s + (p.total_gross ?? 0),
    0
  );
  const monthGross = (monthPayouts ?? []).reduce(
    (s, p) => s + (p.total_gross ?? 0),
    0
  );

  return {
    fatturato,
    commissioneSettimana: weekGross * 0.18,
    commissioneMese: monthGross * 0.18,
    utentiAttivi: activeUsers ?? 0,
    totali: bookings.length,
    completate: bookings.filter((b) => b.status === "completed").length,
    inCorso: bookings.filter((b) => b.status === "confirmed").length,
    annullate: bookings.filter((b) => b.status === "cancelled").length,
  };
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`rounded-md p-2 ${color}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-primary">{value}</p>
      </CardContent>
    </Card>
  );
}

function fmt(n: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default async function AdminDashboard() {
  const stats = await getDashboardStats();

  return (
    <div className="p-8">
      <h1 className="font-serif text-2xl text-primary mb-1">Dashboard</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Panoramica generale della piattaforma
      </p>

      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Fatturato & Commissioni
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        <StatCard
          title="Fatturato totale (18%)"
          value={fmt(stats.fatturato)}
          icon={TrendingUp}
          color="bg-[#1a3a35]"
        />
        <StatCard
          title="Commissioni questa settimana"
          value={fmt(stats.commissioneSettimana)}
          icon={TrendingUp}
          color="bg-[#4fc4a3]"
        />
        <StatCard
          title="Commissioni questo mese"
          value={fmt(stats.commissioneMese)}
          icon={TrendingUp}
          color="bg-[#4fc4a3]"
        />
      </div>

      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Utenti
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        <StatCard
          title="Utenti attivi"
          value={stats.utentiAttivi.toLocaleString("it-IT")}
          icon={Users}
          color="bg-[#1a3a35]"
        />
      </div>

      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Prenotazioni
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Totali"
          value={stats.totali.toLocaleString("it-IT")}
          icon={CalendarDays}
          color="bg-[#1a3a35]"
        />
        <StatCard
          title="Completate"
          value={stats.completate.toLocaleString("it-IT")}
          icon={CheckCircle}
          color="bg-[#38a169]"
        />
        <StatCard
          title="In corso"
          value={stats.inCorso.toLocaleString("it-IT")}
          icon={Clock}
          color="bg-[#4fc4a3]"
        />
        <StatCard
          title="Annullate"
          value={stats.annullate.toLocaleString("it-IT")}
          icon={XCircle}
          color="bg-[#e53e3e]"
        />
      </div>
    </div>
  );
}
