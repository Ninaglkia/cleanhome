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
        "group flex w-full items-center gap-5 rounded-2xl border-2 p-6 text-left transition-all duration-200",
        selected
          ? "border-accent bg-white shadow-md shadow-accent/15 scale-[1.02]"
          : "border-white/15 bg-white/5 backdrop-blur-sm hover:border-white/30 hover:bg-white/10"
      )}
    >
      <div className={cn(
        "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-all duration-200",
        selected ? "bg-accent text-white shadow-sm shadow-accent/30" : "bg-white/10 text-white/60 group-hover:bg-white/15 group-hover:text-white/80"
      )}>
        <Icon className="h-7 w-7" />
      </div>
      <div>
        <h3 className={cn(
          "text-lg font-bold transition-colors",
          selected ? "text-primary" : "text-white"
        )}>{title}</h3>
        <p className={cn(
          "mt-0.5 text-sm transition-colors",
          selected ? "text-muted-foreground" : "text-white/50"
        )}>{description}</p>
      </div>
    </button>
  );
}
