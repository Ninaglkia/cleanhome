import { CheckCircle2 } from "lucide-react";

interface CleanerServicesListProps {
  services: string[];
}

export function CleanerServicesList({ services }: CleanerServicesListProps) {
  if (!services || services.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 bg-card px-6 py-5">
      <h2 className="font-semibold text-primary">Servizi offerti</h2>
      <ul className="flex flex-col gap-2">
        {services.map((s) => (
          <li key={s} className="flex items-center gap-2 text-sm text-primary">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}
