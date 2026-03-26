"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface User {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  active_role: string | null;
  banned: boolean | null;
  created_at: string;
}

const ROLE_OPTIONS = [
  { value: "all", label: "Tutti" },
  { value: "cleaner", label: "Pulitore" },
  { value: "client", label: "Cliente" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT");
}

export function UsersTable({
  users,
  currentRole,
  currentQ,
}: {
  users: User[];
  currentRole: string;
  currentQ: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(currentQ);
  const [isPending, startTransition] = useTransition();
  const [banningId, setBanningId] = useState<string | null>(null);

  function applyFilters(role: string, q: string) {
    const params = new URLSearchParams();
    if (role && role !== "all") params.set("role", role);
    if (q) params.set("q", q);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  async function toggleBan(userId: string, isBanned: boolean) {
    setBanningId(userId);
    try {
      await fetch(`/api/admin/users/${userId}/ban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banned: !isBanned }),
      });
      router.refresh();
    } finally {
      setBanningId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1">
          {ROLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => applyFilters(opt.value, search)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                currentRole === opt.value
                  ? "bg-primary text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <Input
          placeholder="Cerca per nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applyFilters(currentRole, search)}
          className="w-56"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => applyFilters(currentRole, search)}
          disabled={isPending}
        >
          Cerca
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Nome</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Email</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Ruolo</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Stato</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Registrato</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Nessun utente trovato.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium text-primary">
                    {u.full_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.role === "cleaner" || u.role === "both" ? (
                        <Badge className="bg-[#1a3a35] text-white border-0 text-xs">
                          Pulitore
                        </Badge>
                      ) : null}
                      {u.role === "client" || u.role === "both" ? (
                        <Badge className="bg-[#4fc4a3] text-[#1a3a35] border-0 text-xs">
                          Cliente
                        </Badge>
                      ) : null}
                      {!u.role && <span className="text-muted-foreground">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {u.banned ? (
                      <Badge className="bg-error text-white border-0 text-xs">
                        Bannato
                      </Badge>
                    ) : (
                      <Badge className="bg-success text-white border-0 text-xs">
                        Attivo
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(u.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      size="sm"
                      variant={u.banned ? "outline" : "destructive"}
                      disabled={banningId === u.id}
                      onClick={() => toggleBan(u.id, !!u.banned)}
                    >
                      {banningId === u.id
                        ? "..."
                        : u.banned
                        ? "Riabilita"
                        : "Banna"}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
