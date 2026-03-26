import { cn } from "@/lib/utils";
import { Sparkles, Search } from "lucide-react";

const icons = {
  sparkles: Sparkles,
  search: Search,
} as const;

interface RoleCardProps {
  title: string;
  description: string;
  icon: keyof typeof icons;
  selected: boolean;
  onClick: () => void;
}

export function RoleCard({ title, description, icon, selected, onClick }: RoleCardProps) {
  const Icon = icons[icon];

  return (
    <button
      role="button"
      data-selected={selected}
      onClick={onClick}
      className={cn(
        "flex w-full flex-col items-center gap-4 rounded-2xl border-2 bg-card p-8 text-center transition-all",
        selected ? "border-accent shadow-lg shadow-accent/20" : "border-border hover:border-accent/50"
      )}
    >
      <div className={cn(
        "flex h-16 w-16 items-center justify-center rounded-full",
        selected ? "bg-accent text-primary" : "bg-muted text-muted-foreground"
      )}>
        <Icon className="h-8 w-8" />
      </div>
      <div>
        <h3 className="text-xl font-semibold text-primary">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}
